/**
 * Remove a test POS order safely: release unit barcodes + stock, then delete order tree.
 *
 * Usage:
 *   node scripts/purge_pos_order.js --order-no EW-ORD-2
 *   node scripts/purge_pos_order.js --order-id 2 --store-id 13
 *
 * Does not replace void API for OPEN unpaid bills — use for dev cleanup after paid/test orders.
 */

require('dotenv').config()
const sql = require('mssql')
const { getPool } = require('../src/config/db')
const {
  getOrdersEngineMode,
  releaseSkuUnitsForOrder
} = require('../src/services/orderService')

function parseArgs(argv) {
  let orderNo = null
  let orderId = null
  let storeId = null
  let restoreStock = true
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--order-no' && argv[i + 1]) {
      orderNo = String(argv[++i]).trim()
      continue
    }
    if (a === '--order-id' && argv[i + 1]) {
      orderId = parseInt(argv[++i], 10)
      continue
    }
    if (a === '--store-id' && argv[i + 1]) {
      storeId = parseInt(argv[++i], 10)
      continue
    }
    if (a === '--no-restore-stock') {
      restoreStock = false
      continue
    }
    console.error(`Unknown option: ${a}`)
    process.exit(1)
  }
  return { orderNo, orderId, storeId, restoreStock }
}

async function main() {
  const { orderNo, orderId: oidArg, storeId: sidArg, restoreStock } = parseArgs(process.argv)
  if (!orderNo && (!Number.isInteger(oidArg) || oidArg < 1)) {
    console.error('Usage: node scripts/purge_pos_order.js --order-no <no> [--store-id N]')
    console.error('   or: node scripts/purge_pos_order.js --order-id <id> --store-id <id>')
    process.exit(1)
  }

  const pool = await getPool()
  const mode = await getOrdersEngineMode(pool)
  const t = mode === 'shared'
    ? {
      orders: 'dbo.oe_orders',
      sub_orders: 'dbo.oe_sub_orders',
      order_items: 'dbo.oe_order_items',
      order_status_log: 'dbo.oe_order_status_log'
    }
    : {
      orders: 'dbo.pos_orders',
      sub_orders: 'dbo.pos_sub_orders',
      order_items: 'dbo.pos_order_items',
      order_status_log: 'dbo.pos_order_status_log'
    }

  let orderRow = null
  if (orderNo) {
    const rs = await pool.request().input('ono', sql.NVarChar(40), orderNo).query(`
      SELECT order_id, store_id, order_no, status, inventory_committed
      FROM ${t.orders}
      WHERE order_no = @ono
    `)
    orderRow = rs.recordset && rs.recordset[0]
  } else {
    const rs = await pool.request().input('oid', sql.Int, oidArg).query(`
      SELECT order_id, store_id, order_no, status, inventory_committed
      FROM ${t.orders}
      WHERE order_id = @oid
    `)
    orderRow = rs.recordset && rs.recordset[0]
  }

  if (!orderRow) {
    console.log('[noop] Order not found — nothing to purge.')
    process.exit(0)
  }

  const oid = Number(orderRow.order_id)
  const storeId = Number(sidArg) > 0 ? Number(sidArg) : Number(orderRow.store_id)
  const inventoryCommitted = orderRow.inventory_committed === true || orderRow.inventory_committed === 1
  const doRestore = restoreStock && inventoryCommitted

  console.log(`Purging ${orderRow.order_no} (order_id=${oid}, store_id=${storeId}, status=${orderRow.status})`)
  console.log(`Release units + stock restore: ${doRestore}`)

  const trx = new sql.Transaction(pool)
  await trx.begin()
  try {
    const release = await releaseSkuUnitsForOrder(trx, {
      mode,
      storeId,
      orderId: oid,
      restoreStock: doRestore
    })
    console.log(`Units released: ${release.units_released}`)

    await new sql.Request(trx).input('oid', sql.Int, oid).query(`
      DELETE FROM ${t.order_status_log} WHERE order_id = @oid
    `)

    if (mode !== 'shared') {
      try {
        await new sql.Request(trx).input('oid', sql.Int, oid).query(`
          IF OBJECT_ID(N'dbo.pos_checkout_drafts', N'U') IS NOT NULL
            DELETE FROM dbo.pos_checkout_drafts WHERE order_id = @oid
        `)
      } catch (e) {
        if (!String(e.message || '').includes('Invalid object name')) throw e
      }
    }

    await new sql.Request(trx).input('oid', sql.Int, oid).query(`
      DELETE FROM ${t.orders} WHERE order_id = @oid
    `)

    await trx.commit()
    console.log(`[ok] Deleted order ${orderRow.order_no}`)
  } catch (e) {
    await trx.rollback()
    throw e
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message || err)
    process.exit(1)
  })
