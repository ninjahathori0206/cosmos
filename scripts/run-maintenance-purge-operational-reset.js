/**
 * Operational reset — clears POS orders/sales, stock, transfers, customers,
 * sessions/audit, and Foundry purchases/SKUs. Keeps users, stores, tablets,
 * app_settings (except pos_order_seq), and product-type/lens categorization.
 *
 * Requires env:
 *   COSMOS_PURGE_CONFIRM=I_UNDERSTAND   (exact string)
 *
 * Usage (bash):
 *   COSMOS_PURGE_CONFIRM=I_UNDERSTAND npm run maintenance:purge-operational-reset
 *
 * Usage (PowerShell):
 *   $env:COSMOS_PURGE_CONFIRM='I_UNDERSTAND'; npm run maintenance:purge-operational-reset
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
  requestTimeout: Math.max(300000, Number(process.env.DB_REQUEST_TIMEOUT_MS || 300000)),
  connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 15000)
}

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env — cannot connect.')
    process.exit(1)
  }

  const file = path.join(
    __dirname,
    '..',
    'sql',
    'maintenance',
    'purge_operational_reset_keep_config.sql'
  )
  const source = fs.readFileSync(file, 'utf8')
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)

  const pool = await sql.connect(config)
  try {
    for (let i = 0; i < batches.length; i += 1) {
      const result = await pool.request().query(batches[i])
      if (result.recordsets && result.recordsets.length) {
        for (const rs of result.recordsets) {
          if (rs && rs.length) console.log('[purge-operational-reset]', rs)
        }
      }
    }
    console.log(
      '[purge-operational-reset] OK — operational data cleared. Users/stores/tablets/config preserved. Re-login recommended.'
    )
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[purge-operational-reset] failed:', err.message || err)
  process.exit(1)
})
