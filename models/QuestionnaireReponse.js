const mongoose = require("mongoose");

const questionnaireReponseSchema = new mongoose.Schema(
    {
        questionnaire_id: { type: mongoose.Schema.Types.ObjectId, ref: "Questionnaire", required: true },

        // optionnel : si tu veux lier à un user
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

        reponses: [
            {
                question: { type: String, required: true }, // "quest1"
                note: { type: Number, required: true, min: 0, max: 5 }, // adapte min/max si besoin
            },
        ],
    },
    { timestamps: true }
);

module.exports = mongoose.model("QuestionnaireReponse", questionnaireReponseSchema);
