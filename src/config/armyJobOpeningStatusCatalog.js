'use strict';

const ARMY_JOB_OPENING_STATUS_CATALOG = [
  { key: 'DRAFT', label: 'Draft', badgeClass: 'b-gray' },
  { key: 'PENDING_APPROVAL', label: 'Pending approval', badgeClass: 'b-gold' },
  { key: 'PUBLISHED', label: 'Published', badgeClass: 'b-green' },
  { key: 'FILLED', label: 'Filled', badgeClass: 'b-blue' },
  { key: 'CLOSED', label: 'Closed', badgeClass: 'b-red' }
];

const ARMY_JOB_OPENING_STATUS_KEYS = ARMY_JOB_OPENING_STATUS_CATALOG.map((row) => row.key);

function getArmyJobOpeningStatusCatalog() {
  return ARMY_JOB_OPENING_STATUS_CATALOG.map((row) => ({ ...row }));
}

function getArmyJobOpeningStatusByKey(key) {
  const normalized = String(key || '').trim().toUpperCase();
  return ARMY_JOB_OPENING_STATUS_CATALOG.find((row) => row.key === normalized) || null;
}

function isAllowedArmyJobOpeningStatusKey(key) {
  return ARMY_JOB_OPENING_STATUS_KEYS.includes(String(key || '').trim().toUpperCase());
}

module.exports = {
  ARMY_JOB_OPENING_STATUS_CATALOG,
  ARMY_JOB_OPENING_STATUS_KEYS,
  getArmyJobOpeningStatusCatalog,
  getArmyJobOpeningStatusByKey,
  isAllowedArmyJobOpeningStatusKey
};
