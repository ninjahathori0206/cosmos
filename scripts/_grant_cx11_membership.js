#!/usr/bin/env node
'use strict'
require('dotenv').config()
const { getPool } = require('../src/config/db')
const { grantCustomerMembership } = require('../src/services/membershipGrantService')

async function main() {
  const pool = await getPool()
  const col = await pool.request().query(`
    SELECT COL_LENGTH('dbo.customer_memberships', 'pos_order_id') AS col_len
  `)
  console.log('pos_order_id column:', col.recordset[0])

  try {
    const out = await grantCustomerMembership(pool, {
      customerId: 11,
      planKey: 'PLUS',
      pricePaid: 100,
      posOrderId: 18,
      createdByUserId: null,
      useTransaction: false
    })
    console.log('Granted:', out)
  } catch (e) {
    console.error('Grant failed:', e.message)
    process.exit(1)
  }

  const mem = await pool.request().input('cid', 11).query(`
    SELECT membership_id, plan_key, price_paid, is_active, expires_at, pos_order_id
    FROM dbo.customer_memberships WHERE customer_id = @cid AND is_active = 1
  `)
  console.log('Active membership:', mem.recordset[0])
  await pool.close()
}

main()
