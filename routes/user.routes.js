const { Router } = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User.js");
const Role = require("../models/Role.js");
const auth = require("../middleware/auth.js");
const requirePermission = require("../middleware/requirePermission.js");

const router = Router();
module.exports = router;

// GET /api/users/me
/**
 * @openapi
 * /api/users/me:
 *   get:
 *     tags: [Users]
 *     summary: Profil de l'utilisateur connecté
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil utilisateur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Token manquant/invalide
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       403:
 *         description: Compte inactif
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 */
router.get("/me", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select("-password -passwordHash -__v") // adaptez selon votre modèle
            .populate("role_id");

        if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

        return res.json(user);
    } catch (e) {
        return res.status(500).json({ message: "Erreur serveur" });
    }
});

// GET /api/users/all
/**
 * @openapi
 * /api/users/all:
 *   get:
 *     tags: [Users]
 *     summary: Liste des utilisateurs (hors superadmin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des utilisateurs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       403:
 *         description: Accès refusé (permission users.view)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 */
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
/**
 * @openapi
 * /api/users/create:
 *   post:
 *     tags: [Users]
 *     summary: Créer un utilisateur
 *     description: Route protégée (permission users.create).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserCreateRequest'
 *     responses:
 *       201:
 *         description: Utilisateur créé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 user: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: Validation échouée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       403:
 *         description: Accès refusé (permission users.create)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       409:
 *         description: Email déjà utilisé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
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
/**
 * @openapi
 * /api/users/view/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Voir un utilisateur
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Utilisateur trouvé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       403:
 *         description: Accès refusé (permission users.view)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: Utilisateur introuvable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 */
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

// PUT /api/users/update/:id
/**
 * @openapi
 * /api/users/update/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Mettre à jour un utilisateur
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
 *           schema:
 *             $ref: '#/components/schemas/UserUpdateRequest'
 *     responses:
 *       200:
 *         description: Utilisateur mis à jour
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Requête invalide (ex: rôle invalide)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       403:
 *         description: Accès refusé (permission users.update)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: Utilisateur introuvable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 */
router.put("/update/:id", auth, requirePermission("users.update"), async (req, res) => {
    try {
        const data = req.body;

        // Charger l'utilisateur existant pour comparer
        const existing = await User.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ message: "Utilisateur introuvable" });
        }

        // Si on veut changer de rôle, vérifier que le rôle existe
        let roleChanged = false;
        if (data.role_id) {
            const role = await Role.findById(data.role_id);
            if (!role) {
                return res.status(400).json({ message: "Rôle invalide" });
            }
            // Comparaison string pour éviter les soucis d'ObjectId
            roleChanged = String(existing.role_id) !== String(data.role_id);
        }

        if (data.password) {
            data.password = await bcrypt.hash(data.password, 10);
        }

        // Si rôle changé -> bump version (déclencheur front)
        if (roleChanged) {
            data.authzVersion = (existing.authzVersion || 0) + 1;
        }

        const user = await User.findByIdAndUpdate(req.params.id, data, {
            new: true,
            runValidators: true,
        })
            .select("-password")
            .populate("role_id");

        res.json(user);
    } catch (e) {
        console.error(e);
        res.status(400).json({ message: e.message });
    }
});


// DELETE /api/users/delete/:id
/**
 * @openapi
 * /api/users/delete/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Supprimer un utilisateur
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Utilisateur supprimé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       403:
 *         description: Accès refusé (permission users.delete)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: Utilisateur introuvable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 */
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