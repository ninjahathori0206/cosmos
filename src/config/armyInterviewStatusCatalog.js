'use strict';

/** Per-stage interview status on army_application_interviews.status_key */
const ARMY_INTERVIEW_STATUS_CATALOG = [
  { key: 'PENDING', label: 'Pending', badgeClass: 'b-gray' },
  { key: 'SCHEDULED', label: 'Scheduled', badgeClass: 'b-blue' },
  { key: 'COMPLETED', label: 'Completed', badgeClass: 'b-green' },
  { key: 'SKIPPED', label: 'Skipped', badgeClass: 'b-gray' }
];

const ARMY_INTERVIEW_STATUS_KEYS = ARMY_INTERVIEW_STATUS_CATALOG.map((row) => row.key);

function getArmyInterviewStatusCatalog() {
  return ARMY_INTERVIEW_STATUS_CATALOG.map((row) => ({ ...row }));
}

function getArmyInterviewStatusByKey(key) {
  const normalized = String(key || '').trim().toUpperCase();
  return ARMY_INTERVIEW_STATUS_CATALOG.find((row) => row.key === normalized) || null;
}

function isAllowedArmyInterviewStatusKey(key) {
  return ARMY_INTERVIEW_STATUS_KEYS.includes(String(key || '').trim().toUpperCase());
}

module.exports = {
  ARMY_INTERVIEW_STATUS_CATALOG,
  ARMY_INTERVIEW_STATUS_KEYS,
  getArmyInterviewStatusCatalog,
  getArmyInterviewStatusByKey,
  isAllowedArmyInterviewStatusKey
};
