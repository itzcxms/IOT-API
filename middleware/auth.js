const jwt = require("jsonwebtoken");
const User = require("../models/User.js");

async function auth(req, res, next) {
    try {
        const header = req.headers.authorization;
        if (!header?.startsWith("Bearer ")) {
            return res.status(401).json({ code: "TOKEN_MISSING", message: "Token manquant" });
        }

        const token = header.split(" ")[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(payload.id).populate("role_id");
        if (!user) {
            return res.status(401).json({ code: "USER_NOT_FOUND", message: "Utilisateur invalide" });
        }

        if (!user.actif) {
            return res.status(403).json({ code: "ACCOUNT_INACTIVE", message: "Compte inactif" });
        }

        req.user = { id: user._id, email: user.email };
        next();
    } catch (e) {
        return res.status(401).json({ code: "TOKEN_INVALID", message: "Token invalide" });
    }
}

module.exports = auth;
