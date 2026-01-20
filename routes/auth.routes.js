const { Router } = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User.js");

const router = Router();

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
