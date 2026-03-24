const { Router } = require("express");
const auth = require("../middleware/auth.js");
const Questionnaire = require("../models/Questionnaire");

const router = Router();
module.exports = router;

// --------------------
// Helpers (à mettre une seule fois en haut du fichier)
// --------------------
const satisfactionLevels = ["tres-satisfaisant", "satisfaisant", "peu-satisfaisant"];

function parseDateOrNull(v) {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDaysUTC(d, days) {
    return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

function startOfMonthUTC(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfYearUTC(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

function countValuesWithZeros(arr) {
    const base = Object.fromEntries(satisfactionLevels.map((k) => [k, 0]));
    (arr || []).forEach((val) => {
        if (base[val] !== undefined) base[val]++;
    });
    return base;
}

async function computeStats({ startDate = null, endDate = null, byPeriodMode = null }) {
    const matchStage = {};
    if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = startDate;
        if (endDate) matchStage.createdAt.$lte = endDate;
    }

    const pipeline = [
        { $match: matchStage },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                satisfactionAire: { $push: "$satisfactionAire" },
                satisfactionSecurite: { $push: "$satisfactionSecurite" },
                satisfactionServices: { $push: "$satisfactionServices" },
                sourcesConnaissance: { $push: "$sourcesConnaissance" }, // AJOUT ICI
            },
        },
        {
            $project: {
                _id: 0,
                total: 1,
                satisfactionAire: 1,
                satisfactionSecurite: 1,
                satisfactionServices: 1,
                sourcesConnaissance: 1 // AJOUT ICI
            }
        },
    ];

    const [summary] = await Questionnaire.aggregate(pipeline);

    const safe = summary || {
        total: 0,
        satisfactionAire: [],
        satisfactionSecurite: [],
        satisfactionServices: [],
        sourcesConnaissance: [], // AJOUT ICI
    };

    const distributions = {
        satisfactionAire: countValuesWithZeros(safe.satisfactionAire),
        satisfactionSecurite: countValuesWithZeros(safe.satisfactionSecurite),
        satisfactionServices: countValuesWithZeros(safe.satisfactionServices)
    };

    // Comptage des sources de connaissance (avec aplatissement du tableau)
    const flatSources = safe.sourcesConnaissance.flat();
    const sourcesCount = {};
    flatSources.forEach(source => {
        sourcesCount[source] = (sourcesCount[source] || 0) + 1;
    });

    let byPeriod = [];
    if (byPeriodMode && startDate) {
        if (byPeriodMode === "day") {
            byPeriod = [{ date: startDate, count: safe.total }];
        } else if (byPeriodMode === "week") {
            byPeriod = [{ date: startDate, end: endDate, count: safe.total }];
        } else if (byPeriodMode === "month") {
            byPeriod = [{ date: startDate, count: safe.total }];
        } else if (byPeriodMode === "year") {
            byPeriod = [{ date: startDate, count: safe.total }];
        }
    }

    return {
        total: safe.total || 0,
        distributions,
        sourcesConnaissance: sourcesCount,
        byPeriod,
    };
}

// --------------------
// ROUTE 1 : ALL (pas de start/end)
// GET /api/questionnaires/stats/all
// --------------------
/**
 * @openapi
 * /api/questionnaires/stats/all:
 *   get:
 *     tags: [Questionnaires]
 *     summary: Statistiques globales (tous les questionnaires)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats globales
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 */
router.get("/stats/all", auth, async (req, res) => {
    try {
        const stats = await computeStats({ startDate: null, endDate: null, byPeriodMode: null });

        return res.json({
            filters: { view: "all" },
            ...stats,
        });
    } catch (error) {
        return res.status(500).json({ message: "Erreur serveur", error: error.message });
    }
});

// --------------------
// ROUTE 2 : DAY
// POST /api/questionnaires/stats/day
// Body: { date: "YYYY-MM-DD" }
// --------------------
/**
 * @openapi
 * /api/questionnaires/stats/day:
 *   post:
 *     tags: [Questionnaires]
 *     summary: Statistiques sur une journée
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date]
 *             properties:
 *               date: { type: string, example: "2026-01-22" }
 *     responses:
 *       200:
 *         description: Stats du jour
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *       400:
 *         description: Date invalide
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
router.post("/stats/day", auth, async (req, res) => {
    try {
        const raw = parseDateOrNull(req.body?.date);
        if (!raw) return res.status(400).json({ message: "Paramètre date invalide (YYYY-MM-DD)" });

        const start = startOfDay(raw);
        const end = addDaysUTC(start, 1);

        const stats = await computeStats({ startDate: start, endDate: end, byPeriodMode: "day" });

        return res.json({
            filters: { view: "day", date: start.toISOString() },
            ...stats,
        });
    } catch (error) {
        return res.status(500).json({ message: "Erreur serveur", error: error.message });
    }
});

// --------------------
// ROUTE 3 : WEEK
// POST /api/questionnaires/stats/week
// Body: { date: "YYYY-MM-DD" }  => start = -7 jours
// --------------------
/**
 * @openapi
 * /api/questionnaires/stats/week:
 *   post:
 *     tags: [Questionnaires]
 *     summary: Statistiques sur 7 jours à partir d'une date
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date]
 *             properties:
 *               date: { type: string, example: "2026-01-22" }
 *     responses:
 *       200:
 *         description: Stats de la semaine
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *       400:
 *         description: Date invalide
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
router.post("/stats/week", auth, async (req, res) => {
    try {
        const raw = parseDateOrNull(req.body?.date);
        if (!raw) return res.status(400).json({ message: "Paramètre date invalide (YYYY-MM-DD)" });

        const end = startOfDay(raw);
        const start = addDaysUTC(end, -7);

        const stats = await computeStats({ startDate: start, endDate: end, byPeriodMode: "week" });

        return res.json({
            filters: { view: "week", date: start.toISOString(), end: end.toISOString() },
            ...stats,
        });
    } catch (error) {
        return res.status(500).json({ message: "Erreur serveur", error: error.message });
    }
});

// --------------------
// ROUTE 4 : MONTH
// POST /api/questionnaires/stats/month
// Body: { date: "YYYY-MM-DD" } => mois/année du jour fourni
// --------------------
/**
 * @openapi
 * /api/questionnaires/stats/month:
 *   post:
 *     tags: [Questionnaires]
 *     summary: Statistiques sur un mois (mois de la date fournie)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date]
 *             properties:
 *               date: { type: string, example: "2026-01-22" }
 *     responses:
 *       200:
 *         description: Stats mensuelles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *       400:
 *         description: Date invalide
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
router.post("/stats/month",auth, async (req, res) => {
    try {
        const raw = parseDateOrNull(req.body?.date);
        if (!raw) return res.status(400).json({ message: "Paramètre date invalide (YYYY-MM-DD)" });

        const start = startOfMonthUTC(raw);
        const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

        const stats = await computeStats({ startDate: start, endDate: end, byPeriodMode: "month" });

        return res.json({
            filters: { view: "month", date: start.toISOString() },
            ...stats,
        });
    } catch (error) {
        return res.status(500).json({ message: "Erreur serveur", error: error.message });
    }
});

// --------------------
// POST /api/questionnaires/stats/year
// Body: { date: "YYYY" } => année du jour fourni
// --------------------
/**
 * @openapi
 * /api/questionnaires/stats/year:
 *   post:
 *     tags: [Questionnaires]
 *     summary: Statistiques sur une année (année de la date fournie)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date]
 *             properties:
 *               date: { type: string, example: "2026-01-01" }
 *     responses:
 *       200:
 *         description: Stats annuelles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *       400:
 *         description: Date invalide
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
router.post("/stats/year", auth, async (req, res) => {
    try {
        const raw = parseDateOrNull(req.body?.date);
        if (!raw) return res.status(400).json({ message: "Paramètre date invalide (YYYY-MM-DD)" });

        const start = startOfYearUTC(raw);
        const end = new Date(Date.UTC(start.getUTCFullYear() + 1, 0, 1));

        const stats = await computeStats({ startDate: start, endDate: end, byPeriodMode: "year" });

        return res.json({
            filters: { view: "years", date: start.toISOString() },
            ...stats,
        });
    } catch (error) {
        return res.status(500).json({ message: "Erreur serveur", error: error.message });
    }
});

/**
 * POST /api/questionnaires
 * Body :
 * {
 *  satisfactionAire,
 *  satisfactionSecurite,
 *  satisfactionServices,
 *  sourcesConnaissance,
 *  autreSource,
 *  remarques
 * }
 */
/**
 * @openapi
 * /api/questionnaires:
 *   post:
 *     tags: [Questionnaires]
 *     summary: Créer un questionnaire
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/QuestionnaireCreateRequest' }
 *     responses:
 *       201:
 *         description: Questionnaire enregistré
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/Questionnaire' }
 *       400:
 *         description: Validation échouée
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
router.post("/", async (req, res) => {
    try {
        const {
            satisfactionAire,
            satisfactionSecurite,
            satisfactionServices,
            sourcesConnaissance,
            autreSource,
            remarques,
        } = req.body;

        // Validation minimale (en plus des enums/required Mongoose)
        if (!satisfactionAire || !satisfactionSecurite || !satisfactionServices) {
            return res.status(400).json({
                message:
                    "Champs requis manquants: satisfactionAire, satisfactionSecurite, satisfactionServices",
            });
        }

        // Sécuriser le type du tableau
        const safeSources = Array.isArray(sourcesConnaissance)
            ? sourcesConnaissance
            : [];

        const enquete = await Questionnaire.create({
            satisfactionAire,
            satisfactionSecurite,
            satisfactionServices,
            sourcesConnaissance: safeSources,
            autreSource: autreSource ?? "",
            remarques: remarques ?? "",
        });

        return res.status(201).json({
            message: "Enquête enregistrée avec succès",
            data: enquete,
        });
    } catch (err) {
        // Erreurs de validation Mongoose (enum/required)
        if (err?.name === "ValidationError") {
            return res.status(400).json({
                message: "Validation échouée",
                details: err.errors,
            });
        }

        return res.status(500).json({
            message: "Erreur serveur",
            error: err?.message ?? "Unknown error",
        });
    }
});

// --------------------
// ROUTE : Nombre de formulaires envoyés sur les 7 derniers jours
// GET /api/questionnaires/stats/last7days
// --------------------
/**
 * @openapi
 * /api/questionnaires/stats/last7days:
 *   get:
 *     tags: [Questionnaires]
 *     summary: Nombre total de formulaires envoyés sur les 7 derniers jours
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Total des formulaires sur les 7 derniers jours
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total: { type: integer }
 *                 from: { type: string }
 *                 to: { type: string }
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
router.get("/stats/last7days", auth, async (req, res) => {
    try {
        const now = new Date();
        const end = addDaysUTC(startOfDay(now), 1); // minuit demain → inclut toute la journée d'aujourd'hui
        const start = addDaysUTC(end, -8);

        const total = await Questionnaire.countDocuments({
            createdAt: { $gte: start, $lt: end },
        });

        return res.json({
            total,
            from: start.toISOString(),
            to: end.toISOString(),
        });
    } catch (error) {
        return res.status(500).json({ message: "Erreur serveur", error: error.message });
    }
});

// --------------------
// ROUTE : Récupération des commentaires + date
// GET /api/questionnaires/comments
// --------------------
/**
 * @openapi
 * /api/questionnaires/comments:
 *   get:
 *     tags: [Questionnaires]
 *     summary: Récupérer les commentaires (remarques) + date
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des commentaires
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total: { type: integer }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       remarques: { type: string }
 *                       createdAt: { type: string }
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 */
router.get("/comments", auth, async (req, res) => {
    try {
        const comments = await Questionnaire.find(
            { remarques: { $ne: "" } },           // uniquement ceux avec un commentaire
            { remarques: 1, createdAt: 1, _id: 1 } // projection des champs utiles
        ).sort({ createdAt: -1 });               // tri du plus récent au plus ancien

        return res.json({
            total: comments.length,
            data: comments
        });

    } catch (error) {
        return res.status(500).json({
            message: "Erreur serveur",
            error: error.message
        });
    }
});