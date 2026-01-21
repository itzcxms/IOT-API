const { Router } = require("express");
const auth = require("../middleware/auth.js");
const Sonde = require("../models/Sondes.js");
const Toilette = require("../models/Toilette.js");

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

function resolveModel(type) {
    const t = (type || "sonde").toLowerCase();
    if (t === "toilette") return { model: Toilette, type: "toilette" };
    return { model: Sonde, type: "sonde" };
}

function buildBaseMatch(modelType, body) {
    const match = {};
    const filters = body.filters || {};

    if (modelType === "sonde") {
        if (filters.haut) match.haut = String(filters.haut);
        if (filters.type) match.type = String(filters.type);
    }

    if (modelType === "toilette") {
        if (filters.occupancy) match.occupancy = String(filters.occupancy);
    }

    return match;
}

/**
 * POST /api/graphs/capteurs/lastinfo
 * Body:
 *  - type: "sonde" | "toilette"
 * Retourne: Dernière valeur enregistrée avec sa date d'insertion
 */
router.post("/lastinfo",
    auth,
    async (req, res) =>
    {
        try {
            const { model, type: modelType } = resolveModel(req.body.type);
            const baseMatch = buildBaseMatch(modelType, req.body);

            // Récupérer le dernier document
            const lastRecord = await model
                .findOne(baseMatch)
                .sort({ createdAt: -1 })
                .lean();

            if (!lastRecord) {
                return res.status(404).json({
                    message: "Aucune donnée trouvée",
                });
            }

            // Formater la date au format "YYYY-MM-DD HH:mm"
            const date = new Date(lastRecord.createdAt);
            const year = date.getFullYear();
            const month = pad2(date.getMonth() + 1);
            const day = pad2(date.getDate());
            const hours = pad2(date.getHours());
            const minutes = pad2(date.getMinutes());
            const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}`;

            // Agrégation pour récupérer les données
            const groupFields = {
                _id: null,
            };

            // Ajouter les champs spécifiques selon le type
            if (modelType === "sonde") {
                groupFields.haut = { $first: "$haut" };
            } else if (modelType === "toilette") {
                groupFields.frequentation = { $sum: 1 };
            }

            const data = await model.aggregate([
                { $match: baseMatch },
                {
                    $project: {
                        createdAt: 1,
                        haut: 1,
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
                        "parts.year": year,
                        "parts.month": Number(month),
                        "parts.day": Number(day),
                        "parts.hour": Number(hours),
                        "parts.minute": Number(minutes),
                    },
                },
                {
                    $group: groupFields,
                },
            ]);

            const result = data[0] || {};

            return res.json({
                date: formattedDate,
                ...(modelType === "sonde" ? { haut: result.haut || lastRecord.haut } : {}),
                ...(modelType === "toilette" ? { frequentation: String(result.frequentation || 0) } : {}),
            });
        } catch (e) {
            console.error(e);
            return res.status(500).json({
                message: "Erreur serveur lors de la récupération des données",
            });
        }
    }
);

router.post("/week", auth, async (req, res) => {
    try {
        const { model, type: modelType } = resolveModel(req.body.type);
        const baseMatch = buildBaseMatch(modelType, req.body);

        // Déterminer la date ciblée (début de semaine)
        let targetDate;
        if (req.body.date) {
            targetDate = new Date(req.body.date);
        } else {
            targetDate = new Date();
        }

        // Créer les bornes de la semaine (7 jours)
        const startOfWeek = new Date(
            targetDate.getFullYear(),
            targetDate.getMonth(),
            targetDate.getDate(),
            0, 0, 0, 0
        );

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6); // +6 jours (J0 à J6 = 7 jours)
        endOfWeek.setHours(23, 59, 59, 999);

        // Agrégation pour récupérer les données par jour
        const groupFields = {
            _id: {
                year: "$parts.year",
                month: "$parts.month",
                day: "$parts.day"
            },
        };

        // Ajouter les champs spécifiques selon le type
        if (modelType === "sonde") {
            groupFields.haut = { $first: "$haut" };
        } else if (modelType === "toilette") {
            groupFields.frequentation = { $sum: 1 };
        }

        const data = await model.aggregate([
            { $match: baseMatch },
            {
                $project: {
                    createdAt: 1,
                    haut: 1,
                    type: 1,
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
                    createdAt: { $gte: startOfWeek, $lte: endOfWeek },
                },
            },
            {
                $group: groupFields,
            },
            { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
        ]);

        // Générer tous les jours de la semaine (7 jours)
        const allDays = [];
        for (let d = 0; d < 7; d++) {
            const currentDay = new Date(startOfWeek);
            currentDay.setDate(currentDay.getDate() + d);

            const year = currentDay.getFullYear();
            const month = currentDay.getMonth() + 1;
            const day = currentDay.getDate();

            const existing = data.find(
                (item) =>
                    item._id.year === year &&
                    item._id.month === month &&
                    item._id.day === day
            );

            const dayData = {
                date: `${year}-${pad2(month)}-${pad2(day)}`,
            };

            // Ajouter les champs filtrés
            if (modelType === "sonde") {
                dayData.haut = existing ? existing.haut : "0";
            } else if (modelType === "toilette") {
                dayData.frequentation = existing ? existing.frequentation : 0;
            }

            allDays.push(dayData);
        }

        return res.json({
            periodeDebut: startOfWeek.toISOString().split('T')[0],
            periodeFin: endOfWeek.toISOString().split('T')[0],
            donnees: allDays,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({
            message: "Erreur serveur lors de la récupération des données hebdomadaires",
        });
    }
});


/**
 * POST /api/graphs/capteurs/today
 * Body:
 *  - type: "sonde" | "toilette"
 *  - date: "YYYY-MM-DD" (optionnel, par défaut aujourd'hui)
 *  - filters: { haut, type } pour sonde | { occupancy } pour toilette
 *
 * Retourne: Données par heure pour la journée ciblée
 */
router.post(
    "/today",
    auth,
    async (req, res) => {
        try {
            const { model, type: modelType } = resolveModel(req.body.type);
            const baseMatch = buildBaseMatch(modelType, req.body);

            // Déterminer la date ciblée
            let targetDate;
            if (req.body.date) {
                targetDate = new Date(req.body.date);
            } else {
                targetDate = new Date();
            }

            // Créer les bornes de la journée en timezone Europe/Paris
            const year = targetDate.getFullYear();
            const month = targetDate.getMonth();
            const day = targetDate.getDate();

            const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
            const endOfDay = new Date(year, month, day, 23, 59, 59, 999);

            // Agrégation pour récupérer les données par heure
            const groupFields = {
                _id: "$parts.hour",
            };

            // Ajouter les champs spécifiques selon le type
            if (modelType === "sonde") {
                groupFields.haut = { $first: "$haut" };
            } else if (modelType === "toilette") {
                groupFields.frequentation = { $sum: 1 };
            }

            const data = await model.aggregate([
                { $match: baseMatch },
                {
                    $project: {
                        createdAt: 1,
                        haut: 1,
                        type: 1,
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
                        createdAt: { $gte: startOfDay, $lte: endOfDay },
                    },
                },
                {
                    $group: groupFields,
                },
                { $sort: { _id: 1 } },
            ]);

            // Générer toutes les heures de 0 à 23 (même sans données)
            const allHours = [];
            for (let h = 0; h < 24; h++) {
                const existing = data.find((item) => item._id === h);
                const hourData = {
                    heure: pad2(h),
                };

                // Ajouter les champs filtrés
                if (modelType === "sonde") {
                    hourData.haut = existing ? existing.haut : "0";
                } else if (modelType === "toilette") {
                    hourData.frequentation = existing ? existing.frequentation : 0;
                }

                allHours.push(hourData);
            }

            return res.json({
                date: `${year}-${pad2(month + 1)}-${pad2(day)}`,
                donnees: allHours,
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
 * POST /api/graphs/capteurs/month
 * Body:
 *  - type: "sonde" | "toilette"
 *  - annee: 2026 (requis)
 *  - start: "03" (mois de début, requis)
 *  - end: "05" (mois de fin, requis)
 *  - filtres: haut, type (sonde) / occupancy (toilette)
 *
 * Retourne: Tous les jours entre start et end avec leur fréquentation
 */
router.post(
    "/month",
    auth,
    async (req, res) => {
        try {
            const { model, type } = resolveModel(req.body.type);
            const baseMatch = buildBaseMatch(type, req.body);

            const yearNum = Number(req.body.annee);
            if (!yearNum || Number.isNaN(yearNum)) {
                return res.status(400).json({ message: "Paramètre 'annee' requis et doit être valide" });
            }

            const startMonth = parseMonth(req.body.start);
            const endMonth = parseMonth(req.body.end);

            if (!startMonth || startMonth < 1 || startMonth > 12) {
                return res.status(400).json({ message: "Paramètre 'start' invalide (01-12)" });
            }

            if (!endMonth || endMonth < 1 || endMonth > 12) {
                return res.status(400).json({ message: "Paramètre 'end' invalide (01-12)" });
            }

            if (startMonth > endMonth) {
                return res.status(400).json({ message: "Le mois de début doit être <= au mois de fin" });
            }

            // Agrégation pour récupérer tous les jours entre start et end
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
                        dateStr: {
                            $dateToString: {
                                date: "$createdAt",
                                format: "%Y-%m-%d",
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
                        _id: "$dateStr",
                        frequentation: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        date: "$_id",
                        frequentation: 1,
                    },
                },
                { $sort: { date: 1 } },
            ]);

            // Générer tous les jours entre start et end (même sans données)
            const allDays = [];
            for (let m = startMonth; m <= endMonth; m++) {
                const daysInMonth = new Date(yearNum, m, 0).getDate();
                for (let d = 1; d <= daysInMonth; d++) {
                    const dateStr = `${yearNum}-${pad2(m)}-${pad2(d)}`;
                    const existing = data.find((item) => item.date === dateStr);
                    allDays.push({
                        jour: pad2(d),
                        frequentation: existing ? existing.frequentation : 0,
                    });
                }
            }

            return res.json({
                params: {
                    annee: yearNum,
                    start: monthLabel(startMonth),
                    end: monthLabel(endMonth),
                },
                donnees: allDays,
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
 * POST /api/graphs/capteurs/year
 * Query:
 *  - type=sonde|toilette
 *  - annee=2026 (requis)
 *  - filtres: haut, type (sonde) / occupancy (toilette)
 *
 * Retourne: Données par mois pour l'année spécifiée
 */
router.post(
    "/year",
    auth,
    async (req, res) => {
        try {
            const { model, type } = resolveModel(req.body.type);
            const baseMatch = buildBaseMatch(type, req.body);

            const yearNum = Number(req.body.annee);
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