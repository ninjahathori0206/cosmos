/**
 * Release SOLD sku_units back to AT_STORE by barcode (after manual order DELETE).
 *
 * Usage:
 *   node scripts/release_sku_units.js --store-id 13 0001060 0002040 0001032
 *   node scripts/release_sku_units.js --store-id 13 --no-restore-stock 0001060
 *
 * Requires .env DB_* (same as app). Idempotent for units already AT_STORE at the store.
 */

require('dotenv').config()
const { getPool } = require('../src/config/db')
const {
  releaseSkuUnitsByBarcodes,
  normalizeUnitBarcode
} = require('../src/services/orderService')

function parseArgs(argv) {
  let storeId = null
  let restoreStock = true
  const barcodes = []
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--store-id' && argv[i + 1]) {
      storeId = parseInt(argv[++i], 10)
      continue
    }
    if (a === '--no-restore-stock') {
      restoreStock = false
      continue
    }
    if (a.startsWith('--')) {
      console.error(`Unknown option: ${a}`)
      process.exit(1)
    }
    barcodes.push(a)
  }
  return { storeId, barcodes, restoreStock }
}

async function fetchUnitSnapshot(pool, code) {
  const norm = normalizeUnitBarcode(code)
  if (!norm) return { barcode: code, error: 'invalid_format' }
  const rs = await pool.request().input('code', require('mssql').Char(7), norm).query(`
    SELECT unit_barcode, status, location_type, location_id, order_id, sold_store_id, sku_id
    FROM dbo.sku_units
    WHERE unit_barcode = @code
  `)
  const row = rs.recordset && rs.recordset[0]
  if (!row) return { barcode: norm, error: 'not_found' }
  return {
    barcode: row.unit_barcode,
    status: row.status,
    location_type: row.location_type,
    location_id: row.location_id,
    order_id: row.order_id,
    sold_store_id: row.sold_store_id,
    sku_id: row.sku_id
  }
}

async function main() {
  const { storeId, barcodes, restoreStock } = parseArgs(process.argv)
  if (!Number.isInteger(storeId) || storeId < 1) {
    console.error('Usage: node scripts/release_sku_units.js --store-id <id> <barcode> [barcode...]')
    process.exit(1)
  }
  if (!barcodes.length) {
    console.error('Provide at least one unit barcode.')
    process.exit(1)
  }

  const pool = await getPool()
  console.log(`Store ${storeId} | restore stock: ${restoreStock}`)
  console.log('--- before ---')
  for (const b of barcodes) {
    const snap = await fetchUnitSnapshot(pool, b)
    console.log(JSON.stringify(snap))
  }

  const summary = await releaseSkuUnitsByBarcodes(pool, {
    storeId,
    barcodes,
    restoreStock
  })

  console.log('--- result ---')
  console.log(JSON.stringify(summary, null, 2))
  console.log('--- after ---')
  for (const b of barcodes) {
    const snap = await fetchUnitSnapshot(pool, b)
    console.log(JSON.stringify(snap))
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message || err)
    process.exit(1)
  })
