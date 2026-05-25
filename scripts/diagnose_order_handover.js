/**
 * Diagnose why bill handover may not complete for an order.
 * Usage: node scripts/diagnose_order_handover.js EW-ORD-3
 */
require('dotenv').config()
const { getPool } = require('../src/config/db')
const { getOrdersEngineMode, fetchOrderBundle } = require('../src/services/orderService')

async function main() {
  const key = process.argv[2] || 'EW-ORD-3'
  const pool = await getPool()
  const mode = await getOrdersEngineMode(pool)
  const sql = require('mssql')
  const isId = /^\d+$/.test(key)
  const r = await pool.request()
    .input('k', sql.NVarChar(50), isId ? '' : key)
    .input('id', sql.Int, isId ? Number(key) : 0)
    .query(isId
      ? `SELECT TOP 1 order_id, order_no, order_kind, status, store_id, total_amount FROM dbo.pos_orders WHERE order_id = @id`
      : `SELECT TOP 1 order_id, order_no, order_kind, status, store_id, total_amount FROM dbo.pos_orders WHERE order_no = @k`)
  const head = (r.recordset || [])[0]
  if (!head) {
    console.error('Order not found:', key)
    process.exit(1)
  }
  const bundle = await fetchOrderBundle(pool, head.order_id, head.store_id, mode)
  console.log('--- Order ---')
  console.log(JSON.stringify({
    order_id: head.order_id,
    order_no: head.order_no,
    order_kind: head.order_kind,
    status: head.status,
    store_id: head.store_id,
    total_amount: head.total_amount,
    amount_remaining: bundle && bundle.payment_summary ? bundle.payment_summary.amount_remaining : null,
    invoice_no: bundle && bundle.invoice_no
  }, null, 2))
  console.log('--- Sub-orders ---')
  for (const s of (bundle && bundle.subList) || []) {
    console.log(JSON.stringify({
      sub_order_id: s.sub_order_id,
      label: s.sub_order_label,
      fulfillment: s.fulfillment,
      lab_workflow_status: s.lab_workflow_status,
      handover_status: s.handover_status
    }))
  }
  const pendingInstant = (bundle.subList || []).filter(
    (s) => String(s.fulfillment) === 'INSTANT'
      && String(s.handover_status || '').toUpperCase() !== 'HANDED_OVER'
  )
  const labLines = (bundle.subList || []).filter((s) => String(s.fulfillment) === 'LAB')
  console.log('--- Handover hints ---')
  if (pendingInstant.length) {
    console.log('BLOCKED: instant/frame line(s) not HANDED_OVER — use frame handover first:', pendingInstant.map((s) => s.sub_order_label).join(', '))
  }
  if (labLines.some((s) => String(s.lab_workflow_status || '').toUpperCase() !== 'READY_FOR_DELIVERY'
    && !['DELIVERED', 'BALANCE_COLLECTED', 'INVOICED'].includes(String(s.lab_workflow_status || '').toUpperCase()))) {
    console.log('BLOCKED: lab line(s) not READY_FOR_DELIVERY yet')
  }
  if (!pendingInstant.length && labLines.every((s) => {
    const st = String(s.lab_workflow_status || '').toUpperCase()
    return st === 'READY_FOR_DELIVERY' || st === 'DELIVERED' || st === 'BALANCE_COLLECTED' || st === 'INVOICED'
  })) {
    console.log('OK: prerequisites look satisfied for bill handover')
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message || e)
    process.exit(1)
  })
