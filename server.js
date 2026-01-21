const express = require ("express");
const cors = require ("cors");
const morgan = require ("morgan");
const dotenv = require ("dotenv");
dotenv.config()
const connectDB = require ("./config/db.js");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const client = require('./addons/mqttServer');

const authRoutes = require ("./routes/auth.routes");
const userRoutes = require ("./routes/user.routes");
const roleRoutes = require ("./routes/role.routes");
const seuilRoutes = require("./routes/seuil.routes");
const savonRoutes = require("./routes/savon.routes");
const permissionRoutes = require ("./routes/permission.routes");
const capteursGraphRoutes = require("./routes/capteursGraph.routes");
const questionnaireRoutes = require("./routes/questionnaire.routes");

app.get("/api/", (req, res) => res.json({ status: "API OK" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/savon", savonRoutes)
app.use("/api/seuils", seuilRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/graphs/capteurs", capteursGraphRoutes);
app.use("/api/questionnaires", questionnaireRoutes);

const PORT = process.env.PORT || 3000;
connectDB(process.env.MONGO_URI)
.then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server on http://localhost:${PORT}`);
    });
})
.catch((err) => {
    console.error("Erreur de connexion à la base :", err);
    process.exit(1);
});

client.on('connect', () => {
    client.subscribe([process.env.MQTT_TOPIC], () => {
        console.log(`[MQTT] Abonnement au topic opérationnelle !`)
    });
});