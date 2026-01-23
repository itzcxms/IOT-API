const { Router } = require("express");
const User = require('../models/User');
const Role = require("../models/Role.js");
const RolePermission = require("../models/RolePermission.js");
const Permission = require("../models/Permission.js");
const auth = require("../middleware/auth.js");
const requirePermission = require("../middleware/requirePermission.js");

const router = Router();
module.exports = router;

/**
 * @openapi
 * /api/roles/all:
 *   get:
 *     tags: [Roles]
 *     summary: Liste des rôles (poids 1..100)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des rôles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Role' }
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 */
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

/**
 * @openapi
 * /api/roles/create:
 *   post:
 *     tags: [Roles]
 *     summary: Créer un rôle
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RoleCreateRequest' }
 *     responses:
 *       201:
 *         description: Rôle créé (et liaisons RolePermission initialisées)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 role: { $ref: '#/components/schemas/Role' }
 *                 permissions_linked: { type: integer }
 *       400:
 *         description: Validation échouée
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 *       403:
 *         description: Accès refusé (permission superadmin)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
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

/**
 * @openapi
 * /api/roles/update/{id}:
 *   put:
 *     tags: [Roles]
 *     summary: Mettre à jour un rôle
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RoleUpdateRequest' }
 *     responses:
 *       200:
 *         description: Rôle mis à jour
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Role' }
 *       400:
 *         description: Validation échouée
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 *       403:
 *         description: Accès refusé (permission superadmin)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       404:
 *         description: Rôle introuvable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
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
/**
 * @openapi
 * /api/roles/delete/{id}:
 *   delete:
 *     tags: [Roles]
 *     summary: Supprimer un rôle
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Rôle supprimé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 *       403:
 *         description: Accès refusé (permission superadmin)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       404:
 *         description: Rôle introuvable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
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
/**
 * @openapi
 * /api/roles/{id}/permissions:
 *   get:
 *     tags: [Roles]
 *     summary: Récupérer les permissions d'un rôle (groupées par catégorie)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Permissions groupées (format tableau)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: array
 *                 items: {}
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
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
/**
 * @openapi
 * /api/roles/{roleid}/permissions/{permid}:
 *   post:
 *     tags: [Roles]
 *     summary: Activer/Désactiver une permission pour un rôle
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleid
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: permid
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [actif]
 *             properties:
 *               actif: { type: boolean, example: true }
 *     responses:
 *       200:
 *         description: Lien rôle/permission mis à jour
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 data: { type: object, additionalProperties: true }
 *       400:
 *         description: Requête invalide (actif doit être booléen)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 *       403:
 *         description: Accès refusé (permission roles.assign_permissions)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       404:
 *         description: Rôle ou permission introuvable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
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
            const user = await User.updateMany(
                { role_id: roleid },
                { $inc: { authzVersion: 1 } }
            );

            console.log(user);

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

