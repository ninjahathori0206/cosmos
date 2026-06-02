'use strict';

/**
 * GatePass visit purpose keys — single source for UI badges and API validation.
 * @typedef {{ key: string, label: string, badgeVariant: string }} GatepassPurposeDef
 */

/** @type {GatepassPurposeDef[]} */
const GATEPASS_PURPOSE_CATALOG = [
  { key: 'order', label: 'Buying frames', badgeVariant: 'blue' },
  { key: 'eye_test', label: 'Eye test', badgeVariant: 'purple' },
  { key: 'handover', label: 'Collecting order', badgeVariant: 'amber' },
  { key: 'general', label: 'General', badgeVariant: 'gray' }
];

const GATEPASS_PURPOSE_KEYS = GATEPASS_PURPOSE_CATALOG.map((p) => p.key);

function getGatepassPurposeCatalog() {
  return GATEPASS_PURPOSE_CATALOG.slice();
}

function getGatepassPurposeKeys() {
  return GATEPASS_PURPOSE_KEYS.slice();
}

function getGatepassPurposeMeta(key) {
  const k = String(key || '').trim().toLowerCase();
  return GATEPASS_PURPOSE_CATALOG.find((p) => p.key === k) || null;
}

function isValidGatepassPurpose(key) {
  if (key == null || String(key).trim() === '') return true;
  return GATEPASS_PURPOSE_KEYS.includes(String(key).trim().toLowerCase());
}

module.exports = {
  GATEPASS_PURPOSE_CATALOG,
  GATEPASS_PURPOSE_KEYS,
  getGatepassPurposeCatalog,
  getGatepassPurposeKeys,
  getGatepassPurposeMeta,
  isValidGatepassPurpose
};
