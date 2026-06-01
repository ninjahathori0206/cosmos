'use strict';

const ARMY_INTERVIEWER_ROLE_CATALOG = [
  { key: 'HR_ADMIN', label: 'HR Admin' },
  { key: 'STORE_MANAGER', label: 'Store Manager' },
  { key: 'REGIONAL_MANAGER', label: 'Regional Manager' },
  { key: 'HQ_PANEL', label: 'HQ / Final panel' },
  { key: 'TECHNICAL', label: 'Technical assessor' }
];

const ARMY_INTERVIEWER_ROLE_KEYS = ARMY_INTERVIEWER_ROLE_CATALOG.map((row) => row.key);

function getArmyInterviewerRoleCatalog() {
  return ARMY_INTERVIEWER_ROLE_CATALOG.map((row) => ({ ...row }));
}

function isAllowedArmyInterviewerRoleKey(key) {
  return ARMY_INTERVIEWER_ROLE_KEYS.includes(String(key || '').trim().toUpperCase());
}

function getArmyInterviewerRoleByKey(key) {
  const normalized = String(key || '').trim().toUpperCase();
  return ARMY_INTERVIEWER_ROLE_CATALOG.find((row) => row.key === normalized) || null;
}

module.exports = {
  ARMY_INTERVIEWER_ROLE_CATALOG,
  ARMY_INTERVIEWER_ROLE_KEYS,
  getArmyInterviewerRoleCatalog,
  isAllowedArmyInterviewerRoleKey,
  getArmyInterviewerRoleByKey
};
