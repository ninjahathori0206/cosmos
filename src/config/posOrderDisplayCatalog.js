/**
 * Store OS order list/detail display labels (DB status may differ from UI label).
 * @see docs/pos-checkout-draft.md
 */

const POS_ORDER_UNPAID_DISPLAY = {
  key: 'payment_pending',
  label: 'Payment pending',
  cssClass: 'payment-pending'
}

/**
 * Display labels for dbo.pos_orders / oe_orders.status (header-level only).
 *
 * Active header statuses written by the server:
 *   OPEN      — on create
 *   COMPLETED — after full settlement + invoice (finalizePaidOrderLedger)
 *   CANCELLED — void unpaid order
 *
 * NOT written at header level (they are sub-order / lab_workflow_status values):
 *   PAID, DELIVERED — removed; finalizePaidOrderLedger goes directly to COMPLETED.
 */
const POS_ORDER_STATUS_LABELS = [
  { dbStatus: 'OPEN',      key: 'open',      label: 'Open',      cssClass: 'open' },
  { dbStatus: 'CANCELLED', key: 'cancelled', label: 'Cancelled', cssClass: 'cancelled' },
  { dbStatus: 'COMPLETED', key: 'completed', label: 'Completed', cssClass: 'completed' }
]

const MONEY_EPS = 0.02

/**
 * @param {{ status?: string, is_unpaid?: boolean, paid_total?: number, amount_paid?: number, total_amount?: number }} row
 * @returns {{ display_status_key: string, display_status_label: string, display_status_css_class: string }}
 */
function resolvePosOrderDisplayStatus(row) {
  const dbStatus = String(row && row.status != null ? row.status : '').trim().toUpperCase()
  const paidRaw = row && row.paid_total != null ? row.paid_total : row && row.amount_paid != null ? row.amount_paid : null
  const paidTotal = paidRaw != null ? Number(paidRaw) : null
  const totalAmt = row && row.total_amount != null ? Number(row.total_amount) : null
  const unpaid = row && row.is_unpaid === true
    ? true
    : dbStatus === 'OPEN' && paidTotal != null && totalAmt != null && paidTotal + MONEY_EPS < totalAmt

  if (unpaid && dbStatus === 'OPEN') {
    return {
      display_status_key: POS_ORDER_UNPAID_DISPLAY.key,
      display_status_label: POS_ORDER_UNPAID_DISPLAY.label,
      display_status_css_class: POS_ORDER_UNPAID_DISPLAY.cssClass
    }
  }

  const hit = POS_ORDER_STATUS_LABELS.find((e) => e.dbStatus === dbStatus)
  if (hit) {
    return {
      display_status_key: hit.key,
      display_status_label: hit.label,
      display_status_css_class: hit.cssClass
    }
  }

  const fallbackKey = dbStatus ? dbStatus.toLowerCase() : 'unknown'
  const fallbackLabel = dbStatus
    ? dbStatus.charAt(0) + dbStatus.slice(1).toLowerCase()
    : 'Unknown'
  return {
    display_status_key: fallbackKey,
    display_status_label: fallbackLabel,
    display_status_css_class: fallbackKey
  }
}

module.exports = {
  POS_ORDER_UNPAID_DISPLAY,
  POS_ORDER_STATUS_LABELS,
  resolvePosOrderDisplayStatus,
  MONEY_EPS: MONEY_EPS
}
