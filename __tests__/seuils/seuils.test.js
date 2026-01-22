const request = require("supertest");
const express = require("express");

// Mock du model Seuils
jest.mock("../../models/Seuils.js", () => {
    const Seuil = jest.fn(function (data) {
        this.data = data;
        this.save = jest.fn();
    });

    Seuil.distinct = jest.fn();
    Seuil.find = jest.fn();
    Seuil.findById = jest.fn();
    Seuil.findByIdAndUpdate = jest.fn();
    Seuil.findByIdAndDelete = jest.fn();

    return Seuil;
});

// Auth mock
jest.mock("../../middleware/auth", () => {
    return jest.fn((req, res, next) => {
        const role = req.get("x-role") || "user";
        req.user = { id: "test-user", role };
        next();
    });
});

// Permission mock
jest.mock("../../middleware/requirePermission.js", () => {
    return jest.fn((requiredRole) => (req, res, next) => {
        if (requiredRole && req.user?.role !== requiredRole) {
            return res.status(403).json({ message: "Accès refusé" });
        }
        return next();
    });
});

const Seuil = require("../../models/Seuils.js");
const auth = require("../../middleware/auth");
const seuilRoutes = require("../../routes/seuil.routes.js");

describe("Seuils routes", () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use("/api/seuils", seuilRoutes);
        jest.clearAllMocks();
    });

    describe("Middlewares (wiring)", () => {
        test("auth est bien exécuté sur une route simple", async () => {
            Seuil.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

            await request(app).get("/api/seuils");

            expect(auth).toHaveBeenCalled();
        });

        test("POST et DELETE sont bien protégés (403 si pas superadmin)", async () => {
            // POST refusé
            Seuil.mockImplementation(function () {
                this.save = jest.fn().mockResolvedValue({ _id: "id1" });
            });

            const postRes = await request(app)
                .post("/api/seuils")
                .set("x-role", "user")
                .send({ nom: "X", type: "savon", unite: "ml", seuil: 1, capteur_id: "SAV-1" });

            expect(postRes.status).toBe(403);
            expect(postRes.body).toHaveProperty("message", "Accès refusé");

            // DELETE refusé
            Seuil.findByIdAndDelete.mockResolvedValue({ _id: "id1" });

            const delRes = await request(app)
                .delete("/api/seuils/id1")
                .set("x-role", "user");

            expect(delRes.status).toBe(403);
            expect(delRes.body).toHaveProperty("message", "Accès refusé");
        });

        test("POST et DELETE passent si superadmin", async () => {
            // POST autorisé
            Seuil.mockImplementation(function (data) {
                this.data = data;
                this.save = jest.fn().mockResolvedValue({ _id: "id1", ...data });
            });

            const postRes = await request(app)
                .post("/api/seuils")
                .set("x-role", "superadmin")
                .send({ nom: "X", type: "savon", unite: "ml", seuil: 1, capteur_id: "SAV-1" });

            expect(postRes.status).toBe(201);

            // DELETE autorisé
            Seuil.findByIdAndDelete.mockResolvedValue({ _id: "id1" });

            const delRes = await request(app)
                .delete("/api/seuils/id1")
                .set("x-role", "superadmin");

            expect(delRes.status).toBe(200);
        });
    });

    describe("GET /api/seuils/capteurs", () => {
        test("200 retourne les capteur_id distincts", async () => {
            Seuil.distinct.mockResolvedValue(["SAV-001", "EAU-001"]);

            const res = await request(app).get("/api/seuils/capteurs");

            expect(Seuil.distinct).toHaveBeenCalledWith("capteur_id");
            expect(res.status).toBe(200);
            expect(res.body).toEqual(["SAV-001", "EAU-001"]);
        });

        test("500 si erreur serveur", async () => {
            Seuil.distinct.mockRejectedValue(new Error("DB Error"));

            const res = await request(app).get("/api/seuils/capteurs");

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ message: "DB Error" });
        });
    });

    describe("GET /api/seuils", () => {
        test("200 retourne tous les seuils triés (createdAt desc)", async () => {
            const seuils = [{ nom: "A" }, { nom: "B" }];
            const sortMock = jest.fn().mockResolvedValue(seuils);

            Seuil.find.mockReturnValue({ sort: sortMock });

            const res = await request(app).get("/api/seuils");

            expect(Seuil.find).toHaveBeenCalledWith();
            expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
            expect(res.status).toBe(200);
            expect(res.body).toEqual(seuils);
        });

        test("500 si erreur serveur", async () => {
            Seuil.find.mockReturnValue({
                sort: jest.fn().mockRejectedValue(new Error("DB Error")),
            });

            const res = await request(app).get("/api/seuils");

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ message: "DB Error" });
        });
    });

    describe("GET /api/seuils/savon", () => {
        test('200 retourne les seuils de type "savon"', async () => {
            const seuils = [{ type: "savon" }];
            const sortMock = jest.fn().mockResolvedValue(seuils);

            Seuil.find.mockReturnValue({ sort: sortMock });

            const res = await request(app).get("/api/seuils/savon");

            expect(Seuil.find).toHaveBeenCalledWith({ type: "savon" });
            expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
            expect(res.status).toBe(200);
            expect(res.body).toEqual(seuils);
        });

        test("500 si erreur serveur", async () => {
            Seuil.find.mockReturnValue({
                sort: jest.fn().mockRejectedValue(new Error("DB Error")),
            });

            const res = await request(app).get("/api/seuils/savon");

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ message: "DB Error" });
        });
    });

    describe("GET /api/seuils/eau", () => {
        test('200 retourne les seuils de type "eau"', async () => {
            const seuils = [{ type: "eau" }];
            const sortMock = jest.fn().mockResolvedValue(seuils);

            Seuil.find.mockReturnValue({ sort: sortMock });

            const res = await request(app).get("/api/seuils/eau");

            expect(Seuil.find).toHaveBeenCalledWith({ type: "eau" });
            expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
            expect(res.status).toBe(200);
            expect(res.body).toEqual(seuils);
        });

        test("500 si erreur serveur", async () => {
            Seuil.find.mockReturnValue({
                sort: jest.fn().mockRejectedValue(new Error("DB Error")),
            });

            const res = await request(app).get("/api/seuils/eau");

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ message: "DB Error" });
        });
    });

    describe("GET /api/seuils/capteur/:capteur_id", () => {
        test("200 filtre par capteur_id (regex, case-insensitive)", async () => {
            const seuils = [{ capteur_id: "SAV-001" }];
            const sortMock = jest.fn().mockResolvedValue(seuils);

            Seuil.find.mockReturnValue({ sort: sortMock });

            const res = await request(app).get("/api/seuils/capteur/SAV");

            expect(Seuil.find).toHaveBeenCalledWith({
                capteur_id: { $regex: "SAV", $options: "i" },
            });
            expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
            expect(res.status).toBe(200);
            expect(res.body).toEqual(seuils);
        });

        test("500 si erreur serveur", async () => {
            Seuil.find.mockReturnValue({
                sort: jest.fn().mockRejectedValue(new Error("DB Error")),
            });

            const res = await request(app).get("/api/seuils/capteur/SAV");

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ message: "DB Error" });
        });
    });

    describe("GET /api/seuils/capteur/:capteur_id/:type", () => {
        test("200 filtre par capteur_id (regex) et type", async () => {
            const seuils = [{ capteur_id: "SAV-001", type: "savon" }];
            const sortMock = jest.fn().mockResolvedValue(seuils);

            Seuil.find.mockReturnValue({ sort: sortMock });

            const res = await request(app).get("/api/seuils/capteur/SAV/savon");

            expect(Seuil.find).toHaveBeenCalledWith({
                capteur_id: { $regex: "SAV", $options: "i" },
                type: "savon",
            });
            expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
            expect(res.status).toBe(200);
            expect(res.body).toEqual(seuils);
        });

        test("500 si erreur serveur", async () => {
            Seuil.find.mockReturnValue({
                sort: jest.fn().mockRejectedValue(new Error("DB Error")),
            });

            const res = await request(app).get("/api/seuils/capteur/SAV/savon");

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ message: "DB Error" });
        });
    });

    describe("GET /api/seuils/:id", () => {
        test("200 retourne un seuil par ID", async () => {
            const seuil = { _id: "id1", nom: "Seuil A" };
            Seuil.findById.mockResolvedValue(seuil);

            const res = await request(app).get("/api/seuils/id1");

            expect(Seuil.findById).toHaveBeenCalledWith("id1");
            expect(res.status).toBe(200);
            expect(res.body).toEqual(seuil);
        });

        test("404 si seuil non trouvé", async () => {
            Seuil.findById.mockResolvedValue(null);

            const res = await request(app).get("/api/seuils/id404");

            expect(res.status).toBe(404);
            expect(res.body).toEqual({ message: "Seuil non trouvé" });
        });

        test("500 si erreur serveur", async () => {
            Seuil.findById.mockRejectedValue(new Error("DB Error"));

            const res = await request(app).get("/api/seuils/id1");

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ message: "DB Error" });
        });
    });

    describe("POST /api/seuils", () => {
        test("201 crée un seuil (new Seuil(req.body).save())", async () => {
            const body = {
                nom: "Seuil Savon",
                type: "savon",
                unite: "ml",
                seuil: 10,
                capteur_id: "SAV-001",
            };

            Seuil.mockImplementation(function (data) {
                this.data = data;
                this.save = jest.fn().mockResolvedValue({ _id: "id1", ...data });
            });

            const res = await request(app)
                .post("/api/seuils")
                .set("x-role", "superadmin")
                .send(body);

            expect(Seuil).toHaveBeenCalledWith(body);
            expect(res.status).toBe(201);
            expect(res.body).toEqual({ _id: "id1", ...body });
        });

        test("400 si erreur de validation/DB", async () => {
            Seuil.mockImplementation(function () {
                this.save = jest.fn().mockRejectedValue(new Error("Validation failed"));
            });

            const res = await request(app)
                .post("/api/seuils")
                .set("x-role", "superadmin")
                .send({});

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ message: "Validation failed" });
        });
    });

    describe("PUT /api/seuils/:id", () => {
        test("200 met à jour un seuil (runValidators: true)", async () => {
            const updated = { _id: "id1", nom: "Maj" };
            Seuil.findByIdAndUpdate.mockResolvedValue(updated);

            const res = await request(app).put("/api/seuils/id1").send({ nom: "Maj" });

            expect(Seuil.findByIdAndUpdate).toHaveBeenCalledWith(
                "id1",
                { nom: "Maj" },
                { new: true, runValidators: true }
            );
            expect(res.status).toBe(200);
            expect(res.body).toEqual(updated);
        });

        test("404 si seuil non trouvé", async () => {
            Seuil.findByIdAndUpdate.mockResolvedValue(null);

            const res = await request(app).put("/api/seuils/id404").send({ nom: "X" });

            expect(res.status).toBe(404);
            expect(res.body).toEqual({ message: "Seuil non trouvé" });
        });

        test("400 si erreur validation/DB", async () => {
            Seuil.findByIdAndUpdate.mockRejectedValue(new Error("Validation failed"));

            const res = await request(app).put("/api/seuils/id1").send({ seuil: "bad" });

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ message: "Validation failed" });
        });
    });

    describe("DELETE /api/seuils/:id", () => {
        test("200 supprime un seuil", async () => {
            Seuil.findByIdAndDelete.mockResolvedValue({ _id: "id1" });

            const res = await request(app)
                .delete("/api/seuils/id1")
                .set("x-role", "superadmin");

            expect(Seuil.findByIdAndDelete).toHaveBeenCalledWith("id1");
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ message: "Seuil supprimé avec succès" });
        });

        test("404 si seuil non trouvé", async () => {
            Seuil.findByIdAndDelete.mockResolvedValue(null);

            const res = await request(app)
                .delete("/api/seuils/id404")
                .set("x-role", "superadmin");

            expect(res.status).toBe(404);
            expect(res.body).toEqual({ message: "Seuil non trouvé" });
        });

        test("500 si erreur serveur", async () => {
            Seuil.findByIdAndDelete.mockRejectedValue(new Error("DB Error"));

            const res = await request(app)
                .delete("/api/seuils/id1")
                .set("x-role", "superadmin");

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ message: "DB Error" });
        });
    });
});