const dotenv = require("dotenv");
dotenv.config();

const bcrypt = require("bcrypt");
const connectDB = require("../config/db");
const User = require("../models/User");
const Role = require("../models/Role");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

// Données fictives pour les utilisateurs
const fakeUsers = [
    {
        nom: "Dubois",
        prenom: "Marie",
        email: "marie.dubois@example.com",
        password: "Password123!",
        actif: true
    },
    {
        nom: "Martin",
        prenom: "Pierre",
        email: "pierre.martin@example.com",
        password: "Password123!",
        actif: true
    },
    {
        nom: "Bernard",
        prenom: "Sophie",
        email: "sophie.bernard@example.com",
        password: "Password123!",
        actif: true
    },
    {
        nom: "Petit",
        prenom: "Lucas",
        email: "lucas.petit@example.com",
        password: "Password123!",
        actif: false
    },
    {
        nom: "Robert",
        prenom: "Camille",
        email: "camille.robert@example.com",
        password: "Password123!",
        actif: true
    },
    {
        nom: "Richard",
        prenom: "Thomas",
        email: "thomas.richard@example.com",
        password: "Password123!",
        actif: true
    },
    {
        nom: "Durand",
        prenom: "Emma",
        email: "emma.durand@example.com",
        password: "Password123!",
        actif: true
    },
    {
        nom: "Leroy",
        prenom: "Hugo",
        email: "hugo.leroy@example.com",
        password: "Password123!",
        actif: false
    }
];

async function seedUsers() {
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

        // Récupérer les rôles existants
        const roles = await Role.find();

        if (roles.length === 0) {
            console.error("❌ Aucun rôle trouvé. Veuillez d'abord créer des rôles.");
            process.exit(1);
        }

        console.log(`📋 ${roles.length} rôle(s) trouvé(s)`);

        // Créer les utilisateurs
        const usersToCreate = [];

        for (let i = 0; i < fakeUsers.length; i++) {
            const userData = fakeUsers[i];

            // Hasher le mot de passe
            const hashedPassword = await bcrypt.hash(userData.password, 10);

            // Assigner un rôle de manière cyclique
            const roleIndex = i % roles.length;

            usersToCreate.push({
                nom: userData.nom,
                prenom: userData.prenom,
                email: userData.email,
                password: hashedPassword,
                role_id: roles[roleIndex]._id,
                actif: userData.actif
            });
        }

        // Insérer tous les utilisateurs
        const createdUsers = await User.insertMany(usersToCreate);

        console.log(`✅ ${createdUsers.length} utilisateurs créés avec succès!`);

        // Afficher un résumé
        console.log("\n📊 Résumé des utilisateurs créés:");
        for (const user of createdUsers) {
            const populatedUser = await User.findById(user._id).populate("role_id");
            console.log(`  - ${populatedUser.prenom} ${populatedUser.nom} (${populatedUser.email}) - Rôle: ${populatedUser.role_id.name || populatedUser.role_id._id} - Actif: ${populatedUser.actif}`);
        }

        console.log("\n✨ Seeding terminé!");

    } catch (error) {
        console.error("❌ Erreur lors du seeding:", error);
    } finally {
        process.exit(0);
    }
}

// Exécuter le seeder
seedUsers();