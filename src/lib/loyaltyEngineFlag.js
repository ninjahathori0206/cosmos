/**
 * Feature flag: loyalty_engine_v2 in app_settings ('1' = new loyalty_ledger engine).
 */
const { getPool } = require('../config/db')

let _cached = null
let _cachedAt = 0
const CACHE_MS = 30_000

async function isLoyaltyEngineV2Enabled (poolOptional) {
  const now = Date.now()
  if (_cached !== null && now - _cachedAt < CACHE_MS) return _cached

  const pool = poolOptional || (await getPool())
  try {
    const r = await pool.request().query(`
      SELECT setting_value FROM dbo.app_settings WHERE setting_key = N'loyalty_engine_v2'
    `)
    const v = r.recordset[0] ? String(r.recordset[0].setting_value || '').trim() : ''
    _cached = v === '1' || v.toLowerCase() === 'true'
    _cachedAt = now
    return _cached
  } catch (_) {
    return false
  }
}

function clearLoyaltyEngineFlagCache () {
  _cached = null
  _cachedAt = 0
}

module.exports = { isLoyaltyEngineV2Enabled, clearLoyaltyEngineFlagCache }
