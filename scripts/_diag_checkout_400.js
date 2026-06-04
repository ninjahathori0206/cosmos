#!/usr/bin/env node
'use strict'
require('dotenv').config()
const { getPool } = require('../src/config/db')
const orderService = require('../src/services/orderService')

async function main() {
  const pool = await getPool()
  const pct = await pool.request().query(`
    SELECT setting_key, setting_value FROM dbo.app_settings WHERE setting_key LIKE N'%lab_advance%'
  `)
  console.log('lab_advance settings:', pct.recordset)

  const recent = await pool.request().query(`
    SELECT TOP 3 o.order_id, o.order_no, o.status, o.total_amount, o.order_kind,
           (SELECT SUM(amount) FROM dbo.pos_payments p WHERE p.order_id = o.order_id) AS paid
    FROM dbo.pos_orders o ORDER BY o.order_id DESC
  `)
  console.log('recent orders:', recent.recordset)

  // Simulate finalize on latest LAB full-paid order
  const lab = await pool.request().query(`
    SELECT TOP 1 o.order_id, o.store_id, o.order_no
    FROM dbo.pos_orders o
    WHERE o.order_kind = N'LAB'
    ORDER BY o.order_id DESC
  `)
  if (lab.recordset[0]) {
    const o = lab.recordset[0]
    const bundle = await orderService.fetchOrderBundle(pool, o.order_id, o.store_id, 'legacy')
    console.log('latest lab bundle summary:', bundle.payment_summary)
    console.log('lab subs:', bundle.subList.map(s => s.lab_workflow_status))
  }
  await pool.close()
}

main().catch(e => { console.error(e); process.exit(1) })
