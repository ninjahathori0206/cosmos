/**
 * Runs sql/migrations/ist_backfill_utc_stored_rows.sql with @ConfirmUtcStored = 1.
 * WARNING: Only use when historical DATETIME values are confirmed UTC-stored;
 *   otherwise all listed columns are shifted by +330 minutes incorrectly.
 *
 * Usage: node scripts/run_ist_utc_backfill.js
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

async function run() {
  const migrationPath = path.join(__dirname, '..', 'sql', 'migrations', 'ist_backfill_utc_stored_rows.sql')
  let source = fs.readFileSync(migrationPath, 'utf8')
  if (!/DECLARE @ConfirmUtcStored BIT = 0;/.test(source)) {
    console.error('[ist_backfill] Expected @ConfirmUtcStored = 0 guard in migration file.')
    process.exit(1)
  }
  source = source.replace(
    /DECLARE @ConfirmUtcStored BIT = 0;\s*--.*$/m,
    'DECLARE @ConfirmUtcStored BIT = 1; -- set by scripts/run_ist_utc_backfill.js'
  )
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (let i = 0; i < batches.length; i += 1) {
      await pool.request().query(batches[i])
      console.log(`[ist_backfill] batch ${i + 1}/${batches.length} ok`)
    }
    console.log('[ist_backfill] completed successfully.')
  } finally {
    await pool.close()
  }
}

run().catch((err) => {
  console.error('[ist_backfill] FAILED:', err.message)
  process.exit(1)
})
