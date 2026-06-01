'use strict'

/**
 * Customer-facing copy for POS same-mobile alternate names (family names).
 * Technical API keys use family_name / family_names — not "alias".
 */
const POS_CUSTOMER_FAMILY_NAME_COPY = Object.freeze({
  modalTitle: 'Mobile already registered',
  modalBody:
    'Mobile already registered as {primary}. Save {name} as a family name and continue?',
  modalConfirm: 'Save family name and continue',
  pickerSubline: '(on file as {primary})',
  pickerAddLink: 'Add family name for this mobile',
  toastAdded: 'Family name saved — linked to existing Cx',
  lensAddChip: '+ Add family name',
  listEmpty: 'No family names linked yet.',
  fallbackBuddyLabel: 'Buddy'
})

function formatPosFamilyNameCopy(key, vars = {}) {
  let s = POS_CUSTOMER_FAMILY_NAME_COPY[key] || ''
  Object.keys(vars).forEach((k) => {
    s = s.split('{' + k + '}').join(String(vars[k] != null ? vars[k] : ''))
  })
  return s
}

function familyNameConfirmErrorMessage(primaryName, proposedName) {
  return formatPosFamilyNameCopy('modalBody', {
    primary: primaryName,
    name: proposedName
  })
}

module.exports = {
  POS_CUSTOMER_FAMILY_NAME_COPY,
  formatPosFamilyNameCopy,
  familyNameConfirmErrorMessage
}
