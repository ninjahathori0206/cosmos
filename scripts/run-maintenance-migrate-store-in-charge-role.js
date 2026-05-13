/**
 * Merges legacy dbo.roles.role_key store_in_charge into store_incharge.
 * Idempotent — see sql/maintenance/migrate_store_in_charge_role_key.sql
 *
 * Usage: npm run maintenance:migrate-store-in-charge-role
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
  const file = path.join(__dirname, '..', 'sql', 'maintenance', 'migrate_store_in_charge_role_key.sql')
  const source = fs.readFileSync(file, 'utf8')
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (const batch of batches) {
      await pool.request().query(batch)
    }
    console.log('[maintenance:migrate-store-in-charge-role] OK — ran', batches.length, 'batch(es). Users on merged role must re-login.')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[maintenance:migrate-store-in-charge-role]', err.message || err)
  process.exit(1)
})
