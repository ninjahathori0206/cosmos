/**
 * Runs sql/maintenance/purge_all_business_data_keep_one_user.sql
 *
 * Wipes stores, products, orders, customers, inventory, Foundry, POS data, etc.
 * Keeps dbo.roles, dbo.role_permissions, dbo.role_module_access and ONE user (Talha / @KeepUsername in SQL).
 *
 * Requires env:
 *   COSMOS_PURGE_CONFIRM=I_UNDERSTAND   (exact string)
 *
 * Usage (bash):
 *   COSMOS_PURGE_CONFIRM=I_UNDERSTAND node scripts/run-maintenance-purge-keep-user.js
 *
 * Usage (PowerShell):
 *   $env:COSMOS_PURGE_CONFIRM='I_UNDERSTAND'; node scripts/run-maintenance-purge-keep-user.js
 *
 * Optional — override Cosmos username to keep (default resolved in SQL file as 'talha'):
 * node scripts/run-maintenance-purge-keep-user.js your_username
 */

require('dotenv').config()
const fs = require('fs')
const path = require('path')
const sql = require('mssql')

if (process.env.COSMOS_PURGE_CONFIRM !== 'I_UNDERSTAND') {
  console.error(
    'Refusing to run: set COSMOS_PURGE_CONFIRM=I_UNDERSTAND after backing up the database.'
  )
  process.exit(1)
}

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true },
  requestTimeout: Math.max(120000, Number(process.env.DB_REQUEST_TIMEOUT_MS || 120000)),
  connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 15000)
}

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env — cannot connect.')
    process.exit(1)
  }

  const keeperUsername = process.argv[2]
  const file = path.join(
    __dirname,
    '..',
    'sql',
    'maintenance',
    'purge_all_business_data_keep_one_user.sql'
  )
  let source = fs.readFileSync(file, 'utf8')

  if (keeperUsername && /^[a-zA-Z0-9._@-]{1,100}$/.test(keeperUsername)) {
    source = source.replace(
      /DECLARE @KeepUsername NVARCHAR\(100\) = N'talha';/,
      `DECLARE @KeepUsername NVARCHAR(100) = N'${keeperUsername.replace(/'/g, "''")}';`
    )
    console.log('[purge] Using keeper username from argv:', keeperUsername)
  }

  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (const batch of batches) {
      await pool.request().query(batch)
    }
    console.log('[purge] OK — ran', batches.length, 'batch(es). Re-login as the kept user.')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[purge] failed:', err.message || err)
  process.exit(1)
})
