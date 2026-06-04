/**
 * Migration 96 — drop legacy membership_tiers
 * Usage: node scripts/run-migration-96-drop-membership-tiers.js
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
  const migFile = path.join(__dirname, '..', 'sql', 'migrations', '96_drop_membership_tiers.sql')
  const batches = fs.readFileSync(migFile, 'utf8').split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (const batch of batches) await pool.request().query(batch)
    const check = await pool.request().query(`
      SELECT OBJECT_ID('dbo.membership_tiers', 'U') AS tiers_tbl,
             COL_LENGTH('dbo.membership_plans', 'tier_id') AS tier_id_col
    `)
    console.log('[migration-96] OK', check.recordset[0])
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migration-96]', err.message || err)
  process.exit(1)
})
