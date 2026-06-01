const express = require('express')
const sql     = require('mssql')
const jwt     = require('jsonwebtoken')
const Joi     = require('joi')
const bcrypt  = require('bcryptjs')
const { executeStoredProcedure, getPool } = require('../config/db')
const { authJwt }           = require('../middleware/authJwt')
const { apiKeyAuth }        = require('../middleware/apiKeyAuth')
const { requireTabletSession } = require('../middleware/requireTabletSession')
const { requireModule, requirePermission, requireAnyModule, hasPermission, isSuperAdmin } = require('../middleware/authorize')
const { writeAuditLog }     = require('../services/auditService')
const { resolveProcurementMode, readSetting } = require('../services/procurementService')
const { nowUnixSec } = require('../services/jwtPolicyService')
const orderService = require('../services/orderService')
const { labCallerFromReq } = require('../services/labWorkflowAuth')
const {
  POS_ORDER_QUEUE_KEYS,
  POS_ORDER_QUEUE_TABS,
  resolveQueueFetchOptions
} = require('../config/posOrderQueueCatalog')
const { resolveSkuFacts, computeOfferDiscountAmount } = require('../services/customerOfferDiscountService')
const {
  grantCustomerMembership,
  resolveMembershipSaleAmount
} = require('../services/membershipGrantService')
const { wallClockIso } = require('../lib/cosmosIst')
const { parseIndiaMobileForSave } = require('../lib/indiaMobile')
const posCustomerRegister = require('../services/posCustomerRegisterService')
const {
  resolveMembershipForCustomer,
  getMembershipFamilyForCustomer,
  addDependent: addMembershipDependent,
  removeDependent: removeMembershipDependent
} = require('../services/membershipDependentService')
const { isValidMembershipDependentRelationship } = require('../config/membershipDependentRelationshipsCatalog')
const {
  isPosSchemaMigrationSqlError,
  posSchemaMigrationHttpBody
} = require('../config/posSchemaMigrationHints')

const router = express.Router()

function respondPosSchemaMigrationIfNeeded(err, res) {
  if (!isPosSchemaMigrationSqlError(err)) return false
  const mapped = posSchemaMigrationHttpBody()
  return res.status(mapped.status).json(mapped.body)
}

/** POS tablet JWT — same requirePermission as staff login pipeline (role_permissions → JWT.permissions). */
const posCatalogue = [authJwt, requireModule('pos'), requirePermission('pos.catalogue.view')]
const posPromotions = [authJwt, requireModule('pos'), requirePermission('pos.promotions.view')]
const posCustomersView = [authJwt, requireModule('pos'), requirePermission('pos.customers.view')]
const posCustomersCreate = [authJwt, requireModule('pos'), requirePermission('pos.customers.create')]
const posOrdersView = [authJwt, requireModule('pos'), requirePermission('pos.orders.view')]
const posOrdersCreate = [authJwt, requireModule('pos'), requirePermission('pos.orders.create')]
const posOrdersVoidUnpaid = [authJwt, requireModule('pos'), requirePermission('pos.orders.void_unpaid', 'pos.orders.create')]
/** Matches cart sidebar: promo visibility + checkout — either may preview discount math. */
const posPreviewDiscount = [authJwt, requireModule('pos'), requirePermission('pos.orders.create', 'pos.promotions.view')]
const posPaymentCollect = [authJwt, requireModule('pos'), requirePermission('pos.payment.collect')]
/** Atomic first payment + order insert (Store OS checkout). */
const posCheckoutAndPay = [authJwt, requireModule('pos'), requirePermission('pos.orders.create', 'pos.payment.collect')]
const posMembershipSell = [authJwt, requireModule('pos'), requirePermission('pos.membership.sell')]
const posMembershipDependents = [
  authJwt,
  requireModule('pos'),
  requirePermission('pos.membership.dependents.manage')
]
const posMembershipFamilyView = [
  authJwt,
  requireModule('pos'),
  requirePermission('pos.membership.sell', 'pos.membership.dependents.manage')
]
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
function posActorUserId(req) {
  const raw = req.user && (req.user.user_id != null ? req.user.user_id : req.user.employee_id)
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function posCanMutateOrder(req, orderRow) {
  try {
    orderService.assertPosOrderCreatorMutation(orderRow, posActorUserId(req), { bypass: isSuperAdmin(req) })
    return true
  } catch (_e) {
    return false
  }
}

function posJwtStoreIdOr400(req, res) {
  const sid = Number(req.user && req.user.store_id)
  if (!Number.isFinite(sid) || sid < 1) {
    res.status(400).json({ success: false, message: 'Invalid or missing store_id in session token.' })
    return null
  }
  return sid
}

/** Align with orderService unit guard: sell only AT_STORE at this store. */
function assessPosUnitSellability(row, storeId) {
  const status = String(row.status || '').toUpperCase()
  const locType = String(row.location_type || '').toUpperCase()
  const locId = row.location_id != null ? Number(row.location_id) : null
  const sid = Number(storeId)
  if (status === 'AT_STORE' && locType === 'STORE' && locId === sid) {
    return { ok: true }
  }
  if (status === 'IN_TRANSIT' && locId === sid) {
    return {
      ok: false,
      message: 'This unit is on an incoming transfer. Complete Verify & Stock in Incoming Goods before selling.'
    }
  }
  if (status === 'AVAILABLE') {
    return {
      ok: false,
      message: 'This unit is still at the warehouse. Transfer and stock-in at this store before selling.'
    }
  }
  return {
    ok: false,
    message: 'This unit is not available for sale at this store.'
  }
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
      store_qty:  Number(row.store_qty)  || 0,
      power:      row.reading_power != null && String(row.reading_power).trim() !== ''
        ? String(row.reading_power).trim()
        : null
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

/** @deprecated use src/lib/indiaMobile — kept for any in-file references */
function normalizeIndiaMobileDigits(raw) {
  return posCustomerRegister.normalizeIndiaMobileDigits(raw)
}

const customerCreateSchema = Joi.object({
  full_name:     Joi.string().min(1).max(200).required(),
  phone:         Joi.string().min(1).max(30).required(),
  email:         Joi.string().max(200).allow(null, '').optional(),
  home_store_id: Joi.number().integer().positive().allow(null),
  confirm_alias: Joi.boolean().default(false)
})

const customerCheckPhoneSchema = Joi.object({
  phone:      Joi.string().min(1).max(30).required(),
  full_name:  Joi.string().max(200).allow('', null).optional()
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

const membershipSaleSchema = Joi.object({
  plan_key: Joi.string().max(50).required(),
  price_paid: Joi.number().min(0).optional()
})

const createOrderSchema = Joi.object({
  customer_id:      Joi.number().integer().positive().required(),
  order_source:     Joi.string().max(20).default('POS'),
  rx_snapshot:      Joi.object().allow(null),
  discount_amount:  Joi.number().min(0).default(0),
  applied_offer_id: Joi.number().integer().positive().allow(null),
  /** When false (default), stock is deducted in createOrderInTransaction. When true, deduction runs on full payment via commitInventoryForPaidOrder. */
  inventory_deferred: Joi.boolean().default(false),
  lines: Joi.array().items(posOrderLineItemSchema).default([]),
  membership_sale: membershipSaleSchema.optional()
}).custom((value, helpers) => {
  const lineCount = (value.lines && value.lines.length) || 0
  const hasMembership = value.membership_sale && String(value.membership_sale.plan_key || '').trim()
  if (lineCount < 1 && !hasMembership) {
    return helpers.error('any.custom', {
      message: 'Cart must include at least one product line or a membership plan.'
    })
  }
  return value
})

const checkoutDraftSchema = Joi.object({
  cart_json: Joi.alternatives().try(Joi.array(), Joi.object(), Joi.string()).required(),
  checkout_stage: Joi.number().integer().min(1).max(7).default(5),
  delivery_mode: Joi.string().valid('STORE', 'HOME').allow(null, ''),
  customer_id: Joi.number().integer().positive().allow(null)
})

const previewOrderDiscountSchema = Joi.object({
  lines: Joi.array().items(posOrderLineItemSchema).default([]),
  membership_sale: membershipSaleSchema.optional(),
  /** When omitted or null — no Eyewoot Go offer discount (staff must pick one offer explicitly). */
  applied_offer_id: Joi.number().integer().positive().allow(null)
}).custom((value, helpers) => {
  const lineCount = (value.lines && value.lines.length) || 0
  const hasMembership = value.membership_sale && String(value.membership_sale.plan_key || '').trim()
  if (lineCount < 1 && !hasMembership) {
    return helpers.error('any.custom', {
      message: 'Cart must include at least one product line or a membership plan.'
    })
  }
  return value
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

const paymentAtCheckoutSchema = Joi.object({
  stage:         Joi.string().valid('ADVANCE', 'BALANCE', 'FULL').required(),
  method:        Joi.string().max(20).required(),
  amount:        Joi.number().min(0).required(),
  tendered:      Joi.number().min(0).allow(null),
  change_given:  Joi.number().min(0).allow(null),
  external_ref:  Joi.string().max(200).allow('', null)
})

const checkoutAndPaySchema = Joi.object({
  order: createOrderSchema.required(),
  payment: paymentAtCheckoutSchema.required()
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
          card_feat_line1: String(p.card_feat_line1 || '').trim(),
          card_feat_line2: String(p.card_feat_line2 || '').trim(),
          card_warranty_label: String(p.card_warranty_label || '').trim(),
          card_warranty_tone: Number(p.card_warranty_tone) || 1,
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
    const sell = assessPosUnitSellability(row, storeId)
    if (!sell.ok) {
      return res.status(409).json({ success: false, message: sell.message })
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
        N'pos_procurement_mode',
        N'pos_msg_customer_ready',
        N'firm_name',
        N'firm_registered_address',
        N'firm_gstin',
        N'pos_invoice_return_policy',
        N'coin_redemption_rate'
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
      coin_redemption_rate: Number(map.coin_redemption_rate || 10),
      procurement_mode: map.pos_procurement_mode || 'STORE',
      msg_customer_ready: map.pos_msg_customer_ready || '',
      firm_name: String(map.firm_name || '').trim(),
      firm_registered_address: String(map.firm_registered_address || '').trim(),
      firm_gstin: String(map.firm_gstin || '').trim(),
      pos_invoice_return_policy: String(map.pos_invoice_return_policy || '').trim()
    }
    return res.json({ success: true, data })
  } catch (err) {
    return next(err)
  }
})

/**
 * Server-side offer discount for order create / checkout-and-pay (anti-tamper).
 * @param {import('mssql').ConnectionPool} pool
 * @param {object} value validated createOrderSchema body
 */
async function resolveAuthorisedDiscountForPosOrder(pool, value) {
  let authorisedDiscountAmount = value.discount_amount || 0
  const prospectivePlanKey = prospectivePlanKeyFromOrder(value)
  if (!value.applied_offer_id) {
    const offers = await fetchEligibleCartOffersForPos(pool, value.customer_id || null, {
      prospectivePlanKey
    })
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
        const err = new Error('Multiple offers qualify. Cashier must select one offer before checkout.')
        err.statusCode = 400
        throw err
      }
    }
    return authorisedDiscountAmount
  }
  const offerRow = await pool.request()
    .input('offer_id', sql.Int, value.applied_offer_id)
    .query(`
        SELECT offer_id, discount_type, discount_value, is_active, valid_from, valid_to
        FROM   dbo.customer_offers WHERE offer_id = @offer_id
      `)
  const offer = offerRow.recordset && offerRow.recordset[0]
  if (!offer || !offer.is_active) {
    const err = new Error('Applied offer is no longer active.')
    err.statusCode = 400
    throw err
  }
  const nowMs = Date.now()
  const vt = offer.valid_to ? new Date(offer.valid_to).getTime() : NaN
  if (Number.isFinite(vt) && nowMs > vt) {
    const err = new Error('Applied offer has expired.')
    err.statusCode = 400
    throw err
  }
  const offers = await fetchEligibleCartOffersForPos(pool, value.customer_id || null, {
    prospectivePlanKey
  })
  const allowed = offers.some((o) => Number(o.offer_id) === Number(value.applied_offer_id))
  if (!allowed) {
    const err = new Error('Applied offer is not available for this customer or cart.')
    err.statusCode = 400
    throw err
  }
  authorisedDiscountAmount = await computeOfferDiscountAmount(pool, offer, value.lines || [], {
    cartPreview: false
  })
  return authorisedDiscountAmount
}

async function recordPosOfferUsage(pool, { value, out, storeId, employeeId, authorisedDiscountAmount }) {
  if (!value.applied_offer_id || Number(authorisedDiscountAmount) <= 0) return
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
    /* non-fatal */
  }
}

/**
 * Award Cashback Coins to a customer if the applied offer is a CASHBACK type.
 * Non-fatal — failures are logged but do not affect checkout.
 * @param {import('mssql').ConnectionPool} pool
 * @param {{ customerId: number|null, orderId: number, orderNo: string, totalAmount: number, offerId: number|null }} params
 */
async function awardCashbackCoinsIfApplicable(pool, { customerId, orderId, orderNo, totalAmount, offerId }) {
  if (!customerId || !offerId || !totalAmount) return
  try {
    const offerR = await pool.request()
      .input('offer_id', sql.Int, offerId)
      .query(`
        SELECT discount_type, cashback_rate
        FROM   dbo.customer_offers
        WHERE  offer_id = @offer_id AND is_active = 1
      `)
    const offer = offerR.recordset[0]
    if (!offer || offer.discount_type !== 'CASHBACK' || !offer.cashback_rate) return

    const cashbackRate = Number(offer.cashback_rate)
    if (!Number.isFinite(cashbackRate) || cashbackRate <= 0) return

    const coinsToAward = Math.floor(totalAmount * cashbackRate / 100)
    if (coinsToAward <= 0) return

    // Get current balance
    const balR = await pool.request()
      .input('cid', sql.Int, customerId)
      .query(`
        SELECT TOP 1 balance_after FROM dbo.pos_points_ledger
        WHERE  customer_id = @cid
        ORDER  BY ledger_id DESC
      `)
    const prevBalance = balR.recordset[0] ? Number(balR.recordset[0].balance_after) : 0
    const newBalance = prevBalance + coinsToAward

    await pool.request()
      .input('customer_id',  sql.Int,          customerId)
      .input('order_id',     sql.Int,          orderId)
      .input('points_delta', sql.Int,          coinsToAward)
      .input('balance_after',sql.Int,          newBalance)
      .input('reason',       sql.NVarChar(100), `Cashback ${cashbackRate}% · ${orderNo || `#${orderId}`}`)
      .query(`
        INSERT INTO dbo.pos_points_ledger (customer_id, order_id, points_delta, balance_after, reason)
        VALUES (@customer_id, @order_id, @points_delta, @balance_after, @reason)
      `)
  } catch (_coinErr) {
    /* non-fatal — coin award failure must never block checkout */
  }
}

/**
 * Attach resolved membership sale pricing for order create.
 * @param {import('mssql').ConnectionPool} pool
 * @param {object} value
 */
async function enrichOrderWithMembershipSale(pool, value) {
  const out = { ...value, lines: value.lines || [] }
  if (!value.membership_sale || !String(value.membership_sale.plan_key || '').trim()) {
    return out
  }
  const resolved = await resolveMembershipSaleAmount(pool, value.membership_sale)
  out.membership_sale = {
    plan_key: resolved.plan_key,
    price_paid: resolved.price_paid
  }
  out._membership_amount = resolved.price_paid
  out._membership_display_name = resolved.display_name
  return out
}

function prospectivePlanKeyFromOrder(value) {
  if (!value || !value.membership_sale) return null
  const pk = String(value.membership_sale.plan_key || '').trim()
  return pk || null
}

/**
 * Grant membership after successful POS payment (same checkout).
 * @param {import('mssql').ConnectionPool} pool
 */
async function grantMembershipFromPosSale(pool, { orderValue, out, employeeId }) {
  const pk = prospectivePlanKeyFromOrder(orderValue)
  if (!pk) return null
  try {
    return await grantCustomerMembership(pool, {
      customerId: orderValue.customer_id,
      planKey: pk,
      pricePaid: orderValue.membership_sale.price_paid,
      posOrderId: out.order_id,
      createdByUserId: employeeId != null ? Number(employeeId) : null,
      useTransaction: false
    })
  } catch (e) {
    const err = new Error(
      'Payment was recorded but membership could not be activated. Contact support with order '
        + (out.order_no || out.order_id) + '.'
    )
    err.statusCode = 500
    throw err
  }
}

/**
 * Activate membership from pos_orders.sold_membership_* when payment completes (split checkout).
 * @param {import('mssql').ConnectionPool} pool
 */
async function grantMembershipFromOrderRowIfNeeded(pool, { orderId, customerId, employeeId, mode }) {
  const ordersTable = mode === 'shared' ? 'dbo.oe_orders' : 'dbo.pos_orders'
  const r = await pool.request().input('oid', sql.Int, orderId).query(`
    SELECT sold_membership_plan_key, sold_membership_amount, customer_id
    FROM ${ordersTable}
    WHERE order_id = @oid
  `)
  const row = r.recordset[0]
  if (!row || !row.sold_membership_plan_key) return null
  const cid = customerId || row.customer_id
  if (!cid) return null

  const existR = await pool.request()
    .input('oid', sql.Int, orderId)
    .input('cid', sql.Int, cid)
    .query(`
      SELECT TOP 1 membership_id
      FROM   dbo.customer_memberships
      WHERE  customer_id = @cid AND pos_order_id = @oid AND is_active = 1
    `)
  if (existR.recordset.length) return existR.recordset[0]

  return grantCustomerMembership(pool, {
    customerId: cid,
    planKey: row.sold_membership_plan_key,
    pricePaid: row.sold_membership_amount,
    posOrderId: orderId,
    createdByUserId: employeeId != null ? Number(employeeId) : null,
    useTransaction: false
  })
}

/**
 * Active Eyewoot Go offers for POS + scope rows (for client PCT/FLAT preview).
 * @param {import('mssql').ConnectionPool} pool
 * @param {number|null} customerId
 * @param {{ prospectivePlanKey?: string|null }} [opts]
 */
async function fetchEligibleCartOffersForPos(pool, customerId, opts = {}) {
  const nowIST = wallClockIso()

  const r = await pool.request().input('now', nowIST).query(`
    SELECT offer_id, title, description, icon_emoji, discount_type,
           discount_value, trigger_type, trigger_value, benefit_target, max_discount_amount, scope_mode,
           valid_from, valid_to,
           required_capability, cashback_rate, sort_order
    FROM   dbo.customer_offers
    WHERE  is_active = 1
      AND  valid_from <= @now
      AND  valid_to   >= @now
    ORDER BY sort_order ASC, offer_id DESC
  `)

  let rows = r.recordset || []

  if (customerId && !Number.isNaN(customerId)) {
    const resolved = await resolveMembershipForCustomer(pool, customerId)
    let memRow = resolved.capabilities || null

    if (!memRow && opts.prospectivePlanKey) {
      const pk = String(opts.prospectivePlanKey).trim()
      if (pk) {
        const planR = await pool.request().input('pk', sql.NVarChar(50), pk).query(`
          SELECT plan_key,
                 has_plus_access,
                 extra_cashback_pct,
                 flat_discount_pct,
                 has_one_time_discount,
                 can_create_sub_cards
          FROM   dbo.membership_plans
          WHERE  plan_key = @pk AND is_active = 1
        `)
        memRow = planR.recordset[0] || null
      }
    }

    rows = rows.filter((o) => {
      if (!o.required_capability) return true
      if (!memRow) return false
      return Boolean(memRow[o.required_capability])
    })
  } else {
    // Walk-in: no customer context — hide membership-restricted offers.
    rows = rows.filter((o) => !o.required_capability)
  }

  const normalized = rows.map((row) => ({
    ...row,
    offer_id: row.offer_id != null ? Number(row.offer_id) : null,
    discount_value: row.discount_value != null ? Number(row.discount_value) : 0,
    cashback_rate: row.cashback_rate != null ? Number(row.cashback_rate) : null,
    sort_order: row.sort_order != null ? Number(row.sort_order) : 0,
    required_capability: row.required_capability || null
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
    const prospectiveRaw = req.query.prospective_plan_key
    const prospectivePlanKey =
      prospectiveRaw != null && String(prospectiveRaw).trim() !== ''
        ? String(prospectiveRaw).trim()
        : null
    const data = await fetchEligibleCartOffersForPos(pool, customerId, { prospectivePlanKey })
    return res.json({ success: true, data })
  } catch (err) {
    return next(err)
  }
})

// ── GET /api/pos/membership-plans — active plans for cart sale ─────────────────
router.get('/membership-plans', ...posMembershipSell, async (req, res, next) => {
  try {
    const pool = await getPool()
    const r = await pool.request().query(`
      SELECT plan_key, display_name, price, validity_days, validity_type, max_dependents,
             has_plus_access, extra_cashback_pct, flat_discount_pct,
             has_one_time_discount, one_time_discount_pct, can_create_sub_cards
      FROM   dbo.membership_plans
      WHERE  is_active = 1
      ORDER BY display_name ASC
    `)
    return res.json({ success: true, data: r.recordset || [] })
  } catch (err) {
    return next(err)
  }
})

// ── GET /api/pos/customers/:customerId/membership-family ───────────────────────
router.get('/customers/:customerId/membership-family', ...posMembershipFamilyView, async (req, res, next) => {
  try {
    const customerId = parseInt(req.params.customerId, 10)
    if (!customerId) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID.' })
    }
    const pool = await getPool()
    const data = await getMembershipFamilyForCustomer(pool, customerId)
    return res.json({ success: true, data })
  } catch (err) {
    return next(err)
  }
})

const posAddDependentSchema = Joi.object({
  phone: Joi.string().trim().required(),
  relationship: Joi.string().trim().required(),
  full_name: Joi.string().trim().max(200).allow('', null).optional()
})

// ── POST /api/pos/customers/:customerId/membership/dependents ─────────────────
router.post('/customers/:customerId/membership/dependents', ...posMembershipDependents, async (req, res, next) => {
  try {
    const { error, value } = posAddDependentSchema.validate(req.body || {}, {
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
    if (!isValidMembershipDependentRelationship(value.relationship)) {
      return res.status(400).json({ success: false, message: 'Invalid relationship.' })
    }
    const customerId = parseInt(req.params.customerId, 10)
    if (!customerId) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID.' })
    }
    const pool = await getPool()
    const data = await addMembershipDependent(pool, {
      primaryCustomerId: customerId,
      phone: value.phone,
      relationship: value.relationship,
      fullName: value.full_name,
      createdByUserId: req.user?.user_id || null
    })
    return res.status(201).json({ success: true, data })
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message })
    }
    return next(err)
  }
})

// ── DELETE /api/pos/customers/:customerId/membership/dependents/:dependentId ──
router.delete(
  '/customers/:customerId/membership/dependents/:dependentId',
  ...posMembershipDependents,
  async (req, res, next) => {
    try {
      const customerId = parseInt(req.params.customerId, 10)
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

    const prospectivePlanKey = prospectivePlanKeyFromOrder(value)
    const offers = await fetchEligibleCartOffersForPos(pool, customerId, { prospectivePlanKey })

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
        const amt = await computeOfferDiscountAmount(pool, offerRow, value.lines || [], { cartPreview: true })
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

    const amt = await computeOfferDiscountAmount(pool, offerRow, value.lines || [], { cartPreview: true })
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
    const pool = await getPool()
    const rows = result.recordset || []
    const enriched = []
    for (const row of rows) {
      const aliases = await posCustomerRegister.listAliases(pool, row.customer_id)
      const primary = String(row.full_name || '').trim()
      const aliasList = aliases.filter(
        (a) => a.toLowerCase() !== primary.toLowerCase()
      )
      enriched.push({ ...row, aliases: aliasList })
    }
    return res.json({ success: true, data: enriched })
  } catch (err) {
    return next(err)
  }
})

// ── POST /api/pos/customer/check-phone — duplicate mobile / alias preview ─────
router.post('/customer/check-phone', ...posCustomersCreate, async (req, res, next) => {
  try {
    const { error, value } = customerCheckPhoneSchema.validate(req.body || {})
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details.map((d) => d.message).join(' ')
      })
    }
    const pool = await getPool()
    const data = await posCustomerRegister.checkPhone(pool, value.phone, {
      proposedName: value.full_name
    })
    return res.json({ success: true, data })
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message })
    }
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
    const parsed = parseIndiaMobileForSave(value.phone)
    if (!parsed.ok) {
      return res.status(400).json({ success: false, message: parsed.message })
    }
    const homeRaw = Number(req.user && req.user.store_id)
    const homeFallback = Number.isFinite(homeRaw) && homeRaw > 0 ? homeRaw : null
    const homeStore = value.home_store_id != null ? value.home_store_id : homeFallback
    const employeeId = req.user && req.user.employee_id != null ? Number(req.user.employee_id) : null
    const pool = await getPool()
    const out = await posCustomerRegister.registerCustomer(pool, {
      fullName: value.full_name,
      phone: parsed.phone,
      email: (value.email && String(value.email).trim()) || null,
      homeStoreId: homeStore || null,
      confirmAlias: !!value.confirm_alias,
      createdByUserId: Number.isFinite(employeeId) ? employeeId : null
    })
    return res.json({ success: true, data: out })
  } catch (err) {
    if (err.statusCode === 409 && err.code === 'PHONE_ALIAS_REQUIRED') {
      return res.status(409).json({
        success: false,
        message: err.message,
        code: err.code,
        data: err.payload
      })
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message })
    }
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
    const searchScope = String(req.query.search_scope || 'store').trim().toLowerCase()
    const queueRaw = String(req.query.queue || 'ACTIVE').trim().toUpperCase()
    if (!POS_ORDER_QUEUE_KEYS.includes(queueRaw)) {
      return res.status(400).json({
        success: false,
        message: `Invalid queue. Use one of: ${POS_ORDER_QUEUE_KEYS.join(', ')}`
      })
    }

    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)

    if (search && searchScope === 'all') {
      const orders = await orderService.fetchAllOrders(pool, mode, {
        search,
        limit: 100
      })
      return res.json({ success: true, data: orders })
    }

    const qOpts = resolveQueueFetchOptions(queueRaw)
    const orders = await orderService.fetchStoreOrders(pool, storeId, mode, {
      search,
      orderKind: qOpts.orderKind || null,
      labStatusIncludes: qOpts.labStatusIncludes || [],
      labStatusExcludesUnion: qOpts.labStatusExcludesUnion || [],
      invoicedSinceDays: qOpts.invoicedSinceDays != null ? qOpts.invoicedSinceDays : null,
      invoicedQueue: qOpts.invoicedQueue === true,
      activeQueue: qOpts.activeQueue === true,
      transitRequiresPayment: qOpts.transitRequiresPayment === true,
      excludeOrderStatuses: Array.isArray(qOpts.excludeOrderStatuses)
        ? qOpts.excludeOrderStatuses
        : ['COMPLETED']
    })

    return res.json({ success: true, data: orders })
  } catch (err) {
    return next(err)
  }
})

router.get('/order-queues', ...posOrdersView, (req, res) => {
  return res.json({ success: true, data: { tabs: POS_ORDER_QUEUE_TABS, keys: POS_ORDER_QUEUE_KEYS } })
})

// ── GET /api/pos/invoices — StorePilot invoice list (last N days or global search) ──
const posInvoicesView = [authJwt, requireModule('storepilot'), requirePermission('storepilot.invoices.view')]
/** Order detail for POS tablets or StorePilot invoice share. */
const posOrderDetailOrInvoiceView = [
  authJwt,
  requireAnyModule(['pos', 'storepilot']),
  requirePermission('pos.orders.view', 'storepilot.invoices.view')
]
router.get('/invoices', ...posInvoicesView, async (req, res, next) => {
  try {
    const storeId = posJwtStoreIdOr400(req, res)
    if (storeId == null) return
    const search = (req.query.q || '').trim() || null
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90)
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500)
    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const orders = await orderService.fetchStoreOrders(pool, storeId, mode, {
      search: search || null,
      invoicedQueue: true,
      invoicedSinceDays: search ? null : days,
      excludeOrderStatuses: [],
      limit
    })
    return res.json({ success: true, data: orders })
  } catch (err) {
    return next(err)
  }
})

// ── GET /api/pos/invoices/:id — full detail for share image (store-scoped) ───
router.get('/invoices/:id', ...posInvoicesView, async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10)
    if (!Number.isFinite(orderId) || orderId < 1) {
      return res.status(400).json({ success: false, message: 'Invalid order id.' })
    }
    const storeId = posJwtStoreIdOr400(req, res)
    if (storeId == null) return
    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const data = await orderService.fetchInvoiceDetailForApi(pool, orderId, storeId, mode)
    if (!data) {
      const actualStoreId = await orderService.resolveOrderStoreId(pool, orderId, mode)
      if (actualStoreId != null && actualStoreId !== storeId) {
        return res.status(404).json({
          success: false,
          message: 'Order belongs to another store. Sign in with the correct store account.'
        })
      }
      return res.status(404).json({ success: false, message: 'Order not found for this store.' })
    }
    return res.json({ success: true, data })
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message })
    }
    return next(err)
  }
})

// ── GET /api/pos/orders/:id ──────────────────────────────────────────────────
router.get('/orders/:id', ...posOrderDetailOrInvoiceView, async (req, res, next) => {
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
      const actualStoreId = await orderService.resolveOrderStoreId(pool, orderId, mode)
      if (actualStoreId != null && actualStoreId !== storeId) {
        return res.status(404).json({
          success: false,
          message: 'Order belongs to another store. Sign in with the correct store account.'
        })
      }
      return res.status(404).json({ success: false, message: 'Order not found for this store.' })
    }

    const actorId = posActorUserId(req)
    const invoiceDetail = await orderService.buildInvoiceDetailPayloadFromBundle(pool, storeId, bundle)
    return res.json({
      success: true,
      data: {
        ...invoiceDetail,
        orders_engine_mode: mode,
        created_by_user_id: bundle.order.created_by_user_id != null ? Number(bundle.order.created_by_user_id) : null,
        can_mutate: posCanMutateOrder(req, bundle.order),
        is_mine: actorId != null && Number(bundle.order.created_by_user_id) === actorId,
        handover_ui: orderService.getHandoverUiState(bundle)
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
    const orderBody = await enrichOrderWithMembershipSale(pool, value)
    const cfgResult = await executeStoredProcedure('sp_POS_GetStartupConfig', {})
    const cfg = mapStartupConfig(cfgResult)

    const gstRate = Number(await readSetting(pool, 'pos_gst_rate') || 0.05)
    const advPct = Number(await readSetting(pool, 'lab_advance_pct') || 40)
    const compositionScheme = truthyPosSetting(await readSetting(pool, 'pos_composition_scheme'))
    const pricesGstInclusive = truthyPosSetting(await readSetting(pool, 'pos_prices_gst_inclusive'))
    const firstPt =
      orderBody.lines && orderBody.lines.length ? orderBody.lines[0].product_type : null
    const procurementMode = await resolveProcurementMode(pool, storeId, firstPt)
    const mode = await orderService.getOrdersEngineMode(pool)
    const authorisedDiscountAmount = await resolveAuthorisedDiscountForPosOrder(pool, orderBody)

    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    try {
      const out = await orderService.createOrderInTransaction(transaction, {
        mode,
        value: orderBody,
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

      await recordPosOfferUsage(pool, { value: orderBody, out, storeId, employeeId, authorisedDiscountAmount })
      await awardCashbackCoinsIfApplicable(pool, {
        customerId: orderBody.customer_id || null,
        orderId: out.order_id,
        orderNo: out.order_no,
        totalAmount: out.total_amount,
        offerId: orderBody.applied_offer_id || null
      })

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
          orders_engine_mode: mode,
          created_by_user_id: employeeId != null ? Number(employeeId) : null,
          membership_granted: false
        }
      })
    } catch (inner) {
      await transaction.rollback()
      throw inner
    }
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 403) {
      return res.status(err.statusCode).json({ success: false, message: err.message })
    }
    if (err.message && err.message.includes('Insufficient stock')) {
      return res.status(400).json({ success: false, message: err.message })
    }
    if (respondPosSchemaMigrationIfNeeded(err, res)) return
    return next(err)
  }
})

// ── POST /api/pos/checkout-and-pay — create order + first payment atomically (Store OS) ──
router.post('/checkout-and-pay', ...posCheckoutAndPay, async (req, res, next) => {
  const storeId = posJwtStoreIdOr400(req, res)
  if (storeId == null) return

  const employeeId = req.user.employee_id
  try {
    const { error, value } = checkoutAndPaySchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      })
    }

    const pool = await getPool()
    const orderBody = await enrichOrderWithMembershipSale(pool, value.order)
    const cfgResult = await executeStoredProcedure('sp_POS_GetStartupConfig', {})
    const cfg = mapStartupConfig(cfgResult)
    const gstRate = Number(await readSetting(pool, 'pos_gst_rate') || 0.05)
    const advPct = Number(await readSetting(pool, 'lab_advance_pct') || 40)
    const compositionScheme = truthyPosSetting(await readSetting(pool, 'pos_composition_scheme'))
    const pricesGstInclusive = truthyPosSetting(await readSetting(pool, 'pos_prices_gst_inclusive'))
    const firstPt =
      orderBody.lines && orderBody.lines.length ? orderBody.lines[0].product_type : null
    const procurementMode = await resolveProcurementMode(pool, storeId, firstPt)
    const mode = await orderService.getOrdersEngineMode(pool)
    const authorisedDiscountAmount = await resolveAuthorisedDiscountForPosOrder(pool, orderBody)

    const out = await orderService.checkoutAndPay(pool, mode, storeId, employeeId, {
      createParams: {
        mode,
        value: orderBody,
        storeId,
        employeeId,
        gstRate,
        compositionScheme,
        pricesGstInclusive,
        advPct,
        procurementMode,
        cfg,
        discountAmount: authorisedDiscountAmount,
        appliedOfferId: orderBody.applied_offer_id || null,
        inventoryDeferred: false
      },
      paymentBody: value.payment
    })

    const membershipGrant = await grantMembershipFromPosSale(pool, {
      orderValue: orderBody,
      out,
      employeeId
    })

    await recordPosOfferUsage(pool, {
      value: orderBody,
      out,
      storeId,
      employeeId,
      authorisedDiscountAmount
    })
    await awardCashbackCoinsIfApplicable(pool, {
      customerId: orderBody.customer_id || null,
      orderId: out.order_id,
      orderNo: out.order_no,
      totalAmount: out.total_amount,
      offerId: orderBody.applied_offer_id || null
    })

    return res.json({
      success: true,
      message: 'Order created and payment recorded.',
      data: {
        order_id: out.order_id,
        order_no: out.order_no,
        order_kind: out.order_kind,
        subtotal_amount: out.subtotal_amount,
        discount_amount: out.discount_amount,
        gst_amount: out.gst_amount,
        total_amount: out.total_amount,
        sub_orders: out.sub_orders,
        payment_summary: out.payment_summary,
        invoice_no: out.invoice_no || null,
        orders_engine_mode: mode,
        created_by_user_id: employeeId != null ? Number(employeeId) : null,
        membership_id: membershipGrant ? membershipGrant.membership_id : null
      }
    })
  } catch (err) {
    if (err.code === 'PAYMENT_FAILED_ORDER_SAVED' && err.orderDraft) {
      return res.status(422).json({
        success: false,
        payment_failed: true,
        code: err.code,
        message: err.message,
        data: err.orderDraft
      })
    }
    if (err.statusCode === 400 || err.statusCode === 403 || err.statusCode === 500) {
      return res.status(err.statusCode).json({ success: false, message: err.message })
    }
    if (err.message && err.message.includes('Insufficient stock')) {
      return res.status(400).json({ success: false, message: err.message })
    }
    if (respondPosSchemaMigrationIfNeeded(err, res)) return
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
    const result = await orderService.recordPayment(pool, mode, storeId, employeeId, value, {
      actorUserId: posActorUserId(req),
      allowMutationBypass: isSuperAdmin(req)
    })

    let membershipGrant = null
    try {
      const bundle = await orderService.fetchOrderBundle(pool, value.order_id, storeId, mode)
      if (bundle && bundle.order) {
        membershipGrant = await grantMembershipFromOrderRowIfNeeded(pool, {
          orderId: value.order_id,
          customerId: bundle.order.customer_id,
          employeeId,
          mode
        })
      }
    } catch (_memErr) {
      /* non-fatal for split payment path */
    }

    return res.json({
      success: true,
      message: result.message,
      data: {
        payment_summary: result.payment_summary,
        invoice_no: result.invoice_no || null,
        membership_id: membershipGrant ? membershipGrant.membership_id : null
      }
    })
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 403 || err.statusCode === 404) {
      return res.status(err.statusCode).json({ success: false, message: err.message })
    }
    if (respondPosSchemaMigrationIfNeeded(err, res)) return
    return next(err)
  }
})

// ── POST /api/pos/orders/:id/void-unpaid — cancel zero-payment OPEN orphan (creator-only) ──
router.post('/orders/:id/void-unpaid', ...posOrdersVoidUnpaid, async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10)
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order id.' })
    }
    const storeId = posJwtStoreIdOr400(req, res)
    if (storeId == null) return
    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const out = await orderService.voidUnpaidPosOrder(
      pool,
      mode,
      storeId,
      orderId,
      posActorUserId(req),
      { bypass: isSuperAdmin(req) }
    )
    return res.json({
      success: true,
      message: 'Unpaid bill voided.',
      data: out
    })
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 403 || err.statusCode === 404) {
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
    const bundle = await orderService.fetchOrderBundle(pool, orderId, storeId, mode)
    if (!bundle) {
      return res.status(404).json({ success: false, message: 'Order not found for this store.' })
    }
    orderService.assertPosOrderCreatorMutation(bundle.order, posActorUserId(req), {
      bypass: isSuperAdmin(req)
    })
    const employeeId = req.user.employee_id
    const out = await orderService.updateLabSubOrderStatus(pool, mode, executeStoredProcedure, {
      orderId,
      storeId,
      employeeId,
      labCaller: labCallerFromReq(req, isSuperAdmin),
      subOrderId: value.sub_order_id,
      toStatus: value.to_status,
      note: value.note,
      allowCrossStoreLab: false,
      bypassOrderSiblingGuard: bypassSibling,
      bypassReason: value.bypass_reason || null
    })
    return res.json({ success: true, message: out.message, data: { from_status: out.from_status, to_status: out.to_status } })
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 403 || err.statusCode === 404) {
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

// ── GET /api/pos/customer-coin-balance/:id ───────────────────────────────────
// Returns coin balance for a POS customer (used by POS cart/payment screens).
router.get('/customer-coin-balance/:id', ...posCheckoutAndPay, async (req, res, next) => {
  try {
    const cid = parseInt(req.params.id, 10)
    if (!Number.isFinite(cid) || cid < 1) {
      return res.status(400).json({ success: false, message: 'Invalid customer id.' })
    }
    const pool = await getPool()

    const [balR, rateR] = await Promise.all([
      pool.request().input('cid', sql.Int, cid).query(`
        SELECT TOP 1 balance_after FROM dbo.pos_points_ledger
        WHERE  customer_id = @cid
        ORDER  BY ledger_id DESC
      `),
      pool.request().query(`
        SELECT setting_value FROM dbo.app_settings WHERE setting_key = N'coin_redemption_rate'
      `)
    ])

    const coins = balR.recordset[0] ? Number(balR.recordset[0].balance_after) : 0
    const rate  = rateR.recordset[0] ? Number(rateR.recordset[0].setting_value) : 10
    const rupeeValue = rate > 0 ? Math.floor(coins / rate) : 0

    return res.json({ success: true, data: { coins, rupee_value: rupeeValue, coin_redemption_rate: rate } })
  } catch (err) {
    return next(err)
  }
})

module.exports = router
