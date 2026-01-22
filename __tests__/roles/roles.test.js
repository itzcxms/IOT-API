// __tests__/roles/roles.routes.test.js
const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");

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
    updateMany: jest.fn(),
    insertMany: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));

jest.mock("../../models/Permission.js", () => ({
    find: jest.fn(),
    findById: jest.fn(),
}));

// Mock User avec updateMany qui fonctionne correctement
jest.mock("../../models/User.js", () => ({
    updateMany: jest.fn(),
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
const User = require("../../models/User.js");
const roleRoutes = require("../../routes/role.routes.js");

describe("Roles routes", () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use("/api/roles", roleRoutes);
        jest.clearAllMocks();
    });

    describe("GET /api/roles/all", () => {
        test("liste les rôles avec poids entre 1 et 100", async () => {
            const roles = [
                { _id: "1", name: "Admin", poids: 1 },
                { _id: "2", name: "Manager", poids: 50 },
            ];

            const sortMock = jest.fn().mockResolvedValue(roles);
            Role.find.mockReturnValue({ sort: sortMock });

            const res = await request(app).get("/api/roles/all");

            expect(Role.find).toHaveBeenCalledWith({
                poids: { $gte: 1, $lte: 100 }
            });
            expect(sortMock).toHaveBeenCalledWith({ poids: 1 });
            expect(res.status).toBe(200);
            expect(res.body).toEqual(roles);
        });

        test("gère les erreurs serveur", async () => {
            Role.find.mockReturnValue({
                sort: jest.fn().mockRejectedValue(new Error("DB Error"))
            });

            const res = await request(app).get("/api/roles/all");

            expect(res.status).toBe(500);
            expect(res.body).toHaveProperty("message");
        });
    });

    describe("POST /api/roles/create", () => {
        test("crée un rôle et lie toutes les permissions", async () => {
            const body = { name: "Directeur", poids: 2 };
            const created = { _id: "2", ...body };
            const permissions = [
                { _id: "p1" },
                { _id: "p2" },
                { _id: "p3" }
            ];

            Role.create.mockResolvedValue(created);
            Permission.find.mockResolvedValue(permissions);
            RolePermission.insertMany.mockResolvedValue([]);

            const res = await request(app).post("/api/roles/create").send(body);

            expect(Role.create).toHaveBeenCalledWith(body);
            expect(Permission.find).toHaveBeenCalledWith({}, { _id: 1 });
            expect(RolePermission.insertMany).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        role_id: created._id,
                        permission_id: expect.any(String),
                        actif: false
                    })
                ])
            );
            expect(res.status).toBe(201);
            expect(res.body).toEqual({
                role: created,
                permissions_linked: permissions.length
            });
        });

        test("gère les erreurs de création", async () => {
            Role.create.mockRejectedValue(new Error("Validation failed"));

            const res = await request(app)
                .post("/api/roles/create")
                .send({ name: "" });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("message");
        });
    });

    describe("PUT /api/roles/update/:id", () => {
        test("met à jour un rôle", async () => {
            const updated = { _id: "1", name: "Admin+", poids: 1 };

            Role.findByIdAndUpdate.mockResolvedValue(updated);

            const res = await request(app)
                .put("/api/roles/update/1")
                .send({ name: "Admin+" });

            expect(Role.findByIdAndUpdate).toHaveBeenCalledWith(
                "1",
                { name: "Admin+" },
                { new: true, runValidators: true }
            );
            expect(res.status).toBe(200);
            expect(res.body).toEqual(updated);
        });

        test("retourne 404 si le rôle n'existe pas", async () => {
            Role.findByIdAndUpdate.mockResolvedValue(null);

            const res = await request(app)
                .put("/api/roles/update/999")
                .send({ name: "Test" });

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty("message", "Rôle introuvable");
        });
    });

    describe("DELETE /api/roles/delete/:id", () => {
        test("supprime un rôle et ses permissions", async () => {
            const role = { _id: "1", name: "ToDelete" };
            Role.findByIdAndDelete.mockResolvedValue(role);
            RolePermission.deleteMany.mockResolvedValue({ deletedCount: 3 });

            const res = await request(app).delete("/api/roles/delete/1");

            expect(Role.findByIdAndDelete).toHaveBeenCalledWith("1");
            expect(RolePermission.deleteMany).toHaveBeenCalledWith({ role_id: role._id });
            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                message: "Rôle supprimé",
                id: role._id,
            });
        });

        test("retourne 404 si le rôle n'existe pas", async () => {
            Role.findByIdAndDelete.mockResolvedValue(null);

            const res = await request(app).delete("/api/roles/delete/999");

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty("message", "Rôle introuvable");
        });
    });

    describe("GET /api/roles/:id/permissions", () => {
        test("retourne les permissions du rôle groupées par catégorie", async () => {
            const links = [
                {
                    permission_id: {
                        _id: "p1",
                        name: "permissions.read",
                        categorie: "Permissions"
                    },
                    actif: true
                },
                {
                    permission_id: {
                        _id: "p2",
                        name: "permissions.create",
                        categorie: "Permissions"
                    },
                    actif: false
                },
                {
                    permission_id: {
                        _id: "p3",
                        name: "users.read",
                        categorie: "Utilisateurs"
                    },
                    actif: true
                },
            ];

            const populateMock = jest.fn().mockResolvedValue(links);
            RolePermission.find.mockReturnValue({ populate: populateMock });

            const res = await request(app).get("/api/roles/1/permissions");

            expect(RolePermission.find).toHaveBeenCalledWith({ role_id: "1" });
            expect(populateMock).toHaveBeenCalledWith("permission_id");
            expect(res.status).toBe(200);

            // Vérifier que la réponse est un tableau de [catégorie, permissions[]]
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);

            // Vérifier que chaque élément est un tableau avec [catégorie, permissions]
            res.body.forEach(item => {
                expect(Array.isArray(item)).toBe(true);
                expect(item.length).toBe(2);
                expect(typeof item[0]).toBe("string"); // catégorie
                expect(Array.isArray(item[1])).toBe(true); // permissions
            });
        });

        test("gère les erreurs serveur", async () => {
            RolePermission.find.mockReturnValue({
                populate: jest.fn().mockRejectedValue(new Error("DB Error"))
            });

            const res = await request(app).get("/api/roles/1/permissions");

            expect(res.status).toBe(500);
            expect(res.body).toHaveProperty("message");
        });
    });

    describe("POST /api/roles/:roleid/permissions/:permid", () => {
        test("active une permission pour un rôle", async () => {
            // Utiliser des ObjectId MongoDB valides
            const roleId = new mongoose.Types.ObjectId().toString();
            const permId = new mongoose.Types.ObjectId().toString();

            const role = { _id: roleId, name: "Admin" };
            const permission = { _id: permId, name: "users.read" };
            const result = {
                role_id: roleId,
                permission_id: permId,
                actif: true
            };

            Role.findById.mockResolvedValue(role);
            Permission.findById.mockResolvedValue(permission);
            RolePermission.findOneAndUpdate.mockResolvedValue(result);
            User.updateMany.mockResolvedValue({ modifiedCount: 2 });

            const res = await request(app)
                .post(`/api/roles/${roleId}/permissions/${permId}`)
                .send({ actif: true });

            expect(Role.findById).toHaveBeenCalledWith(roleId);
            expect(Permission.findById).toHaveBeenCalledWith(permId);
            expect(RolePermission.findOneAndUpdate).toHaveBeenCalledWith(
                { role_id: roleId, permission_id: permId },
                {
                    $set: {
                        role_id: roleId,
                        permission_id: permId,
                        actif: true
                    }
                },
                {
                    upsert: true,
                    new: true
                }
            );
            expect(User.updateMany).toHaveBeenCalledWith(
                { role_id: roleId },
                { $inc: { authzVersion: 1 } }
            );
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("message", "Permission activée pour le rôle");
            expect(res.body).toHaveProperty("data", result);
        });

        test("désactive une permission pour un rôle", async () => {
            const roleId = new mongoose.Types.ObjectId().toString();
            const permId = new mongoose.Types.ObjectId().toString();

            const role = { _id: roleId, name: "Admin" };
            const permission = { _id: permId, name: "users.read" };
            const result = {
                role_id: roleId,
                permission_id: permId,
                actif: false
            };

            Role.findById.mockResolvedValue(role);
            Permission.findById.mockResolvedValue(permission);
            RolePermission.findOneAndUpdate.mockResolvedValue(result);
            User.updateMany.mockResolvedValue({ modifiedCount: 2 });

            const res = await request(app)
                .post(`/api/roles/${roleId}/permissions/${permId}`)
                .send({ actif: false });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("message", "Permission désactivée pour le rôle");
        });

        test("retourne 400 si actif n'est pas un booléen", async () => {
            const roleId = new mongoose.Types.ObjectId().toString();
            const permId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .post(`/api/roles/${roleId}/permissions/${permId}`)
                .send({ actif: "true" });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("message", "Le champ 'actif' doit être un booléen (true/false)");
        });

        test("retourne 404 si le rôle n'existe pas", async () => {
            const roleId = new mongoose.Types.ObjectId().toString();
            const permId = new mongoose.Types.ObjectId().toString();

            Role.findById.mockResolvedValue(null);

            const res = await request(app)
                .post(`/api/roles/${roleId}/permissions/${permId}`)
                .send({ actif: true });

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty("message", "Rôle introuvable");
        });

        test("retourne 404 si la permission n'existe pas", async () => {
            const roleId = new mongoose.Types.ObjectId().toString();
            const permId = new mongoose.Types.ObjectId().toString();

            const role = { _id: roleId, name: "Admin" };
            Role.findById.mockResolvedValue(role);
            Permission.findById.mockResolvedValue(null);

            const res = await request(app)
                .post(`/api/roles/${roleId}/permissions/${permId}`)
                .send({ actif: true });

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty("message", "Permission introuvable");
        });
    });
});