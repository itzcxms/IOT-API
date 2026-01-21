const { Router } = require("express");
const User = require('../models/User');
const Role = require("../models/Role.js");
const RolePermission = require("../models/RolePermission.js");
const Permission = require("../models/Permission.js");
const auth = require("../middleware/auth.js");
const requirePermission = require("../middleware/requirePermission.js");

const router = Router();
module.exports = router;

// GET /api/roles/all
// récupere les roles contenant le poids entre 1 a 100 uniquement.
router.get("/all", auth, async (req, res) => {
    try {
        const roles = await Role.find({
            poids: { $gte: 1, $lte: 100 } // poids a modifier si vous voulez plus de role.
        }).sort({ poids: 1 });

        res.json(roles);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des rôles" });
    }
});

// POST /api/roles/create
router.post("/create", auth, requirePermission("superadmin"), async (req, res) => {
    try {
        // 1) Création du rôle
        const role = await Role.create(req.body);

        // 2) Récupération de toutes les permissions existantes
        const permissions = await Permission.find({}, { _id: 1 });

        // 3) Construction des RolePermission pour ce rôle (toutes inactives par défaut)
        const rolePermissions = permissions.map((perm) => ({
            role_id: role._id,
            permission_id: perm._id,
            actif: false,
        }));

        // 4) Insertion en bulk
        if (rolePermissions.length > 0) {
            await RolePermission.insertMany(rolePermissions);
        }

        res.status(201).json({
            role,
            permissions_linked: rolePermissions.length,
        });
    } catch (e) {
        console.error(e);
        res.status(400).json({ message: e.message });
    }
});

/* PUT /api/roles/update/:id
req.body = {
  "name": "Admin",
  "description": "Accès complet",
  "poids": 10,
  "permissions": ["<permissionId1>", "<permissionId2>"]
}
 */
router.put("/update/:id", auth, requirePermission("superadmin"), async (req, res) => {
    try {
        const role = await Role.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        if (!role) {
            return res.status(404).json({ message: "Rôle introuvable" });
        }

        res.json(role);
    } catch (e) {
        console.error(e);
        res.status(400).json({ message: e.message });
    }
});

// DELETE /api/roles/delete/:id
router.delete("/delete/:id", auth, requirePermission("superadmin"), async (req, res) => {
    try {
        const role = await Role.findByIdAndDelete(req.params.id);

        if (!role) {
            return res.status(404).json({ message: "Rôle introuvable" });
        }

        await RolePermission.deleteMany({ role_id: role._id });

        res.json({ message: "Rôle supprimé", id: role._id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Erreur serveur lors de la suppression du rôle" });
    }
});

// /**
//  * Assigner des permissions à un rôle
//  * POST /api/roles/:id/permissions
//  * body: { permission_ids: ["permId1", "permId2", ...] }
//  */
// router.post(
//     "/:id/permissions",
//     auth,
//     requirePermission("roles.assign_permissions"),
//     async (req, res) => {
//         try {
//             const { permission_ids = [] } = req.body;
//
//             const role = await Role.findById(req.params.id);
//             if (!role) {
//                 return res.status(404).json({ message: "Rôle introuvable" });
//             }
//
//             // Vérifier que toutes les permissions existent
//             const perms = await Permission.find({ _id: { $in: permission_ids } });
//             if (perms.length !== permission_ids.length) {
//                 return res.status(400).json({ message: "Une ou plusieurs permissions invalides" });
//             }
//
//             // 1) Mettre toutes les permissions de ce rôle à inactif
//             await RolePermission.updateMany(
//                 { role_id: role._id },
//                 { $set: { actif: false } }
//             );
//
//             // 2) Activer uniquement les permissions fournies + upsert si manquantes
//             const ops = permission_ids.map((pid) => ({
//                 updateOne: {
//                     filter: { role_id: role._id, permission_id: pid },
//                     update: {
//                         $set: {
//                             role_id: role._id,
//                             permission_id: pid,
//                             actif: true,
//                         },
//                     },
//                     upsert: true,
//                 },
//             }));
//
//             if (ops.length) {
//                 await RolePermission.bulkWrite(ops);
//                 res.json({ message: "Permissions mises à jour pour le rôle" });
//             } else {
//                 res.json({ message: "Toutes les permissions ont été désactivées pour ce rôle" });
//             }
//         } catch (e) {
//             console.error(e);
//             res.status(400).json({ message: e.message });
//         }
//     }
// );

// GET /api/roles/:id/permissions
router.get(
    "/:id/permissions",
    auth,
    async (req, res) => {
        try {
            const links = await RolePermission.find({ role_id: req.params.id }).populate("permission_id");
            let response = links.map((l) => JSON.parse(JSON.stringify(l.permission_id)));

            let data = {};
            for (let i = 0; i < response.length; i++) {
                response[i]["active"] = links[i]["actif"];
                if (!Object.keys(data).includes(response[i].categorie)) {
                    data[response[i].categorie] = [response[i]];
                } else {
                    data[response[i].categorie].push(response[i]);
                }
            }

            const keys = Object.keys(data);
            response = [];
            for (let i = 0; i < keys.length; i++) {
                response.push([keys[i], data[keys[i]]]);
            }

            res.json(response);
        } catch (e) {
            console.error(e);
            res.status(500).json({ message: "Erreur serveur lors de la récupération des permissions du rôle" });
        }
    }
);

/**
 * Modifier la valeur des permissions: actif = true/false à un rôle
 * POST /api/roles/:roleId/permissions/:permId
 * Body: { "actif": true/false}
 */
router.post(
    "/:roleid/permissions/:permid",
    auth,
    requirePermission("roles.assign_permissions"),
    async (req, res) => {
        try {
            const { actif } = req.body;
            const { roleid, permid } = req.params;

            if (typeof actif !== "boolean") {
                return res.status(400).json({
                    message: "Le champ 'actif' doit être un booléen (true/false)",
                });
            }

            const role = await Role.findById(roleid);
            if (!role) return res.status(404).json({ message: "Rôle introuvable" });

            const permission = await Permission.findById(permid);
            if (!permission)
                return res.status(404).json({ message: "Permission introuvable" });

            const result = await RolePermission.findOneAndUpdate(
                { role_id: roleid, permission_id: permid },
                { $set: { role_id: roleid, permission_id: permid, actif } },
                { upsert: true, new: true }
            );

            // IMPORTANT: bump authzVersion de tous les users du rôle
            await User.updateMany(
                { role_id: roleid },
                { $inc: { authzVersion: 1 } }
            );

            res.json({
                message: `Permission ${actif ? "activée" : "désactivée"} pour le rôle`,
                data: result,
            });
        } catch (e) {
            console.error(e);
            res.status(400).json({ message: e.message });
        }
    }
);

