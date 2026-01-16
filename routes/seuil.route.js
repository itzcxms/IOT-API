const { Router } = require("express");
const auth = require("../middleware/auth.js");
const requirePermission = require("../middleware/requirePermission.js");
const Seuil = require("../models/Seuils.js");

const router = Router();
module.exports = router;

// GET - Récupérer tous les noms de villes (unique)
router.get("/villes", auth, requirePermission("seuil.view"), async (req, res) => {
    try {
        const villes = await Seuil.distinct("nom");
        res.json(villes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET - Récupérer tous les seuils
router.get("/", auth, requirePermission("seuil.view"), async (req, res) => {
    try {
        const seuils = await Seuil.find().sort({ createdAt: -1 });
        res.json(seuils);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET - Récupérer les seuils de type "savon"
router.get("/savon", auth, requirePermission("seuil.view"), async (req, res) => {
    try {
        const seuils = await Seuil.find({ type: "savon" }).sort({ createdAt: -1 });
        res.json(seuils);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET - Récupérer les seuils de type "eau"
router.get("/eau", auth, requirePermission("seuil.view"), async (req, res) => {
    try {
        const seuils = await Seuil.find({ type: "eau" }).sort({ createdAt: -1 });
        res.json(seuils);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET - Récupérer les seuils par nom de ville (recherche partielle)
router.get("/ville/:nom", auth, requirePermission("seuil.view"), async (req, res) => {
    try {
        const seuils = await Seuil.find({
            nom: { $regex: req.params.nom, $options: 'i' }
        }).sort({ createdAt: -1 });
        res.json(seuils);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET - Récupérer les seuils par ville ET type (recherche partielle sur le nom)
router.get("/ville/:nom/:type", auth, requirePermission("seuil.view"), async (req, res) => {
    try {
        const seuils = await Seuil.find({
            nom: { $regex: req.params.nom, $options: 'i' },
            type: req.params.type
        }).sort({ createdAt: -1 });
        res.json(seuils);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET - Récupérer un seuil par ID
router.get("/:id", auth, requirePermission("seuil.view"), async (req, res) => {
    try {
        const seuil = await Seuil.findById(req.params.id);
        if (!seuil) return res.status(404).json({ message: "Seuil non trouvé" });
        res.json(seuil);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST - Créer un nouveau seuil
router.post("/", auth, requirePermission("seuil.create"),async (req, res) => {
    try {
        const seuil = new Seuil(req.body);
        const nouveauSeuil = await seuil.save();
        res.status(201).json(nouveauSeuil);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// PUT - Mettre à jour un seuil
router.put("/:id", auth, requirePermission("seuil.update"), async (req, res) => {
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
router.delete("/:id", auth, requirePermission("seuil.delete"), async (req, res) => {
    try {
        const seuil = await Seuil.findByIdAndDelete(req.params.id);
        if (!seuil) return res.status(404).json({ message: "Seuil non trouvé" });
        res.json({ message: "Seuil supprimé avec succès" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

