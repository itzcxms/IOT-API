const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

async function dropIndex() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Mongo connecté");

        const collection = mongoose.connection.collection("permissions");

        const indexes = await collection.indexes();
        console.log("Indexes actuels:", indexes);

        await collection.dropIndex("categorie_1");
        console.log("✅ Index categorie_1 supprimé");
    } catch (e) {
        console.error("Erreur lors de la suppression de l'index:", e.message);
    } finally {
        await mongoose.disconnect();
        console.log("🔌 Mongo déconnecté");
    }
}

void dropIndex();
