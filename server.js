const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const dotenv = require("dotenv");
dotenv.config();

const { startSimulator } = require("./addons/presenceSimulator");

const connectDB = require("./config/db.js");

// Swagger
const swaggerUi = require("swagger-ui-express");
const swaggerJSDoc = require("swagger-jsdoc");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// MQTT (inchangé)
const client = require("./addons/mqttServer");

// Routes (inchangé)
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const roleRoutes = require("./routes/role.routes");
const seuilRoutes = require("./routes/seuil.routes");
const savonRoutes = require("./routes/savon.routes");
const permissionRoutes = require("./routes/permission.routes");
const capteursGraphRoutes = require("./routes/capteursGraph.routes");
const questionnaireRoutes = require("./routes/questionnaire.routes");

const PORT = process.env.PORT || 3000;

/**
 * Swagger/OpenAPI spec
 * - apis pointe sur tes fichiers routes pour lire les @openapi en JSDoc
 * - servers permet d’avoir un "Try it out" qui tape au bon endroit
 * - components.schemas : tu peux centraliser tes schémas ici (ou dans tes routes)
 */
const swaggerSpec = swaggerJSDoc({
    definition: {
        openapi: "3.0.3",
        info: {
            title: "API",
            version: "1.0.0",
            description: "Documentation Swagger de l'API",
        },
        servers: [
            {
                url: process.env.API_URL_LOC,
                description: "Local",
            },
            {
                url: process.env.API_URL,
                description: "Production"
            },
        ],
        tags: [
            { name: "Auth", description: "Authentification" },
            { name: "Users", description: "Gestion utilisateurs" },
            { name: "Roles", description: "Gestion des rôles" },
            { name: "Permissions", description: "Gestion des permissions" },
            { name: "Savon", description: "Routes savon" },
            { name: "Seuils", description: "Routes seuils" },
            { name: "Graphs", description: "Graphiques capteurs" },
            { name: "Questionnaires", description: "Questionnaires" },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
            schemas: {
                ErrorMessage: {
                    type: "object",
                    properties: {
                        message: { type: "string", example: "Erreur serveur" },
                    },
                    required: ["message"],
                },
                AuthError: {
                    type: "object",
                    properties: {
                        code: { type: "string", example: "TOKEN_INVALID" },
                        message: { type: "string", example: "Token invalide" },
                    },
                    required: ["code", "message"],
                },
                LoginRequest: {
                    type: "object",
                    required: ["email", "password"],
                    properties: {
                        email: { type: "string", format: "email", example: "john.doe@mail.com" },
                        password: { type: "string", example: "MonMotDePasse!" },
                    },
                },
                LoginSuccess: {
                    type: "object",
                    properties: {
                        token: { type: "string" },
                        refreshToken: { type: "string" },
                        user: {
                            type: "object",
                            properties: {
                                id: { type: "string", example: "66b1f8d2c9d1a1b2c3d4e5f6" },
                                nom: { type: "string", example: "Doe" },
                                prenom: { type: "string", example: "John" },
                                email: { type: "string", format: "email", example: "john.doe@mail.com" },
                                role: { type: "object", additionalProperties: true },
                            },
                        },
                    },
                    required: ["token", "refreshToken", "user"],
                },
                User: { type: "object", additionalProperties: true },
                Role: { type: "object", additionalProperties: true },
                Permission: { type: "object", additionalProperties: true },
                Seuil: { type: "object", additionalProperties: true },
                Savon: { type: "object", additionalProperties: true },
                Questionnaire: { type: "object", additionalProperties: true },

                UserCreateRequest: {
                    type: "object",
                    required: ["nom", "prenom", "email", "password"],
                    properties: {
                        nom: { type: "string" },
                        prenom: { type: "string" },
                        email: { type: "string", format: "email" },
                        password: { type: "string" },
                        role_id: { type: "string", nullable: true },
                    },
                },
                UserUpdateRequest: {
                    type: "object",
                    properties: {
                        nom: { type: "string" },
                        prenom: { type: "string" },
                        email: { type: "string", format: "email" },
                        password: { type: "string" },
                        role_id: { type: "string" },
                        actif: { type: "boolean" },
                    },
                },
                RoleCreateRequest: { type: "object", additionalProperties: true },
                RoleUpdateRequest: { type: "object", additionalProperties: true },
                PermissionCreateRequest: { type: "object", additionalProperties: true },
                PermissionUpdateRequest: { type: "object", additionalProperties: true },

                SavonCreateRequest: {
                    type: "object",
                    required: ["contenance", "seuils", "name"],
                    properties: {
                        contenance: { type: "number", example: 1000 },
                        name: { type: "string", example: "Distributeur 1" },
                        seuils: {
                            type: "object",
                            required: ["alert"],
                            properties: { alert: { type: "number", example: 200 } },
                        },
                        consommationParPassage: { type: "number", example: 1.5 },
                    },
                },
                SavonUpdateRequest: {
                    type: "object",
                    properties: {
                        contenance: { type: "number" },
                        name: { type: "string" },
                        seuils: {
                            type: "object",
                            properties: { alert: { type: "number" } },
                        },
                        consommationParPassage: { type: "number" },
                    },
                },
                SavonCheckAlertResponse: {
                    type: "object",
                    properties: {
                        alerteNecessaire: { type: "boolean" },
                        contenanceEstimee: { type: "number" },
                        seuilAlert: { type: "number" },
                        passages: { type: "number" },
                    },
                },

                SeuilCreateRequest: { type: "object", additionalProperties: true },
                SeuilUpdateRequest: { type: "object", additionalProperties: true },

                GraphLastInfoRequest: {
                    type: "object",
                    properties: {
                        type: { type: "string", enum: ["sonde", "toilette"], example: "sonde" },
                        filters: { type: "object", additionalProperties: true },
                    },
                },
                GraphDayRequest: {
                    type: "object",
                    properties: {
                        type: { type: "string", enum: ["sonde", "toilette"] },
                        date: { type: "string", example: "2026-01-22" },
                        filters: { type: "object", additionalProperties: true },
                    },
                },
                GraphWeekRequest: {
                    type: "object",
                    properties: {
                        type: { type: "string", enum: ["sonde", "toilette"] },
                        date: { type: "string", example: "2026-01-22" },
                        filters: { type: "object", additionalProperties: true },
                    },
                },
                GraphMonthRequest: {
                    type: "object",
                    required: ["type", "annee", "start", "end"],
                    properties: {
                        type: { type: "string", enum: ["sonde", "toilette"] },
                        annee: { type: "integer", example: 2026 },
                        start: { type: "string", example: "03" },
                        end: { type: "string", example: "05" },
                        filters: { type: "object", additionalProperties: true },
                    },
                },
                GraphYearRequest: {
                    type: "object",
                    required: ["type", "annee"],
                    properties: {
                        type: { type: "string", enum: ["sonde", "toilette"] },
                        annee: { type: "integer", example: 2026 },
                        filters: { type: "object", additionalProperties: true },
                    },
                },

                QuestionnaireCreateRequest: {
                    type: "object",
                    required: ["satisfactionAire", "satisfactionSecurite", "satisfactionServices"],
                    properties: {
                        satisfactionAire: { type: "string", enum: ["mauvais", "passable", "bon", "excellent"] },
                        satisfactionSecurite: { type: "string", enum: ["mauvais", "passable", "bon", "excellent"] },
                        satisfactionServices: { type: "string", enum: ["mauvais", "passable", "bon", "excellent"] },
                        sourcesConnaissance: { type: "array", items: { type: "string" } },
                        autreSource: { type: "string", nullable: true },
                        remarques: { type: "string", nullable: true },
                    },
                },
            },
        },
    },

    apis: ["./routes/**/*.js", "./routes/*.js"],
});

// Swagger UI (corrigé : app.use et non app.get)
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Endpoints de base
app.get("/api/", (req, res) => res.json({ status: "API OK" }));

// Montage des routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/savon", savonRoutes);
app.use("/api/seuils", seuilRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/graphs/capteurs", capteursGraphRoutes);
app.use("/api/questionnaires", questionnaireRoutes);

// DB + server
connectDB(process.env.MONGO_URI)
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server on http://localhost:${PORT}`);
            console.log(`Swagger on http://localhost:${PORT}/docs`);
        });

        startSimulator();
    })
    .catch((err) => {
        console.error("Erreur de connexion à la base :", err);
        process.exit(1);
    });

// MQTT
client.on("connect", () => {
    client.subscribe([process.env.MQTT_TOPIC], () => {
        console.log("[MQTT] Abonnement au topic opérationnelle !");
    });
});