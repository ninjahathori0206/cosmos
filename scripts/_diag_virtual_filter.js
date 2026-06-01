require('dotenv').config()
const { getPool } = require('../src/config/db')

function resolveLabListFilters(value) {
  const VIRTUAL_LAB_TAB_FILTERS = {
    DISPATCHED_7D: { labLoggedStatus: 'DISPATCHED_TO_STORE', labLoggedSinceDays: 7 },
    QC_BY_STORE: { labStatusIncludes: ['QC_FAIL_STORE', 'STORE_QC_PARTIAL'] }
  }
  function normalizeLabStatusList(input) {
    if (!input) return []
    if (Array.isArray(input)) return input.filter(Boolean).map((x) => String(x).trim()).filter(Boolean)
    return String(input).split(',').map((x) => x.trim()).filter(Boolean)
  }
  let labStatusFilter = value.lab_status ? String(value.lab_status).trim() : ''
  let labStatusIncludes = normalizeLabStatusList(value.include_lab_status)
  let labLoggedStatus = value.lab_logged_status ? String(value.lab_logged_status).trim().toUpperCase() : ''
  let labLoggedSinceDays = value.lab_logged_since_days ? Number(value.lab_logged_since_days) : null
  const virtual = VIRTUAL_LAB_TAB_FILTERS[String(labStatusFilter || '').toUpperCase()]
  if (virtual) {
    labStatusFilter = ''
    if (virtual.labLoggedStatus) {
      labLoggedStatus = virtual.labLoggedStatus
      labLoggedSinceDays = virtual.labLoggedSinceDays
    }
    if (virtual.labStatusIncludes) labStatusIncludes = virtual.labStatusIncludes.slice()
  } else if (labStatusFilter) labStatusIncludes = []
  return { labStatusFilter, labStatusIncludes, labLoggedStatus, labLoggedSinceDays }
}

const orderService = require('../src/services/orderService')

;(async () => {
  const pool = await getPool()
  const mode = await orderService.getOrdersEngineMode(pool)
  const resolved = resolveLabListFilters({ lab_status: 'DISPATCHED_7D', kind: 'LAB' })
  console.log('resolved', resolved)
  const rows = await orderService.fetchAllOrders(pool, mode, {
    search: '',
    statusFilter: '',
    orderKind: 'LAB',
    ...resolved,
    limit: 120
  })
  console.log('count', rows.length, rows.map((r) => r.order_no))
  process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
