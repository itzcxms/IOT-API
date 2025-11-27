// middlewares/requirePermission.js
const User = require("../models/User");
const Role = require("../models/Role");
const Permission = require("../models/Permission");
const RolePermission = require("../models/RolePermission");

function requirePermission(permissionValue) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Non authentifié" });
        }

        try {
            // Récup user + état du compte + rôle
            const user = await User.findById(
                req.user.id,
                { role_id: 1, actif: 1 }
            );

            if (!user) {
                return res.status(404).json({ message: "Utilisateur introuvable" });
            }

            const role = await Role.findOne()
                .sort({ poids: -1 })
                .select("_id")
                .limit(1);

            if(user.role_id.toString() === role._id.toString()) {
                return next();
            }

            if (!user.actif) {
                return res.status(403).json({ message: "Compte désactivé" });
            }

            // Permission recherchée uniquement par "value"
            const permission = await Permission.findOne(
                { value: permissionValue },
                { _id: 1 }
            );

            if (!permission) {
                return res
                    .status(403)
                    .json({ message: "Permission inconnue" });
            }

            // Vérifie que le lien rôle/permission est actif
            const rolePermission = await RolePermission.findOne({
                role_id: user.role_id,
                permission_id: permission._id,
                actif: true
            });

            if (!rolePermission) {
                return res.status(403).json({ message: "Accès refusé" });
            }

            next();
        } catch (err) {
            console.error("Erreur requirePermission:", err);
            return res.status(500).json({ message: "Erreur interne du serveur" });
        }
    };
}

module.exports = requirePermission;
