/**
 * Transfer / StorePilot access helpers — permission- and store_id–driven only
 * (Command Unit → role_permissions → JWT). No role_key whitelists.
 */
const authorize = require('../middleware/authorize');

const { isSuperAdmin, hasPermission } = authorize;

/**
 * List/detail scope: users with StorePilot transfer view + a store, but without
 * Foundry dispatch (foundry.transfers.create), see only their store’s docs.
 */
function shouldScopeStockTransferDocsToUserStore(req) {
  if (isSuperAdmin(req)) return false;
  if (hasPermission(req, 'foundry.transfers.create')) return false;
  const us = req.user && req.user.store_id != null ? Number(req.user.store_id) : null;
  if (!us) return false;
  return hasPermission(req, 'storepilot.transfers.view');
}

/**
 * Transfer-request list/detail: store-scoped unless user has HQ approve (foundry.transfers.edit).
 */
function shouldScopeTransferRequestsToUserStore(req) {
  if (isSuperAdmin(req)) return false;
  if (hasPermission(req, 'foundry.transfers.edit')) return false;
  const us = req.user && req.user.store_id != null ? Number(req.user.store_id) : null;
  if (!us) return false;
  return hasPermission(req, 'storepilot.transfers.view');
}

/** Accept / stock: destination store + storepilot.transfers.edit (from JWT). */
function canAcceptOrStockTransfer(req, toStoreId) {
  if (isSuperAdmin(req)) return true;
  const dest = Number(toStoreId);
  if (!Number.isFinite(dest)) return false;
  const userStore = req.user && req.user.store_id != null ? Number(req.user.store_id) : null;
  if (userStore == null || userStore !== dest) return false;
  return hasPermission(req, 'storepilot.transfers.edit');
}

/** Transfer request RECEIVED: storepilot.transfers.edit; store match enforced in route. */
function canConfirmTransferReceipt(req) {
  if (isSuperAdmin(req)) return true;
  return hasPermission(req, 'storepilot.transfers.edit');
}

module.exports = {
  shouldScopeStockTransferDocsToUserStore,
  shouldScopeTransferRequestsToUserStore,
  canAcceptOrStockTransfer,
  canConfirmTransferReceipt
};
