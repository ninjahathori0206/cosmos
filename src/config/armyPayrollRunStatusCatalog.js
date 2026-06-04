'use strict';

const ARMY_PAYROLL_RUN_STATUS_CATALOG = [
  { key: 'DRAFT', label: 'Draft', badgeClass: 'b-gold' },
  { key: 'APPROVED', label: 'Approved', badgeClass: 'b-green' },
  { key: 'LOCKED', label: 'Locked', badgeClass: 'b-gray' }
];

function getArmyPayrollRunStatusCatalog() { return ARMY_PAYROLL_RUN_STATUS_CATALOG.map((r) => ({ ...r })); }
function isAllowedArmyPayrollRunStatusKey(key) {
  return ARMY_PAYROLL_RUN_STATUS_CATALOG.some((r) => r.key === String(key || '').trim().toUpperCase());
}

module.exports = { getArmyPayrollRunStatusCatalog, isAllowedArmyPayrollRunStatusKey };
