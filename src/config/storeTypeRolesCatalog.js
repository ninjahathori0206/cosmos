'use strict';

/**
 * Assignable semantic roles for store formats (not store type keys).
 * CU renders role checkboxes from GET /api/meta/store-types → store_type_role_defs.
 */
const STORE_TYPE_ROLE_DEFS = Object.freeze([
  {
    key: 'warehouse_hub',
    label: 'Primary warehouse hub',
    description:
      'Store can be set as Foundry primary warehouse. Excluded from goods-transfer destination lists.'
  }
]);

const STORE_TYPE_ROLES = Object.freeze({
  WAREHOUSE_HUB: 'warehouse_hub'
});

function getStoreTypeRoleDefs() {
  return STORE_TYPE_ROLE_DEFS.map((row) => ({
    key: row.key,
    label: row.label,
    description: row.description || null
  }));
}

function getStoreTypeRoleKeys() {
  return STORE_TYPE_ROLE_DEFS.map((r) => r.key);
}

function isKnownStoreTypeRole(roleKey) {
  return getStoreTypeRoleKeys().includes(String(roleKey || ''));
}

module.exports = {
  STORE_TYPE_ROLES,
  STORE_TYPE_ROLE_DEFS,
  getStoreTypeRoleDefs,
  getStoreTypeRoleKeys,
  isKnownStoreTypeRole
};
