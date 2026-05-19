/**
 * Resolve POS product-type rules from startup config only — no string aliases.
 * Unknown keys use OPTIONAL lens wizard (frame-only allowed) until configured in Foundry.
 */

const UNCONFIGURED_LENS_WIZARD_POLICY = 'OPTIONAL'
const UNCONFIGURED_FULFILLMENT_MODE = 'DUAL'

/**
 * @param {string} productTypeKey
 * @returns {object|null}
 */
function unconfiguredProductTypeRule(productTypeKey) {
  const key = String(productTypeKey || '').trim().toUpperCase()
  if (!key) return null
  return {
    key,
    fulfillment_mode: UNCONFIGURED_FULFILLMENT_MODE,
    rx_required: false,
    allow_qty_gt_1: true,
    lens_wizard_policy: UNCONFIGURED_LENS_WIZARD_POLICY,
    requires_unit_barcode: true,
    unconfigured: true
  }
}

/**
 * @param {Array<{ key: string }>} productTypeConfig
 * @param {string} productTypeKey
 * @returns {object|null}
 */
function resolveProductTypeRule(productTypeConfig, productTypeKey) {
  const rules = Array.isArray(productTypeConfig) ? productTypeConfig : []
  const raw = String(productTypeKey || '').trim().toUpperCase()
  if (!raw) return null
  const exact = rules.find((r) => r && String(r.key || '').trim().toUpperCase() === raw)
  if (exact) return exact
  return unconfiguredProductTypeRule(raw)
}

module.exports = {
  resolveProductTypeRule,
  unconfiguredProductTypeRule,
  UNCONFIGURED_LENS_WIZARD_POLICY,
  UNCONFIGURED_FULFILLMENT_MODE
}
