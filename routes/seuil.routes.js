const { Router } = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission.js");
const Seuil = require("../models/Seuils.js");

const router = Router();
module.exports = router;

// GET - Récupérer tous les capteur_id (unique)
/**
 * @openapi
 * /api/seuils/capteurs:
 *   get:
 *     tags: [Seuils]
 *     summary: Récupérer tous les capteur_id uniques
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des capteurs (ids)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { type: string }
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 */
router.get("/capteurs", auth, async (req, res) => {
    try {
        const capteurs = await Seuil.distinct("capteur_id");
        res.json(capteurs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET - Récupérer tous les seuils
/**
 * @openapi
 * /api/seuils:
 *   get:
 *     tags: [Seuils]
 *     summary: Lister tous les seuils
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des seuils
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Seuil' }
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 */
router.get("/", auth, async (req, res) => {
    try {
        const seuils = await Seuil.find().sort({ createdAt: -1 });
        res.json(seuils);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET - Récupérer les seuils de type "savon"
/**
 * @openapi
 * /api/seuils/savon:
 *   get:
 *     tags: [Seuils]
 *     summary: Lister les seuils de type savon
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des seuils savon
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Seuil' }
 */
router.get("/savon", auth, async (req, res) => {
    try {
        const seuils = await Seuil.find({ type: "savon" }).sort({ createdAt: -1 });
        res.json(seuils);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET - Récupérer les seuils de type "eau"
/**
 * @openapi
 * /api/seuils/eau:
 *   get:
 *     tags: [Seuils]
 *     summary: Lister les seuils de type eau
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des seuils eau
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Seuil' }
 */
router.get("/eau", auth, async (req, res) => {
    try {
        const seuils = await Seuil.find({ type: "eau" }).sort({ createdAt: -1 });
        res.json(seuils);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET - Récupérer les seuils par capteur_id (recherche partielle)
/**
 * @openapi
 * /api/seuils/capteur/{capteur_id}:
 *   get:
 *     tags: [Seuils]
 *     summary: Rechercher des seuils par capteur_id (partial match)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: capteur_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Liste des seuils correspondants
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Seuil' }
 */
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
/**
 * @openapi
 * /api/seuils/capteur/{capteur_id}/{type}:
 *   get:
 *     tags: [Seuils]
 *     summary: Rechercher des seuils par capteur_id (partial) et type
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: capteur_id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: type
 *         required: true
 *         schema: { type: string, example: "savon" }
 *     responses:
 *       200:
 *         description: Liste des seuils correspondants
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Seuil' }
 */
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
/**
 * @openapi
 * /api/seuils/{id}:
 *   get:
 *     tags: [Seuils]
 *     summary: Récupérer un seuil par ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Seuil trouvé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Seuil' }
 *       404:
 *         description: Seuil non trouvé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
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
/**
 * @openapi
 * /api/seuils:
 *   post:
 *     tags: [Seuils]
 *     summary: Créer un seuil
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SeuilCreateRequest' }
 *     responses:
 *       201:
 *         description: Seuil créé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Seuil' }
 *       400:
 *         description: Requête invalide
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       403:
 *         description: Accès refusé (permission superadmin)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
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
/**
 * @openapi
 * /api/seuils/{id}:
 *   put:
 *     tags: [Seuils]
 *     summary: Mettre à jour un seuil
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
 *           schema: { $ref: '#/components/schemas/SeuilUpdateRequest' }
 *     responses:
 *       200:
 *         description: Seuil mis à jour
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Seuil' }
 *       400:
 *         description: Requête invalide
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       404:
 *         description: Seuil non trouvé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
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
/**
 * @openapi
 * /api/seuils/{id}:
 *   delete:
 *     tags: [Seuils]
 *     summary: Supprimer un seuil
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Seuil supprimé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       404:
 *         description: Seuil non trouvé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       403:
 *         description: Accès refusé (permission superadmin)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
router.delete("/:id", auth, requirePermission("superadmin"), async (req, res) => {
    try {
        const seuil = await Seuil.findByIdAndDelete(req.params.id);
        if (!seuil) return res.status(404).json({ message: "Seuil non trouvé" });
        res.json({ message: "Seuil supprimé avec succès" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});