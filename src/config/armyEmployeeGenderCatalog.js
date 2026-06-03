'use strict';

const ARMY_EMPLOYEE_GENDER_CATALOG = [
  { key: 'MALE', label: 'Male' },
  { key: 'FEMALE', label: 'Female' },
  { key: 'OTHER', label: 'Other' },
  { key: 'PREFER_NOT', label: 'Prefer not to say' }
];

function getArmyEmployeeGenderCatalog() {
  return ARMY_EMPLOYEE_GENDER_CATALOG.map((row) => ({ ...row }));
}

function isAllowedArmyEmployeeGenderKey(key) {
  return ARMY_EMPLOYEE_GENDER_CATALOG.some((row) => row.key === String(key || '').trim().toUpperCase());
}

module.exports = {
  getArmyEmployeeGenderCatalog,
  isAllowedArmyEmployeeGenderKey
};
