#!/usr/bin/env node
'use strict'

/**
 * EW-ORD-14: FULL ₹5500 → ADVANCE ₹2000; order + payment dates → 1 May 2026 (IST).
 * Usage: node scripts/run_fix_ew_ord_14_advance_and_dates.js [--dry-run]
 */
require('dotenv').config()
const sql = require('mssql')
const { fetchOrderBundle } = require('../src/services/orderService')

const ORDER_NO = 'EW-ORD-14'
const ADVANCE_AMT = 2000
const TARGET_IST = '2026-05-01T12:00:00'
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
           discount_amount, lab_advance_pct_snapshot, sold_membership_amount, created_at
    FROM dbo.pos_orders WHERE order_no = @no
  `)
  if (!orderRs.recordset.length) throw new Error('Order not found: ' + ORDER_NO)
  const order = orderRs.recordset[0]

  const pays = await pool.request().input('oid', sql.Int, order.order_id).query(`
    SELECT payment_id, stage, method, amount, tendered, created_at
    FROM dbo.pos_payments WHERE order_id = @oid ORDER BY payment_id
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

  return { mode, order, payments: pays.recordset || [], labPart, labBase, newPct }
}

async function applyFix(pool, ctx) {
  const { order, payments, newPct } = ctx
  if (payments.length !== 1) {
    throw new Error('Expected exactly 1 payment row; found ' + payments.length)
  }
  const pay = payments[0]

  const txn = new sql.Transaction(pool)
  await txn.begin()
  try {
    const req = () => new sql.Request(txn)

    await req()
      .input('pid', sql.Int, pay.payment_id)
      .input('oid', sql.Int, order.order_id)
      .input('amt', sql.Decimal(12, 2), ADVANCE_AMT)
      .input('ts', sql.VarChar(19), TARGET_IST)
      .query(`
        UPDATE dbo.pos_payments
        SET stage = N'ADVANCE', amount = @amt,
            tendered = CASE WHEN method = N'CASH' THEN @amt ELSE tendered END,
            created_at = CAST(@ts AS DATETIME2(0))
        WHERE payment_id = @pid AND order_id = @oid
      `)

    const oePayChk = await req().query(`
      SELECT CASE WHEN OBJECT_ID(N'dbo.oe_payments', N'U') IS NOT NULL THEN 1 ELSE 0 END AS ok
    `)
    if (oePayChk.recordset[0] && oePayChk.recordset[0].ok) {
      await req()
        .input('pid', sql.Int, pay.payment_id)
        .input('amt', sql.Decimal(12, 2), ADVANCE_AMT)
        .input('ts', sql.VarChar(19), TARGET_IST)
        .query(`
          UPDATE dbo.oe_payments
          SET stage = N'ADVANCE', amount = @amt,
              tendered = CASE WHEN method = N'CASH' THEN @amt ELSE tendered END,
              created_at = CAST(@ts AS DATETIME2(0))
          WHERE legacy_pos_payment_id = @pid
        `)
    }

    await req()
      .input('oid', sql.Int, order.order_id)
      .input('pct', sql.Decimal(9, 2), newPct)
      .input('ts', sql.VarChar(19), TARGET_IST)
      .query(`
        UPDATE dbo.pos_orders
        SET lab_advance_pct_snapshot = @pct, created_at = CAST(@ts AS DATETIME2(0))
        WHERE order_id = @oid
      `)

    const oeOrdChk = await req().query(`
      SELECT CASE WHEN OBJECT_ID(N'dbo.oe_orders', N'U') IS NOT NULL THEN 1 ELSE 0 END AS ok
    `)
    if (oeOrdChk.recordset[0] && oeOrdChk.recordset[0].ok) {
      await req()
        .input('oid', sql.Int, order.order_id)
        .input('pct', sql.Decimal(9, 2), newPct)
        .input('ts', sql.VarChar(19), TARGET_IST)
        .query(`
          UPDATE oe SET lab_advance_pct_snapshot = @pct, created_at = CAST(@ts AS DATETIME2(0))
          FROM dbo.oe_orders oe
          INNER JOIN dbo.pos_orders po ON po.order_id = oe.legacy_pos_order_id
          WHERE po.order_id = @oid
        `)
    }

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
    console.log('=== Preflight', ORDER_NO, '===')
    const ctx = await preflight(pool)
    console.log('order:', ctx.order)
    console.log('payments:', ctx.payments)
    console.log('labPart:', ctx.labPart, 'labBase:', ctx.labBase, 'newPct:', ctx.newPct)

    if (dryRun) {
      console.log('\n--dry-run: would set ADVANCE ₹' + ADVANCE_AMT + ', dates ' + TARGET_IST)
      return
    }

    await applyFix(pool, ctx)
    console.log('\nFix applied.')

    const bundle = await fetchOrderBundle(pool, ctx.order.order_id, ctx.order.store_id, ctx.mode)
    const ps = bundle.payment_summary
    console.log('\n=== Verification ===')
    console.log('payments:', JSON.stringify(bundle.payments, null, 2))
    console.log('payment_summary:', JSON.stringify(ps, null, 2))

    const orderRs = await pool.request().input('no', sql.NVarChar, ORDER_NO).query(`
      SELECT created_at, lab_advance_pct_snapshot FROM dbo.pos_orders WHERE order_no = @no
    `)

    const ok =
      bundle.payments.length === 1 &&
      bundle.payments[0].stage === 'ADVANCE' &&
      Math.abs(Number(bundle.payments[0].amount) - ADVANCE_AMT) < 0.01 &&
      Math.abs(Number(ps.paid_advance) - ADVANCE_AMT) < 0.01 &&
      Number(ps.paid_full) < 0.01 &&
      Math.abs(Number(ps.amount_remaining) - (Number(ctx.order.total_amount) - ADVANCE_AMT)) < 0.02 &&
      Number(ps.advance_remaining) < 0.02

    console.log('order row:', orderRs.recordset[0])
    if (!ok) {
      console.error('\nVerification FAILED')
      process.exit(1)
    }
    console.log('\nVerification OK: ADVANCE ₹' + ADVANCE_AMT + ', balance due ₹' + ps.amount_remaining)
  } finally {
    await pool.close()
  }
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
