// __tests__/users/users.routes.test.js
const request = require("supertest");
const express = require("express");

jest.mock("../../models/User.js", () => ({
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
}));

jest.mock("../../models/Role.js", () => ({
    findById: jest.fn(),
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
    hash: jest.fn(async () => "hashed-password"),
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

    test("GET /api/users/all retourne la liste des users sans password", async () => {
        const users = [
            {
                _id: "1",
                nom: "Doe",
                prenom: "John",
                email: "john@example.com",
                role_id: { _id: "r1", name: "Admin" },
            },
        ];

        const query = {
            select: jest.fn().mockReturnThis(),
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockResolvedValue(users),
        };

        User.find.mockReturnValue(query);

        const res = await request(app).get("/api/users/all");

        expect(User.find).toHaveBeenCalled();
        expect(query.select).toHaveBeenCalledWith("-password");
        expect(query.populate).toHaveBeenCalledWith("role_id");
        expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
        expect(res.status).toBe(200);
        expect(res.body).toEqual(users);
    });

    test("GET /api/users/view/user/:id retourne un user ou 404", async () => {
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

        const res = await request(app).get("/api/users/view/user/1");

        expect(User.findById).toHaveBeenCalledWith("1");
        expect(query.select).toHaveBeenCalledWith("-password");
        expect(query.populate).toHaveBeenCalledWith("role_id");
        expect(res.status).toBe(200);
        expect(res.body).toEqual(user);
    });

    test("POST /api/users/create crée un user (avec hash du password)", async () => {
        const body = {
            nom: "Doe",
            prenom: "John",
            email: "john@example.com",
            password: "secret",
            role_id: "r1",
            actif: true,
        };

        Role.findById.mockResolvedValue({ _id: "r1", name: "Admin" });
        User.findOne.mockResolvedValue(null); // email libre
        bcrypt.hash.mockResolvedValue("hashed-password");
        User.create.mockResolvedValue({
            ...body,
            _id: "1",
            password: "hashed-password",
            toObject() {
                return { ...this };
            },
        });

        const res = await request(app).post("/api/users/create").send(body);

        expect(Role.findById).toHaveBeenCalledWith("r1");
        expect(User.findOne).toHaveBeenCalledWith({ email: body.email });
        expect(bcrypt.hash).toHaveBeenCalledWith("secret", 10);
        expect(User.create).toHaveBeenCalled();
        expect(res.status).toBe(201);
        expect(res.body.password).toBeUndefined();
        expect(res.body.email).toBe(body.email);
    });

    test("PUT /api/users/update/user/:id met à jour un user (avec hash si password)", async () => {
        const body = { nom: "Updated", password: "newpass" };

        const updatedUser = {
            _id: "1",
            nom: "Updated",
            prenom: "John",
            email: "john@example.com",
            role_id: { _id: "r1", name: "Admin" },
        };

        bcrypt.hash.mockResolvedValue("hashed-newpass");

        const query = {
            select: jest.fn().mockReturnThis(),
            populate: jest.fn().mockResolvedValue(updatedUser),
        };

        User.findByIdAndUpdate.mockReturnValue(query);

        const res = await request(app).put("/api/users/update/user/1").send(body);

        expect(bcrypt.hash).toHaveBeenCalledWith("newpass", 10);
        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
            "1",
            { nom: "Updated", password: "hashed-newpass" },
            { new: true, runValidators: true }
        );
        expect(res.status).toBe(200);
        expect(res.body).toEqual(updatedUser);
    });

    test("DELETE /api/users/delete/:id supprime un user", async () => {
        const user = { _id: "1", email: "john@example.com" };
        User.findByIdAndDelete.mockResolvedValue(user);

        const res = await request(app).delete("/api/users/delete/user/1");

        expect(User.findByIdAndDelete).toHaveBeenCalledWith("1");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: "Supprimé", id: user._id });
    });
});
