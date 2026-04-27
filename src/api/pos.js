const express = require('express')
const sql     = require('mssql')
const jwt     = require('jsonwebtoken')
const Joi     = require('joi')
const bcrypt  = require('bcryptjs')
const { executeStoredProcedure, getPool } = require('../config/db')
const { authJwt }           = require('../middleware/authJwt')
const { requireModule, requirePermission } = require('../middleware/authorize')
const { resolveProcurementMode, readSetting } = require('../services/procurementService')

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
      lens_bundle:  Joi.object().allow(null)
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
      if (!staff.pos_pin_hash) continue
      const ok = await bcrypt.compare(String(pin), staff.pos_pin_hash)
      if (ok) { matched = staff; break }
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
router.get('/catalogue', authJwt, requireModule('pos'), async (req, res, next) => {
  try {
    const scope    = (req.query.scope || 'store').toLowerCase()
    const q        = (req.query.q || '').trim() || null
    const store_id = req.user.store_id

    if (!store_id) {
      return res.status(400).json({ success: false, message: 'store_id missing from session token.' })
    }

    const procName = scope === 'global' ? 'sp_POS_GlobalCatalogue' : 'sp_POS_StoreCatalogue'

    const result = await executeStoredProcedure(procName, {
      store_id: { type: sql.Int,           value: store_id },
      q:        { type: sql.NVarChar(200),  value: q }
    })

    const rows = result.recordset || []
    const grouped = groupCatalogueRows(rows)

    return res.json({ success: true, data: grouped })
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

    const o = await pool.request()
      .input('oid', sql.Int, orderId)
      .input('sid', sql.Int, storeId)
      .query('SELECT * FROM dbo.pos_orders WHERE order_id = @oid AND store_id = @sid')
    if (!o.recordset.length) {
      return res.status(404).json({ success: false, message: 'Order not found for this store.' })
    }
    const order = o.recordset[0]

    const subs = await pool.request()
      .input('oid', sql.Int, orderId)
      .query(`
        SELECT sub_order_id, order_id, fulfillment, lab_workflow_status, sort_order
        FROM dbo.pos_sub_orders
        WHERE order_id = @oid
        ORDER BY sort_order, sub_order_id
      `)

    const items = await pool.request()
      .input('oid', sql.Int, orderId)
      .query(`
        SELECT i.order_item_id, i.sub_order_id, i.sku_id, i.qty, i.unit_price, i.line_total,
               i.product_type, i.fulfillment, i.line_key
        FROM dbo.pos_order_items i
        INNER JOIN dbo.pos_sub_orders s ON s.sub_order_id = i.sub_order_id
        WHERE s.order_id = @oid
        ORDER BY s.sort_order, i.order_item_id
      `)

    const pays = await pool.request()
      .input('oid', sql.Int, orderId)
      .query(`
        SELECT payment_id, order_id, stage, method, amount, tendered, change_given, external_ref, created_at
        FROM dbo.pos_payments
        WHERE order_id = @oid
        ORDER BY payment_id
      `)

    const subList = (subs.recordset || []).map((s) => ({
      sub_order_id: s.sub_order_id,
      order_id: s.order_id,
      fulfillment: s.fulfillment,
      lab_workflow_status: s.lab_workflow_status,
      sort_order: s.sort_order,
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
          line_key: it.line_key
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

    return res.json({
      success: true,
      data: {
        order: {
          order_id: order.order_id,
          store_id: order.store_id,
          customer_id: order.customer_id,
          order_no: order.order_no,
          order_source: order.order_source,
          order_kind: order.order_kind,
          status: order.status,
          gst_rate_snapshot: Number(order.gst_rate_snapshot),
          lab_advance_pct_snapshot: order.lab_advance_pct_snapshot != null ? Number(order.lab_advance_pct_snapshot) : null,
          procurement_mode_snapshot: order.procurement_mode_snapshot,
          subtotal_amount: Number(order.subtotal_amount),
          gst_amount: Number(order.gst_amount),
          total_amount: Number(order.total_amount),
          created_at: order.created_at
        },
        sub_orders: subList,
        payments
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
    const typeRule = (key) => cfg.productTypeConfig.find((r) => r.key === key)

    for (const line of value.lines) {
      const rule = typeRule(line.product_type)
      if (line.fulfillment === 'LAB') {
        if (!line.lens_bundle || !line.lens_bundle.package_id) {
          return res.status(400).json({ success: false, message: 'Lab lines require a configured lens bundle.' })
        }
        if (rule && rule.rx_required && !value.rx_snapshot) {
          return res.status(400).json({ success: false, message: 'Rx snapshot required for this order.' })
        }
      }
      if (rule && !rule.allow_qty_gt_1 && line.qty > 1) {
        return res.status(400).json({ success: false, message: `Qty > 1 not allowed for ${line.product_type}.` })
      }
    }

    const gstRate = Number(await readSetting(pool, 'pos_gst_rate') || 0.05)
    const advPct = Number(await readSetting(pool, 'lab_advance_pct') || 40)
    const firstPt = value.lines[0].product_type
    const procurementMode = await resolveProcurementMode(pool, storeId, firstPt)

    let subtotal = 0
    for (const line of value.lines) {
      let lineUnit = Number(line.unit_price) || 0
      if (line.fulfillment === 'LAB' && line.lens_bundle) {
        const b = line.lens_bundle
        const lensPrice = Number(b.package_price) || 0
        const addonSum = (b.addon_prices || []).reduce((s, p) => s + (Number(p) || 0), 0)
        lineUnit = lineUnit + lensPrice + addonSum
      }
      subtotal += lineUnit * line.qty
    }
    const gstAmount = Math.round(subtotal * gstRate * 100) / 100
    const totalAmount = Math.round((subtotal + gstAmount) * 100) / 100

    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    try {
      const rSeq = new sql.Request(transaction)
      rSeq.input('k', sql.VarChar(100), 'pos_order_seq')
      const seqLock = await rSeq.query(
        'SELECT setting_value FROM dbo.app_settings WITH (UPDLOCK, ROWLOCK) WHERE setting_key = @k'
      )
      let seq = parseInt((seqLock.recordset[0] || {}).setting_value, 10)
      if (!Number.isFinite(seq)) seq = 1000
      const nextSeq = seq + 1
      await rSeq.input('v', sql.VarChar(500), String(nextSeq)).query(
        'UPDATE dbo.app_settings SET setting_value = @v, updated_at = DATEADD(MINUTE,330,SYSUTCDATETIME()) WHERE setting_key = @k'
      )
      const orderNo = `EW-ORD-${nextSeq}`

      const rIns = new sql.Request(transaction)
      rIns.input('store_id', sql.Int, storeId)
      rIns.input('customer_id', sql.Int, value.customer_id || null)
      rIns.input('created_by_user_id', sql.Int, employeeId || null)
      rIns.input('order_no', sql.NVarChar(50), orderNo)
      rIns.input('order_source', sql.NVarChar(20), value.order_source || 'POS')
      const instantLines = value.lines.filter((l) => l.fulfillment === 'INSTANT')
      const labLines = value.lines.filter((l) => l.fulfillment === 'LAB')
      let orderKind = 'INSTANT'
      if (instantLines.length && labLines.length) orderKind = 'MIXED'
      else if (labLines.length) orderKind = 'LAB'
      rIns.input('order_kind', sql.NVarChar(20), orderKind)
      rIns.input('rx_snapshot', sql.NVarChar(sql.MAX), value.rx_snapshot ? JSON.stringify(value.rx_snapshot) : null)
      rIns.input('gst_rate_snapshot', sql.Decimal(9, 4), gstRate)
      rIns.input('lab_advance_pct_snapshot', sql.Decimal(9, 2), advPct)
      rIns.input('procurement_mode_snapshot', sql.NVarChar(50), procurementMode)
      rIns.input('subtotal_amount', sql.Decimal(12, 2), subtotal)
      rIns.input('gst_amount', sql.Decimal(12, 2), gstAmount)
      rIns.input('total_amount', sql.Decimal(12, 2), totalAmount)

      const insOrder = await rIns.query(`
        INSERT INTO dbo.pos_orders (
          store_id, customer_id, created_by_user_id, order_no, order_source, order_kind,
          rx_snapshot, gst_rate_snapshot, lab_advance_pct_snapshot, procurement_mode_snapshot,
          status, subtotal_amount, gst_amount, total_amount
        ) VALUES (
          @store_id, @customer_id, @created_by_user_id, @order_no, @order_source, @order_kind,
          @rx_snapshot, @gst_rate_snapshot, @lab_advance_pct_snapshot, @procurement_mode_snapshot,
          N'OPEN', @subtotal_amount, @gst_amount, @total_amount
        );
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS order_id;
      `)
      const orderId = insOrder.recordset[0].order_id

      const subIdByFulfillment = {}
      let sort = 0
      if (instantLines.length) {
        const rSub = new sql.Request(transaction)
        rSub.input('order_id', sql.Int, orderId)
        rSub.input('fulfillment', sql.NVarChar(10), 'INSTANT')
        rSub.input('sort_order', sql.Int, sort++)
        const subIns = await rSub.query(`
          INSERT INTO dbo.pos_sub_orders (order_id, fulfillment, lab_workflow_status, sort_order)
          VALUES (@order_id, @fulfillment, NULL, @sort_order);
          SELECT CAST(SCOPE_IDENTITY() AS INT) AS sub_order_id;
        `)
        subIdByFulfillment.INSTANT = subIns.recordset[0].sub_order_id
      }
      if (labLines.length) {
        const rSub = new sql.Request(transaction)
        rSub.input('order_id', sql.Int, orderId)
        rSub.input('fulfillment', sql.NVarChar(10), 'LAB')
        rSub.input('sort_order', sql.Int, sort++)
        const subIns = await rSub.query(`
          INSERT INTO dbo.pos_sub_orders (order_id, fulfillment, lab_workflow_status, sort_order)
          VALUES (@order_id, @fulfillment, N'ORDER_PLACED', @sort_order);
          SELECT CAST(SCOPE_IDENTITY() AS INT) AS sub_order_id;
        `)
        subIdByFulfillment.LAB = subIns.recordset[0].sub_order_id
      }

      for (const line of value.lines) {
        const subOrderId = subIdByFulfillment[line.fulfillment]
        let lineUnit = Number(line.unit_price) || 0
        let lensJson = null
        if (line.fulfillment === 'LAB' && line.lens_bundle) {
          const b = line.lens_bundle
          const lensPrice = Number(b.package_price) || 0
          const addonSum = (b.addon_prices || []).reduce((s, p) => s + (Number(p) || 0), 0)
          lineUnit = lineUnit + lensPrice + addonSum
          lensJson = JSON.stringify(b)
        }
        const lineTotal = Math.round(lineUnit * line.qty * 100) / 100

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
          throw new Error(`Insufficient stock for SKU ${line.sku_id} at this store.`)
        }
        await rStock.query(`
          UPDATE dbo.stock_balances
          SET qty = qty - @qty,
              last_updated = DATEADD(MINUTE,330,SYSUTCDATETIME())
          WHERE sku_id = @sku_id AND location_type = N'STORE' AND location_id = @store_id AND qty >= @qty
        `)

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
        await rItem.query(`
          INSERT INTO dbo.pos_order_items (
            sub_order_id, sku_id, qty, unit_price, line_total, product_type, fulfillment, line_key, lens_bundle
          ) VALUES (
            @sub_order_id, @sku_id, @qty, @unit_price, @line_total, @product_type, @fulfillment, @line_key, @lens_bundle
          )
        `)
      }

      const rLog = new sql.Request(transaction)
      rLog.input('order_id', sql.Int, orderId)
      rLog.input('actor_user_id', sql.Int, employeeId || null)
      await rLog.query(`
        INSERT INTO dbo.pos_order_status_log (order_id, sub_order_id, from_status, to_status, actor_user_id, note)
        VALUES (@order_id, NULL, NULL, N'CREATED', @actor_user_id, NULL)
      `)

      await transaction.commit()

      const subOrdersOut = []
      if (subIdByFulfillment.INSTANT) {
        subOrdersOut.push({
          sub_order_id: subIdByFulfillment.INSTANT,
          fulfillment: 'INSTANT',
          lab_workflow_status: null
        })
      }
      if (subIdByFulfillment.LAB) {
        subOrdersOut.push({
          sub_order_id: subIdByFulfillment.LAB,
          fulfillment: 'LAB',
          lab_workflow_status: 'ORDER_PLACED'
        })
      }

      return res.json({
        success: true,
        data: {
          order_id: orderId,
          order_no: orderNo,
          order_kind: orderKind,
          subtotal_amount: subtotal,
          gst_amount: gstAmount,
          total_amount: totalAmount,
          sub_orders: subOrdersOut
        }
      })
    } catch (inner) {
      await transaction.rollback()
      throw inner
    }
  } catch (err) {
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

    const ord = await pool.request()
      .input('oid', sql.Int, value.order_id)
      .query('SELECT order_id, store_id FROM dbo.pos_orders WHERE order_id = @oid')
    const orderRow = ord.recordset[0]
    if (!orderRow || orderRow.store_id !== storeId) {
      return res.status(404).json({ success: false, message: 'Order not found for this store.' })
    }

    let tendered = value.tendered
    let changeGiven = value.change_given
    if (value.method === 'CASH' && tendered != null) {
      changeGiven = Math.round((Number(tendered) - Number(value.amount)) * 100) / 100
      if (changeGiven < 0) {
        return res.status(400).json({ success: false, message: 'Tendered amount is less than payment amount.' })
      }
    }

    await pool.request()
      .input('order_id', sql.Int, value.order_id)
      .input('stage', sql.NVarChar(20), value.stage)
      .input('method', sql.NVarChar(20), value.method)
      .input('amount', sql.Decimal(12, 2), value.amount)
      .input('tendered', sql.Decimal(12, 2), tendered != null ? tendered : null)
      .input('change_given', sql.Decimal(12, 2), changeGiven != null ? changeGiven : null)
      .input('external_ref', sql.NVarChar(200), value.external_ref || null)
      .input('created_by', sql.Int, employeeId || null)
      .query(`
        INSERT INTO dbo.pos_payments (order_id, stage, method, amount, tendered, change_given, external_ref, created_by)
        VALUES (@order_id, @stage, @method, @amount, @tendered, @change_given, @external_ref, @created_by)
      `)

    return res.json({ success: true, message: 'Payment recorded.' })
  } catch (err) {
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

    const ord = await pool.request()
      .input('oid', sql.Int, orderId)
      .query('SELECT order_id, store_id FROM dbo.pos_orders WHERE order_id = @oid')
    const orderRow = ord.recordset[0]
    if (!orderRow || orderRow.store_id !== storeId) {
      return res.status(404).json({ success: false, message: 'Order not found for this store.' })
    }

    const sub = await pool.request()
      .input('sid', sql.Int, value.sub_order_id)
      .input('oid', sql.Int, orderId)
      .query(`
        SELECT sub_order_id, order_id, fulfillment, lab_workflow_status
        FROM dbo.pos_sub_orders
        WHERE sub_order_id = @sid AND order_id = @oid
      `)
    const subRow = sub.recordset[0]
    if (!subRow || subRow.fulfillment !== 'LAB') {
      return res.status(400).json({ success: false, message: 'Lab sub-order required.' })
    }

    const fromStatus = String(subRow.lab_workflow_status || '')
    const val = await executeStoredProcedure('sp_POS_ValidateLabTransition', {
      from_status: { type: sql.VarChar(30), value: fromStatus },
      to_status:   { type: sql.VarChar(30), value: value.to_status },
      actor_role:  { type: sql.VarChar(50), value: actorRole }
    })
    const vr = (val.recordset || [])[0] || {}
    const cnt = Number(vr.transition_count) || 0
    const needsNote = Number(vr.requires_note) === 1
    if (!cnt) {
      return res.status(400).json({ success: false, message: 'Transition not allowed for this role or status.' })
    }
    if (needsNote && !(value.note && String(value.note).trim())) {
      return res.status(400).json({ success: false, message: 'Note is required for this transition.' })
    }

    await pool.request()
      .input('sid', sql.Int, value.sub_order_id)
      .input('st', sql.NVarChar(30), value.to_status)
      .query('UPDATE dbo.pos_sub_orders SET lab_workflow_status = @st WHERE sub_order_id = @sid')

    await pool.request()
      .input('order_id', sql.Int, orderId)
      .input('sub_order_id', sql.Int, value.sub_order_id)
      .input('from_status', sql.NVarChar(30), fromStatus || null)
      .input('to_status', sql.NVarChar(30), value.to_status)
      .input('actor_user_id', sql.Int, employeeId || null)
      .input('note', sql.NVarChar(500), value.note || null)
      .query(`
        INSERT INTO dbo.pos_order_status_log (order_id, sub_order_id, from_status, to_status, actor_user_id, note)
        VALUES (@order_id, @sub_order_id, @from_status, @to_status, @actor_user_id, @note)
      `)

    return res.json({ success: true, message: 'Status updated.' })
  } catch (err) {
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
