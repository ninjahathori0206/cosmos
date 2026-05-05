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
  isStructuredOfferType,
  structuredOfferTypeRespectsAllocation
}
