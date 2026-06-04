#!/usr/bin/env node
'use strict'
require('dotenv').config()
const { getPool } = require('../src/config/db')
const orderService = require('../src/services/orderService')
const { getMembershipFamilyForCustomer } = require('../src/services/membershipDependentService')

// Inline mirror of cx.js helper for smoke test
async function fetchActiveMembershipForCx(pool, customerId, mode) {
  const tierColR = await pool.request().query(`SELECT COL_LENGTH('dbo.membership_plans', 'tier_id') AS col_len`)
  const linkTiers = tierColR.recordset[0]?.col_len != null && Number(tierColR.recordset[0].col_len) > 0
  const poColR = await pool.request().query(`SELECT COL_LENGTH('dbo.customer_memberships', 'pos_order_id') AS col_len`)
  const hasPosOrderLink = poColR.recordset[0]?.col_len != null && Number(poColR.recordset[0].col_len) > 0
  const ordersTable = mode === 'shared' ? 'dbo.oe_orders' : 'dbo.pos_orders'
  const posOrderSelect = hasPosOrderLink ? 'm.pos_order_id,' : 'CAST(NULL AS INT) AS pos_order_id,'
  const orderJoin = hasPosOrderLink ? `LEFT JOIN ${ordersTable} o ON o.order_id = m.pos_order_id` : ''
  const orderNoSelect = hasPosOrderLink ? 'o.order_no AS linked_order_no' : 'CAST(NULL AS NVARCHAR(50)) AS linked_order_no'
  const tierSelect = linkTiers
    ? `p.tier_id, t.tier_name, t.loyalty_tier AS membership_type, t.benefits AS tier_benefits`
    : `NULL AS tier_id, p.display_name AS tier_name, NULL AS membership_type, NULL AS tier_benefits`
  const tierJoin = linkTiers ? 'LEFT JOIN dbo.membership_tiers t ON t.membership_id = p.tier_id' : ''
  const memR = await pool.request().input('cid', customerId).query(`
    SELECT TOP 1 m.membership_id, m.plan_key, ${posOrderSelect} p.display_name AS plan_display_name,
      ${tierSelect}, ${orderNoSelect}
    FROM dbo.customer_memberships m
    JOIN dbo.membership_plans p ON p.plan_key = m.plan_key
    ${tierJoin} ${orderJoin}
    WHERE m.customer_id = @cid AND m.is_active = 1
      AND m.expires_at > DATEADD(MINUTE, 330, SYSUTCDATETIME())
    ORDER BY m.expires_at DESC`)
  return memR.recordset[0] || null
}

const customerId = Number(process.argv[2] || 10)

async function main() {
  const pool = await getPool()
  const mode = await orderService.getOrdersEngineMode(pool)
  console.log('customer_id', customerId, 'orders_engine_mode', mode)
  const active = await fetchActiveMembershipForCx(pool, customerId, mode)
  console.log('active_membership:', active ? active.plan_key : '(none)')
  const family = await getMembershipFamilyForCustomer(pool, customerId)
  console.log('family role:', family.role)
  console.log('OK')
}

main().catch((err) => {
  console.error('FAILED:', err.message)
  process.exit(1)
})
