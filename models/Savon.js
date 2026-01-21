const mongoose = require("mongoose");

const savonSchema = new mongoose.Schema(
    {
        contenance: {type: Number, required: true}, // Contenance totale du distributeur
        seuils: {
            actuel: {type: Number, required: true}, // Contenance estimée actuelle (en mL)
            alert: {type: Number, required: true},  // Seuil d'alerte (en mL)
        },
        name: { type: String, required: true, unique: true, trim: true },

        // Référence au dernier comptage lors du remplissage
        dernierRemplissage: {
            date: { type: Date, default: Date.now },
            compteurPassages: { type: Number, default: 0 } // line_1_total_in au moment du remplissage
        },

        // Configuration
        consommationParPassage: { type: Number, default: 1.5 }, // mL consommé par passage (à calibrer)
    },
    { timestamps: true }
);

module.exports = mongoose.model("Savon", savonSchema);
