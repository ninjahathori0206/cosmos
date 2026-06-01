'use strict';

const ARMY_JOINING_AVAILABILITY_CATALOG = [
  { key: 'INSTANT', label: 'Can join immediately' },
  { key: 'ON_NOTICE', label: 'On notice period' }
];

const ARMY_JOINING_AVAILABILITY_KEYS = ARMY_JOINING_AVAILABILITY_CATALOG.map((row) => row.key);

function getArmyJoiningAvailabilityCatalog() {
  return ARMY_JOINING_AVAILABILITY_CATALOG.map((row) => ({ ...row }));
}

function isAllowedArmyJoiningAvailabilityKey(key) {
  return ARMY_JOINING_AVAILABILITY_KEYS.includes(String(key || '').trim().toUpperCase());
}

function getArmyJoiningAvailabilityByKey(key) {
  const normalized = String(key || '').trim().toUpperCase();
  return ARMY_JOINING_AVAILABILITY_CATALOG.find((row) => row.key === normalized) || null;
}

module.exports = {
  ARMY_JOINING_AVAILABILITY_CATALOG,
  ARMY_JOINING_AVAILABILITY_KEYS,
  getArmyJoiningAvailabilityCatalog,
  isAllowedArmyJoiningAvailabilityKey,
  getArmyJoiningAvailabilityByKey
};
