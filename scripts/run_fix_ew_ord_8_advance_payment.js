#!/usr/bin/env node
'use strict'

/**
 * Apply EW-ORD-8 payment correction: FULL ₹2300 → ADVANCE ₹800.
 * Usage: node scripts/run_fix_ew_ord_8_advance_payment.js [--dry-run]
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const sql = require('mssql')
const { fetchOrderBundle } = require('../src/services/orderService')

const ORDER_NO = 'EW-ORD-8'
const ADVANCE_AMT = 800
const dryRun = process.argv.includes('--dry-run')

function dbConfig() {
  return {
    server: process.env.DB_HOST || process.env.DB_SERVER || 'localhost',
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_ENCRYPT !== 'true'
    }
  }
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100
}

function labSubtotalForAdvanceTarget(orderRow, labSubtotalPreTax) {
  const labPart = roundMoney(labSubtotalPreTax)
  const sub = roundMoney(orderRow.subtotal_amount)
  const disc = roundMoney(orderRow.discount_amount || 0)
  const membershipAmt = roundMoney(Number(orderRow.sold_membership_amount) || 0)
  const productSub = Math.max(0, roundMoney(sub - membershipAmt))
  if (productSub <= 0.009 || disc <= 0.009 || labPart <= 0.009) return labPart
  const netProduct = Math.max(0, roundMoney(productSub - disc))
  return roundMoney((labPart / productSub) * netProduct)
}

async function preflight(pool) {
  const modeRow = await pool.request().query(`
    SELECT setting_value FROM dbo.app_settings WHERE setting_key = N'orders_engine_mode'
  `)
  const mode = String((modeRow.recordset[0] && modeRow.recordset[0].setting_value) || 'legacy').toLowerCase()

  const orderRs = await pool.request().input('no', sql.NVarChar, ORDER_NO).query(`
    SELECT order_id, store_id, order_no, status, order_kind, total_amount, subtotal_amount,
           discount_amount, lab_advance_pct_snapshot, sold_membership_amount
    FROM dbo.pos_orders WHERE order_no = @no
  `)
  if (!orderRs.recordset.length) {
    throw new Error('Order not found: ' + ORDER_NO)
  }
  const order = orderRs.recordset[0]

  const pays = await pool.request().input('oid', sql.Int, order.order_id).query(`
    SELECT payment_id, stage, method, amount, tendered FROM dbo.pos_payments WHERE order_id = @oid ORDER BY payment_id
  `)

  const invoiceRs = await pool.request().input('oid', sql.Int, order.order_id).query(`
    SELECT invoice_id, invoice_no FROM dbo.pos_invoices WHERE order_id = @oid
  `)

  const subs = await pool.request().input('oid', sql.Int, order.order_id).query(`
    SELECT sub_order_id, fulfillment, lab_workflow_status FROM dbo.pos_sub_orders WHERE order_id = @oid
  `)

  const items = await pool.request().input('oid', sql.Int, order.order_id).query(`
    SELECT i.line_total, s.fulfillment
    FROM dbo.pos_order_items i
    INNER JOIN dbo.pos_sub_orders s ON s.sub_order_id = i.sub_order_id
    WHERE s.order_id = @oid
  `)

  let labPart = 0
  for (const it of items.recordset || []) {
    if (String(it.fulfillment) === 'LAB') labPart += Number(it.line_total) || 0
  }
  labPart = roundMoney(labPart)
  const labBase = labSubtotalForAdvanceTarget(order, labPart)
  const newPct = roundMoney((ADVANCE_AMT / labBase) * 100)

  return { mode, order, payments: pays.recordset || [], invoices: invoiceRs.recordset || [], subs: subs.recordset || [], labPart, labBase, newPct }
}

async function applyFix(pool, ctx) {
  const { order, payments, newPct } = ctx
  if (payments.length !== 1) {
    throw new Error('Expected exactly 1 payment row; found ' + payments.length)
  }
  const pay = payments[0]
  if (String(pay.stage) === 'ADVANCE' && Math.abs(Number(pay.amount) - ADVANCE_AMT) < 0.01) {
    console.log('Already corrected — skipping updates.')
    return false
  }

  const txn = new sql.Transaction(pool)
  await txn.begin()
  try {
    await new sql.Request(txn)
      .input('pid', sql.Int, pay.payment_id)
      .input('oid', sql.Int, order.order_id)
      .input('amt', sql.Decimal(12, 2), ADVANCE_AMT)
      .query(`
        UPDATE dbo.pos_payments
        SET stage = N'ADVANCE', amount = @amt,
            tendered = CASE WHEN method = N'CASH' THEN @amt ELSE tendered END
        WHERE payment_id = @pid AND order_id = @oid
      `)

    const oePayChk = await new sql.Request(txn).query(`
      SELECT CASE WHEN OBJECT_ID(N'dbo.oe_payments', N'U') IS NOT NULL THEN 1 ELSE 0 END AS ok
    `)
    if (oePayChk.recordset[0] && oePayChk.recordset[0].ok) {
      await new sql.Request(txn)
        .input('pid', sql.Int, pay.payment_id)
        .input('amt', sql.Decimal(12, 2), ADVANCE_AMT)
        .query(`
          UPDATE dbo.oe_payments
          SET stage = N'ADVANCE', amount = @amt,
              tendered = CASE WHEN method = N'CASH' THEN @amt ELSE tendered END
          WHERE legacy_pos_payment_id = @pid
        `)
    }

    await new sql.Request(txn)
      .input('oid', sql.Int, order.order_id)
      .input('pct', sql.Decimal(9, 2), newPct)
      .query(`UPDATE dbo.pos_orders SET lab_advance_pct_snapshot = @pct WHERE order_id = @oid`)

    const oeOrdChk = await new sql.Request(txn).query(`
      SELECT CASE WHEN OBJECT_ID(N'dbo.oe_orders', N'U') IS NOT NULL THEN 1 ELSE 0 END AS ok
    `)
    if (oeOrdChk.recordset[0] && oeOrdChk.recordset[0].ok) {
      await new sql.Request(txn)
        .input('oid', sql.Int, order.order_id)
        .input('pct', sql.Decimal(9, 2), newPct)
        .query(`
          UPDATE oe SET lab_advance_pct_snapshot = @pct
          FROM dbo.oe_orders oe
          INNER JOIN dbo.pos_orders po ON po.order_id = oe.legacy_pos_order_id
          WHERE po.order_id = @oid
        `)
    }

    if (String(order.status).toUpperCase() === 'COMPLETED') {
      await new sql.Request(txn)
        .input('oid', sql.Int, order.order_id)
        .query(`UPDATE dbo.pos_orders SET status = N'OPEN' WHERE order_id = @oid`)
    }

    const invChk = await new sql.Request(txn).query(`
      SELECT CASE WHEN OBJECT_ID(N'dbo.pos_invoices', N'U') IS NOT NULL THEN 1 ELSE 0 END AS ok
    `)
    if (invChk.recordset[0] && invChk.recordset[0].ok) {
      await new sql.Request(txn)
        .input('oid', sql.Int, order.order_id)
        .query(`DELETE FROM dbo.pos_invoices WHERE order_id = @oid`)
    }

    await new sql.Request(txn)
      .input('oid', sql.Int, order.order_id)
      .query(`
        UPDATE dbo.pos_sub_orders
        SET lab_workflow_status = N'ORDER_PLACED'
        WHERE order_id = @oid AND fulfillment = N'LAB'
          AND lab_workflow_status IN (N'DELIVERED', N'BALANCE_COLLECTED', N'INVOICED', N'READY_FOR_DELIVERY')
      `)

    await txn.commit()
    return true
  } catch (e) {
    await txn.rollback()
    throw e
  }
}

async function main() {
  const pool = await sql.connect(dbConfig())
  try {
    console.log('=== Preflight EW-ORD-8 ===')
    const ctx = await preflight(pool)
    console.log('mode:', ctx.mode)
    console.log('order:', ctx.order)
    console.log('payments:', ctx.payments)
    console.log('invoices:', ctx.invoices)
    console.log('subs:', ctx.subs)
    console.log('labPart:', ctx.labPart, 'labBase:', ctx.labBase, 'newPct:', ctx.newPct)

    if (dryRun) {
      console.log('\n--dry-run: no changes applied.')
      return
    }

    const changed = await applyFix(pool, ctx)
    if (changed) console.log('\nFix applied.')

    const bundle = await fetchOrderBundle(pool, ctx.order.order_id, ctx.order.store_id, ctx.mode)
    const ps = bundle.payment_summary
    console.log('\n=== Verification (fetchOrderBundle) ===')
    console.log('payments:', JSON.stringify(bundle.payments, null, 2))
    console.log('payment_summary:', JSON.stringify(ps, null, 2))

    const ok =
      bundle.payments.length === 1 &&
      bundle.payments[0].stage === 'ADVANCE' &&
      Math.abs(Number(bundle.payments[0].amount) - ADVANCE_AMT) < 0.01 &&
      Math.abs(Number(ps.paid_advance) - ADVANCE_AMT) < 0.01 &&
      Number(ps.advance_remaining) <= 0.009 &&
      Math.abs(Number(ps.amount_remaining) - (Number(ctx.order.total_amount) - ADVANCE_AMT)) < 0.02

    if (!ok) {
      console.error('\nVerification FAILED — review payment_summary above.')
      process.exit(1)
    }
    console.log('\nVerification OK: ADVANCE ₹800 paid, balance due ₹' + ps.amount_remaining)
  } finally {
    await pool.close()
  }
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
