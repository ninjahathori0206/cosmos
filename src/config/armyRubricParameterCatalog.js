'use strict';

/** Default interview rubric parameters (PRD §5.1.4). */
const ARMY_RUBRIC_PARAMETER_CATALOG = [
  { key: 'COMMUNICATION', label: 'Communication Skills', min: 1, max: 10 },
  { key: 'DOMAIN_KNOWLEDGE', label: 'Product / Domain Knowledge', min: 1, max: 10 },
  { key: 'ATTITUDE', label: 'Attitude & Professionalism', min: 1, max: 10 },
  { key: 'EXPERIENCE', label: 'Relevant Experience', min: 1, max: 10 },
  { key: 'CULTURE_FIT', label: 'Culture Fit', min: 1, max: 10 }
];

const ARMY_RUBRIC_PARAMETER_KEYS = ARMY_RUBRIC_PARAMETER_CATALOG.map((row) => row.key);

function getArmyRubricParameterCatalog() {
  return ARMY_RUBRIC_PARAMETER_CATALOG.map((row) => ({ ...row }));
}

function isAllowedArmyRubricParameterKey(key) {
  return ARMY_RUBRIC_PARAMETER_KEYS.includes(String(key || '').trim().toUpperCase());
}

function validateRubricScores(scores) {
  const normalized = {};
  for (const param of ARMY_RUBRIC_PARAMETER_CATALOG) {
    const raw = scores && scores[param.key];
    const num = Number(raw);
    if (!Number.isFinite(num) || num < param.min || num > param.max) {
      const err = new Error('Score required (1–10) for: ' + param.label);
      err.statusCode = 400;
      throw err;
    }
    normalized[param.key] = Math.round(num);
  }
  return normalized;
}

function computeAggregateScore(scores) {
  const vals = ARMY_RUBRIC_PARAMETER_KEYS.map((k) => scores[k]);
  const sum = vals.reduce((a, b) => a + b, 0);
  return Math.round((sum / vals.length) * 10) / 10;
}

module.exports = {
  ARMY_RUBRIC_PARAMETER_CATALOG,
  ARMY_RUBRIC_PARAMETER_KEYS,
  getArmyRubricParameterCatalog,
  isAllowedArmyRubricParameterKey,
  validateRubricScores,
  computeAggregateScore
};
