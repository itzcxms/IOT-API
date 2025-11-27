const jwt = require("jsonwebtoken");
const User = require("../models/User.js");
const RolePermission = require("../models/RolePermission.js");

async function auth(req, res, next) {
    try {
        const header = req.headers.authorization;
        if (!header?.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Token manquant" });
        }

        const token = header.split(" ")[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(payload.id).populate("role_id");
        if (!user || !user.actif) {
            return res.status(401).json({ message: "Utilisateur invalide/inactif" });
        }

        req.user = {
            id: user._id,
            email: user.email,
        };

        next();
    } catch (e) {
        return res.status(401).json({ message: "Token invalide" });
    }
}

module.exports = auth;