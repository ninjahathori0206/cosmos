'use strict'
/**
 * Runs verify_pos_store_catalogue_brand logic against .env DB.
 * Picks first store_id with positive stock; filters BLN-% or EW-% SKUs.
 */
require('dotenv').config()
const sql = require('mssql')
const { getPool } = require('../src/config/db')

const DIAGNOSTIC_SQL = `
SELECT TOP 50
  sk.sku_id,
  sk.sku_code,
  pm.product_id,
  pm.home_brand_id,
  hb.brand_name AS home_brand_name_raw,
  pm.source_brand,
  mm.maker_name,
  LTRIM(RTRIM(COALESCE(
    NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
    NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
    NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
    ''
  ))) AS resolved_brand_name_same_as_pos,
  pm.ew_collection,
  pm.style_model,
  sb.qty AS store_qty
FROM dbo.stock_balances sb
JOIN dbo.skus sk ON sk.sku_id = sb.sku_id AND sk.status IN ('LIVE', 'ACTIVE')
JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
LEFT JOIN dbo.maker_master mm ON mm.maker_id = pm.maker_master_id
WHERE sb.location_type = N'STORE'
  AND sb.location_id = @store_id
  AND sb.qty > 0
  AND (sk.sku_code LIKE N'BLN-%' OR sk.sku_code LIKE N'EW-%')
ORDER BY sk.sku_code
`

const FALLBACK_SQL = `
SELECT TOP 20
  sk.sku_code,
  pm.product_id,
  pm.home_brand_id,
  hb.brand_name AS home_brand_name_raw,
  pm.source_brand,
  LTRIM(RTRIM(COALESCE(
    NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
    NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
    NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
    ''
  ))) AS resolved_brand_name_same_as_pos,
  pm.style_model
FROM dbo.stock_balances sb
JOIN dbo.skus sk ON sk.sku_id = sb.sku_id AND sk.status IN ('LIVE', 'ACTIVE')
JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
LEFT JOIN dbo.maker_master mm ON mm.maker_id = pm.maker_master_id
WHERE sb.location_type = N'STORE'
  AND sb.location_id = @store_id
  AND sb.qty > 0
ORDER BY sk.sku_code
`

async function main() {
  const pool = await getPool()

  const sidResult = await pool.request().query(`
    SELECT TOP 1 sb.location_id AS store_id
    FROM dbo.stock_balances sb
    JOIN dbo.skus sk ON sk.sku_id = sb.sku_id AND sk.status IN ('LIVE', 'ACTIVE')
    WHERE sb.location_type = N'STORE' AND sb.qty > 0
    ORDER BY sb.location_id
  `)
  let storeId = sidResult.recordset[0] && sidResult.recordset[0].store_id
  if (storeId == null) {
    const alt = await pool.request().query(`
      SELECT TOP 1 store_id FROM dbo.stores ORDER BY store_id
    `)
    storeId = alt.recordset[0] && alt.recordset[0].store_id
  }
  if (storeId == null) {
    console.error('Could not resolve a store_id (no stock_balances and no stores row).')
    process.exit(1)
  }

  console.log('Using store_id =', storeId, '\n')

  const r2 = await pool.request().input('store_id', sql.Int, storeId).query(DIAGNOSTIC_SQL)
  const rows = r2.recordset || []
  if (!rows.length) {
    console.log('No in-stock SKUs matching BLN-% or EW-% for this store. First 20 in-stock SKUs:\n')
    const r3 = await pool.request().input('store_id', sql.Int, storeId).query(FALLBACK_SQL)
    console.table(r3.recordset || [])
    process.exit(0)
  }

  console.table(rows)
  const ew = rows.filter((x) => String(x.resolved_brand_name_same_as_pos || '').toUpperCase() === 'EW')
  const blnk = rows.filter((x) => String(x.resolved_brand_name_same_as_pos || '').toUpperCase() === 'BLNK')
  console.log('\nSummary: rows=', rows.length, '| resolved EW=', ew.length, '| resolved BLNK=', blnk.length)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
