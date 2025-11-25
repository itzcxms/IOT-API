
// __tests__/roles/roles.routes.test.js
const request = require("supertest");
const express = require("express");

// Mocks
jest.mock("../../models/Role.js", () => ({
    find: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findById: jest.fn(),
}));

jest.mock("../../models/RolePermission.js", () => ({
    deleteMany: jest.fn(),
    bulkWrite: jest.fn(),
    find: jest.fn(),
}));

jest.mock("../../models/Permission.js", () => ({
    find: jest.fn(),
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

const Role = require("../../models/Role.js");
const RolePermission = require("../../models/RolePermission.js");
const Permission = require("../../models/Permission.js");
const roleRoutes = require("../../routes/role.routes.js");

describe("Roles routes", () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use("/api/roles", roleRoutes);
        jest.clearAllMocks();
    });

    test("GET /api/roles/all liste les rôles", async () => {
        const roles = [{ _id: "1", name: "Admin", poids: 1 }];

        const sortMock = jest.fn().mockResolvedValue(roles);
        Role.find.mockReturnValue({ sort: sortMock });

        const res = await request(app).get("/api/roles/all");

        expect(Role.find).toHaveBeenCalled();
        expect(sortMock).toHaveBeenCalledWith({ poids: 1 });
        expect(res.status).toBe(200);
        expect(res.body).toEqual(roles);
    });

    test("POST /api/roles/create crée un rôle", async () => {
        const body = { name: "Directeur", poids: 2 };
        const created = { _id: "2", ...body };

        Role.create.mockResolvedValue(created);

        const res = await request(app).post("/api/roles/create").send(body);

        expect(Role.create).toHaveBeenCalledWith(body);
        expect(res.status).toBe(201);
        expect(res.body).toEqual(created);
    });

    test("PUT /api/roles/update/role/:id met à jour un rôle", async () => {
        const updated = { _id: "1", name: "Admin+", poids: 1 };

        Role.findByIdAndUpdate.mockResolvedValue(updated);

        const res = await request(app)
            .put("/api/roles/update/role/1")
            .send({ name: "Admin+" });

        expect(Role.findByIdAndUpdate).toHaveBeenCalledWith(
            "1",
            { name: "Admin+" },
            { new: true, runValidators: true }
        );
        expect(res.status).toBe(200);
        expect(res.body).toEqual(updated);
    });

    test("DELETE /api/roles/delete/role/:id supprime un rôle", async () => {
        const role = { _id: "1", name: "ToDelete" };
        Role.findByIdAndDelete.mockResolvedValue(role);
        RolePermission.deleteMany.mockResolvedValue({ deletedCount: 0 });

        const res = await request(app).delete("/api/roles/delete/role/1");

        expect(Role.findByIdAndDelete).toHaveBeenCalledWith("1");
        expect(RolePermission.deleteMany).toHaveBeenCalledWith({ role_id: role._id });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            message: "Rôle supprimé",
            id: role._id,
        });
    });

    test("POST /api/roles/:id/permissions assigne des permissions au rôle", async () => {
        const role = { _id: "1", name: "Admin" };
        const permission_ids = ["p1", "p2"];
        const perms = permission_ids.map(id => ({ _id: id }));

        Role.findById.mockResolvedValue(role);
        Permission.find.mockResolvedValue(perms);
        RolePermission.bulkWrite.mockResolvedValue({});

        const res = await request(app)
            .post("/api/roles/1/permissions")
            .send({ permission_ids });

        expect(Role.findById).toHaveBeenCalledWith("1");
        expect(Permission.find).toHaveBeenCalledWith({
            _id: { $in: permission_ids },
        });
        expect(RolePermission.bulkWrite).toHaveBeenCalled();
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: "Permissions ajoutées au rôle" });
    });

    test("GET /api/roles/:id/permissions retourne les permissions du rôle", async () => {
        const links = [
            { permission_id: { _id: "p1", name: "permissions.read" } },
            { permission_id: { _id: "p2", name: "permissions.create" } },
        ];

        const populateMock = jest.fn().mockResolvedValue(links);
        RolePermission.find.mockReturnValue({ populate: populateMock });

        const res = await request(app).get("/api/roles/1/permissions");

        expect(RolePermission.find).toHaveBeenCalledWith({ role_id: "1" });
        expect(populateMock).toHaveBeenCalledWith("permission_id");
        expect(res.status).toBe(200);
        expect(res.body).toEqual(links.map(l => l.permission_id));
    });
});
