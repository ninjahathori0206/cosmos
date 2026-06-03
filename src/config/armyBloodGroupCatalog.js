'use strict';

const ARMY_BLOOD_GROUP_CATALOG = [
  { key: 'A_POS', label: 'A+' },
  { key: 'A_NEG', label: 'A−' },
  { key: 'B_POS', label: 'B+' },
  { key: 'B_NEG', label: 'B−' },
  { key: 'AB_POS', label: 'AB+' },
  { key: 'AB_NEG', label: 'AB−' },
  { key: 'O_POS', label: 'O+' },
  { key: 'O_NEG', label: 'O−' }
];

function getArmyBloodGroupCatalog() {
  return ARMY_BLOOD_GROUP_CATALOG.map((row) => ({ ...row }));
}

function isAllowedArmyBloodGroupKey(key) {
  if (!key) return true;
  return ARMY_BLOOD_GROUP_CATALOG.some((row) => row.key === String(key).trim().toUpperCase());
}

module.exports = {
  getArmyBloodGroupCatalog,
  isAllowedArmyBloodGroupKey
};
