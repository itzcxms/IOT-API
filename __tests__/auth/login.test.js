const cors = require("cors");
const request = require("supertest");
const express = require("express");
const User = require("../../models/User");
const jwt = require("jsonwebtoken");

const path = require ("../../routes/auth.routes");
const morgan = require("morgan");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));
app.use("/api/auth/", path);

describe("POST /api/auth/login", () => {
    beforeAll(() => {
        process.env.JWT_SECRET = "test-secret";
        process.env.TOKEN = "2h";
        process.env.REFRESHTOKEN = "4d";
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("401 si l'utilisateur n'existe pas", async () => {
        jest.spyOn(User, "findOne").mockReturnValue({
            populate: jest.fn().mockResolvedValue(null),
        });

        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "test@test.com", password: "123456" });

        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ message: "Identifiants ou mot de passe invalides" });
    });

    test("200 + token si tout est bon", async () => {
        const fakeUser = {
            _id: "user-id",
            email: "test@test.com",
            password: "hashed",
            actif: true,
            nom: "Doe",
            prenom: "John",
            role_id: { _id: "role-id", name: "admin" },
        };

        jest.spyOn(User, "findOne").mockReturnValue({
            populate: jest.fn().mockResolvedValue(fakeUser),
        });

        jest.spyOn(bcrypt, "compare").mockResolvedValue(true);

        jest
            .spyOn(jwt, "sign")
            .mockReturnValueOnce("access-token")
            .mockReturnValueOnce("refresh-token");

        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "test@test.com", password: "123456" });

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            token: "access-token",
            refreshToken: "refresh-token",
            user: {
                "id": fakeUser._id,
                "email": fakeUser.email,
                "nom": fakeUser.nom,
                "prenom": fakeUser.prenom,
                "role": {
                    "_id": fakeUser.role_id._id,
                    "name": fakeUser.role_id.name
                },
            }
        });
    });
});