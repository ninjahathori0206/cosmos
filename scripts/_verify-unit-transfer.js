'use strict'
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

async function main() {
  const pool = await sql.connect(config)
  const tables = await pool.request().query(`
    SELECT OBJECT_ID(N'dbo.stock_transfer_doc_units') AS doc_units_tbl,
           COL_LENGTH(N'dbo.sku_units', N'location_type') AS loc_type_col
  `)
  console.log('schema:', tables.recordset[0])

  try {
    const r = await pool.request().input('code', sql.VarChar(200), '0001711')
      .execute('sp_StockTransfer_LookupByCode')
    const row = r.recordset && r.recordset[0]
    console.log('lookup 0001711:', row ? {
      sku_code: row.sku_code,
      unit_id: row.unit_id,
      unit_status: row.unit_status,
      requires_unit_barcode: row.requires_unit_barcode,
      warehouse_qty: row.warehouse_qty
    } : null)
  } catch (e) {
    console.log('lookup 0001711 error (expected if unit not at WH):', e.message)
  }

  await pool.close()
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
