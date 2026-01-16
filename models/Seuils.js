const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        nom: { type: String, required: true, unique: true },
        type: { type: String, required: true },
        unite: { type: String, required: true },
        seuil: { type: Number, required: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Seuil", userSchema);