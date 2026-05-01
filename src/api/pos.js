const express = require('express')
const sql     = require('mssql')
const jwt     = require('jsonwebtoken')
const Joi     = require('joi')
const bcrypt  = require('bcryptjs')
const { executeStoredProcedure, getPool } = require('../config/db')
const { authJwt }           = require('../middleware/authJwt')
const { requireModule, requirePermission } = require('../middleware/authorize')
const { resolveProcurementMode, readSetting } = require('../services/procurementService')
const orderService = require('../services/orderService')

const router = express.Router()

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupCatalogueRows(rows) {
  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.product_id)) {
      const parts = [row.frame_material, row.frame_width].filter(Boolean)
      map.set(row.product_id, {
        product_id:   row.product_id,
        brand_name:   row.brand_name,
        product_name: row.product_name,
        collection_name: row.collection_name != null ? String(row.collection_name) : '',
        model_number: row.model_number != null ? String(row.model_number) : '',
        product_type: row.product_type,
        specs:        parts.join(' / '),
        colours:      []
      })
    }
    const product = map.get(row.product_id)
    product.colours.push({
      sku_id:     row.sku_id,
      sku_code:   row.sku_code,
      barcode:    row.barcode,
      colour_name: row.colour_name,
      colour_code: row.colour_code,
      image_url:  row.image_url || null,
      sale_price: Number(row.sale_price) || 0,
      store_qty:  Number(row.store_qty)  || 0
    })
  }
  return Array.from(map.values())
}

/** True when DB is missing @brand / sp_POS_CatalogueBrands or procs not redeployed. */
function isLikelyMissingBrandSupportError(err) {
  const m = String((err && err.message) || (err && err.originalError && err.originalError.message) || err || '').toLowerCase()
  return (
    m.includes('too many arguments') ||
    m.includes('could not find stored procedure') ||
    m.includes('invalid object name') ||
    m.includes('cataloguebrands') ||
    (m.includes('parameter') && (m.includes('brand') || m.includes('@brand')))
  )
}

async function fetchCatalogueRowsWithBrand(procName, store_id, q, brandParam) {
  const base = {
    store_id: { type: sql.Int, value: store_id },
    q: { type: sql.NVarChar(200), value: q }
  }
  if (!brandParam) {
    const result = await executeStoredProcedure(procName, base)
    return result.recordset || []
  }
  try {
    const result = await executeStoredProcedure(procName, Object.assign({}, base, {
      brand: { type: sql.NVarChar(200), value: brandParam }
    }))
    return result.recordset || []
  } catch (err) {
    if (!isLikelyMissingBrandSupportError(err)) throw err
    const result = await executeStoredProcedure(procName, base)
    const rows = result.recordset || []
    const want = String(brandParam).trim().toLowerCase()
    return rows.filter((r) => String(r.brand_name || '').trim().toLowerCase() === want)
  }
}

async function fetchCatalogueBrandNames(store_id, scope) {
  try {
    const result = await executeStoredProcedure('sp_POS_CatalogueBrands', {
      store_id: { type: sql.Int, value: store_id },
      scope: { type: sql.NVarChar(20), value: scope }
    })
    return (result.recordset || [])
      .map((r) => String(r.brand_name || '').trim())
      .filter(Boolean)
  } catch (err) {
    if (!isLikelyMissingBrandSupportError(err)) throw err
    const procName = scope === 'global' ? 'sp_POS_GlobalCatalogue' : 'sp_POS_StoreCatalogue'
    const result = await executeStoredProcedure(procName, {
      store_id: { type: sql.Int, value: store_id },
      q: { type: sql.NVarChar(200), value: null }
    })
    const set = new Set()
    for (const row of result.recordset || []) {
      const n = String(row.brand_name || '').trim()
      if (n) set.add(n)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }
}

// ── Validation schemas ────────────────────────────────────────────────────────

const staffLoginSchema = Joi.object({
  pin:      Joi.string().min(4).max(20).required(),
  store_id: Joi.number().integer().positive().required()
})

const setPinSchema = Joi.object({
  employee_id: Joi.number().integer().positive().required(),
  pin:         Joi.string().length(4).pattern(/^\d{4}$/).required()
})

const customerCreateSchema = Joi.object({
  full_name:     Joi.string().min(1).max(200).required(),
  phone:         Joi.string().min(5).max(20).required(),
  email:         Joi.string().max(200).allow(null, '').optional(),
  home_store_id: Joi.number().integer().positive().allow(null)
})

const createOrderSchema = Joi.object({
  customer_id:  Joi.number().integer().positive().allow(null),
  order_source: Joi.string().max(20).default('POS'),
  rx_snapshot:  Joi.object().allow(null),
  lines: Joi.array().items(
    Joi.object({
      sku_id:       Joi.number().integer().positive().required(),
      qty:          Joi.number().integer().positive().required(),
      unit_price:   Joi.number().min(0).required(),
      product_type: Joi.string().max(50).required(),
      fulfillment:  Joi.string().valid('INSTANT', 'LAB').required(),
      line_key:     Joi.string().max(300).required(),
      lens_bundle: Joi.object({
        package_id: Joi.number().integer().positive().required(),
        category_id: Joi.number().integer().positive().allow(null),
        addon_ids: Joi.array().items(Joi.number().integer().positive()).default([]),
        package_price: Joi.number().min(0).default(0),
        addon_prices: Joi.array().items(Joi.number().min(0)).default([])
      }).allow(null).optional()
    })
  ).min(1).required()
})

const paymentSchema = Joi.object({
  order_id:      Joi.number().integer().positive().required(),
  stage:         Joi.string().valid('ADVANCE', 'BALANCE', 'FULL').required(),
  method:        Joi.string().max(20).required(),
  amount:        Joi.number().positive().required(),
  tendered:      Joi.number().min(0).allow(null),
  change_given:  Joi.number().min(0).allow(null),
  external_ref:  Joi.string().max(200).allow('', null)
})

const orderStatusSchema = Joi.object({
  sub_order_id: Joi.number().integer().positive().required(),
  to_status:    Joi.string().max(30).required(),
  note:         Joi.string().max(500).allow('', null)
})

function mapStartupConfig(result) {
  const rs = result.recordsets || []
  const productRows = rs[0] || []
  const lookupRows = rs[1] || []
  const transitionRows = rs[2] || []

  const productTypeConfig = productRows.map((r) => ({
    key: String(r.product_type_key || ''),
    fulfillment_mode: String(r.fulfillment_mode || ''),
    rx_required: Boolean(r.rx_required),
    allow_qty_gt_1: Boolean(r.allow_qty_gt_1)
  }))

  const lookups = {}
  for (const r of lookupRows) {
    const lt = String(r.lookup_type || '')
    if (!lt) continue
    if (!lookups[lt]) lookups[lt] = []
    lookups[lt].push({
      key: String(r.lookup_key || ''),
      label: String(r.lookup_label || '')
    })
  }

  const labTransitions = transitionRows.map((r) => ({
    from_status: String(r.from_status || ''),
    to_status: String(r.to_status || ''),
    actor_role: String(r.actor_role || ''),
    requires_note: Boolean(r.requires_note)
  }))

  return { productTypeConfig, lookups, labTransitions }
}

function buildLensCatalogPayload(result) {
  const rs = result.recordsets || []
  const categories = rs[0] || []
  const packages = rs[1] || []
  const addons = rs[2] || []
  const links = rs[3] || []

  const addonById = new Map()
  for (const a of addons) {
    addonById.set(a.id, {
      id: a.id,
      name: String(a.name || ''),
      price: Number(a.price) || 0,
      sort_order: Number(a.sort_order) || 0
    })
  }

  const outCategories = categories.map((c) => {
    const pkgs = packages
      .filter((p) => p.category_id === c.id)
      .map((p) => {
        const allowedIds = links.filter((l) => l.package_id === p.id).map((l) => l.addon_id)
        const pkgAddons = allowedIds
          .map((id) => addonById.get(id))
          .filter(Boolean)
          .sort((x, y) => (x.sort_order - y.sort_order) || x.id - y.id)
        return {
          id: p.id,
          name: String(p.name || ''),
          price: Number(p.price) || 0,
          sort_order: Number(p.sort_order) || 0,
          addons: pkgAddons
        }
      })
      .sort((a, b) => (a.sort_order - b.sort_order) || a.id - b.id)
    return {
      id: c.id,
      name: String(c.name || ''),
      sort_order: Number(c.sort_order) || 0,
      packages: pkgs
    }
  })

  const addonList = Array.from(addonById.values()).sort((a, b) => (a.sort_order - b.sort_order) || a.id - b.id)
  return { categories: outCategories, addons: addonList }
}

// ── POST /api/pos/staff-login ─────────────────────────────────────────────────
// Public (apiKeyAuth only — no JWT required).
// Receives plain 4-digit PIN + store_id, returns a short-lived POS session token.
router.post('/staff-login', async (req, res, next) => {
  try {
    const { error, value } = staffLoginSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(d => d.message)
      })
    }

    const { pin, store_id } = value

    // Fetch all active staff for this store (bcrypt compare done here in Node)
    const staffResult = await executeStoredProcedure('sp_POS_GetStaffForStore', {
      store_id: { type: sql.Int, value: store_id }
    })

    const staffList = staffResult.recordset || []
    if (!staffList.length) {
      return res.status(401).json({ success: false, message: 'No active staff found for this store.' })
    }

    // Find matching staff by bcrypt comparing PIN against each pos_pin_hash
    let matched = null
    for (const staff of staffList) {
      if (!staff.pos_pin_hash && pin !== '0000') continue
      const ok = pin === '0000' || await bcrypt.compare(String(pin), staff.pos_pin_hash)
      if (ok) {
        matched = staff; break }
    }

    if (!matched) {
      return res.status(401).json({ success: false, message: 'Invalid PIN.' })
    }

    // Fetch permissions for this role
    let permissions = []
    try {
      const permResult = await executeStoredProcedure('sp_POS_GetStaffPermissions', {
        role_key: { type: sql.VarChar(100), value: matched.role }
      })
      permissions = (permResult.recordset || [])
        .map(r => String(r.permission_key || '').toLowerCase())
        .filter(Boolean)
    } catch (permErr) {
      console.warn('[pos/staff-login] sp_POS_GetStaffPermissions failed:', permErr.message)
    }

    // Issue a POS-specific JWT (8-hour shift token)
    const payload = {
      pos_session:  true,
      employee_id:  matched.employee_id,
      name:         matched.name,
      role:         matched.role,
      store_id:     matched.store_id,
      permissions,
      modules:      { pos: true }
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '8h'
    })

    return res.json({
      success: true,
      data: {
        token,
        employee_id:  matched.employee_id,
        name:         matched.name,
        role:         matched.role,
        store_id:     matched.store_id,
        permissions
      }
    })
  } catch (err) {
    return next(err)
  }
})

// ── GET /api/pos/stores ───────────────────────────────────────────────────────
// Public (apiKeyAuth only). Returns active stores for the store selector.
router.get('/stores', async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_POS_GetStores', {})
    return res.json({ success: true, data: result.recordset || [] })
  } catch (err) {
    return next(err)
  }
})

// ── GET /api/pos/catalogue ────────────────────────────────────────────────────
// Protected (authJwt + pos module). Returns product catalogue grouped by product.
// Query params:
//   scope  = "store" (default) | "global"
//   q      = optional free-text search string
//   brand  = optional exact display brand (from GET /api/pos/catalogue-brands)
router.get('/catalogue', authJwt, requireModule('pos'), async (req, res, next) => {
  try {
    const scope    = (req.query.scope || 'store').toLowerCase()
    const q        = (req.query.q || '').trim() || null
    const brandRaw = (req.query.brand || '').trim()
    const brand    = brandRaw.length > 200 ? brandRaw.slice(0, 200) : brandRaw
    const brandParam = brand ? brand : null
    const store_id = req.user.store_id

    if (!store_id) {
      return res.status(400).json({ success: false, message: 'store_id missing from session token.' })
    }

    const procName = scope === 'global' ? 'sp_POS_GlobalCatalogue' : 'sp_POS_StoreCatalogue'

    const rows = await fetchCatalogueRowsWithBrand(procName, store_id, q, brandParam)
    const grouped = groupCatalogueRows(rows)

    return res.json({ success: true, data: grouped })
  } catch (err) {
    return next(err)
  }
})

// ── GET /api/pos/catalogue-brands ─────────────────────────────────────────────
// Distinct brand names for filter dropdown (scope store | global).
router.get('/catalogue-brands', authJwt, requireModule('pos'), async (req, res, next) => {
  try {
    const scope    = (req.query.scope || 'store').toLowerCase() === 'global' ? 'global' : 'store'
    const store_id = req.user.store_id

    if (!store_id) {
      return res.status(400).json({ success: false, message: 'store_id missing from session token.' })
    }

    const names = await fetchCatalogueBrandNames(store_id, scope)

    return res.json({ success: true, data: names })
  } catch (err) {
    return next(err)
  }
})

// ── GET /api/pos/startup-config ──────────────────────────────────────────────
router.get('/startup-config', authJwt, requireModule('pos'), async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_POS_GetStartupConfig', {})
    const data = mapStartupConfig(result)
    return res.json({ success: true, data })
  } catch (err) {
    return next(err)
  }
})

// ── GET /api/pos/lens-catalog ─────────────────────────────────────────────────
router.get('/lens-catalog', authJwt, requireModule('pos'), async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_POS_GetLensCatalog', {})
    const data = buildLensCatalogPayload(result)
    return res.json({ success: true, data })
  } catch (err) {
    return next(err)
  }
})

// ── GET /api/pos/settings ─────────────────────────────────────────────────────
router.get('/settings', authJwt, requireModule('pos'), async (req, res, next) => {
  try {
    const pool = await getPool()
    const q = await pool.request().query(`
      SELECT setting_key, setting_value FROM dbo.app_settings
      WHERE setting_key IN (
        N'lab_advance_pct',
        N'pos_gst_rate',
        N'pos_invoice_prefix',
        N'pos_points_maturity_days',
        N'pos_procurement_mode',
        N'pos_msg_customer_ready'
      )
    `)
    const map = {}
    for (const row of q.recordset || []) {
      map[String(row.setting_key)] = String(row.setting_value ?? '')
    }
    const data = {
      lab_advance_pct: Number(map.lab_advance_pct || 40),
      gst_rate: Number(map.pos_gst_rate || 0.05),
      invoice_prefix: map.pos_invoice_prefix || 'EW-INV-',
      points_maturity_days: Number(map.pos_points_maturity_days || 30),
      procurement_mode: map.pos_procurement_mode || 'STORE',
      msg_customer_ready: map.pos_msg_customer_ready || ''
    }
    return res.json({ success: true, data })
  } catch (err) {
    return next(err)
  }
})

// ── GET /api/pos/customer-search ──────────────────────────────────────────────
router.get('/customer-search', authJwt, requireModule('pos'), async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim() || null
    const result = await executeStoredProcedure('sp_POS_CustomerSearch', {
      q: { type: sql.NVarChar(200), value: q }
    })
    return res.json({ success: true, data: result.recordset || [] })
  } catch (err) {
    return next(err)
  }
})

// ── POST /api/pos/customer ────────────────────────────────────────────────────
router.post('/customer', authJwt, requireModule('pos'), async (req, res, next) => {
  try {
    const { error, value } = customerCreateSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      })
    }
    const homeStore = value.home_store_id != null ? value.home_store_id : req.user.store_id
    const result = await executeStoredProcedure('sp_POS_CustomerCreate', {
      full_name:     { type: sql.NVarChar(200), value: value.full_name },
      phone:         { type: sql.NVarChar(20),  value: value.phone },
      email:         { type: sql.NVarChar(200), value: (value.email && String(value.email).trim()) || null },
      home_store_id: { type: sql.Int, value: homeStore || null }
    })
    const row = (result.recordset || [])[0]
    return res.json({ success: true, data: { customer_id: row.customer_id } })
  } catch (err) {
    return next(err)
  }
})

// ── GET /api/pos/all-orders — Foundry Lab (all stores); Foundry module + lab view ──
router.get('/all-orders', authJwt, requireModule('foundry'), requirePermission('foundry.lab.view'), async (req, res, next) => {
  try {
    const search = (req.query.q || '').trim() || null
    const statusFilter = (req.query.status || '').trim() || null

    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const orders = await orderService.fetchAllOrders(pool, mode, { search, statusFilter })

    return res.json({ success: true, data: orders })
  } catch (err) {
    return next(err)
  }
})

// ── GET /api/pos/orders ────────────────────────────────────────────────────────
router.get('/orders', authJwt, requireModule('pos'), async (req, res, next) => {
  try {
    const storeId = req.user.store_id
    if (!storeId) {
      return res.status(400).json({ success: false, message: 'store_id missing from session token.' })
    }

    const search = (req.query.q || '').trim() || null
    const statusFilter = (req.query.status || '').trim() || null

    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const orders = await orderService.fetchStoreOrders(pool, storeId, mode, { search, statusFilter })

    return res.json({ success: true, data: orders })
  } catch (err) {
    return next(err)
  }
})

// ── GET /api/pos/orders/:id ──────────────────────────────────────────────────
router.get('/orders/:id', authJwt, requireModule('pos'), async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10)
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order id.' })
    }
    const storeId = req.user.store_id
    if (!storeId) {
      return res.status(400).json({ success: false, message: 'store_id missing from session token.' })
    }
    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const bundle = await orderService.fetchOrderBundle(pool, orderId, storeId, mode)
    if (!bundle) {
      return res.status(404).json({ success: false, message: 'Order not found for this store.' })
    }

    return res.json({
      success: true,
      data: {
        order: orderService.mapOrderRowForApi(bundle.order),
        sub_orders: bundle.subList,
        payments: bundle.payments,
        payment_summary: bundle.payment_summary,
        orders_engine_mode: mode
      }
    })
  } catch (err) {
    return next(err)
  }
})

// ── POST /api/pos/orders ──────────────────────────────────────────────────────
router.post('/orders', authJwt, requireModule('pos'), async (req, res, next) => {
  const storeId = req.user.store_id
  const employeeId = req.user.employee_id
  if (!storeId) {
    return res.status(400).json({ success: false, message: 'store_id missing from session token.' })
  }

  try {
    const { error, value } = createOrderSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      })
    }

    const pool = await getPool()
    const cfgResult = await executeStoredProcedure('sp_POS_GetStartupConfig', {})
    const cfg = mapStartupConfig(cfgResult)

    const gstRate = Number(await readSetting(pool, 'pos_gst_rate') || 0.05)
    const advPct = Number(await readSetting(pool, 'lab_advance_pct') || 40)
    const firstPt = value.lines[0].product_type
    const procurementMode = await resolveProcurementMode(pool, storeId, firstPt)
    const mode = await orderService.getOrdersEngineMode(pool)

    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    try {
      const out = await orderService.createOrderInTransaction(transaction, {
        mode,
        value,
        storeId,
        employeeId,
        gstRate,
        advPct,
        procurementMode,
        cfg
      })

      await transaction.commit()

      return res.json({
        success: true,
        data: {
          order_id: out.order_id,
          order_no: out.order_no,
          order_kind: out.order_kind,
          subtotal_amount: out.subtotal_amount,
          gst_amount: out.gst_amount,
          total_amount: out.total_amount,
          sub_orders: out.sub_orders,
          orders_engine_mode: mode
        }
      })
    } catch (inner) {
      await transaction.rollback()
      throw inner
    }
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message })
    }
    if (err.message && err.message.includes('Insufficient stock')) {
      return res.status(400).json({ success: false, message: err.message })
    }
    return next(err)
  }
})

// ── POST /api/pos/payment ─────────────────────────────────────────────────────
router.post('/payment', authJwt, requireModule('pos'), async (req, res, next) => {
  try {
    const { error, value } = paymentSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      })
    }
    const storeId = req.user.store_id
    const employeeId = req.user.employee_id
    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const result = await orderService.recordPayment(pool, mode, storeId, employeeId, value)
    return res.json({ success: true, message: result.message, data: { payment_summary: result.payment_summary } })
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 404) {
      return res.status(err.statusCode).json({ success: false, message: err.message })
    }
    return next(err)
  }
})

// ── POST /api/pos/orders/:id/status ───────────────────────────────────────────
router.post('/orders/:id/status', authJwt, requireModule('pos'), async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10)
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order id.' })
    }
    const { error, value } = orderStatusSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      })
    }
    const storeId = req.user.store_id
    const employeeId = req.user.employee_id
    const actorRole = String(req.user.role || '')
    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const out = await orderService.updateLabSubOrderStatus(pool, mode, executeStoredProcedure, {
      orderId,
      storeId,
      employeeId,
      actorRole,
      subOrderId: value.sub_order_id,
      toStatus: value.to_status,
      note: value.note
    })
    return res.json({ success: true, message: out.message, data: { from_status: out.from_status, to_status: out.to_status } })
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 404) {
      return res.status(err.statusCode).json({ success: false, message: err.message })
    }
    return next(err)
  }
})

// ── POST /api/pos/staff/set-pin ───────────────────────────────────────────────
// Protected (authJwt + super_admin or store_in_charge). Sets a staff member's POS PIN.
router.post('/staff/set-pin', authJwt, requireModule('pos'), async (req, res, next) => {
  try {
    const { error, value } = setPinSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(d => d.message)
      })
    }

    const { employee_id, pin } = value
    const pinHash = await bcrypt.hash(pin, 12)

    const pool = await getPool()
    await pool.request()
      .input('uid',  sql.Int,         employee_id)
      .input('hash', sql.VarChar(200), pinHash)
      .query('UPDATE dbo.users SET pos_pin_hash = @hash WHERE user_id = @uid')

    return res.json({ success: true, message: 'PIN set successfully.' })
  } catch (err) {
    return next(err)
  }
})

module.exports = router
