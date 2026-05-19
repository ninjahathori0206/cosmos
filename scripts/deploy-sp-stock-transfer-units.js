/**
 * Deploy unit-aware stock transfer SPs
 * Usage: npm run deploy:sp-stock-transfer-units
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

const files = [
  'sql/sp/stock_transfers.sql',
  'sql/sp/stock_transfer_docs.sql'
]

function batchesFromFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8')
  return source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
}

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env')
    process.exit(1)
  }
  const pool = await sql.connect(config)
  try {
    for (const rel of files) {
      const full = path.join(__dirname, '..', rel)
      const batches = batchesFromFile(full)
      console.log('[deploy-sp-stock-transfer-units]', rel, '→', batches.length, 'batch(es)')
      for (const batch of batches) {
        await pool.request().query(batch)
      }
    }
    console.log('[deploy-sp-stock-transfer-units] OK')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[deploy-sp-stock-transfer-units]', err.message || err)
  process.exit(1)
})
