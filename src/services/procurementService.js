const sql = require('mssql')

/**
 * Resolve procurement mode: category override > store override > global default.
 * Keys: pos_procurement_mode_cat_{productTypeKey}, pos_procurement_mode_store_{storeId}, pos_procurement_mode
 */
async function resolveProcurementMode(pool, storeId, productTypeKey) {
  const sid = Number(storeId)
  const pt = String(productTypeKey || '').trim()
  if (!pt || !Number.isFinite(sid) || sid <= 0) {
    const fallback = await readSetting(pool, 'pos_procurement_mode')
    return fallback || 'STORE'
  }

  const catKey = `pos_procurement_mode_cat_${pt}`
  const catVal = await readSetting(pool, catKey)
  if (catVal) return catVal

  const storeKey = `pos_procurement_mode_store_${sid}`
  const storeVal = await readSetting(pool, storeKey)
  if (storeVal) return storeVal

  const globalVal = await readSetting(pool, 'pos_procurement_mode')
  return globalVal || 'STORE'
}

async function readSetting(pool, settingKey) {
  const result = await pool.request()
    .input('k', sql.VarChar(100), settingKey)
    .query('SELECT setting_value FROM dbo.app_settings WHERE setting_key = @k')
  const row = result.recordset && result.recordset[0]
  if (!row || row.setting_value == null || String(row.setting_value).trim() === '') return null
  return String(row.setting_value).trim()
}

module.exports = {
  resolveProcurementMode,
  readSetting
}
