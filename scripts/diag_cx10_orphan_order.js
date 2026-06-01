#!/usr/bin/env node
'use strict'

/**
 * Diagnose orphan LAB orders / locked units for a POS customer (default customer_id 10).
 * Usage: node scripts/diag_cx10_orphan_order.js [--customer-id 10] [--barcode 1234567]
 */
require('dotenv').config()
const sql = require('mssql')

const customerId = (() => {
  const i = process.argv.indexOf('--customer-id')
  return i >= 0 ? Number(process.argv[i + 1]) : 10
})()
const barcodeArg = (() => {
  const i = process.argv.indexOf('--barcode')
  return i >= 0 ? String(process.argv[i + 1] || '').trim() : ''
})()

async function main() {
  const pool = await sql.connect({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: { encrypt: process.env.DB_ENCRYPT === 'true', trustServerCertificate: true }
  })

  const modeRow = await pool.request().query(`
    SELECT setting_value FROM dbo.app_settings WHERE setting_key = N'orders_engine_mode'
  `)
  const mode = String((modeRow.recordset[0] && modeRow.recordset[0].setting_value) || 'legacy').toLowerCase()
  const ordersTable = mode === 'shared' ? 'dbo.oe_orders' : 'dbo.pos_orders'
  const paymentsTable = mode === 'shared' ? 'dbo.oe_payments' : 'dbo.pos_payments'

  console.log('orders_engine_mode:', mode, '→', ordersTable)

  const orders = await pool.request().input('cid', sql.Int, customerId).query(`
    SELECT o.order_id, o.order_no, o.status, o.order_kind, o.total_amount,
           o.lab_advance_pct_snapshot, o.store_id, o.created_at,
           u.full_name AS created_by,
           ISNULL(pay.paid_total, 0) AS paid_total
    FROM ${ordersTable} o
    JOIN dbo.pos_customers c ON c.customer_id = o.customer_id
    LEFT JOIN dbo.users u ON u.user_id = o.created_by_user_id
    OUTER APPLY (
      SELECT SUM(amount) AS paid_total FROM ${paymentsTable} p WHERE p.order_id = o.order_id
    ) pay
    WHERE c.customer_id = @cid
    ORDER BY o.created_at DESC
  `)

  console.log('\n--- Orders for customer_id', customerId, '---')
  if (!orders.recordset.length) {
    console.log('(none)')
  } else {
    for (const r of orders.recordset) {
      console.log(JSON.stringify(r, null, 0))
    }
  }

  const openUnpaid = (orders.recordset || []).filter(
    (r) => String(r.status).toUpperCase() === 'OPEN' && Number(r.paid_total) <= 0.02
  )
  if (openUnpaid.length) {
    console.log('\n→ Recovery: OPEN + zero payment → Store OS Orders → Void bill (same cashier), or:')
    for (const r of openUnpaid) {
      console.log('  POST /api/pos/orders/' + r.order_id + '/void-unpaid')
    }
  }

  const openPartial = (orders.recordset || []).filter(
    (r) => String(r.status).toUpperCase() === 'OPEN' && Number(r.paid_total) > 0.02
  )
  if (openPartial.length) {
    console.log('\n→ Recovery: OPEN + partial payment → Orders → Collect payment (resume), do not new cart')
    for (const r of openPartial) {
      console.log('  order_no:', r.order_no, 'paid:', r.paid_total, 'due:', Number(r.total_amount) - Number(r.paid_total))
    }
  }

  const orderIds = (orders.recordset || []).map((r) => r.order_id)
  let unitQuery = `
    SELECT unit_barcode, status, order_id, sold_store_id, sku_id
    FROM dbo.sku_units
    WHERE status = N'SOLD'
  `
  if (orderIds.length) {
    unitQuery += ` AND (order_id IN (${orderIds.join(',')})`
    if (barcodeArg) unitQuery += ` OR unit_barcode = @bc`
    unitQuery += ')'
  } else if (barcodeArg) {
    unitQuery += ` AND unit_barcode = @bc`
  } else {
    unitQuery += ` AND 1=0`
  }

  const req = pool.request()
  if (barcodeArg) req.input('bc', sql.NVarChar(20), barcodeArg)
  const units = await req.query(unitQuery)

  console.log('\n--- SOLD sku_units (this Cx orders' + (barcodeArg ? ' or barcode' : '') + ') ---')
  if (!units.recordset.length) console.log('(none)')
  else {
    for (const u of units.recordset) console.log(JSON.stringify(u))
    console.log('\n→ Recovery: node scripts/release_sku_units.js --store-id <store> <barcodes...>')
  }

  await pool.close()
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
