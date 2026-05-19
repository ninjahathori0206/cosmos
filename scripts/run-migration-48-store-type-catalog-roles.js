/**
 * Seeds dbo.store_type_catalog_roles and updates warehouse hub SQL functions.
 * Aligned with src/config/storeTypesCatalog.js (STORE_TYPE_ROLES).
 *
 * Usage: npm run migrate:48-store-type-catalog-roles
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
  const file = path.join(__dirname, '..', 'sql', 'migrations', '48_store_type_catalog_roles.sql')
  const source = fs.readFileSync(file, 'utf8')
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (const batch of batches) {
      await pool.request().query(batch)
    }
    console.log('[migration-48] OK — ran', batches.length, 'batch(es).')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migration-48]', err.message || err)
  process.exit(1)
})
