'use strict'

/**
 * Canonical list of membership plan capability columns.
 *
 * Each entry maps a column name on dbo.membership_plans to a human-readable label
 * used in Command Unit offer creation and in the POS/API eligibility filter.
 *
 * When you add a new capability column via a migration, add it here too.
 * This is the single source of truth — no other file should hardcode these keys.
 */
const MEMBERSHIP_CAPABILITY_GROUPS = Object.freeze([
  {
    key: 'has_plus_access',
    label: 'Plus Access Members',
    description: 'Plans that include access to Plus-gated offers (Plus Trail, Explorer, Annual, Life, Bright Eye, Business Buddies, Founder Referrer)'
  },
  {
    key: 'extra_cashback_pct',
    label: 'Extra Cashback Plan Members',
    description: 'Plans that provide automatic extra cashback on every purchase (e.g. Founder Referrer 5%, Business Buddies 10%)'
  },
  {
    key: 'flat_discount_pct',
    label: 'Flat Discount Plan Members',
    description: 'Plans that provide a flat % discount on every purchase (e.g. Franchisee Card 50%)'
  },
  {
    key: 'has_one_time_discount',
    label: 'One-Time Discount Plan Members',
    description: 'Plans that include a single one-time discount entitlement (e.g. Bright Eye 50%)'
  },
  {
    key: 'can_create_sub_cards',
    label: 'Sub-Card Issuer Members',
    description: 'Plans that allow the holder to issue membership cards on behalf of others (e.g. Franchisee Card)'
  }
])

/** Set of valid capability key strings for fast lookup / Joi validation. */
const CAPABILITY_KEYS = Object.freeze(MEMBERSHIP_CAPABILITY_GROUPS.map(g => g.key))

module.exports = {
  MEMBERSHIP_CAPABILITY_GROUPS,
  CAPABILITY_KEYS
}
