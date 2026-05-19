/**
 * Deploy sp_SKUv2_Generate (with unit allocation) + sp_StockTransfer_LookupByCode + sp_POS_GetStartupConfig
 * Usage: npm run deploy:sp-sku-units
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

const files = [
  'sql/sp/stock_transfers.sql',
  'sql/sp/pos.sql'
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
      if (!fs.existsSync(full)) {
        console.warn('skip missing', rel)
        continue
      }
      const batches = batchesFromFile(full)
      console.log('[deploy-sp-sku-units]', rel, '→', batches.length, 'batch(es)')
      for (const batch of batches) {
        await pool.request().query(batch)
      }
    }
    console.log('[deploy-sp-sku-units] OK')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[deploy-sp-sku-units]', err.message || err)
  process.exit(1)
})
