const fs = require('fs')
const path = require('path')
require('dotenv').config()
const { getPool } = require('../src/config/db')

function splitSqlBatches(raw) {
  return raw
    .split(/\r?\nGO\s*(?:\r?\n|$)/gi)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
}

async function runSqlFile(pool, relPath) {
  const filePath = path.resolve(__dirname, '..', relPath)
  const raw = fs.readFileSync(filePath, 'utf8')
  const batches = splitSqlBatches(raw)
  for (const batch of batches) {
    // sequential on purpose for deterministic deploy
    // eslint-disable-next-line no-await-in-loop
    await pool.request().query(batch)
  }
  console.log(`[applied] ${relPath} (${batches.length} batches)`)
}

async function main() {
  const pool = await getPool()

  await runSqlFile(pool, 'sql/alter/29_sku_sale_price_history.sql')
  await runSqlFile(pool, 'sql/maintenance/deploy_sp_SKUv2_Generate_four_segment.sql')

  const verify = await pool.request().query(`
    SELECT
      OBJECT_ID('dbo.purchase_restock_events', 'U') AS purchase_restock_events_id,
      OBJECT_ID('dbo.sku_sale_price_history', 'U') AS sku_sale_price_history_id,
      OBJECT_ID('dbo.sp_SKUv2_Generate', 'P') AS sp_skuv2_generate_id
  `)
  console.log('[verify]', verify.recordset[0])
}

main()
  .then(() => {
    console.log('SQL deploy completed successfully')
    process.exit(0)
  })
  .catch((err) => {
    console.error('SQL deploy failed:', err && err.message ? err.message : err)
    process.exit(1)
  })
