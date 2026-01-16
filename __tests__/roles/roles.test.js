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
    updateMany: jest.fn(),
    insertMany: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));

jest.mock("../../models/Permission.js", () => ({
    find: jest.fn(),
    findById: jest.fn(),
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

    describe("POST /api/roles/:id/permissions", () => {
        test("assigne des permissions au rôle (met à jour)", async () => {
            const role = { _id: "1", name: "Admin" };
            const permission_ids = ["p1", "p2"];
            const perms = permission_ids.map(id => ({ _id: id }));

            Role.findById.mockResolvedValue(role);
            Permission.find.mockResolvedValue(perms);
            RolePermission.updateMany.mockResolvedValue({});
            RolePermission.bulkWrite.mockResolvedValue({});

            const res = await request(app)
                .post("/api/roles/1/permissions")
                .send({ permission_ids });

            expect(Role.findById).toHaveBeenCalledWith("1");
            expect(Permission.find).toHaveBeenCalledWith({
                _id: { $in: permission_ids },
            });
            expect(RolePermission.updateMany).toHaveBeenCalledWith(
                { role_id: role._id },
                { $set: { actif: false } }
            );
            expect(RolePermission.bulkWrite).toHaveBeenCalled();
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("message", "Permissions mises à jour pour le rôle");
        });

        test("désactive toutes les permissions si aucune fournie", async () => {
            const role = { _id: "1", name: "Admin" };

            Role.findById.mockResolvedValue(role);
            Permission.find.mockResolvedValue([]);
            RolePermission.updateMany.mockResolvedValue({});

            const res = await request(app)
                .post("/api/roles/1/permissions")
                .send({ permission_ids: [] });

            expect(RolePermission.updateMany).toHaveBeenCalled();
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("message", "Toutes les permissions ont été désactivées pour ce rôle");
        });

        test("retourne 404 si le rôle n'existe pas", async () => {
            Role.findById.mockResolvedValue(null);

            const res = await request(app)
                .post("/api/roles/999/permissions")
                .send({ permission_ids: ["p1"] });

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty("message", "Rôle introuvable");
        });

        test("retourne 400 si les permissions sont invalides", async () => {
            const role = { _id: "1", name: "Admin" };
            Role.findById.mockResolvedValue(role);
            Permission.find.mockResolvedValue([{ _id: "p1" }]); // Seulement 1 sur 2

            const res = await request(app)
                .post("/api/roles/1/permissions")
                .send({ permission_ids: ["p1", "p2"] });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("message", "Une ou plusieurs permissions invalides");
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
            const role = { _id: "role1", name: "Admin" };
            const permission = { _id: "perm1", name: "users.read" };
            const result = {
                role_id: "role1",
                permission_id: "perm1",
                actif: true
            };

            Role.findById.mockResolvedValue(role);
            Permission.findById.mockResolvedValue(permission);
            RolePermission.findOneAndUpdate.mockResolvedValue(result);

            const res = await request(app)
                .post("/api/roles/role1/permissions/perm1")
                .send({ actif: true });

            expect(Role.findById).toHaveBeenCalledWith("role1");
            expect(Permission.findById).toHaveBeenCalledWith("perm1");
            expect(RolePermission.findOneAndUpdate).toHaveBeenCalledWith(
                { role_id: "role1", permission_id: "perm1" },
                {
                    $set: {
                        role_id: "role1",
                        permission_id: "perm1",
                        actif: true
                    }
                },
                {
                    upsert: true,
                    new: true
                }
            );
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("message", "Permission activée pour le rôle");
            expect(res.body).toHaveProperty("data", result);
        });

        test("désactive une permission pour un rôle", async () => {
            const role = { _id: "role1", name: "Admin" };
            const permission = { _id: "perm1", name: "users.read" };
            const result = {
                role_id: "role1",
                permission_id: "perm1",
                actif: false
            };

            Role.findById.mockResolvedValue(role);
            Permission.findById.mockResolvedValue(permission);
            RolePermission.findOneAndUpdate.mockResolvedValue(result);

            const res = await request(app)
                .post("/api/roles/role1/permissions/perm1")
                .send({ actif: false });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("message", "Permission désactivée pour le rôle");
        });

        test("retourne 400 si actif n'est pas un booléen", async () => {
            const res = await request(app)
                .post("/api/roles/role1/permissions/perm1")
                .send({ actif: "true" });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("message", "Le champ 'actif' doit être un booléen (true/false)");
        });

        test("retourne 404 si le rôle n'existe pas", async () => {
            Role.findById.mockResolvedValue(null);

            const res = await request(app)
                .post("/api/roles/role999/permissions/perm1")
                .send({ actif: true });

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty("message", "Rôle introuvable");
        });

        test("retourne 404 si la permission n'existe pas", async () => {
            const role = { _id: "role1", name: "Admin" };
            Role.findById.mockResolvedValue(role);
            Permission.findById.mockResolvedValue(null);

            const res = await request(app)
                .post("/api/roles/role1/permissions/perm999")
                .send({ actif: true });

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty("message", "Permission introuvable");
        });
    });
});