import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Role from "../models/Role.js";

const router = Router();

router.post("/register", async (req, res) => {
    try {
        const { nom, prenom, email, password, role_id } = req.body;

        if (!nom || !prenom || !email || !password) {
            return res.status(400).json({ message: "Champs requis manquants" });
        }

        const exists = await User.findOne({ email });
        if (exists) return res.status(409).json({ message: "Email déjà utilisé" });

        let role;
        if (role_id) {
            role = await Role.findById(role_id);
        } else {
            role = await Role.findOne({ name: "utilisateur" }) || await Role.findOne();
        }

        if (!role) return res.status(400).json({ message: "Aucun rôle disponible" });

        const hash = await bcrypt.hash(password, process.env.SALT);

        const user = await User.create({
            nom, prenom, email, password: hash, role_id: role._id, actif: true
        });

        res.status(201).json({
            id: user._id, nom, prenom, email, role_id: role._id, actif: true
        });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

/**
 * POST /api/auth/login
 * body: { email, password }
 */
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email }).populate("role_id");
        if (!user || !user.actif) {
            return res.status(401).json({ message: "Identifiants invalides" });
        }

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ message: "Identifiants invalides" });

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
        );

        res.json({
            token,
            user: {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                role: user.role_id
            }
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

export default router;
