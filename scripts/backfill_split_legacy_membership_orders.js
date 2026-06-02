#!/usr/bin/env node
'use strict'

/**
 * Retroactive split: legacy combined product+membership on one pos_orders row → product + MEMBERSHIP + two invoices.
 *
 * Prerequisites: migration 87 (linked_membership_order_id on pos_orders).
 *
 * Usage:
 *   node scripts/backfill_split_legacy_membership_orders.js --dry-run
 *   node scripts/backfill_split_legacy_membership_orders.js --order-no EW-ORD-8
 *   node scripts/backfill_split_legacy_membership_orders.js --limit 50
 *   node scripts/backfill_split_legacy_membership_orders.js --grant-after-split
 */
require('dotenv').config()
const { getPool } = require('../src/config/db')
const {
  splitLegacyCombinedMembershipOrder,
  listLegacyCombinedMembershipOrderIds
} = require('../src/services/orderService')
const { grantCustomerMembership } = require('../src/services/membershipGrantService')

const dryRun = process.argv.includes('--dry-run')
const grantAfter = process.argv.includes('--grant-after-split')
const orderNoFilter = (() => {
  const i = process.argv.indexOf('--order-no')
  return i >= 0 ? String(process.argv[i + 1] || '').trim() : ''
})()
const limit = (() => {
  const i = process.argv.indexOf('--limit')
  if (i < 0) return 500
  const n = Number(process.argv[i + 1])
  return Number.isFinite(n) && n > 0 ? n : 500
})()

async function maybeGrantMembership(pool, memSaleId, productOrderId) {
  const head = await pool.request().input('sid', memSaleId).query(`
    SELECT membership_sale_id, customer_id, plan_key, amount
    FROM dbo.pos_membership_sales WHERE membership_sale_id = @sid
  `)
  const o = head.recordset[0]
  if (!o || !o.plan_key) return { granted: false, reason: 'no_membership_sale' }

  const ex = await pool.request()
    .input('sid', memSaleId)
    .input('cid', o.customer_id)
    .query(`
      SELECT TOP 1 membership_id FROM dbo.customer_memberships
      WHERE customer_id = @cid AND pos_membership_sale_id = @sid AND is_active = 1
    `)
  if (ex.recordset.length > 0) {
    return { granted: false, reason: 'already_granted_on_membership_sale' }
  }

  const exProd = await pool.request()
    .input('oid', productOrderId)
    .input('cid', o.customer_id)
    .query(`
      SELECT TOP 1 membership_id FROM dbo.customer_memberships
      WHERE customer_id = @cid AND pos_order_id = @oid AND is_active = 1
    `)
  if (exProd.recordset.length > 0) {
    return { granted: false, reason: 'grant_still_on_product_order_run_migrate_75' }
  }

  const out = await grantCustomerMembership(pool, {
    customerId: o.customer_id,
    planKey: o.plan_key,
    pricePaid: o.amount,
    posMembershipSaleId: memSaleId,
    useTransaction: false
  })
  return { granted: true, membership_id: out.membership_id }
}

async function main() {
  const pool = await getPool()
  const col = await pool.request().query(`
    SELECT CASE WHEN COL_LENGTH('dbo.pos_orders', 'linked_membership_order_id') IS NULL THEN 0 ELSE 1 END AS ok
  `)
  if (Number((col.recordset[0] || {}).ok) !== 1) {
    console.error('Run npm run migrate:87-pos-linked-membership first.')
    process.exit(1)
  }

  const rows = await listLegacyCombinedMembershipOrderIds(pool, {
    orderNo: orderNoFilter || undefined,
    limit
  })

  console.log(
    dryRun ? '[dry-run]' : '[apply]',
    'candidates:',
    rows.length,
    orderNoFilter ? `(filter ${orderNoFilter})` : ''
  )

  let split = 0
  let skipped = 0
  let failed = 0

  for (const row of rows) {
    const label = `${row.order_no} (#${row.order_id})`
    try {
      const result = await splitLegacyCombinedMembershipOrder(pool, row.order_id, { dryRun })
      if (!result.ok) {
        skipped++
        console.log('skip:', label, result.reason || 'unknown')
        continue
      }
      if (result.dry_run) {
        split++
        console.log('would split:', label, 'M=', result.plan.membership_amount, '→', result.plan.new_product_total)
        continue
      }

      split++
      console.log(
        'split:',
        label,
        '→ sale',
        result.membership_invoice_no || '(M-invoice pending)',
        'product inv',
        result.product_invoice_no
      )

      if (grantAfter) {
        const g = await maybeGrantMembership(pool, result.membership_sale_id, result.product_order_id)
        if (g.granted) {
          console.log('  granted membership_id', g.membership_id)
        } else if (g.reason) {
          console.log('  grant:', g.reason)
        }
      }
    } catch (e) {
      failed++
      console.error('error:', label, e.message)
    }
  }

  console.log('done.', { split, skipped, failed, dryRun })
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
