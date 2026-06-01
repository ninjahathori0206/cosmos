'use strict'

/**
 * Canonical relationship keys for membership buddies (dependents).
 * Stored in dbo.customer_membership_dependents.relationship as key (not free text).
 */
const MEMBERSHIP_DEPENDENT_RELATIONSHIPS = Object.freeze([
  { key: 'spouse', label: 'Spouse' },
  { key: 'parent', label: 'Parent' },
  { key: 'child', label: 'Child' },
  { key: 'sibling', label: 'Sibling' },
  { key: 'other', label: 'Other' }
])

const RELATIONSHIP_KEYS = Object.freeze(
  MEMBERSHIP_DEPENDENT_RELATIONSHIPS.map((r) => r.key)
)

function getMembershipDependentRelationshipsForApi() {
  return MEMBERSHIP_DEPENDENT_RELATIONSHIPS.map((r) => ({ key: r.key, label: r.label }))
}

function isValidMembershipDependentRelationship(key) {
  return RELATIONSHIP_KEYS.includes(String(key || '').trim())
}

function relationshipLabel(key) {
  const k = String(key || '').trim()
  const row = MEMBERSHIP_DEPENDENT_RELATIONSHIPS.find((r) => r.key === k)
  return row ? row.label : k
}

module.exports = {
  MEMBERSHIP_DEPENDENT_RELATIONSHIPS,
  RELATIONSHIP_KEYS,
  getMembershipDependentRelationshipsForApi,
  isValidMembershipDependentRelationship,
  relationshipLabel
}
