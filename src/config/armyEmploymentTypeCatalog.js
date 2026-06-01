'use strict';

/** Army HR — employment type catalogue (job openings + careers portal). */
const ARMY_EMPLOYMENT_TYPE_CATALOG = [
  { key: 'FULL_TIME', label: 'Full-time' },
  { key: 'PART_TIME', label: 'Part-time' },
  { key: 'CONTRACT', label: 'Contract' }
];

const ARMY_EMPLOYMENT_TYPE_KEYS = ARMY_EMPLOYMENT_TYPE_CATALOG.map((row) => row.key);

function getArmyEmploymentTypeCatalog() {
  return ARMY_EMPLOYMENT_TYPE_CATALOG.map((row) => ({ ...row }));
}

function getArmyEmploymentTypeByKey(key) {
  const normalized = String(key || '').trim().toUpperCase();
  return ARMY_EMPLOYMENT_TYPE_CATALOG.find((row) => row.key === normalized) || null;
}

function isAllowedArmyEmploymentTypeKey(key) {
  return ARMY_EMPLOYMENT_TYPE_KEYS.includes(String(key || '').trim().toUpperCase());
}

module.exports = {
  ARMY_EMPLOYMENT_TYPE_CATALOG,
  ARMY_EMPLOYMENT_TYPE_KEYS,
  getArmyEmploymentTypeCatalog,
  getArmyEmploymentTypeByKey,
  isAllowedArmyEmploymentTypeKey
};
