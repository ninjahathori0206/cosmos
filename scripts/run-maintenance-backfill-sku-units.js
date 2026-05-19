/**
 * Backfill sku_units for existing SKUs
 * Usage: npm run maintenance:backfill-sku-units
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
    console.error('Missing DB_NAME or DB_USER in .env')
    process.exit(1)
  }
  const file = path.join(__dirname, '..', 'sql', 'maintenance', 'backfill_sku_units.sql')
  const source = fs.readFileSync(file, 'utf8')
  const pool = await sql.connect(config)
  try {
    await pool.request().query(source)
    console.log('[backfill-sku-units] OK')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[backfill-sku-units]', err.message || err)
  process.exit(1)
})
