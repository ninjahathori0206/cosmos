'use strict';

const ARMY_APPLICATION_SOURCE_CATALOG = [
  { key: 'DIRECT', label: 'Direct URL' },
  { key: 'WHATSAPP', label: 'WhatsApp link' },
  { key: 'PROMOTER', label: 'Promoter' },
  { key: 'WALK_IN', label: 'Walk-in' },
  { key: 'INTERNAL', label: 'Internal transfer' }
];

const ARMY_APPLICATION_SOURCE_KEYS = ARMY_APPLICATION_SOURCE_CATALOG.map((row) => row.key);

function getArmyApplicationSourceCatalog() {
  return ARMY_APPLICATION_SOURCE_CATALOG.map((row) => ({ ...row }));
}

function isAllowedArmyApplicationSourceKey(key) {
  return ARMY_APPLICATION_SOURCE_KEYS.includes(String(key || '').trim().toUpperCase());
}

function normalizeArmyApplicationSourceKey(raw) {
  const key = String(raw || 'DIRECT').trim().toUpperCase().replace(/-/g, '_');
  return isAllowedArmyApplicationSourceKey(key) ? key : 'DIRECT';
}

module.exports = {
  ARMY_APPLICATION_SOURCE_CATALOG,
  ARMY_APPLICATION_SOURCE_KEYS,
  getArmyApplicationSourceCatalog,
  isAllowedArmyApplicationSourceKey,
  normalizeArmyApplicationSourceKey
};
