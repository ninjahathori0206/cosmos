/**
 * Redeploys dbo.sp_FoundryLookup_Update with optional @lookup_key (edit internal code in Command Unit).
 *
 * Usage: npm run migrate:48-foundry-lookup-update-key
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
    console.error('Missing DB_NAME or DB_USER in .env — cannot connect.')
    process.exit(1)
  }
  const file = path.join(__dirname, '..', 'sql', 'migrations', '48_sp_foundry_lookup_update_allow_key.sql')
  const source = fs.readFileSync(file, 'utf8')
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (const batch of batches) {
      await pool.request().query(batch)
    }
    console.log('[migration-48] OK — sp_FoundryLookup_Update allows key changes.')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migration-48]', err.message || err)
  process.exit(1)
})
