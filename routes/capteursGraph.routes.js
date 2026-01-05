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

// Format EXACT comme ton JSON exemple pour ListeMoisPossibles:  "'Mars' || '03'"
function monthListLabel(monthNumber) {
    return `'${MONTHS_FR[monthNumber - 1]}' || '${pad2(monthNumber)}'`;
}

// Format EXACT comme ton JSON exemple pour params/données:  “Mars” || “03”
function monthParamsLabel(monthNumber) {
    return `“${MONTHS_FR[monthNumber - 1]}” || “${pad2(monthNumber)}”`;
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

// Renvoie "YYYY-MM-DD" dans le fuseau Europe/Paris
function formatYMDInTZ(dateObj) {
    const d = new Date(dateObj);
    if (Number.isNaN(d.getTime())) return null;

    // en-CA => "YYYY-MM-DD"
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
 * GET /api/graphs/capteurs/dates
 * Query:
 *  - type=sonde|toilette
 *  - date=YYYY-MM-DD (ou ISO) => "Aujourd’hui"
 *  - annee=2024
 *  - mois=01..12 ou "Janvier".."Décembre"
 *  - filtres: haut, type (sonde) / occupancy (toilette)
 */
router.get(
    "/dates", auth, requirePermission("capteurs.view"),
    async (req, res) => {
        try {
            const { model, type } = resolveModel(req.query.type);
            const baseMatch = buildBaseMatch(type, req.query);

            // Defaults (Paris)
            const now = new Date();
            const { year: defaultYear, month: defaultMonth } = getYearMonthInTZ(now);

            const targetDay =
                formatYMDInTZ(req.query.date || now) || formatYMDInTZ(now);

            const yearNum = req.query.annee ? Number(req.query.annee) : defaultYear;
            if (!yearNum || Number.isNaN(yearNum)) {
                return res.status(400).json({ message: "Paramètre 'annee' invalide" });
            }

            const monthNum =
                parseMonth(req.query.mois) ?? (defaultMonth || 1);

            if (!monthNum || monthNum < 1 || monthNum > 12) {
                return res.status(400).json({ message: "Paramètre 'mois' invalide" });
            }

            // 1) Années + Mois disponibles (par année)
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

            const ListeMoisPossibles = {};
            const yearSet = new Set();

            for (const r of yearMonthRows) {
                const y = String(r._id.year);
                const m = Number(r._id.month);

                yearSet.add(y);
                if (!ListeMoisPossibles[y]) ListeMoisPossibles[y] = [];
                ListeMoisPossibles[y].push(monthListLabel(m));
            }

            const ListeAnneesPossibles = Array.from(yearSet).sort();

            // 2) Aujourd’hui (par heure)
            const aujourdHui = await model.aggregate([
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
                        "frequentation": "$frequentationTmp",
                    },
                },
                { $sort: { heure: 1 } },
            ]);

            // 3) Mois (par jour)
            const moisDonnees = await model.aggregate([
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
                { $match: { "parts.year": yearNum, "parts.month": monthNum } },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                date: "$createdAt",
                                format: "%d",
                                timezone: TZ,
                            },
                        },
                        "frequentation": { $sum: 1 },
                    },
                },
                { $project: { _id: 0, jour: "$_id", "frequentation": 1 } },
                { $sort: { jour: 1 } },
            ]);

            // 4) Année (par mois)
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
                        "frequentation": { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            const anneeDonnees = yearRows.map((r) => ({
                mois: monthParamsLabel(Number(r._id)),
                "frequentation": r["frequentation"],
            }));

            // Réponse EXACTE (mêmes clés) que ton JSON
            return res.json({
                "Aujourd'Hui": aujourdHui,
                "ListeMoisPossibles": ListeMoisPossibles,
                "Mois": {
                    params: {
                        annee: yearNum,
                        mois: monthParamsLabel(monthNum),
                    },
                    donnees: moisDonnees,
                },
                "ListeAnneesPossibles": ListeAnneesPossibles,
                "Annee": {
                    annee: yearNum,
                    donnees: anneeDonnees,
                },
            });
        } catch (e) {
            console.error(e);
            return res.status(500).json({
                message: "Erreur serveur lors de la génération des dates/agrégations capteurs",
            });
        }
    }
);
