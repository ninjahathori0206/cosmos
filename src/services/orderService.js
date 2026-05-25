const sql = require('mssql')
const { readSetting } = require('./procurementService')
const { resolveProductTypeRule } = require('../config/posProductTypeRule')
const { resolvePosOrderDisplayStatus } = require('../config/posOrderDisplayCatalog')

const ORDERS_ENGINE_MODE_KEY = 'orders_engine_mode'
const MONEY_EPS = 0.02
const ORDER_SEQ_KEY = 'pos_order_seq'

/** Other LAB sibling must be ≥ lab QC Pass before dispatching any job under the same bill to store. */
const LAB_PEER_READY_FOR_DISPATCH = new Set([
  'QC_PASS', 'DISPATCHED_TO_STORE', 'RECEIVED_AT_STORE', 'STORE_QC_PASS', 'STORE_QC_PARTIAL',
  'QC_FAIL_STORE', 'READY_FOR_DELIVERY', 'DELIVERED', 'BALANCE_COLLECTED', 'INVOICED'
])

/** Transitions guarded by LAB-only sibling coherence (same parent order_id). */
const LAB_SIBLING_DISPATCH_GUARD_TARGETS = new Set(['DISPATCHED_TO_STORE'])

/** @returns {number} */
function sanitizePairIndex(v, fallback) {
  const n = parseInt(String(v), 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return n
}

function pairIndexLetter(idx) {
  const p = Number(idx)
  const n = Number.isFinite(p) && p >= 1 ? Math.floor(p) : 1
  if (n <= 26) return String.fromCharCode(64 + n)
  return `${n}`
}

/** @returns {string} */
function subOrderDisplayLabel(orderNo, pairIndex) {
  const base = String(orderNo || '').trim()
  const suf = pairIndexLetter(pairIndex)
  return base ? base + suf : `SUB-${suf}`
}

/**
 * Assign pair_index — default each cart line slot is its own pair (caller may override per line).
 * @param {{ pair_index?: number }[]} lines
 */
function normalizeIncomingPosLinesWithPairs(lines) {
  return lines.map((l, idx) => {
    const fb = idx + 1
    const pairIndex = l.pair_index != null ? sanitizePairIndex(l.pair_index, fb) : fb
    return { ...l, pair_index: pairIndex }
  })
}

/**
 * LAB sub-rows for list views (one bill may have multiple lab jobs per pair).
 * @returns {Map<number, { sub_order_id: number, lab_workflow_status: string|null, pair_index: number }[]>}
 */
async function fetchLabSubOrderSnapshotsForOrders(pool, t, orderIds) {
  const uniq = [...new Set((orderIds || [])
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0))]
  const map = new Map()
  if (!uniq.length) return map
  const ph = uniq.map((_, i) => `@oid_${i}`).join(', ')
  const req = pool.request()
  for (let i = 0; i < uniq.length; i += 1) req.input(`oid_${i}`, sql.Int, uniq[i])
  const rs = await req.query(`
    SELECT order_id, sub_order_id, lab_workflow_status, pair_index,
           lab_received_confirmed, lab_backorder_confirmed
    FROM ${t.sub_orders}
    WHERE fulfillment = N'LAB' AND order_id IN (${ph})
    ORDER BY order_id, pair_index, sub_order_id
  `)
  for (const row of rs.recordset || []) {
    const oid = Number(row.order_id)
    if (!map.has(oid)) map.set(oid, [])
    map.get(oid).push({
      sub_order_id: row.sub_order_id,
      lab_workflow_status: row.lab_workflow_status != null ? String(row.lab_workflow_status) : null,
      pair_index: row.pair_index != null ? Number(row.pair_index) : 1,
      lab_received_confirmed: labIntakeBitOn(row.lab_received_confirmed),
      lab_backorder_confirmed: labIntakeBitOn(row.lab_backorder_confirmed)
    })
  }
  return map
}

function mergeSiblingGuardBypassNote(userNote, bypassActive, bypassReason, blockingPeers) {
  const base = userNote && String(userNote).trim() ? String(userNote).trim() : ''
  if (!bypassActive) return base || null
  const br = String(bypassReason || 'Authorised').trim().slice(0, 80)
  const peerBit = Array.isArray(blockingPeers) && blockingPeers.length
    ? blockingPeers.map((b) => `#${b.sub_order_id}:${String(b.lab_workflow_status || '').slice(0, 24)}`).join(';').slice(0, 220)
    : ''
  const tag = peerBit
    ? `[sibling_guard_bypass reason=${br} peers=${peerBit}]`
    : `[sibling_guard_bypass reason=${br}]`
  let out = base ? `${tag} ${base}` : tag
  if (out.length > 500) out = out.slice(0, 500)
  return out
}

function formatLabSiblingGuardError(blocking) {
  const parts = (blocking || []).map((b) =>
    `job #${b.sub_order_id} is ${b.lab_workflow_status || 'unknown'} (pair-mate must reach QC pass or later)`)
  return `Bill pair guard: ${parts.join('; ')}`
}

async function fetchLabSiblingPeersSamePair(pool, t, orderId, pairIndex, excludeSubOrderId) {
  const pidx = sanitizePairIndex(pairIndex, 1)
  const sid = Number(excludeSubOrderId)
  if (!Number.isFinite(sid) || sid < 1) return []
  const rs = await pool.request()
    .input('oid', sql.Int, orderId)
    .input('pidx', sql.Int, pidx)
    .input('sid', sql.Int, sid)
    .query(`
      SELECT sub_order_id, lab_workflow_status
      FROM ${t.sub_orders}
      WHERE order_id = @oid AND fulfillment = N'LAB'
        AND pair_index = @pidx AND sub_order_id <> @sid
    `)
  return rs.recordset || []
}

function blockingLabPeersNotDispatchReady(peers) {
  const blocking = []
  for (const p of peers || []) {
    const st = String(p.lab_workflow_status || '').trim().toUpperCase()
    if (!LAB_PEER_READY_FOR_DISPATCH.has(st)) {
      blocking.push({ sub_order_id: p.sub_order_id, lab_workflow_status: p.lab_workflow_status })
    }
  }
  return blocking
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100
}

/** Staff-edited invoice-facing fields at handover; persisted on pos_invoices only (reference). */
function normalizeInvoicePreferencesForStorage(raw) {
  if (!raw || typeof raw !== 'object') return null
  const pick = (v, max) => {
    if (v == null) return null
    const s = String(v).trim()
    if (!s) return null
    return s.length > max ? s.slice(0, max) : s
  }
  const out = {
    bill_name: pick(raw.bill_name, 200),
    gstin: pick(raw.gstin, 20),
    billing_address: pick(raw.billing_address, 500),
    shipping_address: pick(raw.shipping_address, 500),
    phone: pick(raw.phone, 30),
    email: pick(raw.email, 200),
    notes: pick(raw.notes, 500)
  }
  const hasAny = Object.values(out).some((x) => x != null && String(x).length > 0)
  return hasAny ? out : null
}

/** MSSQL JSON / NVARCHAR(MAX) columns may arrive as strings — normalize for API consumers. */
function parseJsonMaybe(val) {
  if (val == null || val === '') return null
  if (typeof val === 'object') return val
  try {
    return JSON.parse(String(val))
  } catch (_e) {
    return null
  }
}

async function fetchPosCustomerBrief(pool, customerId) {
  const cid = Number(customerId)
  if (!Number.isFinite(cid) || cid < 1) return null
  const r = await pool.request()
    .input('cid', sql.Int, cid)
    .query(`
      SELECT customer_id, full_name, phone, ISNULL(email, '') AS email
      FROM dbo.pos_customers
      WHERE customer_id = @cid
    `)
  if (!r.recordset.length) return null
  const c = r.recordset[0]
  return {
    customer_id: c.customer_id,
    full_name: c.full_name || '',
    phone: c.phone || '',
    email: c.email || ''
  }
}

/**
 * Same linkage as POS order lists: JOIN order → pos_customers, with sane defaults for walk-ins.
 * Avoids blank handover forms when customer_id is NULL or FK row is missing.
 * @returns {{ customer_id: number|null, full_name: string, phone: string, email: string }}
 */
async function fetchOrderCustomerSnapshotForBundle(pool, mode, order) {
  const oid = Number(order.order_id)
  const t = tableNames(mode)
  if (!Number.isFinite(oid) || oid < 1) {
    return { customer_id: null, full_name: 'Walk-in Customer', phone: '', email: '' }
  }
  const rs = await pool.request()
    .input('oid', sql.Int, oid)
    .query(`
      SELECT TOP 1
        o.customer_id AS order_customer_id,
        c.customer_id AS joined_customer_id,
        c.full_name,
        c.phone,
        ISNULL(c.email, N'') AS email
      FROM ${t.orders} o
      LEFT JOIN dbo.pos_customers c ON o.customer_id = c.customer_id
      WHERE o.order_id = @oid
    `)
  const row = (rs.recordset || [])[0] || {}
  const nameRaw = row.full_name != null ? String(row.full_name).trim() : ''
  const phone = row.phone != null ? String(row.phone).trim() : ''
  const email = row.email != null ? String(row.email).trim() : ''

  const joinedId = row.joined_customer_id != null ? Number(row.joined_customer_id) : null
  const orderCid = row.order_customer_id != null ? Number(row.order_customer_id) : null
  const hasRegisteredLink = Number.isFinite(joinedId) && joinedId >= 1
  const hasOrderCustomerId = Number.isFinite(orderCid) && orderCid >= 1
  const linkedId = hasRegisteredLink ? joinedId
    : (hasOrderCustomerId ? orderCid : null)

  let full_name = nameRaw
  if (!full_name) {
    full_name = hasOrderCustomerId ? 'Customer' : 'Walk-in Customer'
  }

  return {
    customer_id: linkedId,
    full_name,
    phone,
    email
  }
}

/**
 * Attach sku_code / product_label / colour for order line items (catalogue joins).
 * @param {import('mssql').ConnectionPool} pool
 * @param {{ items: Array<{ sku_id?: number }> }[]} subList
 */
async function enrichOrderItemsWithSkuMeta(pool, subList) {
  const ids = new Set()
  for (const sub of subList || []) {
    for (const it of sub.items || []) {
      const sid = Number(it.sku_id)
      if (Number.isFinite(sid) && sid > 0) ids.add(sid)
    }
  }
  if (!ids.size) return
  const idList = Array.from(ids)
  const ph = idList.map((_, i) => `@sid_${i}`).join(', ')
  const req = pool.request()
  for (let i = 0; i < idList.length; i += 1) {
    req.input(`sid_${i}`, sql.Int, idList[i])
  }
  const q = `
    SELECT sk.sku_id,
           sk.sku_code,
           ISNULL(pm.ew_collection, '') + N' · ' + ISNULL(pm.style_model, '') AS product_label,
           ISNULL(hb.brand_name, ISNULL(mm.maker_name, '')) AS brand_name,
           ISNULL(pic.colour_name, '') AS colour_name,
           ISNULL(pm.product_type, '') AS product_type_pm
    FROM dbo.skus sk
    INNER JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
    LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
    LEFT JOIN dbo.maker_master mm ON mm.maker_id = pm.maker_master_id
    LEFT JOIN dbo.purchase_item_colours pic ON pic.colour_id = sk.item_colour_id
    WHERE sk.sku_id IN (${ph})
  `
  const result = await req.query(q)
  const meta = new Map()
  for (const row of result.recordset || []) {
    meta.set(Number(row.sku_id), {
      sku_code: row.sku_code || '',
      product_label: String(row.product_label || '').trim(),
      brand_name: row.brand_name || '',
      colour_name: row.colour_name || '',
      product_type_pm: row.product_type_pm || ''
    })
  }
  for (const sub of subList || []) {
    for (const it of sub.items || []) {
      const m = meta.get(Number(it.sku_id))
      if (m) {
        it.sku_code = m.sku_code
        it.product_label = m.product_label
        it.brand_name = m.brand_name
        it.colour_name = m.colour_name
        if (!it.product_type && m.product_type_pm) it.product_type = m.product_type_pm
      }
    }
  }
}

/**
 * POS totals: catalogue lines are summed as `subtotal`. Order-level discount (offers)
 * reduces that amount first. Composition → no GST. GST-inclusive catalogue → GST
 * backs out from (subtotal − discount). Otherwise exclusive GST on taxable.
 */
function computePosOrderTaxTotals({
  subtotal,
  discountAmount,
  gstRate,
  compositionScheme,
  pricesGstInclusive
}) {
  const rawSub = roundMoney(Number(subtotal) || 0)
  const r = Math.max(0, Number(gstRate) || 0)
  const discAmt = Math.max(
    0,
    Math.min(roundMoney(Number(discountAmount) || 0), rawSub)
  )
  const netAfterDisc = roundMoney(rawSub - discAmt)

  if (compositionScheme) {
    return {
      discAmt,
      gstAmount: 0,
      totalAmount: netAfterDisc,
      snapshotRate: 0
    }
  }

  if (pricesGstInclusive) {
    const denom = 1 + r
    const taxableBase = denom <= 0
      ? netAfterDisc
      : roundMoney(netAfterDisc / denom)
    const gstAmount = roundMoney(netAfterDisc - taxableBase)
    return {
      discAmt,
      gstAmount,
      totalAmount: netAfterDisc,
      snapshotRate: r
    }
  }

  const taxable = netAfterDisc
  const gstAmount = roundMoney(taxable * r)
  const totalAmount = roundMoney(taxable + gstAmount)
  return {
    discAmt,
    gstAmount,
    totalAmount,
    snapshotRate: r
  }
}

/**
 * @param {import('mssql').ConnectionPool} pool
 * @returns {Promise<'legacy'|'shared'>}
 */
async function getOrdersEngineMode(pool) {
  const raw = await readSetting(pool, ORDERS_ENGINE_MODE_KEY)
  if (raw && String(raw).toLowerCase() === 'shared') return 'shared'
  return 'legacy'
}

function tableNames(mode) {
  if (mode === 'shared') {
    return {
      orders: 'dbo.oe_orders',
      sub_orders: 'dbo.oe_sub_orders',
      order_items: 'dbo.oe_order_items',
      payments: 'dbo.oe_payments',
      order_status_log: 'dbo.oe_order_status_log'
    }
  }
  return {
    orders: 'dbo.pos_orders',
    sub_orders: 'dbo.pos_sub_orders',
    order_items: 'dbo.pos_order_items',
    payments: 'dbo.pos_payments',
    order_status_log: 'dbo.pos_order_status_log'
  }
}

function resolvePosProductTypeRule(cfg, productTypeKey) {
  return resolveProductTypeRule(
    cfg && cfg.productTypeConfig ? cfg.productTypeConfig : [],
    productTypeKey
  )
}

function lineRequiresUnitBarcode(cfg, productTypeKey) {
  const rule = resolvePosProductTypeRule(cfg, productTypeKey)
  if (!rule) return true
  return rule.requires_unit_barcode !== false
}

/**
 * @param {object} cfg from mapStartupConfig
 * @param {object} value validated create order body
 */
function validateOrderLinesAgainstConfig(cfg, value) {
  const seenUnitIds = new Set()
  for (const line of value.lines) {
    const rule = resolvePosProductTypeRule(cfg, line.product_type)
    if (line.fulfillment === 'LAB') {
      if (!line.lens_bundle || !line.lens_bundle.package_id) {
        return { ok: false, message: 'Lab lines require a configured lens bundle.' }
      }
      if (rule && rule.rx_required && !value.rx_snapshot) {
        return { ok: false, message: 'Rx snapshot required for this order.' }
      }
    }
    const needsUnit = lineRequiresUnitBarcode(cfg, line.product_type)
    if (needsUnit) {
      const unitId = line.unit_id != null ? Number(line.unit_id) : null
      if (!Number.isFinite(unitId) || unitId <= 0) {
        return { ok: false, message: 'Unit barcode scan required for this product line before checkout.' }
      }
      if (seenUnitIds.has(unitId)) {
        return { ok: false, message: 'The same unit barcode cannot be used on more than one line.' }
      }
      seenUnitIds.add(unitId)
      if (Number(line.qty) !== 1) {
        return { ok: false, message: 'Scanned unit lines must have quantity 1.' }
      }
    } else if (rule && !rule.allow_qty_gt_1 && line.qty > 1) {
      return { ok: false, message: `Qty > 1 not allowed for ${line.product_type}.` }
    }
  }
  return { ok: true }
}

function buildPaymentSummary(orderRow, labSubtotal, instantSubtotal, payments) {
  const total = roundMoney(orderRow.total_amount)
  const subtotal = roundMoney(orderRow.subtotal_amount)
  const gstAmt = roundMoney(orderRow.gst_amount)
  const pct = Number(orderRow.lab_advance_pct_snapshot) || 40
  const orderKind = String(orderRow.order_kind || '')
  const labPart = roundMoney(labSubtotal)
  const insPart = roundMoney(instantSubtotal)

  let advanceTarget = 0
  if (orderKind === 'LAB' || orderKind === 'MIXED') {
    advanceTarget = roundMoney(labPart * (pct / 100))
  }

  let paidAdvance = 0
  let paidBalance = 0
  let paidFull = 0
  for (const p of payments || []) {
    const a = roundMoney(p.amount)
    if (p.stage === 'ADVANCE') paidAdvance += a
    else if (p.stage === 'BALANCE') paidBalance += a
    else if (p.stage === 'FULL') paidFull += a
  }
  paidAdvance = roundMoney(paidAdvance)
  paidBalance = roundMoney(paidBalance)
  paidFull = roundMoney(paidFull)
  const paidTotal = roundMoney(paidAdvance + paidBalance + paidFull)

  let instantDue = 0
  if (orderKind === 'MIXED' && subtotal > 0) {
    const gstShare = roundMoney(gstAmt * (insPart / subtotal))
    instantDue = roundMoney(insPart + gstShare)
  }

  const advanceRemaining = roundMoney(Math.max(0, advanceTarget - paidAdvance))
  const amountRemaining = roundMoney(Math.max(0, total - paidTotal))

  return {
    order_kind: orderKind,
    total_amount: total,
    subtotal_amount: subtotal,
    gst_amount: gstAmt,
    lab_subtotal_pre_tax: labPart,
    instant_subtotal_pre_tax: insPart,
    instant_portion_due_incl_gst: instantDue,
    lab_advance_pct: pct,
    advance_target: advanceTarget,
    paid_advance: paidAdvance,
    paid_balance: paidBalance,
    paid_full: paidFull,
    paid_total: paidTotal,
    advance_remaining: advanceRemaining,
    amount_remaining: amountRemaining
  }
}

/**
 * True when lab advance target is met: explicit ADVANCE payments, or total paid
 * (optionally + this request) after covering the instant slice on MIXED orders.
 * Handles FULL/BALANCE rows that prepaid the bill without a separate ADVANCE line.
 * @param {{ order_kind: string, advance_target: number, paid_advance: number, paid_total: number, instant_portion_due_incl_gst?: number }} summary
 * @param {number} [stagedAmount] amount in the current payment row (BALANCE/FULL)
 */
function labAdvanceEffectivelyPaid(summary, stagedAmount = 0) {
  const at = roundMoney(summary.advance_target)
  if (at <= MONEY_EPS) return true
  if (roundMoney(summary.paid_advance) + MONEY_EPS >= at) return true
  const add = roundMoney(Number(stagedAmount) || 0)
  const pooled = roundMoney(summary.paid_total + add)
  const kind = String(summary.order_kind || '').toUpperCase()
  let labAttributed = pooled
  if (kind === 'MIXED') {
    const ins = roundMoney(Number(summary.instant_portion_due_incl_gst) || 0)
    if (ins > MONEY_EPS) {
      labAttributed = Math.max(0, roundMoney(pooled - ins))
    }
  }
  return labAttributed + MONEY_EPS >= at
}

/**
 * @returns {{ ok: boolean, message?: string }}
 */
function validatePaymentAgainstSummary(orderRow, summary, body) {
  const amount = roundMoney(body.amount)
  const remaining = roundMoney(summary.amount_remaining)
  if (amount < 0) return { ok: false, message: 'Amount cannot be negative.' }
  if (amount === 0 && remaining <= MONEY_EPS) {
    return { ok: true }
  }
  if (amount <= 0) return { ok: false, message: 'Amount must be positive when a balance is due.' }
  const stage = String(body.stage || '')
  const kind = String(orderRow.order_kind || '')
  const paidAfter = roundMoney(summary.paid_total + amount)

  if (paidAfter > summary.total_amount + MONEY_EPS) {
    return { ok: false, message: 'Payment would exceed order total.' }
  }

  if (kind === 'INSTANT') {
    if (stage !== 'FULL') return { ok: false, message: 'Instant orders only accept FULL payments.' }
    return { ok: true }
  }

  if (kind === 'LAB') {
    if (stage === 'ADVANCE') {
      // Minimum: must collect at least the remaining advance target.
      // Maximum: anything up to the full remaining order total (customer may pay in full upfront).
      const minRequired = roundMoney(summary.advance_target - summary.paid_advance)
      if (summary.paid_advance >= summary.advance_target - MONEY_EPS && summary.advance_target > 0) {
        return { ok: false, message: 'Lab advance already satisfied; use BALANCE or FULL for remainder.' }
      }
      if (minRequired > MONEY_EPS && amount < minRequired - MONEY_EPS) {
        return { ok: false, message: 'Minimum advance is ' + minRequired.toFixed(2) + '. Customer may also pay the full amount upfront.' }
      }
      return { ok: true }
    }
    if (stage === 'BALANCE' || stage === 'FULL') {
      if (!labAdvanceEffectivelyPaid(summary, amount)) {
        return { ok: false, message: 'Collect lab advance before balance or final payment.' }
      }
      return { ok: true }
    }
    return { ok: false, message: 'Invalid payment stage for lab order.' }
  }

  if (kind === 'MIXED') {
    if (stage === 'ADVANCE') {
      // Same rule: minimum advance required, but full upfront payment is allowed.
      const minRequired = roundMoney(summary.advance_target - summary.paid_advance)
      if (summary.paid_advance >= summary.advance_target - MONEY_EPS && summary.advance_target > 0) {
        return { ok: false, message: 'Lab advance already satisfied for mixed order; use BALANCE or FULL for remainder.' }
      }
      if (minRequired > MONEY_EPS && amount < minRequired - MONEY_EPS) {
        return { ok: false, message: 'Minimum advance is ' + minRequired.toFixed(2) + '. Customer may also pay the full amount upfront.' }
      }
      return { ok: true }
    }
    if (stage === 'BALANCE' || stage === 'FULL') {
      const needInstant = summary.instant_portion_due_incl_gst > MONEY_EPS
      if (needInstant && paidAfter + MONEY_EPS < summary.instant_portion_due_incl_gst) {
        return { ok: false, message: 'Collect instant-line portion (incl. GST share) and lab advance before final settlement.' }
      }
      if (!labAdvanceEffectivelyPaid(summary, amount)) {
        return { ok: false, message: 'Collect lab advance before balance or final payment.' }
      }
      return { ok: true }
    }
    return { ok: false, message: 'Invalid payment stage for mixed order.' }
  }

  return { ok: false, message: 'Unknown order kind for payment validation.' }
}

/**
 * @param {import('mssql').ConnectionPool} pool
 */
async function fetchOrderBundle(pool, orderId, storeId, mode) {
  const t = tableNames(mode)
  const o = await pool.request()
    .input('oid', sql.Int, orderId)
    .input('sid', sql.Int, storeId)
    .query(`SELECT * FROM ${t.orders} WHERE order_id = @oid AND store_id = @sid`)
  if (!o.recordset.length) return null
  const order = o.recordset[0]

  const subs = await pool.request()
    .input('oid', sql.Int, orderId)
    .query(`
      SELECT sub_order_id, order_id, fulfillment, lab_workflow_status, sort_order,
             pair_index, handover_status
      FROM ${t.sub_orders}
      WHERE order_id = @oid
      ORDER BY pair_index, fulfillment DESC, sub_order_id
    `)

  const items = await pool.request()
    .input('oid', sql.Int, orderId)
    .query(`
      SELECT i.order_item_id, i.sub_order_id, i.sku_id, i.qty, i.unit_price, i.line_total,
             i.product_type, i.fulfillment, i.line_key, i.lens_bundle
      FROM ${t.order_items} i
      INNER JOIN ${t.sub_orders} s ON s.sub_order_id = i.sub_order_id
      WHERE s.order_id = @oid
      ORDER BY s.sort_order, i.order_item_id
    `)

  const pays = await pool.request()
    .input('oid', sql.Int, orderId)
    .query(`
      SELECT payment_id, order_id, stage, method, amount, tendered, change_given, external_ref, created_at
      FROM ${t.payments}
      WHERE order_id = @oid
      ORDER BY payment_id
    `)

  let labSubtotal = 0
  let instantSubtotal = 0
  for (const it of items.recordset || []) {
    const lt = roundMoney(it.line_total)
    if (String(it.fulfillment) === 'LAB') labSubtotal += lt
    else instantSubtotal += lt
  }
  labSubtotal = roundMoney(labSubtotal)
  instantSubtotal = roundMoney(instantSubtotal)

  const subList = (subs.recordset || []).map((s) => ({
    sub_order_id: s.sub_order_id,
    order_id: s.order_id,
    fulfillment: s.fulfillment,
    lab_workflow_status: s.lab_workflow_status,
    sort_order: s.sort_order != null ? Number(s.sort_order) : 0,
    pair_index: s.pair_index != null ? Number(s.pair_index) : 1,
    handover_status: s.handover_status != null ? String(s.handover_status) : null,
    sub_order_label: subOrderDisplayLabel(order.order_no, s.pair_index != null ? Number(s.pair_index) : 1),
    items: []
  }))
  const subById = new Map(subList.map((s) => [s.sub_order_id, s]))
  for (const it of items.recordset || []) {
    const bucket = subById.get(it.sub_order_id)
    if (bucket) {
      bucket.items.push({
        order_item_id: it.order_item_id,
        sku_id: it.sku_id,
        qty: it.qty,
        unit_price: Number(it.unit_price),
        line_total: Number(it.line_total),
        product_type: it.product_type,
        fulfillment: it.fulfillment,
        line_key: it.line_key,
        lens_bundle: parseJsonMaybe(it.lens_bundle)
      })
    }
  }

  await enrichOrderItemsWithSkuMeta(pool, subList)

  const payments = (pays.recordset || []).map((p) => ({
    payment_id: p.payment_id,
    stage: p.stage,
    method: p.method,
    amount: Number(p.amount),
    tendered: p.tendered != null ? Number(p.tendered) : null,
    change_given: p.change_given != null ? Number(p.change_given) : null,
    external_ref: p.external_ref,
    created_at: p.created_at
  }))

  const payment_summary = buildPaymentSummary(order, labSubtotal, instantSubtotal, payments)

  const customer = await fetchOrderCustomerSnapshotForBundle(pool, mode, order)

  return { order, subList, payments, payment_summary, customer }
}

/**
 * Only the creating cashier may collect payment or advance lab workflow (unless bypass).
 * @param {object} orderRow
 * @param {number|null|undefined} actorUserId JWT user_id / employee_id
 * @param {{ bypass?: boolean }} [options]
 */
function assertPosOrderCreatorMutation(orderRow, actorUserId, options = {}) {
  if (options.bypass) return
  const creator = orderRow.created_by_user_id != null ? Number(orderRow.created_by_user_id) : null
  const actor = actorUserId != null ? Number(actorUserId) : null
  if (creator == null || !Number.isFinite(creator)) {
    const err = new Error('This order has no recorded creator; only an administrator may update it.')
    err.statusCode = 403
    throw err
  }
  if (actor == null || !Number.isFinite(actor) || actor !== creator) {
    const err = new Error('Only the staff member who created this order can collect payment or update lab status.')
    err.statusCode = 403
    throw err
  }
}

function mapOrderRowForApi(order, extras = {}) {
  const paidTotal = extras.paid_total != null
    ? roundMoney(Number(extras.paid_total))
    : extras.payment_summary
      ? roundMoney(Number(extras.payment_summary.paid_total) || 0)
      : null
  const totalAmt = Number(order.total_amount)
  const isUnpaid = extras.is_unpaid === true
    || (paidTotal != null && paidTotal + MONEY_EPS < totalAmt)
  const display = resolvePosOrderDisplayStatus({
    status: order.status,
    is_unpaid: isUnpaid,
    paid_total: paidTotal,
    total_amount: totalAmt
  })
  return {
    order_id: order.order_id,
    store_id: order.store_id,
    customer_id: order.customer_id,
    created_by_user_id: order.created_by_user_id != null ? Number(order.created_by_user_id) : null,
    order_no: order.order_no,
    order_source: order.order_source,
    order_kind: order.order_kind,
    status: order.status,
    is_unpaid: isUnpaid,
    amount_paid: paidTotal,
    amount_remaining: paidTotal != null ? Math.max(0, roundMoney(totalAmt - paidTotal)) : null,
    display_status_key: display.display_status_key,
    display_status_label: display.display_status_label,
    display_status_css_class: display.display_status_css_class,
    gst_rate_snapshot: Number(order.gst_rate_snapshot),
    lab_advance_pct_snapshot: order.lab_advance_pct_snapshot != null ? Number(order.lab_advance_pct_snapshot) : null,
    procurement_mode_snapshot: order.procurement_mode_snapshot,
    subtotal_amount: Number(order.subtotal_amount),
    discount_amount: order.discount_amount != null ? Number(order.discount_amount) : 0,
    gst_amount: Number(order.gst_amount),
    total_amount: totalAmt,
    created_at: order.created_at,
    rx_snapshot: parseJsonMaybe(order.rx_snapshot),
    inventory_committed: order.inventory_committed === true || order.inventory_committed === 1
  }
}

/**
 * Same as fetchOrderBundle but on an open transaction (no SKU enrichment / customer snapshot).
 * @param {import('mssql').Transaction} transaction
 */
async function fetchOrderBundleTransaction(transaction, orderId, storeId, mode) {
  const t = tableNames(mode)
  const o = await new sql.Request(transaction)
    .input('oid', sql.Int, orderId)
    .input('sid', sql.Int, storeId)
    .query(`SELECT * FROM ${t.orders} WHERE order_id = @oid AND store_id = @sid`)
  if (!o.recordset.length) return null
  const order = o.recordset[0]

  const subs = await new sql.Request(transaction).input('oid', sql.Int, orderId).query(`
      SELECT sub_order_id, order_id, fulfillment, lab_workflow_status, sort_order,
             pair_index, handover_status
      FROM ${t.sub_orders}
      WHERE order_id = @oid
      ORDER BY pair_index, fulfillment DESC, sub_order_id
    `)

  const items = await new sql.Request(transaction).input('oid', sql.Int, orderId).query(`
      SELECT i.order_item_id, i.sub_order_id, i.sku_id, i.qty, i.unit_price, i.line_total,
             i.product_type, i.fulfillment, i.line_key, i.lens_bundle
      FROM ${t.order_items} i
      INNER JOIN ${t.sub_orders} s ON s.sub_order_id = i.sub_order_id
      WHERE s.order_id = @oid
      ORDER BY s.sort_order, i.order_item_id
    `)

  const pays = await new sql.Request(transaction).input('oid', sql.Int, orderId).query(`
      SELECT payment_id, order_id, stage, method, amount, tendered, change_given, external_ref, created_at
      FROM ${t.payments}
      WHERE order_id = @oid
      ORDER BY payment_id
    `)

  let labSubtotal = 0
  let instantSubtotal = 0
  for (const it of items.recordset || []) {
    const lt = roundMoney(it.line_total)
    if (String(it.fulfillment) === 'LAB') labSubtotal += lt
    else instantSubtotal += lt
  }
  labSubtotal = roundMoney(labSubtotal)
  instantSubtotal = roundMoney(instantSubtotal)

  const subList = (subs.recordset || []).map((s) => ({
    sub_order_id: s.sub_order_id,
    order_id: s.order_id,
    fulfillment: s.fulfillment,
    lab_workflow_status: s.lab_workflow_status,
    sort_order: s.sort_order != null ? Number(s.sort_order) : 0,
    pair_index: s.pair_index != null ? Number(s.pair_index) : 1,
    handover_status: s.handover_status != null ? String(s.handover_status) : null,
    sub_order_label: subOrderDisplayLabel(order.order_no, s.pair_index != null ? Number(s.pair_index) : 1),
    items: []
  }))
  const subById = new Map(subList.map((s) => [s.sub_order_id, s]))
  for (const it of items.recordset || []) {
    const bucket = subById.get(it.sub_order_id)
    if (bucket) {
      bucket.items.push({
        order_item_id: it.order_item_id,
        sku_id: it.sku_id,
        qty: it.qty,
        unit_price: Number(it.unit_price),
        line_total: Number(it.line_total),
        product_type: it.product_type,
        fulfillment: it.fulfillment,
        line_key: it.line_key,
        lens_bundle: parseJsonMaybe(it.lens_bundle)
      })
    }
  }

  const payments = (pays.recordset || []).map((p) => ({
    payment_id: p.payment_id,
    stage: p.stage,
    method: p.method,
    amount: Number(p.amount),
    tendered: p.tendered != null ? Number(p.tendered) : null,
    change_given: p.change_given != null ? Number(p.change_given) : null,
    external_ref: p.external_ref,
    created_at: p.created_at
  }))

  const payment_summary = buildPaymentSummary(order, labSubtotal, instantSubtotal, payments)
  return { order, subList, payments, payment_summary, customer: null }
}

function preparePaymentTenderFields(body) {
  let tendered = body.tendered
  let changeGiven = body.change_given
  if (roundMoney(body.amount) <= 0) {
    tendered = null
    changeGiven = null
  } else if (body.method === 'CASH' && tendered != null) {
    changeGiven = roundMoney(Number(tendered) - Number(body.amount))
    if (changeGiven < 0) {
      const err = new Error('Tendered amount is less than payment amount.')
      err.statusCode = 400
      throw err
    }
  }
  return { tendered, changeGiven }
}

/**
 * @param {import('mssql').Transaction|import('mssql').ConnectionPool} trxOrPool
 */
async function insertPaymentRow(trxOrPool, mode, orderId, employeeId, body, tendered, changeGiven) {
  const t = tableNames(mode)
  const isTrx = trxOrPool && typeof trxOrPool.commit === 'function'
  const req = isTrx ? new sql.Request(trxOrPool) : trxOrPool.request()
  await req
    .input('order_id', sql.Int, orderId)
    .input('stage', sql.NVarChar(20), body.stage)
    .input('method', sql.NVarChar(20), body.method)
    .input('amount', sql.Decimal(12, 2), body.amount)
    .input('tendered', sql.Decimal(12, 2), tendered != null ? tendered : null)
    .input('change_given', sql.Decimal(12, 2), changeGiven != null ? changeGiven : null)
    .input('external_ref', sql.NVarChar(200), body.external_ref || null)
    .input('created_by', sql.Int, employeeId || null)
    .query(`
      INSERT INTO ${t.payments} (order_id, stage, method, amount, tendered, change_given, external_ref, created_by)
      VALUES (@order_id, @stage, @method, @amount, @tendered, @change_given, @external_ref, @created_by)
    `)
}

async function finalizePaymentAfterInsert(pool, mode, storeId, orderId, body, employeeId) {
  const refreshed = await fetchOrderBundle(pool, orderId, storeId, mode)
  let invoiceNo = null
  const fullyPaid = refreshed && Number(refreshed.payment_summary.amount_remaining || 0) <= MONEY_EPS
  if (fullyPaid && refreshed && refreshed.order && orderRowNeedsInventoryCommit(refreshed.order)) {
    await commitInventoryForPaidOrder(pool, mode, storeId, orderId)
  }
  const payStageUpper = String(body.stage || '').trim().toUpperCase()
  if (fullyPaid && refreshed) {
    invoiceNo = await finalizePaidOrderLedger(pool, mode, refreshed, payStageUpper, employeeId, {
      invoice_preferences: body.invoice_preferences
    })
  }
  return {
    payment_summary: refreshed ? refreshed.payment_summary : null,
    invoice_no: invoiceNo
  }
}

/**
 * Create order + first payment in one transaction; finalize ledger after commit.
 */
async function checkoutAndPay(pool, mode, storeId, employeeId, { createParams, paymentBody }) {
  const transaction = new sql.Transaction(pool)
  await transaction.begin()
  let out
  try {
    out = await createOrderInTransaction(transaction, createParams)
    const bundle = await fetchOrderBundleTransaction(transaction, out.order_id, storeId, mode)
    if (!bundle) {
      const err = new Error('Order not found after create.')
      err.statusCode = 500
      throw err
    }
    const payBody = { ...paymentBody, order_id: out.order_id }
    const check = validatePaymentAgainstSummary(bundle.order, bundle.payment_summary, payBody)
    if (!check.ok) {
      const err = new Error(check.message)
      err.statusCode = 400
      throw err
    }
    const { tendered, changeGiven } = preparePaymentTenderFields(payBody)
    await insertPaymentRow(transaction, mode, out.order_id, employeeId, payBody, tendered, changeGiven)
    await transaction.commit()
  } catch (e) {
    await transaction.rollback()
    throw e
  }

  const fin = await finalizePaymentAfterInsert(pool, mode, storeId, out.order_id, {
    ...paymentBody,
    order_id: out.order_id
  }, employeeId)

  return {
    order_id: out.order_id,
    order_no: out.order_no,
    order_kind: out.order_kind,
    subtotal_amount: out.subtotal_amount,
    discount_amount: out.discount_amount,
    gst_amount: out.gst_amount,
    total_amount: out.total_amount,
    sub_orders: out.sub_orders,
    payment_summary: fin.payment_summary,
    invoice_no: fin.invoice_no
  }
}

/**
 * Max numeric suffix already used on EW-ORD-* across POS / order-engine tables (0 if none).
 * Heals drift when app_settings.pos_order_seq falls behind existing rows.
 * @param {import('mssql').Transaction} transaction
 */
async function readMaxEwOrdNumericSuffix(transaction) {
  const r0 = new sql.Request(transaction)
  const chk = await r0.query(`
    SELECT
      CASE WHEN OBJECT_ID(N'dbo.pos_orders', N'U') IS NOT NULL THEN 1 ELSE 0 END AS has_pos,
      CASE WHEN OBJECT_ID(N'dbo.oe_orders', N'U') IS NOT NULL THEN 1 ELSE 0 END AS has_oe
  `)
  const row = chk.recordset[0] || {}
  const parts = []
  if (row.has_pos) {
    parts.push(
      `SELECT TRY_CAST(SUBSTRING(order_no, 8, 50) AS INT) AS n FROM dbo.pos_orders WHERE order_no LIKE N'EW-ORD-%'`
    )
  }
  if (row.has_oe) {
    parts.push(
      `SELECT TRY_CAST(SUBSTRING(order_no, 8, 50) AS INT) AS n FROM dbo.oe_orders WHERE order_no LIKE N'EW-ORD-%'`
    )
  }
  if (!parts.length) return 0
  const r = new sql.Request(transaction)
  const rs = await r.query(`SELECT MAX(n) AS mx FROM (${parts.join(' UNION ALL ')}) AS u`)
  const mx = (rs.recordset[0] || {}).mx
  const n = Number(mx)
  return Number.isFinite(n) ? n : 0
}

/**
 * Allocates the next EW-ORD numeric suffix under UPDLOCK and persists it to app_settings.
 * Ensures pos_order_seq row exists and never returns a suffix ≤ max(existing EW-ORD-*).
 * @param {import('mssql').Transaction} transaction
 * @returns {Promise<number>}
 */
async function allocateNextPosOrderSeq(transaction) {
  const k = ORDER_SEQ_KEY
  const rEns = new sql.Request(transaction)
  rEns.input('k', sql.VarChar(100), k)
  await rEns.query(`
    IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WITH (UPDLOCK, ROWLOCK) WHERE setting_key = @k)
    BEGIN
      INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
      VALUES (@k, N'1000', N'pos', N'Monotonic order sequence (integer string).');
    END
  `)

  const rLock = new sql.Request(transaction)
  rLock.input('k', sql.VarChar(100), k)
  const seqLock = await rLock.query(
    'SELECT setting_value FROM dbo.app_settings WITH (UPDLOCK, ROWLOCK) WHERE setting_key = @k'
  )
  let seq = parseInt((seqLock.recordset[0] || {}).setting_value, 10)
  if (!Number.isFinite(seq)) seq = 1000

  const maxUsed = await readMaxEwOrdNumericSuffix(transaction)
  let nextSeq = seq + 1
  if (Number.isFinite(maxUsed) && maxUsed > 0 && nextSeq <= maxUsed) {
    nextSeq = maxUsed + 1
  }

  const rUp = new sql.Request(transaction)
  rUp.input('k', sql.VarChar(100), k)
  rUp.input('v', sql.VarChar(500), String(nextSeq))
  const upd = await rUp.query(
    'UPDATE dbo.app_settings SET setting_value = @v, updated_at = DATEADD(MINUTE,330,SYSUTCDATETIME()) WHERE setting_key = @k'
  )
  const affected = Array.isArray(upd.rowsAffected) ? upd.rowsAffected[0] : upd.rowsAffected
  if (!Number.isFinite(Number(affected)) || Number(affected) < 1) {
    const err = new Error('Could not advance POS order number sequence (app_settings).')
    err.statusCode = 500
    throw err
  }

  return nextSeq
}

/**
 * Create order in a transaction (writes pos_* or oe_* based on mode).
 * Caller must validate Joi body and cfg before calling.
 */
async function createOrderInTransaction(transaction, {
  mode,
  value,
  storeId,
  employeeId,
  gstRate,
  compositionScheme = false,
  pricesGstInclusive = false,
  advPct,
  procurementMode,
  cfg,
  discountAmount = 0,
  appliedOfferId = null,
  inventoryDeferred = false
}) {
  const customerId = value && value.customer_id != null ? Number(value.customer_id) : null
  if (!Number.isFinite(customerId) || customerId < 1) {
    const err = new Error('Customer is required to create an order.')
    err.statusCode = 400
    throw err
  }

  const t = tableNames(mode)
  const linesNormalized = normalizeIncomingPosLinesWithPairs(value.lines)
  const valueNorm = { ...value, lines: linesNormalized }

  const vr = validateOrderLinesAgainstConfig(cfg, valueNorm)
  if (!vr.ok) {
    const err = new Error(vr.message)
    err.statusCode = 400
    throw err
  }

  let subtotal = 0
  for (const line of linesNormalized) {
    let lineUnit = Number(line.unit_price) || 0
    if (line.fulfillment === 'LAB' && line.lens_bundle) {
      const b = line.lens_bundle
      const lensPrice = Number(b.package_price) || 0
      const addonSum = (b.addon_prices || []).reduce((s, p) => s + (Number(p) || 0), 0)
      lineUnit = lineUnit + lensPrice + addonSum
    }
    subtotal += lineUnit * line.qty
  }
  subtotal = roundMoney(subtotal)
  const taxOut = computePosOrderTaxTotals({
    subtotal,
    discountAmount,
    gstRate,
    compositionScheme,
    pricesGstInclusive
  })
  const discAmt = taxOut.discAmt
  const gstAmount = taxOut.gstAmount
  const totalAmount = taxOut.totalAmount
  const gstRateStored = taxOut.snapshotRate

  const nextSeq = await allocateNextPosOrderSeq(transaction)
  const orderNo = `EW-ORD-${nextSeq}`

  const instantLines = linesNormalized.filter((l) => l.fulfillment === 'INSTANT')
  const labLines = linesNormalized.filter((l) => l.fulfillment === 'LAB')
  let orderKind = 'INSTANT'
  if (instantLines.length && labLines.length) orderKind = 'MIXED'
  else if (labLines.length) orderKind = 'LAB'

  const rIns = new sql.Request(transaction)
  rIns.input('store_id', sql.Int, storeId)
  rIns.input('customer_id', sql.Int, customerId)
  rIns.input('created_by_user_id', sql.Int, employeeId || null)
  rIns.input('order_no', sql.NVarChar(50), orderNo)
  rIns.input('order_source', sql.NVarChar(20), value.order_source || 'POS')
  rIns.input('order_kind', sql.NVarChar(20), orderKind)
  rIns.input('rx_snapshot', sql.NVarChar(sql.MAX), value.rx_snapshot ? JSON.stringify(value.rx_snapshot) : null)
  rIns.input('gst_rate_snapshot', sql.Decimal(9, 4), gstRateStored)
  rIns.input('lab_advance_pct_snapshot', sql.Decimal(9, 2), advPct)
  rIns.input('procurement_mode_snapshot', sql.NVarChar(50), procurementMode)
  rIns.input('subtotal_amount', sql.Decimal(12, 2), subtotal)
  rIns.input('discount_amount', sql.Decimal(12, 2), discAmt)
  rIns.input('applied_offer_id', sql.Int, appliedOfferId || null)
  rIns.input('gst_amount', sql.Decimal(12, 2), gstAmount)
  rIns.input('total_amount', sql.Decimal(12, 2), totalAmount)
  rIns.input('inventory_committed', sql.Bit, inventoryDeferred ? 0 : 1)

  const insOrder = await rIns.query(`
    INSERT INTO ${t.orders} (
      store_id, customer_id, created_by_user_id, order_no, order_source, order_kind,
      rx_snapshot, gst_rate_snapshot, lab_advance_pct_snapshot, procurement_mode_snapshot,
      status, subtotal_amount, discount_amount, applied_offer_id, gst_amount, total_amount,
      inventory_committed
    ) VALUES (
      @store_id, @customer_id, @created_by_user_id, @order_no, @order_source, @order_kind,
      @rx_snapshot, @gst_rate_snapshot, @lab_advance_pct_snapshot, @procurement_mode_snapshot,
      N'OPEN', @subtotal_amount, @discount_amount, @applied_offer_id, @gst_amount, @total_amount,
      @inventory_committed
    );
    SELECT CAST(SCOPE_IDENTITY() AS INT) AS order_id;
  `)
  const orderId = insOrder.recordset[0].order_id

  const tupleMap = new Map()
  for (const ln of linesNormalized) {
    const pix = sanitizePairIndex(ln.pair_index, 1)
    const key = `${pix}_${ln.fulfillment}`
    if (!tupleMap.has(key)) {
      tupleMap.set(key, {
        pair_index: pix,
        fulfillment: ln.fulfillment,
        lab_workflow_seed: ln.fulfillment === 'LAB' ? 'ORDER_PLACED' : null
      })
    }
  }
  const tuples = Array.from(tupleMap.values()).sort((a, b) => {
    if (a.pair_index !== b.pair_index) return a.pair_index - b.pair_index
    return a.fulfillment === 'LAB' ? 1 : -1
  })

  const tupleKeyToSubOrderId = {}
  let tupleSort = 0
  for (const tup of tuples) {
    const rSub = new sql.Request(transaction)
    rSub.input('order_id', sql.Int, orderId)
    rSub.input('fulfillment', sql.NVarChar(10), tup.fulfillment)
    rSub.input('sort_order', sql.Int, ++tupleSort)
    rSub.input('pair_index', sql.Int, tup.pair_index)
    rSub.input('lab_st', sql.NVarChar(30), tup.lab_workflow_seed || null)
    const subIns = await rSub.query(`
      INSERT INTO ${t.sub_orders} (order_id, fulfillment, lab_workflow_status, sort_order, pair_index, handover_status)
      VALUES (@order_id, @fulfillment, @lab_st, @sort_order, @pair_index, NULL);
      SELECT CAST(SCOPE_IDENTITY() AS INT) AS sub_order_id;
    `)
    const newId = subIns.recordset[0].sub_order_id
    tupleKeyToSubOrderId[`${tup.pair_index}_${tup.fulfillment}`] = newId
  }

  for (const line of linesNormalized) {
    const pix = sanitizePairIndex(line.pair_index, 1)
    const tupleKey = `${pix}_${line.fulfillment}`
    const subOrderId = tupleKeyToSubOrderId[tupleKey]
    if (!subOrderId) {
      const err = new Error(`Internal: missing sub-order for pair ${tupleKey}`)
      err.statusCode = 500
      throw err
    }
    let lineUnit = Number(line.unit_price) || 0
    let lensJson = null
    if (line.fulfillment === 'LAB' && line.lens_bundle) {
      const b = line.lens_bundle
      const lensPrice = Number(b.package_price) || 0
      const addonSum = (b.addon_prices || []).reduce((s, p) => s + (Number(p) || 0), 0)
      lineUnit = lineUnit + lensPrice + addonSum
      lensJson = JSON.stringify(b)
    }
    const lineTotal = roundMoney(lineUnit * line.qty)
    const needsUnit = lineRequiresUnitBarcode(cfg, line.product_type)
    const unitId = needsUnit && line.unit_id != null ? Number(line.unit_id) : null

    if (needsUnit && unitId) {
      const rUnit = new sql.Request(transaction)
      rUnit.input('unit_id', sql.Int, unitId)
      rUnit.input('sku_id', sql.Int, line.sku_id)
      const unitRes = await rUnit.query(`
        SELECT unit_id, sku_id, status, location_type, location_id
        FROM dbo.sku_units
        WHERE unit_id = @unit_id AND sku_id = @sku_id
      `)
      const unitRow = unitRes.recordset && unitRes.recordset[0]
      if (!unitRow) {
        const err = new Error('Unit barcode does not match this product line.')
        err.statusCode = 400
        throw err
      }
      const unitStatus = String(unitRow.status || '').toUpperCase()
      const unitLocType = String(unitRow.location_type || '').toUpperCase()
      const unitLocId = unitRow.location_id != null ? Number(unitRow.location_id) : null
      const atSellingStore =
        unitStatus === 'AT_STORE' &&
        unitLocType === 'STORE' &&
        unitLocId === storeId
      if (!atSellingStore) {
        const err = new Error(
          unitStatus === 'AVAILABLE'
            ? 'This unit is still at the warehouse. Transfer and stock-in at this store before selling.'
            : 'This unit is not available for sale at this store.'
        )
        err.statusCode = 400
        throw err
      }
    }

    const rStock = new sql.Request(transaction)
    rStock.input('sku_id', sql.Int, line.sku_id)
    rStock.input('store_id', sql.Int, storeId)
    rStock.input('qty', sql.Int, line.qty)
    const stockRes = await rStock.query(`
      SELECT balance_id, qty FROM dbo.stock_balances
      WHERE sku_id = @sku_id AND location_type = N'STORE' AND location_id = @store_id
    `)
    const sb = stockRes.recordset[0]
    if (!sb || sb.qty < line.qty) {
      const err = new Error(`Insufficient stock for SKU ${line.sku_id} at this store.`)
      err.statusCode = 400
      throw err
    }
    if (!inventoryDeferred) {
      await rStock.query(`
        UPDATE dbo.stock_balances
        SET qty = qty - @qty,
            last_updated = DATEADD(MINUTE,330,SYSUTCDATETIME())
        WHERE sku_id = @sku_id AND location_type = N'STORE' AND location_id = @store_id AND qty >= @qty
      `)
    }

    const rItem = new sql.Request(transaction)
    rItem.input('sub_order_id', sql.Int, subOrderId)
    rItem.input('sku_id', sql.Int, line.sku_id)
    rItem.input('qty', sql.Int, line.qty)
    rItem.input('unit_price', sql.Decimal(12, 2), lineUnit)
    rItem.input('line_total', sql.Decimal(12, 2), lineTotal)
    rItem.input('product_type', sql.NVarChar(50), line.product_type)
    rItem.input('fulfillment', sql.NVarChar(10), line.fulfillment)
    rItem.input('line_key', sql.NVarChar(300), line.line_key)
    rItem.input('lens_bundle', sql.NVarChar(sql.MAX), lensJson)
    const itemIns = await rItem.query(`
      INSERT INTO ${t.order_items} (
        sub_order_id, sku_id, qty, unit_price, line_total, product_type, fulfillment, line_key, lens_bundle
      ) VALUES (
        @sub_order_id, @sku_id, @qty, @unit_price, @line_total, @product_type, @fulfillment, @line_key, @lens_bundle
      );
      SELECT CAST(SCOPE_IDENTITY() AS INT) AS order_item_id;
    `)
    const orderItemId = itemIns.recordset && itemIns.recordset[0]
      ? itemIns.recordset[0].order_item_id
      : null

    if (needsUnit && unitId && orderItemId) {
      const rMark = new sql.Request(transaction)
      rMark.input('unit_id', sql.Int, unitId)
      rMark.input('order_id', sql.Int, orderId)
      rMark.input('order_item_id', sql.Int, orderItemId)
      rMark.input('store_id', sql.Int, storeId)
      const markRes = await rMark.query(`
        UPDATE dbo.sku_units
        SET status = N'SOLD',
            sold_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()),
            sold_store_id = @store_id,
            order_id = @order_id,
            order_item_id = @order_item_id
        WHERE unit_id = @unit_id
          AND status = N'AT_STORE'
          AND location_type = N'STORE'
          AND location_id = @store_id;
        SELECT @@ROWCOUNT AS rows_updated;
      `)
      const updated = markRes.recordset && markRes.recordset[0]
        ? Number(markRes.recordset[0].rows_updated)
        : 0
      if (updated !== 1) {
        const err = new Error('Unit barcode is no longer available.')
        err.statusCode = 400
        throw err
      }
      const rOiu = new sql.Request(transaction)
      rOiu.input('order_item_id', sql.Int, orderItemId)
      rOiu.input('unit_id', sql.Int, unitId)
      await rOiu.query(`
        IF OBJECT_ID(N'dbo.order_item_units', N'U') IS NOT NULL
          INSERT INTO dbo.order_item_units (order_item_id, unit_id)
          VALUES (@order_item_id, @unit_id);
      `)
    }
  }

  const rLog = new sql.Request(transaction)
  rLog.input('order_id', sql.Int, orderId)
  rLog.input('actor_user_id', sql.Int, employeeId || null)
  await rLog.query(`
    INSERT INTO ${t.order_status_log} (order_id, sub_order_id, from_status, to_status, actor_user_id, note)
    VALUES (@order_id, NULL, NULL, N'CREATED', @actor_user_id, NULL)
  `)

  const subOrdersOut = []
  for (const tup of tuples) {
    subOrdersOut.push({
      sub_order_id: tupleKeyToSubOrderId[`${tup.pair_index}_${tup.fulfillment}`],
      fulfillment: tup.fulfillment,
      lab_workflow_status: tup.lab_workflow_seed,
      pair_index: tup.pair_index
    })
  }

  return {
    order_id: orderId,
    order_no: orderNo,
    order_kind: orderKind,
    subtotal_amount: subtotal,
    discount_amount: discAmt,
    gst_amount: gstAmount,
    total_amount: totalAmount,
    sub_orders: subOrdersOut
  }
}

function orderRowNeedsInventoryCommit(orderRow) {
  if (!orderRow) return false
  const v = orderRow.inventory_committed
  return v === false || v === 0
}

/**
 * Deduct stock for orders that used inventory_deferred=true (stock not taken at insert).
 * New POS orders use commit-at-order-time; then inventory_committed is already 1 and this no-ops.
 * @param {import('mssql').ConnectionPool} pool
 */
async function commitInventoryForPaidOrder(pool, mode, storeId, orderId) {
  const t = tableNames(mode)
  const chk = await pool.request()
    .input('oid', sql.Int, orderId)
    .input('sid', sql.Int, storeId)
    .query(`
      SELECT inventory_committed FROM ${t.orders}
      WHERE order_id = @oid AND store_id = @sid
    `)
  const head = chk.recordset && chk.recordset[0]
  if (!head || !orderRowNeedsInventoryCommit(head)) return

  const trx = new sql.Transaction(pool)
  await trx.begin()
  try {
    const items = await new sql.Request(trx)
      .input('oid', sql.Int, orderId)
      .query(`
        SELECT i.sku_id, i.qty
        FROM ${t.order_items} i
        INNER JOIN ${t.sub_orders} s ON s.sub_order_id = i.sub_order_id
        WHERE s.order_id = @oid
      `)
    for (const row of items.recordset || []) {
      const skuId = Number(row.sku_id)
      const qty = Number(row.qty) || 0
      if (!Number.isFinite(skuId) || skuId <= 0 || qty <= 0) continue
      const rStock = new sql.Request(trx)
      rStock.input('sku_id', sql.Int, skuId)
      rStock.input('store_id', sql.Int, storeId)
      rStock.input('qty', sql.Int, qty)
      const stockRes = await rStock.query(`
        SELECT balance_id, qty FROM dbo.stock_balances
        WHERE sku_id = @sku_id AND location_type = N'STORE' AND location_id = @store_id
      `)
      const sb = stockRes.recordset[0]
      if (!sb || sb.qty < qty) {
        const err = new Error(`Insufficient stock for SKU ${skuId} at this store (post-payment commit).`)
        err.statusCode = 400
        throw err
      }
      await rStock.query(`
        UPDATE dbo.stock_balances
        SET qty = qty - @qty,
            last_updated = DATEADD(MINUTE,330,SYSUTCDATETIME())
        WHERE sku_id = @sku_id AND location_type = N'STORE' AND location_id = @store_id AND qty >= @qty
      `)
    }
    await new sql.Request(trx)
      .input('oid', sql.Int, orderId)
      .query(`UPDATE ${t.orders} SET inventory_committed = 1 WHERE order_id = @oid`)
    await trx.commit()
  } catch (e) {
    await trx.rollback()
    throw e
  }
}

/**
 * @param {import('mssql').ConnectionPool} pool
 */
async function recordPayment(pool, mode, storeId, employeeId, body, options = {}) {
  const bundle = await fetchOrderBundle(pool, body.order_id, storeId, mode)
  if (!bundle) {
    const err = new Error('Order not found for this store.')
    err.statusCode = 404
    throw err
  }
  assertPosOrderCreatorMutation(bundle.order, options.actorUserId, {
    bypass: Boolean(options.allowMutationBypass)
  })
  const orderRow = bundle.order
  const summary = bundle.payment_summary
  const check = validatePaymentAgainstSummary(orderRow, summary, body)
  if (!check.ok) {
    const err = new Error(check.message)
    err.statusCode = 400
    throw err
  }

  const { tendered, changeGiven } = preparePaymentTenderFields(body)
  await insertPaymentRow(pool, mode, body.order_id, employeeId, body, tendered, changeGiven)
  const fin = await finalizePaymentAfterInsert(pool, mode, storeId, body.order_id, body, employeeId)
  return {
    message: 'Payment recorded.',
    payment_summary: fin.payment_summary,
    invoice_no: fin.invoice_no
  }
}

async function insertStatusLog(pool, t, {
  orderId,
  subOrderId,
  fromStatus,
  toStatus,
  actorUserId,
  note
}) {
  await pool.request()
    .input('order_id', sql.Int, orderId)
    .input('sub_order_id', sql.Int, subOrderId || null)
    .input('from_status', sql.NVarChar(30), fromStatus || null)
    .input('to_status', sql.NVarChar(30), toStatus)
    .input('actor_user_id', sql.Int, actorUserId || null)
    .input('note', sql.NVarChar(500), note || null)
    .query(`
      INSERT INTO ${t.order_status_log} (order_id, sub_order_id, from_status, to_status, actor_user_id, note)
      VALUES (@order_id, @sub_order_id, @from_status, @to_status, @actor_user_id, @note)
    `)
}

/** @returns {Promise<string|null>} */
async function fetchInvoiceNoForOrderId(pool, orderId) {
  const oid = Number(orderId)
  if (!Number.isFinite(oid) || oid < 1) return null
  const hasPosInvoiceTable = await pool.request().query(`
    SELECT CASE WHEN OBJECT_ID('dbo.pos_invoices', 'U') IS NULL THEN 0 ELSE 1 END AS ok
  `)
  if (Number((hasPosInvoiceTable.recordset || [])[0] && hasPosInvoiceTable.recordset[0].ok) !== 1) {
    return null
  }
  const r = await pool.request().input('oid', sql.Int, oid).query(`
    SELECT TOP 1 invoice_no FROM dbo.pos_invoices WHERE order_id = @oid ORDER BY invoice_no
  `)
  const row = (r.recordset || [])[0]
  return row && row.invoice_no ? String(row.invoice_no).trim() : null
}

/**
 * Insert dbo.pos_invoices row when the table exists (IF NOT EXISTS by order_id).
 * @returns {Promise<string>}
 */
async function insertPosInvoiceIfAbsent(pool, order, options = {}) {
  const prefixRaw = await readSetting(pool, 'pos_invoice_prefix')
  const prefix = String(prefixRaw || 'EW-INV-')
  const invoiceNo = prefix + String(order.order_no || order.order_id)

  const prefsObj = normalizeInvoicePreferencesForStorage(options && options.invoice_preferences)
  const prefsJson = prefsObj ? JSON.stringify(prefsObj) : null

  const hasPosInvoiceTable = await pool.request().query(`
    SELECT CASE WHEN OBJECT_ID('dbo.pos_invoices', 'U') IS NULL THEN 0 ELSE 1 END AS ok
  `)
  if (Number((hasPosInvoiceTable.recordset || [])[0] && hasPosInvoiceTable.recordset[0].ok) !== 1) {
    return invoiceNo
  }

  const colRow = await pool.request().query(`
    SELECT CASE WHEN COL_LENGTH('dbo.pos_invoices', 'invoice_display_json') IS NULL THEN 0 ELSE 1 END AS has_json
  `)
  const hasJsonCol = Number((colRow.recordset || [])[0] && colRow.recordset[0].has_json) === 1
  const req = pool.request()
    .input('oid', sql.Int, order.order_id)
    .input('invoice_no', sql.NVarChar(50), invoiceNo)
    .input(
      'taxable_amount',
      sql.Decimal(12, 2),
      roundMoney(Number(order.total_amount) - Number(order.gst_amount || 0))
    )
    .input('gst_amount', sql.Decimal(12, 2), Number(order.gst_amount) || 0)
    .input('total_amount', sql.Decimal(12, 2), Number(order.total_amount) || 0)

  if (hasJsonCol) {
    req.input('invoice_display_json', sql.NVarChar(sql.MAX), prefsJson)
    await req.query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.pos_invoices WHERE order_id = @oid)
      BEGIN
        INSERT INTO dbo.pos_invoices (order_id, invoice_no, taxable_amount, gst_amount, total_amount, invoice_display_json)
        VALUES (@oid, @invoice_no, @taxable_amount, @gst_amount, @total_amount, @invoice_display_json)
      END
    `)
  } else {
    await req.query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.pos_invoices WHERE order_id = @oid)
      BEGIN
        INSERT INTO dbo.pos_invoices (order_id, invoice_no, taxable_amount, gst_amount, total_amount)
        VALUES (@oid, @invoice_no, @taxable_amount, @gst_amount, @total_amount)
      END
    `)
  }

  return invoiceNo
}

/**
 * Consolidated finalize: full payment + INSTANT HANDED_OVER (when required) + LAB auto-invoice chain + invoice row.
 */
function shouldTreatPaymentStageForFinalizeLedger(orderKind, paymentStage, forceFinalize) {
  if (forceFinalize) return true
  const k = String(orderKind || '').trim().toUpperCase()
  const st = String(paymentStage || '').trim().toUpperCase()
  if (k === 'INSTANT') return st === 'FULL'
  return st === 'BALANCE' || st === 'FULL' || st === 'ADVANCE'
}

/**
 * Atomically advances all LAB sub-orders through the terminal handover tail:
 *   READY_FOR_DELIVERY → DELIVERED + BALANCE_COLLECTED (joint event) → INVOICED
 *
 * DELIVERED and BALANCE_COLLECTED are a single counter-handover moment — the customer
 * pays balance and takes the order simultaneously. They are written as two audit log
 * entries within the same call for traceability, but this function is the ONLY code
 * path that sets these statuses. They must not be reachable via the lab-status API.
 *
 * Guard: only proceeds if the sub-order is at READY_FOR_DELIVERY (or already
 * DELIVERED in a retry scenario). Throws for any earlier status.
 */
async function advanceLabSubOrdersThroughInvoiced(pool, mode, labRows, order, employeeId) {
  const t = tableNames(mode)

  // Statuses from which the handover tail is valid to proceed.
  const HANDOVER_ALLOWED_FROM = new Set(['READY_FOR_DELIVERY', 'DELIVERED', 'BALANCE_COLLECTED'])

  for (const raw of labRows) {
    const sub = typeof raw.lab_workflow_status === 'undefined'
      ? raw
      : { sub_order_id: raw.sub_order_id, lab_workflow_status: raw.lab_workflow_status }
    const fromA = String(sub.lab_workflow_status || '').trim().toUpperCase()

    if (!HANDOVER_ALLOWED_FROM.has(fromA)) {
      const err = new Error(
        `Handover cannot complete: sub-order #${sub.sub_order_id} is at '${fromA}', ` +
        `expected READY_FOR_DELIVERY. Complete the lab workflow first.`
      )
      err.statusCode = 400
      throw err
    }

    // DELIVERED — first part of the joint handover event.
    if (fromA !== 'DELIVERED' && fromA !== 'BALANCE_COLLECTED') {
      await pool.request().input('sid', sql.Int, sub.sub_order_id)
        .query(`UPDATE ${t.sub_orders} SET lab_workflow_status = N'DELIVERED' WHERE sub_order_id = @sid`)
      await insertStatusLog(pool, t, {
        orderId: order.order_id,
        subOrderId: sub.sub_order_id,
        fromStatus: fromA || null,
        toStatus: 'DELIVERED',
        actorUserId: employeeId || null,
        note: 'Handover: order delivered to customer.'
      })
    }

    // BALANCE_COLLECTED — second part of the joint handover event (same counter action).
    if (fromA !== 'BALANCE_COLLECTED') {
      await pool.request().input('sid', sql.Int, sub.sub_order_id)
        .query(`UPDATE ${t.sub_orders} SET lab_workflow_status = N'BALANCE_COLLECTED' WHERE sub_order_id = @sid`)
      await insertStatusLog(pool, t, {
        orderId: order.order_id,
        subOrderId: sub.sub_order_id,
        fromStatus: 'DELIVERED',
        toStatus: 'BALANCE_COLLECTED',
        actorUserId: employeeId || null,
        note: 'Handover: balance collected from customer.'
      })
    }

    // INVOICED — terminal status.
    await pool.request().input('sid', sql.Int, sub.sub_order_id)
      .query(`UPDATE ${t.sub_orders} SET lab_workflow_status = N'INVOICED' WHERE sub_order_id = @sid`)
    await insertStatusLog(pool, t, {
      orderId: order.order_id,
      subOrderId: sub.sub_order_id,
      fromStatus: 'BALANCE_COLLECTED',
      toStatus: 'INVOICED',
      actorUserId: employeeId || null,
      note: 'Invoice generated.'
    })
  }

  await pool.request()
    .input('oid', sql.Int, order.order_id)
    .query(`UPDATE ${t.orders} SET status = N'COMPLETED' WHERE order_id = @oid`)
}

/**
 * Single entry for closing the bill after money is cleared (respects MIXED INSTANT HANDED_OVER).
 * @param {string|null} paymentStage POS payment stage OR null when forced (handover retries).
 */
async function finalizePaidOrderLedger(pool, mode, bundle, paymentStage, employeeId, options = {}) {
  const forceFinalize = !!options.forceFinalize
  const orderKind = String(bundle.order.order_kind || '').trim().toUpperCase()
  if (!shouldTreatPaymentStageForFinalizeLedger(orderKind, paymentStage, forceFinalize)) {
    return null
  }
  if (!bundle || Number(bundle.payment_summary.amount_remaining) > MONEY_EPS) return null

  const t = tableNames(mode)
  const oid = Number(bundle.order.order_id)
  const existingInvoice = await fetchInvoiceNoForOrderId(pool, oid)

  const headRs = await pool.request().input('oid', sql.Int, oid).query(`
    SELECT status FROM ${t.orders} WHERE order_id = @oid
  `)
  const dbStatus = String((headRs.recordset[0] && headRs.recordset[0].status) || '').trim().toUpperCase()

  const subFresh = await pool.request().input('oid', sql.Int, oid).query(`
    SELECT sub_order_id, fulfillment, lab_workflow_status, pair_index, handover_status
    FROM ${t.sub_orders} WHERE order_id = @oid
  `)
  const subsRows = subFresh.recordset || []

  if (orderKind === 'INSTANT') {
    for (const s of subsRows) {
      if (String(s.fulfillment) !== 'INSTANT') continue
      const curHo = String(s.handover_status || '').trim().toUpperCase()
      if (curHo === 'HANDED_OVER') continue
      await pool.request().input('sid', sql.Int, s.sub_order_id).query(`
        UPDATE ${t.sub_orders} SET handover_status = N'HANDED_OVER' WHERE sub_order_id = @sid
      `)
      await insertStatusLog(pool, t, {
        orderId: oid,
        subOrderId: s.sub_order_id,
        fromStatus: curHo || null,
        toStatus: 'HANDED_OVER',
        actorUserId: employeeId || null,
        note: 'Auto handover recorded on full payment.'
      })
    }
  }

  const instantBlocking = subsRows.filter((s) => String(s.fulfillment) === 'INSTANT'
    && String(s.handover_status || '').trim().toUpperCase() !== 'HANDED_OVER')
  if ((orderKind === 'LAB' || orderKind === 'MIXED') && instantBlocking.length) {
    return null
  }

  const labs = subsRows.filter((s) => String(s.fulfillment) === 'LAB')
  if ((orderKind === 'LAB' || orderKind === 'MIXED') && labs.length === 0) {
    return null
  }

  if (labs.length === 0) {
    await pool.request().input('oid', sql.Int, oid).query(`
      UPDATE ${t.orders} SET status = N'COMPLETED' WHERE order_id = @oid
    `)
    const inv = await insertPosInvoiceIfAbsent(pool, bundle.order, options)
    return existingInvoice || inv
  }

  if (existingInvoice && dbStatus === 'COMPLETED') {
    return existingInvoice
  }

  await advanceLabSubOrdersThroughInvoiced(pool, mode, labs, bundle.order, employeeId)
  return insertPosInvoiceIfAbsent(pool, bundle.order, options)
}

async function completeInstantSettlement(pool, mode, bundle, _employeeId, options = {}) {
  const kind = String(bundle.order.order_kind || '').trim().toUpperCase()
  if (kind !== 'INSTANT') {
    const err = new Error('Instant order settlement applies only when order_kind is INSTANT.')
    err.statusCode = 400
    throw err
  }
  const inv = await finalizePaidOrderLedger(pool, mode, bundle, null, _employeeId, { ...options, forceFinalize: true })
  if (!inv) {
    const err = new Error('Order is not eligible for invoicing (balance due or prerequisites not met).')
    err.statusCode = 400
    throw err
  }
  return inv
}

async function autoCompleteLabSettlement(pool, mode, bundle, employeeId, options = {}) {
  const labs = (bundle.subList || []).filter((sub) => String(sub.fulfillment || '') === 'LAB')
  if (!labs.length) return null
  return finalizePaidOrderLedger(pool, mode, bundle, null, employeeId, { ...options, forceFinalize: true })
}

async function markInstantSubOrderHandedOver(pool, mode, orderId, storeId, subOrderId, employeeId, options = {}) {
  const bundle = await fetchOrderBundle(pool, orderId, storeId, mode)
  if (!bundle) {
    const err = new Error('Order not found for this store.')
    err.statusCode = 404
    throw err
  }
  const t = tableNames(mode)
  const sel = await pool.request()
    .input('sid', sql.Int, subOrderId)
    .input('oid', sql.Int, orderId)
    .query(`
      SELECT sub_order_id, order_id, fulfillment, handover_status
      FROM ${t.sub_orders}
      WHERE sub_order_id = @sid AND order_id = @oid
    `)
  const subRow = sel.recordset[0]
  if (!subRow || String(subRow.fulfillment) !== 'INSTANT') {
    const err = new Error('Instant sub-order required.')
    err.statusCode = 400
    throw err
  }
  const prev = String(subRow.handover_status || '').trim().toUpperCase()
  await pool.request().input('sid', sql.Int, subOrderId).query(`
    UPDATE ${t.sub_orders} SET handover_status = N'HANDED_OVER' WHERE sub_order_id = @sid
  `)
  await insertStatusLog(pool, t, {
    orderId,
    subOrderId,
    fromStatus: prev || null,
    toStatus: 'HANDED_OVER',
    actorUserId: employeeId || null,
    note: options.note || null
  })
  const again = await fetchOrderBundle(pool, orderId, storeId, mode)
  const invoiceNo = await finalizePaidOrderLedger(pool, mode, again, null, employeeId, {
    invoice_preferences: options.invoice_preferences,
    forceFinalize: true
  })
  return {
    invoice_no: invoiceNo,
    payment_summary: again.payment_summary
  }
}

function labIntakeBitOn(v) {
  if (v === true) return true
  const n = Number(v)
  return Number.isFinite(n) && n === 1
}

/** HQ intake while lab_workflow_status = SENT_TO_LAB — flags only (no workflow row change). */
async function patchLabSubOrderIntake(pool, mode, {
  orderId,
  storeId,
  subOrderId,
  allowCrossStoreLab,
  receivedAtLab,
  backorderCreated
}) {
  const t = tableNames(mode)
  const ord = await pool.request()
    .input('oid', sql.Int, orderId)
    .query(`SELECT order_id, store_id FROM ${t.orders} WHERE order_id = @oid`)
  const orderRow = ord.recordset[0]
  if (!orderRow) {
    const err = new Error('Order not found.')
    err.statusCode = 404
    throw err
  }
  if (!allowCrossStoreLab) {
    const sid = storeId != null ? Number(storeId) : null
    const orderSid = orderRow.store_id != null ? Number(orderRow.store_id) : null
    if (sid === null || orderSid === null || sid !== orderSid) {
      const err = new Error('Order not found for this store.')
      err.statusCode = 404
      throw err
    }
  }

  const setReceived = receivedAtLab === true
  const setBackorder = backorderCreated === true
  if ((setReceived && setBackorder) || (!setReceived && !setBackorder)) {
    const err = new Error('Set exactly one of received_at_lab or backorder_created to true.')
    err.statusCode = 400
    throw err
  }

  const sel = await pool.request()
    .input('sid', sql.Int, subOrderId)
    .input('oid', sql.Int, orderId)
    .query(`
      SELECT sub_order_id, order_id, fulfillment, lab_workflow_status,
             lab_received_confirmed, lab_backorder_confirmed
      FROM ${t.sub_orders}
      WHERE sub_order_id = @sid AND order_id = @oid
    `)
  const subRow = sel.recordset[0]
  if (!subRow || subRow.fulfillment !== 'LAB') {
    const err = new Error('Lab sub-order required.')
    err.statusCode = 400
    throw err
  }
  if (String(subRow.lab_workflow_status || '') !== 'SENT_TO_LAB') {
    const err = new Error('Intake checkpoints only apply while status is Sent To Lab.')
    err.statusCode = 400
    throw err
  }

  let res
  if (setReceived) {
    res = await pool.request()
      .input('sid', sql.Int, subOrderId)
      .input('oid', sql.Int, orderId)
      .query(`
        UPDATE ${t.sub_orders}
        SET lab_received_confirmed = 1,
            lab_received_confirmed_at = COALESCE(lab_received_confirmed_at, DATEADD(MINUTE, 330, SYSUTCDATETIME()))
        WHERE sub_order_id = @sid AND order_id = @oid AND fulfillment = N'LAB' AND lab_workflow_status = N'SENT_TO_LAB'
      `)
  } else {
    res = await pool.request()
      .input('sid', sql.Int, subOrderId)
      .input('oid', sql.Int, orderId)
      .query(`
        UPDATE ${t.sub_orders}
        SET lab_backorder_confirmed = 1,
            lab_backorder_confirmed_at = COALESCE(lab_backorder_confirmed_at, DATEADD(MINUTE, 330, SYSUTCDATETIME()))
        WHERE sub_order_id = @sid AND order_id = @oid AND fulfillment = N'LAB' AND lab_workflow_status = N'SENT_TO_LAB'
      `)
  }
  if (!Number((res.rowsAffected || [])[0])) {
    const err = new Error('Could not update intake.')
    err.statusCode = 400
    throw err
  }

  const again = await pool.request()
    .input('sid', sql.Int, subOrderId)
    .input('oid', sql.Int, orderId)
    .query(`
      SELECT lab_received_confirmed, lab_backorder_confirmed
      FROM ${t.sub_orders}
      WHERE sub_order_id = @sid AND order_id = @oid
    `)
  const rr = again.recordset[0] || {}
  return {
    message: 'Lab intake saved.',
    lab_received_confirmed: labIntakeBitOn(rr.lab_received_confirmed),
    lab_backorder_confirmed: labIntakeBitOn(rr.lab_backorder_confirmed)
  }
}

/**
 * @param {Function} executeStoredProcedure
 * @param {boolean} [params.allowCrossStoreLab] — Foundry / Command Unit act on all stores; skip store_id match
 */
async function updateLabSubOrderStatus(pool, mode, executeStoredProcedure, {
  orderId,
  storeId,
  employeeId,
  actorRole,
  subOrderId,
  toStatus,
  note,
  allowCrossStoreLab = false,
  bypassOrderSiblingGuard = false,
  bypassReason = null
}) {
  const t = tableNames(mode)
  const ord = await pool.request()
    .input('oid', sql.Int, orderId)
    .query(`SELECT order_id, store_id FROM ${t.orders} WHERE order_id = @oid`)
  const orderRow = ord.recordset[0]
  if (!orderRow) {
    const err = new Error('Order not found.')
    err.statusCode = 404
    throw err
  }
  if (!allowCrossStoreLab) {
    const sid = storeId != null ? Number(storeId) : null
    const orderSid = orderRow.store_id != null ? Number(orderRow.store_id) : null
    if (sid === null || orderSid === null || sid !== orderSid) {
      const err = new Error('Order not found for this store.')
      err.statusCode = 404
      throw err
    }
  }

  const sub = await pool.request()
    .input('sid', sql.Int, subOrderId)
    .input('oid', sql.Int, orderId)
    .query(`
      SELECT sub_order_id, order_id, fulfillment, lab_workflow_status, pair_index,
             lab_received_confirmed, lab_backorder_confirmed
      FROM ${t.sub_orders}
      WHERE sub_order_id = @sid AND order_id = @oid
    `)
  const subRow = sub.recordset[0]
  if (!subRow || subRow.fulfillment !== 'LAB') {
    const err = new Error('Lab sub-order required.')
    err.statusCode = 400
    throw err
  }

  const fromStatus = String(subRow.lab_workflow_status || '').trim().toUpperCase()
  const toUp = String(toStatus || '').trim().toUpperCase()

  let blockingPeersForBypass = []
  if (LAB_SIBLING_DISPATCH_GUARD_TARGETS.has(toUp)) {
    const pairIxNum = subRow.pair_index != null ? Number(subRow.pair_index) : 1
    const peersSamePair = await fetchLabSiblingPeersSamePair(pool, t, orderId, pairIxNum, subOrderId)
    blockingPeersForBypass = blockingLabPeersNotDispatchReady(peersSamePair)
    if (blockingPeersForBypass.length && !bypassOrderSiblingGuard) {
      const ge = new Error(formatLabSiblingGuardError(blockingPeersForBypass))
      ge.statusCode = 400
      throw ge
    }
  }

  const rawNoteTrim = note && String(note).trim() ? String(note).trim() : ''

  if (fromStatus === 'SENT_TO_LAB' && toUp === 'LAB_FITTING') {
    const lr = labIntakeBitOn(subRow.lab_received_confirmed)
    const lb = labIntakeBitOn(subRow.lab_backorder_confirmed)
    if (!lr || !lb) {
      const ge = new Error('Complete Received at Lab and Backorder Created before Fitting & Edging.')
      ge.statusCode = 400
      throw ge
    }
  }

  const val = await executeStoredProcedure('sp_POS_ValidateLabTransition', {
    from_status: { type: sql.VarChar(30), value: fromStatus },
    to_status:   { type: sql.VarChar(30), value: toUp },
    actor_role:  { type: sql.VarChar(50), value: actorRole }
  })
  const vr = (val.recordset || [])[0] || {}
  const cnt = Number(vr.transition_count) || 0
  const needsNote = Number(vr.requires_note) === 1
  if (!cnt) {
    const err = new Error(`Transition not allowed: ${fromStatus} → ${toUp} (actor: ${actorRole})`)
    err.statusCode = 400
    throw err
  }
  if (needsNote && !rawNoteTrim) {
    const err = new Error('Note is required for this transition.')
    err.statusCode = 400
    throw err
  }

  const usedSiblingBypass = !!(bypassOrderSiblingGuard && blockingPeersForBypass.length)
  const effectiveNote = mergeSiblingGuardBypassNote(
    rawNoteTrim,
    usedSiblingBypass,
    bypassReason,
    blockingPeersForBypass
  )

  await pool.request()
    .input('sid', sql.Int, subOrderId)
    .input('st', sql.NVarChar(30), toStatus)
    .query(`UPDATE ${t.sub_orders} SET lab_workflow_status = @st WHERE sub_order_id = @sid`)

  await pool.request()
    .input('order_id', sql.Int, orderId)
    .input('sub_order_id', sql.Int, subOrderId)
    .input('from_status', sql.NVarChar(30), fromStatus || null)
    .input('to_status', sql.NVarChar(30), toStatus)
    .input('actor_user_id', sql.Int, employeeId || null)
    .input('note', sql.NVarChar(500), effectiveNote || null)
    .query(`
      INSERT INTO ${t.order_status_log} (order_id, sub_order_id, from_status, to_status, actor_user_id, note)
      VALUES (@order_id, @sub_order_id, @from_status, @to_status, @actor_user_id, @note)
    `)

  // QC Fail is recorded in the timeline but the order stays in "At Lab" (LAB_FITTING).
  // Immediately auto-revert so the order never leaves the At Lab queue.
  if (toUp === 'QC_FAIL_LAB') {
    await pool.request()
      .input('sid', sql.Int, subOrderId)
      .query(`UPDATE ${t.sub_orders} SET lab_workflow_status = N'LAB_FITTING' WHERE sub_order_id = @sid`)
    await pool.request()
      .input('order_id', sql.Int, orderId)
      .input('sub_order_id', sql.Int, subOrderId)
      .input('actor_user_id', sql.Int, employeeId || null)
      .query(`
        INSERT INTO ${t.order_status_log} (order_id, sub_order_id, from_status, to_status, actor_user_id, note)
        VALUES (@order_id, @sub_order_id, N'QC_FAIL_LAB', N'LAB_FITTING', @actor_user_id, N'Auto-returned to Fitting & Edging after QC Fail.')
      `)
    return { message: 'QC Fail recorded. Order returned to Fitting & Edging.', from_status: fromStatus, to_status: 'LAB_FITTING' }
  }

  return { message: 'Status updated.', from_status: fromStatus, to_status: toStatus }
}

/**
 * Append Store OS queue-tab filters (see posOrderQueueCatalog).
 * @param {string} query
 * @param {{ sub_orders: string, order_status_log: string }} t
 * @param {{
 *   labStatusIncludes?: string[],
 *   labStatusExcludesUnion?: string[],
 *   invoicedSinceDays?: number|null,
 *   activeQueue?: boolean,
 *   transitRequiresPayment?: boolean
 * }} opts
 * @param {string} [paramPrefix]
 * @returns {{ query: string, labInParams: string[], labExUnionParams: string[], invoicedDaysParam: string|null }}
 */
function appendPosOrderQueueFilters(query, t, opts, paramPrefix = '') {
  const pfx = paramPrefix || ''
  const labInParams = []
  const labExUnionParams = []
  let invoicedDaysParam = null
  let q = query

  const includes = Array.isArray(opts.labStatusIncludes)
    ? opts.labStatusIncludes.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean)
    : []
  if (includes.length > 0) {
    const ph = []
    for (let i = 0; i < includes.length; i += 1) {
      const key = `${pfx}lab_in_${i}`
      ph.push(`@${key}`)
      labInParams.push(key)
    }
    q += ` AND EXISTS (
      SELECT 1 FROM ${t.sub_orders} lsi
      WHERE lsi.order_id = o.order_id
        AND lsi.fulfillment = N'LAB'
        AND lsi.lab_workflow_status IN (${ph.join(', ')})
    ) `
    if (opts.transitRequiresPayment) {
      q += ` AND ISNULL(pay_agg.paid_total, 0) > 0.02 `
    }
  }

  const exUnion = Array.isArray(opts.labStatusExcludesUnion)
    ? opts.labStatusExcludesUnion.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean)
    : []
  if (exUnion.length > 0 && !opts.activeQueue) {
    const ph = []
    for (let i = 0; i < exUnion.length; i += 1) {
      const key = `${pfx}lab_ex_u_${i}`
      ph.push(`@${key}`)
      labExUnionParams.push(key)
    }
    q += ` AND NOT EXISTS (
      SELECT 1 FROM ${t.sub_orders} lxu
      WHERE lxu.order_id = o.order_id
        AND lxu.fulfillment = N'LAB'
        AND lxu.lab_workflow_status IN (${ph.join(', ')})
    ) `
  }

  if (opts.activeQueue && exUnion.length > 0) {
    const ph = []
    for (let i = 0; i < exUnion.length; i += 1) {
      const key = `${pfx}lab_ex_u_${i}`
      ph.push(`@${key}`)
      if (!labExUnionParams.includes(key)) labExUnionParams.push(key)
    }
    q += ` AND (
      (o.status = N'OPEN' AND ISNULL(pay_agg.paid_total, 0) <= 0.02)
      OR (o.order_kind = N'INSTANT' AND o.status = N'OPEN')
      OR (
        EXISTS (
          SELECT 1 FROM ${t.sub_orders} so_act
          WHERE so_act.order_id = o.order_id AND so_act.fulfillment = N'LAB'
        )
        AND NOT EXISTS (
          SELECT 1 FROM ${t.sub_orders} so_blk
          WHERE so_blk.order_id = o.order_id
            AND so_blk.fulfillment = N'LAB'
            AND so_blk.lab_workflow_status IN (${ph.join(', ')})
        )
      )
    ) `
  }

  const invDays = opts.invoicedSinceDays != null ? Number(opts.invoicedSinceDays) : null
  if (invDays != null && invDays > 0 && includes.includes('INVOICED')) {
    invoicedDaysParam = `${pfx}invoiced_days`
    q += ` AND EXISTS (
      SELECT 1 FROM ${t.order_status_log} lg
      WHERE lg.order_id = o.order_id
        AND lg.to_status = N'INVOICED'
        AND lg.created_at >= DATEADD(DAY, -@${invoicedDaysParam}, DATEADD(MINUTE, 330, SYSUTCDATETIME()))
    ) `
  }

  return { query: q, labInParams, labExUnionParams, invoicedDaysParam }
}

function bindPosOrderQueueFilterParams(req, t, opts, bindings) {
  const includes = Array.isArray(opts.labStatusIncludes)
    ? opts.labStatusIncludes.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean)
    : []
  for (let i = 0; i < bindings.labInParams.length; i += 1) {
    req.input(bindings.labInParams[i], sql.NVarChar(30), includes[i])
  }
  const exUnion = Array.isArray(opts.labStatusExcludesUnion)
    ? opts.labStatusExcludesUnion.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean)
    : []
  for (let i = 0; i < bindings.labExUnionParams.length; i += 1) {
    req.input(bindings.labExUnionParams[i], sql.NVarChar(30), exUnion[i])
  }
  if (bindings.invoicedDaysParam && opts.invoicedSinceDays != null) {
    req.input(bindings.invoicedDaysParam, sql.Int, Number(opts.invoicedSinceDays))
  }
}

/**
 * @param {import('mssql').ConnectionPool} pool
 */
async function fetchAllOrders(pool, mode, {
  search, statusFilter, orderKind, labStatusFilter,
  labStatusExcludes = [], limit = 100, excludeOrderStatuses = [],
  labStatusIncludes = [],
  labStatusExcludesUnion = [],
  invoicedSinceDays = null,
  activeQueue = false,
  transitRequiresPayment = false
}) {
  const t = tableNames(mode)
  const exStat = Array.isArray(excludeOrderStatuses)
    ? excludeOrderStatuses.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean)
    : []
  
  const queueOpts = {
    labStatusIncludes,
    labStatusExcludesUnion,
    invoicedSinceDays,
    activeQueue,
    transitRequiresPayment
  }
  let query = `
    SELECT o.order_id, o.store_id, o.order_no, o.status, o.order_kind, o.total_amount, o.subtotal_amount, o.gst_amount, o.created_at,
           o.created_by_user_id,
           c.full_name as customer_name, c.phone as customer_phone,
           s.store_name,
           ISNULL(pay_agg.paid_total, 0) AS paid_total,
           MAX(CASE WHEN so.fulfillment = 'LAB' THEN so.lab_workflow_status ELSE NULL END) AS lab_workflow_status,
           MIN(CASE WHEN so.fulfillment = N'LAB' THEN CAST(ISNULL(so.lab_received_confirmed, 0) AS INT) ELSE NULL END) AS lab_rcv_all,
           MIN(CASE WHEN so.fulfillment = N'LAB' THEN CAST(ISNULL(so.lab_backorder_confirmed, 0) AS INT) ELSE NULL END) AS lab_bo_all,
           MAX(CASE WHEN so.fulfillment = 'LAB' THEN so.sub_order_id ELSE NULL END) AS sub_order_id
    FROM ${t.orders} o
    LEFT JOIN dbo.pos_customers c ON o.customer_id = c.customer_id
    LEFT JOIN dbo.stores s ON o.store_id = s.store_id
    LEFT JOIN ${t.sub_orders} so ON so.order_id = o.order_id
    LEFT JOIN (
      SELECT order_id, SUM(amount) AS paid_total
      FROM ${t.payments}
      GROUP BY order_id
    ) pay_agg ON pay_agg.order_id = o.order_id
    WHERE 1=1
  `
  
  if (statusFilter) {
    query += ` AND o.status = @status `
  } else if (exStat.length) {
    const ph = []
    for (let i = 0; i < exStat.length; i += 1) {
      ph.push(`@oos_ex_${i}`)
    }
    query += ` AND o.status NOT IN (${ph.join(', ')}) `
  }

  if (orderKind) {
    if (String(orderKind).toUpperCase() === 'LAB') {
      query += ` AND EXISTS (
        SELECT 1 FROM ${t.sub_orders} so_kind_lab
        WHERE so_kind_lab.order_id = o.order_id AND so_kind_lab.fulfillment = N'LAB'
      ) `
    } else {
      query += ` AND o.order_kind = @order_kind `
    }
  }

  if (labStatusFilter) {
    query += ` AND EXISTS (
      SELECT 1 FROM ${t.sub_orders} ls
      WHERE ls.order_id = o.order_id
        AND ls.fulfillment = 'LAB'
        AND ls.lab_workflow_status = @lab_status
    ) `
  }

  if (Array.isArray(labStatusExcludes) && labStatusExcludes.length > 0) {
    const placeholders = []
    for (let i = 0; i < labStatusExcludes.length; i += 1) {
      const key = `lab_ex_${i}`
      placeholders.push(`@${key}`)
    }
    query += ` AND NOT EXISTS (
      SELECT 1 FROM ${t.sub_orders} lx
      WHERE lx.order_id = o.order_id
        AND lx.fulfillment = 'LAB'
        AND lx.lab_workflow_status IN (${placeholders.join(', ')})
    ) `
  }

  const queueBindings = appendPosOrderQueueFilters(query, t, queueOpts, 'all_')
  query = queueBindings.query
  
  if (search) {
    query += ` AND (o.order_no LIKE @search OR c.full_name LIKE @search OR c.phone LIKE @search OR s.store_name LIKE @search) `
  }
  
  query += ` GROUP BY o.order_id, o.store_id, o.order_no, o.status, o.order_kind, o.total_amount, o.subtotal_amount, o.gst_amount, o.created_at, o.created_by_user_id, c.full_name, c.phone, s.store_name, pay_agg.paid_total `
  query += ` ORDER BY o.created_at DESC OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY `
  
  const req = pool.request()
    .input('limit', sql.Int, limit)
    
  if (statusFilter) {
    req.input('status', sql.NVarChar(30), statusFilter)
  }
  if (orderKind && String(orderKind).toUpperCase() !== 'LAB') {
    req.input('order_kind', sql.NVarChar(20), orderKind)
  }
  if (labStatusFilter) {
    req.input('lab_status', sql.NVarChar(30), labStatusFilter)
  }
  if (Array.isArray(labStatusExcludes) && labStatusExcludes.length > 0) {
    for (let i = 0; i < labStatusExcludes.length; i += 1) {
      req.input(`lab_ex_${i}`, sql.NVarChar(30), labStatusExcludes[i])
    }
  }
  bindPosOrderQueueFilterParams(req, t, queueOpts, queueBindings)
  if (search) {
    req.input('search', sql.NVarChar(200), '%' + search + '%')
  }
  if (!statusFilter && exStat.length) {
    for (let i = 0; i < exStat.length; i += 1) {
      req.input(`oos_ex_${i}`, sql.NVarChar(30), exStat[i])
    }
  }
  
  const result = await req.query(query)
  const listRows = result.recordset || []
  const labMap = await fetchLabSubOrderSnapshotsForOrders(pool, t, listRows.map((r) => r.order_id))

  return listRows.map((row) => {
    const snaps = labMap.get(Number(row.order_id)) || []
    const lab_sub_orders = snaps.map((s) => ({
      sub_order_id: s.sub_order_id,
      lab_workflow_status: s.lab_workflow_status,
      pair_index: s.pair_index,
      lab_received_confirmed: s.lab_received_confirmed === true,
      lab_backorder_confirmed: s.lab_backorder_confirmed === true,
      sub_order_label: subOrderDisplayLabel(row.order_no, s.pair_index)
    }))
    const paidTotal = roundMoney(Number(row.paid_total) || 0)
    const totalAmt = Number(row.total_amount)
    const isUnpaid = paidTotal + MONEY_EPS < totalAmt
    const display = resolvePosOrderDisplayStatus({
      status: row.status,
      is_unpaid: isUnpaid,
      paid_total: paidTotal,
      total_amount: totalAmt
    })
    return {
      order_id: row.order_id,
      store_id: row.store_id,
      store_name: row.store_name || 'Unknown Store',
      order_no: row.order_no,
      status: row.status,
      display_status_key: display.display_status_key,
      display_status_label: display.display_status_label,
      display_status_css_class: display.display_status_css_class,
      order_kind: row.order_kind,
      created_by_user_id: row.created_by_user_id != null ? Number(row.created_by_user_id) : null,
      amount_paid: paidTotal,
      amount_remaining: Math.max(0, roundMoney(totalAmt - paidTotal)),
      is_unpaid: isUnpaid,
      lab_workflow_status: row.lab_workflow_status || null,
      sub_order_id: row.sub_order_id || null,
      lab_sub_orders,
      lab_received_confirmed: row.lab_rcv_all != null && Number(row.lab_rcv_all) === 1,
      lab_backorder_confirmed: row.lab_bo_all != null && Number(row.lab_bo_all) === 1,
      total_amount: totalAmt,
      subtotal_amount: Number(row.subtotal_amount),
      gst_amount: Number(row.gst_amount),
      created_at: row.created_at,
      customer_name: row.customer_name || 'Walk-in Customer',
      customer_phone: row.customer_phone || ''
    }
  })
}

/**
 * @param {import('mssql').ConnectionPool} pool
 */
async function fetchStoreOrders(pool, storeId, mode, {
  search, statusFilter, orderKind, labStatusFilter,
  labStatusExcludes = [], limit = 50, excludeOrderStatuses = [],
  unpaidDraftOnly = false,
  excludeUnpaidOpen = false,
  labStatusIncludes = [],
  labStatusExcludesUnion = [],
  invoicedSinceDays = null,
  activeQueue = false,
  transitRequiresPayment = false
}) {
  const t = tableNames(mode)
  const exStat = Array.isArray(excludeOrderStatuses)
    ? excludeOrderStatuses.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean)
    : []
  
  let query = `
    SELECT o.order_id, o.order_no, o.status, o.order_kind, o.total_amount, o.subtotal_amount, o.gst_amount, o.created_at,
           o.created_by_user_id,
           c.full_name as customer_name, c.phone as customer_phone,
           ISNULL(pay_agg.paid_total, 0) AS paid_total,
           MAX(CASE WHEN so.fulfillment = 'LAB' THEN so.lab_workflow_status ELSE NULL END) AS lab_workflow_status,
           MIN(CASE WHEN so.fulfillment = N'LAB' THEN CAST(ISNULL(so.lab_received_confirmed, 0) AS INT) ELSE NULL END) AS lab_rcv_all,
           MIN(CASE WHEN so.fulfillment = N'LAB' THEN CAST(ISNULL(so.lab_backorder_confirmed, 0) AS INT) ELSE NULL END) AS lab_bo_all,
           MAX(CASE WHEN so.fulfillment = 'LAB' THEN so.sub_order_id ELSE NULL END) AS sub_order_id
    FROM ${t.orders} o
    LEFT JOIN dbo.pos_customers c ON o.customer_id = c.customer_id
    LEFT JOIN ${t.sub_orders} so ON so.order_id = o.order_id
    LEFT JOIN (
      SELECT order_id, SUM(amount) AS paid_total
      FROM ${t.payments}
      GROUP BY order_id
    ) pay_agg ON pay_agg.order_id = o.order_id
    WHERE o.store_id = @sid
  `

  if (unpaidDraftOnly) {
    query += ` AND o.status = N'OPEN' AND ISNULL(pay_agg.paid_total, 0) <= 0.02 `
  } else if (excludeUnpaidOpen) {
    query += ` AND NOT (o.status = N'OPEN' AND ISNULL(pay_agg.paid_total, 0) < o.total_amount - 0.02) `
  }

  if (statusFilter) {
    query += ` AND o.status = @status `
  } else if (exStat.length && !unpaidDraftOnly) {
    const ph = []
    for (let i = 0; i < exStat.length; i += 1) {
      ph.push(`@ex_st_${i}`)
    }
    query += ` AND o.status NOT IN (${ph.join(', ')}) `
  }

  if (orderKind) {
    // Lab queue: include MIXED orders — they carry a LAB sub-order for workflow.
    if (String(orderKind).toUpperCase() === 'LAB') {
      query += ` AND EXISTS (
        SELECT 1 FROM ${t.sub_orders} so_kind_lab
        WHERE so_kind_lab.order_id = o.order_id AND so_kind_lab.fulfillment = N'LAB'
      ) `
    } else {
      query += ` AND o.order_kind = @order_kind `
    }
  }

  if (labStatusFilter) {
    query += ` AND EXISTS (
      SELECT 1 FROM ${t.sub_orders} ls
      WHERE ls.order_id = o.order_id
        AND ls.fulfillment = 'LAB'
        AND ls.lab_workflow_status = @lab_status
    ) `
  }

  if (Array.isArray(labStatusExcludes) && labStatusExcludes.length > 0) {
    const placeholders = []
    for (let i = 0; i < labStatusExcludes.length; i += 1) {
      const key = `lab_ex_${i}`
      placeholders.push(`@${key}`)
    }
    query += ` AND NOT EXISTS (
      SELECT 1 FROM ${t.sub_orders} lx
      WHERE lx.order_id = o.order_id
        AND lx.fulfillment = 'LAB'
        AND lx.lab_workflow_status IN (${placeholders.join(', ')})
    ) `
  }

  const queueOpts = {
    labStatusIncludes,
    labStatusExcludesUnion,
    invoicedSinceDays,
    activeQueue,
    transitRequiresPayment
  }
  const queueBindings = appendPosOrderQueueFilters(query, t, queueOpts, '')
  query = queueBindings.query
  
  if (search) {
    query += ` AND (o.order_no LIKE @search OR c.full_name LIKE @search OR c.phone LIKE @search) `
  }
  
  query += ` GROUP BY o.order_id, o.order_no, o.status, o.order_kind, o.total_amount, o.subtotal_amount, o.gst_amount, o.created_at, o.created_by_user_id, c.full_name, c.phone, pay_agg.paid_total `
  query += ` ORDER BY o.created_at DESC OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY `
  
  const req = pool.request()
    .input('sid', sql.Int, storeId)
    .input('limit', sql.Int, limit)
    
  if (statusFilter) {
    req.input('status', sql.NVarChar(30), statusFilter)
  }
  if (orderKind && String(orderKind).toUpperCase() !== 'LAB') {
    req.input('order_kind', sql.NVarChar(20), orderKind)
  }
  if (labStatusFilter) {
    req.input('lab_status', sql.NVarChar(30), labStatusFilter)
  }
  if (Array.isArray(labStatusExcludes) && labStatusExcludes.length > 0) {
    for (let i = 0; i < labStatusExcludes.length; i += 1) {
      req.input(`lab_ex_${i}`, sql.NVarChar(30), labStatusExcludes[i])
    }
  }
  bindPosOrderQueueFilterParams(req, t, queueOpts, queueBindings)
  if (search) {
    req.input('search', sql.NVarChar(200), '%' + search + '%')
  }
  if (!statusFilter && exStat.length) {
    for (let i = 0; i < exStat.length; i += 1) {
      req.input(`ex_st_${i}`, sql.NVarChar(30), exStat[i])
    }
  }
  
  const result = await req.query(query)
  const listRows = result.recordset || []
  const labMapSp = await fetchLabSubOrderSnapshotsForOrders(pool, t, listRows.map((r) => r.order_id))

  return listRows.map((row) => {
    const snaps = labMapSp.get(Number(row.order_id)) || []
    const lab_sub_orders = snaps.map((s) => ({
      sub_order_id: s.sub_order_id,
      lab_workflow_status: s.lab_workflow_status,
      pair_index: s.pair_index,
      lab_received_confirmed: s.lab_received_confirmed === true,
      lab_backorder_confirmed: s.lab_backorder_confirmed === true,
      sub_order_label: subOrderDisplayLabel(row.order_no, s.pair_index)
    }))
    const paidTotal = roundMoney(Number(row.paid_total) || 0)
    const totalAmt = Number(row.total_amount)
    const isUnpaid = paidTotal + MONEY_EPS < totalAmt
    const display = resolvePosOrderDisplayStatus({
      status: row.status,
      is_unpaid: isUnpaid,
      paid_total: paidTotal,
      total_amount: totalAmt
    })
    return {
      order_id: row.order_id,
      order_no: row.order_no,
      status: row.status,
      display_status_key: display.display_status_key,
      display_status_label: display.display_status_label,
      display_status_css_class: display.display_status_css_class,
      order_kind: row.order_kind,
      created_by_user_id: row.created_by_user_id != null ? Number(row.created_by_user_id) : null,
      amount_paid: paidTotal,
      amount_remaining: Math.max(0, roundMoney(totalAmt - paidTotal)),
      is_unpaid: isUnpaid,
      lab_workflow_status: row.lab_workflow_status || null,
      sub_order_id: row.sub_order_id || null,
      lab_sub_orders,
      lab_received_confirmed: row.lab_rcv_all != null && Number(row.lab_rcv_all) === 1,
      lab_backorder_confirmed: row.lab_bo_all != null && Number(row.lab_bo_all) === 1,
      total_amount: totalAmt,
      subtotal_amount: Number(row.subtotal_amount),
      gst_amount: Number(row.gst_amount),
      created_at: row.created_at,
      customer_name: row.customer_name || 'Walk-in Customer',
      customer_phone: row.customer_phone || ''
    }
  })
}

/**
 * Void a zero-payment OPEN orphan: CANCELLED + restore store stock and unit barcodes.
 * @param {import('mssql').ConnectionPool} pool
 */
async function voidUnpaidPosOrder(pool, mode, storeId, orderId, actorUserId, options = {}) {
  const bundle = await fetchOrderBundle(pool, orderId, storeId, mode)
  if (!bundle) {
    const err = new Error('Order not found for this store.')
    err.statusCode = 404
    throw err
  }
  const order = bundle.order
  const dbStatus = String(order.status || '').trim().toUpperCase()
  if (dbStatus === 'CANCELLED') {
    const err = new Error('This order is already cancelled.')
    err.statusCode = 400
    throw err
  }
  if (dbStatus !== 'OPEN') {
    const err = new Error('Only open orders with no payments can be voided.')
    err.statusCode = 400
    throw err
  }
  const paidTotal = roundMoney(Number(bundle.payment_summary && bundle.payment_summary.paid_total) || 0)
  if (paidTotal > MONEY_EPS) {
    const err = new Error('This order has payments recorded; void is only allowed for zero-payment bills.')
    err.statusCode = 400
    throw err
  }
  if ((bundle.payments || []).length > 0) {
    const err = new Error('This order has payment rows; void is only allowed for zero-payment bills.')
    err.statusCode = 400
    throw err
  }
  assertPosOrderCreatorMutation(order, actorUserId, { bypass: !!options.bypass })

  const t = tableNames(mode)
  const oid = Number(orderId)
  const inventoryCommitted = order.inventory_committed === true || order.inventory_committed === 1

  const trx = new sql.Transaction(pool)
  await trx.begin()
  try {
    const itemsRes = await new sql.Request(trx)
      .input('oid', sql.Int, oid)
      .query(`
        SELECT i.order_item_id, i.sku_id, i.qty
        FROM ${t.order_items} i
        INNER JOIN ${t.sub_orders} s ON s.sub_order_id = i.sub_order_id
        WHERE s.order_id = @oid
      `)
    const lineRows = itemsRes.recordset || []

    if (inventoryCommitted) {
      for (const row of lineRows) {
        const skuId = Number(row.sku_id)
        const qty = Number(row.qty) || 0
        if (!Number.isFinite(skuId) || skuId <= 0 || qty <= 0) continue
        const rStock = new sql.Request(trx)
        rStock.input('sku_id', sql.Int, skuId)
        rStock.input('store_id', sql.Int, storeId)
        rStock.input('qty', sql.Int, qty)
        const stockRes = await rStock.query(`
          SELECT balance_id, qty FROM dbo.stock_balances
          WHERE sku_id = @sku_id AND location_type = N'STORE' AND location_id = @store_id
        `)
        const sb = stockRes.recordset && stockRes.recordset[0]
        if (sb && sb.balance_id) {
          await rStock.query(`
            UPDATE dbo.stock_balances
            SET qty = qty + @qty,
                last_updated = DATEADD(MINUTE, 330, SYSUTCDATETIME())
            WHERE sku_id = @sku_id AND location_type = N'STORE' AND location_id = @store_id
          `)
        } else {
          await rStock.query(`
            INSERT INTO dbo.stock_balances (sku_id, location_type, location_id, qty, last_updated)
            VALUES (@sku_id, N'STORE', @store_id, @qty, DATEADD(MINUTE, 330, SYSUTCDATETIME()))
          `)
        }
      }
    }

    await new sql.Request(trx)
      .input('oid', sql.Int, oid)
      .input('store_id', sql.Int, storeId)
      .query(`
        UPDATE dbo.sku_units
        SET status = N'AT_STORE',
            sold_at = NULL,
            sold_store_id = NULL,
            order_id = NULL,
            order_item_id = NULL
        WHERE order_id = @oid
          AND sold_store_id = @store_id
          AND status = N'SOLD'
      `)

    await new sql.Request(trx)
      .input('oid', sql.Int, oid)
      .query(`UPDATE ${t.orders} SET status = N'CANCELLED' WHERE order_id = @oid`)

    const rLog = new sql.Request(trx)
    rLog.input('order_id', sql.Int, oid)
    rLog.input('actor_user_id', sql.Int, actorUserId || null)
    await rLog.query(`
      INSERT INTO ${t.order_status_log} (order_id, sub_order_id, from_status, to_status, actor_user_id, note)
      VALUES (@order_id, NULL, N'OPEN', N'CANCELLED', @actor_user_id, N'Void unpaid bill')
    `)

    await trx.commit()
  } catch (e) {
    await trx.rollback()
    throw e
  }

  return {
    order_id: oid,
    order_no: order.order_no,
    status: 'CANCELLED'
  }
}

/**
 * CX dashboard aggregates (all stores). Uses active customer count from pos_customers.
 * @param {import('mssql').ConnectionPool} pool
 */
async function fetchCxSummary(pool, mode) {
  const t = tableNames(mode)
  const q = `
    SELECT
      (SELECT COUNT(*) FROM dbo.pos_customers WHERE is_active = 1) AS total_customers,
      (SELECT COUNT(*) FROM ${t.orders}) AS total_orders,
      (SELECT ISNULL(SUM(total_amount), 0) FROM ${t.orders}) AS total_revenue,
      (SELECT COUNT(DISTINCT customer_id) FROM ${t.orders} WHERE customer_id IS NOT NULL) AS customers_with_orders
  `
  const result = await pool.request().query(q)
  const row = (result.recordset && result.recordset[0]) || {}
  const totalOrders = Number(row.total_orders) || 0
  const totalRevenue = Number(row.total_revenue) || 0
  const avgOrderValue = totalOrders > 0 ? roundMoney(totalRevenue / totalOrders) : 0
  return {
    total_customers: Number(row.total_customers) || 0,
    total_orders: totalOrders,
    total_revenue: roundMoney(totalRevenue),
    customers_with_orders: Number(row.customers_with_orders) || 0,
    avg_order_value: avgOrderValue
  }
}

/**
 * Revenue rollup by store (for CX dashboard).
 * @param {import('mssql').ConnectionPool} pool
 */
async function fetchCxRevenueByStore(pool, mode, { limit = 30 } = {}) {
  const t = tableNames(mode)
  const lim = Math.min(500, Math.max(1, Number(limit) || 30))
  const q = `
    SELECT s.store_id,
           ISNULL(s.store_name, N'') AS store_name,
           COUNT(o.order_id) AS order_count,
           ISNULL(SUM(o.total_amount), 0) AS revenue
    FROM ${t.orders} o
    INNER JOIN dbo.stores s ON o.store_id = s.store_id
    GROUP BY s.store_id, s.store_name
    ORDER BY revenue DESC
    OFFSET 0 ROWS FETCH NEXT @lim ROWS ONLY
  `
  const result = await pool.request().input('lim', sql.Int, lim).query(q)
  return (result.recordset || []).map((r) => ({
    store_id: r.store_id,
    store_name: r.store_name || 'Store',
    order_count: Number(r.order_count) || 0,
    revenue: roundMoney(Number(r.revenue) || 0)
  }))
}

/**
 * All registered POS customers with lifetime order stats (LEFT JOIN orders).
 * @param {import('mssql').ConnectionPool} pool
 */
async function membershipPlansHasTierIdColumn(pool) {
  const r = await pool.request().query(`
    SELECT COL_LENGTH('dbo.membership_plans', 'tier_id') AS col_len
  `)
  const len = r.recordset && r.recordset[0] && r.recordset[0].col_len
  return len != null && Number(len) > 0
}

async function fetchCxCustomerRollup(pool, mode, { search, limit = 100 } = {}) {
  const t = tableNames(mode)
  const lim = Math.min(500, Math.max(1, Number(limit) || 100))
  const linkTiers = await membershipPlansHasTierIdColumn(pool)
  const tierNameExpr = linkTiers
    ? 'ISNULL(mt.tier_name, p.display_name)'
    : 'p.display_name'
  const typeExpr = linkTiers
    ? "NULLIF(LTRIM(RTRIM(ISNULL(mt.loyalty_tier, N''))), N'')"
    : 'NULL'
  const tierJoin = linkTiers
    ? 'LEFT JOIN dbo.membership_tiers mt ON mt.membership_id = p.tier_id'
    : ''
  let query = `
    SELECT c.customer_id,
           c.full_name,
           c.phone,
           ISNULL(c.email, N'') AS email,
           c.home_store_id,
           ISNULL(st.store_name, N'') AS home_store_name,
           COUNT(o.order_id) AS order_count,
           ISNULL(SUM(o.total_amount), 0) AS lifetime_revenue,
           MAX(o.created_at) AS last_order_at,
           MAX(am.plan_key) AS active_plan_key,
           MAX(am.plan_display_name) AS plan_display_name,
           MAX(am.membership_tier_name) AS membership_tier_name,
           MAX(am.membership_type) AS membership_type,
           MAX(am.membership_expires_at) AS membership_expires_at
    FROM dbo.pos_customers c
    LEFT JOIN ${t.orders} o ON o.customer_id = c.customer_id
    LEFT JOIN dbo.stores st ON c.home_store_id = st.store_id
    OUTER APPLY (
      SELECT TOP 1
        m.plan_key,
        p.display_name AS plan_display_name,
        ${tierNameExpr} AS membership_tier_name,
        ${typeExpr} AS membership_type,
        m.expires_at AS membership_expires_at
      FROM dbo.customer_memberships m
      INNER JOIN dbo.membership_plans p ON p.plan_key = m.plan_key AND p.is_active = 1
      ${tierJoin}
      WHERE m.customer_id = c.customer_id
        AND m.is_active = 1
        AND m.expires_at > DATEADD(MINUTE, 330, SYSUTCDATETIME())
      ORDER BY m.expires_at DESC
    ) am
    WHERE c.is_active = 1
  `
  const req = pool.request().input('lim', sql.Int, lim)
  if (search) {
    const digitsOnly = String(search).replace(/\D/g, '')
    if (digitsOnly.length >= 4 && digitsOnly.length >= String(search).replace(/\s/g, '').length * 0.7) {
      query += ` AND (
        c.phone LIKE @search
        OR REPLACE(REPLACE(REPLACE(c.phone, N' ', N''), N'-', N''), N'+', N'') LIKE @searchDigits
      ) `
      req.input('search', sql.NVarChar(200), '%' + search + '%')
      req.input('searchDigits', sql.NVarChar(30), '%' + digitsOnly + '%')
    } else {
      query += ` AND (c.full_name LIKE @search OR c.phone LIKE @search OR ISNULL(c.email, N'') LIKE @search) `
      req.input('search', sql.NVarChar(200), '%' + search + '%')
    }
  }
  query += `
    GROUP BY c.customer_id, c.full_name, c.phone, c.email, c.home_store_id, st.store_name
    ORDER BY lifetime_revenue DESC, c.full_name ASC
    OFFSET 0 ROWS FETCH NEXT @lim ROWS ONLY
  `
  const result = await req.query(query)
  return (result.recordset || []).map((row) => ({
    customer_id: row.customer_id,
    full_name: row.full_name || '',
    phone: row.phone || '',
    email: row.email || '',
    home_store_id: row.home_store_id,
    home_store_name: row.home_store_name || '',
    order_count: Number(row.order_count) || 0,
    lifetime_revenue: roundMoney(Number(row.lifetime_revenue) || 0),
    last_order_at: row.last_order_at || null,
    active_plan_key: row.active_plan_key || null,
    plan_display_name: row.plan_display_name || null,
    membership_tier_name: row.membership_tier_name || null,
    membership_type: row.membership_type || null,
    membership_expires_at: row.membership_expires_at || null
  }))
}

module.exports = {
  getOrdersEngineMode,
  ORDERS_ENGINE_MODE_KEY,
  validateOrderLinesAgainstConfig,
  buildPaymentSummary,
  validatePaymentAgainstSummary,
  fetchOrderBundle,
  mapOrderRowForApi,
  assertPosOrderCreatorMutation,
  createOrderInTransaction,
  commitInventoryForPaidOrder,
  checkoutAndPay,
  recordPayment,
  autoCompleteLabSettlement,
  completeInstantSettlement,
  updateLabSubOrderStatus,
  patchLabSubOrderIntake,
  fetchStoreOrders,
  voidUnpaidPosOrder,
  fetchAllOrders,
  fetchCxSummary,
  fetchCxRevenueByStore,
  fetchCxCustomerRollup,
  markInstantSubOrderHandedOver
}
