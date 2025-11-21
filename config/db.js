// config/db.js
import mongoose from "mongoose";

export async function connectDB(uri) {
    try {
        mongoose.set("strictQuery", true);

        await mongoose.connect(uri); // pas d'options dépréciées
        console.log("✅ MongoDB connecté");
    } catch (err) {
        console.error("❌ Erreur MongoDB:", err.message);
        process.exit(1);
    }
}
