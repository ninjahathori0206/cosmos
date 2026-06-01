require('dotenv').config()
const { getPool } = require('../src/config/db')
const orderService = require('../src/services/orderService')

;(async () => {
  const pool = await getPool()
  const mode = await orderService.getOrdersEngineMode(pool)
  console.log('engine mode', mode)
  const t = mode === 'shared'
    ? { orders: 'dbo.oe_orders', sub_orders: 'dbo.oe_sub_orders', log: 'dbo.oe_order_status_log' }
    : { orders: 'dbo.pos_orders', sub_orders: 'dbo.pos_sub_orders', log: 'dbo.pos_order_status_log' }

  const o = await pool.request().query(
    `SELECT TOP 1 order_id, order_no, order_kind, created_at FROM ${t.orders} WHERE order_no = N'EW-ORD-3'`
  )
  console.log('order', o.recordset)
  if (!o.recordset[0]) {
    const alt = await pool.request().query(
      `SELECT TOP 5 order_id, order_no FROM ${t.orders} WHERE order_no LIKE N'%EW-ORD-3%'`
    )
    console.log('alt', alt.recordset)
    process.exit(0)
  }
  const oid = o.recordset[0].order_id
  const subs = await pool.request().input('oid', oid).query(
    `SELECT sub_order_id, fulfillment, lab_workflow_status FROM ${t.sub_orders} WHERE order_id = @oid`
  )
  console.log('subs', subs.recordset)
  const log = await pool.request().input('oid', oid).query(
    `SELECT log_id, sub_order_id, from_status, to_status, created_at FROM ${t.log} WHERE order_id = @oid ORDER BY log_id DESC`
  )
  console.log('log', log.recordset)
  const nowIst = await pool.request().query(
    `SELECT DATEADD(MINUTE, 330, SYSUTCDATETIME()) AS ist_now, DATEADD(DAY, -7, DATEADD(MINUTE, 330, SYSUTCDATETIME())) AS ist_7d_ago`
  )
  console.log('ist', nowIst.recordset[0])

  const rows = await orderService.fetchAllOrders(pool, mode, {
    search: '',
    statusFilter: '',
    orderKind: 'LAB',
    labStatusExcludes: [],
    labStatusIncludes: [],
    storeIdFilter: null,
    labLoggedStatus: 'DISPATCHED_TO_STORE',
    labLoggedSinceDays: 7,
    limit: 120
  })
  const hit = rows.filter((r) => r.order_no === 'EW-ORD-3')
  console.log('fetchAllOrders hit', hit.length, hit[0] || null)
  console.log('total rows', rows.length)
  process.exit(0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
