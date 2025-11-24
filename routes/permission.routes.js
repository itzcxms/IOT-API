import { Router } from "express";
import Permission from "../models/Permission.js";
import RolePermission from "../models/RolePermission.js";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = Router();

router.get("/", auth, requirePermission("permissions.read"), async (req, res) => {
    res.json(await Permission.find().sort({ createdAt: -1 }));
});

router.post("/", auth, requirePermission("permissions.create"), async (req, res) => {
    try {
        const perm = await Permission.create(req.body);
        res.status(201).json(perm);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

router.put("/:id", auth, requirePermission("permissions.update"), async (req, res) => {
    const perm = await Permission.findByIdAndUpdate(req.params.id, req.body, {
        new: true, runValidators: true
    });
    if (!perm) return res.status(404).json({ message: "Permission introuvable" });
    res.json(perm);
});

router.delete("/:id", auth, requirePermission("permissions.delete"), async (req, res) => {
    const perm = await Permission.findByIdAndDelete(req.params.id);
    if (!perm) return res.status(404).json({ message: "Permission introuvable" });

    await RolePermission.deleteMany({ permission_id: perm._id });
    res.json({ message: "Permission supprimée", id: perm._id });
});

export default router;
