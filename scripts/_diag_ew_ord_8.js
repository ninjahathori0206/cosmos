#!/usr/bin/env node
'use strict'
require('dotenv').config()
const sql = require('mssql')
const { fetchOrderBundle } = require('../src/services/orderService')

async function main() {
  const orderNo = process.argv[2] || 'EW-ORD-8'
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
  const r = await pool.request().input('no', sql.NVarChar, orderNo).query(`
    SELECT order_id, store_id, order_no, total_amount, subtotal_amount, discount_amount, lab_advance_pct_snapshot
    FROM ${ordersTable} WHERE order_no = @no
  `)
  if (!r.recordset.length) {
    console.log('Order not found:', orderNo)
    process.exit(1)
  }
  const o = r.recordset[0]
  console.log('Order row:', o)
  const bundle = await fetchOrderBundle(pool, o.order_id, o.store_id, mode)
  console.log('payment_summary:', JSON.stringify(bundle.payment_summary, null, 2))
  console.log('payments:', JSON.stringify(bundle.payments, null, 2))
  await pool.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
