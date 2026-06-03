/**
 * Deploy CX Customer 360 stored procedures
 * Usage: npm run deploy:cx-sps
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

const SP_FILES = [
  'cx_read_sps.sql',
  'cx_write_sps.sql',
  'cx_engine_sps.sql'
]

async function main () {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env')
    process.exit(1)
  }
  const pool = await sql.connect(config)
  try {
    for (const file of SP_FILES) {
      const full = path.join(__dirname, '..', 'sql', 'sp', file)
      const batches = fs.readFileSync(full, 'utf8').split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
      for (const batch of batches) await pool.request().query(batch)
      console.log('[deploy-cx-sps] OK —', file)
    }
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[deploy-cx-sps]', err.message || err)
  process.exit(1)
})
