/**
 * Merge WAREHOUSE stock_balances into fn_Foundry_PrimaryWarehouseLocationId().
 *
 * Requires: COSMOS_ALIGN_WAREHOUSE_CONFIRM=I_UNDERSTAND
 *
 * Usage:
 *   COSMOS_ALIGN_WAREHOUSE_CONFIRM=I_UNDERSTAND npm run maintenance:align-warehouse-stock-to-primary
 * PowerShell:
 *   $env:COSMOS_ALIGN_WAREHOUSE_CONFIRM='I_UNDERSTAND'; npm run maintenance:align-warehouse-stock-to-primary
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const sql = require('mssql')

if (process.env.COSMOS_ALIGN_WAREHOUSE_CONFIRM !== 'I_UNDERSTAND') {
  console.error(
    'Refusing to run: set COSMOS_ALIGN_WAREHOUSE_CONFIRM=I_UNDERSTAND after reviewing the misalignment report.'
  )
  process.exit(1)
}

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true },
  requestTimeout: Math.max(120000, Number(process.env.DB_REQUEST_TIMEOUT_MS || 120000))
}

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env')
    process.exit(1)
  }

  const file = path.join(__dirname, '..', 'sql', 'maintenance', 'align_warehouse_stock_to_primary.sql')
  const source = fs.readFileSync(file, 'utf8')
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)

  const pool = await sql.connect(config)
  try {
    for (const batch of batches) {
      const result = await pool.request().query(batch)
      if (result.recordset && result.recordset.length) {
        console.log('[align-warehouse-stock]', result.recordset[0])
      }
    }
    console.log('[align-warehouse-stock] OK')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[align-warehouse-stock]', err.message || err)
  process.exit(1)
})
