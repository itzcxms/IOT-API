const mongoose = require("mongoose");

const questionnaireSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true }, // ex: "questionnaire_satisfaction"
        titre: { type: String, required: true },
        questions: [
            {
                key: { type: String, required: true },   // ex: "quest1"
                label: { type: String, required: true }, // ex: "Propreté"
                ordre: { type: Number, required: true }, // 1..5
            },
        ],
    },
    { timestamps: true }
);

module.exports = mongoose.model("Questionnaire", questionnaireSchema);
