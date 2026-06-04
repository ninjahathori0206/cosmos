'use strict';

/** Allowed badge variants for GatePass purpose pills (UI + SQL validation). */
const GATEPASS_PURPOSE_BADGE_VARIANTS = [
  { key: 'blue', label: 'Blue' },
  { key: 'purple', label: 'Purple' },
  { key: 'amber', label: 'Amber' },
  { key: 'gray', label: 'Gray' },
  { key: 'green', label: 'Green' },
  { key: 'teal', label: 'Teal' },
  { key: 'red', label: 'Red' },
  { key: 'orange', label: 'Orange' }
];

const BADGE_KEY_SET = new Set(GATEPASS_PURPOSE_BADGE_VARIANTS.map((b) => b.key));

function getGatepassPurposeBadgeVariants() {
  return GATEPASS_PURPOSE_BADGE_VARIANTS.map((b) => ({ ...b }));
}

function isValidGatepassPurposeBadgeVariant(key) {
  return BADGE_KEY_SET.has(String(key || '').trim().toLowerCase());
}

module.exports = {
  GATEPASS_PURPOSE_BADGE_VARIANTS,
  BADGE_KEY_SET,
  getGatepassPurposeBadgeVariants,
  isValidGatepassPurposeBadgeVariant
};
