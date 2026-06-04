#!/usr/bin/env node
'use strict'
/**
 * Set created_at to 1 May 2026 (IST) for EW-ORD-16 and EW-INV-2627-SRT01-00007 (+ linked order).
 * Usage: node scripts/_fix_dates_ord16_inv00007.js [--dry-run]
 */
require('dotenv').config()
const sql = require('mssql')

const TARGET_IST = '2026-05-01T12:00:00'
const ORDER_NO = 'EW-ORD-16'
const INVOICE_NO = 'EW-INV-2627-SRT01-00007'
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

async function loadOrderIds(pool) {
  const orderIds = new Set()

  const ordRs = await pool.request().input('no', sql.NVarChar, ORDER_NO).query(`
    SELECT order_id, order_no, created_at FROM dbo.pos_orders WHERE order_no = @no
  `)
  if (!ordRs.recordset.length) throw new Error('Order not found: ' + ORDER_NO)
  orderIds.add(ordRs.recordset[0].order_id)

  const invRs = await pool.request().input('no', sql.NVarChar, INVOICE_NO).query(`
    SELECT pi.invoice_id, pi.invoice_no, pi.order_id, pi.created_at, po.order_no
    FROM dbo.pos_invoices pi
    JOIN dbo.pos_orders po ON po.order_id = pi.order_id
    WHERE pi.invoice_no = @no
  `)
  if (!invRs.recordset.length) throw new Error('Invoice not found: ' + INVOICE_NO)
  orderIds.add(invRs.recordset[0].order_id)

  return {
    orders: [...orderIds],
    ord16: ordRs.recordset[0],
    invoice: invRs.recordset[0]
  }
}

async function snapshot(pool, orderIds) {
  const out = { orders: [], invoices: [], payments: [] }
  for (const oid of orderIds) {
    const o = await pool.request().input('oid', sql.Int, oid).query(`
      SELECT order_id, order_no, created_at FROM dbo.pos_orders WHERE order_id = @oid
    `)
    out.orders.push(...(o.recordset || []))
    const inv = await pool.request().input('oid', sql.Int, oid).query(`
      SELECT invoice_id, invoice_no, created_at FROM dbo.pos_invoices WHERE order_id = @oid
    `)
    out.invoices.push(...(inv.recordset || []))
    const pays = await pool.request().input('oid', sql.Int, oid).query(`
      SELECT payment_id, stage, amount, created_at FROM dbo.pos_payments WHERE order_id = @oid ORDER BY payment_id
    `)
    out.payments.push(...(pays.recordset || []))
  }
  return out
}

async function applyDates(pool, orderIds) {
  const tx = new sql.Transaction(pool)
  await tx.begin()
  try {
    const req = () => new sql.Request(tx)
    for (const oid of orderIds) {
      await req()
        .input('ts', sql.VarChar(19), TARGET_IST)
        .input('oid', sql.Int, oid)
        .query(`UPDATE dbo.pos_orders SET created_at = CAST(@ts AS DATETIME2(0)) WHERE order_id = @oid`)
      await req()
        .input('ts', sql.VarChar(19), TARGET_IST)
        .input('oid', sql.Int, oid)
        .query(`UPDATE dbo.pos_payments SET created_at = CAST(@ts AS DATETIME2(0)) WHERE order_id = @oid`)
      await req()
        .input('ts', sql.VarChar(19), TARGET_IST)
        .input('oid', sql.Int, oid)
        .query(`UPDATE dbo.pos_invoices SET created_at = CAST(@ts AS DATETIME2(0)) WHERE order_id = @oid`)
      const oe = await req().input('lid', sql.Int, oid).query(`
        SELECT order_id FROM dbo.oe_orders WHERE legacy_pos_order_id = @lid
      `).catch(() => ({ recordset: [] }))
      for (const row of oe.recordset || []) {
        await req()
          .input('ts', sql.VarChar(19), TARGET_IST)
          .input('oeid', sql.Int, row.order_id)
          .query(`UPDATE dbo.oe_orders SET created_at = CAST(@ts AS DATETIME2(0)) WHERE order_id = @oeid`)
      }
    }
    await tx.commit()
  } catch (e) {
    await tx.rollback()
    throw e
  }
}

async function main() {
  const pool = await sql.connect(dbConfig())
  const ctx = await loadOrderIds(pool)
  console.log('Targets:', ctx)
  const before = await snapshot(pool, ctx.orders)
  console.log('BEFORE:', JSON.stringify(before, null, 2))

  if (dryRun) {
    console.log('[dry-run] Would set', TARGET_IST, 'on order_ids:', ctx.orders)
    await pool.close()
    return
  }

  await applyDates(pool, ctx.orders)
  const after = await snapshot(pool, ctx.orders)
  console.log('AFTER:', JSON.stringify(after, null, 2))
  await pool.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
