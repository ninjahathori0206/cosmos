'use strict';

/** Standard reading-glass diopter values sold power-wise (Readers category). */
const READING_POWER_KEYS = [
  '+1.00', '+1.25', '+1.50', '+1.75',
  '+2.00', '+2.25', '+2.50', '+2.75',
  '+3.00', '+3.25', '+3.50', '+3.75',
  '+4.00'
];

const READING_POWER_CATALOG = READING_POWER_KEYS.map(function (key) {
  return { key, label: key };
});

function getReadingPowerCatalog() {
  return READING_POWER_CATALOG.slice();
}

function getReadingPowerKeys() {
  return READING_POWER_KEYS.slice();
}

function isValidReadingPower(value) {
  if (value == null || value === '') return false;
  const v = String(value).trim();
  return READING_POWER_KEYS.indexOf(v) !== -1;
}

/** Sort reader SKUs / pills by numeric diopter ascending. */
function compareReadingPower(a, b) {
  const na = parseFloat(String(a || '').replace('+', '')) || 0;
  const nb = parseFloat(String(b || '').replace('+', '')) || 0;
  return na - nb;
}

module.exports = {
  READING_POWER_KEYS,
  READING_POWER_CATALOG,
  getReadingPowerCatalog,
  getReadingPowerKeys,
  isValidReadingPower,
  compareReadingPower
};
