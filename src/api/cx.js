const express = require('express')
const { getPool } = require('../config/db')
const { authJwt } = require('../middleware/authJwt')
const { requireModule } = require('../middleware/authorize')
const orderService = require('../services/orderService')

const router = express.Router()

/** GET /api/cx/dashboard — summary + revenue_by_store */
router.get('/dashboard', authJwt, requireModule('cx'), async (req, res, next) => {
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
router.get('/customers', authJwt, requireModule('cx'), async (req, res, next) => {
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

/** GET /api/cx/orders?q=&status=&limit= — recent orders all stores */
router.get('/orders', authJwt, requireModule('cx'), async (req, res, next) => {
  try {
    const search = String(req.query.q || '').trim() || null
    const statusFilter = String(req.query.status || '').trim() || null
    const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '80'), 10) || 80))
    const pool = await getPool()
    const mode = await orderService.getOrdersEngineMode(pool)
    const orders = await orderService.fetchAllOrders(pool, mode, { search, statusFilter, limit })
    return res.json({ success: true, data: orders })
  } catch (err) {
    return next(err)
  }
})

module.exports = router
