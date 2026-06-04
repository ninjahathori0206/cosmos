#!/usr/bin/env node
'use strict'
require('dotenv').config()
const sql = require('mssql')

const TARGET = '2026-06-01T12:00:00'
const PRODUCT_INVOICES = ['EW-INV-2627-SRT02-00014', 'EW-INV-2627-SRT02-00016']

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

async function findMembershipLinks(pool, productOrderId) {
  const out = { saleIds: [], legacyOrderIds: [] }

  const po = await pool.request().input('oid', sql.Int, productOrderId).query(`
    SELECT order_id, order_no, customer_id, linked_membership_sale_id, linked_membership_order_id
    FROM dbo.pos_orders WHERE order_id = @oid
  `)
  const order = po.recordset[0]
  if (!order) return { order: null, ...out }

  if (order.linked_membership_sale_id) out.saleIds.push(order.linked_membership_sale_id)

  if (order.linked_membership_order_id) out.legacyOrderIds.push(order.linked_membership_order_id)

  const byProduct = await pool.request().input('oid', sql.Int, productOrderId).query(`
    SELECT membership_sale_id, invoice_no, created_at FROM dbo.pos_membership_sales WHERE product_order_id = @oid
  `)
  for (const r of byProduct.recordset || []) out.saleIds.push(r.membership_sale_id)

  // Same customer, membership sale within 2 hours of product order (checkout bundle heuristic)
  const near = await pool.request()
    .input('cid', sql.Int, order.customer_id)
    .input('oid', sql.Int, productOrderId)
    .query(`
      SELECT ms.membership_sale_id, ms.invoice_no, ms.product_order_id, ms.created_at
      FROM dbo.pos_membership_sales ms
      INNER JOIN dbo.pos_orders po ON po.order_id = @oid
      WHERE ms.customer_id = @cid
        AND ms.product_order_id IS NOT NULL
        AND ms.product_order_id <> @oid
        AND ABS(DATEDIFF(MINUTE, ms.created_at, po.created_at)) <= 120
    `)
  for (const r of near.recordset || []) out.saleIds.push(r.membership_sale_id)

  out.saleIds = [...new Set(out.saleIds)]
  out.legacyOrderIds = [...new Set(out.legacyOrderIds)]
  return { order, ...out }
}

async function setMembershipSale(pool, saleId, target) {
  const tx = new sql.Transaction(pool)
  await tx.begin()
  try {
    await new sql.Request(tx)
      .input('ts', sql.VarChar(19), target)
      .input('sid', sql.Int, saleId)
      .query(`UPDATE dbo.pos_membership_sales SET created_at = CAST(@ts AS DATETIME2(0)) WHERE membership_sale_id = @sid`)
    await new sql.Request(tx)
      .input('ts', sql.VarChar(19), target)
      .input('sid', sql.Int, saleId)
      .query(`UPDATE dbo.pos_membership_payments SET created_at = CAST(@ts AS DATETIME2(0)) WHERE membership_sale_id = @sid`)
    await tx.commit()
  } catch (e) {
    await tx.rollback()
    throw e
  }
}

async function main() {
  const pool = await sql.connect(dbConfig())
  const report = []

  for (const invoiceNo of PRODUCT_INVOICES) {
    const inv = await pool.request().input('no', sql.NVarChar, invoiceNo).query(`
      SELECT pi.order_id, po.order_no FROM dbo.pos_invoices pi
      JOIN dbo.pos_orders po ON po.order_id = pi.order_id WHERE pi.invoice_no = @no
    `)
    if (!inv.recordset.length) {
      report.push({ product_invoice: invoiceNo, error: 'not found' })
      continue
    }
    const productOrderId = inv.recordset[0].order_id
    const orderNo = inv.recordset[0].order_no
    const links = await findMembershipLinks(pool, productOrderId)

    const entry = {
      product_invoice: invoiceNo,
      product_order: orderNo,
      membership_found: []
    }

    if (!links.saleIds.length && !links.legacyOrderIds.length) {
      entry.result = 'no membership invoice linked to this order'
      report.push(entry)
      continue
    }

    for (const sid of links.saleIds) {
      await setMembershipSale(pool, sid, TARGET)
      const snap = await pool.request().input('sid', sql.Int, sid).query(`
        SELECT invoice_no, created_at FROM dbo.pos_membership_sales WHERE membership_sale_id = @sid
      `)
      entry.membership_found.push({
        membership_sale_id: sid,
        invoice_no: snap.recordset[0].invoice_no,
        created_at: snap.recordset[0].created_at,
        updated_to: TARGET
      })
    }

    for (const legacyOid of links.legacyOrderIds) {
      const tx = new sql.Transaction(pool)
      await tx.begin()
      try {
        for (const q of [
          'UPDATE dbo.pos_orders SET created_at = CAST(@ts AS DATETIME2(0)) WHERE order_id = @oid',
          'UPDATE dbo.pos_payments SET created_at = CAST(@ts AS DATETIME2(0)) WHERE order_id = @oid',
          'UPDATE dbo.pos_invoices SET created_at = CAST(@ts AS DATETIME2(0)) WHERE order_id = @oid'
        ]) {
          await new sql.Request(tx).input('ts', sql.VarChar(19), TARGET).input('oid', sql.Int, legacyOid).query(q)
        }
        await tx.commit()
      } catch (e) {
        await tx.rollback()
        throw e
      }
      const lo = await pool.request().input('oid', sql.Int, legacyOid).query(`
        SELECT order_no FROM dbo.pos_orders WHERE order_id = @oid
      `)
      entry.membership_found.push({
        legacy_membership_order: lo.recordset[0].order_no,
        updated_to: TARGET
      })
    }

    entry.result = entry.membership_found.length ? 'updated' : 'no membership invoice linked to this order'
    report.push(entry)
  }

  console.log(JSON.stringify(report, null, 2))
  await pool.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
