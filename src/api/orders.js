const express = require('express')
const Joi = require('joi')
const sql = require('mssql')
const { getPool, executeStoredProcedure } = require('../config/db')
const {
  requireAnyModule,
  hasModuleAccess,
  hasPermission,
  isSuperAdmin,
  isRbacStrictEmptyPermissions
} = require('../middleware/authorize')
const orderService = require('../services/orderService')

const router = express.Router()

const listSchema = Joi.object({
  search: Joi.string().max(200).allow('', null),
  status: Joi.string().max(30).allow('', null),
  kind: Joi.string().valid('INSTANT', 'LAB', 'MIXED').allow('', null),
  lab_status: Joi.string().max(30).allow('', null),
  exclude_lab_status: Joi.alternatives().try(
    Joi.string().max(500),
    Joi.array().items(Joi.string().max(30))
  ),
  scope: Joi.string().valid('all', 'store').default('all'),
  limit: Joi.number().integer().min(1).max(500).default(100)
})

const labStatusSchema = Joi.object({
  sub_order_id: Joi.number().integer().positive().required(),
  to_status: Joi.string().max(30).required(),
  note: Joi.string().max(500).allow('', null)
})

/** Exactly one checklist flag must be sent per click. */
const labIntakeSchema = Joi.object({
  sub_order_id: Joi.number().integer().positive().required(),
  received_at_lab: Joi.boolean().valid(true),
  backorder_created: Joi.boolean().valid(true)
}).xor('received_at_lab', 'backorder_created')

function normalizeLabStatusExcludes(input) {
  if (!input) return []
  if (Array.isArray(input)) return input.filter(Boolean).map((x) => String(x).trim()).filter(Boolean)
  return String(input)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

function allowCrossStoreLab(req) {
  if (hasModuleAccess(req, 'command_unit')) return true
  if (!hasModuleAccess(req, 'foundry')) return false
  if (isSuperAdmin(req)) return true
  if (isRbacStrictEmptyPermissions()) {
    return hasPermission(req, 'foundry.lab.view')
  }
  const permsListed = Array.isArray(req.user && req.user.permissions) && req.user.permissions.length > 0
  return !permsListed || hasPermission(req, 'foundry.lab.view')
}

/** Normalised JWT permission strings (lowercase). */
function jwtPermissionsLower(req) {
  const p = req.user && req.user.permissions
  if (!Array.isArray(p)) return []
  return p.map((x) => String(x).toLowerCase())
}

/** Role has any storepilot.lab.* permission — switches StorePilot lab enforcement on (legacy = none). */
function storepilotHasGranularLabPerms(req) {
  return jwtPermissionsLower(req).some((x) => x.startsWith('storepilot.lab.'))
}

/**
 * StorePilot lab queue listing (kind=LAB, store scope): legacy tokens stay unchanged.
 * Once `storepilot.lab.*` is assigned to the role, require `storepilot.lab.view`.
 */
function gateStorepilotLabOrdersList(req, res, next) {
  if (!hasModuleAccess(req, 'storepilot')) return next()
  const kind = String(req.query.kind || '').toUpperCase()
  if (kind !== 'LAB') return next()
  const ps = jwtPermissionsLower(req)
  if (isRbacStrictEmptyPermissions()) {
    if (ps.includes('storepilot.lab.view')) return next()
    return res.status(403).json({ success: false, message: 'Permission denied.' })
  }
  if (!storepilotHasGranularLabPerms(req)) return next()
  if (ps.includes('storepilot.lab.view')) return next()
  return res.status(403).json({ success: false, message: 'Permission denied.' })
}

/**
 * Lab workflow updates / handover from StorePilot: legacy unchanged.
 * With granular lab perms, require `storepilot.lab.manage`.
 */
function gateStorepilotLabMutations(req, res, next) {
  if (!hasModuleAccess(req, 'storepilot')) return next()
  const ps = jwtPermissionsLower(req)
  if (isRbacStrictEmptyPermissions()) {
    if (ps.includes('storepilot.lab.manage')) return next()
    return res.status(403).json({ success: false, message: 'Permission denied.' })
  }
  if (!storepilotHasGranularLabPerms(req)) return next()
  if (ps.includes('storepilot.lab.manage')) return next()
  return res.status(403).json({ success: false, message: 'Permission denied.' })
}

function resolveActorRole(req, toStatus) {
  const target = String(toStatus || '').toUpperCase()
  const isFoundry     = hasModuleAccess(req, 'foundry')
  const isCommandUnit = hasModuleAccess(req, 'command_unit')
  const isStorePilot  = hasModuleAccess(req, 'storepilot')
  const isPos         = hasModuleAccess(req, 'pos')
  if (isFoundry || isCommandUnit) {
    if (target === 'QC_PASS' || target === 'QC_FAIL_LAB') return 'qc_team'
    return 'lab_manager'
  }
  if (isStorePilot) {
    if (target === 'READY_FOR_DELIVERY' || target === 'DELIVERED' || target === 'BALANCE_COLLECTED') return 'store_staff'
    return 'store_in_charge'
  }
  // POS/Store OS handles ORDER_PLACED → Accepted (ADVANCE_PAID) → SENT_TO_LAB and final settlement.
  // and final settlement stages (DELIVERED→BALANCE_COLLECTED→INVOICED).
  if (isPos) return 'store_in_charge'
  return String(req.user && req.user.role ? req.user.role : '')
}

router.get('/', requireAnyModule(['foundry', 'command_unit', 'storepilot']), gateStorepilotLabOrdersList, async (req, res, next) => {
  try {
    const { error, value } = listSchema.validate(req.query, { convert: true })
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      })
    }
    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const search = value.search || ''
    const statusFilter = value.status || ''
    const orderKind = value.kind || ''
    const labStatusFilter = value.lab_status || ''
    const labStatusExcludes = normalizeLabStatusExcludes(value.exclude_lab_status)
    // Use the raw query param to distinguish "caller sent scope=all" from "defaulted to all".
    // StorePilot users default to their own store when no scope given.
    // Explicit scope=all always fetches all stores (even for super_admin).
    const rawScope = req.query.scope || null
    const storeScope = rawScope === 'store' ||
      (!rawScope && !isSuperAdmin(req) && hasModuleAccess(req, 'storepilot'))

    const data = storeScope
      ? await orderService.fetchStoreOrders(pool, req.user.store_id, mode, {
          search,
          statusFilter,
          orderKind,
          labStatusFilter,
          labStatusExcludes,
          limit: value.limit
        })
      : await orderService.fetchAllOrders(pool, mode, {
          search,
          statusFilter,
          orderKind,
          labStatusFilter,
          labStatusExcludes,
          limit: value.limit
        })

    return res.json({ success: true, data })
  } catch (err) {
    return next(err)
  }
})

router.post('/:id/lab-intake', requireAnyModule(['foundry', 'command_unit']), async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10)
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order id.' })
    }
    const { error, value } = labIntakeSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      })
    }
    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const data = await orderService.patchLabSubOrderIntake(pool, mode, {
      orderId,
      storeId: req.user.store_id,
      subOrderId: value.sub_order_id,
      allowCrossStoreLab: allowCrossStoreLab(req),
      receivedAtLab: value.received_at_lab === true,
      backorderCreated: value.backorder_created === true
    })

    return res.json({
      success: true,
      message: data.message,
      data
    })
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 404) {
      return res.status(err.statusCode).json({ success: false, message: err.message })
    }
    return next(err)
  }
})

router.post('/:id/lab-status', requireAnyModule(['foundry', 'command_unit', 'storepilot', 'pos']), gateStorepilotLabMutations, async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10)
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order id.' })
    }
    const { error, value } = labStatusSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      })
    }

    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const actorRole = resolveActorRole(req, value.to_status)
    const crossStoreLab = allowCrossStoreLab(req)
    const actorUserId =
      req.user.user_id != null
        ? Number(req.user.user_id)
        : req.user.employee_id != null
          ? Number(req.user.employee_id)
          : null
    const out = await orderService.updateLabSubOrderStatus(pool, mode, executeStoredProcedure, {
      orderId,
      storeId: req.user.store_id,
      employeeId: actorUserId,
      actorRole,
      subOrderId: value.sub_order_id,
      toStatus: value.to_status,
      note: value.note,
      allowCrossStoreLab: crossStoreLab
    })

    return res.json({
      success: true,
      message: out.message,
      data: { from_status: out.from_status, to_status: out.to_status }
    })
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 404) {
      return res.status(err.statusCode).json({ success: false, message: err.message })
    }
    return next(err)
  }
})

// ── Order Timeline ────────────────────────────────────────────────────────────
router.get('/:id/timeline', requireAnyModule(['storepilot', 'foundry', 'command_unit', 'pos']), async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10)
    if (!orderId || orderId < 1) return res.status(400).json({ success: false, message: 'Invalid order id.' })
    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const t = mode === 'OE'
      ? { orders: 'dbo.oe_orders', status_log: 'dbo.oe_order_status_log' }
      : { orders: 'dbo.pos_orders', status_log: 'dbo.pos_order_status_log' }

    // Verify access — store staff can only see their store's orders
    const crossStore = isSuperAdmin(req) || hasModuleAccess(req, 'foundry') || hasModuleAccess(req, 'command_unit')
    if (!crossStore) {
      const chk = await pool.request()
        .input('oid', sql.Int, orderId)
        .input('sid', sql.Int, req.user.store_id)
        .query(`SELECT 1 AS ok FROM ${t.orders} WHERE order_id = @oid AND store_id = @sid`)
      if (!chk.recordset.length) return res.status(404).json({ success: false, message: 'Order not found.' })
    }

    const result = await pool.request()
      .input('oid', sql.Int, orderId)
      .query(`
        SELECT
          sl.log_id,
          sl.order_id,
          sl.sub_order_id,
          sl.from_status,
          sl.to_status,
          sl.note,
          sl.created_at,
          u.full_name  AS actor_name,
          u.role       AS actor_role
        FROM ${t.status_log} sl
        LEFT JOIN dbo.users u ON u.user_id = sl.actor_user_id
        WHERE sl.order_id = @oid
        ORDER BY sl.log_id ASC
      `)
    return res.json({ success: true, data: result.recordset })
  } catch (err) {
    return next(err)
  }
})

// ── Single order detail (for StorePilot handover modal) ──────────────────────
router.get('/:id', requireAnyModule(['storepilot', 'foundry', 'command_unit', 'pos']), async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10)
    if (!orderId || orderId < 1) return res.status(400).json({ success: false, message: 'Invalid order id.' })
    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const storeId = isSuperAdmin(req) || hasModuleAccess(req, 'foundry') || hasModuleAccess(req, 'command_unit')
      ? null
      : req.user.store_id
    // fetchOrderBundle requires store_id; pass a sentinel for cross-store users
    const bundle = storeId
      ? await orderService.fetchOrderBundle(pool, orderId, storeId, mode)
      : await orderService.fetchOrderBundle(pool, orderId, req.user.store_id, mode)
    if (!bundle) return res.status(404).json({ success: false, message: 'Order not found.' })
    return res.json({ success: true, data: { order: bundle.order, payment_summary: bundle.payment_summary, sub_orders: bundle.subList } })
  } catch (err) {
    return next(err)
  }
})

// ── Handover — balance collection + final settlement ─────────────────────────
const handoverSchema = Joi.object({
  order_id:      Joi.number().integer().positive().required(),
  // Omit amount / method for zero-balance orders (fully paid at POS)
  amount:        Joi.number().positive().allow(null),
  method:        Joi.string().valid('UPI', 'CARD', 'CASH').allow(null),
  tendered:      Joi.number().min(0).allow(null),
  external_ref:  Joi.string().max(200).allow('', null)
}).and(
  // If amount present, method must also be present
).custom((val, helpers) => {
  if ((val.amount != null) !== (val.method != null)) {
    return helpers.error('any.invalid', { message: 'Provide both amount and method, or neither.' })
  }
  return val
})

router.post('/:id/handover', requireAnyModule(['storepilot', 'pos']), gateStorepilotLabMutations, async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10)
    if (!orderId || orderId < 1) return res.status(400).json({ success: false, message: 'Invalid order id.' })

    const { error, value } = handoverSchema.validate({ ...req.body, order_id: orderId })
    if (error) return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join('; ') })

    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const employeeId =
      req.user.user_id != null ? Number(req.user.user_id)
      : req.user.employee_id != null ? Number(req.user.employee_id)
      : null

    // Fetch the order to validate access and check payment status
    const bundle = await orderService.fetchOrderBundle(pool, orderId, req.user.store_id, mode)
    if (!bundle) return res.status(404).json({ success: false, message: 'Order not found for this store.' })

    const summary = bundle.payment_summary
    const balanceDue = Number(summary.amount_remaining || 0)

    let invoiceNo = null

    if (value.amount != null) {
      // Balance payment path — recordPayment handles validation + auto-settlement
      const payResult = await orderService.recordPayment(pool, mode, req.user.store_id, employeeId, {
        order_id: orderId,
        stage: 'BALANCE',
        method: value.method,
        amount: value.amount,
        tendered: value.tendered || null,
        external_ref: value.external_ref || null
      })
      invoiceNo = payResult.invoice_no
      const updatedSummary = payResult.payment_summary
      const stillDue = Number(updatedSummary && updatedSummary.amount_remaining || 0)
      if (stillDue > 0.009) {
        return res.status(400).json({ success: false, message: 'Payment does not cover full balance. Balance still due: ₹' + stillDue.toFixed(2) })
      }
      return res.json({ success: true, message: 'Balance collected and order marked as delivered.', data: { invoice_no: invoiceNo, payment_summary: updatedSummary } })
    }

    // Zero-balance path — order was fully paid at POS, just trigger final settlement
    if (balanceDue > 0.009) {
      return res.status(400).json({ success: false, message: 'Balance of ₹' + balanceDue.toFixed(2) + ' is still due. Use balance payment path.' })
    }
    invoiceNo = await orderService.autoCompleteLabSettlement(pool, mode, bundle, employeeId)
    return res.json({ success: true, message: 'Order marked as delivered.', data: { invoice_no: invoiceNo } })
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 404) {
      return res.status(err.statusCode).json({ success: false, message: err.message })
    }
    return next(err)
  }
})

module.exports = router
