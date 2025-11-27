const { Router } = require( "express");
const bcrypt = require( "bcrypt");
const User = require( "../models/User.js");
const Role = require( "../models/Role.js");
const auth = require( "../middleware/auth.js");
const requirePermission = require( "../middleware/requirePermission.js");

const router = Router();
module.exports = router;

// GET /api/users
router.get("/all", auth, requirePermission("users.view"), async (req, res) => {
    const users = await User.find()
        .select("-password")
        .populate("role_id")
        .sort({ createdAt: -1 });
    res.json(users);
});

// GET /api/users/:id
router.get("/view/user/:id", auth, requirePermission("users.view"), async (req, res) => {
    const user = await User.findById(req.params.id)
        .select("-password")
        .populate("role_id");

    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
    res.json(user);
});

// POST /api/users
router.post("/create", auth, requirePermission("users.create"), async (req, res) => {
    try {
        const { nom, prenom, email, password, role_id, actif } = req.body;

        const role = await Role.findById(role_id);
        if (!role) return res.status(400).json({ message: "Rôle invalide" });

        const exists = await User.findOne({ email });
        if (exists) return res.status(409).json({ message: "Email déjà utilisé" });

        const hash = await bcrypt.hash(password, 10);

        const user = await User.create({
            nom, prenom, email, password: hash, role_id, actif: actif ?? true
        });

        res.status(201).json({ ...user.toObject(), password: undefined });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

// PUT /api/users/:id
router.put("/update/user/:id", auth, requirePermission("users.update"), async (req, res) => {
    try {
        const data = { ...req.body };

        if (data.password) {
            data.password = await bcrypt.hash(data.password, 10);
        }

        const user = await User.findByIdAndUpdate(req.params.id, data, {
            new: true, runValidators: true
        }).select("-password").populate("role_id");

        if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
        res.json(user);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

// DELETE /api/users/:id
router.delete("/delete/user/:id", auth, requirePermission("users.delete"), async (req, res) => {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
    res.json({ message: "Supprimé", id: user._id });
});

