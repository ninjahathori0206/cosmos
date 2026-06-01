'use strict';

const ARMY_INTERVIEW_MODE_CATALOG = [
  { key: 'IN_PERSON', label: 'In-person' }
];

const ARMY_INTERVIEW_MODE_KEYS = ARMY_INTERVIEW_MODE_CATALOG.map((row) => row.key);

function getArmyInterviewModeCatalog() {
  return ARMY_INTERVIEW_MODE_CATALOG.map((row) => ({ ...row }));
}

function isAllowedArmyInterviewModeKey(key) {
  return ARMY_INTERVIEW_MODE_KEYS.includes(String(key || '').trim().toUpperCase());
}

function getArmyInterviewModeByKey(key) {
  const normalized = String(key || '').trim().toUpperCase();
  return ARMY_INTERVIEW_MODE_CATALOG.find((row) => row.key === normalized) || null;
}

module.exports = {
  ARMY_INTERVIEW_MODE_CATALOG,
  ARMY_INTERVIEW_MODE_KEYS,
  getArmyInterviewModeCatalog,
  isAllowedArmyInterviewModeKey,
  getArmyInterviewModeByKey
};
