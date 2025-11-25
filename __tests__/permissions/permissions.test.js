// __tests__/permissions/permissions.routes.test.js
const request = require("supertest");
const express = require("express");

// Mocks des modèles & middlewares
jest.mock("../../models/Permission.js", () => ({
    find: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
}));

jest.mock("../../models/RolePermission.js", () => ({
    deleteMany: jest.fn(),
}));

jest.mock("../../middleware/auth.js", () => {
    return (req, res, next) => {
        req.user = { id: "test-user" };
        next();
    };
});

jest.mock("../../middleware/requirePermission.js", () => {
    return () => (req, res, next) => next();
});

const Permission = require("../../models/Permission.js");
const RolePermission = require("../../models/RolePermission.js");
const permissionRoutes = require("../../routes/permission.routes.js");

describe("Permissions routes", () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use("/api/permissions", permissionRoutes);

        jest.clearAllMocks();
    });

    test("POST /api/permissions/create crée une permission", async () => {
        const body = { name: "Permissions lecture", slug: "permissions.read" };
        const created = { _id: "1", ...body };

        Permission.create.mockResolvedValue(created);

        const res = await request(app)
            .post("/api/permissions/create")
            .send(body);

        expect(Permission.create).toHaveBeenCalledWith(body);
        expect(res.status).toBe(201);
        expect(res.body).toEqual(created);
    });

    test("PUT /api/permissions/update/:id met à jour une permission", async () => {
        const updated = { _id: "1", name: "Updated", slug: "permissions.read" };

        Permission.findByIdAndUpdate.mockResolvedValue(updated);

        const res = await request(app)
            .put("/api/permissions/update/1")
            .send({ name: "Updated" });

        expect(Permission.findByIdAndUpdate).toHaveBeenCalledWith(
            "1",
            { name: "Updated" },
            { new: true, runValidators: true }
        );
        expect(res.status).toBe(200);
        expect(res.body).toEqual(updated);
    });

    test("DELETE /api/permissions/delete/:id supprime une permission", async () => {
        const perm = { _id: "1", name: "to-delete" };
        Permission.findByIdAndDelete.mockResolvedValue(perm);
        RolePermission.deleteMany.mockResolvedValue({ deletedCount: 0 });

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
