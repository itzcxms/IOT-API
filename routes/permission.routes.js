const { Router } = require("express");
const Permission = require("../models/Permission.js");
const RolePermission = require("../models/RolePermission.js");
const Role = require("../models/Role");
const auth = require("../middleware/auth.js");
const requirePermission = require("../middleware/requirePermission.js");

const router = Router();
module.exports = router;

// GET /api/permissions/all
router.get("/all", async (req, res) => {
    try {
        const permissions = await Permission.find().sort({ createdAt: -1 });
        res.json(permissions);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des permissions" });
    }
});

// GET /api/permissions/:id
router.get("/:id", auth, requirePermission("permissions.view"), async (req, res) => {
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
router.post(
    "/create",
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
router.put("/update/:id", async (req, res) => {
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
router.delete("/delete/:id", auth, requirePermission("permissions.delete"), async (req, res) => {
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
