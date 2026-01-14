const { Router } = require("express");
const auth = require("../middleware/auth.js");
const Sonde = require("../models/Sondes.js");
const Toilette = require("../models/Toilette.js");
const requirePermission = require("../middleware/requirePermission");

const router = Router();
module.exports = router;

const TZ = "Europe/Paris";

const MONTHS_FR = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
];

function pad2(n) {
    return String(n).padStart(2, "0");
}

function monthLabel(monthNumber) {
    return `${pad2(monthNumber)}`;
}

function stripAccentsLower(s) {
    return String(s)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function parseMonth(moisInput) {
    if (!moisInput) return null;

    // "01".."12"
    if (/^(0[1-9]|1[0-2])$/.test(moisInput)) return Number(moisInput);

    // "1".."12"
    if (/^([1-9]|1[0-2])$/.test(moisInput)) return Number(moisInput);

    // Nom du mois FR
    const norm = stripAccentsLower(moisInput);
    const idx = MONTHS_FR.findIndex((m) => stripAccentsLower(m) === norm);
    if (idx >= 0) return idx + 1;

    return null;
}

function formatYMDInTZ(dateObj) {
    const d = new Date(dateObj);
    if (Number.isNaN(d.getTime())) return null;

    return new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(d);
}

function getYearMonthInTZ(dateObj) {
    const d = new Date(dateObj);
    const fmt = new Intl.DateTimeFormat("fr-FR", {
        timeZone: TZ,
        year: "numeric",
        month: "2-digit",
    }).formatToParts(d);

    const y = fmt.find((p) => p.type === "year")?.value;
    const m = fmt.find((p) => p.type === "month")?.value;
    return { year: y ? Number(y) : null, month: m ? Number(m) : null };
}

function resolveModel(type) {
    const t = (type || "sonde").toLowerCase();
    if (t === "toilette") return { model: Toilette, type: "toilette" };
    return { model: Sonde, type: "sonde" };
}

function buildBaseMatch(modelType, q) {
    const match = {};

    if (modelType === "sonde") {
        if (q.haut) match.haut = String(q.haut);
        if (q.type) match.type = String(q.type);
    }

    if (modelType === "toilette") {
        if (q.occupancy) match.occupancy = String(q.occupancy);
    }

    return match;
}

/**
 * GET /api/graphs/capteurs/today
 * Query:
 *  - type=sonde|toilette
 *  - date=YYYY-MM-DD (optionnel, par défaut aujourd'hui)
 *  - filtres: haut, type (sonde) / occupancy (toilette)
 *
 * Retourne: Données par heure pour la journée ciblée
 */
router.get(
    "/today",
    auth,
    requirePermission("capteurs.view"),
    async (req, res) => {
        try {
            const { model, type } = resolveModel(req.query.type);
            const baseMatch = buildBaseMatch(type, req.query);

            const now = new Date();
            const targetDay = formatYMDInTZ(req.query.date || now) || formatYMDInTZ(now);

            const data = await model.aggregate([
                { $match: baseMatch },
                {
                    $addFields: {
                        jourKey: {
                            $dateToString: {
                                date: "$createdAt",
                                format: "%Y-%m-%d",
                                timezone: TZ,
                            },
                        },
                    },
                },
                { $match: { jourKey: targetDay } },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                date: "$createdAt",
                                format: "%H",
                                timezone: TZ,
                            },
                        },
                        frequentationTmp: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        heure: "$_id",
                        frequentation: "$frequentationTmp",
                    },
                },
                { $sort: { heure: 1 } },
            ]);

            return res.json({
                date: targetDay,
                donnees: data,
            });
        } catch (e) {
            console.error(e);
            return res.status(500).json({
                message: "Erreur serveur lors de la récupération des données journalières",
            });
        }
    }
);

/**
 * GET /api/graphs/capteurs/month/all
 * Query:
 *  - type=sonde|toilette
 *  - filtres: haut, type (sonde) / occupancy (toilette)
 *
 * Retourne: Liste de tous les mois disponibles groupés par année
 */
router.get(
    "/month/all",
    auth,
    requirePermission("capteurs.view"),
    async (req, res) => {
        try {
            const { model, type } = resolveModel(req.query.type);
            const baseMatch = buildBaseMatch(type, req.query);

            const yearMonthRows = await model.aggregate([
                { $match: baseMatch },
                {
                    $project: {
                        parts: {
                            $dateToParts: {
                                date: "$createdAt",
                                timezone: TZ,
                            },
                        },
                    },
                },
                {
                    $group: {
                        _id: { year: "$parts.year", month: "$parts.month" },
                    },
                },
                { $sort: { "_id.year": 1, "_id.month": 1 } },
            ]);

            const listeMoisPossibles = {};

            for (const r of yearMonthRows) {
                const y = String(r._id.year);
                const m = Number(r._id.month);

                if (!listeMoisPossibles[y]) listeMoisPossibles[y] = [];
                listeMoisPossibles[y].push(monthLabel(m));
            }

            return res.json(listeMoisPossibles);
        } catch (e) {
            console.error(e);
            return res.status(500).json({
                message: "Erreur serveur lors de la récupération de la liste des mois",
            });
        }
    }
);

/**
 * GET /api/graphs/capteurs/month
 * Query:
 *  - type=sonde|toilette
 *  - annee=2026 (requis)
 *  - start=03 (mois de début, requis)
 *  - end=05 (mois de fin, requis)
 *  - filtres: haut, type (sonde) / occupancy (toilette)
 *
 * Retourne: Données par jour pour la plage de mois spécifiée
 */
router.get(
    "/month",
    auth,
    requirePermission("capteurs.view"),
    async (req, res) => {
        try {
            const { model, type } = resolveModel(req.query.type);
            const baseMatch = buildBaseMatch(type, req.query);

            const yearNum = Number(req.query.annee);
            if (!yearNum || Number.isNaN(yearNum)) {
                return res.status(400).json({ message: "Paramètre 'annee' requis et doit être valide" });
            }

            const startMonth = parseMonth(req.query.start);
            const endMonth = parseMonth(req.query.end);

            if (!startMonth || startMonth < 1 || startMonth > 12) {
                return res.status(400).json({ message: "Paramètre 'start' invalide (01-12)" });
            }

            if (!endMonth || endMonth < 1 || endMonth > 12) {
                return res.status(400).json({ message: "Paramètre 'end' invalide (01-12)" });
            }

            if (startMonth > endMonth) {
                return res.status(400).json({ message: "Le mois de début doit être <= au mois de fin" });
            }

            const data = await model.aggregate([
                { $match: baseMatch },
                {
                    $project: {
                        createdAt: 1,
                        parts: {
                            $dateToParts: {
                                date: "$createdAt",
                                timezone: TZ,
                            },
                        },
                    },
                },
                {
                    $match: {
                        "parts.year": yearNum,
                        "parts.month": { $gte: startMonth, $lte: endMonth },
                    },
                },
                {
                    $group: {
                        _id: {
                            month: "$parts.month",
                            day: "$parts.day",
                        },
                        frequentation: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        mois: { $concat: [{ $toString: "$_id.month" }] },
                        jour: { $concat: [{ $toString: "$_id.day" }] },
                        frequentation: 1,
                    },
                },
                { $sort: { mois: 1, jour: 1 } },
            ]);

            return res.json({
                params: {
                    annee: yearNum,
                    start: monthLabel(startMonth),
                    end: monthLabel(endMonth),
                },
                donnees: data,
            });
        } catch (e) {
            console.error(e);
            return res.status(500).json({
                message: "Erreur serveur lors de la récupération des données mensuelles",
            });
        }
    }
);

/**
 * GET /api/graphs/capteurs/year/all
 * Query:
 *  - type=sonde|toilette
 *  - filtres: haut, type (sonde) / occupancy (toilette)
 *
 * Retourne: Liste de toutes les années disponibles
 */
router.get(
    "/year/all",
    auth,
    requirePermission("capteurs.view"),
    async (req, res) => {
        try {
            const { model, type } = resolveModel(req.query.type);
            const baseMatch = buildBaseMatch(type, req.query);

            const yearRows = await model.aggregate([
                { $match: baseMatch },
                {
                    $project: {
                        parts: {
                            $dateToParts: {
                                date: "$createdAt",
                                timezone: TZ,
                            },
                        },
                    },
                },
                {
                    $group: {
                        _id: "$parts.year",
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            const listeAnneesPossibles = yearRows.map((r) => String(r._id));

            return res.json(listeAnneesPossibles);
        } catch (e) {
            console.error(e);
            return res.status(500).json({
                message: "Erreur serveur lors de la récupération de la liste des années",
            });
        }
    }
);

/**
 * GET /api/graphs/capteurs/year
 * Query:
 *  - type=sonde|toilette
 *  - annee=2026 (requis)
 *  - filtres: haut, type (sonde) / occupancy (toilette)
 *
 * Retourne: Données par mois pour l'année spécifiée
 */
router.get(
    "/year",
    auth,
    requirePermission("capteurs.view"),
    async (req, res) => {
        try {
            const { model, type } = resolveModel(req.query.type);
            const baseMatch = buildBaseMatch(type, req.query);

            const yearNum = Number(req.query.annee);
            if (!yearNum || Number.isNaN(yearNum)) {
                return res.status(400).json({ message: "Paramètre 'annee' requis et doit être valide" });
            }

            const yearRows = await model.aggregate([
                { $match: baseMatch },
                {
                    $project: {
                        parts: {
                            $dateToParts: {
                                date: "$createdAt",
                                timezone: TZ,
                            },
                        },
                    },
                },
                { $match: { "parts.year": yearNum } },
                {
                    $group: {
                        _id: "$parts.month",
                        frequentation: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            const donnees = yearRows.map((r) => ({
                mois: monthLabel(Number(r._id)),
                frequentation: r.frequentation,
            }));

            return res.json({
                annee: yearNum,
                donnees: donnees,
            });
        } catch (e) {
            console.error(e);
            return res.status(500).json({
                message: "Erreur serveur lors de la récupération des données annuelles",
            });
        }
    }
);