/**
 * Migration 93 — eye_tests Rx v2 (visitor + family name links)
 * Usage: npm run migrate:93-eye-tests-rx-v2
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

async function main () {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env')
    process.exit(1)
  }
  const migFile = path.join(__dirname, '..', 'sql', 'migrations', '93_eye_tests_rx_v2.sql')
  const batches = fs.readFileSync(migFile, 'utf8').split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (const batch of batches) await pool.request().query(batch)
    console.log('[migration-93] OK')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migration-93]', err.message || err)
  process.exit(1)
})
