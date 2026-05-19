const express = require('express')
const sql     = require('mssql')
const jwt     = require('jsonwebtoken')
const Joi     = require('joi')
const bcrypt  = require('bcryptjs')
const { executeStoredProcedure, getPool } = require('../config/db')
const { authJwt }           = require('../middleware/authJwt')
const { apiKeyAuth }        = require('../middleware/apiKeyAuth')
const { requireTabletSession } = require('../middleware/requireTabletSession')
const { requireModule, requirePermission, hasPermission } = require('../middleware/authorize')
const { writeAuditLog }     = require('../services/auditService')
const { resolveProcurementMode, readSetting } = require('../services/procurementService')
const { nowUnixSec } = require('../services/jwtPolicyService')
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
/** Matches cart sidebar: promo visibility + checkout — either may preview discount math. */
const posPreviewDiscount = [authJwt, requireModule('pos'), requirePermission('pos.orders.create', 'pos.promotions.view')]
const posPaymentCollect = [authJwt, requireModule('pos'), requirePermission('pos.payment.collect')]
const posLabWorkflow = [authJwt, requireModule('pos'), requirePermission('pos.lab.workflow')]
const posStaffPinSet = [authJwt, requireModule('pos'), requirePermission('pos.staff.pin.set')]

function canBypassLabOrderSiblingGuardPos(req) {
  return hasPermission(req, 'foundry.lab.bypass_order_sibling')
    || hasPermission(req, 'command_unit.lab.bypass_order_sibling')
    || hasPermission(req, 'storepilot.lab.bypass_order_sibling')
    || hasPermission(req, 'pos.lab.bypass_order_sibling')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function truthyPosSetting(val) {
  const s = String(val ?? '').trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes'
}

/** Validates POS JWT store context; rejects non-finite or missing IDs. */
function posJwtStoreIdOr400(req, res) {
  const sid = Number(req.user && req.user.store_id)
  if (!Number.isFinite(sid) || sid < 1) {
    res.status(400).json({ success: false, message: 'Invalid or missing store_id in session token.' })
    return null
  }
  return sid
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

/** True when DB procs are missing @brand / @product_type or not redeployed. */
function isLikelyMissingCatalogueFilterSupportError(err) {
  const m = String((err && err.message) || (err && err.originalError && err.originalError.message) || err || '').toLowerCase()
  return (
    m.includes('too many arguments') ||
    m.includes('could not find stored procedure') ||
    m.includes('invalid object name') ||
    m.includes('cataloguebrands') ||
    m.includes('catalogueproducttypes') ||
    (m.includes('parameter') && (
      m.includes('brand') ||
      m.includes('@brand') ||
      m.includes('product_type') ||
      m.includes('@product_type')
    ))
  )
}

async function fetchCatalogueRowsWithFilters(procName, store_id, q, brandParam, productTypeParam) {
  const base = {
    store_id: { type: sql.Int, value: store_id },
    q: { type: sql.NVarChar(200), value: q }
  }
  const extra = {}
  if (brandParam) {
    extra.brand = { type: sql.NVarChar(2000), value: brandParam }
  }
  if (productTypeParam) {
    extra.product_type = { type: sql.NVarChar(400), value: productTypeParam }
  }
  const hasFilter = Boolean(brandParam || productTypeParam)
  if (!hasFilter) {
    const result = await executeStoredProcedure(procName, base)
    return result.recordset || []
  }
  try {
    const result = await executeStoredProcedure(procName, Object.assign({}, base, extra))
    return result.recordset || []
  } catch (err) {
    if (!isLikelyMissingCatalogueFilterSupportError(err)) throw err
    const result = await executeStoredProcedure(procName, base)
    let rows = result.recordset || []
    if (brandParam) {
      const set = new Set(String(brandParam).split(',').map((s) => String(s || '').trim().toLowerCase()).filter(Boolean))
      rows = rows.filter((r) => set.has(String(r.brand_name || '').trim().toLowerCase()))
    }
    if (productTypeParam) {
      const set = new Set(String(productTypeParam).split(',').map((s) => String(s || '').trim().toLowerCase()).filter(Boolean))
      rows = rows.filter((r) => set.has(String(r.product_type || '').trim().toLowerCase()))
    }
    return rows
  }
}

function mapCatalogueProductTypeRows(recordset) {
  return (recordset || []).map((r) => ({
    key: String(r.lookup_key || '').trim().toUpperCase(),
    label: String(r.lookup_label || '').trim() || String(r.lookup_key || '').trim()
  })).filter((r) => r.key)
}

async function fetchCatalogueProductTypesRecordset(store_id, scopeKey) {
  const result = await executeStoredProcedure('sp_POS_CatalogueProductTypes', {
    store_id: { type: sql.Int, value: store_id },
    scope: { type: sql.NVarChar(20), value: scopeKey }
  })
  return result.recordset || []
}

async function getCatalogueProductTypesForScope(store_id, scopeKey) {
  const recordset = await fetchCatalogueProductTypesRecordset(store_id, scopeKey)
  return mapCatalogueProductTypeRows(recordset)
}

async function getCatalogueProductTypeKeySet(store_id, scopeKey) {
  const rows = await getCatalogueProductTypesForScope(store_id, scopeKey)
  return new Set(rows.map((r) => r.key))
}

/** Normalize ?product_type= (comma-separated and/or repeated) to unique uppercase keys. */
function parseCatalogueProductTypeQuery(query) {
  const raw = query.product_type
  if (raw == null || raw === '') return []
  const segments = Array.isArray(raw) ? raw : [raw]
  const out = []
  const seen = new Set()
  for (const seg of segments) {
    const parts = String(seg || '').split(',')
    for (const p of parts) {
      const u = String(p || '').trim().toUpperCase()
      if (!u || seen.has(u)) continue
      seen.add(u)
      out.push(u)
    }
  }
  return out
}

/** Normalize ?brand= (comma-separated and/or repeated) to unique trimmed display names (casing preserved per segment). */
function parseCatalogueBrandQuery(query) {
  const raw = query.brand
  if (raw == null || raw === '') return []
  const segments = Array.isArray(raw) ? raw : [raw]
  const out = []
  const seen = new Set()
  for (const seg of segments) {
    for (const part of String(seg || '').split(',')) {
      const t = String(part || '').trim()
      if (!t) continue
      const k = t.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      out.push(t)
    }
  }
  return out
}

const MAX_CATALOGUE_BRAND_CSV = 2000

/**
 * Resolve requested brand filters to canonical CSV for SP (each name must appear in catalogue-brands for scope).
 * @returns {{ csv: string|null }} or {{ error: string }}
 */
async function resolveCatalogueBrandCsv(storeId, scopeNorm, query) {
  const list = parseCatalogueBrandQuery(query)
  if (!list.length) return { csv: null }
  const names = await fetchCatalogueBrandNames(storeId, scopeNorm)
  const canonByLower = new Map()
  for (const n of names) {
    const nm = String(n || '').trim()
    if (!nm) continue
    const k = nm.toLowerCase()
    if (!canonByLower.has(k)) canonByLower.set(k, nm)
  }
  const resolved = []
  const seen = new Set()
  for (const raw of list) {
    const k = String(raw || '').trim().toLowerCase()
    if (!k || seen.has(k)) continue
    const c = canonByLower.get(k)
    if (!c) return { error: 'Invalid brand filter' }
    seen.add(k)
    resolved.push(c)
  }
  const csv = resolved.join(',')
  if (csv.length > MAX_CATALOGUE_BRAND_CSV) return { error: 'Brand filter too long' }
  return { csv }
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
    if (!isLikelyMissingCatalogueFilterSupportError(err)) throw err
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

/** Strip non-digits; drop leading 91 or trunk 0 — expect 10-digit Indian mobile (starts 6–9). */
function normalizeIndiaMobileDigits(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return d
}

const customerCreateSchema = Joi.object({
  full_name:     Joi.string().min(1).max(200).required(),
  phone:         Joi.string().min(1).max(30).required(),
  email:         Joi.string().max(200).allow(null, '').optional(),
  home_store_id: Joi.number().integer().positive().allow(null)
})

const posOrderLineItemSchema = Joi.object({
  sku_id:       Joi.number().integer().positive().required(),
  qty:          Joi.number().integer().positive().required(),
  unit_price:   Joi.number().min(0).required(),
  product_type: Joi.string().max(50).required(),
  fulfillment:  Joi.string().valid('INSTANT', 'LAB').required(),
  line_key:     Joi.string().max(300).required(),
  /** Present for LAB lines from POS cart — required for BOGO / structured offer preview (cartPreview). */
  lab_status:   Joi.string().max(40).allow(null, '').optional(),
  lens_bundle: Joi.object({
    package_id: Joi.number().integer().positive().required(),
    category_id: Joi.number().integer().positive().allow(null),
    addon_ids: Joi.array().items(Joi.number().integer().positive()).default([]),
    package_price: Joi.number().min(0).default(0),
    addon_prices: Joi.array().items(Joi.number().min(0)).default([])
  }).allow(null).optional(),
  /** Optional: groups frame+lens pairs on one bill (server defaults by line index). */
  pair_index: Joi.number().integer().min(1).optional(),
  /** Required when product type has requires_unit_barcode (7-digit unit scan). */
  unit_id: Joi.number().integer().positive().optional()
})

const createOrderSchema = Joi.object({
  customer_id:      Joi.number().integer().positive().allow(null),
  order_source:     Joi.string().max(20).default('POS'),
  rx_snapshot:      Joi.object().allow(null),
  discount_amount:  Joi.number().min(0).default(0),
  applied_offer_id: Joi.number().integer().positive().allow(null),
  /** When false (default), stock is deducted in createOrderInTransaction. When true, deduction runs on full payment via commitInventoryForPaidOrder. */
  inventory_deferred: Joi.boolean().default(false),
  lines: Joi.array().items(posOrderLineItemSchema).min(1).required()
})

const checkoutDraftSchema = Joi.object({
  cart_json: Joi.alternatives().try(Joi.array(), Joi.object(), Joi.string()).required(),
  checkout_stage: Joi.number().integer().min(1).max(7).default(5),
  delivery_mode: Joi.string().valid('STORE', 'HOME').allow(null, ''),
  customer_id: Joi.number().integer().positive().allow(null)
})

const previewOrderDiscountSchema = Joi.object({
  lines: Joi.array().items(posOrderLineItemSchema).min(1).required(),
  /** When omitted or null — no Eyewoot Go offer discount (staff must pick one offer explicitly). */
  applied_offer_id: Joi.number().integer().positive().allow(null)
})

const paymentSchema = Joi.object({
  order_id:      Joi.number().integer().positive().required(),
  stage:         Joi.string().valid('ADVANCE', 'BALANCE', 'FULL').required(),
  method:        Joi.string().max(20).required(),
  amount:        Joi.number().min(0).required(),
  tendered:      Joi.number().min(0).allow(null),
  change_given:  Joi.number().min(0).allow(null),
  external_ref:  Joi.string().max(200).allow('', null)
})

const orderStatusSchema = Joi.object({
  sub_order_id: Joi.number().integer().positive().required(),
  to_status:    Joi.string().max(30).required(),
  note:         Joi.string().max(500).allow('', null),
  bypass_order_sibling_guard: Joi.boolean().default(false),
  bypass_reason: Joi.string().max(200).allow('', null)
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
    allow_qty_gt_1: Boolean(r.allow_qty_gt_1),
    lens_wizard_policy: String(r.lens_wizard_policy || 'NEVER'),
    requires_unit_barcode: r.requires_unit_barcode !== false && r.requires_unit_barcode !== 0
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

function buildLensCatalogPayload(result, productTypeKey) {
  const rs = result.recordsets || []
  const categories = rs[0] || []
  const packages = rs[1] || []
  const addons = rs[2] || []
  const links = rs[3] || []
  // RS4: single row with lens_wizard_policy (may be empty if no product_type passed)
  const policyRow = (rs[4] || [])[0] || null
  // RS5: allow-list bridge rows [{lens_category_id, sort_order}]
  const allowList = rs[5] || []

  const addonById = new Map()
  for (const a of addons) {
    addonById.set(a.id, {
      id: a.id,
      name: posLensPublicLabel(a.pos_brand, a.pos_name, a.name),
      price: Number(a.price) || 0,
      sort_order: Number(a.sort_order) || 0
    })
  }

  // Track which category ids have at least one active package (for wizard filter)
  const catIdsWithPackages = new Set(packages.map((p) => p.category_id))

  const outCategories = categories.map((c) => {
    const pkgs = packages
      .filter((p) => p.category_id === c.id)
      .map((p) => {
        const allowedIds = links.filter((l) => l.package_id === p.id).map((l) => l.addon_id)
        const pkgAddons = allowedIds
          .map((id) => addonById.get(id))
          .filter(Boolean)
          .sort((x, y) => (x.sort_order - y.sort_order) || x.id - y.id)
        const brandLabel = String(p.pos_brand || '').trim() || 'Other'
        return {
          id: p.id,
          name: posLensPublicLabel(p.pos_brand, p.pos_name, p.name),
          brand_label: brandLabel,
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
      show_in_pos_wizard: c.show_in_pos_wizard !== false && c.show_in_pos_wizard !== 0,
      wizard_subtitle: String(c.wizard_subtitle || ''),
      wizard_icon: String(c.wizard_icon || ''),
      wizard_tone: Number(c.wizard_tone) || 1,
      packages: pkgs
    }
  })

  const addonList = Array.from(addonById.values()).sort((a, b) => (a.sort_order - b.sort_order) || a.id - b.id)

  // ── Build wizard_entries ──────────────────────────────────────────────────
  const policy = policyRow ? String(policyRow.lens_wizard_policy || 'NEVER') : 'OPTIONAL'
  const wizardEntries = []

  if (policy !== 'NEVER') {
    // Base: categories with show_in_pos_wizard=1 AND has packages
    let eligibleCats = outCategories.filter((c) =>
      c.show_in_pos_wizard && catIdsWithPackages.has(c.id)
    )

    if (allowList.length > 0) {
      // Apply allow-list: only include categories in bridge, in bridge sort order
      const allowSet = new Map(allowList.map((r) => [Number(r.lens_category_id), Number(r.sort_order)]))
      eligibleCats = eligibleCats
        .filter((c) => allowSet.has(c.id))
        .sort((a, b) => (allowSet.get(a.id) - allowSet.get(b.id)) || a.id - b.id)
    }

    for (const c of eligibleCats) {
      wizardEntries.push({
        kind: 'category',
        category_id: c.id,
        title: c.name,
        subtitle: c.wizard_subtitle,
        icon: c.wizard_icon,
        tone: c.wizard_tone
      })
    }

    // Frame only is always last for OPTIONAL
    const ptUpper = String(productTypeKey || '').trim().toUpperCase()
    if (ptUpper === 'SUNGLASSES') {
      wizardEntries.push({
        kind: 'frame_sunglasses',
        title: 'Frame / Sunglasses',
        subtitle: 'Sun pair without prescription lens package',
        icon: '🕶',
        tone: 2
      })
    }
    if (policy === 'OPTIONAL') {
      wizardEntries.push({
        kind: 'frame_only',
        title: 'Frame Only',
        subtitle: 'No lenses required',
        icon: '⬜',
        tone: 0
      })
    }
  }

  return { categories: outCategories, addons: addonList, wizard_entries: wizardEntries, lens_wizard_policy: policy }
}

// ── POST /api/pos/tablet-login ────────────────────────────────────────────────
// Public + API key. Unlocks a physical tablet; returns tablet JWT (X-Tablet-Token), persisted on device.
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

    const tabSessionVer = Math.max(0, Math.floor(Number(tab.tablet_session_version)) || 0)
    const tabletJwtExpires = String(process.env.POS_TABLET_JWT_EXPIRES || '365d').trim() || '365d'

    const token = jwt.sign(
      {
        tablet_session: true,
        tablet_id: tab.tablet_id,
        store_id: tab.store_id,
        device_name: String(tab.device_name || ''),
        tablet_session_version: tabSessionVer,
        token_issued_at: nowUnixSec()
      },
      process.env.JWT_SECRET,
      { expiresIn: tabletJwtExpires }
    )

    return res.json({
      success: true,
      data: {
        token,
        tablet_id: tab.tablet_id,
        store_id: tab.store_id,
        device_name: tab.device_name,
        tablet_session_version: tabSessionVer
      }
    })
  } catch (err) {
    return next(err)
  }
})

// ── GET /api/pos/tablet-session ────────────────────────────────────────────────
// API key + tablet JWT. Lightweight ping — same tablet validity as staff-login.
router.get('/tablet-session', apiKeyAuth, requireTabletSession, (req, res) => {
  res.json({
    success: true,
    data: {
      tablet_id: req.tablet.tablet_id,
      store_id: req.tablet.store_id,
      device_name: req.tablet.device_name || ''
    }
  })
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
      store_id: storeId,
      can_initiate_refund: canRefund,
      can_view_reports: Boolean(matched.can_view_reports),
      can_manage_staff: Boolean(matched.can_manage_staff),
      permissions,
      modules: { pos: true },
      token_issued_at: nowUnixSec()
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
        store_id: storeId,
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
//   brand         = optional, multi: comma-separated and/or repeated display names (each must be in GET /catalogue-brands)
//   product_type  = optional, multi: comma-separated and/or repeated; each key must be in GET /catalogue-product-types
router.get('/catalogue', ...posCatalogue, async (req, res, next) => {
  try {
    const scope    = (req.query.scope || 'store').toLowerCase()
    const store_id = posJwtStoreIdOr400(req, res)
    if (store_id == null) return

    const q        = (req.query.q || '').trim() || null
    const ptList = parseCatalogueProductTypeQuery(req.query)
    const scopeNorm = scope === 'global' ? 'global' : 'store'
    const brandResolved = await resolveCatalogueBrandCsv(store_id, scopeNorm, req.query)
    if (brandResolved.error) {
      return res.status(400).json({ success: false, message: brandResolved.error })
    }
    const brandParam = brandResolved.csv
    let productTypeParam = null
    if (ptList.length) {
      const allow = await getCatalogueProductTypeKeySet(store_id, scopeNorm)
      for (let i = 0; i < ptList.length; i++) {
        if (!allow.has(ptList[i])) {
          return res.status(400).json({ success: false, message: 'Invalid product_type filter' })
        }
      }
      productTypeParam = ptList.join(',')
    }

    const procName = scope === 'global' ? 'sp_POS_GlobalCatalogue' : 'sp_POS_StoreCatalogue'

    const rows = await fetchCatalogueRowsWithFilters(procName, store_id, q, brandParam, productTypeParam)
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
    const store_id = posJwtStoreIdOr400(req, res)
    if (store_id == null) return

    const names = await fetchCatalogueBrandNames(store_id, scope)

    return res.json({ success: true, data: names })
  } catch (err) {
    return next(err)
  }
})

// ── GET /api/pos/catalogue-product-types ──────────────────────────────────────
// Product types that exist in the catalogue for this store + scope (labels from Purchase lookups when matched).
router.get('/catalogue-product-types', ...posCatalogue, async (req, res, next) => {
  try {
    const scope    = (req.query.scope || 'store').toLowerCase() === 'global' ? 'global' : 'store'
    const store_id = posJwtStoreIdOr400(req, res)
    if (store_id == null) return

    const rows = await getCatalogueProductTypesForScope(store_id, scope)
    return res.json({ success: true, data: rows })
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

// ── GET /api/pos/unit-lookup?q=0010447 ────────────────────────────────────────
router.get('/unit-lookup', ...posCatalogue, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim()
    if (!q) {
      return res.status(400).json({ success: false, message: 'q param required' })
    }
    const storeId = posJwtStoreIdOr400(req, res)
    if (storeId == null) return
    const result = await executeStoredProcedure('sp_SKU_LookupUnitByBarcode', {
      unit_barcode: { type: sql.VarChar(20), value: q },
      store_id: { type: sql.Int, value: storeId }
    })
    const row = result.recordset && result.recordset[0]
    if (!row) {
      return res.status(404).json({ success: false, message: 'Unit barcode not found' })
    }
    if (String(row.status || '').toUpperCase() !== 'AVAILABLE') {
      return res.status(409).json({ success: false, message: 'This unit is not available for sale.' })
    }
    return res.json({ success: true, data: row })
  } catch (err) {
    if (err.code === 'EREQUEST') {
      return res.status(400).json({ success: false, message: err.message })
    }
    return next(err)
  }
})

// ── GET /api/pos/lens-catalog ─────────────────────────────────────────────────
// Optional ?product_type=FRAMES (normalized uppercase) to filter wizard_entries
// by lens_wizard_policy + per-product-type allow-list.
router.get('/lens-catalog', ...posCatalogue, async (req, res, next) => {
  try {
    const raw = String(req.query.product_type || '').trim().toUpperCase()
    const ptKey = raw || null
    const result = await executeStoredProcedure('sp_POS_GetLensCatalog', {
      product_type_key: { type: sql.NVarChar(100), value: ptKey }
    })
    const data = buildLensCatalogPayload(result, ptKey)
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

/**
 * Active Eyewoot Go offers for POS + scope rows (for client PCT/FLAT preview).
 * @param {import('mssql').ConnectionPool} pool
 * @param {number|null} customerId
 */
async function fetchEligibleCartOffersForPos(pool, customerId) {
  const nowIST = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T')

  const r = await pool.request().input('now', nowIST).query(`
    SELECT offer_id, title, description, icon_emoji, discount_type,
           discount_value, trigger_type, trigger_value, benefit_target, max_discount_amount, scope_mode,
           valid_from, valid_to, eligible_tier,
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
  } else {
    // Walk-in: no customer context — hide Plus-only and tier-gated offers (same as Eyewoot Go expectations).
    rows = rows.filter((o) => {
      if (o.is_plus_only) return false
      const et = o.eligible_tier != null ? String(o.eligible_tier).trim() : ''
      if (et) return false
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

  const ids = normalized.map((o) => o.offer_id).filter((id) => Number.isFinite(Number(id)) && Number(id) > 0)
  const scopesByOffer = {}
  if (ids.length) {
    const sr = await pool.request().query(`
      SELECT offer_id, scope_kind, ref_int, ref_key, is_exclusion
      FROM   dbo.customer_offer_scope
      WHERE  offer_id IN (${ids.join(',')})
    `)
    for (const row of sr.recordset || []) {
      const oid = Number(row.offer_id)
      if (!scopesByOffer[oid]) scopesByOffer[oid] = []
      scopesByOffer[oid].push({
        kind: row.scope_kind,
        ref_int: row.ref_int != null ? Number(row.ref_int) : null,
        ref_key: row.ref_key != null ? String(row.ref_key) : null,
        is_exclusion: Boolean(row.is_exclusion)
      })
    }
  }

  return normalized.map((row) => ({
    ...row,
    scopes: scopesByOffer[row.offer_id] || []
  }))
}

// ── GET /api/pos/cart-offers — active Eyewoot Go offers for POS cart sidebar ───
// Optional ?customer_id= — when set, applies same Plus / tier filters as the customer app.
router.get('/cart-offers', ...posPromotions, async (req, res, next) => {
  try {
    const pool = await getPool()
    const rawId = req.query.customer_id
    const customerId = rawId != null && String(rawId).trim() !== ''
      ? parseInt(String(rawId), 10)
      : null
    const data = await fetchEligibleCartOffersForPos(pool, customerId)
    return res.json({ success: true, data })
  } catch (err) {
    return next(err)
  }
})

// ── POST /api/pos/preview-order-discount — selected offer or chooser candidates ───
router.post('/preview-order-discount', ...posPreviewDiscount, async (req, res, next) => {
  try {
    const { error, value } = previewOrderDiscountSchema.validate(req.body || {}, {
      allowUnknown: false,
      stripUnknown: true
    })
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      })
    }

    const pool = await getPool()
    const rawId = req.query.customer_id
    const customerId = rawId != null && String(rawId).trim() !== ''
      ? parseInt(String(rawId), 10)
      : null

    const selRaw = value.applied_offer_id
    const selectedId = selRaw != null && selRaw !== '' ? Number(selRaw) : null
    if (!Number.isFinite(selectedId) || selectedId < 1) {
      const candidates = []
      for (const offer of offers) {
        const offerRowRes = await pool.request()
          .input('offer_id', sql.Int, offer.offer_id)
          .query(`
            SELECT offer_id, discount_type, discount_value, trigger_type, trigger_value, benefit_target, max_discount_amount
            FROM   dbo.customer_offers
            WHERE  offer_id = @offer_id AND is_active = 1
          `)
        const offerRow = offerRowRes.recordset && offerRowRes.recordset[0]
        if (!offerRow) continue
        const amt = await computeOfferDiscountAmount(pool, offerRow, value.lines, { cartPreview: true })
        const discountAmt = typeof amt === 'number' && Number.isFinite(amt) ? Math.max(0, amt) : 0
        if (discountAmt > 0) {
          candidates.push({
            offer_id: Number(offer.offer_id),
            title: String(offer.title || ''),
            pos_label: String(offer.pos_label || offer.title || ''),
            discount_amount: discountAmt
          })
        }
      }
      candidates.sort((a, b) => b.discount_amount - a.discount_amount || a.offer_id - b.offer_id)
      return res.json({
        success: true,
        data: {
          discount_amount: 0,
          applied_offer_id: null,
          requires_selection: candidates.length > 1,
          candidates
        }
      })
    }

    const offers = await fetchEligibleCartOffersForPos(pool, customerId)
    const match = offers.find((o) => Number(o.offer_id) === Number(selectedId))
    if (!match) {
      return res.status(400).json({
        success: false,
        message: 'Selected offer is not available for this customer or cart. Pick another offer or clear the selection.'
      })
    }

    const offerRowRes = await pool.request()
      .input('offer_id', sql.Int, selectedId)
      .query(`
        SELECT offer_id, discount_type, discount_value, trigger_type, trigger_value, benefit_target, max_discount_amount
        FROM   dbo.customer_offers
        WHERE  offer_id = @offer_id AND is_active = 1
      `)
    const offerRow = offerRowRes.recordset && offerRowRes.recordset[0]
    if (!offerRow) {
      return res.status(400).json({
        success: false,
        message: 'Selected offer is no longer active. Refresh offers and try again.'
      })
    }

    const amt = await computeOfferDiscountAmount(pool, offerRow, value.lines, { cartPreview: true })
    const numAmt = typeof amt === 'number' && Number.isFinite(amt) ? Math.max(0, amt) : 0

    return res.json({
      success: true,
      data: { discount_amount: numAmt, applied_offer_id: selectedId }
    })
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
      const parts = error.details.map((d) => d.message)
      return res.status(400).json({
        success: false,
        message: parts.join(' ') || 'Validation error',
        errors: parts
      })
    }
    const phoneNorm = normalizeIndiaMobileDigits(value.phone)
    if (!/^[6-9]\d{9}$/.test(phoneNorm)) {
      return res.status(400).json({
        success: false,
        message: 'Phone must be a valid 10-digit Indian mobile (optional +91 or leading 0).'
      })
    }
    value.phone = phoneNorm
    const homeRaw = Number(req.user && req.user.store_id)
    const homeFallback = Number.isFinite(homeRaw) && homeRaw > 0 ? homeRaw : null
    const homeStore = value.home_store_id != null ? value.home_store_id : homeFallback
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
    const storeId = posJwtStoreIdOr400(req, res)
    if (storeId == null) return

    const search = (req.query.q || '').trim() || null
    const statusFilter = (req.query.status || '').trim() || null
    if (String(statusFilter || '').toUpperCase() === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Completed orders are not listed on Store OS. Open CX › Dashboard and use Completed orders.'
      })
    }

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
      labStatusExcludes,
      excludeOrderStatuses: statusFilter ? [] : ['COMPLETED']
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
    const storeId = posJwtStoreIdOr400(req, res)
    if (storeId == null) return
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
        customer: bundle.customer || null,
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
  const storeId = posJwtStoreIdOr400(req, res)
  if (storeId == null) return

  const employeeId = req.user.employee_id
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
    if (!value.applied_offer_id) {
      const offers = await fetchEligibleCartOffersForPos(pool, value.customer_id || null)
      let qualifying = 0
      for (const offer of offers) {
        const offerRow = await pool.request()
          .input('offer_id', sql.Int, offer.offer_id)
          .query(`
            SELECT offer_id, discount_type, discount_value, trigger_type, trigger_value, benefit_target, max_discount_amount
            FROM   dbo.customer_offers WHERE offer_id = @offer_id
          `)
        const row = offerRow.recordset && offerRow.recordset[0]
        if (!row || !row.offer_id) continue
        const amt = await computeOfferDiscountAmount(pool, row, value.lines, { cartPreview: false })
        if (Number(amt) > 0) qualifying += 1
        if (qualifying > 1) {
          return res.status(400).json({
            success: false,
            message: 'Multiple offers qualify. Cashier must select one offer before checkout.'
          })
        }
      }
    }
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
      authorisedDiscountAmount = await computeOfferDiscountAmount(pool, offer, value.lines, { cartPreview: false })
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
        appliedOfferId: value.applied_offer_id || null,
        inventoryDeferred: Boolean(value.inventory_deferred)
      })

      await transaction.commit()

      if (value.applied_offer_id && Number(authorisedDiscountAmount) > 0) {
        try {
          await pool.request()
            .input('offer_id', sql.Int, Number(value.applied_offer_id))
            .input('order_id', sql.Int, Number(out.order_id))
            .input('order_no', sql.NVarChar(80), String(out.order_no || ''))
            .input('store_id', sql.Int, Number(storeId))
            .input('cashier_user_id', sql.Int, Number(employeeId))
            .input('customer_id', sql.Int, value.customer_id || null)
            .input('discount_amount', sql.Decimal(12, 2), Number(authorisedDiscountAmount) || 0)
            .input('sale_amount', sql.Decimal(12, 2), Number(out.total_amount) || 0)
            .query(`
              IF OBJECT_ID('dbo.sp_RecordOfferUsage', 'P') IS NOT NULL
              BEGIN
                EXEC dbo.sp_RecordOfferUsage
                  @offer_id=@offer_id, @order_id=@order_id, @order_no=@order_no, @store_id=@store_id,
                  @cashier_user_id=@cashier_user_id, @customer_id=@customer_id,
                  @discount_amount=@discount_amount, @sale_amount=@sale_amount
              END
            `)
        } catch (_usageErr) {
          // non-fatal for checkout
        }
      }

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
    if (err.message && (err.message.includes('inventory_committed') || err.message.includes('Invalid column name'))) {
      return res.status(503).json({
        success: false,
        message: 'Database migration required: run sql/migrations/pos_checkout_inventory_drafts.sql (inventory_committed on orders).'
      })
    }
    return next(err)
  }
})

// ── POST /api/pos/checkout-draft — persist cart for resume (one row per staff + store) ──
router.post('/checkout-draft', ...posOrdersCreate, async (req, res, next) => {
  try {
    const storeId = posJwtStoreIdOr400(req, res)
    if (storeId == null) return
    const { error, value } = checkoutDraftSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      })
    }
    const employeeId = req.user.employee_id
    if (employeeId == null || !Number.isFinite(Number(employeeId))) {
      return res.status(400).json({ success: false, message: 'Staff context required to save a draft.' })
    }
    const cartStr = typeof value.cart_json === 'string' ? value.cart_json : JSON.stringify(value.cart_json)
    const pool = await getPool()
    await pool.request()
      .input('store_id', sql.Int, storeId)
      .input('staff_user_id', sql.Int, Number(employeeId))
      .query('DELETE FROM dbo.pos_checkout_drafts WHERE store_id = @store_id AND staff_user_id = @staff_user_id')
    await pool.request()
      .input('store_id', sql.Int, storeId)
      .input('staff_user_id', sql.Int, Number(employeeId))
      .input('cart_json', sql.NVarChar(sql.MAX), cartStr)
      .input('checkout_stage', sql.TinyInt, value.checkout_stage || 5)
      .input('delivery_mode', sql.NVarChar(20), value.delivery_mode ? String(value.delivery_mode).toUpperCase() : null)
      .input('customer_id', sql.Int, value.customer_id || null)
      .query(`
        INSERT INTO dbo.pos_checkout_drafts (store_id, staff_user_id, cart_json, checkout_stage, delivery_mode, customer_id)
        VALUES (@store_id, @staff_user_id, @cart_json, @checkout_stage, @delivery_mode, @customer_id)
      `)
    return res.json({ success: true, data: { saved: true } })
  } catch (err) {
    if (err.message && err.message.includes('pos_checkout_drafts')) {
      return res.status(503).json({
        success: false,
        message: 'Draft table missing. Run sql/migrations/pos_checkout_inventory_drafts.sql on the database.'
      })
    }
    return next(err)
  }
})

// ── GET /api/pos/checkout-draft — latest draft for current staff + store ─────
router.get('/checkout-draft', ...posOrdersCreate, async (req, res, next) => {
  try {
    const storeId = posJwtStoreIdOr400(req, res)
    if (storeId == null) return
    const employeeId = req.user.employee_id
    if (employeeId == null || !Number.isFinite(Number(employeeId))) {
      return res.json({ success: true, data: { draft: null } })
    }
    const pool = await getPool()
    const r = await pool.request()
      .input('store_id', sql.Int, storeId)
      .input('staff_user_id', sql.Int, Number(employeeId))
      .query(`
        SELECT TOP 1 draft_id, cart_json, checkout_stage, delivery_mode, customer_id, updated_at
        FROM dbo.pos_checkout_drafts
        WHERE store_id = @store_id AND staff_user_id = @staff_user_id
        ORDER BY updated_at DESC
      `)
    const row = r.recordset && r.recordset[0]
    if (!row) return res.json({ success: true, data: { draft: null } })
    let parsed = row.cart_json
    try {
      parsed = JSON.parse(String(row.cart_json || '[]'))
    } catch (_e) {
      parsed = []
    }
    return res.json({
      success: true,
      data: {
        draft: {
          draft_id: row.draft_id,
          cart: parsed,
          checkout_stage: row.checkout_stage,
          delivery_mode: row.delivery_mode,
          customer_id: row.customer_id,
          updated_at: row.updated_at
        }
      }
    })
  } catch (err) {
    if (err.message && err.message.includes('pos_checkout_drafts')) {
      return res.json({ success: true, data: { draft: null } })
    }
    return next(err)
  }
})

// ── DELETE /api/pos/checkout-draft — clear draft for current staff + store ───
router.delete('/checkout-draft', ...posOrdersCreate, async (req, res, next) => {
  try {
    const storeId = posJwtStoreIdOr400(req, res)
    if (storeId == null) return
    const employeeId = req.user.employee_id
    if (employeeId == null || !Number.isFinite(Number(employeeId))) {
      return res.json({ success: true, data: { deleted: 0 } })
    }
    const pool = await getPool()
    const r = await pool.request()
      .input('store_id', sql.Int, storeId)
      .input('staff_user_id', sql.Int, Number(employeeId))
      .query(`
        DELETE FROM dbo.pos_checkout_drafts
        OUTPUT DELETED.draft_id
        WHERE store_id = @store_id AND staff_user_id = @staff_user_id
      `)
    const n = (r.recordset || []).length
    return res.json({ success: true, data: { deleted: n } })
  } catch (err) {
    if (err.message && err.message.includes('pos_checkout_drafts')) {
      return res.json({ success: true, data: { deleted: 0 } })
    }
    return next(err)
  }
})

// ── POST /api/pos/payment ─────────────────────────────────────────────────────
router.post('/payment', posPaymentCollect, async (req, res, next) => {
  try {
    const { error, value } = paymentSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      })
    }
    const storeId = posJwtStoreIdOr400(req, res)
    if (storeId == null) return

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
    const storeId = posJwtStoreIdOr400(req, res)
    if (storeId == null) return

    const bypassSibling = value.bypass_order_sibling_guard === true
    if (bypassSibling && !canBypassLabOrderSiblingGuardPos(req)) {
      return res.status(403).json({ success: false, message: 'Permission denied for pair-guard bypass.' })
    }

    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const employeeId = req.user.employee_id
    const actorRole = 'store_in_charge'
    const out = await orderService.updateLabSubOrderStatus(pool, mode, executeStoredProcedure, {
      orderId,
      storeId,
      employeeId,
      actorRole,
      subOrderId: value.sub_order_id,
      toStatus: value.to_status,
      note: value.note,
      allowCrossStoreLab: false,
      bypassOrderSiblingGuard: bypassSibling,
      bypassReason: value.bypass_reason || null
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
