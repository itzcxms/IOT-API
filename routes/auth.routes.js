const { Router } = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User.js");
const Role = require("../models/Role.js");
const requirePermission = require("../middleware/requirePermission.js");
const auth = require("../middleware/auth.js");

const router = Router();

/**
 * POST /api/auth/register
 * body: { nom, prenom, email, password, role_id? }
 * -> Route réservée à un admin pour créer un utilisateur.
 */
router.post(
    "/register",
    auth,
    requirePermission("admin.register"), // au lieu de "admin.create"
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

/**
 * POST /api/auth/login
 * body: { email, password }
 */
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email }).populate("role_id");
        if (!user) {
            return res
                .status(401)
                .json({ message: "Identifiants ou mot de passe invalides" });
        }

        if(!user.actif) {
            return res.status(401).json({message: "Votre compte à été suspendu."})
        }

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
            return res
                .status(401)
                .json({ message: "Identifiants ou mot de passe invalides" });
        }

        // Payload minimal : on stocke l'id du rôle
        const payload = {
            id: user._id.toString(),
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            role_id: user.role_id?._id?.toString(),
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.TOKEN || "15m",
        });

        const refreshToken = jwt.sign(
            { id: user._id.toString() },
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
            {
                expiresIn: process.env.REFRESHTOKEN || "7d",
            }
        );

        res.status(200).json({
            token,
            refreshToken,
            user: {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                role: user.role_id,
            },
        });
    } catch (e) {
        console.error(e);
        res
            .status(500)
            .json({ message: "Erreur serveur lors de la connexion" });
    }
});

module.exports = router;
