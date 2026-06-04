#!/usr/bin/env node
'use strict'
require('dotenv').config()
const { getPool } = require('../src/config/db')
const orderService = require('../src/services/orderService')

const CUSTOMER_ID = Number(process.argv[2] || 11)
const ORDER_NO = process.argv[3] || 'EW-ORD-9'

async function main() {
  const pool = await getPool()
  const mode = await orderService.getOrdersEngineMode(pool)

  const cust = await pool.request().input('cid', CUSTOMER_ID).query(`
    SELECT customer_id, full_name, phone FROM dbo.pos_customers WHERE customer_id = @cid
  `)
  console.log('customer:', cust.recordset[0])

  const ord = await pool.request().input('no', ORDER_NO).query(`
    SELECT order_id, store_id, order_no, status, customer_id, total_amount, subtotal_amount,
           sold_membership_plan_key, sold_membership_amount, discount_amount
    FROM dbo.pos_orders WHERE order_no = @no
  `)
  console.log('order:', ord.recordset[0])

  const oid = ord.recordset[0] && ord.recordset[0].order_id
  if (oid) {
    const pays = await pool.request().input('oid', oid).query(`
      SELECT payment_id, stage, method, amount FROM dbo.pos_payments WHERE order_id = @oid
    `)
    console.log('payments:', pays.recordset)

    const bundle = await orderService.fetchOrderBundle(pool, oid, ord.recordset[0].store_id, mode)
    console.log('payment_summary:', bundle && bundle.payment_summary)
  }

  const hasPoCol = await pool.request().query(`
    SELECT COL_LENGTH('dbo.customer_memberships', 'pos_order_id') AS col_len
  `)
  const poCol = hasPoCol.recordset[0] && Number(hasPoCol.recordset[0].col_len) > 0

  const mem = await pool.request().input('cid', CUSTOMER_ID).query(`
    SELECT membership_id, plan_key, price_paid, is_active, purchased_at, expires_at
      ${poCol ? ', pos_order_id' : ''}
    FROM dbo.customer_memberships WHERE customer_id = @cid ORDER BY membership_id DESC
  `)
  console.log('memberships:', mem.recordset)

  const plans = await pool.request().query(`
    SELECT plan_key, display_name, price, validity_days, is_active FROM dbo.membership_plans
  `)
  console.log('membership_plans:', plans.recordset)

  await pool.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
