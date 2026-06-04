#!/usr/bin/env node
'use strict'
require('dotenv').config()
const sql = require('mssql')

async function main() {
  const pool = await sql.connect({
    server: process.env.DB_HOST || process.env.DB_SERVER,
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_ENCRYPT !== 'true'
    }
  })

  const invs = ['EW-INV-2627-SRT02-00016', 'EW-INV-2627-SRT02-00014', 'EW-INV-2627-SRT02-00013']
  for (const inv of invs) {
    const r = await pool.request().input('no', sql.NVarChar, inv).query(`
      SELECT po.order_id, po.order_no, po.linked_membership_sale_id, po.linked_membership_order_id
      FROM dbo.pos_invoices pi
      JOIN dbo.pos_orders po ON po.order_id = pi.order_id
      WHERE pi.invoice_no = @no
    `)
    console.log(inv, r.recordset[0])
  }

  const ms = await pool.request().query(`
    SELECT ms.membership_sale_id, ms.invoice_no, ms.product_order_id, ms.created_at, po.order_no,
           (SELECT MIN(mp.created_at) FROM dbo.pos_membership_payments mp WHERE mp.membership_sale_id = ms.membership_sale_id) AS pay_at
    FROM dbo.pos_membership_sales ms
    LEFT JOIN dbo.pos_orders po ON po.order_id = ms.product_order_id
    WHERE po.order_no LIKE N'EW-ORD-SRT02-%'
       OR ms.invoice_no LIKE N'%SRT02%'
    ORDER BY ms.membership_sale_id
  `)
  console.log('membership sales:', ms.recordset)

  const orderNos = [
    'EW-ORD-SRT02-00001',
    'EW-ORD-SRT02-00002',
    'EW-ORD-SRT02-00003',
    'EW-ORD-SRT02-00004',
    'EW-ORD-SRT02-00005',
    'EW-ORD-SRT02-00006'
  ]
  for (const no of orderNos) {
    const o = await pool.request().input('no', sql.NVarChar, no).query(`
      SELECT order_id, order_no, sold_membership_plan_key, sold_membership_amount, linked_membership_sale_id
      FROM dbo.pos_orders WHERE order_no = @no
    `)
    console.log('order', o.recordset[0])
  }

  const cm = await pool.request().query(`
    SELECT cm.membership_id, cm.pos_order_id, cm.pos_membership_sale_id, cm.plan_key, po.order_no
    FROM dbo.customer_memberships cm
    LEFT JOIN dbo.pos_orders po ON po.order_id = cm.pos_order_id
    WHERE po.order_no LIKE N'EW-ORD-SRT02-%'
  `)
  console.log('customer_memberships:', cm.recordset)

  const memOrders = await pool.request().query(`
    SELECT order_id, order_no, created_at FROM dbo.pos_orders
    WHERE order_kind = N'MEMBERSHIP' AND order_no LIKE N'EW-ORD-SRT02-%'
  `)
  console.log('MEMBERSHIP orders:', memOrders.recordset)

  const linked = await pool.request().query(`
    SELECT po.order_no AS product_order, po.created_at AS product_at, po.linked_membership_sale_id,
           ms.invoice_no AS mem_invoice, ms.created_at AS mem_at, ms.membership_sale_id
    FROM dbo.pos_orders po
    LEFT JOIN dbo.pos_membership_sales ms ON ms.membership_sale_id = po.linked_membership_sale_id
    WHERE po.order_no LIKE N'EW-ORD-SRT02-%'
    ORDER BY po.order_id
  `)
  console.log('linked map:', linked.recordset)

  await pool.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
