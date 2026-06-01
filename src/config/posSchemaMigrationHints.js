/**
 * POS Store OS — schema migration hints when checkout SQL references missing columns.
 * Single source for API message + client toast copy.
 */
const POS_SCHEMA_MIGRATION_TOAST_MESSAGE =
  'Database migration required: run sql/migrations/76_pos_orders_membership_sale.sql (and pos_checkout_inventory_drafts.sql if needed).'

const POS_SCHEMA_SQL_MARKERS = [
  'inventory_committed',
  'sold_membership',
  'Invalid column name'
]

function collectErrorMessages(err) {
  const parts = []
  let e = err
  const seen = new Set()
  while (e && !seen.has(e)) {
    seen.add(e)
    if (e.message) parts.push(String(e.message))
    if (Array.isArray(e.precedingErrors)) {
      e.precedingErrors.forEach(function (pe) {
        if (pe && pe.message) parts.push(String(pe.message))
      })
    }
    e = e.originalError || e.cause
  }
  return parts.join(' ')
}

function isPosSchemaMigrationSqlError(err) {
  const hay = collectErrorMessages(err)
  if (!hay) return false
  return POS_SCHEMA_SQL_MARKERS.some(function (marker) {
    return hay.includes(marker)
  })
}

function posSchemaMigrationHttpBody() {
  return {
    status: 503,
    body: { success: false, message: POS_SCHEMA_MIGRATION_TOAST_MESSAGE }
  }
}

module.exports = {
  POS_SCHEMA_MIGRATION_TOAST_MESSAGE,
  isPosSchemaMigrationSqlError,
  posSchemaMigrationHttpBody
}
