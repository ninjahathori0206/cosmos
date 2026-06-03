'use strict';

/** Onboarding checklist items (PRD §5.2) — tracked per employee. */
const ARMY_EMPLOYEE_ONBOARDING_ITEM_CATALOG = [
  { key: 'PROFILE_PHOTO', label: 'Profile photo uploaded', sort_order: 1 },
  { key: 'AADHAAR_VERIFIED', label: 'Aadhaar verified', sort_order: 2 },
  { key: 'PAN_UPLOADED', label: 'PAN uploaded', sort_order: 3 },
  { key: 'BANK_DETAILS', label: 'Bank details added', sort_order: 4 },
  { key: 'EMERGENCY_CONTACT', label: 'Emergency contact added', sort_order: 5 },
  { key: 'CONTRACT_SIGNED', label: 'Contract signed', sort_order: 6 },
  { key: 'ORIENTATION_COMPLETED', label: 'Orientation completed', sort_order: 7 },
  { key: 'DAY1_TRAINING', label: 'Day 1 training assigned', sort_order: 8 }
];

const ARMY_EMPLOYEE_ONBOARDING_ITEM_KEYS = ARMY_EMPLOYEE_ONBOARDING_ITEM_CATALOG.map((row) => row.key);

function getArmyEmployeeOnboardingItemCatalog() {
  return ARMY_EMPLOYEE_ONBOARDING_ITEM_CATALOG.map((row) => ({ ...row }));
}

function getArmyEmployeeOnboardingItemByKey(key) {
  const normalized = String(key || '').trim().toUpperCase();
  return ARMY_EMPLOYEE_ONBOARDING_ITEM_CATALOG.find((row) => row.key === normalized) || null;
}

function isAllowedArmyEmployeeOnboardingItemKey(key) {
  return ARMY_EMPLOYEE_ONBOARDING_ITEM_KEYS.includes(String(key || '').trim().toUpperCase());
}

module.exports = {
  ARMY_EMPLOYEE_ONBOARDING_ITEM_CATALOG,
  ARMY_EMPLOYEE_ONBOARDING_ITEM_KEYS,
  getArmyEmployeeOnboardingItemCatalog,
  getArmyEmployeeOnboardingItemByKey,
  isAllowedArmyEmployeeOnboardingItemKey
};
