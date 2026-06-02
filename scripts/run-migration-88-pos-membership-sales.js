/**
 * Migration 88 — pos_membership_sales + pos_membership_payments (M-invoice model)
 * Usage: npm run migrate:88-pos-membership-sales
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
  const file = path.join(__dirname, '..', 'sql', 'migrations', '88_pos_membership_sales.sql')
  const batches = fs.readFileSync(file, 'utf8').split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (const batch of batches) await pool.request().query(batch)
    console.log('[migration-88] OK — pos_membership_sales tables and link columns.')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migration-88]', err.message || err)
  process.exit(1)
})
