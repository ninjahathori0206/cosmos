#!/usr/bin/env node
'use strict'
/**
 * Align pos_membership_sales + pos_membership_payments dates with linked product orders
 * for SRT02 invoices updated in data fixes.
 */
require('dotenv').config()
const sql = require('mssql')

/** invoice_no → target IST wall clock for membership + product order */
const INVOICE_TARGETS = [
  { invoice_no: 'EW-INV-2627-SRT02-00013', target: '2026-05-31T12:00:00' },
  { invoice_no: 'EW-INV-2627-SRT02-00014', target: '2026-06-01T12:00:00' },
  { invoice_no: 'EW-INV-2627-SRT02-00016', target: '2026-06-01T12:00:00' }
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

async function findMembershipForProductOrder(pool, productOrderId) {
  const saleIds = new Set()

  const byLink = await pool.request().input('oid', sql.Int, productOrderId).query(`
    SELECT linked_membership_sale_id AS id FROM dbo.pos_orders WHERE order_id = @oid AND linked_membership_sale_id IS NOT NULL
  `)
  if (byLink.recordset[0]) saleIds.add(byLink.recordset[0].id)

  const byProduct = await pool.request().input('oid', sql.Int, productOrderId).query(`
    SELECT membership_sale_id AS id FROM dbo.pos_membership_sales WHERE product_order_id = @oid
  `)
  for (const row of byProduct.recordset || []) saleIds.add(row.id)

  const legacyMem = await pool.request().input('oid', sql.Int, productOrderId).query(`
    SELECT o.order_id
    FROM dbo.pos_orders po
    INNER JOIN dbo.pos_orders o ON o.order_id = po.linked_membership_order_id
    WHERE po.order_id = @oid AND po.linked_membership_order_id IS NOT NULL
  `)
  for (const row of legacyMem.recordset || []) {
    const inv = await pool.request().input('oid', sql.Int, row.order_id).query(`
      SELECT membership_sale_id FROM dbo.pos_membership_sales WHERE product_order_id = @oid
    `)
    for (const r of inv.recordset || []) saleIds.add(r.membership_sale_id)
    if (!inv.recordset.length) {
      // legacy MEMBERSHIP pos_order — update order/payments/invoices directly
      return { legacyOrderId: row.order_id, saleIds: [] }
    }
  }

  return { legacyOrderId: null, saleIds: [...saleIds] }
}

async function setDatesForOrderId(txn, orderId, target) {
  await new sql.Request(txn)
    .input('ts', sql.VarChar(19), target)
    .input('oid', sql.Int, orderId)
    .query(`UPDATE dbo.pos_orders SET created_at = CAST(@ts AS DATETIME2(0)) WHERE order_id = @oid`)
  await new sql.Request(txn)
    .input('ts', sql.VarChar(19), target)
    .input('oid', sql.Int, orderId)
    .query(`UPDATE dbo.pos_payments SET created_at = CAST(@ts AS DATETIME2(0)) WHERE order_id = @oid`)
  await new sql.Request(txn)
    .input('ts', sql.VarChar(19), target)
    .input('oid', sql.Int, orderId)
    .query(`UPDATE dbo.pos_invoices SET created_at = CAST(@ts AS DATETIME2(0)) WHERE order_id = @oid`)
}

async function setDatesForMembershipSale(txn, saleId, target) {
  await new sql.Request(txn)
    .input('ts', sql.VarChar(19), target)
    .input('sid', sql.Int, saleId)
    .query(`UPDATE dbo.pos_membership_sales SET created_at = CAST(@ts AS DATETIME2(0)) WHERE membership_sale_id = @sid`)
  await new sql.Request(txn)
    .input('ts', sql.VarChar(19), target)
    .input('sid', sql.Int, saleId)
    .query(`UPDATE dbo.pos_membership_payments SET created_at = CAST(@ts AS DATETIME2(0)) WHERE membership_sale_id = @sid`)
}

async function main() {
  const pool = await sql.connect(dbConfig())
  const results = []

  const tx = new sql.Transaction(pool)
  await tx.begin()
  try {
    for (const { invoice_no, target } of INVOICE_TARGETS) {
      const invRs = await new sql.Request(tx).input('no', sql.NVarChar, invoice_no).query(`
        SELECT pi.order_id, po.order_no
        FROM dbo.pos_invoices pi
        JOIN dbo.pos_orders po ON po.order_id = pi.order_id
        WHERE pi.invoice_no = @no
      `)
      if (!invRs.recordset.length) {
        results.push({ invoice_no, status: 'invoice not found' })
        continue
      }
      const productOrderId = invRs.recordset[0].order_id
      const orderNo = invRs.recordset[0].order_no

      const { legacyOrderId, saleIds } = await findMembershipForProductOrder(pool, productOrderId)

      if (legacyOrderId) {
        await setDatesForOrderId(tx, legacyOrderId, target)
        results.push({ invoice_no, order_no: orderNo, membership: 'legacy order ' + legacyOrderId, target })
      }

      if (!saleIds.length && !legacyOrderId) {
        results.push({ invoice_no, order_no: orderNo, membership: 'none linked', target })
        continue
      }

      for (const sid of saleIds) {
        await setDatesForMembershipSale(tx, sid, target)
        const snap = await new sql.Request(tx).input('sid', sql.Int, sid).query(`
          SELECT invoice_no, created_at FROM dbo.pos_membership_sales WHERE membership_sale_id = @sid
        `)
        results.push({
          invoice_no,
          order_no: orderNo,
          membership_invoice: snap.recordset[0].invoice_no,
          membership_at: snap.recordset[0].created_at,
          target
        })
      }
    }

    // SRT02 product orders with linked M-invoices (00004–00006) — align M-series to product order date
    const linkedRs = await new sql.Request(tx).query(`
      SELECT po.order_id, po.order_no, po.created_at AS product_at, po.linked_membership_sale_id,
             ms.invoice_no AS mem_invoice
      FROM dbo.pos_orders po
      INNER JOIN dbo.pos_membership_sales ms ON ms.membership_sale_id = po.linked_membership_sale_id
      WHERE po.order_no LIKE N'EW-ORD-SRT02-%' AND po.linked_membership_sale_id IS NOT NULL
    `)
    for (const row of linkedRs.recordset || []) {
      const fmtRs = await new sql.Request(tx).input('oid', sql.Int, row.order_id).query(`
        SELECT CONVERT(VARCHAR(19), created_at, 126) AS target_ist FROM dbo.pos_orders WHERE order_id = @oid
      `)
      const targetIst = String(fmtRs.recordset[0].target_ist)
      await setDatesForMembershipSale(tx, row.linked_membership_sale_id, targetIst)
      results.push({
        order_no: row.order_no,
        membership_invoice: row.mem_invoice,
        target: targetIst,
        note: 'aligned to product order created_at'
      })
    }

    await tx.commit()
  } catch (e) {
    await tx.rollback()
    throw e
  }

  console.log(JSON.stringify(results, null, 2))
  await pool.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
