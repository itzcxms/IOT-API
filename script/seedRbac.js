// scripts/seedRbac.js
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const User = require("../models/User.js");
const Role = require("../models/Role.js");
const Permission = require("../models/Permission.js");
const RolePermission = require("../models/RolePermission.js");

dotenv.config();

// Toutes tes permissions (categorie.action)
const PERMISSIONS = [
    "users.view",
    "users.create",
    "users.update",
    "users.delete",

    "roles.view",
    "roles.create",
    "roles.update",
    "roles.delete",
    "roles.assign_permissions",
    "roles.view_permissions",

    "permissions.view",
    "permissions.create",
    "permissions.update",
    "permissions.delete",

    "admin.register",
];

// 5 rôles fictifs + 1 super-admin
const ROLES = [
    { name: "super-admin", poids: 1000, description: "A tous les droits" },
    { name: "Admin", poids: 100, description: "Gère les utilisateurs et rôles" },
    { name: "role1", poids: 20, description: "role1" },
    { name: "role2", poids: 20, description: "role2" },
    { name: "role3", poids: 20, description: "role3" },
    { name: "utilisateur", poids: 1, description: "Lecture seule" },
];

// Libellés FR pour rendre le champ `name` joli
const categorieLabels = {
    users: "Utilisateurs",
    roles: "Rôles",
    permissions: "Permissions",
    admin: "Administration",
};

const actionLabels = {
    view: "Voir",
    create: "Créer",
    update: "Mettre à jour",
    delete: "Supprimer",
    assign_permissions: "Assigner les permissions",
    view_permissions: "Voir les permissions",
    register: "Inscription",
};

async function seedRBAC() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Mongo connecté pour seed RBAC");

        // ⚠️ reset complet des collections RBAC
        await Promise.all([
            User.deleteMany({}),
            RolePermission.deleteMany({}),
            Role.deleteMany({}),
            Permission.deleteMany({}),
        ]);
        console.log("🧹 Collections Role, Permission, RolePermission vidées");

        // 1) PERMISSIONS
        const permissionPayload = PERMISSIONS.map((value) => {
            const [categorie, action] = value.split(".");

            const catLabel = categorieLabels[categorie] || categorie;
            const actLabel = actionLabels[action] || action;

            const name = `${catLabel} - ${actLabel}`; // ex: "Utilisateurs - Voir"

            return {
                value,      // "users.view"
                categorie,  // "users"
                name,       // "Utilisateurs - Voir"
            };
        });

        await Permission.insertMany(permissionPayload);
        const allPerms = await Permission.find().sort({ value: 1 });
        console.log(`✅ ${allPerms.length} permissions créées`);

        // 2) ROLES
        await Role.insertMany(ROLES);
        const allRoles = await Role.find().sort({ poids: 1 });
        console.log(`✅ ${allRoles.length} rôles créés`);

        const superAdmin = allRoles.find((r) => r.name === "super-admin");
        if (!superAdmin) {
            throw new Error("Le rôle super-admin n'a pas été créé, vérifie le seed.");
        }

        // 3) ROLE_PERMISSIONS : matrice complète role/permission
        const rolePermissionsPayload = [];

        for (const role of allRoles) {
            if (role.name === "super-admin") continue;

            for (const perm of allPerms) {
                rolePermissionsPayload.push({
                    role_id: role._id,
                    permission_id: perm._id,
                    actif: false,
                });
            }
        }

        await RolePermission.insertMany(rolePermissionsPayload);
        console.log(
            `✅ ${rolePermissionsPayload.length} entrées RolePermission créées`
        );

        // 4) Logs de contrôle
        const adminLinks = await RolePermission.find({
            role_id: superAdmin._id,
            actif: true,
        }).populate("permission_id");

        console.log(
            "\n📌 Rôles:",
            allRoles.map((r) => ({ id: r._id, name: r.name, poids: r.poids }))
        );
        console.log(
            "\n📌 Permissions:",
            allPerms.map((p) => ({
                id: p._id,
                categorie: p.categorie,
                name: p.name,
                value: p.value,
            }))
        );
        console.log(
            "\n📌 super-admin a:",
            adminLinks.map((l) => l.permission_id.value)
        );
    } catch (e) {
        console.error("❌ Seed RBAC error:", e.message);
    } finally {
        await mongoose.disconnect();
        console.log("🔌 Mongo déconnecté");
    }
}

void seedRBAC();
