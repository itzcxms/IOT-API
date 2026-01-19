const mongoose = require("mongoose");

const SeuilSchema = new mongoose.Schema(
    {
        nom: { type: String, required: true },
        type: { type: String, required: true },
        unite: { type: String, required: true },
        seuil: { type: Number, required: true },
        capteur_id: { type: String, required: true, unique: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Seuil", SeuilSchema);