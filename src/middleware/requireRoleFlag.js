'use strict';

/**
 * POS staff JWT may include role flags from dbo.roles at session start.
 * Usage: router.post('/refund', authJwt, requireRoleFlag('can_initiate_refund'), handler)
 */
function requireRoleFlag(flagName) {
  const key = String(flagName || '');
  return function requireRoleFlagMiddleware(req, res, next) {
    if (!key) return next();
    const u = req.user || {};
    if (u[key] === true) return next();
    return res.status(403).json({
      success: false,
      message: 'Your role does not have permission for this action.'
    });
  };
}

module.exports = { requireRoleFlag };
