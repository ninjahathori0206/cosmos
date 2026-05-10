'use strict'

/** Allowed values for dbo.customer_offers.discount_type (aligned with Joi + CHECK constraint). */
const OFFER_DISCOUNT_TYPES = Object.freeze([
  'PCT',
  'FLAT',
  'FREEBIE',
  'BOGO_LOWEST_FREE',
  'BUY_FRAME_GET_LENS_FREE',
  'BUY_LENS_GET_FRAME_FREE'
])

/** Server-side structured rules: BOGO and LAB-combo types respect customer_offer_scope (see customerOfferDiscountService). */
const STRUCTURED_OFFER_TYPES = Object.freeze([
  'BOGO_LOWEST_FREE',
  'BUY_FRAME_GET_LENS_FREE',
  'BUY_LENS_GET_FRAME_FREE'
])

const TRIGGER_TYPES = Object.freeze([
  'ANY_ITEM',
  'MIN_CART_VALUE',
  'SPECIFIC_PRODUCT_TYPE'
])

const BENEFIT_TARGETS = Object.freeze([
  'CART_TOTAL',
  'ELIGIBLE_LINES',
  'CHEAPEST_ITEM'
])

const SCOPE_MODES = Object.freeze([
  'ALL_PRODUCTS',
  'BY_CATEGORY',
  'BY_BRAND_IN_CATEGORY',
  'SELECTED_SKUS'
])

function isStructuredOfferType(discountType) {
  const k = String(discountType || '').trim().toUpperCase()
  return STRUCTURED_OFFER_TYPES.includes(k)
}

/** BOGO uses customer_offer_scope; other structured types do not persist scopes. */
function structuredOfferTypeRespectsAllocation(discountType) {
  return String(discountType || '').trim().toUpperCase() === 'BOGO_LOWEST_FREE'
}

module.exports = {
  OFFER_DISCOUNT_TYPES,
  STRUCTURED_OFFER_TYPES,
  TRIGGER_TYPES,
  BENEFIT_TARGETS,
  SCOPE_MODES,
  isStructuredOfferType,
  structuredOfferTypeRespectsAllocation
}
