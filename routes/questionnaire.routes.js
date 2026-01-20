const { Router } = require("express");
const requirePermission = require("../middleware/requirePermission.js");
const auth = require("../middleware/auth.js");
const Questionnaire = require("../models/Questionnaire");

const router = Router();
module.exports = router;

// --------------------
// Helpers (à mettre une seule fois en haut du fichier)
// --------------------
const satisfactionLevels = ["mauvais", "passable", "bon", "excellent"];

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
    // byPeriodMode: null | "day" | "week" | "month" | "year"
    // Pour les routes filtrées, on renvoie un byPeriod “1 point” sur la période.

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
            },
        },
        { $project: { _id: 0, total: 1, satisfactionAire: 1, satisfactionSecurite: 1, satisfactionServices: 1 } },
    ];

    const [summary] = await Questionnaire.aggregate(pipeline);

    const safe = summary || {
        total: 0,
        satisfactionAire: [],
        satisfactionSecurite: [],
        satisfactionServices: [],
    };

    const distributions = {
        satisfactionAire: countValuesWithZeros(safe.satisfactionAire),
        satisfactionSecurite: countValuesWithZeros(safe.satisfactionSecurite),
        satisfactionServices: countValuesWithZeros(safe.satisfactionServices),
    };

    // byPeriod : format demandé
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
        byPeriod,
    };
}

// --------------------
// ROUTE 1 : ALL (pas de start/end)
// GET /api/questionnaires/stats/all
// --------------------
router.get("/stats/all", async (req, res) => {
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
router.post("/stats/day", async (req, res) => {
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
// Body: { date: "YYYY-MM-DD" }  => end = +7 jours
// --------------------
router.post("/stats/week", async (req, res) => {
    try {
        const raw = parseDateOrNull(req.body?.date);
        if (!raw) return res.status(400).json({ message: "Paramètre date invalide (YYYY-MM-DD)" });

        const start = startOfDay(raw);
        const end = addDaysUTC(start, 7);

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
router.post("/stats/month", async (req, res) => {
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
router.post("/stats/year", async (req, res) => {
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
router.post("/",
    // auth,
    // requirePermission(""),
    async (req, res) => {
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
// ROUTE : Récupération des commentaires + date
// GET /api/questionnaires/comments
// --------------------
router.get("/comments", async (req, res) => {
    try {
        const comments = await Questionnaire.find(
            { remarques: { $ne: "" } },           // uniquement ceux avec un commentaire
            { remarques: 1, createdAt: 1, _id: 0 } // projection des champs utiles
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