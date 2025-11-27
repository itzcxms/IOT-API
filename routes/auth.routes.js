const {Router} = require ("express");
const bcrypt = require ("bcrypt");
const jwt = require ("jsonwebtoken");
const User = require ("../models/User.js");
const Role = require ("../models/Role.js");
const requirePermission = require ("../middleware/requirePermission.js");
const auth = require("../middleware/auth.js");

const router = Router();

router.post("/register", auth, requirePermission("admin.create"), async (req, res) => {
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

        if (!role) return res.status(404).json({ message: "Aucun rôle disponible" });

        const hash = await bcrypt.hash(password, 15);

        const user = await User.create({
            nom, prenom, email, password: hash, role_id: role._id, actif: true
        });

        res.status(201).json({"message": "L'utilisateur à bien étais crée !", "user": {
            id: user._id, nom, prenom, email, role_id: role._id, actif: true
        }});
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
            return res.status(401).json({ message: "Identifiants ou Mot de passe invalides" });
        }

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ message: "Identifiants ou Mot de passe invalides" });

        const token = jwt.sign(
            {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                role: user.role_id
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.TOKEN }
        );

        const refreshToken = jwt.sign(
            {
                id: user._id,
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.REFRESHTOKEN }
        );

        res.json({
            token, refreshToken
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

module.exports = router;
