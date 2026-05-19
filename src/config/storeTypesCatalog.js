'use strict';

const { STORE_TYPE_ROLES, getStoreTypeRoleDefs, getStoreTypeRoleKeys, isKnownStoreTypeRole } = require('./storeTypeRolesCatalog');
const {
  getCatalogRows,
  refreshStoreTypeCatalogCache,
  invalidateStoreTypeCatalogCache,
  isAllowedStoreTypeAsync
} = require('../services/storeTypeCatalogService');

/**
 * Store format catalogue — persisted in dbo.store_type_catalog (+ roles table).
 * Configure types in Command Unit → Store Types (settings.edit).
 *
 * Role definitions (warehouse_hub, …): src/config/storeTypeRolesCatalog.js
 */

async function ensureCatalogLoaded() {
  return getCatalogRows();
}

async function getStoreTypesCatalog(options) {
  return getCatalogRows(options);
}

async function getStoreTypeKeys(options) {
  const rows = await getCatalogRows(options);
  return rows.map((r) => r.key);
}

function getStoreTypeKeysWithRoleFromRows(rows, roleKey) {
  const role = String(roleKey || '');
  return rows.filter((row) => Array.isArray(row.roles) && row.roles.includes(role)).map((row) => row.key);
}

async function getStoreTypeKeysWithRole(roleKey) {
  const rows = await getCatalogRows({ activeOnly: true });
  return getStoreTypeKeysWithRoleFromRows(rows, roleKey);
}

async function isStoreTypeInRole(typeKey, roleKey) {
  const keys = await getStoreTypeKeysWithRole(roleKey);
  return keys.includes(String(typeKey || ''));
}

async function filterStoresByStoreTypeRole(stores, roleKey) {
  const allowed = new Set(await getStoreTypeKeysWithRole(roleKey));
  return (Array.isArray(stores) ? stores : []).filter((s) => {
    if (!s || typeof s !== 'object') return false;
    return allowed.has(String(s.store_type || ''));
  });
}

async function filterStoresRetailDestinations(stores) {
  const hubKeys = new Set(await getStoreTypeKeysWithRole(STORE_TYPE_ROLES.WAREHOUSE_HUB));
  return (Array.isArray(stores) ? stores : []).filter((s) => {
    if (!s || typeof s !== 'object') return false;
    const status = String(s.status || 'ACTIVE').trim().toUpperCase();
    if (status !== 'ACTIVE') return false;
    const typeKey = String(s.store_type || '');
    return typeKey && !hubKeys.has(typeKey);
  });
}

async function getStoreTypeMetaForApi() {
  await refreshStoreTypeCatalogCache();
  return {
    store_types: await getCatalogRows({ activeOnly: true }),
    store_type_roles: STORE_TYPE_ROLES,
    store_type_role_defs: getStoreTypeRoleDefs()
  };
}

/** Sync helpers use in-memory cache after first load (for hot paths). */
let syncRows = null;

async function warmStoreTypesCache() {
  syncRows = await refreshStoreTypeCatalogCache();
  return syncRows;
}

function getCachedRowsSync() {
  return syncRows;
}

function getStoreTypeKeysWithRoleSync(roleKey) {
  const rows = syncRows || [];
  return getStoreTypeKeysWithRoleFromRows(
    rows.filter((r) => r.is_active !== false),
    roleKey
  );
}

function filterStoresByStoreTypeRoleSync(stores, roleKey) {
  const allowed = new Set(getStoreTypeKeysWithRoleSync(roleKey));
  return (Array.isArray(stores) ? stores : []).filter((s) => {
    if (!s || typeof s !== 'object') return false;
    return allowed.has(String(s.store_type || ''));
  });
}

function filterStoresRetailDestinationsSync(stores) {
  const hubKeys = new Set(getStoreTypeKeysWithRoleSync(STORE_TYPE_ROLES.WAREHOUSE_HUB));
  return (Array.isArray(stores) ? stores : []).filter((s) => {
    if (!s || typeof s !== 'object') return false;
    const status = String(s.status || 'ACTIVE').trim().toUpperCase();
    if (status !== 'ACTIVE') return false;
    const typeKey = String(s.store_type || '');
    return typeKey && !hubKeys.has(typeKey);
  });
}

module.exports = {
  STORE_TYPE_ROLES,
  ensureCatalogLoaded,
  warmStoreTypesCache,
  getCachedRowsSync,
  getStoreTypesCatalog,
  getStoreTypeKeys,
  getStoreTypeRoleKeys,
  isKnownStoreTypeRole,
  getStoreTypeRoleDefs,
  isAllowedStoreTypeAsync,
  getStoreTypeKeysWithRole,
  isStoreTypeInRole,
  filterStoresByStoreTypeRole,
  filterStoresRetailDestinations,
  filterStoresByStoreTypeRoleSync,
  filterStoresRetailDestinationsSync,
  getStoreTypeMetaForApi,
  invalidateStoreTypeCatalogCache: () => {
    syncRows = null;
    invalidateStoreTypeCatalogCache();
  }
};
