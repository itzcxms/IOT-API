import { Router } from "express";
import Role from "../models/Role.js";
import RolePermission from "../models/RolePermission.js";
import Permission from "../models/Permission.js";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = Router();

// CRUD Roles
router.get("/", auth, requirePermission("roles.read"), async (req, res) => {
    res.json(await Role.find().sort({ poids: 1 }));
});

router.post("/", auth, requirePermission("roles.create"), async (req, res) => {
    try {
        const role = await Role.create(req.body);
        res.status(201).json(role);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

router.put("/:id", auth, requirePermission("roles.update"), async (req, res) => {
    const role = await Role.findByIdAndUpdate(req.params.id, req.body, {
        new: true, runValidators: true
    });
    if (!role) return res.status(404).json({ message: "Rôle introuvable" });
    res.json(role);
});

router.delete("/:id", auth, requirePermission("roles.delete"), async (req, res) => {
    const role = await Role.findByIdAndDelete(req.params.id);
    if (!role) return res.status(404).json({ message: "Rôle introuvable" });

    await RolePermission.deleteMany({ role_id: role._id });
    res.json({ message: "Rôle supprimé", id: role._id });
});

// Assigner permissions à un rôle
// POST /api/roles/:id/permissions
// body: { permission_ids: [{"role_id","role_id","etc..."}] }
router.post("/:id/permissions", auth, requirePermission("roles.assign_permissions"), async (req, res) => {
    const { permission_ids = [] } = req.body;
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: "Rôle introuvable" });

    const perms = await Permission.find({ _id: { $in: permission_ids } });
    if (perms.length !== permission_ids.length) {
        return res.status(400).json({ message: "Une ou plusieurs permissions invalides" });
    }

    // upsert pivot
    const ops = permission_ids.map(pid => ({
        updateOne: {
            filter: { role_id: role._id, permission_id: pid },
            update: { $setOnInsert: { role_id: role._id, permission_id: pid } },
            upsert: true
        }
    }));

    if (ops.length) {
        await RolePermission.bulkWrite(ops);
        res.json({ message: "Permissions ajoutées au rôle" });
    } else {
        res.json({ message: "Aucune permissions ajoutées au rôle" });

    }

});

// GET /api/roles/:id/permissions
router.get("/:id/permissions", auth, requirePermission("roles.read"), async (req, res) => {
    const links = await RolePermission.find({ role_id: req.params.id })
        .populate("permission_id");
    res.json(links.map(l => l.permission_id));
});

export default router;
