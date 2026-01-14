const request = require("supertest");
const express = require("express");

// Mock models BEFORE importing routes
jest.mock("../../models/Permission.js", () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
}));

jest.mock("../../models/RolePermission.js", () => ({
    deleteMany: jest.fn(),
    insertMany: jest.fn(), // Ajouté pour la route create
}));

// NOUVEAU : Mock du modèle Role
jest.mock("../../models/Role.js", () => ({
    find: jest.fn(),
}));

// Mock middleware BEFORE importing routes
jest.mock("../../middleware/auth.js", () => {
    return (req, res, next) => {
        req.user = { id: "test-user" };
        next();
    };
});

jest.mock("../../middleware/requirePermission.js", () => {
    return () => (req, res, next) => next();
});

// Import after mocks
const Permission = require("../../models/Permission.js");
const RolePermission = require("../../models/RolePermission.js");
const Role = require("../../models/Role.js"); // Ajouté
const permissionRoutes = require("../../routes/permission.routes.js");

describe("Permissions routes", () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use("/api/permissions", permissionRoutes);

        jest.clearAllMocks();
    });

    test("POST /api/permissions/create", async () => {
        const body = {
            categorie: "Users",
            description: "Permission de lecture",
            name: "Permissions lecture",
            value: "permissions.read"
        };
        const created = { _id: "1", ...body };
        const mockRoles = [
            { _id: "role1" },
            { _id: "role2" }
        ];

        Permission.create.mockResolvedValue(created);
        Role.find.mockResolvedValue(mockRoles); // Mock Role.find
        RolePermission.insertMany.mockResolvedValue([
            { role_id: "role1", permission_id: "1", actif: false },
            { role_id: "role2", permission_id: "1", actif: false }
        ]);

        const res = await request(app)
            .post("/api/permissions/create")
            .send(body);

        expect(Permission.create).toHaveBeenCalledWith(body);
        expect(Role.find).toHaveBeenCalledWith({}, { _id: 1 });
        expect(RolePermission.insertMany).toHaveBeenCalled();
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('perm');
        expect(res.body).toHaveProperty('roles_linked', 2);
    });

    test("PUT /api/permissions/update/:id met à jour une permission", async () => {
        const updated = {
            _id: "1",
            categorie: "Users",
            name: "Updated",
            value: "permissions.read",
            description: "Updated desc"
        };

        Permission.findByIdAndUpdate.mockResolvedValue(updated);

        const res = await request(app)
            .put("/api/permissions/update/1")
            .send({ name: "Updated", description: "Updated desc" });

        expect(Permission.findByIdAndUpdate).toHaveBeenCalledWith(
            "1",
            { name: "Updated", description: "Updated desc" },
            { new: true, runValidators: true }
        );
        expect(res.status).toBe(200);
        expect(res.body).toEqual(updated);
    });

    test("DELETE /api/permissions/delete/:id supprime une permission", async () => {
        const perm = { _id: "1", name: "to-delete" };
        Permission.findByIdAndDelete.mockResolvedValue(perm);
        RolePermission.deleteMany.mockResolvedValue({ deletedCount: 2 });

        const res = await request(app).delete("/api/permissions/delete/1");

        expect(Permission.findByIdAndDelete).toHaveBeenCalledWith("1");
        expect(RolePermission.deleteMany).toHaveBeenCalledWith({ permission_id: perm._id });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            message: "Permission supprimée",
            id: perm._id,
        });
    });
});