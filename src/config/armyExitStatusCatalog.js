'use strict';

const ARMY_EXIT_STATUS_CATALOG = [
  { key: 'PENDING', label: 'Pending', badgeClass: 'b-gold' },
  { key: 'IN_CLEARANCE', label: 'In clearance', badgeClass: 'b-blue' },
  { key: 'COMPLETED', label: 'Completed', badgeClass: 'b-green' },
  { key: 'CANCELLED', label: 'Cancelled', badgeClass: 'b-gray' }
];

const ARMY_EXIT_CLEARANCE_CATALOG = [
  { key: 'ASSETS_RETURNED', label: 'Company assets returned' },
  { key: 'ID_CARD', label: 'ID card surrendered' },
  { key: 'UNIFORM', label: 'Uniform returned' },
  { key: 'FINANCE_CLEAR', label: 'Finance clearance' },
  { key: 'IT_CLEAR', label: 'IT / access revoked' },
  { key: 'EXIT_INTERVIEW', label: 'Exit interview completed' }
];

function getArmyExitStatusCatalog() { return ARMY_EXIT_STATUS_CATALOG.map((r) => ({ ...r })); }
function getArmyExitClearanceCatalog() { return ARMY_EXIT_CLEARANCE_CATALOG.map((r) => ({ ...r })); }
function isAllowedArmyExitStatusKey(key) {
  return ARMY_EXIT_STATUS_CATALOG.some((r) => r.key === String(key || '').trim().toUpperCase());
}

module.exports = {
  getArmyExitStatusCatalog,
  getArmyExitClearanceCatalog,
  isAllowedArmyExitStatusKey
};
