/**
 * Deploy POS table scripts (05–11) then stored procedures.
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

const POS_TABLE_FILES = [
  path.join('sql', 'tables', '05_pos_config.sql'),
  path.join('sql', 'tables', '06_pos_lens_catalog.sql'),
  path.join('sql', 'tables', '07_pos_customers.sql'),
  path.join('sql', 'tables', '08_pos_orders.sql'),
  path.join('sql', 'tables', '09_pos_payments.sql'),
  path.join('sql', 'tables', '10_pos_points.sql'),
  path.join('sql', 'tables', '11_pos_advanced.sql'),
  path.join('sql', 'tables', '12_order_engine.sql')
]

const POS_MIGRATION_FILES = [
  path.join('sql', 'migrations', 'migrate_pos_to_oe_orders.sql')
]

async function runBatches(pool, relativeSqlPath, label) {
  const file = path.join(__dirname, '..', relativeSqlPath)
  if (!fs.existsSync(file)) {
    console.warn(`[deploy_pos_sql] skip missing file: ${relativeSqlPath}`)
    return 0
  }
  const source = fs.readFileSync(file, 'utf8')
  const batches = source.split(/^\s*GO\s*$/im).map(b => b.trim()).filter(Boolean)
  for (const batch of batches) {
    await pool.request().query(batch)
  }
  console.log(`[deploy_pos_sql] ${label}: ${batches.length} batch(es)`)
  return batches.length
}

async function run() {
  const pool = await sql.connect(config)

  for (const rel of POS_TABLE_FILES) {
    await runBatches(pool, rel, rel.replace(/\\/g, '/'))
  }
  await runBatches(pool, path.join('sql', 'sp', 'pos.sql'), 'sp/pos')
  for (const rel of POS_MIGRATION_FILES) {
    await runBatches(pool, rel, rel.replace(/\\/g, '/'))
  }

  console.log('[deploy_pos_sql] completed successfully.')
  await pool.close()
}

run().catch(err => {
  console.error('[deploy_pos_sql] FAILED:', err.message)
  process.exit(1)
})
