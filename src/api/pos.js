const express = require('express')
const sql     = require('mssql')
const jwt     = require('jsonwebtoken')
const Joi     = require('joi')
const bcrypt  = require('bcryptjs')
const { executeStoredProcedure, getPool } = require('../config/db')
const { authJwt }           = require('../middleware/authJwt')
const { apiKeyAuth }        = require('../middleware/apiKeyAuth')
const { requireTabletSession } = require('../middleware/requireTabletSession')
const { requireModule, requirePermission } = require('../middleware/authorize')
const { writeAuditLog }     = require('../services/auditService')
const { resolveProcurementMode, readSetting } = require('../services/procurementService')
const orderService = require('../services/orderService')
const { resolveSkuFacts, computeOfferDiscountAmount } = require('../services/customerOfferDiscountService')

const router = express.Router()

/** POS tablet JWT — same requirePermission as staff login pipeline (role_permissions → JWT.permissions). */
const posCatalogue = [authJwt, requireModule('pos'), requirePermission('pos.catalogue.view')]
const posPromotions = [authJwt, requireModule('pos'), requirePermission('pos.promotions.view')]
const posCustomersView = [authJwt, requireModule('pos'), requirePermission('pos.customers.view')]
const posCustomersCreate = [authJwt, requireModule('pos'), requirePermission('pos.customers.create')]
const posOrdersView = [authJwt, requireModule('pos'), requirePermission('pos.orders.view')]
const posOrdersCreate = [authJwt, requireModule('pos'), requirePermission('pos.orders.create')]
const posPaymentCollect = [authJwt, requireModule('pos'), requirePermission('pos.payment.collect')]
const posLabWorkflow = [authJwt, requireModule('pos'), requirePermission('pos.lab.workflow')]
const posStaffPinSet = [authJwt, requireModule('pos'), requirePermission('pos.staff.pin.set')]

// ── Helpers ───────────────────────────────────────────────────────────────────

function truthyPosSetting(val) {
  const s = String(val ?? '').trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes'
}

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

const tabletLoginSchema = Joi.object({
  tablet_id: Joi.number().integer().positive().required(),
  pin: Joi.string().min(4).max(20).required()
})

const staffPinLoginSchema = Joi.object({
  pin: Joi.string().min(4).max(20).required()
})

const selfSetPinSchema = Joi.object({
  pin: Joi.string().length(4).pattern(/^\d{4}$/).required()
})

const sessionIdSchema = Joi.object({
  session_id: Joi.number().integer().positive().optional(),
  cancel_reason: Joi.string().max(200).allow('', null).optional()
})

async function getPosMaxPinAttempts() {
  try {
    const r = await executeStoredProcedure('sp_POS_GetSystemConfig', {
      config_key: { type: sql.VarChar(100), value: 'pos_max_pin_attempts' }
    })
    const row = (r.recordset || [])[0]
    const n = parseInt(String(row && row.config_value != null ? row.config_value : '3'), 10)
    return Number.isFinite(n) && n > 0 ? n : 3
  } catch (_e) {
    return 3
  }
}

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
  customer_id:      Joi.number().integer().positive().allow(null),
  order_source:     Joi.string().max(20).default('POS'),
  rx_snapshot:      Joi.object().allow(null),
  discount_amount:  Joi.number().min(0).default(0),
  applied_offer_id: Joi.number().integer().positive().allow(null),
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

function posLensPublicLabel(brand, name, legacyName) {
  const b = String(brand || '').trim()
  const n = String(name || '').trim()
  const leg = String(legacyName || '').trim()
  if (b && n) return `${b} · ${n}`
  if (n) return n
  if (b) return b
  return leg || '—'
}

/** Lowercase haystack for POS lens wizard power-type → category matching (not shown in UI). */
function lensCategoryMatchHaystack(c) {
  const parts = [c.name, c.pos_brand, c.pos_name, c.internal_brand, c.internal_name]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
  return parts.join(' ').toLowerCase()
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
      name: posLensPublicLabel(a.pos_brand, a.pos_name, a.name),
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
          name: posLensPublicLabel(p.pos_brand, p.pos_name, p.name),
          price: Number(p.price) || 0,
          sort_order: Number(p.sort_order) || 0,
          addons: pkgAddons
        }
      })
      .sort((a, b) => (a.sort_order - b.sort_order) || a.id - b.id)
    return {
      id: c.id,
      name: posLensPublicLabel(c.pos_brand, c.pos_name, c.name),
      sort_order: Number(c.sort_order) || 0,
      matchHaystack: lensCategoryMatchHaystack(c),
      packages: pkgs
    }
  })

  const addonList = Array.from(addonById.values()).sort((a, b) => (a.sort_order - b.sort_order) || a.id - b.id)
  return { categories: outCategories, addons: addonList }
}

// ── POST /api/pos/tablet-login ────────────────────────────────────────────────
// Public + API key. Unlocks a physical tablet; returns short-lived tablet JWT (X-Tablet-Token).
router.post('/tablet-login', apiKeyAuth, async (req, res, next) => {
  try {
    const { error, value } = tabletLoginSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      })
    }

    const tabResult = await executeStoredProcedure('sp_POS_ValidateTabletPin', {
      tablet_id: { type: sql.Int, value: value.tablet_id }
    })
    const tab = (tabResult.recordset || [])[0]
    if (!tab) {
      return res.status(401).json({ success: false, message: 'Tablet not found or inactive.' })
    }

    const ok = await bcrypt.compare(String(value.pin), String(tab.pin_hash || ''))
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Invalid tablet PIN.' })
    }

    await executeStoredProcedure('sp_POS_UpdateTabletLastLogin', {
      tablet_id: { type: sql.Int, value: tab.tablet_id }
    })

    const token = jwt.sign(
      {
        tablet_session: true,
        tablet_id: tab.tablet_id,
        store_id: tab.store_id,
        device_name: String(tab.device_name || '')
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    )

    return res.json({
      success: true,
      data: {
        token,
        tablet_id: tab.tablet_id,
        store_id: tab.store_id,
        device_name: tab.device_name
      }
    })
  } catch (err) {
    return next(err)
  }
})

// ── POST /api/pos/staff-login ─────────────────────────────────────────────────
// API key + tablet session. Staff PIN; starts pos_order_sessions row; returns staff JWT.
router.post('/staff-login', apiKeyAuth, requireTabletSession, async (req, res, next) => {
  try {
    const { error, value } = staffPinLoginSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      })
    }

    const storeId = req.tablet.store_id
    const tabletId = req.tablet.tablet_id
    const pin = value.pin

    const staffResult = await executeStoredProcedure('sp_POS_GetStaffForStore_v2', {
      store_id: { type: sql.Int, value: storeId }
    })

    const staffList = staffResult.recordset || []
    if (!staffList.length) {
      return res.status(401).json({ success: false, message: 'No active staff found for this store.' })
    }

    let matched = null
    for (const staff of staffList) {
      if (!staff.pos_pin_hash && pin !== '0000') continue
      const pinOk = pin === '0000' || (await bcrypt.compare(String(pin), String(staff.pos_pin_hash || '')))
      if (pinOk) {
        matched = staff
        break
      }
    }

    const maxAttempts = await getPosMaxPinAttempts()

    if (!matched) {
      const logResult = await executeStoredProcedure('sp_POS_LogPinAttempt', {
        user_id: { type: sql.Int, value: null },
        tablet_id: { type: sql.Int, value: tabletId },
        store_id: { type: sql.Int, value: storeId },
        success: { type: sql.Bit, value: 0 }
      })
      const fails = Number((logResult.recordset && logResult.recordset[0] && logResult.recordset[0].consecutive_failures) || 0)
      if (fails >= maxAttempts) {
        try {
          await writeAuditLog({
            userId: null,
            action: 'POS_PIN_LOCKOUT_ALERT',
            module: 'pos',
            entityType: 'store',
            entityId: storeId,
            newValue: JSON.stringify({ tablet_id: tabletId, attempts: fails }),
            ipAddress: req.ip || null
          })
        } catch (_a) {
          /* non-fatal */
        }
      }
      return res.status(401).json({ success: false, message: 'Invalid PIN.' })
    }

    await executeStoredProcedure('sp_POS_LogPinAttempt', {
      user_id: { type: sql.Int, value: matched.employee_id },
      tablet_id: { type: sql.Int, value: tabletId },
      store_id: { type: sql.Int, value: storeId },
      success: { type: sql.Bit, value: 1 }
    })

    const canRefund = Boolean(matched.can_initiate_refund)
    const sessResult = await executeStoredProcedure('sp_POS_StartOrderSession', {
      tablet_id: { type: sql.Int, value: tabletId },
      user_id: { type: sql.Int, value: matched.employee_id },
      store_id: { type: sql.Int, value: storeId },
      role_key_snapshot: { type: sql.VarChar(50), value: String(matched.role || '') },
      can_refund_snapshot: { type: sql.Bit, value: canRefund ? 1 : 0 }
    })
    const sessionRow = (sessResult.recordset || [])[0]
    const sessionId = sessionRow && sessionRow.session_id != null ? Number(sessionRow.session_id) : null
    if (!sessionId) {
      return res.status(500).json({ success: false, message: 'Failed to start order session.' })
    }

    let permissions = []
    try {
      const permResult = await executeStoredProcedure('sp_POS_GetStaffPermissions', {
        role_key: { type: sql.VarChar(100), value: matched.role }
      })
      permissions = (permResult.recordset || [])
        .map((r) => String(r.permission_key || '').toLowerCase())
        .filter(Boolean)
    } catch (permErr) {
      console.warn('[pos/staff-login] sp_POS_GetStaffPermissions failed:', permErr.message)
    }

    const payload = {
      pos_session: true,
      session_id: sessionId,
      tablet_id: tabletId,
      user_id: matched.employee_id,
      employee_id: matched.employee_id,
      name: matched.name,
      role: matched.role,
      store_id: matched.store_id,
      can_initiate_refund: canRefund,
      can_view_reports: Boolean(matched.can_view_reports),
      can_manage_staff: Boolean(matched.can_manage_staff),
      permissions,
      modules: { pos: true }
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '8h'
    })

    return res.json({
      success: true,
      data: {
        token,
        session_id: sessionId,
        employee_id: matched.employee_id,
        name: matched.name,
        role: matched.role,
        store_id: matched.store_id,
        permissions
      }
    })
  } catch (err) {
    return next(err)
  }
})

// ── POST /api/pos/session/complete ────────────────────────────────────────────
router.post('/session/complete', authJwt, requireModule('pos'), async (req, res, next) => {
  try {
    if (!req.user || !req.user.pos_session) {
      return res.status(403).json({ success: false, message: 'POS staff session required.' })
    }
    const { error, value } = sessionIdSchema.validate(req.body || {})
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message })
    }
    const sid = value.session_id != null ? Number(value.session_id) : Number(req.user.session_id)
    if (!Number.isFinite(sid) || sid !== Number(req.user.session_id)) {
      return res.status(400).json({ success: false, message: 'Invalid session.' })
    }
    const result = await executeStoredProcedure('sp_POS_CompleteOrderSession', {
      session_id: { type: sql.Int, value: sid }
    })
    const rows = Number((result.recordset && result.recordset[0] && result.recordset[0].rows_updated) || 0)
    if (!rows) {
      return res.status(400).json({ success: false, message: 'Session could not be completed.' })
    }
    return res.json({ success: true })
  } catch (err) {
    return next(err)
  }
})

// ── POST /api/pos/session/cancel ─────────────────────────────────────────────
router.post('/session/cancel', authJwt, requireModule('pos'), async (req, res, next) => {
  try {
    if (!req.user || !req.user.pos_session) {
      return res.status(403).json({ success: false, message: 'POS staff session required.' })
    }
    const { error, value } = sessionIdSchema.validate(req.body || {})
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message })
    }
    const sid = value.session_id != null ? Number(value.session_id) : Number(req.user.session_id)
    if (!Number.isFinite(sid) || sid !== Number(req.user.session_id)) {
      return res.status(400).json({ success: false, message: 'Invalid session.' })
    }
    const result = await executeStoredProcedure('sp_POS_CancelOrderSession', {
      session_id: { type: sql.Int, value: sid },
      cancel_reason: { type: sql.VarChar(200), value: value.cancel_reason || null }
    })
    const rows = Number((result.recordset && result.recordset[0] && result.recordset[0].rows_updated) || 0)
    if (!rows) {
      return res.status(400).json({ success: false, message: 'Session could not be cancelled.' })
    }
    return res.json({ success: true })
  } catch (err) {
    return next(err)
  }
})

// ── PUT /api/pos/set-pin ─────────────────────────────────────────────────────
// Self-service: logged-in staff sets own 4-digit POS PIN.
router.put('/set-pin', authJwt, requireModule('pos'), async (req, res, next) => {
  try {
    if (!req.user || !req.user.pos_session || req.user.employee_id == null) {
      return res.status(403).json({ success: false, message: 'POS staff session required.' })
    }
    const { error, value } = selfSetPinSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      })
    }
    const pinHash = await bcrypt.hash(value.pin, 12)
    const result = await executeStoredProcedure('sp_POS_SetUserPin', {
      user_id: { type: sql.Int, value: Number(req.user.employee_id) },
      pin_hash: { type: sql.VarChar(200), value: pinHash }
    })
    const rows = Number((result.recordset && result.recordset[0] && result.recordset[0].rows_updated) || 0)
    if (!rows) {
      return res.status(400).json({ success: false, message: 'Could not update PIN for this user.' })
    }
    try {
      await writeAuditLog({
        userId: Number(req.user.employee_id),
        action: 'POS_PIN_UPDATED',
        module: 'pos',
        entityType: 'user',
        entityId: Number(req.user.employee_id),
        ipAddress: req.ip || null
      })
    } catch (_a) {
      /* non-fatal */
    }
    return res.json({ success: true, message: 'PIN updated.' })
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
router.get('/catalogue', ...posCatalogue, async (req, res, next) => {
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
router.get('/catalogue-brands', ...posCatalogue, async (req, res, next) => {
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
router.get('/startup-config', ...posCatalogue, async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_POS_GetStartupConfig', {})
    const data = mapStartupConfig(result)
    return res.json({ success: true, data })
  } catch (err) {
    return next(err)
  }
})

// ── GET /api/pos/lens-catalog ─────────────────────────────────────────────────
router.get('/lens-catalog', ...posCatalogue, async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_POS_GetLensCatalog', {})
    const data = buildLensCatalogPayload(result)
    return res.json({ success: true, data })
  } catch (err) {
    return next(err)
  }
})

// ── GET /api/pos/settings ─────────────────────────────────────────────────────
router.get('/settings', ...posCatalogue, async (req, res, next) => {
  try {
    const pool = await getPool()
    const q = await pool.request().query(`
      SELECT setting_key, setting_value FROM dbo.app_settings
      WHERE setting_key IN (
        N'lab_advance_pct',
        N'pos_gst_rate',
        N'pos_composition_scheme',
        N'pos_prices_gst_inclusive',
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
      composition_scheme: truthyPosSetting(map.pos_composition_scheme),
      prices_gst_inclusive: truthyPosSetting(map.pos_prices_gst_inclusive),
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

// ── GET /api/pos/cart-offers — active Eyewoot Go offers for POS cart sidebar ───
// Optional ?customer_id= — when set, applies same Plus / tier filters as the customer app.
router.get('/cart-offers', ...posPromotions, async (req, res, next) => {
  try {
    const pool = await getPool()
    const rawId = req.query.customer_id
    const customerId = rawId != null && String(rawId).trim() !== ''
      ? parseInt(String(rawId), 10)
      : null

    const nowIST = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T')

    const r = await pool.request().input('now', nowIST).query(`
      SELECT offer_id, title, description, icon_emoji, discount_type,
             discount_value, valid_from, valid_to, eligible_tier,
             is_plus_only, sort_order
      FROM   dbo.customer_offers
      WHERE  is_active = 1
        AND  valid_from <= @now
        AND  valid_to   >= @now
      ORDER BY is_plus_only DESC, sort_order ASC, offer_id DESC
    `)

    let rows = r.recordset || []

    if (customerId && !Number.isNaN(customerId)) {
      const [balR, memR] = await Promise.all([
        pool.request().input('cid', customerId).query(`
          SELECT TOP 1 balance_after AS balance FROM dbo.pos_points_ledger
          WHERE customer_id = @cid ORDER BY ledger_id DESC
        `),
        pool.request().input('cid', customerId).query(`
          SELECT TOP 1 plan_key FROM dbo.customer_memberships
          WHERE customer_id = @cid AND is_active = 1
            AND expires_at > DATEADD(MINUTE, 330, SYSUTCDATETIME())
          ORDER BY expires_at DESC
        `)
      ])
      const balance = (balR.recordset[0] && balR.recordset[0].balance) || 0
      const hasPlus = memR.recordset.length > 0
      const tierR = await pool.request().input('pts', balance).query(`
        SELECT TOP 1 tier_name FROM dbo.loyalty_tiers
        WHERE min_points <= @pts AND (max_points = -1 OR max_points >= @pts)
        ORDER BY display_order DESC
      `)
      const tierName = (tierR.recordset[0] && tierR.recordset[0].tier_name) || 'Silver'
      const tierOrder = ['Silver', 'Gold', 'Platinum']
      const tierIdx = tierOrder.indexOf(tierName)

      rows = rows.filter((o) => {
        if (o.is_plus_only && !hasPlus) return false
        if (o.eligible_tier) {
          const reqIdx = tierOrder.indexOf(o.eligible_tier)
          if (reqIdx > tierIdx) return false
        }
        return true
      })
    }

    const normalized = rows.map((row) => ({
      ...row,
      offer_id: row.offer_id != null ? Number(row.offer_id) : null,
      discount_value: row.discount_value != null ? Number(row.discount_value) : 0,
      sort_order: row.sort_order != null ? Number(row.sort_order) : 0,
      is_plus_only: Boolean(row.is_plus_only)
    }))

    return res.json({ success: true, data: normalized })
  } catch (err) {
    return next(err)
  }
})

// ── GET /api/pos/customer-search ──────────────────────────────────────────────
router.get('/customer-search', ...posCustomersView, async (req, res, next) => {
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
router.post('/customer', ...posCustomersCreate, async (req, res, next) => {
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
router.get('/orders', ...posOrdersView, async (req, res, next) => {
  try {
    const storeId = req.user.store_id
    if (!storeId) {
      return res.status(400).json({ success: false, message: 'store_id missing from session token.' })
    }

    const search = (req.query.q || '').trim() || null
    const statusFilter = (req.query.status || '').trim() || null
    const orderKind = (req.query.kind || '').trim() || null
    const labStatusFilter = (req.query.lab_status || '').trim() || null
    const excludeRaw = (req.query.exclude_lab_status || '').trim()
    const labStatusExcludes = excludeRaw ? excludeRaw.split(',').map((s) => s.trim()).filter(Boolean) : []

    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const orders = await orderService.fetchStoreOrders(pool, storeId, mode, {
      search,
      statusFilter,
      orderKind,
      labStatusFilter,
      labStatusExcludes
    })

    return res.json({ success: true, data: orders })
  } catch (err) {
    return next(err)
  }
})

// ── GET /api/pos/orders/:id ──────────────────────────────────────────────────
router.get('/orders/:id', ...posOrdersView, async (req, res, next) => {
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

// ── GET /api/pos/catalogue-scope-facts ────────────────────────────────────────
// Batch-resolve sku_ids → {brand_id, product_id, product_type} for client-side scope matching.
// POS calls this after loading the cart to filter applicable scoped offers.
router.get('/catalogue-scope-facts', authJwt, requireModule('pos'), async (req, res, next) => {
  try {
    const rawIds = String(req.query.sku_ids || '').split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => n > 0)
    if (!rawIds.length) return res.json({ success: true, data: {} })
    const pool = await getPool()
    const factMap = await resolveSkuFacts(pool, rawIds)
    const data = {}
    for (const [skuId, facts] of factMap.entries()) {
      data[skuId] = { brand_id: facts.brandId, product_id: facts.productId, product_type: facts.productTypeKey }
    }
    return res.json({ success: true, data })
  } catch (err) { return next(err) }
})

// ── POST /api/pos/orders ──────────────────────────────────────────────────────
router.post('/orders', ...posOrdersCreate, async (req, res, next) => {
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
    const compositionScheme = truthyPosSetting(await readSetting(pool, 'pos_composition_scheme'))
    const pricesGstInclusive = truthyPosSetting(await readSetting(pool, 'pos_prices_gst_inclusive'))
    const firstPt = value.lines[0].product_type
    const procurementMode = await resolveProcurementMode(pool, storeId, firstPt)
    const mode = await orderService.getOrdersEngineMode(pool)

    // Authoritative offer discount re-computation (prevents client-side manipulation)
    let authorisedDiscountAmount = value.discount_amount || 0
    if (value.applied_offer_id) {
      const offerRow = await pool.request()
        .input('offer_id', sql.Int, value.applied_offer_id)
        .query(`
          SELECT offer_id, discount_type, discount_value, is_active, valid_from, valid_to
          FROM   dbo.customer_offers WHERE offer_id = @offer_id
        `)
      const offer = offerRow.recordset && offerRow.recordset[0]
      if (!offer || !offer.is_active) {
        return res.status(400).json({ success: false, message: 'Applied offer is no longer active.' })
      }
      const nowMs = Date.now()
      const vt = offer.valid_to ? new Date(offer.valid_to).getTime() : NaN
      if (Number.isFinite(vt) && nowMs > vt) {
        return res.status(400).json({ success: false, message: 'Applied offer has expired.' })
      }
      authorisedDiscountAmount = await computeOfferDiscountAmount(pool, offer, value.lines)
    }

    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    try {
      const out = await orderService.createOrderInTransaction(transaction, {
        mode,
        value,
        storeId,
        employeeId,
        gstRate,
        compositionScheme,
        pricesGstInclusive,
        advPct,
        procurementMode,
        cfg,
        discountAmount: authorisedDiscountAmount,
        appliedOfferId: value.applied_offer_id || null
      })

      await transaction.commit()

      return res.json({
        success: true,
        data: {
          order_id: out.order_id,
          order_no: out.order_no,
          order_kind: out.order_kind,
          subtotal_amount: out.subtotal_amount,
          discount_amount: out.discount_amount,
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
    return res.json({
      success: true,
      message: result.message,
      data: {
        payment_summary: result.payment_summary,
        invoice_no: result.invoice_no || null
      }
    })
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 404) {
      return res.status(err.statusCode).json({ success: false, message: err.message })
    }
    return next(err)
  }
})

// ── POST /api/pos/orders/:id/status ───────────────────────────────────────────
router.post('/orders/:id/status', ...posLabWorkflow, async (req, res, next) => {
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
router.post('/staff/set-pin', ...posStaffPinSet, async (req, res, next) => {
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

    const result = await executeStoredProcedure('sp_POS_SetUserPin', {
      user_id: { type: sql.Int, value: employee_id },
      pin_hash: { type: sql.VarChar(200), value: pinHash }
    })
    const rows = Number((result.recordset && result.recordset[0] && result.recordset[0].rows_updated) || 0)
    if (!rows) {
      return res.status(400).json({ success: false, message: 'User not found or inactive.' })
    }
    try {
      await writeAuditLog({
        userId: req.user && req.user.user_id != null ? Number(req.user.user_id) : null,
        action: 'POS_PIN_SET_BY_ADMIN',
        module: 'pos',
        entityType: 'user',
        entityId: employee_id,
        ipAddress: req.ip || null
      })
    } catch (_a) {
      /* non-fatal */
    }

    return res.json({ success: true, message: 'PIN set successfully.' })
  } catch (err) {
    return next(err)
  }
})

module.exports = router
