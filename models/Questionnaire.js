const mongoose = require("mongoose");

const QuestionnaireSchema = new mongoose.Schema({
    questionnaireId: {
        type: String,
        unique: true,
        default: () => new mongoose.Types.ObjectId().toString()
    },
    satisfactionAire: {
        type: String,
        enum: ["mauvais", "passable", "bon", "excellent"],
        required: true
    },
    satisfactionSecurite: {
        type: String,
        enum: ["mauvais", "passable", "bon", "excellent"],
        required: true
    },
    satisfactionServices: {
        type: String,
        enum: ["mauvais", "passable", "bon", "excellent"],
        required: true
    },
    sourcesConnaissance: {
        type: [String],
        default: []
    },
    autreSource: {
        type: String,
        default: ""
    },
    remarques: {
        type: String,
        default: ""
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("Questionnaire", QuestionnaireSchema);
