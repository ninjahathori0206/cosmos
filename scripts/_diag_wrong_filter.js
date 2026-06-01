require('dotenv').config()
const { getPool } = require('../src/config/db')
const orderService = require('../src/services/orderService')

;(async () => {
  const pool = await getPool()
  const mode = await orderService.getOrdersEngineMode(pool)
  const wrong = await orderService.fetchAllOrders(pool, mode, {
    search: '',
    statusFilter: '',
    orderKind: 'LAB',
    labStatusFilter: 'DISPATCHED_7D',
    limit: 120
  })
  console.log('wrong lab_status=DISPATCHED_7D count', wrong.length)
  process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
