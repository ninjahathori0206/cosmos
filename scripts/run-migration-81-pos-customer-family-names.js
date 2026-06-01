/**
 * Renames dbo.pos_customer_aliases → dbo.pos_customer_family_names (migration 81).
 *
 * Usage: npm run migrate:81-pos-customer-family-names
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
  const file = path.join(
    __dirname,
    '..',
    'sql',
    'migrations',
    '81_rename_pos_customer_aliases_to_family_names.sql'
  )
  const source = fs.readFileSync(file, 'utf8')
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (const batch of batches) {
      await pool.request().query(batch)
    }
    console.log('[migration-81] OK —', batches.length, 'batch(es).')
    console.log('[migration-81] Next: npm run deploy:pos-sp (refresh sp_POS_CustomerSearch)')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migration-81] FAILED:', err.message)
  process.exit(1)
})
