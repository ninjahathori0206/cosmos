#!/usr/bin/env node
'use strict'

/**
 * Backfill customer_memberships for POS orders that sold a plan but have no active grant.
 * Usage: node scripts/backfill_membership_grants_from_orders.js [--dry-run] [--order-no EW-ORD-9]
 */
require('dotenv').config()
const { getPool } = require('../src/config/db')
const { grantCustomerMembership, membershipHasPosOrderIdColumn } = require('../src/services/membershipGrantService')

const dryRun = process.argv.includes('--dry-run')
const orderNoFilter = (() => {
  const i = process.argv.indexOf('--order-no')
  return i >= 0 ? String(process.argv[i + 1] || '').trim() : ''
})()

async function main() {
  const pool = await getPool()
  const hasLink = await membershipHasPosOrderIdColumn(pool)

  let query = `
    SELECT o.order_id, o.order_no, o.customer_id, o.sold_membership_plan_key, o.sold_membership_amount
    FROM dbo.pos_orders o
    WHERE o.sold_membership_plan_key IS NOT NULL
      AND LTRIM(RTRIM(o.sold_membership_plan_key)) <> N''
  `
  if (orderNoFilter) query += ` AND o.order_no = N'${orderNoFilter.replace(/'/g, "''")}'`

  const orders = await pool.request().query(query)
  const rows = orders.recordset || []
  let granted = 0
  let skipped = 0

  for (const o of rows) {
    let exists = false
    if (hasLink) {
      const ex = await pool.request()
        .input('oid', o.order_id)
        .input('cid', o.customer_id)
        .query(`
          SELECT TOP 1 membership_id FROM dbo.customer_memberships
          WHERE customer_id = @cid AND pos_order_id = @oid AND is_active = 1
        `)
      exists = ex.recordset.length > 0
    } else {
      const ex = await pool.request()
        .input('cid', o.customer_id)
        .input('pk', String(o.sold_membership_plan_key).trim())
        .query(`
          SELECT TOP 1 membership_id FROM dbo.customer_memberships
          WHERE customer_id = @cid AND plan_key = @pk AND is_active = 1
            AND expires_at > DATEADD(MINUTE, 330, SYSUTCDATETIME())
        `)
      exists = ex.recordset.length > 0
    }

    if (exists) {
      skipped++
      console.log('skip (already granted):', o.order_no)
      continue
    }

    if (dryRun) {
      console.log('would grant:', o.order_no, o.sold_membership_plan_key, o.sold_membership_amount)
      granted++
      continue
    }

    const out = await grantCustomerMembership(pool, {
      customerId: o.customer_id,
      planKey: o.sold_membership_plan_key,
      pricePaid: o.sold_membership_amount,
      posOrderId: o.order_id,
      useTransaction: false
    })
    console.log('granted:', o.order_no, 'membership_id', out.membership_id)
    granted++
  }

  console.log('\nDone. granted/would-grant:', granted, 'skipped:', skipped)
  await pool.close()
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
