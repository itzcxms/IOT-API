const mongoose = require("mongoose");
const Seuil = require("../models/Seuils.js");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("../config/db");

const seuils = [
    // Eau
    { nom: "Paris-Eau", type: "eau", unite: "m³", seuil: 150 },
    { nom: "Lyon-Eau", type: "eau", unite: "m³", seuil: 120 },
    { nom: "Marseille-Eau", type: "eau", unite: "m³", seuil: 140 },
    { nom: "Toulouse-Eau", type: "eau", unite: "m³", seuil: 130 },
    { nom: "Nice-Eau", type: "eau", unite: "m³", seuil: 135 },
    { nom: "Nantes-Eau", type: "eau", unite: "m³", seuil: 125 },

    // Savon
    { nom: "Paris-Savon", type: "savon", unite: "L", seuil: 50 },
    { nom: "Lyon-Savon", type: "savon", unite: "L", seuil: 40 },
    { nom: "Marseille-Savon", type: "savon", unite: "L", seuil: 45 },
    { nom: "Toulouse-Savon", type: "savon", unite: "L", seuil: 42 },
    { nom: "Nice-Savon", type: "savon", unite: "L", seuil: 48 },
    { nom: "Nantes-Savon", type: "savon", unite: "L", seuil: 38 },
];

const seedSeuils = async () => {
    try {
        const app = express();

        app.use(cors());
        app.use(express.json());
        app.use(morgan("dev"));

        const PORT = 3005
        connectDB("mongodb+srv://stevenmallochet_db_user:YCuj2XdlBvMplzy4@cluster0.h320qzb.mongodb.net/?appName=Cluster0")
            .then(() => {
                app.listen(PORT, () => {
                    console.log(`🚀 Server on http://localhost:${PORT}`);
                });
            })
            .catch((err) => {
                console.error("Erreur de connexion à la base :", err);
                process.exit(1);
            });

        await Seuil.deleteMany({});
        console.log("Anciens seuils supprimés");

        await Seuil.insertMany(seuils);
        console.log(`${seuils.length} seuils insérés avec succès`);

        await mongoose.connection.close();
        console.log("Connexion fermée");
        process.exit(0);
    } catch (error) {
        console.error("Erreur lors du seeding:", error);
        process.exit(1);
    }
};

seedSeuils();