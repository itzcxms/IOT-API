const { Router } = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission.js");
const Seuil = require("../models/Seuils.js");

const router = Router();
module.exports = router;

// GET - Récupérer tous les capteur_id (unique)
router.get("/capteurs", auth, async (req, res) => {
    try {
        const capteurs = await Seuil.distinct("capteur_id");
        res.json(capteurs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET - Récupérer tous les seuils
router.get("/", auth, async (req, res) => {
    try {
        const seuils = await Seuil.find().sort({ createdAt: -1 });
        res.json(seuils);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET - Récupérer les seuils de type "savon"
router.get("/savon", auth, async (req, res) => {
    try {
        const seuils = await Seuil.find({ type: "savon" }).sort({ createdAt: -1 });
        res.json(seuils);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET - Récupérer les seuils de type "eau"
router.get("/eau", auth, async (req, res) => {
    try {
        const seuils = await Seuil.find({ type: "eau" }).sort({ createdAt: -1 });
        res.json(seuils);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET - Récupérer les seuils par capteur_id (recherche partielle)
router.get("/capteur/:capteur_id", auth, async (req, res) => {
    try {
        const seuils = await Seuil.find({
            capteur_id: { $regex: req.params.capteur_id, $options: 'i' }
        }).sort({ createdAt: -1 });
        res.json(seuils);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET - Récupérer les seuils par capteur_id ET type (recherche partielle sur le capteur_id)
router.get("/capteur/:capteur_id/:type", auth, async (req, res) => {
    try {
        const seuils = await Seuil.find({
            capteur_id: { $regex: req.params.capteur_id, $options: 'i' },
            type: req.params.type
        }).sort({ createdAt: -1 });
        res.json(seuils);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET - Récupérer un seuil par ID MongoDB
router.get("/:id", auth, async (req, res) => {
    try {
        const seuil = await Seuil.findById(req.params.id);
        if (!seuil) return res.status(404).json({ message: "Seuil non trouvé" });
        res.json(seuil);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST - Créer un nouveau seuil
router.post("/", auth, requirePermission("superadmin"), async (req, res) => {
    try {
        const seuil = new Seuil(req.body);
        const nouveauSeuil = await seuil.save();
        res.status(201).json(nouveauSeuil);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// PUT - Mettre à jour un seuil
router.put("/:id", auth, async (req, res) => {
    try {
        const seuil = await Seuil.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!seuil) return res.status(404).json({ message: "Seuil non trouvé" });
        res.json(seuil);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// DELETE - Supprimer un seuil
router.delete("/:id", auth, requirePermission("superadmin"), async (req, res) => {
    try {
        const seuil = await Seuil.findByIdAndDelete(req.params.id);
        if (!seuil) return res.status(404).json({ message: "Seuil non trouvé" });
        res.json({ message: "Seuil supprimé avec succès" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});