/**
 * Redeploys sp_SKU_GetAll with display brand = home → source_brand → maker (SKU Catalogue).
 *
 * Usage: npm run migrate:39-sku-getall-display-brand
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

async function runBatches(pool, absPath, label) {
  const source = fs.readFileSync(absPath, 'utf8')
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  for (const batch of batches) {
    await pool.request().query(batch)
  }
  console.log('[migrate-39-sku-getall]', label, batches.length, 'batch(es).')
}

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env — cannot connect.')
    process.exit(1)
  }
  const root = path.join(__dirname, '..')
  const alter = path.join(root, 'sql', 'alter', '39_sku_getall_display_brand.sql')
  if (!fs.existsSync(alter)) {
    console.error('Missing file:', alter)
    process.exit(1)
  }

  const pool = await sql.connect(config)
  try {
    await runBatches(pool, alter, 'sql/alter/39_sku_getall_display_brand.sql')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migrate-39-sku-getall]', err.message || err)
  process.exit(1)
})
