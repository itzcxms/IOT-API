const { Router } = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User.js");
const Role = require("../models/Role.js");
const auth = require("../middleware/auth.js");
const requirePermission = require("../middleware/requirePermission.js");

const router = Router();
module.exports = router;

// GET /api/users/all
router.get("/all", auth, requirePermission("users.view"), async (req, res) => {
    try {
        const users = await User.aggregate([
            {
                $lookup: {
                    from: "roles",
                    localField: "role_id",
                    foreignField: "_id",
                    as: "role",
                },
            },
            { $unwind: "$role" },

            // Exclut le super admin (poids 1000)
            { $match: { "role.poids": { $lt: 1000 } } },

            // Tri par poids du rôle puis par date de création
            { $sort: { "role.poids": -1, createdAt: -1 } },

            // Retire le password
            { $project: { password: 0 } },
        ]);

        res.json(users);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des utilisateurs" });
    }
});

/**
 * POST /api/auth/register
 * body: { nom, prenom, email, password, role_id? }
 * -> Route réservée à un admin pour créer un utilisateur.
 */
router.post(
    "/create",
    auth,
    requirePermission("users.create"), // au lieu de "admin.create"
    async (req, res) => {
        try {
            const { nom, prenom, email, password, role_id } = req.body;

            if (!nom || !prenom || !email || !password) {
                return res.status(400).json({ message: "Champs requis manquants" });
            }

            const exists = await User.findOne({ email });
            if (exists) {
                return res.status(409).json({ message: "Email déjà utilisé" });
            }

            let role;
            if (role_id) {
                role = await Role.findById(role_id);
            } else {
                role =
                    (await Role.findOne({ name: "utilisateur" })) ||
                    (await Role.findOne());
            }

            if (!role) {
                return res.status(404).json({ message: "Aucun rôle disponible" });
            }

            // 10 ou 12 est généralement suffisant, mais garde 15 si tu le souhaites
            const hash = await bcrypt.hash(password, 10);

            const user = await User.create({
                nom,
                prenom,
                email,
                password: hash,
                role_id: role._id,
                actif: true,
            });

            res.status(201).json({
                message: "L'utilisateur a bien été créé !",
                user: {
                    id: user._id,
                    nom,
                    prenom,
                    email,
                    role_id: role._id,
                    actif: true,
                },
            });
        } catch (e) {
            console.error(e);
            res
                .status(500)
                .json({ message: "Erreur serveur lors de la création de l'utilisateur" });
        }
    }
);

// GET /api/users/view/:id
router.get("/view/:id", auth, requirePermission("users.view"), async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select("-password")
            .populate("role_id");

        if (!user) {
            return res.status(404).json({ message: "Utilisateur introuvable" });
        }

        res.json(user);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Erreur serveur lors de la récupération de l'utilisateur" });
    }
});

// // POST /api/users/create
// router.post("/create", auth, requirePermission("users.create"), async (req, res) => {
//     try {
//         const { nom, prenom, email, password, role_id, actif } = req.body;
//
//         const role = await Role.findById(role_id);
//         if (!role) {
//             return res.status(400).json({ message: "Rôle invalide" });
//         }
//
//         const exists = await User.findOne({ email });
//         if (exists) {
//             return res.status(409).json({ message: "Email déjà utilisé" });
//         }
//
//         const hash = await bcrypt.hash(password, 10);
//
//         const user = await User.create({
//             nom,
//             prenom,
//             email,
//             password: hash,
//             role_id,
//             actif: actif ?? true,
//         });
//
//         const userObj = user.toObject();
//         delete userObj.password;
//
//         res.status(201).json(userObj);
//     } catch (e) {
//         console.error(e);
//         res.status(400).json({ message: e.message });
//     }
// });

// PUT /api/users/update/:id
router.put("/update/:id", auth, requirePermission("users.update"),  async (req, res) => {
    try {
        const data = req.body;

        // Si on veut changer de rôle, vérifier que le rôle existe
        if (data.role_id) {
            const role = await Role.findById(data.role_id);
            if (!role) {
                return res.status(400).json({ message: "Rôle invalide" });
            }
        }

        if (data.password) {
            data.password = await bcrypt.hash(data.password, 10);
        }

        const user = await User.findByIdAndUpdate(req.params.id, data, {
            new: true,
            runValidators: true,
        })
            .select("-password")
            .populate("role_id");

        if (!user) {
            return res.status(404).json({ message: "Utilisateur introuvable" });
        }

        res.json(user);
    } catch (e) {
        console.error(e);
        res.status(400).json({ message: e.message });
    }
});

// DELETE /api/users/delete/:id
router.delete("/delete/:id", auth, requirePermission("users.delete"), async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json({ message: "Utilisateur introuvable" });
        }

        res.json({ message: "Supprimé", id: user._id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Erreur serveur lors de la suppression de l'utilisateur" });
    }
});