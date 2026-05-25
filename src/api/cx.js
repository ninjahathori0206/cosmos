const express = require('express')
const sql = require('mssql')
const Joi = require('joi')
const { getPool } = require('../config/db')
const { authJwt } = require('../middleware/authJwt')
const { requireModule, requireCxPermission } = require('../middleware/authorize')
const orderService = require('../services/orderService')
const { OFFER_DISCOUNT_TYPES } = require('../config/customerOfferDiscountTypes')

const router = express.Router()

const cxOfferCreateSchema = Joi.object({
  title: Joi.string().max(200).required(),
  description: Joi.string().max(500).allow('', null),
  icon_emoji: Joi.string().max(10).allow('', null),
  discount_type: Joi.string().valid(...OFFER_DISCOUNT_TYPES).default('PCT'),
  discount_value: Joi.number().min(0).default(0),
  valid_from: Joi.any().optional(),
  valid_to: Joi.any().required(),
  eligible_tier: Joi.string().max(50).allow(null, ''),
  is_plus_only: Joi.boolean().default(false),
  sort_order: Joi.number().integer().min(0).default(0)
})

const cxOfferPatchSchema = Joi.object({
  title: Joi.string().max(200),
  description: Joi.string().max(500).allow('', null),
  icon_emoji: Joi.string().max(10).allow('', null),
  discount_type: Joi.string().valid(...OFFER_DISCOUNT_TYPES),
  discount_value: Joi.number().min(0),
  valid_from: Joi.any(),
  valid_to: Joi.any(),
  eligible_tier: Joi.string().max(50).allow(null, ''),
  is_plus_only: Joi.boolean(),
  is_active: Joi.boolean(),
  sort_order: Joi.number().integer().min(0)
}).min(1)

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
  const nowSql = 'DATEADD(MINUTE, 330, SYSUTCDATETIME())'
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

    const linkTiers = await membershipPlansHasTierIdColumn(pool)
    const memR = linkTiers
      ? await pool.request().input('cid', customerId).query(`
          SELECT TOP 1
            m.membership_id,
            m.plan_key,
            m.purchased_at,
            m.expires_at,
            m.price_paid,
            m.is_active,
            p.display_name AS plan_display_name,
            p.tier_id,
            t.tier_name,
            t.loyalty_tier AS membership_type,
            t.benefits AS tier_benefits
          FROM   dbo.customer_memberships m
          JOIN   dbo.membership_plans p ON p.plan_key = m.plan_key
          LEFT JOIN dbo.membership_tiers t ON t.membership_id = p.tier_id
          WHERE  m.customer_id = @cid AND m.is_active = 1
            AND  m.expires_at > DATEADD(MINUTE, 330, SYSUTCDATETIME())
          ORDER BY m.expires_at DESC
        `)
      : await pool.request().input('cid', customerId).query(`
          SELECT TOP 1
            m.membership_id,
            m.plan_key,
            m.purchased_at,
            m.expires_at,
            m.price_paid,
            m.is_active,
            p.display_name AS plan_display_name,
            NULL AS tier_id,
            p.display_name AS tier_name,
            NULL AS membership_type,
            NULL AS tier_benefits
          FROM   dbo.customer_memberships m
          JOIN   dbo.membership_plans p ON p.plan_key = m.plan_key
          WHERE  m.customer_id = @cid AND m.is_active = 1
            AND  m.expires_at > DATEADD(MINUTE, 330, SYSUTCDATETIME())
          ORDER BY m.expires_at DESC
        `)

    const active = memR.recordset[0] || null
    if (active) {
      active.membership_tier_label = active.tier_name || active.plan_display_name || active.plan_key
      active.membership_type_label = active.membership_type || null
    }

    return res.json({
      success: true,
      data: {
        customer: { customer_id: cust.customer_id, full_name: cust.full_name, phone: cust.phone, is_active: !!cust.is_active },
        active_membership: active
      }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * POST /api/cx/customers/:id/membership — grant / renew Eyewoot Go membership
 * Body: { plan_key, price_paid?, validity_days?, expires_at? (YYYY-MM-DD or ISO) }
 * Deactivates other active rows for this customer, then inserts a new membership.
 */
router.post('/customers/:id/membership', authJwt, requireModule('cx'), requireCxPermission('cx.membership.manage'), async (req, res, next) => {
  try {
    const pool = await getPool()
    const customerId = parseInt(req.params.id, 10)
    if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })

    const { plan_key, price_paid, validity_days, expires_at } = req.body || {}
    const pk = String(plan_key || '').trim()
    if (!pk) return res.status(400).json({ success: false, message: 'plan_key is required.' })

    const custR = await pool.request().input('cid', customerId).query(`
      SELECT customer_id FROM dbo.pos_customers WHERE customer_id = @cid AND is_active = 1
    `)
    if (!custR.recordset.length) {
      return res.status(404).json({ success: false, message: 'Customer not found or inactive.' })
    }

    const planR = await pool.request().input('pk', pk).query(`
      SELECT plan_key, display_name, price, validity_days, is_active
      FROM   dbo.membership_plans WHERE plan_key = @pk AND is_active = 1
    `)
    const plan = planR.recordset[0]
    if (!plan) return res.status(400).json({ success: false, message: 'Unknown or inactive membership plan.' })

    const uid = req.user.user_id || null
    const paid = price_paid != null && price_paid !== '' ? parseFloat(price_paid) : Number(plan.price)
    if (Number.isNaN(paid) || paid < 0) {
      return res.status(400).json({ success: false, message: 'Invalid price_paid.' })
    }

    let days = validity_days != null && validity_days !== '' ? parseInt(String(validity_days), 10) : Number(plan.validity_days)
    if (Number.isNaN(days) || days < 1) days = Number(plan.validity_days) || 365

    const tx = pool.transaction()
    await tx.begin()
    try {
      await tx.request().input('cid', customerId).query(`
        UPDATE dbo.customer_memberships
        SET    is_active = 0
        WHERE  customer_id = @cid AND is_active = 1
      `)

      const ins = tx.request()
        .input('cid', customerId)
        .input('pk', pk)
        .input('paid', paid)
        .input('uid', uid)

      if (expires_at) {
        const expStr = String(expires_at).trim()
        ins.input('exp', sql.DateTime2, new Date(expStr.includes('T') ? expStr : expStr + 'T23:59:59+05:30'))
        const r = await ins.query(`
          INSERT INTO dbo.customer_memberships
            (customer_id, plan_key, purchased_at, expires_at, price_paid, is_active, created_by_user_id)
          OUTPUT INSERTED.membership_id
          VALUES (
            @cid, @pk,
            DATEADD(MINUTE, 330, SYSUTCDATETIME()),
            @exp,
            @paid, 1, @uid
          )
        `)
        await tx.commit()
        return res.status(201).json({ success: true, membership_id: r.recordset[0].membership_id })
      }

      const r2 = await ins.input('days', sql.Int, days).query(`
        INSERT INTO dbo.customer_memberships
          (customer_id, plan_key, purchased_at, expires_at, price_paid, is_active, created_by_user_id)
        OUTPUT INSERTED.membership_id
        VALUES (
          @cid, @pk,
          DATEADD(MINUTE, 330, SYSUTCDATETIME()),
          DATEADD(DAY, @days, DATEADD(MINUTE, 330, SYSUTCDATETIME())),
          @paid, 1, @uid
        )
      `)
      await tx.commit()
      return res.status(201).json({ success: true, membership_id: r2.recordset[0].membership_id })
    } catch (inner) {
      await tx.rollback()
      throw inner
    }
  } catch (err) {
    return next(err)
  }
})

/* ══════════════════════════════════════════════════════════════
   STAFF: Eye Tests — enter prescription for a customer
══════════════════════════════════════════════════════════════ */

/** POST /api/cx/customers/:id/eye-tests — staff enters prescription */
router.post('/customers/:id/eye-tests', authJwt, requireModule('cx'), requireCxPermission('cx.eye_tests.create'), async (req, res, next) => {
  try {
    const pool = await getPool()
    const customerId = parseInt(req.params.id, 10)
    if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer ID.' })

    const {
      tested_at, store_id,
      re_sph, re_cyl, re_axis, re_add, re_va,
      le_sph, le_cyl, le_axis, le_add, le_va,
      pd, lens_type, notes
    } = req.body || {}

    const testedDate = tested_at || new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T')

    const r = await pool.request()
      .input('cid',      customerId)
      .input('uid',      req.user.user_id || null)
      .input('sid',      store_id || req.user.store_id || null)
      .input('tested_at', testedDate)
      .input('re_sph',   re_sph   || null).input('re_cyl',  re_cyl  || null)
      .input('re_axis',  re_axis  || null).input('re_add',  re_add  || null)
      .input('re_va',    re_va    || null)
      .input('le_sph',   le_sph   || null).input('le_cyl',  le_cyl  || null)
      .input('le_axis',  le_axis  || null).input('le_add',  le_add  || null)
      .input('le_va',    le_va    || null)
      .input('pd',       pd       || null)
      .input('lens_type', lens_type || null)
      .input('notes',    notes    || null)
      .query(`
        INSERT INTO dbo.eye_tests
          (customer_id, tested_at, store_id, tested_by_user_id, source,
           re_sph, re_cyl, re_axis, re_add, re_va,
           le_sph, le_cyl, le_axis, le_add, le_va,
           pd, lens_type, notes)
        OUTPUT INSERTED.test_id
        VALUES
          (@cid, @tested_at, @sid, @uid, N'STAFF',
           @re_sph, @re_cyl, @re_axis, @re_add, @re_va,
           @le_sph, @le_cyl, @le_axis, @le_add, @le_va,
           @pd, @lens_type, @notes)
      `)
    return res.status(201).json({ success: true, test_id: r.recordset[0].test_id })
  } catch (err) {
    return next(err)
  }
})

/* ══════════════════════════════════════════════════════════════
   STAFF: Customer Offers CRUD
══════════════════════════════════════════════════════════════ */

/** GET /api/cx/offers */
router.get('/offers', authJwt, requireModule('cx'), requireCxPermission('cx.offers.view', 'cx.offers.manage'), async (req, res, next) => {
  try {
    const pool = await getPool()
    const r = await pool.request().query(`
      SELECT offer_id, title, description, icon_emoji, discount_type,
             discount_value, valid_from, valid_to, eligible_tier,
             is_plus_only, is_active, sort_order, created_at
      FROM   dbo.customer_offers
      ORDER BY is_active DESC, sort_order ASC, created_at DESC
    `)
    return res.json({ success: true, data: r.recordset })
  } catch (err) {
    return next(err)
  }
})

/** POST /api/cx/offers */
router.post('/offers', authJwt, requireModule('cx'), requireCxPermission('cx.offers.manage'), async (req, res, next) => {
  try {
    const { error, value } = cxOfferCreateSchema.validate(req.body || {})
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      })
    }

    const pool = await getPool()
    const {
      title,
      description,
      icon_emoji,
      discount_type,
      discount_value,
      valid_from,
      valid_to,
      eligible_tier,
      is_plus_only,
      sort_order
    } = value

    const r = await pool.request()
      .input('title',          title)
      .input('description',    description || '')
      .input('icon_emoji',     icon_emoji  || '🎁')
      .input('discount_type',  discount_type)
      .input('discount_value', parseFloat(discount_value) || 0)
      .input('valid_from',     valid_from || new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T'))
      .input('valid_to',       valid_to)
      .input('eligible_tier',  eligible_tier || null)
      .input('is_plus_only',   is_plus_only ? 1 : 0)
      .input('sort_order',     parseInt(sort_order, 10) || 0)
      .input('uid',            req.user.user_id || null)
      .query(`
        INSERT INTO dbo.customer_offers
          (title, description, icon_emoji, discount_type, discount_value,
           valid_from, valid_to, eligible_tier, is_plus_only, sort_order,
           created_by_user_id)
        OUTPUT INSERTED.offer_id
        VALUES
          (@title, @description, @icon_emoji, @discount_type, @discount_value,
           @valid_from, @valid_to, @eligible_tier, @is_plus_only, @sort_order,
           @uid)
      `)
    return res.status(201).json({ success: true, offer_id: r.recordset[0].offer_id })
  } catch (err) {
    return next(err)
  }
})

/** PATCH /api/cx/offers/:id */
router.patch('/offers/:id', authJwt, requireModule('cx'), requireCxPermission('cx.offers.manage'), async (req, res, next) => {
  try {
    const pool = await getPool()
    const offerId = parseInt(req.params.id, 10)
    if (!offerId) return res.status(400).json({ success: false, message: 'Invalid offer ID.' })

    const { error, value } = cxOfferPatchSchema.validate(req.body || {})
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      })
    }

    const {
      title,
      description,
      icon_emoji,
      discount_type,
      discount_value,
      valid_from,
      valid_to,
      eligible_tier,
      is_plus_only,
      is_active,
      sort_order
    } = value

    await pool.request()
      .input('id',             offerId)
      .input('title',          title          || null)
      .input('description',    description    || null)
      .input('icon_emoji',     icon_emoji     || null)
      .input('discount_type',  discount_type  || null)
      .input('discount_value', discount_value != null ? parseFloat(discount_value) : null)
      .input('valid_from',     valid_from     || null)
      .input('valid_to',       valid_to       || null)
      .input('eligible_tier',  eligible_tier  !== undefined ? (eligible_tier || null) : undefined)
      .input('is_plus_only',   is_plus_only   != null ? (is_plus_only ? 1 : 0) : null)
      .input('is_active',      is_active      != null ? (is_active    ? 1 : 0) : null)
      .input('sort_order',     sort_order     != null ? parseInt(sort_order, 10) : null)
      .query(`
        UPDATE dbo.customer_offers SET
          title          = ISNULL(@title,          title),
          description    = ISNULL(@description,    description),
          icon_emoji     = ISNULL(@icon_emoji,     icon_emoji),
          discount_type  = ISNULL(@discount_type,  discount_type),
          discount_value = ISNULL(@discount_value, discount_value),
          valid_from     = ISNULL(@valid_from,     valid_from),
          valid_to       = ISNULL(@valid_to,       valid_to),
          eligible_tier  = ISNULL(@eligible_tier,  eligible_tier),
          is_plus_only   = ISNULL(@is_plus_only,   is_plus_only),
          is_active      = ISNULL(@is_active,      is_active),
          sort_order     = ISNULL(@sort_order,     sort_order),
          updated_at     = DATEADD(MINUTE, 330, SYSUTCDATETIME())
        WHERE offer_id = @id
      `)
    return res.json({ success: true })
  } catch (err) {
    return next(err)
  }
})

/** DELETE /api/cx/offers/:id — soft delete (deactivate) */
router.delete('/offers/:id', authJwt, requireModule('cx'), requireCxPermission('cx.offers.manage'), async (req, res, next) => {
  try {
    const pool = await getPool()
    const offerId = parseInt(req.params.id, 10)
    if (!offerId) return res.status(400).json({ success: false, message: 'Invalid offer ID.' })

    await pool.request().input('id', offerId).query(`
      UPDATE dbo.customer_offers
      SET is_active = 0, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      WHERE offer_id = @id
    `)
    return res.json({ success: true })
  } catch (err) {
    return next(err)
  }
})

module.exports = router
