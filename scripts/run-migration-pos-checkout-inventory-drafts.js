/**
 * POS checkout: inventory_committed on pos_orders / oe_orders + pos_checkout_drafts.
 * Safe to re-run — no-op when columns/tables exist.
 *
 * Usage: npm run migrate:pos-checkout-inventory-drafts
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
  const file = path.join(__dirname, '..', 'sql', 'migrations', 'pos_checkout_inventory_drafts.sql')
  const source = fs.readFileSync(file, 'utf8')
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (const batch of batches) {
      await pool.request().query(batch)
    }
    console.log('[pos_checkout_inventory_drafts] OK — ran', batches.length, 'batch(es).')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[pos_checkout_inventory_drafts] FAILED:', err.message)
  process.exit(1)
})
