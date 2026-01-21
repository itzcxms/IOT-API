const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        nom: { type: String, required: true, trim: true },
        prenom: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true },
        role_id: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
        authzVersion: { type: Number, default: 0 },
        actif: { type: Boolean, default: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
