/**
 * Adds capability columns on dbo.membership_plans (has_plus_access,
 * extra_cashback_pct, flat_discount_pct, has_one_time_discount,
 * one_time_discount_pct, can_create_sub_cards, validity_type).
 * Safe to re-run — idempotent.
 *
 * Usage: npm run migrate:72-membership-plans-capabilities
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
  const file = path.join(__dirname, '..', 'sql', 'migrations', '72_membership_plans_capabilities.sql')
  const source = fs.readFileSync(file, 'utf8')
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (const batch of batches) {
      await pool.request().query(batch)
    }
    console.log('[migration-72] OK — ran', batches.length, 'batch(es).')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migration-72] FAILED:', err.message)
  process.exit(1)
})
