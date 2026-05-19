/**
 * Report duplicate / inconsistent transfer unit custody (read-only).
 * Usage: npm run maintenance:reconcile-duplicate-transfer-units
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
  const file = path.join(__dirname, '..', 'sql', 'maintenance', 'reconcile_duplicate_transfer_units.sql')
  const batches = fs.readFileSync(file, 'utf8').split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (const batch of batches) {
      const r = await pool.request().query(batch)
      const sets = r.recordsets || []
      sets.forEach((rows, i) => {
        if (rows && rows.length) {
          console.log('--- result set', i + 1, '---')
          console.table(rows)
        }
      })
    }
    console.log('[reconcile-duplicate-transfer-units] OK')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[reconcile-duplicate-transfer-units]', err.message || err)
  process.exit(1)
})
