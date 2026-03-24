const { Router } = require("express");
const Savon = require("../models/Savon");
const Presence = require("../models/Presence");
const auth = require("../middleware/auth");

const router = Router();
module.exports = router;

// GET - Récupérer tous les distributeurs de savon
/**
 * @openapi
 * /api/savon:
 *   get:
 *     tags: [Savon]
 *     summary: Lister tous les distributeurs de savon
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des distributeurs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Savon' }
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 */
router.get("/", async (req, res) => {
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
//             ? presence.uplink_message.decoded_payload.entrees - savon.dernierRemplissage.compteurPassages
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
/**
 * @openapi
 * /api/savon:
 *   post:
 *     tags: [Savon]
 *     summary: Créer un distributeur de savon
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SavonCreateRequest' }
 *     responses:
 *       201:
 *         description: Distributeur créé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Savon' }
 *       400:
 *         description: Requête invalide
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 */
router.post("/", auth, async (req, res) => {
    try {
        const { contenance, name, seuils, consommationParPassage } = req.body;

        if (!contenance || !name || !seuils?.alert) {
            return res.status(400).json({
                message: "Champs requis manquants : contenance, name, seuils.alert",
            });
        }

        // Récupérer le compteur actuel de présence
        const presence = await Presence.findOne().sort({ createdAt: -1 });
        const compteurActuel = presence ? presence.uplink_message.decoded_payload.entrees : 0;

        const savon = new Savon({
            contenance,
            seuils: {
                actuel: contenance, // Au début, plein
                alert: seuils.alert,
            },
            name,
            dernierRemplissage: {
                date: new Date(),
                compteurPassages: compteurActuel,
            },
            consommationParPassage: consommationParPassage || 1.5,
        });

        const nouveauSavon = await savon.save();
        res.status(201).json(nouveauSavon);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// PUT - Mettre à jour un distributeur
/**
 * @openapi
 * /api/savon/{id}:
 *   put:
 *     tags: [Savon]
 *     summary: Mettre à jour un distributeur
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
 *           schema: { $ref: '#/components/schemas/SavonUpdateRequest' }
 *     responses:
 *       200:
 *         description: Distributeur mis à jour
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Savon' }
 *       400:
 *         description: Requête invalide
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 *       404:
 *         description: Distributeur non trouvé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
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
/**
 * @openapi
 * /api/savon/{id}/remplissage:
 *   post:
 *     tags: [Savon]
 *     summary: Marquer un remplissage (reset seuil actuel et compteur)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Remplissage effectué
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 savon: { $ref: '#/components/schemas/Savon' }
 *       400:
 *         description: Requête invalide
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 *       404:
 *         description: Distributeur non trouvé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
router.post("/:id/remplissage", async (req, res) => {
    try {
        const savon = await Savon.findById(req.params.id);
        if (!savon) {
            return res.status(404).json({ message: "Distributeur non trouvé" });
        }

        // Récupérer le compteur actuel de présence
        const presence = await Presence.findOne().sort({ createdAt: -1 });
        const compteurActuel = presence ? presence.uplink_message.decoded_payload.entrees : 0;

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
/**
 * @openapi
 * /api/savon/{id}:
 *   delete:
 *     tags: [Savon]
 *     summary: Supprimer un distributeur
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Distributeur supprimé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 *       404:
 *         description: Distributeur non trouvé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
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
/**
 * @openapi
 * /api/savon/{id}/check-alert:
 *   get:
 *     tags: [Savon]
 *     summary: Vérifier si une alerte doit être envoyée (seuil alert)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Statut d'alerte + estimation
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SavonCheckAlertResponse' }
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 *       404:
 *         description: Distributeur non trouvé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
router.get("/:id/check-alert", auth, async (req, res) => {
    try {
        const savon = await Savon.findById(req.params.id);
        if (!savon) {
            return res.status(404).json({ message: "Distributeur non trouvé" });
        }

        const presence = await Presence.findOne().sort({ createdAt: -1 });
        const passages = presence
            ? presence.uplink_message.decoded_payload.entrees - savon.dernierRemplissage.compteurPassages
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