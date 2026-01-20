// __tests__/seuils/seuils.routes.test.js
const request = require("supertest");
const express = require("express");

// Mocks (même approche que roles.test.js)
jest.mock("../../models/Seuils.js", () => ({
    distinct: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
}));

// Mock du "constructor" (new Seuil(req.body)) + save()
jest.mock("../../models/Seuils.js", () => {
    // constructeur mocké => supporte Seuil.mockImplementation(...)
    const Seuil = jest.fn(function (data) {
        this.data = data;
        this.save = jest.fn();
    });

    // méthodes "statiques" façon Model mongoose
    Seuil.distinct = jest.fn();
    Seuil.find = jest.fn();
    Seuil.findById = jest.fn();
    Seuil.findByIdAndUpdate = jest.fn();
    Seuil.findByIdAndDelete = jest.fn();

    return Seuil;
});


jest.mock("../../middleware/auth", () => {
    return (req, res, next) => {
        req.user = { id: "test-user" };
        next();
    };
});

jest.mock("../../middleware/requirePermission.js", () => {
    return () => (req, res, next) => next();
});

const Seuil = require("../../models/Seuils.js");
const seuilRoutes = require("../../routes/seuil.routes.js");

describe("Seuils routes", () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use("/api/seuils", seuilRoutes);
        jest.clearAllMocks();
    });

    describe("GET /api/seuils/capteurs", () => {
        test("retourne la liste des capteur_id distincts", async () => {
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
            expect(res.body).toHaveProperty("message");
        });
    });

    describe("GET /api/seuils", () => {
        test("retourne tous les seuils triés", async () => {
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
            expect(res.body).toHaveProperty("message");
        });
    });

    describe("GET /api/seuils/savon", () => {
        test('retourne les seuils de type "savon"', async () => {
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
            expect(res.body).toHaveProperty("message");
        });
    });

    describe("GET /api/seuils/eau", () => {
        test('retourne les seuils de type "eau"', async () => {
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
            expect(res.body).toHaveProperty("message");
        });
    });

    describe("GET /api/seuils/capteur/:capteur_id", () => {
        test("retourne les seuils filtrés par capteur_id (regex)", async () => {
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
            expect(res.body).toHaveProperty("message");
        });
    });

    describe("GET /api/seuils/capteur/:capteur_id/:type", () => {
        test("retourne les seuils filtrés par capteur_id (regex) et type", async () => {
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
            expect(res.body).toHaveProperty("message");
        });
    });

    describe("GET /api/seuils/:id", () => {
        test("retourne un seuil par ID", async () => {
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
            expect(res.body).toHaveProperty("message", "Seuil non trouvé");
        });

        test("500 si erreur serveur", async () => {
            Seuil.findById.mockRejectedValue(new Error("DB Error"));

            const res = await request(app).get("/api/seuils/id1");

            expect(res.status).toBe(500);
            expect(res.body).toHaveProperty("message");
        });
    });

    describe("POST /api/seuils/", () => {
        test("201 crée un seuil", async () => {
            const body = {
                nom: "Seuil Savon",
                type: "savon",
                unite: "ml",
                seuil: 10,
                capteur_id: "SAV-001",
            };

            // new Seuil(body).save()
            Seuil.mockImplementation(function (data) {
                this.data = data;
                this.save = jest.fn().mockResolvedValue({ _id: "id1", ...data });
            });

            const res = await request(app).post("/api/seuils/").send(body);

            expect(res.status).toBe(201);
            expect(res.body).toEqual({ _id: "id1", ...body });
        });

        test("400 si erreur validation/DB", async () => {
            Seuil.mockImplementation(function () {
                this.save = jest.fn().mockRejectedValue(new Error("Validation failed"));
            });

            const res = await request(app).post("/api/seuils/").send({});

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("message");
        });
    });

    describe("PUT /api/seuils/:id", () => {
        test("met à jour un seuil", async () => {
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
            expect(res.body).toHaveProperty("message", "Seuil non trouvé");
        });

        test("400 si erreur validation/DB", async () => {
            Seuil.findByIdAndUpdate.mockRejectedValue(new Error("Validation failed"));

            const res = await request(app).put("/api/seuils/id1").send({ seuil: "bad" });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("message");
        });
    });

    describe("DELETE /api/seuils/:id", () => {
        test("supprime un seuil", async () => {
            const seuil = { _id: "id1" };
            Seuil.findByIdAndDelete.mockResolvedValue(seuil);

            const res = await request(app).delete("/api/seuils/id1");

            expect(Seuil.findByIdAndDelete).toHaveBeenCalledWith("id1");
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ message: "Seuil supprimé avec succès" });
        });

        test("404 si seuil non trouvé", async () => {
            Seuil.findByIdAndDelete.mockResolvedValue(null);

            const res = await request(app).delete("/api/seuils/id404");

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty("message", "Seuil non trouvé");
        });

        test("500 si erreur serveur", async () => {
            Seuil.findByIdAndDelete.mockRejectedValue(new Error("DB Error"));

            const res = await request(app).delete("/api/seuils/id1");

            expect(res.status).toBe(500);
            expect(res.body).toHaveProperty("message");
        });
    });
});
