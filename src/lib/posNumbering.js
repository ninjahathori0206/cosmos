'use strict'

const { formatDateYmd } = require('./cosmosIst')

/** Indian FY label for invoice numbers, e.g. May 2026 → "2627". */
function getIndianFyLabelForInvoice(date = new Date()) {
  const istDateStr = formatDateYmd(date)
  const parts = istDateStr.split('-').map(Number)
  const y = parts[0]
  const m = parts[1]
  if (!Number.isFinite(y) || !Number.isFinite(m)) return '0000'
  const fyStart = m >= 4 ? y : y - 1
  const fyEnd = (fyStart + 1) % 100
  const fyStartShort = fyStart % 100
  return String(fyStartShort).padStart(2, '0') + String(fyEnd).padStart(2, '0')
}

function compactStoreCodeForInvoice(storeCode) {
  const s = String(storeCode || 'STORE').trim()
  const trimmed = s.replace(/^EW-/i, '').replace(/-/g, '')
  return trimmed || 'STORE'
}

function membershipInvoiceSeqSettingKey(storeCompact, fy) {
  return `pos_membership_invoice_seq_${storeCompact}_${fy}`
}

module.exports = {
  getIndianFyLabelForInvoice,
  compactStoreCodeForInvoice,
  membershipInvoiceSeqSettingKey
}
