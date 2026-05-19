'use strict';

/** Canonical sku_units.status keys — keep in sync with SQL CK_sku_units_status (migration 51). */
const SKU_UNIT_STATUS_CATALOG = Object.freeze([
  { key: 'AVAILABLE', label: 'Available', description: 'At primary warehouse, ready to transfer or sell' },
  { key: 'IN_TRANSIT', label: 'In transit', description: 'Dispatched on transfer document to a store' },
  { key: 'AT_STORE', label: 'At store', description: 'Received and stocked at showroom' },
  { key: 'AT_LAB', label: 'At lab', description: 'With lab for order processing' },
  { key: 'CONSUMED', label: 'Consumed', description: 'Delivered to customer (terminal)' },
  { key: 'RESERVED', label: 'Reserved', description: 'Held for checkout or internal reserve' },
  { key: 'SOLD', label: 'Sold', description: 'Legacy POS sold marker (migrating to AT_LAB / CONSUMED)' }
]);

const SKU_UNIT_LOCATION_TYPE_CATALOG = Object.freeze([
  { key: 'WAREHOUSE', label: 'Warehouse' },
  { key: 'IN_TRANSIT', label: 'In transit' },
  { key: 'STORE', label: 'Store' },
  { key: 'LAB', label: 'Lab' },
  { key: 'CONSUMED', label: 'Consumed' }
]);

function getSkuUnitStatusCatalog() {
  return SKU_UNIT_STATUS_CATALOG.map((r) => ({ ...r }));
}

function getSkuUnitLocationTypeCatalog() {
  return SKU_UNIT_LOCATION_TYPE_CATALOG.map((r) => ({ ...r }));
}

function getSkuUnitStatusKeys() {
  return SKU_UNIT_STATUS_CATALOG.map((r) => r.key);
}

function getSkuUnitLocationTypeKeys() {
  return SKU_UNIT_LOCATION_TYPE_CATALOG.map((r) => r.key);
}

function isKnownSkuUnitStatus(key) {
  return getSkuUnitStatusKeys().includes(String(key || '').trim().toUpperCase());
}

module.exports = {
  SKU_UNIT_STATUS_CATALOG,
  SKU_UNIT_LOCATION_TYPE_CATALOG,
  getSkuUnitStatusCatalog,
  getSkuUnitLocationTypeCatalog,
  getSkuUnitStatusKeys,
  getSkuUnitLocationTypeKeys,
  isKnownSkuUnitStatus
};
