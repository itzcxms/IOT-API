function requirePermission(value) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ message: "Non authentifié" });

        if (!req.user.permissions.includes(value)) {
            return res.status(403).json({ message: "Permission refusée", needed: value });
        }
        next();
    };
}

module.exports = requirePermission;