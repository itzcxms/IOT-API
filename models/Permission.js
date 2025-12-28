const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
    {
        categorie: { type: String, required: true, trim: true },
        description: { type: String, required: true, trim: true, default: "" },
        name: { type: String, required: true, unique: true, trim: true },
        value: { type: String, required: true, unique: true, trim: true }, // ex: "users.create"
    },
    { timestamps: true }
);

module.exports = mongoose.model("Permission", permissionSchema);
