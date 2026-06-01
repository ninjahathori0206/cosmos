/**
 * Store OS order list queue tabs — SSOT for tab keys, lab workflow status sets, and labels.
 * @see docs/pos-checkout-draft.md
 */

const POS_ORDER_QUEUE_KEYS = ['ACTIVE', 'TRANSIT', 'LAB_AT_HQ', 'HANDOVER', 'INVOICED_7']

const POS_ORDER_QUEUE_TABS = [
  { key: 'ACTIVE', label: 'Active' },
  { key: 'TRANSIT', label: 'Transit' },
  { key: 'LAB_AT_HQ', label: 'LAB' },
  { key: 'HANDOVER', label: 'Ready for HandOver' },
  { key: 'INVOICED_7', label: 'Invoiced (Last 7)' }
]

/** Outbound to HQ lab. */
const TRANSIT_TO_LAB_STATUSES = [
  'ORDER_PLACED',
  'ADVANCE_PAID',
  'SENT_TO_LAB'
]

/** Inbound to store from HQ. */
const TRANSIT_TO_STORE_STATUSES = [
  'DISPATCHED_TO_STORE',
  'RECEIVED_AT_STORE',
  'STORE_QC_PASS',
  'STORE_QC_PARTIAL',
  'QC_FAIL_STORE'
]

const POS_ORDER_QUEUE_LAB_STATUSES = {
  TRANSIT: [...TRANSIT_TO_LAB_STATUSES, ...TRANSIT_TO_STORE_STATUSES],
  LAB_AT_HQ: ['LAB_FITTING', 'QC_PASS', 'QC_FAIL_LAB'],
  HANDOVER: ['READY_FOR_DELIVERY', 'DELIVERED', 'BALANCE_COLLECTED'],
  INVOICED_7: ['INVOICED']
}

const INVOICED_QUEUE_DAYS = 7

/** Union of statuses used by non-ACTIVE queue tabs (for ACTIVE inverse filter). */
function getNonActiveLabStatusUnion() {
  const set = new Set()
  for (const key of POS_ORDER_QUEUE_KEYS) {
    if (key === 'ACTIVE') continue
    const list = POS_ORDER_QUEUE_LAB_STATUSES[key]
    if (Array.isArray(list)) {
      for (const s of list) set.add(s)
    }
  }
  return [...set]
}

/**
 * @param {string} labWorkflowStatus
 * @returns {'to_lab'|'to_store'|null}
 */
function resolveTransitDirection(labWorkflowStatus) {
  const st = String(labWorkflowStatus || '').trim().toUpperCase()
  if (TRANSIT_TO_LAB_STATUSES.includes(st)) return 'to_lab'
  if (TRANSIT_TO_STORE_STATUSES.includes(st)) return 'to_store'
  return null
}

/**
 * @param {string} labWorkflowStatus
 * @returns {{ label: string, cssClass: string }|null}
 */
function resolveTransitBadge(labWorkflowStatus) {
  const dir = resolveTransitDirection(labWorkflowStatus)
  if (dir === 'to_lab') return { label: 'To Lab', cssClass: 'transit-to-lab' }
  if (dir === 'to_store') return { label: 'To Store', cssClass: 'transit-to-store' }
  return null
}

/**
 * Map queue tab key → fetchStoreOrders / fetchAllOrders options.
 * @param {string} queueKey
 * @returns {{
 *   labStatusIncludes?: string[],
 *   labStatusExcludesUnion?: string[],
 *   invoicedSinceDays?: number,
 *   invoicedQueue?: boolean,
 *   activeQueue?: boolean,
 *   transitRequiresPayment?: boolean,
 *   orderKind?: string,
 *   excludeOrderStatuses?: string[]
 * }}
 */
function resolveQueueFetchOptions(queueKey) {
  const key = String(queueKey || '').trim().toUpperCase()
  if (!POS_ORDER_QUEUE_KEYS.includes(key)) {
    return { excludeOrderStatuses: ['COMPLETED'] }
  }

  if (key === 'ACTIVE') {
    return {
      activeQueue: true,
      labStatusExcludesUnion: getNonActiveLabStatusUnion(),
      excludeOrderStatuses: ['COMPLETED', 'CANCELLED']
    }
  }

  if (key === 'TRANSIT') {
    return {
      labStatusIncludes: POS_ORDER_QUEUE_LAB_STATUSES.TRANSIT,
      transitRequiresPayment: true,
      orderKind: 'LAB'
    }
  }

  if (key === 'INVOICED_7') {
    return {
      invoicedQueue: true,
      invoicedSinceDays: INVOICED_QUEUE_DAYS,
      // Header becomes COMPLETED on handover/invoicing — must not exclude those rows.
      excludeOrderStatuses: []
    }
  }

  const includes = POS_ORDER_QUEUE_LAB_STATUSES[key]
  return {
    labStatusIncludes: includes,
    orderKind: 'LAB'
  }
}

/**
 * Empty-state headline per queue (Store OS order list).
 * @param {string} queueKey
 * @returns {{ title: string, subtext: string }}
 */
function posOrderQueueEmptyCopy(queueKey) {
  const key = String(queueKey || '').trim().toUpperCase()
  const copies = {
    ACTIVE: {
      title: 'No active orders',
      subtext: 'Unpaid lab bills and instant pickups appear here. Search by order no or Cx phone — not cashier name. Paid instant sales: Invoiced (Last 7) tab.'
    },
    TRANSIT: {
      title: 'Nothing in transit',
      subtext: 'Orders sent to the lab or returning to this store will show here after advance is collected.'
    },
    LAB_AT_HQ: {
      title: 'No orders at the lab',
      subtext: 'Fitting and QC stages at HQ appear in this tab.'
    },
    HANDOVER: {
      title: 'Nothing ready for handover',
      subtext: 'Orders marked ready for customer pickup appear here.'
    },
    INVOICED_7: {
      title: 'No recent invoiced orders',
      subtext: 'Instant and lab orders invoiced in the last 7 days appear here. Older invoices — search by order no or phone.'
    }
  }
  return copies[key] || {
    title: 'No orders found',
    subtext: 'Try another tab or search by order number, customer name, or phone.'
  }
}

module.exports = {
  POS_ORDER_QUEUE_KEYS,
  POS_ORDER_QUEUE_TABS,
  POS_ORDER_QUEUE_LAB_STATUSES,
  TRANSIT_TO_LAB_STATUSES,
  TRANSIT_TO_STORE_STATUSES,
  INVOICED_QUEUE_DAYS,
  getNonActiveLabStatusUnion,
  resolveTransitDirection,
  resolveTransitBadge,
  resolveQueueFetchOptions,
  posOrderQueueEmptyCopy
}
