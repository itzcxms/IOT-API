const { Router } = require( "express");
const Permission = require( "../models/Permission.js");
const RolePermission = require( "../models/RolePermission.js");
const auth = require( "../middleware/auth.js");
const requirePermission = require( "../middleware/requirePermission.js");

const router = Router();

module.exports = router;

router.post("/create", auth, requirePermission("permissions.create"), async (req, res) => {
    try {
        const perm = await Permission.create(req.body);
        res.status(201).json(perm);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

router.put("/update/:id", auth, requirePermission("permissions.update"), async (req, res) => {
    const perm = await Permission.findByIdAndUpdate(req.params.id, req.body, {
        new: true, runValidators: true
    });
    if (!perm) return res.status(404).json({ message: "Permission introuvable" });
    res.json(perm);
});

router.delete("/delete/:id", auth, requirePermission("permissions.delete"), async (req, res) => {
    const perm = await Permission.findByIdAndDelete(req.params.id);
    if (!perm) return res.status(404).json({ message: "Permission introuvable" });

    await RolePermission.deleteMany({ permission_id: perm._id });
    res.json({ message: "Permission supprimée", id: perm._id });
});

