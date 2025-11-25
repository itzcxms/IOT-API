// scripts/seedRbac.js
const dotenv = require ("dotenv");
const mongoose = require("mongoose");

const Role = require ("../models/Role.js");
const Permission = require ("../models/Permission.js");
const RolePermission = require ("../models/RolePermission.js");

dotenv.config();

async function seedRBAC() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Mongo connecté pour seed RBAC");

    // 1) ROLES
    const rolesData = [
      { name: "root", poids: 1000},
      { name: "admin", poids: 100 },
      { name: "utilisateur", poids: 1 }
    ];

    const rolesMap = {}; // name -> doc
    for (const r of rolesData) {
      const role = await Role.findOneAndUpdate(
          { name: r.name },
          { $set: r },
          { new: true, upsert: true }
      );
      rolesMap[r.name] = role;
      console.log(`↻ rôle upsert: ${role.name} (poids=${role.poids})`);
    }

    // 2) PERMISSIONS
    const permissionsData = [
      { name: "Waiting permissions...", value: "wait.perms", actif: true },
        { name: "Waiting permissions...1", value: "wait.perms1", actif: true },
        { name: "Waiting permissions...2", value: "wait.perms2", actif: true },
        { name: "Waiting permissions...3", value: "wait.perms3", actif: true },
        { name: "Waiting permissions...4", value: "wait.perms4", actif: true },
        { name: "Waiting permissions...5", value: "wait.perms5", actif: true },
        { name: "Waiting permissions...6", value: "wait.perms6", actif: true },
        { name: "Waiting permissions...7", value: "wait.perms7", actif: true },
        { name: "Waiting permissions...8", value: "wait.perms8", actif: true },
        { name: "Waiting permissions...9", value: "wait.perms9", actif: true },
        { name: "Waiting permissions...10", value: "wait.perms10", actif: true },
        { name: "Waiting permissions...11", value: "wait.perms11", actif: true },
    ];

    const permDocs = [];
    for (const p of permissionsData) {
      const perm = await Permission.findOneAndUpdate(
          { value: p.value },     // value unique
          { $set: p },
          { new: true, upsert: true }
      );
      permDocs.push(perm);
      console.log(`↻ permission upsert: ${perm.value}`);
    }

    // 3) ASSIGNER TOUTES LES PERMISSIONS À ADMIN
    const adminRole = rolesMap["admin"];
    if (!adminRole) throw new Error("Rôle admin introuvable après seed");

    const ops = permDocs.map((perm) => ({
      updateOne: {
        filter: { role_id: adminRole._id, permission_id: perm._id },
        update: {
          $setOnInsert: {
            role_id: adminRole._id,
            permission_id: perm._id
          }
        },
        upsert: true
      }
    }));

    if (ops.length) {
      await RolePermission.bulkWrite(ops);
      console.log(`✅ ${ops.length} permissions assignées à admin`);
    }

    // (Optionnel) si tu veux quelques perms pour utilisateur, décommente :
    const userRole = rolesMap["utilisateur"];
    const basicPerms = permDocs.filter(p => ["users.read"].includes(p.value));
    const opsUser = basicPerms.map(perm => ({
      updateOne: {
        filter: { role_id: userRole._id, permission_id: perm._id },
        update: { $setOnInsert: { role_id: userRole._id, permission_id: perm._id } },
        upsert: true
      }
    }));
    if (opsUser.length) await RolePermission.bulkWrite(opsUser);

    // 4) LOG FINAL
    const allRoles = await Role.find().sort({ poids: -1 });
    const allPerms = await Permission.find().sort({ value: 1 });
    const adminLinks = await RolePermission.find({ role_id: adminRole._id })
        .populate("permission_id");

    console.log("\n📌 Rôles:", allRoles.map(r => ({ id: r._id, name: r.name, poids: r.poids })));
    console.log("\n📌 Permissions:", allPerms.map(p => ({ id: p._id, value: p.value })));
    console.log("\n📌 Admin a:", adminLinks.map(l => l.permission_id.value));

  } catch (e) {
    console.error("❌ Seed RBAC error:", e.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Mongo déconnecté");
  }
}

void seedRBAC();
