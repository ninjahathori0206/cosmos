const sql = require('mssql')

let _hasPosOrderIdCol = null

async function membershipHasPosOrderIdColumn(db) {
  if (_hasPosOrderIdCol != null) return _hasPosOrderIdCol
  const r = await db.request().query(`
    SELECT COL_LENGTH('dbo.customer_memberships', 'pos_order_id') AS col_len
  `)
  const len = r.recordset && r.recordset[0] && r.recordset[0].col_len
  _hasPosOrderIdCol = len != null && Number(len) > 0
  return _hasPosOrderIdCol
}

/**
 * Load active membership plan by plan_key.
 * @param {import('mssql').ConnectionPool|import('mssql').Transaction} db
 * @param {string} planKey
 */
async function loadActiveMembershipPlan(db, planKey) {
  const pk = String(planKey || '').trim()
  if (!pk) return null
  const r = await db.request().input('pk', sql.NVarChar(50), pk).query(`
    SELECT plan_key, display_name, price, validity_days, validity_type, is_active,
           has_plus_access, extra_cashback_pct, flat_discount_pct,
           has_one_time_discount, can_create_sub_cards
    FROM   dbo.membership_plans
    WHERE  plan_key = @pk AND is_active = 1
  `)
  return r.recordset[0] || null
}

/**
 * Grant or renew customer membership (deactivates prior active rows).
 * @param {import('mssql').ConnectionPool|import('mssql').Transaction} db — pool or active transaction
 * @param {{ customerId: number, planKey: string, pricePaid?: number|null, validityDays?: number|null, expiresAt?: string|null, posOrderId?: number|null, createdByUserId?: number|null, useTransaction?: boolean }} opts
 * @returns {Promise<{ membership_id: number }>}
 */
async function grantCustomerMembership(db, opts) {
  const customerId = Number(opts.customerId)
  const planKey = String(opts.planKey || '').trim()
  if (!Number.isFinite(customerId) || customerId < 1) {
    const err = new Error('Invalid customer ID.')
    err.statusCode = 400
    throw err
  }
  if (!planKey) {
    const err = new Error('plan_key is required.')
    err.statusCode = 400
    throw err
  }

  const plan = await loadActiveMembershipPlan(db, planKey)
  if (!plan) {
    const err = new Error('Unknown or inactive membership plan.')
    err.statusCode = 400
    throw err
  }

  const paid = opts.pricePaid != null && opts.pricePaid !== ''
    ? parseFloat(opts.pricePaid)
    : Number(plan.price)
  if (Number.isNaN(paid) || paid < 0) {
    const err = new Error('Invalid price_paid.')
    err.statusCode = 400
    throw err
  }

  const validityType = String(plan.validity_type || 'DAYS').toUpperCase()
  let days = opts.validityDays != null && opts.validityDays !== ''
    ? parseInt(String(opts.validityDays), 10)
    : Number(plan.validity_days)
  if (Number.isNaN(days) || days < 1) days = Number(plan.validity_days) || 365

  const posOrderId = opts.posOrderId ? parseInt(String(opts.posOrderId), 10) : null
  const validPosOrderId = posOrderId && Number.isFinite(posOrderId) && posOrderId > 0 ? posOrderId : null
  const uid = opts.createdByUserId != null ? Number(opts.createdByUserId) : null
  const hasPosOrderLink = await membershipHasPosOrderIdColumn(db)

  const runInOwnTx = opts.useTransaction === true
  let tx = null
  let executor = db
  if (runInOwnTx && typeof db.transaction === 'function') {
    tx = db.transaction()
    await tx.begin()
    executor = tx
  }

  try {
    await executor.request().input('cid', sql.Int, customerId).query(`
      UPDATE dbo.customer_memberships
      SET    is_active = 0
      WHERE  customer_id = @cid AND is_active = 1
    `)

    const ins = executor.request()
      .input('cid', sql.Int, customerId)
      .input('pk', sql.NVarChar(50), planKey)
      .input('paid', sql.Decimal(12, 2), paid)
      .input('uid', sql.Int, uid)
    if (hasPosOrderLink) {
      ins.input('pos_order_id', sql.Int, validPosOrderId)
    }
    const posOrderCols = hasPosOrderLink ? ', pos_order_id' : ''
    const posOrderVals = hasPosOrderLink ? ', @pos_order_id' : ''

    let membershipId
    if (opts.expiresAt) {
      const expStr = String(opts.expiresAt).trim()
      ins.input('exp', sql.DateTime2, new Date(expStr.includes('T') ? expStr : expStr + 'T23:59:59+05:30'))
      const r = await ins.query(`
        INSERT INTO dbo.customer_memberships
          (customer_id, plan_key, purchased_at, expires_at, price_paid, is_active, created_by_user_id${posOrderCols})
        OUTPUT INSERTED.membership_id
        VALUES (
          @cid, @pk,
          DATEADD(MINUTE, 330, SYSUTCDATETIME()),
          @exp,
          @paid, 1, @uid${posOrderVals}
        )
      `)
      membershipId = r.recordset[0].membership_id
    } else if (validityType === 'LIFETIME') {
      const r = await ins.query(`
        INSERT INTO dbo.customer_memberships
          (customer_id, plan_key, purchased_at, expires_at, price_paid, is_active, created_by_user_id${posOrderCols})
        OUTPUT INSERTED.membership_id
        VALUES (
          @cid, @pk,
          DATEADD(MINUTE, 330, SYSUTCDATETIME()),
          '2099-12-31T23:59:59',
          @paid, 1, @uid${posOrderVals}
        )
      `)
      membershipId = r.recordset[0].membership_id
    } else {
      const r = await ins.input('days', sql.Int, days).query(`
        INSERT INTO dbo.customer_memberships
          (customer_id, plan_key, purchased_at, expires_at, price_paid, is_active, created_by_user_id${posOrderCols})
        OUTPUT INSERTED.membership_id
        VALUES (
          @cid, @pk,
          DATEADD(MINUTE, 330, SYSUTCDATETIME()),
          DATEADD(DAY, @days, DATEADD(MINUTE, 330, SYSUTCDATETIME())),
          @paid, 1, @uid${posOrderVals}
        )
      `)
      membershipId = r.recordset[0].membership_id
    }

    if (tx) await tx.commit()
    return { membership_id: membershipId }
  } catch (e) {
    if (tx) await tx.rollback()
    throw e
  }
}

/**
 * Resolve membership_sale payload against catalogue price.
 * @param {import('mssql').ConnectionPool} pool
 * @param {{ plan_key: string, price_paid?: number }} sale
 */
async function resolveMembershipSaleAmount(pool, sale) {
  if (!sale || !sale.plan_key) return null
  const plan = await loadActiveMembershipPlan(pool, sale.plan_key)
  if (!plan) {
    const err = new Error('Unknown or inactive membership plan.')
    err.statusCode = 400
    throw err
  }
  const paid = sale.price_paid != null && sale.price_paid !== ''
    ? parseFloat(sale.price_paid)
    : Number(plan.price)
  if (Number.isNaN(paid) || paid < 0) {
    const err = new Error('Invalid membership price.')
    err.statusCode = 400
    throw err
  }
  return {
    plan_key: plan.plan_key,
    display_name: plan.display_name,
    price_paid: roundMoney(paid),
    validity_type: plan.validity_type,
    validity_days: plan.validity_days,
    has_plus_access: plan.has_plus_access,
    extra_cashback_pct: plan.extra_cashback_pct,
    flat_discount_pct: plan.flat_discount_pct,
    has_one_time_discount: plan.has_one_time_discount,
    can_create_sub_cards: plan.can_create_sub_cards
  }
}

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

module.exports = {
  loadActiveMembershipPlan,
  grantCustomerMembership,
  resolveMembershipSaleAmount,
  membershipHasPosOrderIdColumn
}
