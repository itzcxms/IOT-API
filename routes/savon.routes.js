const { Router } = require("express");
const Savon = require("../models/Savon");
const Presence = require("../models/Presence");
const auth = require("../middleware/auth");

const router = Router();
module.exports = router;

// GET - Récupérer tous les distributeurs de savon
router.get("/", auth, async (req, res) => {
    try {
        const savons = await Savon.find();
        res.json(savons);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// // GET - Récupérer un distributeur avec les données calculées
// router.get("/:id", auth, async (req, res) => {
//     try {
//         const savon = await Savon.findById(req.params.id);
//         if (!savon) {
//             return res.status(404).json({ message: "Distributeur non trouvé" });
//         }
//
//         // Récupérer les données du capteur de présence
//         const presence = await Presence.findOne().sort({ createdAt: -1 });
//
//         // Calculer le nombre de passages depuis le dernier remplissage
//         const passages = presence
//             ? presence.line_1_total_in - savon.dernierRemplissage.compteurPassages
//             : 0;
//
//         // Calculer la contenance estimée actuelle
//         const contenanceEstimee = Math.max(
//             0,
//             savon.contenance - (passages * savon.consommationParPassage)
//         );
//
//         // Mettre à jour le seuil actuel
//         savon.seuils.actuel = contenanceEstimee;
//         await savon.save();
//
//         res.json({
//             ...savon.toObject(),
//             passages,
//             contenanceEstimee
//         });
//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// });

// POST - Créer un nouveau distributeur de savon
router.post("/", auth, async (req, res) => {
    try {
        // Récupérer le compteur actuel de présence
        const presence = await Presence.findOne().sort({ createdAt: -1 });
        const compteurActuel = presence ? presence.line_1_total_in : 0;

        const savon = new Savon({
            contenance: req.body.contenance,
            seuils: {
                actuel: req.body.contenance, // Au début, plein
                alert: req.body.seuils.alert
            },
            name: req.body.name,
            dernierRemplissage: {
                date: new Date(),
                compteurPassages: compteurActuel
            },
            consommationParPassage: req.body.consommationParPassage || 1.5
        });

        const nouveauSavon = await savon.save();
        res.status(201).json(nouveauSavon);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// PUT - Mettre à jour un distributeur
router.put("/:id", auth, async (req, res) => {
    try {
        const savon = await Savon.findById(req.params.id);
        if (!savon) {
            return res.status(404).json({ message: "Distributeur non trouvé" });
        }

        if (req.body.contenance) savon.contenance = req.body.contenance;
        if (req.body.seuils) {
            if (req.body.seuils.alert) savon.seuils.alert = req.body.seuils.alert;
        }
        if (req.body.name) savon.name = req.body.name;
        if (req.body.consommationParPassage) {
            savon.consommationParPassage = req.body.consommationParPassage;
        }

        const savonMisAJour = await savon.save();
        res.json(savonMisAJour);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// POST - Marquer un remplissage
router.post("/:id/remplissage", auth, async (req, res) => {
    try {
        const savon = await Savon.findById(req.params.id);
        if (!savon) {
            return res.status(404).json({ message: "Distributeur non trouvé" });
        }

        // Récupérer le compteur actuel de présence
        const presence = await Presence.findOne().sort({ createdAt: -1 });
        const compteurActuel = presence ? presence.line_1_total_in : 0;

        // Réinitialiser le distributeur
        savon.seuils.actuel = savon.contenance; // Plein
        savon.dernierRemplissage = {
            date: new Date(),
            compteurPassages: compteurActuel
        };

        const savonMisAJour = await savon.save();
        res.json({
            message: "Remplissage effectué avec succès",
            savon: savonMisAJour
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// DELETE - Supprimer un distributeur
router.delete("/:id", auth, async (req, res) => {
    try {
        const savon = await Savon.findById(req.params.id);
        if (!savon) {
            return res.status(404).json({ message: "Distributeur non trouvé" });
        }

        await savon.deleteOne();
        res.json({ message: "Distributeur supprimé avec succès" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET - Vérifier si une alerte doit être envoyée
router.get("/:id/check-alert", auth, async (req, res) => {
    try {
        const savon = await Savon.findById(req.params.id);
        if (!savon) {
            return res.status(404).json({ message: "Distributeur non trouvé" });
        }

        const presence = await Presence.findOne().sort({ createdAt: -1 });
        const passages = presence
            ? presence.line_1_total_in - savon.dernierRemplissage.compteurPassages
            : 0;

        const contenanceEstimee = Math.max(
            0,
            savon.contenance - (passages * savon.consommationParPassage)
        );

        const alerteNecessaire = contenanceEstimee <= savon.seuils.alert;

        res.json({
            alerteNecessaire,
            contenanceEstimee,
            seuilAlert: savon.seuils.alert,
            passages
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
