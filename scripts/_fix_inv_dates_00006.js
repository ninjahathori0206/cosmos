#!/usr/bin/env node
'use strict'
/**
 * Set invoice, order, and payment created_at to 31 May 2026 (IST) for EW-INV-2627-SRT01-00006
 * Usage: node scripts/_fix_inv_dates_00006.js [--dry-run]
 */
require('dotenv').config()
const sql = require('mssql')

const INVOICE_NO = 'EW-INV-2627-SRT01-00006'
const TARGET_IST = '2026-05-31T12:00:00'
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

async function main() {
  const pool = await sql.connect(dbConfig())
  const pre = await pool.request().input('no', sql.NVarChar, INVOICE_NO).query(`
    SELECT pi.invoice_id, pi.invoice_no, pi.order_id, pi.created_at AS invoice_created_at,
           po.order_no, po.created_at AS order_created_at
    FROM dbo.pos_invoices pi
    JOIN dbo.pos_orders po ON po.order_id = pi.order_id
    WHERE pi.invoice_no = @no
  `)
  if (!pre.recordset.length) throw new Error('Invoice not found: ' + INVOICE_NO)
  const row = pre.recordset[0]
  const oid = row.order_id

  const pays = await pool.request().input('oid', sql.Int, oid).query(`
    SELECT payment_id, stage, method, amount, created_at FROM dbo.pos_payments WHERE order_id = @oid ORDER BY payment_id
  `)

  let oe = []
  try {
    const oeRs = await pool.request().input('lid', sql.Int, oid).query(`
      SELECT order_id, order_no, created_at FROM dbo.oe_orders WHERE legacy_pos_order_id = @lid
    `)
    oe = oeRs.recordset
  } catch (_) { /* oe_orders may not exist */ }

  console.log('BEFORE:', { invoice: row, payments: pays.recordset, oe_orders: oe })

  if (dryRun) {
    console.log('[dry-run] Would set created_at to', TARGET_IST, 'on invoice, order,', pays.recordset.length, 'payment(s)', oe.length ? '+ oe_orders' : '')
    await pool.close()
    return
  }

  const tx = new sql.Transaction(pool)
  await tx.begin()
  try {
    const req = () => new sql.Request(tx)
    await req()
      .input('ts', sql.VarChar(19), TARGET_IST)
      .input('iid', sql.Int, row.invoice_id)
      .query(`UPDATE dbo.pos_invoices SET created_at = CAST(@ts AS DATETIME2(0)) WHERE invoice_id = @iid`)
    await req()
      .input('ts', sql.VarChar(19), TARGET_IST)
      .input('oid', sql.Int, oid)
      .query(`UPDATE dbo.pos_orders SET created_at = CAST(@ts AS DATETIME2(0)) WHERE order_id = @oid`)
    await req()
      .input('ts', sql.VarChar(19), TARGET_IST)
      .input('oid', sql.Int, oid)
      .query(`UPDATE dbo.pos_payments SET created_at = CAST(@ts AS DATETIME2(0)) WHERE order_id = @oid`)
    for (const o of oe) {
      await req()
        .input('ts', sql.VarChar(19), TARGET_IST)
        .input('oeid', sql.Int, o.order_id)
        .query(`UPDATE dbo.oe_orders SET created_at = CAST(@ts AS DATETIME2(0)) WHERE order_id = @oeid`)
    }
    await tx.commit()
    console.log('UPDATED to', TARGET_IST)
  } catch (e) {
    await tx.rollback()
    throw e
  }

  const post = await pool.request().input('no', sql.NVarChar, INVOICE_NO).query(`
    SELECT pi.invoice_no, pi.created_at AS invoice_created_at, po.order_no, po.created_at AS order_created_at
    FROM dbo.pos_invoices pi JOIN dbo.pos_orders po ON po.order_id = pi.order_id WHERE pi.invoice_no = @no
  `)
  const pays2 = await pool.request().input('oid', sql.Int, oid).query(`
    SELECT payment_id, stage, created_at FROM dbo.pos_payments WHERE order_id = @oid ORDER BY payment_id
  `)
  console.log('AFTER:', { ...post.recordset[0], payments: pays2.recordset })
  await pool.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
