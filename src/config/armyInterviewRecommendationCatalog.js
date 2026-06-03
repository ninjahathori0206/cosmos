'use strict';

const ARMY_INTERVIEW_RECOMMENDATION_CATALOG = [
  { key: 'PROCEED', label: 'Proceed', badgeClass: 'b-green' },
  { key: 'HOLD', label: 'Hold', badgeClass: 'b-gold' },
  { key: 'REJECT', label: 'Reject', badgeClass: 'b-red' }
];

const ARMY_INTERVIEW_RECOMMENDATION_KEYS = ARMY_INTERVIEW_RECOMMENDATION_CATALOG.map((row) => row.key);

function getArmyInterviewRecommendationCatalog() {
  return ARMY_INTERVIEW_RECOMMENDATION_CATALOG.map((row) => ({ ...row }));
}

function getArmyInterviewRecommendationByKey(key) {
  const normalized = String(key || '').trim().toUpperCase();
  return ARMY_INTERVIEW_RECOMMENDATION_CATALOG.find((row) => row.key === normalized) || null;
}

function isAllowedArmyInterviewRecommendationKey(key) {
  return ARMY_INTERVIEW_RECOMMENDATION_KEYS.includes(String(key || '').trim().toUpperCase());
}

module.exports = {
  ARMY_INTERVIEW_RECOMMENDATION_CATALOG,
  ARMY_INTERVIEW_RECOMMENDATION_KEYS,
  getArmyInterviewRecommendationCatalog,
  getArmyInterviewRecommendationByKey,
  isAllowedArmyInterviewRecommendationKey
};
