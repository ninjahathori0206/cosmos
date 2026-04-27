const express = require('express')
const sql     = require('mssql')
const jwt     = require('jsonwebtoken')
const Joi     = require('joi')
const bcrypt  = require('bcryptjs')
const { executeStoredProcedure, getPool } = require('../config/db')
const { authJwt }           = require('../middleware/authJwt')
const { requireModule, requirePermission } = require('../middleware/authorize')

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
