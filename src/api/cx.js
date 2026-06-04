const express = require('express')
const sql = require('mssql')
const { getPool } = require('../config/db')
const { authJwt } = require('../middleware/authJwt')
const {
  requireModule,
  requireCxPermission,
  requireAnyModule,
  requirePermission
} = require('../middleware/authorize')
const orderService = require('../services/orderService')
const { grantCustomerMembership } = require('../services/membershipGrantService')
const {
  getMembershipFamilyForCustomer,
  addDependent: addMembershipDependent,
  removeDependent: removeMembershipDependent,
  listDependents,
  getOwnActiveMembership
} = require('../services/membershipDependentService')
const { isValidMembershipDependentRelationship } = require('../config/membershipDependentRelationshipsCatalog')
const { sqlNow, wallClockIso } = require('../lib/cosmosIst')
const cxService = require('../services/cxService')

const router = express.Router()

function parseCustomerId (req) {
  return parseInt(req.params.id, 10)
}

/** GET /api/cx/dashboard — summary + revenue_by_store */
router.get('/dashboard', authJwt, requireModule('cx'), requireCxPermission('cx.dashboard.view'), async (req, res, next) => {
  try {
    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const [summary, revenue_by_store] = await Promise.all([
      orderService.fetchCxSummary(pool, mode),
      orderService.fetchCxRevenueByStore(pool, mode, { limit: 40 })
    ])
    return res.json({
      success: true,
      data: {
        ...summary,
        revenue_by_store
      }
    })
  } catch (err) {
    return next(err)
  }
})

/** GET /api/cx/customers?q=&limit= */
router.get('/customers', authJwt, requireModule('cx'), requireCxPermission('cx.customers.view'), async (req, res, next) => {
  try {
    const search = String(req.query.q || '').trim() || null
    const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '150'), 10) || 150))
    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const rows = await orderService.fetchCxCustomerRollup(pool, mode, { search, limit })
    return res.json({ success: true, data: rows })
  } catch (err) {
    return next(err)
  }
})

/** GET /api/cx/orders?q=&status=&limit=&exclude_completed=1 — orders across stores */
router.get('/orders', authJwt, requireModule('cx'), requireCxPermission('cx.orders.view'), async (req, res, next) => {
  try {
    const search = String(req.query.q || '').trim() || null
    const statusFilter = String(req.query.status || '').trim() || null
    const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '80'), 10) || 80))
    const ec = ['1', 'true', 'yes'].includes(String(req.query.exclude_completed || '').trim().toLowerCase())
    const excludeOrderStatuses = ec && !statusFilter ? ['COMPLETED'] : []
    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const orders = await orderService.fetchAllOrders(pool, mode, { search, statusFilter, limit, excludeOrderStatuses })
    return res.json({ success: true, data: orders })
  } catch (err) {
    return next(err)
  }
})

/* ══════════════════════════════════════════════════════════════
   STAFF: Eyewoot Go — membership plans + grant membership
══════════════════════════════════════════════════════════════ */

function derivePlanKeyFromTier (row) {
  const loyalty = String(row.loyalty_tier || '').trim()
  if (loyalty) {
    return loyalty.toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 50)
  }
  const slug = String(row.tier_name || 'PLAN')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return (slug || 'PLAN').slice(0, 50)
}

async function membershipPlansHasTierIdColumn (pool) {
  const r = await pool.request().query(`
    SELECT COL_LENGTH('dbo.membership_plans', 'tier_id') AS col_len
  `)
  const len = r.recordset && r.recordset[0] && r.recordset[0].col_len
  return len != null && Number(len) > 0
}

async function membershipHasPosOrderIdColumn (pool) {
  const r = await pool.request().query(`
    SELECT COL_LENGTH('dbo.customer_memberships', 'pos_order_id') AS col_len
  `)
  const len = r.recordset && r.recordset[0] && r.recordset[0].col_len
  return len != null && Number(len) > 0
}

/** Active membership row for CX detail — schema-aware (tier link, pos_order_id, orders engine). */
async function fetchActiveMembershipForCx (pool, customerId, mode) {
  const linkTiers = await membershipPlansHasTierIdColumn(pool)
  const hasPosOrderLink = await membershipHasPosOrderIdColumn(pool)
  const ordersTable = mode === 'shared' ? 'dbo.oe_orders' : 'dbo.pos_orders'
  const posOrderSelect = hasPosOrderLink ? 'm.pos_order_id,' : 'CAST(NULL AS INT) AS pos_order_id,'
  const orderJoin = hasPosOrderLink
    ? `LEFT JOIN ${ordersTable} o ON o.order_id = m.pos_order_id`
    : ''
  const orderNoSelect = hasPosOrderLink ? 'o.order_no AS linked_order_no' : 'CAST(NULL AS NVARCHAR(50)) AS linked_order_no'
  const tierSelect = linkTiers
    ? `p.tier_id,
            t.tier_name,
            t.loyalty_tier AS membership_type,
            t.benefits AS tier_benefits`
    : `NULL AS tier_id,
            p.display_name AS tier_name,
            NULL AS membership_type,
            NULL AS tier_benefits`
  const tierJoin = linkTiers ? 'LEFT JOIN dbo.membership_tiers t ON t.membership_id = p.tier_id' : ''

  const memR = await pool.request().input('cid', customerId).query(`
    SELECT TOP 1
      m.membership_id,
      m.plan_key,
      m.purchased_at,
      m.expires_at,
      m.price_paid,
      m.is_active,
      ${posOrderSelect}
      p.display_name AS plan_display_name,
      ${tierSelect},
      ${orderNoSelect}
    FROM   dbo.customer_memberships m
    JOIN   dbo.membership_plans p ON p.plan_key = m.plan_key
    ${tierJoin}
    ${orderJoin}
    WHERE  m.customer_id = @cid AND m.is_active = 1
      AND  m.expires_at > DATEADD(MINUTE, 330, SYSUTCDATETIME())
    ORDER BY m.expires_at DESC
  `)
  return memR.recordset[0] || null
}

/** Mirror Command Unit membership_tiers into membership_plans so CX grant can use CU-configured tiers. */
async function ensureMembershipPlansFromTiers (pool) {
  let tiers = []
  try {
    const tiersR = await pool.request().query(`
      SELECT membership_id, tier_name, annual_fee, loyalty_tier
      FROM   dbo.membership_tiers
      WHERE  is_active = 1
    `)
    tiers = tiersR.recordset || []
  } catch (err) {
    if (String(err.message || '').includes('Invalid object name')) return
    throw err
  }
  if (!tiers.length) return

  const linkTiers = await membershipPlansHasTierIdColumn(pool)
  const nowSql = sqlNow()
  for (const t of tiers) {
    const planKey = derivePlanKeyFromTier(t)
    const displayName = String(t.tier_name || planKey).trim().slice(0, 100)
    const price = Number(t.annual_fee)
    const safePrice = Number.isFinite(price) && price >= 0 ? price : 0
    const req = pool
      .request()
      .input('pk', sql.NVarChar(50), planKey)
      .input('dn', sql.NVarChar(100), displayName)
      .input('pr', sql.Decimal(10, 2), safePrice)
    if (linkTiers) {
      await req.input('tid', sql.Int, t.membership_id).query(`
        MERGE dbo.membership_plans AS tgt
        USING (SELECT @pk AS plan_key) AS src
        ON tgt.plan_key = src.plan_key
        WHEN MATCHED THEN
          UPDATE SET
            display_name = @dn,
            price = @pr,
            is_active = 1,
            tier_id = @tid
        WHEN NOT MATCHED BY TARGET THEN
          INSERT (plan_key, display_name, price, validity_days, max_dependents, is_active, created_at, tier_id)
          VALUES (@pk, @dn, @pr, 365, 5, 1, ${nowSql}, @tid);
      `)
    } else {
      await req.query(`
        MERGE dbo.membership_plans AS tgt
        USING (SELECT @pk AS plan_key) AS src
        ON tgt.plan_key = src.plan_key
        WHEN MATCHED THEN
          UPDATE SET display_name = @dn, price = @pr, is_active = 1
        WHEN NOT MATCHED BY TARGET THEN
          INSERT (plan_key, display_name, price, validity_days, max_dependents, is_active, created_at)
          VALUES (@pk, @dn, @pr, 365, 5, 1, ${nowSql});
      `)
    }
  }
}

async function fetchActiveMembershipPlans (pool) {
  const linkTiers = await membershipPlansHasTierIdColumn(pool)
  const r = linkTiers
    ? await pool.request().query(`
        SELECT
          p.plan_id,
          p.plan_key,
          p.display_name,
          p.price,
          p.validity_days,
          p.max_dependents,
          p.is_active,
          p.tier_id,
          t.tier_name,
          t.loyalty_tier AS membership_type,
          t.annual_fee AS tier_annual_fee
        FROM   dbo.membership_plans p
        LEFT JOIN dbo.membership_tiers t ON t.membership_id = p.tier_id
        WHERE  p.is_active = 1
        ORDER BY ISNULL(t.tier_name, p.display_name) ASC, p.plan_key ASC
      `)
    : await pool.request().query(`
        SELECT
          p.plan_id,
          p.plan_key,
          p.display_name,
          p.price,
          p.validity_days,
          p.max_dependents,
          p.is_active,
          NULL AS tier_id,
          p.display_name AS tier_name,
          NULL AS membership_type,
          NULL AS tier_annual_fee
        FROM   dbo.membership_plans p
        WHERE  p.is_active = 1
        ORDER BY p.display_name ASC, p.plan_key ASC
      `)
  return r.recordset || []
}

async function handleCxMembershipPlans (_req, res, next) {
  try {
    const pool = await getPool()
    let plans = []
    try {
      await ensureMembershipPlansFromTiers(pool)
      plans = await fetchActiveMembershipPlans(pool)
    } catch (err) {
      const msg = String(err.message || '')
      if (msg.includes('Invalid object name') && msg.includes('membership_plans')) {
        return res.status(503).json({
          success: false,
          message:
            'Membership tables are not deployed. Run Eyewoot Go SQL migrations (31_membership_plans, 32_customer_memberships) on this database.'
        })
      }
      throw err
    }
    return res.json({ success: true, data: plans })
  } catch (err) {
    return next(err)
  }
}

const cxPlansMiddleware = [
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.membership.manage', 'cx.customers.view')
]

/** GET /api/cx/plans — Eyewoot Go plan catalogue (syncs from membership_tiers when empty) */
router.get('/plans', ...cxPlansMiddleware, handleCxMembershipPlans)

/** GET /api/cx/membership-plans — alias */
router.get('/membership-plans', ...cxPlansMiddleware, handleCxMembershipPlans)

/** GET /api/cx/customers/:id/summary — live order count + lifetime for detail modal */
router.get(
  '/customers/:id/summary',
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.customers.view'),
  async (req, res, next) => {
    try {
      const customerId = parseInt(req.params.id, 10)
      if (!customerId) {
        return res.status(400).json({ success: false, message: 'Invalid customer ID.' })
      }
      const pool = await getPool()
      const mode = await orderService.getOrdersEngineMode(pool)
      const rows = await orderService.fetchCxCustomerRollup(pool, mode, {
        customerId,
        limit: 1
      })
      const row = rows[0]
      if (!row) {
        return res.status(404).json({ success: false, message: 'Customer not found.' })
      }
      return res.json({ success: true, data: row })
    } catch (err) {
      return next(err)
    }
  }
)

/** GET /api/cx/customers/:id/membership — current active Eyewoot Go membership (if any) */
router.get(
  '/customers/:id/membership',
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.customers.view', 'cx.membership.manage'),
  async (req, res, next) => {
  try {
    const pool = await getPool()
    const customerId = parseInt(req.params.id, 10)
    if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })

    const custR = await pool.request().input('cid', customerId).query(`
      SELECT customer_id, full_name, phone, is_active
      FROM   dbo.pos_customers WHERE customer_id = @cid
    `)
    const cust = custR.recordset[0]
    if (!cust) return res.status(404).json({ success: false, message: 'Customer not found.' })

    const mode = await orderService.getOrdersEngineMode(pool)
    const active = await fetchActiveMembershipForCx(pool, customerId, mode)
    if (active) {
      active.membership_tier_label = active.tier_name || active.plan_display_name || active.plan_key
      active.membership_type_label = active.membership_type || null
    }

    const family = await getMembershipFamilyForCustomer(pool, customerId)
    let dependents = family.dependents || []
    let slots_remaining = family.slots_remaining
    let max_dependents = family.max_dependents
    if (active && family.role === 'primary') {
      dependents = await listDependents(pool, active.membership_id)
      max_dependents = (await getOwnActiveMembership(pool, customerId))?.max_dependents ?? max_dependents
      slots_remaining = Math.max(0, max_dependents - dependents.length)
    }

    return res.json({
      success: true,
      data: {
        customer: { customer_id: cust.customer_id, full_name: cust.full_name, phone: cust.phone, is_active: !!cust.is_active },
        active_membership: active,
        dependents,
        slots_remaining,
        max_dependents,
        membership_role: family.role,
        inherited_from: family.inherited_from
      }
    })
  } catch (err) {
    return next(err)
  }
})

/** POST /api/cx/customers/:id/membership/dependents */
router.post(
  '/customers/:id/membership/dependents',
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.membership.manage'),
  async (req, res, next) => {
    try {
      const customerId = parseInt(req.params.id, 10)
      if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })

      const { phone, relationship, full_name: fullName } = req.body || {}
      if (!phone || !relationship) {
        return res.status(400).json({ success: false, message: 'Phone and relationship are required.' })
      }
      if (!isValidMembershipDependentRelationship(relationship)) {
        return res.status(400).json({ success: false, message: 'Invalid relationship.' })
      }

      const pool = await getPool()
      const data = await addMembershipDependent(pool, {
        primaryCustomerId: customerId,
        phone,
        relationship,
        fullName,
        createdByUserId: req.user?.user_id || null
      })
      return res.status(201).json({ success: true, data })
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message })
      }
      return next(err)
    }
  }
)

/** DELETE /api/cx/customers/:id/membership/dependents/:dependentId */
router.delete(
  '/customers/:id/membership/dependents/:dependentId',
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.membership.manage'),
  async (req, res, next) => {
    try {
      const customerId = parseInt(req.params.id, 10)
      const dependentId = parseInt(req.params.dependentId, 10)
      if (!customerId || !dependentId) {
        return res.status(400).json({ success: false, message: 'Invalid customer or dependent ID.' })
      }
      const pool = await getPool()
      const data = await removeMembershipDependent(pool, {
        primaryCustomerId: customerId,
        dependentId
      })
      return res.json({ success: true, data })
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message })
      }
      return next(err)
    }
  }
)

/**
 * POST /api/cx/customers/:id/membership — grant / renew Eyewoot Go membership
 * Body: { plan_key, price_paid?, validity_days?, expires_at? (YYYY-MM-DD or ISO), pos_order_id? }
 * Deactivates other active rows for this customer, then inserts a new membership.
 * pos_order_id links the grant to the POS order where the customer paid for the membership.
 */
router.post('/customers/:id/membership', authJwt, requireModule('cx'), requireCxPermission('cx.membership.manage'), async (req, res, next) => {
  try {
    const pool = await getPool()
    const customerId = parseInt(req.params.id, 10)
    if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })

    const { plan_key, price_paid, validity_days, expires_at, pos_order_id } = req.body || {}

    const custR = await pool.request().input('cid', customerId).query(`
      SELECT customer_id FROM dbo.pos_customers WHERE customer_id = @cid AND is_active = 1
    `)
    if (!custR.recordset.length) {
      return res.status(404).json({ success: false, message: 'Customer not found or inactive.' })
    }

    const out = await grantCustomerMembership(pool, {
      customerId,
      planKey: plan_key,
      pricePaid: price_paid,
      validityDays: validity_days,
      expiresAt: expires_at,
      posOrderId: pos_order_id,
      createdByUserId: req.user.user_id || null,
      useTransaction: true
    })
    return res.status(201).json({ success: true, membership_id: out.membership_id })
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 404) {
      return res.status(err.statusCode).json({ success: false, message: err.message })
    }
    return next(err)
  }
})

/* ══════════════════════════════════════════════════════════════
   STAFF: Eye Tests — enter prescription for a customer
══════════════════════════════════════════════════════════════ */

function mapEyeTestInsertPayload (body, defaults) {
  const b = body || {}
  return {
    customerId: defaults.customerId,
    visitorId: defaults.visitorId ?? null,
    familyNameId: b.family_name_id != null ? parseInt(String(b.family_name_id), 10) : null,
    patientName: b.patient_name != null ? String(b.patient_name).trim() || null : defaults.patientName ?? null,
    testedAt: b.tested_at || defaults.testedAt || wallClockIso(),
    storeId: b.store_id != null ? parseInt(String(b.store_id), 10) : defaults.storeId ?? null,
    actorUserId: defaults.actorUserId ?? null,
    reSph: b.re_sph ?? null,
    reCyl: b.re_cyl ?? null,
    reAxis: b.re_axis ?? null,
    reAdd: b.re_add ?? null,
    reVa: b.re_va ?? null,
    leSph: b.le_sph ?? null,
    leCyl: b.le_cyl ?? null,
    leAxis: b.le_axis ?? null,
    leAdd: b.le_add ?? null,
    leVa: b.le_va ?? null,
    pd: b.pd ?? null,
    lensType: b.lens_type ?? null,
    notes: b.notes ?? null
  }
}

function mapEyeTestForPos (row) {
  if (!row) return null
  const primaryName = row.patient_name || null
  const familyName = row.family_name || null
  return {
    test_id: row.test_id,
    tested_at: row.tested_at,
    patient_name: primaryName || familyName || null,
    family_name: familyName,
    family_name_id: row.family_name_id,
    re_sph: row.re_sph,
    re_cyl: row.re_cyl,
    re_axis: row.re_axis,
    re_add: row.re_add,
    le_sph: row.le_sph,
    le_cyl: row.le_cyl,
    le_axis: row.le_axis,
    le_add: row.le_add,
    pd: row.pd,
    lens_type: row.lens_type
  }
}

/** POST /api/cx/customers/:id/eye-tests — staff enters prescription */
router.post('/customers/:id/eye-tests', authJwt, requireModule('cx'), requireCxPermission('cx.eye_tests.create'), async (req, res, next) => {
  try {
    const pool = await getPool()
    const customerId = parseInt(req.params.id, 10)
    if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })

    const payload = mapEyeTestInsertPayload(req.body, {
      customerId,
      visitorId: req.body && req.body.visitor_id != null ? parseInt(String(req.body.visitor_id), 10) : null,
      storeId: req.user && req.user.store_id != null ? Number(req.user.store_id) : null,
      actorUserId: req.user && req.user.user_id != null ? Number(req.user.user_id) : null
    })
    const row = await cxService.insertStaffEyeTest(pool, payload)
    const lif = req.body && req.body.lifestyle
    if (customerId && lif && typeof lif === 'object') {
      try {
        await cxService.upsertRxModalLifestyle(
          pool,
          customerId,
          lif,
          req.user && req.user.user_id != null ? Number(req.user.user_id) : null
        )
      } catch (_) {
        /* Rx saved; lifestyle best-effort */
      }
    }
    return res.status(201).json({ success: true, test_id: row && row.test_id })
  } catch (err) {
    const msg = String(err.message || '')
    if (msg.includes('required') || msg.includes('family_name')) {
      return res.status(400).json({ success: false, message: msg })
    }
    return next(err)
  }
})

/* ══════════════════════════════════════════════════════════════
   STAFF: Customer Offers (view-only in CX; writes via Command Unit)
══════════════════════════════════════════════════════════════ */

const CX_OFFERS_READONLY_MESSAGE =
  'Customer offers are managed in Command Unit → Promotion → Configure Offer. CX offers are view-only.'

function cxOffersMutateBlocked (res) {
  return res.status(403).json({ success: false, message: CX_OFFERS_READONLY_MESSAGE })
}

/** GET /api/cx/offers */
router.get('/offers', authJwt, requireModule('cx'), requireCxPermission('cx.offers.view', 'cx.offers.manage'), async (req, res, next) => {
  try {
    const pool = await getPool()
    const r = await pool.request().query(`
      SELECT offer_id, title, description, icon_emoji, discount_type,
             discount_value, valid_from, valid_to,
             required_capability, cashback_rate,
             is_active, sort_order, created_at
      FROM   dbo.customer_offers
      ORDER BY is_active DESC, sort_order ASC, created_at DESC
    `)
    return res.json({ success: true, data: r.recordset })
  } catch (err) {
    return next(err)
  }
})

/** POST /api/cx/offers — view-only; use Command Unit Configure Offer */
router.post('/offers', authJwt, requireModule('cx'), requireCxPermission('cx.offers.manage'), (req, res) => {
  return cxOffersMutateBlocked(res)
})

/** PATCH /api/cx/offers/:id — view-only */
router.patch('/offers/:id', authJwt, requireModule('cx'), requireCxPermission('cx.offers.manage'), (req, res) => {
  return cxOffersMutateBlocked(res)
})

/** DELETE /api/cx/offers/:id — view-only */
router.delete('/offers/:id', authJwt, requireModule('cx'), requireCxPermission('cx.offers.manage'), (req, res) => {
  return cxOffersMutateBlocked(res)
})

/* ══════════════════════════════════════════════════════════════
   Customer 360 — read (new domains via cxService SPs)
══════════════════════════════════════════════════════════════ */

/** GET /api/cx/customers/:id/360 — header + coin summary */
router.get(
  '/customers/:id/360',
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.customers.view'),
  async (req, res, next) => {
    try {
      const customerId = parseCustomerId(req)
      if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })
      const pool = await getPool()
      const header = await cxService.getCustomer360Header(pool, customerId)
      if (!header) return res.status(404).json({ success: false, message: 'Customer not found.' })
      const mode = await orderService.getOrdersEngineMode(pool)
      const rollup = await orderService.fetchCxCustomerRollup(pool, mode, { customerId, limit: 1 })
      const stats = rollup[0] || {}
      return res.json({
        success: true,
        data: {
          ...header,
          order_count: stats.order_count != null ? stats.order_count : 0,
          lifetime_revenue: stats.lifetime_revenue != null ? stats.lifetime_revenue : 0
        }
      })
    } catch (err) {
      return next(err)
    }
  }
)

router.get(
  '/customers/:id/profile',
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.customers.view'),
  async (req, res, next) => {
    try {
      const customerId = parseCustomerId(req)
      if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })
      const pool = await getPool()
      const row = await cxService.getCustomerProfile(pool, customerId)
      if (!row) return res.status(404).json({ success: false, message: 'Customer not found.' })
      return res.json({ success: true, data: row })
    } catch (err) {
      return next(err)
    }
  }
)

router.get(
  '/customers/:id/lifestyle',
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.customers.view'),
  async (req, res, next) => {
    try {
      const customerId = parseCustomerId(req)
      if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })
      const pool = await getPool()
      const row = await cxService.getCustomerLifestyle(pool, customerId)
      return res.json({ success: true, data: row || null })
    } catch (err) {
      return next(err)
    }
  }
)

router.get(
  '/customers/:id/coins',
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.customers.view'),
  async (req, res, next) => {
    try {
      const customerId = parseCustomerId(req)
      if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })
      const pool = await getPool()
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50))
      const ledger = await cxService.getCustomerLoyaltyLedger(pool, customerId, limit)
      const live = await cxService.getLiveCoinBalance(pool, customerId)
      return res.json({ success: true, data: { live_balance: live, ledger } })
    } catch (err) {
      return next(err)
    }
  }
)

router.get(
  '/customers/:id/offers-assignments',
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.customers.view', 'cx.offers.view'),
  async (req, res, next) => {
    try {
      const customerId = parseCustomerId(req)
      if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })
      const activeOnly = String(req.query.active_only || '1') !== '0'
      const pool = await getPool()
      const rows = await cxService.getCustomerOfferAssignments(pool, customerId, activeOnly)
      return res.json({ success: true, data: rows })
    } catch (err) {
      return next(err)
    }
  }
)

router.get(
  '/customers/:id/audit',
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.audit.view', 'cx.admin'),
  async (req, res, next) => {
    try {
      const customerId = parseCustomerId(req)
      if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })
      const pool = await getPool()
      const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100))
      const rows = await cxService.getCustomerAuditLog(pool, customerId, limit)
      return res.json({ success: true, data: rows })
    } catch (err) {
      return next(err)
    }
  }
)

router.get(
  '/customers/:id/visits',
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.customers.view'),
  async (req, res, next) => {
    try {
      const customerId = parseCustomerId(req)
      if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })
      const pool = await getPool()
      const hasTable = await pool.request().query(`
        SELECT CASE WHEN OBJECT_ID('dbo.store_visitors', 'U') IS NULL THEN 0 ELSE 1 END AS ok
      `)
      if (!Number((hasTable.recordset[0] || {}).ok)) {
        return res.json({ success: true, data: [] })
      }
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50))
      const rows = await cxService.getCustomerVisits(pool, customerId, limit)
      return res.json({ success: true, data: rows })
    } catch (err) {
      return next(err)
    }
  }
)

router.get(
  '/customers/:id/prescriptions',
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.customers.view'),
  async (req, res, next) => {
    try {
      const customerId = parseCustomerId(req)
      if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })
      const pool = await getPool()
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '30'), 10) || 30))
      const rows = await cxService.getCustomerEyeTests(pool, customerId, limit)
      return res.json({ success: true, data: rows })
    } catch (err) {
      return next(err)
    }
  }
)

/** GET /api/cx/customers/:id/prescriptions/for-pos — lightweight list for POS Saved Power */
router.get(
  '/customers/:id/prescriptions/for-pos',
  authJwt,
  requireAnyModule(['cx', 'pos']),
  requirePermission('cx.customers.view', 'pos.customers.view'),
  async (req, res, next) => {
    try {
      const customerId = parseCustomerId(req)
      if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })
      const pool = await getPool()
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '30'), 10) || 30))
      const rows = await cxService.getCustomerEyeTests(pool, customerId, limit)
      return res.json({
        success: true,
        data: rows.map(mapEyeTestForPos).filter(Boolean)
      })
    } catch (err) {
      return next(err)
    }
  }
)

/** GET /api/cx/customers/:id/family-names — for Add Rx patient picker */
router.get(
  '/customers/:id/family-names',
  authJwt,
  requireAnyModule(['cx', 'pos', 'storepilot']),
  requirePermission('cx.customers.view', 'pos.customers.view', 'gatepass.view'),
  async (req, res, next) => {
    try {
      const customerId = parseCustomerId(req)
      if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })
      const pool = await getPool()
      const rows = await cxService.listCustomerFamilyNameRows(pool, customerId)
      return res.json({ success: true, data: rows })
    } catch (err) {
      return next(err)
    }
  }
)

router.get(
  '/customers/:id/orders',
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.customers.view', 'cx.orders.view'),
  async (req, res, next) => {
    try {
      const customerId = parseCustomerId(req)
      if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })
      const pool = await getPool()
      const mode = await orderService.getOrdersEngineMode(pool)
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50))
      const orders = await orderService.fetchAllOrders(pool, mode, {
        search: null,
        statusFilter: String(req.query.status || '').trim() || null,
        limit: 500,
        excludeOrderStatuses: []
      })
      const filtered = orders.filter((o) => Number(o.customer_id) === customerId).slice(0, limit)
      return res.json({ success: true, data: filtered })
    } catch (err) {
      return next(err)
    }
  }
)

router.get(
  '/customers/:id/invoices',
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.customers.view', 'cx.orders.view'),
  async (req, res, next) => {
    try {
      const customerId = parseCustomerId(req)
      if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })
      const pool = await getPool()
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50))
      const r = await pool.request()
        .input('cid', sql.Int, customerId)
        .input('lim', sql.Int, limit)
        .query(`
          SELECT TOP (@lim)
            pi.invoice_id, pi.order_id, pi.invoice_no,
            pi.taxable_amount, pi.gst_amount, pi.total_amount, pi.created_at,
            o.order_no, o.store_id, s.store_name
          FROM dbo.pos_invoices pi
          INNER JOIN dbo.pos_orders o ON o.order_id = pi.order_id
          LEFT JOIN dbo.stores s ON s.store_id = o.store_id
          WHERE o.customer_id = @cid
          ORDER BY pi.created_at DESC, pi.invoice_id DESC
        `)
      return res.json({ success: true, data: r.recordset || [] })
    } catch (err) {
      return next(err)
    }
  }
)

/* ══════════════════════════════════════════════════════════════
   Customer 360 — writes (SP + audit)
══════════════════════════════════════════════════════════════ */

router.put(
  '/customers/:id/profile',
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.customers.edit', 'cx.admin'),
  async (req, res, next) => {
    try {
      const customerId = parseCustomerId(req)
      if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })
      const { full_name, email, dob } = req.body || {}
      const pool = await getPool()
      const row = await cxService.updateCustomerProfile(pool, {
        customerId,
        fullName: full_name,
        email,
        dob: dob || null,
        actorUserId: req.user?.user_id || null
      })
      return res.json({ success: true, data: row })
    } catch (err) {
      if (String(err.message || '').includes('not found')) {
        return res.status(404).json({ success: false, message: err.message })
      }
      return next(err)
    }
  }
)

router.put(
  '/customers/:id/lifestyle',
  authJwt,
  requireModule('cx'),
  requirePermission('cx.customers.edit', 'cx.admin', 'cx.eye_tests.create', 'gatepass.action'),
  async (req, res, next) => {
    try {
      const customerId = parseCustomerId(req)
      if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })
      const b = req.body || {}
      const pool = await getPool()
      const row = b.lifestyle && typeof b.lifestyle === 'object'
        ? await cxService.upsertRxModalLifestyle(pool, customerId, b.lifestyle, req.user?.user_id || null)
        : await cxService.upsertCustomerLifestyle(pool, {
          customerId,
          screenHrs: b.screen_hrs,
          framePref: b.frame_pref,
          budgetMin: b.budget_min,
          budgetMax: b.budget_max,
          notes: b.notes,
          actorUserId: req.user?.user_id || null
        })
      return res.json({ success: true, data: row })
    } catch (err) {
      return next(err)
    }
  }
)

router.post(
  '/customers/:id/offers-assignments',
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.offers.manage', 'cx.admin'),
  async (req, res, next) => {
    try {
      const customerId = parseCustomerId(req)
      const offerId = parseInt(String((req.body || {}).offer_id), 10)
      if (!customerId || !offerId) {
        return res.status(400).json({ success: false, message: 'customer id and offer_id required.' })
      }
      const pool = await getPool()
      const row = await cxService.assignCustomerOffer(pool, {
        customerId,
        offerId,
        notes: (req.body || {}).notes,
        actorUserId: req.user?.user_id || null
      })
      return res.status(201).json({ success: true, data: row })
    } catch (err) {
      const msg = String(err.message || '')
      if (msg.includes('already assigned') || msg.includes('inactive')) {
        return res.status(400).json({ success: false, message: msg })
      }
      return next(err)
    }
  }
)

router.delete(
  '/customers/:id/offers-assignments/:assignmentId',
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.offers.manage', 'cx.admin'),
  async (req, res, next) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId, 10)
      if (!assignmentId) return res.status(400).json({ success: false, message: 'Invalid assignment ID.' })
      const pool = await getPool()
      const row = await cxService.revokeCustomerOffer(pool, assignmentId, req.user?.user_id || null)
      return res.json({ success: true, data: row })
    } catch (err) {
      if (String(err.message || '').includes('not found')) {
        return res.status(404).json({ success: false, message: err.message })
      }
      return next(err)
    }
  }
)

router.post(
  '/customers/:id/coins/manual',
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.coins.manual', 'cx.admin'),
  async (req, res, next) => {
    try {
      const customerId = parseCustomerId(req)
      const coinsDelta = parseInt(String((req.body || {}).coins_delta), 10)
      const reason = String((req.body || {}).reason || '').trim()
      if (!customerId || !Number.isFinite(coinsDelta) || coinsDelta === 0) {
        return res.status(400).json({ success: false, message: 'Valid customer id and non-zero coins_delta required.' })
      }
      if (!reason) return res.status(400).json({ success: false, message: 'reason is required.' })
      const pool = await getPool()
      const row = await cxService.manualLoyaltyAdjustment(pool, {
        customerId,
        coinsDelta,
        reason,
        actorUserId: req.user?.user_id || null
      })
      return res.status(201).json({ success: true, data: row })
    } catch (err) {
      const msg = String(err.message || '')
      if (msg.includes('negative') || msg.includes('non-zero')) {
        return res.status(400).json({ success: false, message: msg })
      }
      return next(err)
    }
  }
)

/** GET /api/cx/settings/loyalty — CX staff read loyalty settings */
router.get(
  '/settings/loyalty',
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.customers.view', 'cx.admin'),
  async (req, res, next) => {
    try {
      const pool = await getPool()
      const row = await cxService.getLoyaltySettings(pool)
      return res.json({ success: true, data: row })
    } catch (err) {
      return next(err)
    }
  }
)

module.exports = router
