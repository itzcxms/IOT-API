// __tests__/users/users.routes.test.js
const request = require("supertest");
const express = require("express");

/**
 * IMPORTANT
 * - Ces tests mockent Mongoose + middlewares pour tester uniquement la logique des routes.
 * - Adapte les chemins "../../routes/user.routes.js" selon l'emplacement réel dans ton projet.
 */

jest.mock("../../models/User.js", () => ({
    aggregate: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
}));

jest.mock("../../models/Role.js", () => ({
    findById: jest.fn(),
    findOne: jest.fn(),
}));

jest.mock("../../middleware/auth.js", () => {
    return (req, res, next) => {
        req.user = { id: "admin-id" };
        next();
    };
});

jest.mock("../../middleware/requirePermission.js", () => {
    return () => (req, res, next) => next();
});

jest.mock("bcrypt", () => ({
    hash: jest.fn(),
}));

const User = require("../../models/User.js");
const Role = require("../../models/Role.js");
const bcrypt = require("bcrypt");
const userRoutes = require("../../routes/user.routes.js");

describe("Users routes", () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use("/api/users", userRoutes);
        jest.clearAllMocks();
    });

    describe("GET /api/users/me", () => {
        test("retourne l'utilisateur courant (sans password) ou 404 si introuvable", async () => {
            const user = {
                _id: "admin-id",
                nom: "Admin",
                prenom: "Root",
                email: "admin@example.com",
                role_id: { _id: "r1", name: "Admin" },
            };

            const query = {
                select: jest.fn().mockReturnThis(),
                populate: jest.fn().mockResolvedValue(user),
            };

            User.findById.mockReturnValue(query);

            const res = await request(app).get("/api/users/me");

            expect(User.findById).toHaveBeenCalledWith("admin-id");
            expect(query.select).toHaveBeenCalledWith("-password -passwordHash -__v");
            expect(query.populate).toHaveBeenCalledWith("role_id");
            expect(res.status).toBe(200);
            expect(res.body).toEqual(user);
        });

        test("retourne 404 si l'utilisateur courant n'existe pas", async () => {
            const query = {
                select: jest.fn().mockReturnThis(),
                populate: jest.fn().mockResolvedValue(null),
            };
            User.findById.mockReturnValue(query);

            const res = await request(app).get("/api/users/me");

            expect(res.status).toBe(404);
            expect(res.body).toEqual({ message: "Utilisateur introuvable" });
        });
    });

    describe("GET /api/users/all", () => {
        test("retourne la liste des users via aggregate (sans password) et exclut le super admin", async () => {
            const users = [
                {
                    _id: "1",
                    nom: "Doe",
                    prenom: "John",
                    email: "john@example.com",
                    role: { _id: "r1", name: "Admin", poids: 10 },
                },
            ];

            User.aggregate.mockResolvedValue(users);

            const res = await request(app).get("/api/users/all");

            expect(User.aggregate).toHaveBeenCalledTimes(1);

            // Vérifie que la pipeline contient les étapes "clefs" (sans la rendre trop fragile)
            const pipeline = User.aggregate.mock.calls[0][0];
            expect(Array.isArray(pipeline)).toBe(true);
            expect(pipeline).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ $lookup: expect.any(Object) }),
                    expect.objectContaining({ $unwind: "$role" }),
                    expect.objectContaining({ $match: { "role.poids": { $lt: 1000 } } }),
                    expect.objectContaining({ $sort: { "role.poids": -1, createdAt: -1 } }),
                    expect.objectContaining({ $project: { password: 0 } }),
                ])
            );

            expect(res.status).toBe(200);
            expect(res.body).toEqual(users);
        });

        test("retourne 500 si erreur serveur", async () => {
            User.aggregate.mockRejectedValue(new Error("boom"));

            const res = await request(app).get("/api/users/all");

            expect(res.status).toBe(500);
            expect(res.body).toEqual({
                message: "Erreur serveur lors de la récupération des utilisateurs",
            });
        });
    });

    describe("GET /api/users/view/:id", () => {
        test("retourne un user (sans password) ou 404", async () => {
            const user = {
                _id: "1",
                nom: "Doe",
                prenom: "John",
                email: "john@example.com",
                role_id: { _id: "r1", name: "Admin" },
            };

            const query = {
                select: jest.fn().mockReturnThis(),
                populate: jest.fn().mockResolvedValue(user),
            };

            User.findById.mockReturnValue(query);

            const res = await request(app).get("/api/users/view/1");

            expect(User.findById).toHaveBeenCalledWith("1");
            expect(query.select).toHaveBeenCalledWith("-password");
            expect(query.populate).toHaveBeenCalledWith("role_id");
            expect(res.status).toBe(200);
            expect(res.body).toEqual(user);
        });

        test("retourne 404 si user introuvable", async () => {
            const query = {
                select: jest.fn().mockReturnThis(),
                populate: jest.fn().mockResolvedValue(null),
            };
            User.findById.mockReturnValue(query);

            const res = await request(app).get("/api/users/view/404");

            expect(res.status).toBe(404);
            expect(res.body).toEqual({ message: "Utilisateur introuvable" });
        });
    });

    describe("POST /api/users/create", () => {
        test("400 si champs requis manquants", async () => {
            const res = await request(app).post("/api/users/create").send({
                nom: "Doe",
                prenom: "John",
                email: "john@example.com",
                // password manquant
            });

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ message: "Champs requis manquants" });
        });

        test("409 si email déjà utilisé", async () => {
            User.findOne.mockResolvedValue({ _id: "u1" });

            const res = await request(app).post("/api/users/create").send({
                nom: "Doe",
                prenom: "John",
                email: "john@example.com",
                password: "secret",
                role_id: "r1",
            });

            expect(User.findOne).toHaveBeenCalledWith({ email: "john@example.com" });
            expect(res.status).toBe(409);
            expect(res.body).toEqual({ message: "Email déjà utilisé" });
        });

        test("201 crée un user (avec hash du password) quand role_id est fourni", async () => {
            const body = {
                nom: "Doe",
                prenom: "John",
                email: "john@example.com",
                password: "secret",
                role_id: "r1",
            };

            Role.findById.mockResolvedValue({ _id: "r1", name: "Admin" });
            User.findOne.mockResolvedValue(null);
            bcrypt.hash.mockResolvedValue("hashed-password");
            User.create.mockResolvedValue({ _id: "1" });

            const res = await request(app).post("/api/users/create").send(body);

            expect(Role.findById).toHaveBeenCalledWith("r1");
            expect(User.findOne).toHaveBeenCalledWith({ email: body.email });
            expect(bcrypt.hash).toHaveBeenCalledWith("secret", 10);

            expect(User.create).toHaveBeenCalledWith({
                nom: "Doe",
                prenom: "John",
                email: "john@example.com",
                password: "hashed-password",
                role_id: "r1",
                actif: true,
            });

            expect(res.status).toBe(201);
            expect(res.body).toEqual({
                message: "L'utilisateur a bien été créé !",
                user: {
                    id: "1",
                    nom: "Doe",
                    prenom: "John",
                    email: "john@example.com",
                    role_id: "r1",
                    actif: true,
                },
            });
        });

        test("201 crée un user (role par défaut) quand role_id est absent", async () => {
            const body = {
                nom: "Doe",
                prenom: "John",
                email: "john@example.com",
                password: "secret",
            };

            User.findOne.mockResolvedValue(null);
            // 1ère recherche "utilisateur" -> null, puis fallback -> rôle trouvé
            Role.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: "r2", name: "utilisateur" });
            bcrypt.hash.mockResolvedValue("hashed-password");
            User.create.mockResolvedValue({ _id: "1" });

            const res = await request(app).post("/api/users/create").send(body);

            expect(Role.findOne).toHaveBeenNthCalledWith(1, { name: "utilisateur" });
            expect(Role.findOne).toHaveBeenNthCalledWith(2);
            expect(res.status).toBe(201);
            expect(res.body.user.role_id).toBe("r2");
        });

        test("404 si aucun rôle disponible", async () => {
            const body = {
                nom: "Doe",
                prenom: "John",
                email: "john@example.com",
                password: "secret",
                role_id: "missing-role",
            };

            User.findOne.mockResolvedValue(null);
            Role.findById.mockResolvedValue(null);

            const res = await request(app).post("/api/users/create").send(body);

            expect(res.status).toBe(404);
            expect(res.body).toEqual({ message: "Aucun rôle disponible" });
        });

        test("500 si erreur serveur", async () => {
            User.findOne.mockRejectedValue(new Error("boom"));

            const res = await request(app).post("/api/users/create").send({
                nom: "Doe",
                prenom: "John",
                email: "john@example.com",
                password: "secret",
            });

            expect(res.status).toBe(500);
            expect(res.body).toEqual({
                message: "Erreur serveur lors de la création de l'utilisateur",
            });
        });
    });

    describe("PUT /api/users/update/:id", () => {
        test("404 si user introuvable", async () => {
            User.findById.mockResolvedValue(null);

            const res = await request(app).put("/api/users/update/404").send({ nom: "X" });

            expect(res.status).toBe(404);
            expect(res.body).toEqual({ message: "Utilisateur introuvable" });
        });

        test("400 si role_id fourni mais invalide", async () => {
            User.findById.mockResolvedValue({ _id: "1", role_id: "r1", authzVersion: 0 });
            Role.findById.mockResolvedValue(null);

            const res = await request(app).put("/api/users/update/1").send({ role_id: "bad-role" });

            expect(Role.findById).toHaveBeenCalledWith("bad-role");
            expect(res.status).toBe(400);
            expect(res.body).toEqual({ message: "Rôle invalide" });
        });

        test("200 met à jour un user et hash le password si fourni", async () => {
            User.findById.mockResolvedValue({ _id: "1", role_id: "r1", authzVersion: 0 });
            bcrypt.hash.mockResolvedValue("hashed-newpass");

            const updatedUser = {
                _id: "1",
                nom: "Updated",
                email: "john@example.com",
                role_id: { _id: "r1", name: "Admin" },
            };

            const query = {
                select: jest.fn().mockReturnThis(),
                populate: jest.fn().mockResolvedValue(updatedUser),
            };
            User.findByIdAndUpdate.mockReturnValue(query);

            const res = await request(app).put("/api/users/update/1").send({
                nom: "Updated",
                password: "newpass",
            });

            expect(bcrypt.hash).toHaveBeenCalledWith("newpass", 10);
            expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
                "1",
                { nom: "Updated", password: "hashed-newpass" },
                { new: true, runValidators: true }
            );

            expect(query.select).toHaveBeenCalledWith("-password");
            expect(query.populate).toHaveBeenCalledWith("role_id");

            expect(res.status).toBe(200);
            expect(res.body).toEqual(updatedUser);
        });

        test("200 bump authzVersion si changement de rôle", async () => {
            User.findById.mockResolvedValue({ _id: "1", role_id: "r1", authzVersion: 3 });
            Role.findById.mockResolvedValue({ _id: "r2", name: "Manager" });

            const updatedUser = { _id: "1", role_id: { _id: "r2", name: "Manager" }, authzVersion: 4 };
            const query = {
                select: jest.fn().mockReturnThis(),
                populate: jest.fn().mockResolvedValue(updatedUser),
            };
            User.findByIdAndUpdate.mockReturnValue(query);

            const res = await request(app).put("/api/users/update/1").send({ role_id: "r2" });

            expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
                "1",
                { role_id: "r2", authzVersion: 4 },
                { new: true, runValidators: true }
            );
            expect(res.status).toBe(200);
            expect(res.body.authzVersion).toBe(4);
        });

        test("400 si exception (ex: validation)", async () => {
            User.findById.mockResolvedValue({ _id: "1", role_id: "r1", authzVersion: 0 });
            User.findByIdAndUpdate.mockImplementation(() => {
                throw new Error("Validation error");
            });

            const res = await request(app).put("/api/users/update/1").send({ nom: "X" });

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ message: "Validation error" });
        });
    });

    describe("DELETE /api/users/delete/:id", () => {
        test("200 supprime un user", async () => {
            User.findByIdAndDelete.mockResolvedValue({ _id: "1" });

            const res = await request(app).delete("/api/users/delete/1");

            expect(User.findByIdAndDelete).toHaveBeenCalledWith("1");
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ message: "Supprimé", id: "1" });
        });

        test("404 si user introuvable", async () => {
            User.findByIdAndDelete.mockResolvedValue(null);

            const res = await request(app).delete("/api/users/delete/404");

            expect(res.status).toBe(404);
            expect(res.body).toEqual({ message: "Utilisateur introuvable" });
        });

        test("500 si erreur serveur", async () => {
            User.findByIdAndDelete.mockRejectedValue(new Error("boom"));

            const res = await request(app).delete("/api/users/delete/1");

            expect(res.status).toBe(500);
            expect(res.body).toEqual({
                message: "Erreur serveur lors de la suppression de l'utilisateur",
            });
        });
    });
});
