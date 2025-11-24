import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true, trim: true },
        value: { type: String, required: true, unique: true, trim: true }, // ex: "users.create"
        actif: { type: Boolean, default: true }
    },
    { timestamps: true }
);

export default mongoose.model("Permission", permissionSchema);
