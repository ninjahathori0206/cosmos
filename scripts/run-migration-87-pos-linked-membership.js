/**
 * Migration 87 — pos_orders.linked_membership_order_id (dual membership invoice)
 * Usage: npm run migrate:87-pos-linked-membership
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
  const file = path.join(__dirname, '..', 'sql', 'migrations', '87_pos_orders_linked_membership.sql')
  const batches = fs.readFileSync(file, 'utf8').split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (const batch of batches) await pool.request().query(batch)
    console.log('[migration-87] OK — linked_membership_order_id columns.')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migration-87]', err.message || err)
  process.exit(1)
})
