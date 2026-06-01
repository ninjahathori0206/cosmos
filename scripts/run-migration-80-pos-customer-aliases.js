/**
 * Creates dbo.pos_customer_aliases (migration 80).
 * Run merge script before creating UQ_pos_customers_phone_active on production data.
 *
 * Usage: npm run migrate:80-pos-customer-aliases
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
  const file = path.join(__dirname, '..', 'sql', 'migrations', '80_pos_customer_phone_unique_aliases.sql')
  const source = fs.readFileSync(file, 'utf8')
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (const batch of batches) {
      await pool.request().query(batch)
    }
    console.log('[migration-80] OK —', batches.length, 'batch(es).')
    console.log('[migration-80] Next: node scripts/merge-duplicate-pos-customers-by-phone.js --dry-run')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migration-80] FAILED:', err.message)
  process.exit(1)
})
