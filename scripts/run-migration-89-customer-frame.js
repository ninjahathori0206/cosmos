/**
 * Migration 89 — Customer frame lens (product type, order item photo columns)
 * Usage: node scripts/run-migration-89-customer-frame.js
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

async function runBatches(pool, filePath, label) {
  const batches = fs.readFileSync(filePath, 'utf8').split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  for (const batch of batches) await pool.request().query(batch)
  console.log('[migration-89] OK — ' + label)
}

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env')
    process.exit(1)
  }
  const root = path.join(__dirname, '..')
  const pool = await sql.connect(config)
  try {
    await runBatches(pool, path.join(root, 'sql', 'migrations', '89_customer_frame_lens.sql'), 'Customer frame lens')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migration-89]', err.message || err)
  process.exit(1)
})
