/**
 * Hybrid RBAC: coarse module access (from JWT `modules`) + fine-grained
 * permission strings (from JWT `permissions`, sourced from role_permissions).
 * Role `super_admin` bypasses all checks.
 */

function normRole(role) {
  return String(role || '').toLowerCase();
}

/** Case-insensitive role_key match for fixed sets (JWT role may not be lowercased). */
function isOneOfRoles(role, roleSet) {
  const r = normRole(role);
  return roleSet.has(r);
}

function isSuperAdmin(req) {
  return normRole(req.user && req.user.role) === 'super_admin';
}

/** Legacy tokens / empty module map = all modules allowed (matches pre-RBAC client behaviour). */
function legacyModuleAllowAll(modules) {
  if (modules == null || typeof modules !== 'object') return true;
  return Object.keys(modules).length === 0;
}

function hasModuleAccess(req, moduleKey) {
  if (isSuperAdmin(req)) return true;
  const mk = String(moduleKey || '').toLowerCase();
  if (!mk) return false;
  const mods = req.user && req.user.modules;
  if (legacyModuleAllowAll(mods)) return true;
  return mods[mk] === true;
}

function getPermissions(req) {
  const p = req.user && req.user.permissions;
  if (!Array.isArray(p)) return [];
  return p.map((x) => String(x).toLowerCase());
}

function hasPermission(req, permissionKey) {
  if (isSuperAdmin(req)) return true;
  const key = String(permissionKey || '').toLowerCase();
  if (!key) return false;
  return getPermissions(req).includes(key);
}

function requireModule(moduleKey) {
  return (req, res, next) => {
    if (!hasModuleAccess(req, moduleKey)) {
      return res.status(403).json({ success: false, message: 'Module access denied.' });
    }
    return next();
  };
}

/** User must have at least one of the listed permissions (OR). */
function requirePermission(...permissionKeys) {
  const keys = permissionKeys.flat().filter(Boolean).map((k) => String(k).toLowerCase());
  return (req, res, next) => {
    if (!keys.length) return next();
    if (isSuperAdmin(req)) return next();
    const have = getPermissions(req);
    const ok = keys.some((k) => have.includes(k));
    if (!ok) {
      return res.status(403).json({ success: false, message: 'Permission denied.' });
    }
    return next();
  };
}

/** User must have every listed permission (AND). */
function requireAllPermissions(...permissionKeys) {
  const keys = permissionKeys.flat().filter(Boolean).map((k) => String(k).toLowerCase());
  return (req, res, next) => {
    if (!keys.length) return next();
    if (isSuperAdmin(req)) return next();
    const have = getPermissions(req);
    const ok = keys.every((k) => have.includes(k));
    if (!ok) {
      return res.status(403).json({ success: false, message: 'Permission denied.' });
    }
    return next();
  };
}

function requireAnyModule(moduleKeys) {
  const keys = (moduleKeys || []).map((k) => String(k).toLowerCase()).filter(Boolean);
  return (req, res, next) => {
    if (!keys.length) return next();
    if (isSuperAdmin(req)) return next();
    if (keys.some((k) => hasModuleAccess(req, k))) return next();
    return res.status(403).json({ success: false, message: 'Module access denied.' });
  };
}

/**
 * Goods Transfer destination picker — read-only store list.
 * super_admin: always. Others: Foundry or Command Unit module, then either
 * one of the usual permissions OR legacy JWT with empty permissions but Foundry access
 * (matches client nav when role_permissions are not fully seeded).
 */
function requireGoodsTransferDestinationStores(req, res, next) {
  if (isSuperAdmin(req)) return next();
  const hasF = hasModuleAccess(req, 'foundry');
  const hasCU = hasModuleAccess(req, 'command_unit');
  if (!hasF && !hasCU) {
    return res.status(403).json({ success: false, message: 'Module access denied.' });
  }
  const perms = getPermissions(req);
  const allow = [
    'foundry.stock.view',
    'foundry.transfers.view',
    'foundry.transfers.create',
    'command_unit.stores.view'
  ];
  if (perms.length === 0 && hasF) return next();
  if (allow.some((k) => perms.includes(k))) return next();
  return res.status(403).json({ success: false, message: 'Permission denied.' });
}

module.exports = {
  isSuperAdmin,
  normRole,
  isOneOfRoles,
  hasModuleAccess,
  hasPermission,
  requireModule,
  requirePermission,
  requireAllPermissions,
  requireAnyModule,
  requireGoodsTransferDestinationStores
};
