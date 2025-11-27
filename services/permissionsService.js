// services/permissionsService.js
const Role = require("../models/Role.js");
// Ou tes tables SQL si tu es en SQL, ici c’est l’idée seulement.

async function hasPermActive(roleId, permissionValue) {
    // Ici tu adaptes selon ta structure :
    // - soit une table roles_permissions
    // - soit un champ "permissions" sur Role
    const role = await Role.findById(roleId).populate("permissions");

    console.log("ps: ", role);

    if (!role) return false;

    return role.permissions.some(
        (perm) => perm.value === permissionValue && perm.active === true
    );
}

module.exports = { hasPermActive };
