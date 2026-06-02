#!/usr/bin/env node
'use strict'

/**
 * Migrate legacy MEMBERSHIP pos_orders → pos_membership_sales (M-series invoice).
 *
 * Usage:
 *   node scripts/migrate_membership_orders_to_sales.js --dry-run
 *   node scripts/migrate_membership_orders_to_sales.js --store-id 13
 */
require('dotenv').config()
const { getPool } = require('../src/config/db')
const membershipSaleService = require('../src/services/membershipSaleService')
const sql = require('mssql')

const dryRun = process.argv.includes('--dry-run')
const storeIdFilter = (() => {
  const i = process.argv.indexOf('--store-id')
  return i >= 0 ? Number(process.argv[i + 1]) : null
})()

async function main() {
  const pool = await getPool()
  const col = await pool.request().query(`
    SELECT CASE WHEN OBJECT_ID('dbo.pos_membership_sales', 'U') IS NULL THEN 0 ELSE 1 END AS ok
  `)
  if (Number((col.recordset[0] || {}).ok) !== 1) {
    console.error('Run npm run migrate:88-pos-membership-sales first.')
    process.exit(1)
  }

  let q = `
    SELECT o.order_id, o.order_no, o.store_id, o.customer_id, o.sold_membership_plan_key,
           o.sold_membership_amount, o.total_amount, o.created_by_user_id, o.created_at,
           o.linked_membership_order_id,
           (SELECT TOP 1 invoice_no FROM dbo.pos_invoices pi WHERE pi.order_id = o.order_id) AS old_invoice_no
    FROM dbo.pos_orders o
    WHERE UPPER(LTRIM(RTRIM(ISNULL(o.order_kind, N'')))) = N'MEMBERSHIP'
      AND ISNULL(o.status, N'') NOT IN (N'CANCELLED', N'MIGRATED')
      AND NOT EXISTS (
        SELECT 1 FROM dbo.pos_membership_sales ms
        WHERE ms.product_order_id = o.order_id
           OR (ms.customer_id = o.customer_id
               AND ms.plan_key = o.sold_membership_plan_key
               AND CONVERT(DATE, ms.created_at) = CONVERT(DATE, o.created_at)
               AND ms.amount = o.total_amount)
      )
  `
  if (Number.isFinite(storeIdFilter) && storeIdFilter > 0) {
    q += ` AND o.store_id = ${storeIdFilter}`
  }
  q += ' ORDER BY o.order_id'

  const rows = (await pool.request().query(q)).recordset || []
  console.log(dryRun ? '[dry-run]' : '[apply]', 'MEMBERSHIP orders to migrate:', rows.length)

  let migrated = 0
  let skipped = 0
  let failed = 0

  for (const row of rows) {
    const label = `${row.order_no} (#${row.order_id})`
    const planKey = String(row.sold_membership_plan_key || '').trim()
    const amount = membershipSaleService.roundMoney(Number(row.sold_membership_amount || row.total_amount) || 0)
    if (!planKey || amount <= 0) {
      skipped++
      console.log('skip:', label, 'invalid plan/amount')
      continue
    }

    const pays = await pool.request().input('oid', sql.Int, row.order_id).query(`
      SELECT payment_id, stage, method, amount, tendered, change_given, external_ref, created_by, created_at
      FROM dbo.pos_payments WHERE order_id = @oid ORDER BY payment_id
    `)
    const payments = pays.recordset || []

    const prodLink = await pool.request().input('mid', sql.Int, row.order_id).query(`
      SELECT TOP 1 order_id FROM dbo.pos_orders WHERE linked_membership_order_id = @mid
    `)
    const productOrderId = prodLink.recordset[0] ? prodLink.recordset[0].order_id : null

    if (dryRun) {
      migrated++
      console.log('would migrate:', label, '→ M-invoice', amount, 'payments', payments.length)
      continue
    }

    const tx = new sql.Transaction(pool)
    await tx.begin()
    try {
      const memOut = await membershipSaleService.createMembershipSaleInTransaction(tx, {
        storeId: row.store_id,
        customerId: row.customer_id,
        planKey,
        amount,
        productOrderId,
        createdBy: row.created_by_user_id,
        createdAt: row.created_at
      })

      for (const p of payments) {
        await membershipSaleService.insertMembershipPaymentInTransaction(
          tx,
          memOut.membership_sale_id,
          p.created_by || row.created_by_user_id,
          {
            stage: p.stage || 'FULL',
            method: p.method || 'CASH',
            amount: p.amount,
            external_ref: p.external_ref
          },
          p.tendered,
          p.change_given,
          p.created_at || row.created_at
        )
      }

      if (productOrderId) {
        await membershipSaleService.linkMembershipSaleToProductOrderInTransaction(
          tx,
          productOrderId,
          memOut.membership_sale_id
        )
      }

      await new sql.Request(tx).input('oid', sql.Int, row.order_id).query(`
        DELETE FROM dbo.pos_payments WHERE order_id = @oid
      `)
      await new sql.Request(tx).input('oid', sql.Int, row.order_id).query(`
        DELETE FROM dbo.pos_invoices WHERE order_id = @oid
      `)
      await new sql.Request(tx).input('oid', sql.Int, row.order_id).query(`
        UPDATE dbo.pos_orders SET status = N'MIGRATED' WHERE order_id = @oid
      `)

      await tx.commit()

      const hasSaleCol = await pool.request().query(`
        SELECT CASE WHEN COL_LENGTH('dbo.customer_memberships', 'pos_membership_sale_id') IS NULL THEN 0 ELSE 1 END AS ok
      `)
      if (Number((hasSaleCol.recordset[0] || {}).ok) === 1) {
        await pool.request()
          .input('sid', sql.Int, memOut.membership_sale_id)
          .input('oid', sql.Int, row.order_id)
          .query(`
            UPDATE dbo.customer_memberships
            SET pos_membership_sale_id = @sid, pos_order_id = NULL
            WHERE pos_order_id = @oid
          `)
      }

      migrated++
      console.log(
        'migrated:',
        label,
        '→',
        memOut.invoice_no,
        row.old_invoice_no ? `(was ${row.old_invoice_no})` : ''
      )
    } catch (e) {
      failed++
      try {
        await tx.rollback()
      } catch (_) {}
      console.error('error:', label, e.message)
    }
  }

  console.log('done.', { migrated, skipped, failed, dryRun })
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
