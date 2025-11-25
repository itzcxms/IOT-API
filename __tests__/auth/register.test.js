// tests/register.test.js
const request = require("supertest");
const express = require("express");

// On mock les modèles et middlewares AVANT d'importer le router
jest.mock("../../models/User.js", () => ({
    findOne: jest.fn(),
    create: jest.fn(),
}));

jest.mock("../../models/Role.js", () => ({
    findById: jest.fn(),
}));

// auth : on fait comme si l'utilisateur était authentifié
jest.mock("../../middleware/auth.js", () => {
    return (req, res, next) => {
        req.user = { id: "adminId" };
        next();
    };
});

// requirePermission("user.create") : on laisse passer tout le monde en test
jest.mock("../../middleware/requirePermission.js", () => {
    return () => (req, res, next) => next();
});

// On mock bcrypt et jwt pour éviter la vraie crypto
jest.mock("bcrypt", () => ({
    hash: jest.fn(async () => "hashed-password"),
}));

jest.mock("jsonwebtoken", () => ({
    sign: jest.fn(() => "fake-jwt-token"),
}));

// Maintenant qu'on a mocké tout ça, on peut importer le router
const authRoutes = require("../../routes/auth.routes");
const User = require("../../models/User.js");
const Role = require("../../models/Role.js");

describe("POST /api/auth/register", () => {
    let app;

    beforeAll(() => {
        // variables d'env nécessaires au register
        process.env.JWT_SECRET = "test-secret";
        process.env.TOKEN = "15m";
        process.env.REFRESHTOKEN = "7d";
    });

    beforeEach(() => {
        // nouvelle app Express pour chaque test
        app = express();
        app.use(express.json());
        app.use("/api/auth", authRoutes);

        // reset des mocks
        User.findOne.mockReset();
        User.create.mockReset();
        Role.findById.mockReset();
    });

    test("retourne 400 si des champs obligatoires manquent", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .send({
                email: "test@example.com",
                // pas de nom, prenom, password, role_id
            });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty("message");
        // optionnel : vérifier le texte exact
        // expect(res.body.message).toBe("Tous les champs sont obligatoires");
    });

    test("retourne 409 si l'email existe déjà", async () => {
        User.findOne.mockResolvedValue({
            _id: "existingId",
            email: "dup@example.com",
        });

        const res = await request(app)
            .post("/api/auth/register")
            .send({
                nom: "Doe",
                prenom: "John",
                email: "dup@example.com",
                password: "password123",
                role_id: "roleId",
            });

        expect(User.findOne).toHaveBeenCalledWith({ email: "dup@example.com" });
        expect(res.status).toBe(409);
        expect(res.body).toHaveProperty("message");
        // expect(res.body.message).toBe("Un utilisateur avec cet email existe déjà");
    });

    test("retourne 404 si le rôle est introuvable", async () => {
        User.findOne.mockResolvedValue(null); // email libre
        Role.findById.mockResolvedValue(null); // rôle introuvable

        const res = await request(app)
            .post("/api/auth/register")
            .send({
                nom: "Doe",
                prenom: "John",
                email: "john@example.com",
                password: "password123",
                role_id: "inexistantRoleId",
            });

        expect(Role.findById).toHaveBeenCalledWith("inexistantRoleId");
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty("message");
        // expect(res.body.message).toBe("Rôle introuvable");
    });

    test("crée un utilisateur et retourne 201", async () => {
        User.findOne.mockResolvedValue(null); // email libre
        Role.findById.mockResolvedValue({
            _id: "roleId",
            name: "admin",
            permissions: ["user.create"],
        });

        // faux user renvoyé par User.create
        User.create.mockResolvedValue({
            _id: "newUserId",
            nom: "Doe",
            prenom: "John",
            email: "john@example.com",
            password: "hashed-password",
            role: "roleId",
            toObject() {
                return {
                    _id: this._id,
                    nom: this.nom,
                    prenom: this.prenom,
                    email: this.email,
                    role: this.role,
                    password: this.password,
                };
            },
        });

        const body = {
            nom: "Doe",
            prenom: "John",
            email: "john@example.com",
            password: "password123",
            role_id: "roleId",
        };

        const res = await request(app).post("/api/auth/register").send(body);

        expect(User.findOne).toHaveBeenCalledWith({ email: body.email });
        expect(Role.findById).toHaveBeenCalledWith(body.role_id);
        expect(User.create).toHaveBeenCalled();

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty("message");
        expect(res.body).toHaveProperty("user");

        // Le mot de passe ne doit pas être renvoyé
        expect(res.body.user).not.toHaveProperty("password");
        expect(res.body.user.email).toBe(body.email);
    });
});
