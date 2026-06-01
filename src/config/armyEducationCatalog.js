'use strict';

const ARMY_EDUCATION_CATALOG = [
  { key: 'TENTH', label: '10th / SSC' },
  { key: 'TWELFTH', label: '12th / HSC' },
  { key: 'GRADUATE', label: 'Graduate' },
  { key: 'POST_GRADUATE', label: 'Post-Graduate' },
  { key: 'OTHER', label: 'Other' }
];

const ARMY_EDUCATION_KEYS = ARMY_EDUCATION_CATALOG.map((row) => row.key);

function getArmyEducationCatalog() {
  return ARMY_EDUCATION_CATALOG.map((row) => ({ ...row }));
}

function isAllowedArmyEducationKey(key) {
  return ARMY_EDUCATION_KEYS.includes(String(key || '').trim().toUpperCase());
}

module.exports = {
  ARMY_EDUCATION_CATALOG,
  ARMY_EDUCATION_KEYS,
  getArmyEducationCatalog,
  isAllowedArmyEducationKey
};
