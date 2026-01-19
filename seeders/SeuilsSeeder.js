const mongoose = require("mongoose");
const Seuil = require("../models/Seuils.js");
const connectDB = require("../config/db");

const seuils = [
    // Eau - Loire Chaumont
    { nom: "Chaumont Centre-Eau", type: "eau", unite: "m³", seuil: 100, capteur_id: "CAPT_EAU_CHAUMONT_001" },
    { nom: "Chaumont Nord-Eau", type: "eau", unite: "m³", seuil: 95, capteur_id: "CAPT_EAU_CHAUMONT_002" },
    { nom: "Chaumont Sud-Eau", type: "eau", unite: "m³", seuil: 110, capteur_id: "CAPT_EAU_CHAUMONT_003" },
    { nom: "Chaumont Est-Eau", type: "eau", unite: "m³", seuil: 105, capteur_id: "CAPT_EAU_CHAUMONT_004" },
    { nom: "Chaumont Ouest-Eau", type: "eau", unite: "m³", seuil: 115, capteur_id: "CAPT_EAU_CHAUMONT_005" },
    { nom: "Chaumont Zone Industrielle-Eau", type: "eau", unite: "m³", seuil: 90, capteur_id: "CAPT_EAU_CHAUMONT_006" },

    // Savon - Loire Chaumont
    { nom: "Chaumont Centre-Savon", type: "savon", unite: "L", seuil: 35, capteur_id: "CAPT_SAVON_CHAUMONT_001" },
    { nom: "Chaumont Nord-Savon", type: "savon", unite: "L", seuil: 30, capteur_id: "CAPT_SAVON_CHAUMONT_002" },
    { nom: "Chaumont Sud-Savon", type: "savon", unite: "L", seuil: 40, capteur_id: "CAPT_SAVON_CHAUMONT_003" },
    { nom: "Chaumont Est-Savon", type: "savon", unite: "L", seuil: 32, capteur_id: "CAPT_SAVON_CHAUMONT_004" },
    { nom: "Chaumont Ouest-Savon", type: "savon", unite: "L", seuil: 38, capteur_id: "CAPT_SAVON_CHAUMONT_005" },
    { nom: "Chaumont Zone Industrielle-Savon", type: "savon", unite: "L", seuil: 28, capteur_id: "CAPT_SAVON_CHAUMONT_006" },
];

const seedSeuils = async () => {
    try {
        console.log("🌱 Démarrage du seeding des seuils...");

        // Connexion à la base de données
        await connectDB("mongodb+srv://stevenmallochet_db_user:YCuj2XdlBvMplzy4@cluster0.h320qzb.mongodb.net/?appName=Cluster0");
        console.log("✅ Connecté à la base de données");

        // Suppression des anciens seuils
        await Seuil.deleteMany({});
        console.log("🗑️  Anciens seuils supprimés");

        // Insertion des nouveaux seuils
        await Seuil.insertMany(seuils);
        console.log(`✅ ${seuils.length} seuils insérés avec succès`);

        // Affichage des seuils insérés
        console.log("\n📋 Liste des seuils insérés:");
        seuils.forEach(s => {
            console.log(`  - ${s.capteur_id}: ${s.nom} (${s.type}) - Seuil: ${s.seuil} ${s.unite}`);
        });

        // Fermeture de la connexion
        await mongoose.connection.close();
        console.log("\n🔌 Connexion fermée");
        console.log("✨ Seeding terminé avec succès");

        process.exit(0);
    } catch (error) {
        console.error("❌ Erreur lors du seeding:", error);
        process.exit(1);
    }
};

seedSeuils();