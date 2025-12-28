const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        haut: { type: String, required: true },
        type: { type: String, required: true },
        volt: { type: Number, required: true },
        temperature: { type: Number, required: true },
        hygrometrie: { type: Number, required: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Sonde", userSchema);

/**
 * bridge-chaumont {
 *   haut: '1',
 *   type: 'distance',
 *   volt: 4.986,
 *   temperature: 14.14,
 *   hygrometrie: 13
 * }
 */