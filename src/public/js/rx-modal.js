/* ─── Add Rx — 3-step wizard (Patient → Lifestyle → Eye test) ───────────── */

var _rxModalCtx = null
var _rxModalCatalog = null
var _rxModalStep = 1
var _rxModalState = null

function rxModalEsc (html) {
  if (!html) return ''
  return String(html)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function rxModalTodayInput () {
  if (typeof window.cosmosDateToInputIso === 'function' && typeof window.cosmosIstToday === 'function') {
    return window.cosmosDateToInputIso(window.cosmosIstToday())
  }
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function rxModalDefaultState () {
  return {
    patient: {
      familyKey: '',
      walkinName: '',
      testedAt: rxModalTodayInput(),
      hasSpectacles: false
    },
    lifestyle: {
      screen_hrs: '',
      working_conditions: [],
      diabetes: false,
      hypertension: false,
      eye_surgery: false,
      family_eye_history: '',
      has_spectacles: false
    },
    eyetest: {
      re_va: '',
      le_va: '',
      re_sph: '',
      re_cyl: '',
      re_axis: '',
      re_add: '',
      le_sph: '',
      le_cyl: '',
      le_axis: '',
      le_add: '',
      pd: '',
      lens_type: '',
      notes: ''
    }
  }
}

function rxModalApiFetch (method, path, body) {
  if (typeof window.cxApiFetch === 'function') return window.cxApiFetch(method, path, body)
  return (async function () {
    var apiKey = await window.cosmosEnsureApiKey()
    var headers = {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      Authorization: 'Bearer ' + (sessionStorage.getItem('cosmos_token') || '')
    }
    var res = await fetch(path, {
      method: method,
      headers: headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
    var data = {}
    try {
      data = await res.json()
    } catch (_) {}
    if (!res.ok) throw new Error((data && data.message) || 'HTTP ' + res.status)
    if (data && Object.prototype.hasOwnProperty.call(data, 'success') && data.success === false) {
      throw new Error(data.message || 'Request failed')
    }
    return data
  })()
}

function rxModalFamilyApiPath (customerId) {
  var p = String(window.location.pathname || '')
  if (p.indexOf('/cx') === 0) return '/api/cx/customers/' + customerId + '/family-names'
  return '/api/pos/customers/' + customerId + '/family-names'
}

function rxModalCanSaveGatepass () {
  try {
    var u = JSON.parse(sessionStorage.getItem('cosmos_user') || '{}')
    var perms = (u.permissions || []).map(function (x) {
      return String(x).toLowerCase()
    })
    return perms.indexOf('gatepass.action') >= 0
  } catch (_) {
    return true
  }
}

function rxModalCanSaveCx () {
  if (typeof window.cosmosCxAllows === 'function') {
    return window.cosmosCxAllows(['cx.eye_tests.create'])
  }
  return true
}

function rxModalStoreLabel () {
  try {
    var u = JSON.parse(sessionStorage.getItem('cosmos_user') || '{}')
    if (u.store_name) return String(u.store_name)
    if (u.store_id) return 'Store #' + u.store_id
  } catch (_) {}
  return 'This store'
}

async function rxModalEnsureCatalog () {
  if (_rxModalCatalog) return _rxModalCatalog
  try {
    var res = await rxModalApiFetch('GET', '/api/meta/rx-modal-catalog')
    _rxModalCatalog = res.data || {}
  } catch (_) {
    _rxModalCatalog = {
      screen_time_options: [],
      working_condition_options: [],
      family_eye_history_options: [],
      vision_acuity_options: [],
      wizard_steps: [
        { key: 'patient', label: 'Patient', icon: '👤' },
        { key: 'lifestyle', label: 'Lifestyle', icon: '♥' },
        { key: 'eyetest', label: 'Eye test', icon: '👁' }
      ]
    }
  }
  return _rxModalCatalog
}

function rxModalParseLifestyleNotes (notes) {
  if (!notes) return {}
  try {
    var o = JSON.parse(notes)
    return typeof o === 'object' && o ? o : {}
  } catch (_) {
    return {}
  }
}

async function rxModalLoadLifestyle (customerId) {
  if (!customerId) return
  try {
    var res = await rxModalApiFetch('GET', '/api/cx/customers/' + customerId + '/lifestyle')
    var row = res.data
    if (!row) return
    var extra = rxModalParseLifestyleNotes(row.notes)
    _rxModalState.lifestyle.screen_hrs = row.screen_hrs || ''
    if (row.frame_pref) {
      var keys = String(row.frame_pref).split(',').map(function (s) {
        return s.trim()
      })
      _rxModalState.lifestyle.working_conditions = keys.filter(Boolean)
    }
    _rxModalState.lifestyle.diabetes = !!extra.diabetes
    _rxModalState.lifestyle.hypertension = !!extra.hypertension
    _rxModalState.lifestyle.eye_surgery = !!extra.eye_surgery
    _rxModalState.lifestyle.family_eye_history = extra.family_eye_history || ''
    _rxModalState.lifestyle.has_spectacles = !!extra.has_spectacles
  } catch (_) {}
}

function rxModalPillsHtml (options, selectedValue, dataAttr, multi) {
  var html = '<div class="rx-pill-row" role="group">'
  ;(options || []).forEach(function (opt) {
    var val = opt.value != null ? opt.value : opt.label
    var on = multi
      ? (_rxModalState.lifestyle.working_conditions || []).indexOf(opt.label) >= 0
      : String(selectedValue) === String(val)
    html +=
      '<button type="button" class="rx-pill' +
      (on ? ' is-on' : '') +
      '" data-' +
      dataAttr +
      '="' +
      rxModalEsc(val) +
      '" aria-pressed="' +
      (on ? 'true' : 'false') +
      '">' +
      rxModalEsc(opt.label) +
      '</button>'
  })
  return html + '</div>'
}

function rxModalPatientChipLabel () {
  if (!_rxModalCtx || !_rxModalState) return 'Patient'
  if (_rxModalCtx.customerId && _rxModalCtx.customerId > 0) {
    var fk = _rxModalState.patient.familyKey
    if (fk && fk.indexOf('fn:') === 0) {
      var row = (_rxModalCtx.familyNames || []).find(function (fn) {
        var id = fn.family_name_id != null ? fn.family_name_id : fn.id
        return 'fn:' + id === fk
      })
      if (row) return 'Family — ' + (row.family_name || row.name || '')
    }
    if (fk && fk.indexOf('new:') === 0) {
      var newRow = (_rxModalCtx.familyNames || []).find(function (fn) { return fn._tempKey === fk })
      if (newRow) return newRow.family_name
    }
    return (_rxModalCtx.customerName || 'Primary')
  }
  return _rxModalState.patient.walkinName || _rxModalCtx.visitorName || 'Walk-in'
}

function rxModalVaChipsHtml (eye, current) {
  var opts = (_rxModalCatalog && _rxModalCatalog.vision_acuity_options) || []
  var cur = current || ''
  var html = '<div class="rx-et-va-chips" role="group" aria-label="' + rxModalEsc(eye) + ' vision">'
  html +=
    '<button type="button" class="rx-et-va-chip' +
    (cur === '' ? ' is-on' : '') +
    '" data-rx-va-eye="' +
    eye +
    '" data-rx-va-value="">—</button>'
  opts.forEach(function (o) {
    var on = cur === o.label ? ' is-on' : ''
    html +=
      '<button type="button" class="rx-et-va-chip' +
      on +
      '" data-rx-va-eye="' +
      eye +
      '" data-rx-va-value="' +
      rxModalEsc(o.label) +
      '">' +
      rxModalEsc(o.label) +
      '</button>'
  })
  html += '</div>'
  html +=
    '<input type="hidden" id="rx-modal-' +
    eye +
    '-va" value="' +
    rxModalEsc(cur) +
    '">'
  return html
}

function rxModalPowerCell (id, label, value, placeholder) {
  var valAttr = value !== '' && value != null ? ' value="' + rxModalEsc(String(value)) + '"' : ''
  return (
    '<div class="rx-et-power-cell">' +
    '<span class="rx-et-power-lbl">' +
    label +
    '</span>' +
    '<input type="text" inputmode="decimal" class="rx-et-power-input" id="rx-modal-' +
    id +
    '" autocomplete="off"' +
    valAttr +
    ' placeholder="' +
    rxModalEsc(placeholder || '') +
    '">' +
    '</div>'
  )
}

function rxModalApplyShellMode () {
  var ov = document.getElementById('modal-add-rx')
  if (ov) {
    ov.classList.toggle('rx-modal--eyetest-full', _rxModalStep === 3)
  }
  var pane = document.getElementById('rx-modal-pane')
  if (!pane) return
  pane.classList.toggle('rx-wizard-scroll', _rxModalStep < 3)
  pane.classList.toggle('rx-et-scroll-host', _rxModalStep === 3)
}

function rxModalRenderStepnav () {
  var steps = (_rxModalCatalog && _rxModalCatalog.wizard_steps) || []
  var nav = document.getElementById('rx-modal-stepnav')
  if (!nav) return
  nav.innerHTML = steps
    .map(function (s, i) {
      var n = i + 1
      var cls = 'rx-stepnav-item'
      if (n === _rxModalStep) cls += ' is-active'
      else if (n < _rxModalStep) cls += ' is-done'
      return (
        '<div class="' +
        cls +
        '" role="tab" aria-selected="' +
        (n === _rxModalStep ? 'true' : 'false') +
        '">' +
        '<span aria-hidden="true">' +
        (s.icon || '') +
        '</span>' +
        rxModalEsc(s.label) +
        '</div>'
      )
    })
    .join('')
}

function rxModalRenderPatientStep () {
  var linked = _rxModalCtx.customerId && _rxModalCtx.customerId > 0
  var html = []
  if (linked) {
    html.push('<div class="rx-profile-card">')
    html.push(
      '<strong>Cx account linked</strong> — prescriptions save to this customer. Pick who this test is for below.'
    )
    html.push('</div>')
    html.push('<div class="fgrp"><label>Who is this test for?</label>')
    html.push('<div class="rx-who-scroller" role="group" aria-label="Who is this test for?">')
    var curKey = _rxModalState.patient.familyKey
    var primaryOn = curKey === ''
    html.push(
      '<button type="button" class="rx-who-btn' + (primaryOn ? ' is-on' : '') + '" data-rx-who="">' +
      '<span class="rx-who-btn-name">' + rxModalEsc(_rxModalCtx.customerName || 'Primary') + '</span>' +
      '<span class="rx-who-btn-tag">primary</span>' +
      '</button>'
    )
    ;(_rxModalCtx.familyNames || []).forEach(function (fn) {
      var id = fn.family_name_id != null ? fn.family_name_id : fn.id
      var name = fn.family_name || fn.name || ''
      var key = fn._tempKey || ('fn:' + id)
      if ((id || fn._tempKey) && name) {
        var on = curKey === key
        html.push(
          '<button type="button" class="rx-who-btn' + (on ? ' is-on' : '') + '" data-rx-who="' + rxModalEsc(key) + '">' +
          '<span class="rx-who-btn-name">' + rxModalEsc(name) + '</span>' +
          '</button>'
        )
      }
    })
    html.push(
      '<button type="button" class="rx-who-add-btn" id="rx-who-add-btn" aria-label="Add family name">+ Add name</button>'
    )
    html.push('</div></div>')
    html.push(
      '<div id="rx-who-new-row" class="rx-who-new-row" hidden>' +
      '<input type="text" id="rx-who-new-name" class="inp" placeholder="Enter name" autocomplete="off">' +
      '<button type="button" class="btn primary" id="rx-who-confirm-btn">Add</button>' +
      '</div>'
    )
  } else {
    html.push('<div class="rx-profile-card">')
    html.push(
      '<strong>Walk-in visit</strong> — Rx links to this GatePass visitor. A Cx account is created later if the phone matches.'
    )
    html.push('</div>')
    if (_rxModalCtx.visitorPhone) {
      html.push(
        '<div class="fgrp"><label>Mobile</label><input type="text" class="inp" readonly value="' +
          rxModalEsc(_rxModalCtx.visitorPhone) +
          '"></div>'
      )
    }
    html.push('<div class="fgrp"><label for="rx-modal-patient-walkin">Patient name <span class="label-req">*</span></label>')
    html.push(
      '<input type="text" id="rx-modal-patient-walkin" class="inp" value="' +
        rxModalEsc(_rxModalState.patient.walkinName || '') +
        '" placeholder="Full name">'
    )
    html.push('</div>')
  }
  html.push('<div class="fgrp"><label for="rx-modal-date">Test date <span class="label-req">*</span></label>')
  html.push(
    '<input type="date" id="rx-modal-date" class="inp" value="' +
      rxModalEsc(_rxModalState.patient.testedAt || '') +
      '">'
  )
  html.push('</div>')
  html.push(
    '<label class="rx-toggle-row" for="rx-modal-has-specs">' +
      '<span class="rx-toggle-text">Currently wears spectacles?</span>' +
      '<span class="rx-toggle"><input type="checkbox" id="rx-modal-has-specs"' +
      (_rxModalState.patient.hasSpectacles ? ' checked' : '') +
      '><span class="rx-toggle-slider"></span></span></label>'
  )
  return html.join('')
}

function rxModalRenderLifestyleStep () {
  var linked = _rxModalCtx.customerId && _rxModalCtx.customerId > 0
  var html = []
  if (!linked) {
    html.push(
      '<div class="rx-lifestyle-skip">Lifestyle is saved on the Cx profile when this visitor is linked to a customer. You can continue to the eye test.</div>'
    )
  }
  html.push('<div class="fgrp"><label for="rx-modal-screen-hrs">Screen time (hours/day)</label>')
  html.push(
    '<input type="text" id="rx-modal-screen-hrs" class="inp" placeholder="e.g. 4–6 hours" value="' +
      rxModalEsc(_rxModalState.lifestyle.screen_hrs || '') +
      '">'
  )
  html.push('</div>')
  html.push(rxModalPillsHtml(_rxModalCatalog.screen_time_options, _rxModalState.lifestyle.screen_hrs, 'rx-screen-pill', false))
  html.push('<div class="fgrp" style="margin-top:8px"><label>Working conditions</label>')
  html.push('<span class="td2" style="font-size:12px;display:block;margin-bottom:6px">Select all that apply</span></div>')
  html.push(rxModalPillsHtml(_rxModalCatalog.working_condition_options, null, 'rx-work-pill', true))
  ;['diabetes', 'hypertension', 'eye_surgery'].forEach(function (key) {
    var labels = { diabetes: 'Diabetes', hypertension: 'Hypertension', eye_surgery: 'Previous eye surgery' }
    html.push(
      '<label class="rx-toggle-row" for="rx-modal-' +
        key +
        '"><span class="rx-toggle-text">' +
        labels[key] +
        '</span><span class="rx-toggle"><input type="checkbox" id="rx-modal-' +
        key +
        '"' +
        (_rxModalState.lifestyle[key] ? ' checked' : '') +
        '><span class="rx-toggle-slider"></span></span></label>'
    )
  })
  html.push('<div class="fgrp"><label for="rx-modal-family-eye">Family eye history</label>')
  html.push(
    '<input type="text" id="rx-modal-family-eye" class="inp" placeholder="e.g. Glaucoma in family" value="' +
      rxModalEsc(_rxModalState.lifestyle.family_eye_history || '') +
      '">'
  )
  html.push('</div>')
  html.push(rxModalPillsHtml(_rxModalCatalog.family_eye_history_options, _rxModalState.lifestyle.family_eye_history, 'rx-family-pill', false))
  return html.join('')
}

function rxModalRenderEyetestStep () {
  var e = _rxModalState.eyetest
  var html = []
  html.push('<div class="rx-et-shell">')
  html.push('<header class="rx-et-topbar">')
  html.push(
    '<button type="button" class="rx-et-back" id="rx-et-back-lifestyle" aria-label="Back to lifestyle">← Lifestyle</button>'
  )
  html.push('<h2 class="rx-et-title">Eye test</h2>')
  html.push('<button type="button" class="rx-et-close" id="rx-et-close" aria-label="Close">✕</button>')
  html.push('</header>')
  html.push(
    '<div class="rx-et-patient-chip" id="rx-et-patient-chip">' + rxModalEsc(rxModalPatientChipLabel()) + '</div>'
  )
  html.push('<div class="rx-et-scroll">')
  html.push('<div><p class="rx-et-section">Pre-test vision</p>')
  html.push('<div class="rx-et-va-block"><span class="rx-et-va-label">Right eye (RE)</span>')
  html.push(rxModalVaChipsHtml('re', e.re_va))
  html.push('</div>')
  html.push('<div class="rx-et-va-block" style="margin-top:12px"><span class="rx-et-va-label">Left eye (LE)</span>')
  html.push(rxModalVaChipsHtml('le', e.le_va))
  html.push('</div></div>')
  html.push('<div><p class="rx-et-section">Prescribed power</p>')
  html.push('<div class="rx-et-eye-grid">')
  html.push('<article class="rx-et-eye-card">')
  html.push('<h3 class="rx-et-eye-title">RIGHT EYE (RE)</h3>')
  html.push('<div class="rx-et-power-row">')
  html.push(rxModalPowerCell('re-sph', 'SPH', e.re_sph, '+0.00'))
  html.push(rxModalPowerCell('re-cyl', 'CYL', e.re_cyl, '−0.00'))
  html.push(rxModalPowerCell('re-axis', 'AXIS', e.re_axis, '0°'))
  html.push(rxModalPowerCell('re-add', 'ADD', e.re_add, '+0.00'))
  html.push('</div></article>')
  html.push('<article class="rx-et-eye-card">')
  html.push('<h3 class="rx-et-eye-title">LEFT EYE (LE)</h3>')
  html.push('<div class="rx-et-power-row">')
  html.push(rxModalPowerCell('le-sph', 'SPH', e.le_sph, '+0.00'))
  html.push(rxModalPowerCell('le-cyl', 'CYL', e.le_cyl, '−0.00'))
  html.push(rxModalPowerCell('le-axis', 'AXIS', e.le_axis, '0°'))
  html.push(rxModalPowerCell('le-add', 'ADD', e.le_add, '+0.00'))
  html.push('</div></article>')
  html.push('</div></div>')
  html.push('<div><p class="rx-et-section">Other details</p>')
  html.push('<div class="rx-et-meta-grid">')
  html.push(
    '<div class="rx-et-meta-field"><label for="rx-modal-pd">PD (mm)</label><input type="text" inputmode="decimal" class="rx-et-meta-input" id="rx-modal-pd" placeholder="e.g. 63" value="' +
      rxModalEsc(e.pd != null ? String(e.pd) : '') +
      '"></div>'
  )
  html.push(
    '<div class="rx-et-meta-field"><label for="rx-modal-lens-type">Lens type</label><input type="text" class="rx-et-meta-input" id="rx-modal-lens-type" placeholder="SV / Progressive" value="' +
      rxModalEsc(e.lens_type || '') +
      '"></div>'
  )
  html.push(
    '<div class="rx-et-meta-field rx-et-meta-notes"><label for="rx-modal-notes">Notes</label><input type="text" class="rx-et-meta-input" id="rx-modal-notes" placeholder="Optional" value="' +
      rxModalEsc(e.notes || '') +
      '"></div>'
  )
  html.push('</div></div>')
  html.push('</div>')
  html.push('<footer class="rx-et-foot">')
  html.push(
    '<button type="button" class="btn" id="rx-et-back-foot">← Lifestyle</button>'
  )
  html.push('<button type="button" class="btn primary" id="rx-modal-save-btn-et">Save Rx</button>')
  html.push('</footer>')
  html.push('</div>')
  return html.join('')
}

function rxModalRenderPane () {
  var pane = document.getElementById('rx-modal-pane')
  if (!pane) return
  var html = ''
  if (_rxModalStep === 1) html = rxModalRenderPatientStep()
  else if (_rxModalStep === 2) html = rxModalRenderLifestyleStep()
  else html = rxModalRenderEyetestStep()
  pane.innerHTML = html
  rxModalApplyShellMode()
  rxModalBindPaneEvents()
  rxModalRenderStepnav()
  rxModalUpdateFooter()
}

function rxModalSyncPatientFromDom () {
  var activeBtn = document.querySelector('#rx-modal-pane .rx-who-btn.is-on')
  var walk = document.getElementById('rx-modal-patient-walkin')
  var dateEl = document.getElementById('rx-modal-date')
  var specs = document.getElementById('rx-modal-has-specs')
  if (activeBtn) _rxModalState.patient.familyKey = activeBtn.getAttribute('data-rx-who') || ''
  if (walk) _rxModalState.patient.walkinName = String(walk.value || '').trim()
  if (dateEl) _rxModalState.patient.testedAt = dateEl.value
  if (specs) {
    _rxModalState.patient.hasSpectacles = specs.checked
    _rxModalState.lifestyle.has_spectacles = specs.checked
  }
}

function rxModalSyncLifestyleFromDom () {
  var sh = document.getElementById('rx-modal-screen-hrs')
  var fe = document.getElementById('rx-modal-family-eye')
  if (sh) _rxModalState.lifestyle.screen_hrs = String(sh.value || '').trim()
  if (fe) _rxModalState.lifestyle.family_eye_history = String(fe.value || '').trim()
  ;['diabetes', 'hypertension', 'eye_surgery'].forEach(function (key) {
    var el = document.getElementById('rx-modal-' + key)
    if (el) _rxModalState.lifestyle[key] = el.checked
  })
}

function rxModalSyncEyetestFromDom () {
  var ids = [
    're-va',
    'le-va',
    're-sph',
    're-cyl',
    're-axis',
    're-add',
    'le-sph',
    'le-cyl',
    'le-axis',
    'le-add',
    'pd',
    'lens-type',
    'notes'
  ]
  ids.forEach(function (suffix) {
    var el = document.getElementById('rx-modal-' + suffix)
    if (!el) return
    var key = suffix.replace(/-/g, '_')
    _rxModalState.eyetest[key] = el.value
  })
}

function rxModalParseNum (v) {
  if (v === '' || v == null) return null
  var n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

function rxModalBuildSaveBody () {
  var familyNameId = null
  var patientName = null
  if (_rxModalCtx.customerId && _rxModalCtx.customerId > 0) {
    var fk = _rxModalState.patient.familyKey
    if (fk && fk.indexOf('fn:') === 0) {
      familyNameId = parseInt(fk.slice(3), 10)
    } else if (fk && fk.indexOf('new:') === 0) {
      var newEntry = (_rxModalCtx.familyNames || []).find(function (fn) { return fn._tempKey === fk })
      if (newEntry) patientName = newEntry.family_name
    }
  } else {
    patientName = _rxModalState.patient.walkinName || _rxModalCtx.visitorName || null
  }
  var e = _rxModalState.eyetest
  return {
    tested_at: _rxModalState.patient.testedAt || rxModalTodayInput(),
    family_name_id: familyNameId,
    patient_name: patientName,
    re_va: e.re_va || null,
    le_va: e.le_va || null,
    re_sph: rxModalParseNum(e.re_sph),
    re_cyl: rxModalParseNum(e.re_cyl),
    re_axis: e.re_axis !== '' && e.re_axis != null ? parseInt(String(e.re_axis), 10) : null,
    re_add: rxModalParseNum(e.re_add),
    le_sph: rxModalParseNum(e.le_sph),
    le_cyl: rxModalParseNum(e.le_cyl),
    le_axis: e.le_axis !== '' && e.le_axis != null ? parseInt(String(e.le_axis), 10) : null,
    le_add: rxModalParseNum(e.le_add),
    pd: rxModalParseNum(e.pd),
    lens_type: e.lens_type || null,
    notes: e.notes || null,
    lifestyle: Object.assign({}, _rxModalState.lifestyle, {
      has_spectacles: _rxModalState.patient.hasSpectacles
    })
  }
}

function rxModalValidateStep (step) {
  if (step === 1) {
    rxModalSyncPatientFromDom()
    if (!_rxModalCtx.customerId || _rxModalCtx.customerId <= 0) {
      if (!_rxModalState.patient.walkinName) {
        var walk = document.getElementById('rx-modal-patient-walkin')
        if (walk && typeof window.cosmosFieldError === 'function') {
          window.cosmosFieldError(walk, 'Enter patient name')
        }
        if (typeof window.cosmosToastWarn === 'function') window.cosmosToastWarn('Enter patient name.')
        return false
      }
    }
    if (!_rxModalState.patient.testedAt) {
      if (typeof window.cosmosToastWarn === 'function') window.cosmosToastWarn('Select test date.')
      return false
    }
    return true
  }
  if (step === 2) {
    rxModalSyncLifestyleFromDom()
    return true
  }
  if (step === 3) {
    rxModalSyncEyetestFromDom()
    var e = _rxModalState.eyetest
    if (!rxModalParseNum(e.re_sph) && !rxModalParseNum(e.le_sph)) {
      var sphEl = document.getElementById('rx-modal-re-sph') || document.getElementById('rx-modal-le-sph')
      if (sphEl) {
        sphEl.classList.add('rx-field-err')
        if (typeof window.cosmosFieldError === 'function') {
          window.cosmosFieldError(sphEl, 'Enter RE or LE SPH')
        }
      }
      if (typeof window.cosmosToastWarn === 'function') {
        window.cosmosToastWarn('Enter at least one prescribed SPH (RE or LE).')
      }
      return false
    }
    return true
  }
  return true
}

function rxModalUpdateFooter () {
  var back = document.getElementById('rx-modal-back-btn')
  var next = document.getElementById('rx-modal-next-btn')
  var save = document.getElementById('rx-modal-save-btn')
  var cancel = document.getElementById('rx-modal-cancel-btn')
  if (back) back.hidden = _rxModalStep <= 1
  if (next) {
    next.hidden = _rxModalStep >= 3
    next.textContent = _rxModalStep === 1 ? 'Next: Lifestyle →' : 'Next: Eye test →'
  }
  if (save) save.hidden = _rxModalStep >= 3
  if (cancel) cancel.style.display = _rxModalStep < 3 ? '' : 'none'
  var foot = document.querySelector('#modal-add-rx .rx-wizard-foot')
  if (foot) foot.style.display = _rxModalStep === 3 ? 'none' : ''
}

function rxModalBindPaneEvents () {
  var pane = document.getElementById('rx-modal-pane')
  if (!pane) return

  pane.querySelectorAll('.rx-who-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      _rxModalState.patient.familyKey = btn.getAttribute('data-rx-who') || ''
      pane.querySelectorAll('.rx-who-btn').forEach(function (b) {
        b.classList.toggle('is-on', b === btn)
      })
    })
  })

  var addBtn = document.getElementById('rx-who-add-btn')
  var newRow = document.getElementById('rx-who-new-row')
  if (addBtn && newRow) {
    addBtn.addEventListener('click', function () {
      newRow.hidden = false
      var inp = document.getElementById('rx-who-new-name')
      if (inp) inp.focus()
    })
  }
  var confirmBtn = document.getElementById('rx-who-confirm-btn')
  if (confirmBtn) {
    confirmBtn.addEventListener('click', function () {
      var inp = document.getElementById('rx-who-new-name')
      var name = inp ? String(inp.value || '').trim() : ''
      if (!name) {
        if (typeof window.cosmosToastWarn === 'function') window.cosmosToastWarn('Enter a name first.')
        if (inp && typeof window.cosmosFieldError === 'function') window.cosmosFieldError(inp, 'Required')
        return
      }
      if (!_rxModalCtx.familyNames) _rxModalCtx.familyNames = []
      var tempKey = 'new:' + Date.now()
      _rxModalCtx.familyNames.push({ family_name_id: null, family_name: name, _tempKey: tempKey })
      _rxModalState.patient.familyKey = tempKey
      rxModalRenderPane()
    })
  }

  pane.querySelectorAll('[data-rx-screen-pill]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      _rxModalState.lifestyle.screen_hrs = btn.getAttribute('data-rx-screen-pill')
      var inp = document.getElementById('rx-modal-screen-hrs')
      if (inp) inp.value = _rxModalState.lifestyle.screen_hrs
      rxModalRenderPane()
    })
  })
  pane.querySelectorAll('[data-rx-work-pill]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var label = btn.getAttribute('data-rx-work-pill')
      var arr = _rxModalState.lifestyle.working_conditions || []
      var ix = arr.indexOf(label)
      if (ix >= 0) arr.splice(ix, 1)
      else arr.push(label)
      _rxModalState.lifestyle.working_conditions = arr
      rxModalRenderPane()
    })
  })
  pane.querySelectorAll('[data-rx-family-pill]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      _rxModalState.lifestyle.family_eye_history = btn.getAttribute('data-rx-family-pill')
      var inp = document.getElementById('rx-modal-family-eye')
      if (inp) inp.value = _rxModalState.lifestyle.family_eye_history
      rxModalRenderPane()
    })
  })

  pane.querySelectorAll('[data-rx-va-eye]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var eye = btn.getAttribute('data-rx-va-eye')
      var val = btn.getAttribute('data-rx-va-value') || ''
      if (eye === 're') _rxModalState.eyetest.re_va = val
      if (eye === 'le') _rxModalState.eyetest.le_va = val
      var hid = document.getElementById('rx-modal-' + eye + '-va')
      if (hid) hid.value = val
      pane.querySelectorAll('[data-rx-va-eye="' + eye + '"]').forEach(function (b) {
        b.classList.toggle('is-on', b === btn)
      })
    })
  })

  pane.querySelectorAll('.rx-et-power-input').forEach(function (inp) {
    inp.addEventListener('input', function () {
      inp.classList.remove('rx-field-err')
      if (typeof window.cosmosFieldClear === 'function') window.cosmosFieldClear(inp)
    })
  })

  var etBack = document.getElementById('rx-et-back-lifestyle')
  var etBackFoot = document.getElementById('rx-et-back-foot')
  if (etBack) etBack.addEventListener('click', rxModalOnBack)
  if (etBackFoot) etBackFoot.addEventListener('click', rxModalOnBack)
  var etClose = document.getElementById('rx-et-close')
  if (etClose) etClose.addEventListener('click', window.closeRxModal)
  var saveInPane = document.getElementById('rx-modal-save-btn-et')
  if (saveInPane && !saveInPane.dataset.rxSaveBound) {
    saveInPane.dataset.rxSaveBound = '1'
    saveInPane.addEventListener('click', function () {
      void window.saveRxModal()
    })
  }
}

function rxModalGoStep (n) {
  _rxModalStep = Math.max(1, Math.min(3, n))
  rxModalRenderPane()
}

async function rxModalLoadFamilyNames (ctx) {
  if (!ctx.customerId || ctx.customerId <= 0) return ctx
  if (ctx.familyNames && ctx.familyNames.length) return ctx
  try {
    var res = await rxModalApiFetch('GET', rxModalFamilyApiPath(ctx.customerId))
    ctx.familyNames = res.data || []
  } catch (_) {
    ctx.familyNames = []
  }
  return ctx
}

window.closeRxModal = function () {
  var ov = document.getElementById('modal-add-rx')
  if (ov) {
    ov.style.display = 'none'
    ov.classList.remove('open')
    ov.classList.remove('rx-modal--eyetest-full')
  }
  _rxModalCtx = null
  _rxModalState = null
  _rxModalStep = 1
  if (window.cosmosLockAppBodyScroll) window.cosmosLockAppBodyScroll()
}

window.openRxModal = async function (options) {
  var ctx = options || {}
  if (ctx.source === 'gatepass' && !rxModalCanSaveGatepass()) {
    if (typeof window.cosmosToastWarn === 'function') window.cosmosToastWarn('No permission for GatePass actions.')
    return
  }
  if (ctx.source === 'cx' && !rxModalCanSaveCx()) {
    if (typeof window.cosmosToastWarn === 'function') window.cosmosToastWarn('No permission to record eye tests.')
    return
  }
  if (ctx.source === 'gatepass' && !ctx.visitorId) {
    if (typeof window.cosmosToastError === 'function') window.cosmosToastError('Visitor id missing.')
    return
  }
  if (ctx.source === 'cx' && (!ctx.customerId || ctx.customerId <= 0)) {
    if (typeof window.cosmosToastError === 'function') window.cosmosToastError('Customer id missing.')
    return
  }

  await rxModalEnsureCatalog()
  _rxModalCtx = {
    source: ctx.source,
    visitorId: ctx.visitorId || null,
    customerId: ctx.customerId || null,
    customerName: ctx.customerName || '',
    visitorName: ctx.visitorName || '',
    visitorPhone: ctx.visitorPhone || ctx.phone || '',
    familyNames: ctx.familyNames || []
  }
  await rxModalLoadFamilyNames(_rxModalCtx)
  _rxModalState = rxModalDefaultState()
  _rxModalState.patient.walkinName = _rxModalCtx.visitorName || ''
  if (_rxModalCtx.customerId) await rxModalLoadLifestyle(_rxModalCtx.customerId)
  _rxModalStep = 1

  var ov = document.getElementById('modal-add-rx')
  if (ov) {
    ov.style.display = 'flex'
    ov.classList.add('open')
    if (window.cosmosLockAppBodyScroll) window.cosmosLockAppBodyScroll()
  }
  rxModalRenderPane()
}

window.saveRxModal = async function () {
  if (!_rxModalCtx || !_rxModalState) return
  if (!rxModalValidateStep(3)) return
  var errEl = document.getElementById('rx-modal-error')
  var btn =
    document.getElementById('rx-modal-save-btn-et') ||
    document.getElementById('rx-modal-save-btn')
  var body = rxModalBuildSaveBody()
  if (errEl) errEl.style.display = 'none'
  if (btn && typeof window.cosmosBtnLoading === 'function') window.cosmosBtnLoading(btn)
  try {
    if (_rxModalCtx.source === 'gatepass') {
      await rxModalApiFetch('POST', '/api/gatepass/visitor/' + _rxModalCtx.visitorId + '/rx', body)
    } else {
      body.visitor_id = _rxModalCtx.visitorId || null
      await rxModalApiFetch('POST', '/api/cx/customers/' + _rxModalCtx.customerId + '/eye-tests', body)
    }
    if (typeof window.cosmosBtnSuccess === 'function') window.cosmosBtnSuccess(btn)
    else if (typeof window.cosmosBtnDone === 'function') window.cosmosBtnDone(btn)
    if (typeof window.cosmosToastSuccess === 'function') window.cosmosToastSuccess('Prescription saved.')
    window.closeRxModal()
    if (typeof window._rxModalOnSaved === 'function') window._rxModalOnSaved()
  } catch (err) {
    if (btn && typeof window.cosmosBtnDone === 'function') window.cosmosBtnDone(btn)
    var msg = err && err.message ? err.message : 'Could not save prescription.'
    if (errEl) {
      errEl.textContent = msg
      errEl.style.display = 'block'
    }
    if (typeof window.cosmosToastError === 'function') window.cosmosToastError(msg)
  }
}

function rxModalOnNext () {
  if (!rxModalValidateStep(_rxModalStep)) return
  if (_rxModalStep === 1) rxModalSyncPatientFromDom()
  if (_rxModalStep === 2) rxModalSyncLifestyleFromDom()
  rxModalGoStep(_rxModalStep + 1)
}

function rxModalOnBack () {
  if (_rxModalStep === 2) rxModalSyncLifestyleFromDom()
  if (_rxModalStep === 3) rxModalSyncEyetestFromDom()
  rxModalGoStep(_rxModalStep - 1)
}

function rxModalInitOnce () {
  if (window._rxModalBound) return
  window._rxModalBound = true
  var ov = document.getElementById('modal-add-rx')
  if (ov) {
    ov.addEventListener('click', function (e) {
      if (e.target === ov && _rxModalStep < 3) window.closeRxModal()
    })
  }
  var closeBtn = document.getElementById('rx-modal-close-btn')
  if (closeBtn) closeBtn.addEventListener('click', window.closeRxModal)
  var cancelBtn = document.getElementById('rx-modal-cancel-btn')
  if (cancelBtn) cancelBtn.addEventListener('click', window.closeRxModal)
  var backBtn = document.getElementById('rx-modal-back-btn')
  if (backBtn) backBtn.addEventListener('click', rxModalOnBack)
  var nextBtn = document.getElementById('rx-modal-next-btn')
  if (nextBtn) nextBtn.addEventListener('click', rxModalOnNext)
  var saveBtn = document.getElementById('rx-modal-save-btn')
  if (saveBtn) saveBtn.addEventListener('click', function () { void window.saveRxModal() })
}

document.addEventListener('DOMContentLoaded', rxModalInitOnce)
