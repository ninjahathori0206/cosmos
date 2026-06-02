#!/usr/bin/env node
'use strict'
/**
 * Correct store 13 demo transactions to 1 June 2026 (IST) for Day Store Report.
 * Orders: EW-ORD-14, EW-ORD-15, EW-ORD-16 + invoice EW-INV-2627-SRT01-00007
 * Usage: node scripts/fix-june-1-2026-store-13-dates.js [--dry-run]
 */
require('dotenv').config()
const sql = require('mssql')

const TARGET_IST = '2026-06-01T12:00:00'
const ORDER_NOS = ['EW-ORD-14', 'EW-ORD-15', 'EW-ORD-16']
const INVOICE_NOS = ['EW-INV-2627-SRT01-00007']
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

async function collectOrderIds(pool) {
  const orderIds = new Set()
  for (const no of ORDER_NOS) {
    const r = await pool.request().input('no', sql.NVarChar, no).query(`
      SELECT order_id FROM dbo.pos_orders WHERE order_no = @no
    `)
    if (r.recordset[0]) orderIds.add(r.recordset[0].order_id)
    else console.warn('Order not found:', no)
  }
  for (const no of INVOICE_NOS) {
    const r = await pool.request().input('no', sql.NVarChar, no).query(`
      SELECT order_id FROM dbo.pos_invoices WHERE invoice_no = @no
    `)
    if (r.recordset[0]) orderIds.add(r.recordset[0].order_id)
    else console.warn('Invoice not found:', no)
  }
  return [...orderIds]
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
  const orderIds = await collectOrderIds(pool)
  if (!orderIds.length) {
    console.error('No orders to update.')
    process.exit(1)
  }
  console.log('order_ids:', orderIds, '→', TARGET_IST)
  if (dryRun) {
    console.log('[dry-run] no changes written')
    await pool.close()
    return
  }
  await applyDates(pool, orderIds)
  const check = await pool.request().query(`
    SELECT order_no, CONVERT(varchar(10), created_at, 23) AS ymd,
           CONVERT(varchar(10), created_at, 103) AS ddmmyyyy, total_amount, status
    FROM dbo.pos_orders WHERE order_id IN (${orderIds.join(',')})
    ORDER BY order_no
  `)
  console.log('Updated:', check.recordset)
  await pool.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
