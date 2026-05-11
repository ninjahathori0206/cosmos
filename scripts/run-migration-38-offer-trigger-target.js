/**
 * Adds trigger_type, trigger_value, benefit_target, max_discount_amount, scope_mode
 * on dbo.customer_offers (and is_exclusion on customer_offer_scope).
 * Safe to re-run — no-op when columns exist.
 *
 * Usage: npm run migrate:38-offer-trigger-target
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
  const file = path.join(__dirname, '..', 'sql', 'migrations', '38_offer_trigger_target.sql')
  const source = fs.readFileSync(file, 'utf8')
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (const batch of batches) {
      await pool.request().query(batch)
    }
    console.log('[migration-38] OK — ran', batches.length, 'batch(es).')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migration-38] FAILED:', err.message)
  process.exit(1)
})
