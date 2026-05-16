/**
 * Deploy POS tables (05–12), Store OS access (sql/alter/30_store_os_access.sql),
 * stored procedures (sql/sp/pos.sql), then POS migrations.
 * Usage: npm run deploy:pos-sql
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
  path.join('sql', 'migrations', 'migrate_pos_to_oe_orders.sql'),
  path.join('sql', 'migrations', 'add_lab_workflow_statuses.sql'),
  path.join('sql', 'migrations', 'remap_legacy_lab_workflow_statuses.sql'),
  path.join('sql', 'migrations', 'lab_intake_flags_and_sent_to_lab_transitions.sql'),
  path.join('sql', 'migrations', 'add_discount_to_orders.sql'),
  path.join('sql', 'migrations', 'pos_gst_composition_inclusive.sql'),
  path.join('sql', 'migrations', 'customer_offer_scope.sql'),
  path.join('sql', 'migrations', 'pos_checkout_inventory_drafts.sql'),
  path.join('sql', 'migrations', '40_pos_invoices_display_json.sql'),
  path.join('sql', 'migrations', '41_sub_order_pair_handover.sql')
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
  // Store OS tablets + roles flags + POS v2 SP dependencies (must run before sp/pos.sql)
  await runBatches(pool, path.join('sql', 'alter', '30_store_os_access.sql'), 'alter/30_store_os_access')
  await runBatches(
    pool,
    path.join('sql', 'alter', '38_tablet_session_version.sql'),
    'alter/38_tablet_session_version'
  )
  await runBatches(
    pool,
    path.join('sql', 'migrations', 'lens_config_display_fields.sql'),
    'migrations/lens_config_display_fields'
  )
  await runBatches(
    pool,
    path.join('sql', 'migrations', 'lens_catalog_zero_power_category.sql'),
    'migrations/lens_catalog_zero_power_category'
  )
  await runBatches(
    pool,
    path.join('sql', 'migrations', 'lens_wizard_dynamic.sql'),
    'migrations/lens_wizard_dynamic'
  )
  await runBatches(pool, path.join('sql', 'sp', 'pos.sql'), 'sp/pos')
  await runBatches(pool, path.join('sql', 'sp', 'lens_config.sql'), 'sp/lens_config')
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
