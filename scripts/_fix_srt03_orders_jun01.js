#!/usr/bin/env node
'use strict'
require('dotenv').config()
const sql = require('mssql')

const TARGET_IST = '2026-06-01T12:00:00'
const ORDER_NOS = [
  'EW-ORD-SRT03-00006',
  'EW-ORD-SRT03-00005',
  'EW-ORD-SRT03-00004',
  'EW-ORD-SRT03-00007'
]

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
  const ids = []
  for (const no of ORDER_NOS) {
    const r = await pool.request().input('no', sql.NVarChar, no).query(`
      SELECT order_id FROM dbo.pos_orders WHERE order_no = @no
    `)
    if (!r.recordset.length) throw new Error('Not found: ' + no)
    ids.push(r.recordset[0].order_id)
  }

  const tx = new sql.Transaction(pool)
  await tx.begin()
  try {
    for (const oid of ids) {
      await new sql.Request(tx)
        .input('ts', sql.VarChar(19), TARGET_IST)
        .input('oid', sql.Int, oid)
        .query(`UPDATE dbo.pos_orders SET created_at = CAST(@ts AS DATETIME2(0)) WHERE order_id = @oid`)
      await new sql.Request(tx)
        .input('ts', sql.VarChar(19), TARGET_IST)
        .input('oid', sql.Int, oid)
        .query(`UPDATE dbo.pos_payments SET created_at = CAST(@ts AS DATETIME2(0)) WHERE order_id = @oid`)
      await new sql.Request(tx)
        .input('ts', sql.VarChar(19), TARGET_IST)
        .input('oid', sql.Int, oid)
        .query(`UPDATE dbo.pos_invoices SET created_at = CAST(@ts AS DATETIME2(0)) WHERE order_id = @oid`)
    }
    await tx.commit()
  } catch (e) {
    await tx.rollback()
    throw e
  }

  console.log('Updated to', TARGET_IST)
  for (const no of ORDER_NOS) {
    const snap = await pool.request().input('no', sql.NVarChar, no).query(`
      SELECT po.order_no, po.created_at AS order_at,
        (SELECT MIN(created_at) FROM dbo.pos_payments pp WHERE pp.order_id = po.order_id) AS pay_at,
        (SELECT invoice_no FROM dbo.pos_invoices pi WHERE pi.order_id = po.order_id) AS invoice_no,
        (SELECT MIN(created_at) FROM dbo.pos_invoices pi WHERE pi.order_id = po.order_id) AS inv_at
      FROM dbo.pos_orders po WHERE po.order_no = @no
    `)
    console.log(snap.recordset[0])
  }
  await pool.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
