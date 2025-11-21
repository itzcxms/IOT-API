import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        nom: { type: String, required: true, trim: true },
        prenom: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true },
        role_id: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
        actif: { type: Boolean, default: true }
    },
    { timestamps: true }
);

export default mongoose.model("User", userSchema);
