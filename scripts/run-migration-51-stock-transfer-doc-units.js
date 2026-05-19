/**
 * Unit-aware transfer tables + sku_units location columns.
 * Usage: npm run migrate:51-stock-transfer-doc-units
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
  options: { encrypt: false, trustServerCertificate: true },
  requestTimeout: Math.max(120000, Number(process.env.DB_REQUEST_TIMEOUT_MS || 120000))
}

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env')
    process.exit(1)
  }
  const file = path.join(__dirname, '..', 'sql', 'migrations', '51_stock_transfer_doc_units_and_unit_location.sql')
  const source = fs.readFileSync(file, 'utf8')
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (const batch of batches) {
      await pool.request().query(batch)
    }
    console.log('[migration-51] OK — ran', batches.length, 'batch(es).')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migration-51]', err.message || err)
  process.exit(1)
})
