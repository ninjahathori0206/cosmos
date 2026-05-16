/**
 * Redeploys SKU / store catalogue + stock transfer + finance + doc line procs so
 * brand_name = home brand → source_brand → maker (same as POS / Foundry SKU catalogue).
 *
 * Usage: npm run migrate:49-product-card-display-brand
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

const FILES = [
  'sql/alter/21_sku_stock_distribution.sql',
  'sql/alter/26_store_catalogue_sp.sql',
  'sql/sp/stock_transfers.sql',
  'sql/sp/transfer_requests.sql',
  'sql/alter/49b_finance_item_finance_display_brand.sql',
  'sql/sp/stock_transfer_docs.sql'
]

async function runBatches(pool, absPath, label) {
  const source = fs.readFileSync(absPath, 'utf8')
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  for (const batch of batches) {
    await pool.request().query(batch)
  }
  console.log('[migrate-49-product-card-brand]', label, batches.length, 'batch(es).')
}

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env — cannot connect.')
    process.exit(1)
  }
  const root = path.join(__dirname, '..')

  const pool = await sql.connect(config)
  try {
    for (const rel of FILES) {
      const abs = path.join(root, rel)
      if (!fs.existsSync(abs)) {
        console.error('Missing file:', abs)
        process.exit(1)
      }
      await runBatches(pool, abs, rel)
    }
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migrate-49-product-card-brand]', err.message || err)
  process.exit(1)
})
