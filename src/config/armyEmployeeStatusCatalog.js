'use strict';

const ARMY_EMPLOYEE_STATUS_CATALOG = [
  { key: 'ONBOARDING', label: 'Onboarding', badgeClass: 'b-gold' },
  { key: 'ACTIVE', label: 'Active', badgeClass: 'b-green' },
  { key: 'ON_NOTICE', label: 'On notice', badgeClass: 'b-orange' },
  { key: 'EXITED', label: 'Exited', badgeClass: 'b-gray' },
  { key: 'INACTIVE', label: 'Inactive', badgeClass: 'b-gray' }
];

const ARMY_EMPLOYEE_STATUS_KEYS = ARMY_EMPLOYEE_STATUS_CATALOG.map((row) => row.key);

function getArmyEmployeeStatusCatalog() {
  return ARMY_EMPLOYEE_STATUS_CATALOG.map((row) => ({ ...row }));
}

function getArmyEmployeeStatusByKey(key) {
  const normalized = String(key || '').trim().toUpperCase();
  return ARMY_EMPLOYEE_STATUS_CATALOG.find((row) => row.key === normalized) || null;
}

function isAllowedArmyEmployeeStatusKey(key) {
  return ARMY_EMPLOYEE_STATUS_KEYS.includes(String(key || '').trim().toUpperCase());
}

module.exports = {
  ARMY_EMPLOYEE_STATUS_CATALOG,
  ARMY_EMPLOYEE_STATUS_KEYS,
  getArmyEmployeeStatusCatalog,
  getArmyEmployeeStatusByKey,
  isAllowedArmyEmployeeStatusKey
};
