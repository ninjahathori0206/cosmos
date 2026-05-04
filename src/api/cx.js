const express = require('express')
const sql = require('mssql')
const { getPool } = require('../config/db')
const { authJwt } = require('../middleware/authJwt')
const { requireModule, requireCxPermission } = require('../middleware/authorize')
const orderService = require('../services/orderService')

const router = express.Router()

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

async function handleCxMembershipPlans (_req, res, next) {
  try {
    const pool = await getPool()
    const r = await pool.request().query(`
      SELECT plan_id, plan_key, display_name, price, validity_days, max_dependents, is_active
      FROM   dbo.membership_plans
      WHERE  is_active = 1
      ORDER BY plan_key ASC
    `)
    return res.json({ success: true, data: r.recordset || [] })
  } catch (err) {
    return next(err)
  }
}

/** GET /api/cx/plans and /api/cx/membership-plans — Eyewoot Go plan catalogue */
router.get(
  ['/plans', '/membership-plans'],
  authJwt,
  requireModule('cx'),
  requireCxPermission('cx.membership.manage'),
  handleCxMembershipPlans
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

    const memR = await pool.request().input('cid', customerId).query(`
      SELECT TOP 1 m.membership_id, m.plan_key, m.purchased_at, m.expires_at, m.price_paid,
             m.is_active, p.display_name AS plan_display_name
      FROM   dbo.customer_memberships m
      JOIN   dbo.membership_plans p ON p.plan_key = m.plan_key
      WHERE  m.customer_id = @cid AND m.is_active = 1
        AND  m.expires_at > DATEADD(MINUTE, 330, SYSUTCDATETIME())
      ORDER BY m.expires_at DESC
    `)

    return res.json({
      success: true,
      data: {
        customer: { customer_id: cust.customer_id, full_name: cust.full_name, phone: cust.phone, is_active: !!cust.is_active },
        active_membership: memR.recordset[0] || null
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
    const pool = await getPool()
    const {
      title, description, icon_emoji, discount_type, discount_value,
      valid_from, valid_to, eligible_tier, is_plus_only, sort_order
    } = req.body || {}

    if (!title || !valid_to) {
      return res.status(400).json({ success: false, message: 'title and valid_to are required.' })
    }

    const r = await pool.request()
      .input('title',          title)
      .input('description',    description || '')
      .input('icon_emoji',     icon_emoji  || '🎁')
      .input('discount_type',  discount_type  || 'PCT')
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

    const {
      title, description, icon_emoji, discount_type, discount_value,
      valid_from, valid_to, eligible_tier, is_plus_only, is_active, sort_order
    } = req.body || {}

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
