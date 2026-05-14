'use strict';

/**
 * Single source of truth for dbo.stores.store_type values (keys) and Command Unit labels.
 * Server validation and GET /api/stores/store-types (and GET /api/meta/store-types) use this module.
 *
 * SQL mirror: run sql/migrations/47_store_type_catalog.sql (dbo.store_type_catalog + optional FK).
 * Keep keys and labels in sync with that MERGE seed.
 *
 * Keys are stored in SQL; keep seed/migrations aligned (e.g. HQ for primary warehouse hub).
 */
const STORE_TYPES_CATALOG = Object.freeze([
  {
    key: 'HQ',
    label: 'Corporate HQ (warehouse hub)',
    description:
      'Foundry primary warehouse hub. WAREHOUSE stock uses this store_id as stock_balances.location_id.'
  },
  { key: 'Owned', label: 'Eyewoot-Owned' },
  { key: 'Franchise', label: 'Franchise' },
  { key: 'Kiosk', label: 'Kiosk / Pop-up' },
  { key: 'Online', label: 'Online / D2C' }
]);

function getStoreTypesCatalog() {
  return STORE_TYPES_CATALOG;
}

function getStoreTypeKeys() {
  return STORE_TYPES_CATALOG.map((r) => r.key);
}

function isAllowedStoreType(key) {
  return getStoreTypeKeys().includes(String(key || ''));
}

module.exports = {
  STORE_TYPES_CATALOG,
  getStoreTypesCatalog,
  getStoreTypeKeys,
  isAllowedStoreType
};
