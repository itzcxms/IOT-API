import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true, trim: true },
        poids: { type: Number, required: true, default: 1 }
    },
    { timestamps: true }
);

export default mongoose.model("Role", roleSchema);
