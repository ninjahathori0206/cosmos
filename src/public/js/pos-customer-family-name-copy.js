/* global window */
(function () {
  'use strict'

  var COPY = {
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
  }

  function formatPosFamilyNameCopy(key, vars) {
    var s = COPY[key] || ''
    vars = vars || {}
    Object.keys(vars).forEach(function (k) {
      s = s.split('{' + k + '}').join(vars[k] != null ? String(vars[k]) : '')
    })
    return s
  }

  window.formatPosFamilyNameCopy = formatPosFamilyNameCopy
  window.POS_CUSTOMER_FAMILY_NAME_COPY = COPY
})()
