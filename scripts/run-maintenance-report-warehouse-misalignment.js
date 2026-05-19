/**
 * Report WAREHOUSE stock at non-primary location_id (read-only).
 *
 * Usage:
 *   npm run maintenance:report-warehouse-misalignment
 *   node scripts/run-maintenance-report-warehouse-misalignment.js --sku-code=YOUR_SKU_CODE
 */
require('dotenv').config()
const sql = require('mssql')

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true }
}

function parseSkuCodeArg() {
  const arg = process.argv.find((a) => a.startsWith('--sku-code='))
  if (!arg) return null
  const v = arg.slice('--sku-code='.length).trim()
  return v || null
}

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env')
    process.exit(1)
  }

  const skuCode = parseSkuCodeArg()
  const pool = await sql.connect(config)
  try {
    const primaryQ = await pool.request().query(`
      SELECT
        dbo.fn_Foundry_PrimaryWarehouseLocationId() AS primary_warehouse_store_id,
        CAST(dbo.fn_Foundry_WarehouseDisplayName() AS NVARCHAR(200)) AS primary_warehouse_name,
        (SELECT setting_value FROM dbo.app_settings
         WHERE setting_key = N'foundry_primary_warehouse_location_id') AS app_setting_store_id
    `)
    console.log('[report-warehouse-misalignment] Primary hub:', primaryQ.recordset[0])

    const req = pool.request()
    req.input('sku_code', sql.VarChar(100), skuCode || null)
    const misaligned = await req.query(`
      DECLARE @primary INT = dbo.fn_Foundry_PrimaryWarehouseLocationId();
      IF @primary IS NULL
        THROW 50001, 'Primary warehouse is not configured.', 1;

      SELECT
        sk.sku_id,
        sk.sku_code,
        sb.location_id AS warehouse_store_id,
        s.store_name AS warehouse_store_name,
        s.store_type,
        sb.qty,
        sb.last_updated
      FROM dbo.stock_balances sb
      INNER JOIN dbo.skus sk ON sk.sku_id = sb.sku_id
      LEFT JOIN dbo.stores s ON s.store_id = sb.location_id
      WHERE sb.location_type = N'WAREHOUSE'
        AND sb.location_id <> @primary
        AND sb.qty > 0
        AND (@sku_code IS NULL OR sk.sku_code = @sku_code)
      ORDER BY sk.sku_code, sb.location_id;
    `)

    const rows = misaligned.recordset || []
    console.log('[report-warehouse-misalignment] Misaligned rows:', rows.length)
    if (rows.length) console.table(rows)
    else console.log('[report-warehouse-misalignment] OK — no WAREHOUSE stock outside primary hub.')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[report-warehouse-misalignment]', err.message || err)
  process.exit(1)
})
