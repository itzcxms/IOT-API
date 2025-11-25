// config/db.js
const mongoose = require("mongoose");

require("dotenv").config({ path: "./.env.test" }); // Permet de charger les variables d'environnement

async function connectDBTEST() {
    try {
        mongoose.set("strictQuery", true);

        await mongoose.connect(process.env.MONGO_URI); // pas d'options dépréciées
        console.log("✅ MongoDB Test connecté");
    } catch (err) {
        console.error("❌ Erreur MongoDB Test:", err.message);
        process.exit(1);
    }
}

module.exports = connectDBTEST();