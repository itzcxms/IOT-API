const { Router } = require("express");
const Permission = require("../models/Permission.js");
const RolePermission = require("../models/RolePermission.js");
const Role = require("../models/Role");
const auth = require("../middleware/auth.js");
const requirePermission = require("../middleware/requirePermission.js");

const router = Router();
module.exports = router;

// GET /api/permissions/all
/**
 * @openapi
 * /api/permissions/all:
 *   get:
 *     tags: [Permissions]
 *     summary: Liste de toutes les permissions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Permission' }
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 */
router.get("/all", auth, async (req, res) => {
    try {
        const permissions = await Permission.find().sort({ createdAt: -1 });
        res.json(permissions);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des permissions" });
    }
});

// GET /api/permissions/:id
/**
 * @openapi
 * /api/permissions/{id}:
 *   get:
 *     tags: [Permissions]
 *     summary: Détail d'une permission
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Permission trouvée
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Permission' }
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 *       404:
 *         description: Permission introuvable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
router.get("/:id", auth, async (req, res) => {
    try {
        const perm = await Permission.findById(req.params.id);
        if (!perm) {
            return res.status(404).json({ message: "Permission introuvable" });
        }
        res.json(perm);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Erreur serveur lors de la récupération de la permission" });
    }
});

// POST /api/permissions/create
/**
 * @openapi
 * /api/permissions/create:
 *   post:
 *     tags: [Permissions]
 *     summary: Créer une permission (et lier à tous les rôles en inactif)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PermissionCreateRequest' }
 *     responses:
 *       201:
 *         description: Permission créée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 perm: { $ref: '#/components/schemas/Permission' }
 *                 roles_linked: { type: integer }
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
router.post(
    "/create",
    auth,
    requirePermission("superadmin"),
    async (req, res) => {
        try {
            // 1) Création de la permission
            const perm = await Permission.create(req.body);

            // 2) Récupération de tous les rôles existants
            const roles = await Role.find({}, { _id: 1 });

            // 3) Création des liaisons RolePermission (inactives par défaut)
            const rolePermissions = roles.map((role) => ({
                role_id: role._id,
                permission_id: perm._id,
                actif: false,
            }));

            if (rolePermissions.length > 0) {
                await RolePermission.insertMany(rolePermissions);
            }

            // 4) Réponse
            res.status(201).json({
                perm,
                roles_linked: rolePermissions.length,
            });
        } catch (e) {
            console.error(e);
            res.status(400).json({ message: e.message });
        }
    }
);

/* PUT /api/permissions/update/:id
req.body = {
  categorie: String,   // requis
  description: String, // requis|default=""
  name: String,        // requis, unique
  value: String        // requis, unique (ex: "users.create")
}

*/
/**
 * @openapi
 * /api/permissions/update/{id}:
 *   put:
 *     tags: [Permissions]
 *     summary: Mettre à jour une permission
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
 *           schema: { $ref: '#/components/schemas/PermissionUpdateRequest' }
 *     responses:
 *       200:
 *         description: Permission mise à jour
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Permission' }
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
 *         description: Accès refusé (permission permissions.update)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       404:
 *         description: Permission introuvable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
router.put("/update/:id", auth, requirePermission("permissions.update"), async (req, res) => {
    try {
        const perm = await Permission.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        if (!perm) {
            return res.status(404).json({ message: "Permission introuvable" });
        }

        res.json(perm);
    } catch (e) {
        console.error(e);
        res.status(400).json({ message: e.message });
    }
});

// DELETE /api/permissions/delete/:id
/**
 * @openapi
 * /api/permissions/delete/{id}:
 *   delete:
 *     tags: [Permissions]
 *     summary: Supprimer une permission (+ suppression des RolePermission associés)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Permission supprimée
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
 *         description: Permission introuvable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
router.delete("/delete/:id", auth, requirePermission("superadmin"), async (req, res) => {
    try {
        const perm = await Permission.findByIdAndDelete(req.params.id);

        if (!perm) {
            return res.status(404).json({ message: "Permission introuvable" });
        }

        await RolePermission.deleteMany({ permission_id: perm._id });

        res.json({ message: "Permission supprimée", id: perm._id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Erreur serveur lors de la suppression de la permission" });
    }
});
