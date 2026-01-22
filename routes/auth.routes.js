const { Router } = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User.js");

const router = Router();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Connexion utilisateur
 *     description: Authentifie un utilisateur via email/mot de passe et renvoie un token + refreshToken.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             exemple:
 *               value:
 *                 email: "john.doe@mail.com"
 *                 password: "MonMotDePasse!"
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginSuccess'
 *             examples:
 *               ok:
 *                 value:
 *                   token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                   refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                   user:
 *                     id: "66b1f8d2c9d1a1b2c3d4e5f6"
 *                     nom: "Doe"
 *                     prenom: "John"
 *                     email: "john.doe@mail.com"
 *                     role:
 *                       _id: "66b1f8d2c9d1a1b2c3d4e5f7"
 *                       nom: "admin"
 *       401:
 *         description: Identifiants invalides ou compte suspendu
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               invalid:
 *                 value:
 *                   message: "Identifiants ou mot de passe invalides"
 *               suspended:
 *                 value:
 *                   message: "Votre compte à été suspendu."
 *       500:
 *         description: Erreur serveur lors de la connexion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               server:
 *                 value:
 *                   message: "Erreur serveur lors de la connexion"
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
            role: user.role_id,
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
