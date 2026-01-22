const request = require("supertest");
const express = require("express");

// Mock des modèles
jest.mock("../../models/Savon.js", () => {
    const Savon = jest.fn(function (data) {
        this.data = data;
        this.save = jest.fn();
        this.deleteOne = jest.fn();
        this.toObject = jest.fn(() => this.data);
    });

    Savon.find = jest.fn();
    Savon.findById = jest.fn();
    Savon.prototype.save = jest.fn();
    Savon.prototype.deleteOne = jest.fn();

    return Savon;
});

jest.mock("../../models/Presence.js", () => ({
    findOne: jest.fn(),
}));

// Mock du middleware auth
jest.mock("../../middleware/auth.js", () => {
    return (req, res, next) => {
        req.user = { id: "test-user" };
        next();
    };
});

const Savon = require("../../models/Savon.js");
const Presence = require("../../models/Presence.js");
const savonRoutes = require("../../routes/savon.routes.js");

describe("Savon routes", () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use("/api/savons", savonRoutes);
        jest.clearAllMocks();
    });

    describe("GET /api/savons", () => {
        test("200 retourne tous les distributeurs de savon", async () => {
            const savons = [
                { _id: "1", name: "Savon A", contenance: 1000 },
                { _id: "2", name: "Savon B", contenance: 500 }
            ];

            Savon.find.mockResolvedValue(savons);

            const res = await request(app).get("/api/savons");

            expect(Savon.find).toHaveBeenCalled();
            expect(res.status).toBe(200);
            expect(res.body).toEqual(savons);
        });

        test("500 si erreur serveur", async () => {
            Savon.find.mockRejectedValue(new Error("DB Error"));

            const res = await request(app).get("/api/savons");

            expect(res.status).toBe(500);
            expect(res.body).toHaveProperty("message", "DB Error");
        });
    });

    describe("POST /api/savons", () => {
        test("201 crée un nouveau distributeur de savon", async () => {
            const presence = { line_1_total_in: 100 };
            Presence.findOne.mockReturnValue({
                sort: jest.fn().mockResolvedValue(presence)
            });

            const body = {
                contenance: 1000,
                seuils: { alert: 200 },
                name: "Distributeur Principal",
                consommationParPassage: 1.5
            };

            const mockSavon = {
                _id: "1",
                ...body,
                seuils: { actuel: 1000, alert: 200 },
                dernierRemplissage: {
                    date: expect.any(Date),
                    compteurPassages: 100
                }
            };

            Savon.mockImplementation(function (data) {
                this.data = data;
                this.save = jest.fn().mockResolvedValue(mockSavon);
                return this;
            });

            const res = await request(app)
                .post("/api/savons")
                .send(body);

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty("_id", "1");
            expect(res.body).toHaveProperty("name", "Distributeur Principal");
        });

        test("201 utilise 0 comme compteur si pas de présence", async () => {
            Presence.findOne.mockReturnValue({
                sort: jest.fn().mockResolvedValue(null)
            });

            const body = {
                contenance: 1000,
                seuils: { alert: 200 },
                name: "Test"
            };

            const mockSavon = { _id: "1", ...body };
            Savon.mockImplementation(function () {
                this.save = jest.fn().mockResolvedValue(mockSavon);
                return this;
            });

            const res = await request(app)
                .post("/api/savons")
                .send(body);

            expect(res.status).toBe(201);
        });

        test("400 si erreur de validation", async () => {
            Presence.findOne.mockReturnValue({
                sort: jest.fn().mockResolvedValue(null)
            });

            Savon.mockImplementation(function () {
                this.save = jest.fn().mockRejectedValue(new Error("Validation failed"));
                return this;
            });

            const res = await request(app)
                .post("/api/savons")
                .send({});

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("message");
        });
    });

    describe("PUT /api/savons/:id", () => {
        test("200 met à jour un distributeur", async () => {
            const existingSavon = {
                _id: "1",
                contenance: 1000,
                seuils: { alert: 200 },
                name: "Old Name",
                consommationParPassage: 1.5,
                save: jest.fn()
            };

            const updated = {
                ...existingSavon,
                name: "New Name",
                contenance: 1200
            };

            Savon.findById.mockResolvedValue(existingSavon);
            existingSavon.save.mockResolvedValue(updated);

            const res = await request(app)
                .put("/api/savons/1")
                .send({ name: "New Name", contenance: 1200 });

            expect(Savon.findById).toHaveBeenCalledWith("1");
            expect(res.status).toBe(200);
            expect(res.body.name).toBe("New Name");
        });

        test("404 si distributeur introuvable", async () => {
            Savon.findById.mockResolvedValue(null);

            const res = await request(app)
                .put("/api/savons/999")
                .send({ name: "Test" });

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty("message", "Distributeur non trouvé");
        });

        test("400 si erreur de validation", async () => {
            const existingSavon = {
                save: jest.fn().mockRejectedValue(new Error("Validation error"))
            };

            Savon.findById.mockResolvedValue(existingSavon);

            const res = await request(app)
                .put("/api/savons/1")
                .send({ contenance: -100 });

            expect(res.status).toBe(400);
        });
    });

    describe("POST /api/savons/:id/remplissage", () => {
        test("200 effectue un remplissage", async () => {
            const presence = { line_1_total_in: 500 };
            Presence.findOne.mockReturnValue({
                sort: jest.fn().mockResolvedValue(presence)
            });

            const savon = {
                _id: "1",
                contenance: 1000,
                seuils: { actuel: 200, alert: 200 },
                dernierRemplissage: { date: new Date(), compteurPassages: 0 },
                save: jest.fn()
            };

            const updated = {
                ...savon,
                seuils: { actuel: 1000, alert: 200 },
                dernierRemplissage: { date: expect.any(Date), compteurPassages: 500 }
            };

            Savon.findById.mockResolvedValue(savon);
            savon.save.mockResolvedValue(updated);

            const res = await request(app)
                .post("/api/savons/1/remplissage");

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("message", "Remplissage effectué avec succès");
            expect(res.body.savon.seuils.actuel).toBe(1000);
        });

        test("404 si distributeur introuvable", async () => {
            Savon.findById.mockResolvedValue(null);

            const res = await request(app)
                .post("/api/savons/999/remplissage");

            expect(res.status).toBe(404);
        });
    });

    describe("DELETE /api/savons/:id", () => {
        test("200 supprime un distributeur", async () => {
            const savon = {
                _id: "1",
                deleteOne: jest.fn().mockResolvedValue({})
            };

            Savon.findById.mockResolvedValue(savon);

            const res = await request(app).delete("/api/savons/1");

            expect(savon.deleteOne).toHaveBeenCalled();
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("message", "Distributeur supprimé avec succès");
        });

        test("404 si distributeur introuvable", async () => {
            Savon.findById.mockResolvedValue(null);

            const res = await request(app).delete("/api/savons/999");

            expect(res.status).toBe(404);
        });

        test("500 si erreur serveur", async () => {
            Savon.findById.mockRejectedValue(new Error("DB Error"));

            const res = await request(app).delete("/api/savons/1");

            expect(res.status).toBe(500);
        });
    });

    describe("GET /api/savons/:id/check-alert", () => {
        test("200 retourne l'état d'alerte", async () => {
            const presence = { line_1_total_in: 1000 };
            Presence.findOne.mockReturnValue({
                sort: jest.fn().mockResolvedValue(presence)
            });

            const savon = {
                _id: "1",
                contenance: 1000,
                seuils: { alert: 200 },
                dernierRemplissage: { compteurPassages: 800 },
                consommationParPassage: 2
            };

            Savon.findById.mockResolvedValue(savon);

            const res = await request(app).get("/api/savons/1/check-alert");

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("alerteNecessaire");
            expect(res.body).toHaveProperty("contenanceEstimee");
            expect(res.body).toHaveProperty("passages");
        });

        test("200 alerte si contenance estimée <= seuil", async () => {
            const presence = { line_1_total_in: 900 };
            Presence.findOne.mockReturnValue({
                sort: jest.fn().mockResolvedValue(presence)
            });

            const savon = {
                contenance: 1000,
                seuils: { alert: 200 },
                dernierRemplissage: { compteurPassages: 0 },
                consommationParPassage: 1
            };

            Savon.findById.mockResolvedValue(savon);

            const res = await request(app).get("/api/savons/1/check-alert");

            expect(res.status).toBe(200);
            expect(res.body.alerteNecessaire).toBe(true);
            expect(res.body.contenanceEstimee).toBe(100);
        });

        test("404 si distributeur introuvable", async () => {
            Savon.findById.mockResolvedValue(null);

            const res = await request(app).get("/api/savons/999/check-alert");

            expect(res.status).toBe(404);
        });
    });
});