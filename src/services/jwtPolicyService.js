'use strict'

/**
 * Globally bumps invalid "old" JWTs by comparing payload token_issued_at (unix seconds)
 * to dbo.app_settings.jwt_min_issue_epoch (set by migrations or future admin tooling).
 */

const { getPool } = require('../config/db')
const { readSetting } = require('./procurementService')

let cacheMinIssUnix = null
let cacheExpiryMs = 0

/** @returns {Promise<number>} */
async function getJwtMinimumIssueEpochUnix() {
  const now = Date.now()
  const ttl = Math.max(2000, parseInt(process.env.JWT_MIN_EPOCH_CACHE_MS || '8000', 10))
  if (cacheMinIssUnix != null && now < cacheExpiryMs) return cacheMinIssUnix
  try {
    const pool = await getPool()
    const raw = await readSetting(pool, 'jwt_min_issue_epoch')
    const v = Math.max(0, Math.floor(Number(String(raw || '').trim()) || 0))
    cacheMinIssUnix = v
    cacheExpiryMs = now + ttl
    return v
  } catch (_e) {
    cacheMinIssUnix = 0
    cacheExpiryMs = now + ttl
    return 0
  }
}

/** After updating jwt_min_issue_epoch in DB, clear cache so next request sees it. */
function clearJwtMinimumEpochCache() {
  cacheMinIssUnix = null
  cacheExpiryMs = 0
}

/**
 * @param {object|null|undefined} decoded
 * @param {number} minIssUnix From getJwtMinimumIssueEpochUnix(); 0 = skip check (legacy/off).
 */
function isTokenIssuedAtValid(decoded, minIssUnix) {
  if (!Number.isFinite(minIssUnix) || minIssUnix <= 0) return true
  const t = Number(decoded && decoded.token_issued_at)
  if (!Number.isFinite(t) || t <= 0) return false
  return t >= minIssUnix
}

function nowUnixSec() {
  return Math.floor(Date.now() / 1000)
}

module.exports = {
  getJwtMinimumIssueEpochUnix,
  clearJwtMinimumEpochCache,
  isTokenIssuedAtValid,
  nowUnixSec
}
