/**
 * Installs dbo.fn_Foundry_PrimaryWarehouseLocationId + dbo.fn_Foundry_WarehouseDisplayName
 * and bootstraps app_settings.foundry_primary_warehouse_location_id when absent.
 *
 * Usage: npm run migrate:46-foundry-primary-warehouse-functions
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
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
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env — cannot connect.')
    process.exit(1)
  }
  const file = path.join(__dirname, '..', 'sql', 'migrations', '46_foundry_primary_warehouse_functions.sql')
  const source = fs.readFileSync(file, 'utf8')
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (const batch of batches) {
      await pool.request().query(batch)
    }
    console.log('[migration-46] OK — ran', batches.length, 'batch(es). Redeploy sql/sp/stock_transfers.sql and sql/sp/stock_transfer_docs.sql if needed.')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migration-46]', err.message || err)
  process.exit(1)
})
