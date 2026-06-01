/**
 * Client mirror of src/config/posOrderQueueCatalog.js (vanilla JS, no imports).
 */
(function () {
  var TRANSIT_TO_LAB = ['ORDER_PLACED', 'ADVANCE_PAID', 'SENT_TO_LAB']
  var TRANSIT_TO_STORE = [
    'DISPATCHED_TO_STORE',
    'RECEIVED_AT_STORE',
    'STORE_QC_PASS',
    'STORE_QC_PARTIAL',
    'QC_FAIL_STORE'
  ]

  window.posOrderQueueCatalog = {
    tabs: [
      { key: 'ACTIVE', label: 'Active' },
      { key: 'TRANSIT', label: 'Transit' },
      { key: 'LAB_AT_HQ', label: 'LAB' },
      { key: 'HANDOVER', label: 'Ready for HandOver' },
      { key: 'INVOICED_7', label: 'Invoiced (Last 7)' }
    ],
    emptyCopy: {
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
    },
    resolveTransitBadge: function (labWorkflowStatus) {
      var st = String(labWorkflowStatus || '').trim().toUpperCase()
      if (TRANSIT_TO_LAB.indexOf(st) >= 0) return { label: 'To Lab', cssClass: 'transit-to-lab' }
      if (TRANSIT_TO_STORE.indexOf(st) >= 0) return { label: 'To Store', cssClass: 'transit-to-store' }
      return null
    }
  }
})()
