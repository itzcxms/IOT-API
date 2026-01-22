const request = require("supertest");
const express = require("express");

// Mock du modèle Questionnaire
jest.mock("../../models/Questionnaire.js", () => ({
    find: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn(),
}));

// Mock du middleware auth
jest.mock("../../middleware/auth.js", () => {
    return (req, res, next) => {
        req.user = { id: "test-user" };
        next();
    };
});

const Questionnaire = require("../../models/Questionnaire.js");
const questionnaireRoutes = require("../../routes/questionnaire.routes.js");

describe("Questionnaire routes", () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use("/api/questionnaires", questionnaireRoutes);
        jest.clearAllMocks();
    });

    describe("POST /api/questionnaires", () => {
        test("201 crée une enquête avec tous les champs requis", async () => {
            const body = {
                satisfactionAire: "bon",
                satisfactionSecurite: "excellent",
                satisfactionServices: "passable",
                sourcesConnaissance: ["panneau", "internet"],
                autreSource: "Bouche à oreille",
                remarques: "Très bien dans l'ensemble"
            };

            const created = { _id: "1", ...body, createdAt: new Date() };
            Questionnaire.create.mockResolvedValue(created);

            const res = await request(app)
                .post("/api/questionnaires")
                .send(body);

            expect(Questionnaire.create).toHaveBeenCalledWith(body);
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty("message", "Enquête enregistrée avec succès");
            expect(res.body).toHaveProperty("data");
        });

        test("201 crée une enquête avec champs optionnels vides", async () => {
            const body = {
                satisfactionAire: "bon",
                satisfactionSecurite: "bon",
                satisfactionServices: "bon",
                sourcesConnaissance: [],
            };

            const created = {
                _id: "1",
                ...body,
                autreSource: "",
                remarques: "",
                createdAt: new Date()
            };
            Questionnaire.create.mockResolvedValue(created);

            const res = await request(app)
                .post("/api/questionnaires")
                .send(body);

            expect(res.status).toBe(201);
        });

        test("400 si champs requis manquants", async () => {
            const res = await request(app)
                .post("/api/questionnaires")
                .send({
                    satisfactionAire: "bon",
                    satisfactionSecurite: "bon",
                    // satisfactionServices manquant
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("message");
        });

        test("400 si erreur de validation Mongoose", async () => {
            const body = {
                satisfactionAire: "bon",
                satisfactionSecurite: "bon",
                satisfactionServices: "bon",
            };

            const validationError = new Error("Validation failed");
            validationError.name = "ValidationError";
            validationError.errors = { satisfactionAire: "Invalid value" };

            Questionnaire.create.mockRejectedValue(validationError);

            const res = await request(app)
                .post("/api/questionnaires")
                .send(body);

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("message", "Validation échouée");
            expect(res.body).toHaveProperty("details");
        });

        test("500 si erreur serveur", async () => {
            const body = {
                satisfactionAire: "bon",
                satisfactionSecurite: "bon",
                satisfactionServices: "bon",
            };

            Questionnaire.create.mockRejectedValue(new Error("DB Error"));

            const res = await request(app)
                .post("/api/questionnaires")
                .send(body);

            expect(res.status).toBe(500);
            expect(res.body).toHaveProperty("message", "Erreur serveur");
        });
    });

    describe("GET /api/questionnaires/stats/all", () => {
        test("200 retourne les statistiques globales", async () => {
            const aggregateResult = [{
                total: 10,
                satisfactionAire: ["bon", "excellent", "bon"],
                satisfactionSecurite: ["excellent", "bon"],
                satisfactionServices: ["passable", "bon"],
                sourcesConnaissance: [["panneau", "internet"], ["panneau"]]
            }];

            Questionnaire.aggregate.mockResolvedValue(aggregateResult);

            const res = await request(app).get("/api/questionnaires/stats/all");

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("total", 10);
            expect(res.body).toHaveProperty("distributions");
            expect(res.body).toHaveProperty("sourcesConnaissance");
            expect(res.body.distributions).toHaveProperty("satisfactionAire");
        });

        test("200 gère le cas sans données", async () => {
            Questionnaire.aggregate.mockResolvedValue([]);

            const res = await request(app).get("/api/questionnaires/stats/all");

            expect(res.status).toBe(200);
            expect(res.body.total).toBe(0);
        });

        test("500 si erreur serveur", async () => {
            Questionnaire.aggregate.mockRejectedValue(new Error("DB Error"));

            const res = await request(app).get("/api/questionnaires/stats/all");

            expect(res.status).toBe(500);
            expect(res.body).toHaveProperty("message", "Erreur serveur");
        });
    });

    describe("POST /api/questionnaires/stats/day", () => {
        test("200 retourne les stats pour un jour spécifique", async () => {
            const aggregateResult = [{
                total: 5,
                satisfactionAire: ["bon", "excellent"],
                satisfactionSecurite: ["bon"],
                satisfactionServices: ["passable"],
                sourcesConnaissance: [["panneau"]]
            }];

            Questionnaire.aggregate.mockResolvedValue(aggregateResult);

            const res = await request(app)
                .post("/api/questionnaires/stats/day")
                .send({ date: "2025-01-22" });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("total", 5);
            expect(res.body.filters).toHaveProperty("view", "day");
        });

        test("400 si date invalide", async () => {
            const res = await request(app)
                .post("/api/questionnaires/stats/day")
                .send({ date: "invalid-date" });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("message");
        });
    });

    describe("POST /api/questionnaires/stats/week", () => {
        test("200 retourne les stats pour une semaine", async () => {
            const aggregateResult = [{
                total: 15,
                satisfactionAire: ["bon"],
                satisfactionSecurite: ["bon"],
                satisfactionServices: ["bon"],
                sourcesConnaissance: []
            }];

            Questionnaire.aggregate.mockResolvedValue(aggregateResult);

            const res = await request(app)
                .post("/api/questionnaires/stats/week")
                .send({ date: "2025-01-22" });

            expect(res.status).toBe(200);
            expect(res.body.filters).toHaveProperty("view", "week");
        });

        test("400 si date manquante", async () => {
            const res = await request(app)
                .post("/api/questionnaires/stats/week")
                .send({});

            expect(res.status).toBe(400);
        });
    });

    describe("POST /api/questionnaires/stats/month", () => {
        test("200 retourne les stats pour un mois", async () => {
            const aggregateResult = [{
                total: 50,
                satisfactionAire: [],
                satisfactionSecurite: [],
                satisfactionServices: [],
                sourcesConnaissance: []
            }];

            Questionnaire.aggregate.mockResolvedValue(aggregateResult);

            const res = await request(app)
                .post("/api/questionnaires/stats/month")
                .send({ date: "2025-01-01" });

            expect(res.status).toBe(200);
            expect(res.body.filters).toHaveProperty("view", "month");
        });
    });

    describe("POST /api/questionnaires/stats/year", () => {
        test("200 retourne les stats pour une année", async () => {
            const aggregateResult = [{
                total: 365,
                satisfactionAire: [],
                satisfactionSecurite: [],
                satisfactionServices: [],
                sourcesConnaissance: []
            }];

            Questionnaire.aggregate.mockResolvedValue(aggregateResult);

            const res = await request(app)
                .post("/api/questionnaires/stats/year")
                .send({ date: "2025-01-01" });

            expect(res.status).toBe(200);
            expect(res.body.filters).toHaveProperty("view", "years");
        });
    });

    describe("GET /api/questionnaires/comments", () => {
        test("200 retourne les commentaires avec dates", async () => {
            const comments = [
                { remarques: "Très bien", createdAt: new Date("2025-01-22") },
                { remarques: "Parfait", createdAt: new Date("2025-01-21") }
            ];

            const sortMock = jest.fn().mockResolvedValue(comments);
            Questionnaire.find.mockReturnValue({ sort: sortMock });

            const res = await request(app).get("/api/questionnaires/comments");

            expect(Questionnaire.find).toHaveBeenCalledWith(
                { remarques: { $ne: "" } },
                { remarques: 1, createdAt: 1, _id: 0 }
            );
            expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("total", 2);
            expect(res.body).toHaveProperty("data");
            expect(res.body.data).toHaveLength(2);
        });

        test("200 retourne tableau vide si aucun commentaire", async () => {
            const sortMock = jest.fn().mockResolvedValue([]);
            Questionnaire.find.mockReturnValue({ sort: sortMock });

            const res = await request(app).get("/api/questionnaires/comments");

            expect(res.status).toBe(200);
            expect(res.body.total).toBe(0);
            expect(res.body.data).toEqual([]);
        });

        test("500 si erreur serveur", async () => {
            Questionnaire.find.mockReturnValue({
                sort: jest.fn().mockRejectedValue(new Error("DB Error"))
            });

            const res = await request(app).get("/api/questionnaires/comments");

            expect(res.status).toBe(500);
            expect(res.body).toHaveProperty("message", "Erreur serveur");
        });
    });
});