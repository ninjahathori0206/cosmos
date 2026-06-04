'use strict';

/**
 * GatePass visit purpose — static fallbacks + async DB catalog via gatepassPurposeCatalogService.
 * @typedef {{ key: string, label: string, badgeVariant: string }} GatepassPurposeDef
 */

const {
  FALLBACK_SEED,
  getGatepassPurposeCatalogForApi,
  getGatepassPurposeMeta: getMetaAsync,
  isValidGatepassPurpose: isValidAsync,
  getCatalogRows
} = require('../services/gatepassPurposeCatalogService');

/** @type {GatepassPurposeDef[]} — legacy sync export for tests/scripts */
const GATEPASS_PURPOSE_CATALOG = FALLBACK_SEED.map((r) => ({
  key: r.key,
  label: r.label,
  badgeVariant: r.badgeVariant
}));

const GATEPASS_PURPOSE_KEYS = GATEPASS_PURPOSE_CATALOG.map((p) => p.key);

/** @deprecated sync — use getGatepassPurposeCatalogAsync; returns fallback only */
function getGatepassPurposeCatalog() {
  return GATEPASS_PURPOSE_CATALOG.slice();
}

function getGatepassPurposeKeys() {
  return GATEPASS_PURPOSE_KEYS.slice();
}

/** @deprecated sync — returns fallback meta only */
function getGatepassPurposeMeta(key) {
  const k = String(key || '').trim().toLowerCase();
  return GATEPASS_PURPOSE_CATALOG.find((p) => p.key === k) || null;
}

/** @deprecated sync — validates against fallback keys only */
function isValidGatepassPurpose(key) {
  if (key == null || String(key).trim() === '') return true;
  return GATEPASS_PURPOSE_KEYS.includes(String(key).trim().toLowerCase());
}

async function getGatepassPurposeCatalogAsync(opts) {
  return getGatepassPurposeCatalogForApi(opts);
}

module.exports = {
  GATEPASS_PURPOSE_CATALOG,
  GATEPASS_PURPOSE_KEYS,
  getGatepassPurposeCatalog,
  getGatepassPurposeKeys,
  getGatepassPurposeMeta,
  isValidGatepassPurpose,
  getGatepassPurposeCatalogAsync,
  getGatepassPurposeMetaAsync: getMetaAsync,
  isValidGatepassPurposeAsync: isValidAsync,
  getCatalogRows
};
