'use strict';

/**
 * Army HR — department catalogue (shared by careers portal + admin).
 * Keys align with PRD Army_HR_PRD_v1_0 §4.1.
 */
const ARMY_DEPARTMENTS_CATALOG = [
  { key: 'SALES', label: 'Sales', filterLabel: 'Sales', badgeClass: 'dept-sales' },
  { key: 'OPTOMETRY', label: 'Optometry', filterLabel: 'Optometry', badgeClass: 'dept-optometry' },
  { key: 'LAB', label: 'Lab', filterLabel: 'Lab', badgeClass: 'dept-lab' },
  { key: 'MGMT', label: 'Management', filterLabel: 'Management', badgeClass: 'dept-mgmt' },
  { key: 'ADMIN', label: 'Admin', filterLabel: 'Admin', badgeClass: 'dept-admin' },
  { key: 'HQ', label: 'HQ', filterLabel: 'HQ', badgeClass: 'dept-hq' }
];

const ARMY_DEPARTMENT_KEYS = ARMY_DEPARTMENTS_CATALOG.map((row) => row.key);

function getArmyDepartmentsCatalog() {
  return ARMY_DEPARTMENTS_CATALOG.map((row) => ({ ...row }));
}

function getArmyDepartmentMetaForApi() {
  return {
    departments: getArmyDepartmentsCatalog(),
    filter_all_label: 'All'
  };
}

function isAllowedArmyDepartmentKey(key) {
  return ARMY_DEPARTMENT_KEYS.includes(String(key || '').trim().toUpperCase());
}

function getArmyDepartmentByKey(key) {
  const normalized = String(key || '').trim().toUpperCase();
  return ARMY_DEPARTMENTS_CATALOG.find((row) => row.key === normalized) || null;
}

module.exports = {
  ARMY_DEPARTMENTS_CATALOG,
  ARMY_DEPARTMENT_KEYS,
  getArmyDepartmentsCatalog,
  getArmyDepartmentMetaForApi,
  isAllowedArmyDepartmentKey,
  getArmyDepartmentByKey
};
