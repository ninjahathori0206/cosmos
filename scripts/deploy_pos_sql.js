/**
 * Deploy POS stored procedures to MSSQL.
 * Usage: node scripts/deploy_pos_sql.js
 */
require('dotenv').config()
const fs   = require('fs')
const path = require('path')
const sql  = require('mssql')

const config = {
  server:   process.env.DB_HOST || 'localhost',
  port:     Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options:  { encrypt: false, trustServerCertificate: true }
}

async function run() {
  const pool = await sql.connect(config)

  const file   = path.join(__dirname, '..', 'sql', 'sp', 'pos.sql')
  const source = fs.readFileSync(file, 'utf8')

  // Split on GO statements (case-insensitive, optional whitespace)
  const batches = source.split(/^\s*GO\s*$/im).map(b => b.trim()).filter(Boolean)

  for (const batch of batches) {
    await pool.request().query(batch)
  }

  console.log(`[deploy_pos_sql] ${batches.length} batch(es) executed successfully.`)
  await pool.close()
}

run().catch(err => {
  console.error('[deploy_pos_sql] FAILED:', err.message)
  process.exit(1)
})
