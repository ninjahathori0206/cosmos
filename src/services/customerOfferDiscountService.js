'use strict'

const sql = require('mssql')
const { SCOPE_BY_KIND } = require('../config/offerScopeDimensions')

const MONEY_EPS = 0.02

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100
}

function lineQty(line) {
  const q = parseInt(String(line.qty ?? 1), 10)
  return Number.isFinite(q) && q > 0 ? q : 1
}

/** Frame-only portion (matches POS order payload: unit_price is frame unit). */
function lineFrameTotal(line) {
  return roundMoney((Number(line.unit_price) || 0) * lineQty(line))
}

function lineLensUnitTotal(bundle) {
  if (!bundle) return 0
  const pkg = Number(bundle.package_price) || 0
  let addon = 0
  if (Array.isArray(bundle.addon_prices)) {
    for (const p of bundle.addon_prices) addon += Number(p) || 0
  }
  return roundMoney(pkg + addon)
}

/** Lens package + addons × qty — only meaningful when LAB + lens_bundle. */
function lineLensTotal(line) {
  if (!line.lens_bundle) return 0
  return roundMoney(lineLensUnitTotal(line.lens_bundle) * lineQty(line))
}

function lineFullLabComboTotal(line) {
  return roundMoney(lineFrameTotal(line) + lineLensTotal(line))
}

/** Server line (post-validation): LAB with lens package. No lab_status on payload. */
function isQualifyingLabComboLine(line) {
  const f = String(line.fulfillment || '').trim().toUpperCase()
  if (f !== 'LAB') return false
  const b = line.lens_bundle
  if (!b || b == null) return false
  const pid = Number(b.package_id)
  return Number.isFinite(pid) && pid > 0
}

/** Cart line preview: LAB must also be lens-config complete. */
function isQualifyingLabComboCartLine(line) {
  return isQualifyingLabComboLine(line) && String(line.lab_status || '') === 'complete'
}

/** Subtotal matching POS / order-service line sum before order-level discount. */
function orderLinesMerchandiseSubtotal(lines, { cartPreview = false } = {}) {
  let s = 0
  for (const line of lines || []) {
    if (!line) continue
    const f = String(line.fulfillment || '').trim().toUpperCase()
    const q = cartPreview ? isQualifyingLabComboCartLine(line) : isQualifyingLabComboLine(line)
    if (f === 'LAB' && q) {
      s += lineFullLabComboTotal(line)
    } else {
      s += lineFrameTotal(line)
    }
  }
  return roundMoney(s)
}

// ─── SKU FACTS RESOLUTION ────────────────────────────────────────────────────

/**
 * Batch-resolve sku_id → { skuId, brandId, productId, productTypeKey } from DB.
 * @param {import('mssql').ConnectionPool} pool
 * @param {number[]} skuIds
 * @returns {Promise<Map<number, {skuId:number, brandId:number|null, productId:number|null, productTypeKey:string}>>}
 */
async function resolveSkuFacts(pool, skuIds) {
  const unique = [...new Set((skuIds || []).filter((id) => Number.isFinite(Number(id)) && id > 0))]
  const factMap = new Map()
  if (!unique.length) return factMap

  const ids = unique.map((id) => Number(id))
  const table = new sql.Table()
  table.columns.add('sku_id', sql.Int)
  for (const id of ids) table.rows.add(id)

  const r = await pool.request().query(`
    SELECT s.sku_id,
           pm.home_brand_id  AS brand_id,
           pm.product_id,
           pm.product_type   AS product_type_key
    FROM   dbo.skus s
    JOIN   dbo.product_master pm ON s.product_master_id = pm.product_id
    WHERE  s.sku_id IN (${ids.join(',')})
  `)
  for (const row of (r.recordset || [])) {
    factMap.set(Number(row.sku_id), {
      skuId: Number(row.sku_id),
      brandId: row.brand_id != null ? Number(row.brand_id) : null,
      productId: row.product_id != null ? Number(row.product_id) : null,
      productTypeKey: String(row.product_type_key || '')
    })
  }
  return factMap
}

// ─── SCOPE LOADING ───────────────────────────────────────────────────────────

/**
 * Load scope rows for an offer, grouped by scope_kind.
 * @param {import('mssql').ConnectionPool} pool
 * @param {number} offerId
 * @returns {Promise<Record<string, Array<{refInt:number|null, refKey:string|null, isExclusion:boolean}>>>}
 */
async function loadScopesGrouped(pool, offerId) {
  const r = await pool.request()
    .input('offer_id', sql.Int, offerId)
    .query(`
      SELECT scope_kind, ref_int, ref_key, is_exclusion
      FROM   dbo.customer_offer_scope
      WHERE  offer_id = @offer_id
    `)
  const grouped = {}
  for (const row of (r.recordset || [])) {
    const kind = String(row.scope_kind || '')
    if (!grouped[kind]) grouped[kind] = []
    grouped[kind].push({
      refInt: row.ref_int != null ? Number(row.ref_int) : null,
      refKey: row.ref_key != null ? String(row.ref_key) : null,
      isExclusion: Boolean(row.is_exclusion)
    })
  }
  return grouped
}

// ─── LINE FACT BUILDING ───────────────────────────────────────────────────────

/**
 * Build a neutral lineFacts object from an order line + resolved SKU facts (may be null).
 */
function buildLineFacts(line, skuFact) {
  return {
    skuId: Number(line.sku_id) || null,
    brandId: skuFact ? skuFact.brandId : null,
    productId: skuFact ? skuFact.productId : null,
    productTypeKey: skuFact ? skuFact.productTypeKey : (String(line.product_type || '')),
  }
}

// ─── SCOPE EVALUATION ────────────────────────────────────────────────────────

/**
 * Returns true if the line passes ALL non-empty dimensions (AND across kinds, OR within).
 * Empty scopesGrouped → matches all (global).
 */
function evaluateLineAgainstScopes(lineFacts, scopesGrouped) {
  const kinds = Object.keys(scopesGrouped || {})
  if (!kinds.length) return true

  for (const kind of kinds) {
    const rows = (scopesGrouped[kind] || []).filter((r) => !r.isExclusion)
    if (!rows.length) continue
    const dim = SCOPE_BY_KIND[kind]
    if (!dim) continue
    const lineValue = lineFacts[dim.factKey]
    if (lineValue == null || lineValue === '') return false

    const field = dim.refField
    const matchesAny = rows.some((row) => {
      const ref = field === 'ref_int' ? row.refInt : row.refKey
      if (ref == null) return false
      if (field === 'ref_int') return Number(ref) === Number(lineValue)
      return String(ref).toLowerCase() === String(lineValue).toLowerCase()
    })
    if (!matchesAny) return false
  }
  return true
}

function evaluateLineAgainstExclusions(lineFacts, scopesGrouped) {
  const kinds = Object.keys(scopesGrouped || {})
  if (!kinds.length) return false
  for (const kind of kinds) {
    const rows = (scopesGrouped[kind] || []).filter((r) => r.isExclusion)
    if (!rows.length) continue
    const dim = SCOPE_BY_KIND[kind]
    if (!dim) continue
    const lineValue = lineFacts[dim.factKey]
    if (lineValue == null || lineValue === '') continue
    const field = dim.refField
    const excluded = rows.some((row) => {
      const ref = field === 'ref_int' ? row.refInt : row.refKey
      if (ref == null) return false
      if (field === 'ref_int') return Number(ref) === Number(lineValue)
      return String(ref).toLowerCase() === String(lineValue).toLowerCase()
    })
    if (excluded) return true
  }
  return false
}

function getSkuFactForLine(line, skuFactMap) {
  const id = Number(line.sku_id)
  if (!skuFactMap || !Number.isFinite(id) || id <= 0) return null
  return skuFactMap.get(id) || null
}

/**
 * Lines whose facts match offer scopes (empty scope groups = match all lines).
 * @param {Array} lines
 * @param {Record<string, Array>} scopesGrouped
 * @param {Map<number, object>|null} skuFactMap
 */
function filterLinesByOfferScopes(lines, scopesGrouped, skuFactMap) {
  const map = skuFactMap || new Map()
  const out = []
  for (const line of lines || []) {
    if (!line) continue
    const skuFact = getSkuFactForLine(line, map)
    const facts = buildLineFacts(line, skuFact)
    if (evaluateLineAgainstExclusions(facts, scopesGrouped || {})) continue
    if (!evaluateLineAgainstScopes(facts, scopesGrouped || {})) continue
    out.push(line)
  }
  return out
}

/** Sunglasses product master type — excluded from non-sun lab-primary BOGO slot. */
function isSunglassesProductTypeKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase() === 'sunglasses'
}

function fulfillmentIsInstant(line) {
  return String(line.fulfillment || '').trim().toUpperCase() === 'INSTANT'
}

/**
 * Compute eligible subtotal: sum of line totals that match offer scopes.
 * @param {Array} lines - order lines
 * @param {Record<string,Array>} scopesGrouped
 * @param {Map<number, object>} skuFactMap - from resolveSkuFacts
 * @param {{ cartPreview?: boolean }} opts
 */
function computeEligibleSubtotal(lines, scopesGrouped, skuFactMap, { cartPreview = false } = {}) {
  const qualifies = cartPreview ? isQualifyingLabComboCartLine : isQualifyingLabComboLine
  let s = 0
  for (const line of lines || []) {
    if (!line) continue
    const skuFact = skuFactMap.get(Number(line.sku_id)) || null
    const facts = buildLineFacts(line, skuFact)
    if (evaluateLineAgainstExclusions(facts, scopesGrouped)) continue
    if (!evaluateLineAgainstScopes(facts, scopesGrouped)) continue

    const f = String(line.fulfillment || '').trim().toUpperCase()
    if (f === 'LAB' && qualifies(line)) {
      s += lineFullLabComboTotal(line)
    } else {
      s += lineFrameTotal(line)
    }
  }
  return roundMoney(s)
}

// ─── STRUCTURED OFFER DISCOUNT ───────────────────────────────────────────────

/**
 * Applies discount_value as a cap when > 0 (max discount allowed for this rule).
 * Uses scopesGrouped + skuFactMap when passed (BOGO and LAB combo promos respect allocation).
 *
 * BOGO_LOWEST_FREE (three phases, same offer type):
 *   1. LAB↔INSTANT: Each non-sunglasses qualifying LAB pairs with an INSTANT frame line (eyeglasses or
 *      sunglasses pickup); discount += INSTANT frame total.
 *   2. LAB pool: Leftover qualifying LAB lines (incl. sunglasses-with-lens) pair with each other; discount +=
 *      lower line total per pair.
 *   3. INSTANT pool: Leftover INSTANT frame lines (after phase 1) pair with each other; discount += lower
 *      frame total per pair (frame-only BOGO when cart has no lab lines).
 *
 * @returns {number|null} null if offer type uses legacy POS discount (PCT/FLAT/FREEBIE)
 */
function computeStructuredOfferDiscount(offerRow, lines, opts = {}) {
  const cartPreview = !!opts.cartPreview
  const scopesGrouped = opts.scopesGrouped || {}
  const skuFactMap = opts.skuFactMap || new Map()
  const scopedLines = filterLinesByOfferScopes(lines, scopesGrouped, skuFactMap)

  const typ = String((offerRow && offerRow.discount_type) || '').trim().toUpperCase()
  const capRaw = Number(offerRow && offerRow.discount_value)
  const cap = Number.isFinite(capRaw) && capRaw > 0 ? roundMoney(capRaw) : null

  const qualifies = cartPreview ? isQualifyingLabComboCartLine : isQualifyingLabComboLine

  let gross = 0

  switch (typ) {
    case 'BOGO_LOWEST_FREE': {
      const primaryTotals = []
      const secondaryTotals = []
      const labSunTotals = []
      for (const line of scopedLines) {
        const skuFact = getSkuFactForLine(line, skuFactMap)
        const ptKey = skuFact ? skuFact.productTypeKey : String(line.product_type || '')
        const sun = isSunglassesProductTypeKey(ptKey)
        const q = qualifies(line)

        if (q && !sun) {
          primaryTotals.push(lineFullLabComboTotal(line))
        } else if (fulfillmentIsInstant(line)) {
          secondaryTotals.push(lineFrameTotal(line))
        } else if (q && sun) {
          labSunTotals.push(lineFullLabComboTotal(line))
        }
      }
      primaryTotals.sort((a, b) => b - a)
      secondaryTotals.sort((a, b) => b - a)
      const pairCount = Math.min(primaryTotals.length, secondaryTotals.length)
      for (let i = 0; i < pairCount; i++) {
        gross += secondaryTotals[i]
      }
      const labPool = [...primaryTotals.slice(pairCount), ...labSunTotals]
      labPool.sort((a, b) => b - a)
      for (let i = 0; i + 1 < labPool.length; i += 2) {
        gross += Math.min(labPool[i], labPool[i + 1])
      }
      const remainingInstant = secondaryTotals.slice(pairCount)
      remainingInstant.sort((a, b) => b - a)
      for (let i = 0; i + 1 < remainingInstant.length; i += 2) {
        gross += Math.min(remainingInstant[i], remainingInstant[i + 1])
      }
      break
    }
    case 'BUY_FRAME_GET_LENS_FREE': {
      for (const line of scopedLines) {
        if (qualifies(line)) gross += lineLensTotal(line)
      }
      break
    }
    case 'BUY_LENS_GET_FRAME_FREE': {
      for (const line of scopedLines) {
        if (qualifies(line)) gross += lineFrameTotal(line)
      }
      break
    }
    default:
      return null
  }

  gross = roundMoney(gross)
  const sub = orderLinesMerchandiseSubtotal(lines, { cartPreview })
  let out = Math.min(gross, sub)
  if (cap != null) out = Math.min(out, cap)
  return roundMoney(out)
}

function firstEligibleProductType(lines, skuFactMap, scopesGrouped) {
  for (const line of lines || []) {
    const skuFact = getSkuFactForLine(line, skuFactMap)
    const facts = buildLineFacts(line, skuFact)
    if (evaluateLineAgainstExclusions(facts, scopesGrouped || {})) continue
    if (!evaluateLineAgainstScopes(facts, scopesGrouped || {})) continue
    const pt = String(facts.productTypeKey || '').trim()
    if (pt) return pt
  }
  return ''
}

function checkTrigger(offerRow, lines, skuFactMap, scopesGrouped, cartSubtotal) {
  const triggerType = String(offerRow.trigger_type || 'ANY_ITEM').trim().toUpperCase()
  const triggerValueRaw = String(offerRow.trigger_value || '').trim()
  if (!Array.isArray(lines) || !lines.length) return false
  if (triggerType === 'ANY_ITEM') return true
  if (triggerType === 'MIN_CART_VALUE') {
    const minAmt = Number(triggerValueRaw)
    if (!Number.isFinite(minAmt) || minAmt <= 0) return true
    return Number(cartSubtotal) >= minAmt
  }
  if (triggerType === 'SPECIFIC_PRODUCT_TYPE') {
    if (!triggerValueRaw) return true
    const firstPt = firstEligibleProductType(lines, skuFactMap, scopesGrouped)
    return !!firstPt && firstPt.toLowerCase() === triggerValueRaw.toLowerCase()
  }
  return true
}

function computeFlatOrPctDiscount(offerRow, eligibleLines, cartSubtotal, { cartPreview = false } = {}) {
  const typ = String(offerRow.discount_type || '').trim().toUpperCase()
  const target = String(offerRow.benefit_target || 'ELIGIBLE_LINES').trim().toUpperCase()
  const qualifies = cartPreview ? isQualifyingLabComboCartLine : isQualifyingLabComboLine
  let basis = 0
  if (target === 'CART_TOTAL') {
    basis = Number(cartSubtotal) || 0
  } else if (target === 'CHEAPEST_ITEM') {
    const vals = []
    for (const line of eligibleLines || []) {
      const f = String(line.fulfillment || '').trim().toUpperCase()
      if (f === 'LAB' && qualifies(line)) vals.push(lineFullLabComboTotal(line))
      else vals.push(lineFrameTotal(line))
    }
    basis = vals.length ? Math.min(...vals) : 0
  } else {
    basis = orderLinesMerchandiseSubtotal(eligibleLines, { cartPreview })
  }
  basis = roundMoney(Math.max(0, basis))
  if (basis <= 0) return 0
  const val = Number(offerRow.discount_value) || 0
  if (typ === 'PCT') {
    let out = roundMoney(basis * Math.min(Math.max(val, 0), 100) / 100)
    const cap = Number(offerRow.max_discount_amount)
    if (Number.isFinite(cap) && cap > 0) out = Math.min(out, roundMoney(cap))
    return roundMoney(Math.max(0, Math.min(out, basis)))
  }
  if (typ === 'FLAT') return roundMoney(Math.max(0, Math.min(val, basis)))
  return 0
}

// ─── FULL OFFER DISCOUNT EVALUATOR ───────────────────────────────────────────

/**
 * Server-authoritative offer discount computation.
 * Handles PCT / FLAT (scoped) and structured types (scopes respected for BOGO + LAB promos).
 *
 * @param {import('mssql').ConnectionPool} pool
 * @param {object} offerRow   - from customer_offers
 * @param {Array}  orderLines - from POS POST /orders payload (validated)
 * @param {{ cartPreview?: boolean }} [runOpts] cartPreview=true uses lab_status complete for qualifying combos (cart sidebar).
 * @returns {Promise<number>} - discount amount (≥ 0)
 */
async function computeOfferDiscountAmount(pool, offerRow, orderLines, runOpts = {}) {
  const cartPreview = !!runOpts.cartPreview
  const typ = String(offerRow.discount_type || '').trim().toUpperCase()

  const offerId = Number(offerRow.offer_id)
  const scopesGrouped = offerId ? await loadScopesGrouped(pool, offerId) : {}

  const skuIds = (orderLines || []).map((l) => Number(l.sku_id)).filter((id) => id > 0)
  const skuFactMap = skuIds.length ? await resolveSkuFacts(pool, skuIds) : new Map()

  const structured = computeStructuredOfferDiscount(offerRow, orderLines, {
    cartPreview,
    scopesGrouped,
    skuFactMap
  })
  if (structured !== null) return structured

  const cartSubtotal = orderLinesMerchandiseSubtotal(orderLines, { cartPreview })
  if (!checkTrigger(offerRow, orderLines, skuFactMap, scopesGrouped, cartSubtotal)) return 0

  if (typ === 'PCT') {
    return computeFlatOrPctDiscount(offerRow, filterLinesByOfferScopes(orderLines, scopesGrouped, skuFactMap), cartSubtotal, { cartPreview })
  }
  if (typ === 'FLAT') {
    return computeFlatOrPctDiscount(offerRow, filterLinesByOfferScopes(orderLines, scopesGrouped, skuFactMap), cartSubtotal, { cartPreview })
  }

  return 0 // FREEBIE — no numeric discount
}

// ─── ELIGIBILITY / VALIDATION HELPERS ────────────────────────────────────────

function offerIsEligibleRow(row, nowMs) {
  if (!row || !row.is_active) return false
  const vf = row.valid_from ? new Date(row.valid_from).getTime() : NaN
  const vt = row.valid_to ? new Date(row.valid_to).getTime() : NaN
  if (Number.isFinite(vf) && nowMs < vf) return false
  if (Number.isFinite(vt) && nowMs > vt) return false
  return true
}

/**
 * Server: when POS sends applied_offer_id and type is structured, authoritative discount amount.
 */
async function coerceStructuredDiscountOrNull(pool, offerRow, lines, clientDiscountAmount, runOpts = {}) {
  const { isStructuredOfferType } = require('../config/customerOfferDiscountTypes')
  if (!isStructuredOfferType(offerRow && offerRow.discount_type)) return null
  const computed = await computeOfferDiscountAmount(pool, offerRow, lines, runOpts)
  const client = roundMoney(Number(clientDiscountAmount) || 0)
  if (Math.abs(computed - client) > MONEY_EPS) {
    const err = new Error(
      `Offer discount does not match cart for this promotion (expected ₹${computed}, received ₹${client}). Refresh the cart and try again.`
    )
    err.statusCode = 400
    throw err
  }
  return computed
}

/**
 * Validate scope rows for upsert: check FK existence for ref_int kinds.
 * Throws 400 if any FK is invalid.
 */
async function validateScopeRefs(pool, scopes) {
  const { SCOPE_BY_KIND: byKind } = require('../config/offerScopeDimensions')
  for (const scope of scopes) {
    const dim = byKind[scope.kind]
    if (!dim || !dim.fkTable) continue
    const refVal = scope.ref_int
    if (refVal == null || !Number.isFinite(Number(refVal))) continue
    const r = await pool.request()
      .input('ref', sql.Int, Number(refVal))
      .query(`SELECT 1 AS found FROM ${dim.fkTable} WHERE ${dim.fkColumn} = @ref`)
    if (!(r.recordset && r.recordset[0])) {
      const err = new Error(`Scope reference ${refVal} not found in ${dim.fkTable} for kind ${scope.kind}.`)
      err.statusCode = 400
      throw err
    }
  }
}

/**
 * Replace all scope rows for an offer (delete + bulk insert).
 * @param {import('mssql').ConnectionPool} pool
 * @param {number} offerId
 * @param {Array<{kind:string, ref_int?:number, ref_key?:string}>} scopes
 */
async function replaceOfferScopes(pool, offerId, scopes) {
  await pool.request()
    .input('offer_id', sql.Int, offerId)
    .query(`DELETE FROM dbo.customer_offer_scope WHERE offer_id = @offer_id`)

  for (const scope of scopes) {
    await pool.request()
      .input('offer_id', sql.Int, offerId)
      .input('scope_kind', sql.NVarChar(40), String(scope.kind))
      .input('ref_int', sql.Int, scope.ref_int != null ? Number(scope.ref_int) : null)
      .input('ref_key', sql.NVarChar(60), scope.ref_key != null ? String(scope.ref_key) : null)
      .input('is_exclusion', sql.Bit, scope.is_exclusion ? 1 : 0)
      .query(`
        INSERT INTO dbo.customer_offer_scope (offer_id, scope_kind, ref_int, ref_key, is_exclusion)
        VALUES (@offer_id, @scope_kind, @ref_int, @ref_key, @is_exclusion)
      `)
  }
}

module.exports = {
  roundMoney,
  computeStructuredOfferDiscount,
  computeOfferDiscountAmount,
  orderLinesMerchandiseSubtotal,
  computeEligibleSubtotal,
  resolveSkuFacts,
  loadScopesGrouped,
  buildLineFacts,
  evaluateLineAgainstScopes,
  filterLinesByOfferScopes,
  getSkuFactForLine,
  isSunglassesProductTypeKey,
  offerIsEligibleRow,
  coerceStructuredDiscountOrNull,
  validateScopeRefs,
  replaceOfferScopes,
  isQualifyingLabComboCartLine,
  lineFullLabComboTotal,
  lineLensTotal,
  lineFrameTotal
}
