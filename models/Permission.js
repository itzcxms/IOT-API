const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
    {
        categorie: { type: String, required: true, unique: true, trim: true },
        name: { type: String, required: true, unique: true, trim: true },
        value: { type: String, required: true, unique: true, trim: true }, // ex: "users.create"
        actif: { type: Boolean, default: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Permission", permissionSchema);
