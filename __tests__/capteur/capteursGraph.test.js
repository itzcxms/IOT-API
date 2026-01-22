const request = require("supertest");
const express = require("express");

// Mock des modèles
jest.mock("../../models/Sondes.js", () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    aggregate: jest.fn(),
}));

jest.mock("../../models/Toilette.js", () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    aggregate: jest.fn(),
}));

// Mock du middleware auth
jest.mock("../../middleware/auth.js", () => {
    return (req, res, next) => {
        req.user = { id: "test-user" };
        next();
    };
});

const Sonde = require("../../models/Sondes.js");
const Toilette = require("../../models/Toilette.js");
const capteursGraphRoutes = require("../../routes/capteursGraph.routes.js");

describe("Capteurs Graph routes", () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use("/api/graphs/capteurs", capteursGraphRoutes);
        jest.clearAllMocks();
    });

    describe("POST /api/graphs/capteurs/lastinfo", () => {
        test("200 retourne la dernière info d'une sonde", async () => {
            const lastRecord = {
                haut: "100",
                createdAt: new Date("2025-01-22T14:30:00Z")
            };

            Sonde.findOne.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(lastRecord)
            });

            Sonde.aggregate.mockResolvedValue([{ haut: "100" }]);

            const res = await request(app)
                .post("/api/graphs/capteurs/lastinfo")
                .send({ type: "sonde", filters: { haut: "100" } });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("date");
            expect(res.body).toHaveProperty("haut");
        });

        test("200 retourne la fréquentation pour toilette", async () => {
            const lastRecord = {
                occupancy: "1",
                createdAt: new Date("2025-01-22T14:30:00Z")
            };

            Toilette.findOne.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(lastRecord)
            });

            Toilette.aggregate.mockResolvedValue([{ frequentation: 5 }]);

            const res = await request(app)
                .post("/api/graphs/capteurs/lastinfo")
                .send({ type: "toilette" });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("date");
            expect(res.body).toHaveProperty("frequentation");
        });

        test("404 si aucune donnée trouvée", async () => {
            Sonde.findOne.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(null)
            });

            const res = await request(app)
                .post("/api/graphs/capteurs/lastinfo")
                .send({ type: "sonde" });

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty("message", "Aucune donnée trouvée");
        });

        test("500 si erreur serveur", async () => {
            Sonde.findOne.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                lean: jest.fn().mockRejectedValue(new Error("DB Error"))
            });

            const res = await request(app)
                .post("/api/graphs/capteurs/lastinfo")
                .send({ type: "sonde" });

            expect(res.status).toBe(500);
        });
    });

    describe("POST /api/graphs/capteurs/today", () => {
        test("200 retourne les données par heure", async () => {
            const aggregateData = [
                { _id: 10, haut: "100" },
                { _id: 14, haut: "95" }
            ];

            Sonde.aggregate.mockResolvedValue(aggregateData);

            const res = await request(app)
                .post("/api/graphs/capteurs/today")
                .send({ type: "sonde", date: "2025-01-22" });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("date");
            expect(res.body).toHaveProperty("donnees");
            expect(res.body.donnees).toHaveLength(24);
            expect(res.body.donnees[0]).toHaveProperty("heure");
            expect(res.body.donnees[0]).toHaveProperty("haut");
        });

        test("200 génère toutes les heures même sans données", async () => {
            Sonde.aggregate.mockResolvedValue([]);

            const res = await request(app)
                .post("/api/graphs/capteurs/today")
                .send({ type: "sonde", date: "2025-01-22" });

            expect(res.status).toBe(200);
            expect(res.body.donnees).toHaveLength(24);
            expect(res.body.donnees[0].haut).toBe("0");
        });

        test("200 utilise la date d'aujourd'hui par défaut", async () => {
            Sonde.aggregate.mockResolvedValue([]);

            const res = await request(app)
                .post("/api/graphs/capteurs/today")
                .send({ type: "sonde" });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("date");
        });
    });

    describe("POST /api/graphs/capteurs/week", () => {
        test("200 retourne les données pour 7 jours", async () => {
            const aggregateData = [
                { _id: { year: 2025, month: 1, day: 22 }, haut: "100" }
            ];

            Sonde.aggregate.mockResolvedValue(aggregateData);

            const res = await request(app)
                .post("/api/graphs/capteurs/week")
                .send({ type: "sonde", date: "2025-01-22" });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("periodeDebut");
            expect(res.body).toHaveProperty("periodeFin");
            expect(res.body).toHaveProperty("donnees");
            expect(res.body.donnees).toHaveLength(7);
        });

        test("200 remplit les jours manquants avec 0", async () => {
            Sonde.aggregate.mockResolvedValue([]);

            const res = await request(app)
                .post("/api/graphs/capteurs/week")
                .send({ type: "sonde", date: "2025-01-22" });

            expect(res.status).toBe(200);
            expect(res.body.donnees.every(d => d.haut === "0")).toBe(true);
        });
    });

    describe("GET /api/graphs/capteurs/month/all", () => {
        test("200 retourne tous les mois disponibles", async () => {
            const aggregateData = [
                { _id: { year: 2025, month: 1 } },
                { _id: { year: 2025, month: 2 } },
                { _id: { year: 2024, month: 12 } }
            ];

            Sonde.aggregate.mockResolvedValue(aggregateData);

            const res = await request(app)
                .get("/api/graphs/capteurs/month/all")
                .query({ type: "sonde" });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("2025");
            expect(res.body["2025"]).toContain("01");
            expect(res.body["2025"]).toContain("02");
        });
    });

    describe("POST /api/graphs/capteurs/month", () => {
        test("200 retourne les données entre deux mois", async () => {
            const aggregateData = [
                { date: "2025-01-15", frequentation: 10 },
                { date: "2025-02-20", frequentation: 15 }
            ];

            Toilette.aggregate.mockResolvedValue(aggregateData);

            const res = await request(app)
                .post("/api/graphs/capteurs/month")
                .send({
                    type: "toilette",
                    annee: 2025,
                    start: "01",
                    end: "02"
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("params");
            expect(res.body).toHaveProperty("donnees");
            expect(Array.isArray(res.body.donnees)).toBe(true);
        });

        test("400 si année manquante", async () => {
            const res = await request(app)
                .post("/api/graphs/capteurs/month")
                .send({ type: "sonde", start: "01", end: "02" });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("message");
        });

        test("400 si mois de début invalide", async () => {
            const res = await request(app)
                .post("/api/graphs/capteurs/month")
                .send({ type: "sonde", annee: 2025, start: "13", end: "02" });

            expect(res.status).toBe(400);
        });

        test("400 si début > fin", async () => {
            const res = await request(app)
                .post("/api/graphs/capteurs/month")
                .send({ type: "sonde", annee: 2025, start: "05", end: "02" });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain("doit être <=");
        });
    });

    describe("GET /api/graphs/capteurs/year/all", () => {
        test("200 retourne toutes les années disponibles", async () => {
            const aggregateData = [
                { _id: 2024 },
                { _id: 2025 }
            ];

            Sonde.aggregate.mockResolvedValue(aggregateData);

            const res = await request(app)
                .get("/api/graphs/capteurs/year/all")
                .query({ type: "sonde" });

            expect(res.status).toBe(200);
            expect(res.body).toContain("2024");
            expect(res.body).toContain("2025");
        });
    });

    describe("POST /api/graphs/capteurs/year", () => {
        test("200 retourne les données par mois", async () => {
            const aggregateData = [
                { _id: 1, frequentation: 100 },
                { _id: 2, frequentation: 150 }
            ];

            Sonde.aggregate.mockResolvedValue(aggregateData);

            const res = await request(app)
                .post("/api/graphs/capteurs/year")
                .send({ type: "sonde", annee: 2025 });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("annee", 2025);
            expect(res.body).toHaveProperty("donnees");
            expect(res.body.donnees[0]).toHaveProperty("mois");
            expect(res.body.donnees[0]).toHaveProperty("frequentation");
        });

        test("400 si année invalide", async () => {
            const res = await request(app)
                .post("/api/graphs/capteurs/year")
                .send({ type: "sonde", annee: "invalid" });

            expect(res.status).toBe(400);
        });
    });
});