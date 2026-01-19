const { Router } = require("express");
const auth = require("../middleware/auth.js");
const requirePermission = require("../middleware/requirePermission.js");

const Questionnaire = require("../models/Questionnaire.js");

const router = Router();
module.exports = router;

/**
 * GET /api/questionnaires/:id/radar
 * Query optionnels:
 *  - from=2025-01-01
 *  - to=2025-12-31
 *
 * Response:
 *  - questions (liste + ordre)
 *  - moyenneParQuestion [{question, note}]
 *  - radar { labels: [], data: [], min, max }
 */
router.get(
    "/:id/radar",
    auth,
    requirePermission("questionnaires.view"),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { from, to } = req.query;

            const questionnaire = await Questionnaire.findById(id).lean();
            if (!questionnaire) {
                return res.status(404).json({ message: "Questionnaire introuvable" });
            }

            const questionsActives = (questionnaire.questions || [])
                .filter((q) => q.actif !== false)
                .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));

            // Date filter optionnel
            const match = { questionnaire_id: questionnaire._id };
            if (from || to) {
                match.createdAt = {};
                if (from) match.createdAt.$gte = new Date(from);
                if (to) match.createdAt.$lte = new Date(to);
            }

            // Agrégation: moyenne par question
            const rows = await QuestionnaireReponse.aggregate([
                { $match: match },
                { $unwind: "$reponses" },
                {
                    $group: {
                        _id: "$reponses.question",
                        note: { $avg: "$reponses.note" },
                        nb: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        question: "$_id",
                        note: { $round: ["$note", 2] }, // 2 décimales
                        nb: 1,
                    },
                },
            ]);

            // Index des moyennes trouvées
            const avgMap = new Map(rows.map((r) => [r.question, r]));

            // Normalisation pour renvoyer *toutes* les questions, même sans réponse
            const moyenneParQuestion = questionsActives.map((q) => {
                const found = avgMap.get(q.key);
                return {
                    question: q.key,
                    note: found ? found.note : 0, // ou null si tu préfères
                };
            });

            // Payload radar prêt pour un chart
            const radar = {
                labels: questionsActives.map((q) => q.label),
                data: moyenneParQuestion.map((x) => x.note),
                min: 0,
                max: 5,
            };

            return res.json({
                questionnaire: {
                    id: questionnaire._id,
                    key: questionnaire.key,
                    titre: questionnaire.titre,
                },
                questions: questionsActives.map((q) => ({
                    key: q.key,
                    label: q.label,
                    ordre: q.ordre,
                })),
                moyenneParQuestion, // <- format demandé [{question, note}]
                radar,              // <- utile pour le radar
                meta: {
                    filtre: { from: from || null, to: to || null },
                    nbQuestions: questionsActives.length,
                },
            });
        } catch (e) {
            console.error(e);
            return res.status(500).json({ message: "Erreur serveur (radar questionnaire)" });
        }
    }
);
