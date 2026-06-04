/* ─── Add Rx — 3-step wizard (Patient → Lifestyle → Eye test) ───────────── */

var _rxModalCtx = null
var _rxModalCatalog = null
var _rxModalStep = 1
var _rxModalState = null
var _rxPowerSheetField = null
var _rxPowerWheelEye = null

var _RX_POWER_WHEEL_PARTS = ['sph', 'cyl', 'axis', 'add']

var _RX_POWER_FIELD_META = {
  're-sph': { catalogKey: 'prescription_sph_options', title: 'SPH — Right eye', placeholder: '+0.00' },
  're-cyl': { catalogKey: 'prescription_cyl_options', title: 'CYL — Right eye', placeholder: '0.00' },
  're-axis': { catalogKey: 'prescription_axis_options', title: 'AXIS — Right eye', placeholder: '0°' },
  're-add': { catalogKey: 'prescription_add_options', title: 'ADD — Right eye', placeholder: '+0.00' },
  'le-sph': { catalogKey: 'prescription_sph_options', title: 'SPH — Left eye', placeholder: '+0.00' },
  'le-cyl': { catalogKey: 'prescription_cyl_options', title: 'CYL — Left eye', placeholder: '0.00' },
  'le-axis': { catalogKey: 'prescription_axis_options', title: 'AXIS — Left eye', placeholder: '0°' },
  'le-add': { catalogKey: 'prescription_add_options', title: 'ADD — Left eye', placeholder: '+0.00' },
  pd: { catalogKey: 'pd_options', title: 'PD (mm)', placeholder: 'Tap PD' },
  'lens-type': { catalogKey: 'lens_type_options', title: 'Lens type', placeholder: 'Tap lens type' }
}

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
      birthday: '',
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

function rxModalAuthToken () {
  try {
    var tok = sessionStorage.getItem('cosmos_token')
    if (tok) return tok
    var pos = JSON.parse(sessionStorage.getItem('pos_session') || 'null')
    if (pos && pos.token) return String(pos.token)
  } catch (_) {}
  return ''
}

function rxModalJwtPermissions () {
  try {
    var u = JSON.parse(sessionStorage.getItem('cosmos_user') || '{}')
    if (Array.isArray(u.permissions) && u.permissions.length) {
      return u.permissions.map(function (x) { return String(x).toLowerCase() })
    }
  } catch (_) {}
  try {
    var tok = rxModalAuthToken()
    var parts = String(tok || '').split('.')
    if (parts.length < 2) return []
    var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    var pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
    var p = JSON.parse(atob(b64 + pad))
    if (p && String(p.role || '').toLowerCase() === 'super_admin') return ['super_admin']
    return Array.isArray(p.permissions) ? p.permissions.map(function (x) { return String(x).toLowerCase() }) : []
  } catch (_) {
    return []
  }
}

function rxModalApiFetch (method, path, body) {
  if (typeof window.cxApiFetch === 'function' && sessionStorage.getItem('cosmos_token')) {
    return window.cxApiFetch(method, path, body)
  }
  return (async function () {
    var apiKey = await window.cosmosEnsureApiKey()
    var headers = {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      Authorization: 'Bearer ' + rxModalAuthToken()
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

function rxModalPrimaryCxLabel () {
  if (!_rxModalCtx) return 'Customer'
  var name = String(_rxModalCtx.customerName || '').trim()
  return name || 'Customer'
}

function rxModalNormalizePhone10 (phone) {
  var d = String(phone || '').replace(/\D/g, '')
  if (d.length >= 10) return d.slice(-10)
  return ''
}

async function rxModalResolvePrimaryCxName (ctx) {
  if (!ctx) return ''
  var existing = String(ctx.customerName || '').trim()
  if (existing) return existing

  var cid = ctx.customerId != null ? Number(ctx.customerId) : 0
  if (!cid || cid <= 0) return ''

  var phone = rxModalNormalizePhone10(ctx.visitorPhone)
  if (phone.length === 10) {
    try {
      var searchRes = await rxModalApiFetch(
        'GET',
        '/api/pos/customer-search?q=' + encodeURIComponent(phone)
      )
      var list = searchRes.data
      if (!Array.isArray(list)) list = []
      var row =
        list.find(function (r) {
          return Number(r.customer_id) === cid
        }) || list[0]
      if (row) {
        var fromSearch = String(row.full_name || row.display_name || row.primary_name || '').trim()
        if (fromSearch) {
          ctx.customerName = fromSearch
          return fromSearch
        }
      }
    } catch (_) {}
  }

  try {
    var sumRes = await rxModalApiFetch('GET', '/api/cx/customers/' + cid + '/summary')
    var sumRow = sumRes && sumRes.data
    var fromSummary = sumRow && String(sumRow.full_name || sumRow.customer_name || '').trim()
    if (fromSummary) {
      ctx.customerName = fromSummary
      return fromSummary
    }
  } catch (_) {}

  return ''
}

function rxModalCanSaveGatepass () {
  var perms = rxModalJwtPermissions()
  if (perms.indexOf('super_admin') >= 0) return true
  return perms.indexOf('gatepass.action') >= 0
}

function rxModalCanSaveCx () {
  if (typeof window.cosmosCxAllows === 'function') {
    return window.cosmosCxAllows(['cx.eye_tests.create'])
  }
  var perms = rxModalJwtPermissions()
  if (perms.indexOf('super_admin') >= 0) return true
  return perms.indexOf('cx.eye_tests.create') >= 0
}

function rxModalCanSavePos () {
  var perms = rxModalJwtPermissions()
  if (perms.indexOf('super_admin') >= 0) return true
  return perms.indexOf('pos.prescriptions.create') >= 0 || perms.indexOf('cx.eye_tests.create') >= 0
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
      prescription_sph_options: [],
      prescription_cyl_options: [],
      prescription_axis_options: [],
      prescription_add_options: [],
      pd_options: [],
      lens_type_options: [],
      wizard_steps: [
        { key: 'patient', label: 'Patient', icon: '👤' },
        { key: 'lifestyle', label: 'Lifestyle', icon: '♥' },
        { key: 'eyetest', label: 'Eye test', icon: '👁' }
      ]
    }
  }
  return _rxModalCatalog
}

function rxModalFieldStateKey (fieldId) {
  return String(fieldId || '').replace(/-/g, '_')
}

function rxModalGetFieldMeta (fieldId) {
  return _RX_POWER_FIELD_META[fieldId] || null
}

function rxModalGetPickerOptions (fieldId) {
  var meta = rxModalGetFieldMeta(fieldId)
  if (!meta || !_rxModalCatalog) return []
  var list = _rxModalCatalog[meta.catalogKey]
  return Array.isArray(list) ? list : []
}

function rxModalFormatFieldDisplay (fieldId, value) {
  if (value === '' || value == null) return ''
  var v = String(value)
  if (fieldId === 'pd') {
    var pdNum = parseFloat(v)
    if (Number.isFinite(pdNum)) return pdNum % 1 === 0 ? String(pdNum) + ' mm' : pdNum.toFixed(1) + ' mm'
    return v + ' mm'
  }
  if (fieldId.indexOf('axis') >= 0) {
    var ax = parseInt(v, 10)
    return Number.isFinite(ax) ? String(ax) + '°' : v
  }
  if (fieldId.indexOf('sph') >= 0 || fieldId.indexOf('add') >= 0) {
    var n = parseFloat(v)
    if (!Number.isFinite(n)) return v
    if (n === 0) return '+0.00'
    if (n > 0) return '+' + n.toFixed(2)
    return n.toFixed(2)
  }
  if (fieldId.indexOf('cyl') >= 0) {
    var c = parseFloat(v)
    if (!Number.isFinite(c)) return v
    if (c === 0) return '0.00'
    if (c > 0) return '+' + c.toFixed(2)
    return c.toFixed(2)
  }
  if (fieldId === 'lens-type') {
    var opts = rxModalGetPickerOptions(fieldId)
    var hit = opts.find(function (o) { return String(o.value) === v || String(o.label) === v })
    return hit ? hit.label : v
  }
  return v
}

function rxModalSetEyetestField (fieldId, value) {
  if (!_rxModalState) return
  var key = rxModalFieldStateKey(fieldId)
  _rxModalState.eyetest[key] = value != null ? String(value) : ''
}

function rxModalPowerZeroValue (fieldId) {
  if (fieldId.indexOf('sph') >= 0 || fieldId.indexOf('add') >= 0) return '+0.00'
  if (fieldId.indexOf('cyl') >= 0) return '0.00'
  if (fieldId.indexOf('axis') >= 0) return '0'
  return ''
}

function rxModalPowerScrollTarget (fieldId, cur, options) {
  if (cur === '' || cur == null) return rxModalPowerZeroValue(fieldId)
  var s = String(cur)
  var vals = options.map(function (o) {
    return o.value != null ? String(o.value) : String(o.label || o.key || '')
  })
  if (vals.indexOf(s) >= 0) return s
  if (fieldId.indexOf('axis') >= 0) {
    var ax = parseInt(s, 10)
    if (!Number.isFinite(ax)) return rxModalPowerZeroValue(fieldId)
    var best = vals[0]
    var bestD = Infinity
    vals.forEach(function (v) {
      var d = Math.abs(parseInt(v, 10) - ax)
      if (d < bestD) {
        bestD = d
        best = v
      }
    })
    return best
  }
  var n = parseFloat(s)
  if (!Number.isFinite(n)) return rxModalPowerZeroValue(fieldId)
  var bestVal = vals[0]
  var bestDiff = Infinity
  vals.forEach(function (v) {
    var vn = parseFloat(v)
    if (!Number.isFinite(vn)) return
    var d = Math.abs(vn - n)
    if (d < bestDiff) {
      bestDiff = d
      bestVal = v
    }
  })
  return bestVal
}

function rxModalBindPowerWheelDrums () {
  _RX_POWER_WHEEL_PARTS.forEach(function (p) {
    var col = document.getElementById('rx-drum-' + p)
    if (!col || col.dataset.rxDrumBound) return
    col.dataset.rxDrumBound = '1'
    var timer = null
    col.addEventListener('scroll', function () {
      if (timer) clearTimeout(timer)
      timer = setTimeout(function () {
        rxModalDrumHighlightCenter(col)
      }, 80)
    })
  })
}

function rxModalEnsurePowerSheet () {
  var existing = document.getElementById('rx-power-sheet')
  if (existing && existing.querySelector('#rx-drum-sph')) {
    var labelsEl = existing.querySelector('.rx-power-wheel-labels')
    if (labelsEl) labelsEl.removeAttribute('aria-hidden')
    return
  }
  if (existing) existing.remove()

  var wrap = document.createElement('div')
  wrap.id = 'rx-power-sheet'
  wrap.className = 'rx-power-sheet'
  wrap.setAttribute('role', 'dialog')
  wrap.setAttribute('aria-modal', 'true')
  wrap.setAttribute('aria-hidden', 'true')
  wrap.innerHTML =
    '<div class="rx-power-sheet-panel">' +
    '<div class="rx-power-sheet-handle" aria-hidden="true"></div>' +
    '<header class="rx-power-sheet-head">' +
    '<h3 class="rx-power-sheet-title" id="rx-power-sheet-title"></h3>' +
    '<button type="button" class="rx-power-sheet-close" id="rx-power-sheet-close" aria-label="Close">✕</button>' +
    '</header>' +
    '<div class="rx-power-drum-wrap" id="rx-power-drum-wrap">' +
    '<div class="rx-power-wheel-labels">' +
    '<span>SPH</span><span>CYL</span><span>AXIS</span><span>ADD</span>' +
    '</div>' +
    '<div class="rx-drum-shell rx-power-drum-shell">' +
    '<div class="rx-drum-highlight" aria-hidden="true"></div>' +
    '<div class="rx-drum-cols rx-power-wheel-cols">' +
    '<div class="rx-drum-col" id="rx-drum-sph" aria-label="SPH"></div>' +
    '<div class="rx-drum-col" id="rx-drum-cyl" aria-label="CYL"></div>' +
    '<div class="rx-drum-col" id="rx-drum-axis" aria-label="AXIS"></div>' +
    '<div class="rx-drum-col" id="rx-drum-add" aria-label="ADD"></div>' +
    '</div></div>' +
    '<button type="button" class="btn primary rx-power-drum-submit" id="rx-power-drum-submit">Submit</button>' +
    '</div>' +
    '<div class="rx-power-sheet-list" id="rx-power-sheet-list" role="listbox" hidden></div>' +
    '</div>'
  document.body.appendChild(wrap)
  wrap.addEventListener('click', function (e) {
    if (e.target === wrap) rxModalClosePowerSheet()
  })
  var closeBtn = document.getElementById('rx-power-sheet-close')
  if (closeBtn) closeBtn.addEventListener('click', rxModalClosePowerSheet)
  var submitBtn = document.getElementById('rx-power-drum-submit')
  if (submitBtn) {
    submitBtn.addEventListener('click', function () {
      if (!_rxPowerWheelEye) return
      rxModalApplyPowerWheelSubmit(_rxPowerWheelEye)
    })
  }
  rxModalBindPowerWheelDrums()
}

function rxModalClosePowerSheet () {
  var sheet = document.getElementById('rx-power-sheet')
  _rxPowerSheetField = null
  _rxPowerWheelEye = null
  if (!sheet) return
  sheet.classList.remove('open')
  sheet.setAttribute('aria-hidden', 'true')
}

function rxModalReadPowerWheelValues () {
  var out = {}
  _RX_POWER_WHEEL_PARTS.forEach(function (p) {
    var col = document.getElementById('rx-drum-' + p)
    out[p] = rxModalDrumReadValue(col) || ''
  })
  return out
}

function rxModalApplyPowerWheelSubmit (eye) {
  var vals = rxModalReadPowerWheelValues()
  var missing = _RX_POWER_WHEEL_PARTS.some(function (p) {
    return !vals[p]
  })
  if (missing) {
    if (typeof window.cosmosToastWarn === 'function') {
      window.cosmosToastWarn('Scroll each column to select SPH, CYL, AXIS, and ADD.')
    }
    return
  }
  _RX_POWER_WHEEL_PARTS.forEach(function (p) {
    rxModalSetEyetestField(eye + '-' + p, vals[p])
  })
  var combo = document.getElementById('rx-modal-' + eye + '-power')
  if (combo) {
    combo.classList.remove('rx-field-err')
    if (typeof window.cosmosFieldClear === 'function') window.cosmosFieldClear(combo)
  }
  rxModalUpdatePowerComboDisplays()
  rxModalRenderStepnav()
  rxModalUpdateFooter()
  if (eye === 're') {
    rxModalOpenPowerWheelSheet('le')
    return
  }
  rxModalClosePowerSheet()
}

function rxModalOpenPowerWheelSheet (eye) {
  if (eye !== 're' && eye !== 'le') return
  rxModalEnsurePowerSheet()
  var sheet = document.getElementById('rx-power-sheet')
  var listEl = document.getElementById('rx-power-sheet-list')
  var drumWrap = document.getElementById('rx-power-drum-wrap')
  var titleEl = document.getElementById('rx-power-sheet-title')
  if (!sheet || !titleEl) return

  _rxPowerWheelEye = eye
  _rxPowerSheetField = null
  if (listEl) listEl.hidden = true
  if (drumWrap) drumWrap.hidden = false
  titleEl.textContent = eye === 're' ? 'RIGHT EYE (RE)' : 'LEFT EYE (LE)'

  var scrollTargets = []
  _RX_POWER_WHEEL_PARTS.forEach(function (p) {
    var fieldId = eye + '-' + p
    var col = document.getElementById('rx-drum-' + p)
    if (!col) return
    var stateKey = rxModalFieldStateKey(fieldId)
    var cur =
      _rxModalState && _rxModalState.eyetest
        ? String(_rxModalState.eyetest[stateKey] || '')
        : ''
    var options = rxModalGetPickerOptions(fieldId)
    var items = options.map(function (o) {
      return {
        value: o.value != null ? String(o.value) : String(o.label || o.key || ''),
        label: o.label || o.value || o.key || ''
      }
    })
    var scrollTo = rxModalPowerScrollTarget(fieldId, cur, options)
    var html = rxModalDrumPadHtml()
    items.forEach(function (it) {
      html +=
        '<div class="rx-drum-item" data-drum-value="' +
        rxModalEsc(it.value) +
        '">' +
        rxModalEsc(it.label) +
        '</div>'
    })
    col.innerHTML = html + rxModalDrumPadHtml() + rxModalDrumPadHtml()
    scrollTargets.push({ col: col, value: scrollTo })
  })

  sheet.classList.add('open')
  sheet.setAttribute('aria-hidden', 'false')

  requestAnimationFrame(function () {
    scrollTargets.forEach(function (t) {
      rxModalDrumScrollToValue(t.col, t.value)
      rxModalDrumHighlightCenter(t.col)
    })
  })
}

function rxModalOpenPowerListSheet (fieldId, meta, cur, options) {
  var sheet = document.getElementById('rx-power-sheet')
  var listEl = document.getElementById('rx-power-sheet-list')
  var drumWrap = document.getElementById('rx-power-drum-wrap')
  var titleEl = document.getElementById('rx-power-sheet-title')
  if (!sheet || !listEl || !titleEl) return

  if (drumWrap) drumWrap.hidden = true
  listEl.hidden = false
  titleEl.textContent = meta.title

  var html = []
  if (fieldId !== 're-sph' && fieldId !== 'le-sph') {
    html.push(
      '<button type="button" class="rx-power-sheet-opt' +
        (cur === '' ? ' is-on' : '') +
        '" data-rx-power-value="">' +
        '<span class="rx-power-sheet-opt-lbl">Clear</span></button>'
    )
  }
  options.forEach(function (o) {
    var val = o.value != null ? String(o.value) : String(o.label || o.key || '')
    var on = cur === val
    html.push(
      '<button type="button" class="rx-power-sheet-opt' +
        (on ? ' is-on' : '') +
        '" data-rx-power-value="' +
        rxModalEsc(val) +
        '"><span class="rx-power-sheet-opt-lbl">' +
        rxModalEsc(o.label || val) +
        '</span></button>'
    )
  })
  listEl.innerHTML = html.join('')

  listEl.querySelectorAll('[data-rx-power-value]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var picked = btn.getAttribute('data-rx-power-value')
      rxModalSetEyetestField(fieldId, picked)
      var cell = document.getElementById('rx-modal-' + fieldId)
      if (cell) {
        cell.classList.remove('rx-field-err')
        if (typeof window.cosmosFieldClear === 'function') window.cosmosFieldClear(cell)
      }
      rxModalClosePowerSheet()
      rxModalUpdatePowerComboDisplays()
      rxModalRenderStepnav()
      rxModalUpdateFooter()
    })
  })

  var drumWrap = document.getElementById('rx-power-drum-wrap')
  if (drumWrap) drumWrap.hidden = true
  sheet.classList.add('open')
  sheet.setAttribute('aria-hidden', 'false')
}

function rxModalOpenPowerSheet (fieldId) {
  var meta = rxModalGetFieldMeta(fieldId)
  if (!meta) return
  if (fieldId !== 'pd' && fieldId !== 'lens-type') return
  rxModalEnsurePowerSheet()
  _rxPowerSheetField = fieldId
  _rxPowerWheelEye = null
  var stateKey = rxModalFieldStateKey(fieldId)
  var cur = _rxModalState && _rxModalState.eyetest ? String(_rxModalState.eyetest[stateKey] || '') : ''
  var options = rxModalGetPickerOptions(fieldId)
  rxModalOpenPowerListSheet(fieldId, meta, cur, options)
}

function rxModalEyeHasAnyPower (eye) {
  if (!_rxModalState) return false
  var e = _rxModalState.eyetest
  return _RX_POWER_WHEEL_PARTS.some(function (p) {
    var v = e[eye + '_' + p]
    return v !== '' && v != null
  })
}

function rxModalFormatEyePowerSummary (eye) {
  if (!_rxModalState || !rxModalEyeHasAnyPower(eye)) return ''
  var bits = []
  _RX_POWER_WHEEL_PARTS.forEach(function (p) {
    var fieldId = eye + '-' + p
    var key = rxModalFieldStateKey(fieldId)
    var raw = _rxModalState.eyetest[key]
    var disp =
      raw !== '' && raw != null
        ? rxModalFormatFieldDisplay(fieldId, raw)
        : rxModalFormatFieldDisplay(fieldId, rxModalPowerZeroValue(fieldId))
    bits.push(disp)
  })
  return bits.join(' · ')
}

function rxModalUpdatePowerComboDisplays () {
  if (!_rxModalState) return
  ;['re', 'le'].forEach(function (eye) {
    var btn = document.getElementById('rx-modal-' + eye + '-power')
    if (!btn) return
    var summary = rxModalFormatEyePowerSummary(eye)
    var valEl = btn.querySelector('.rx-et-power-combo-val')
    if (valEl) valEl.textContent = summary || 'Set prescribed power'
    else btn.textContent = summary || 'Set prescribed power'
    btn.classList.toggle('has-value', rxModalEyeHasAnyPower(eye))
  })
  ;['pd', 'lens-type'].forEach(function (fieldId) {
    var btn = document.getElementById('rx-modal-' + fieldId)
    if (!btn) return
    var meta = _RX_POWER_FIELD_META[fieldId]
    var stateKey = rxModalFieldStateKey(fieldId)
    var raw = _rxModalState.eyetest[stateKey]
    var display = rxModalFormatFieldDisplay(fieldId, raw)
    btn.textContent = display || meta.placeholder
    btn.classList.toggle('has-value', !!(raw !== '' && raw != null))
  })
}

function rxModalPowerComboBtn (eye) {
  var summary = rxModalFormatEyePowerSummary(eye)
  var hasVal = rxModalEyeHasAnyPower(eye)
  return (
    '<div role="button" tabindex="0" class="rx-et-power-combo' +
    (hasVal ? ' has-value' : '') +
    '" id="rx-modal-' +
    eye +
    '-power" data-rx-power-eye="' +
    eye +
    '" aria-haspopup="dialog">' +
    '<span class="rx-et-power-combo-val">' +
    rxModalEsc(summary || 'Set prescribed power') +
    '</span><span class="rx-et-power-combo-chev" aria-hidden="true">›</span></div>'
  )
}

function rxModalMetaPickerBtn (id, label, value) {
  var meta = rxModalGetFieldMeta(id)
  var ph = (meta && meta.placeholder) || 'Tap to set'
  var display = rxModalFormatFieldDisplay(id, value) || ph
  var hasVal = value !== '' && value != null
  return (
    '<div role="button" tabindex="0" class="rx-et-meta-picker' +
    (hasVal ? ' has-value' : '') +
    '" id="rx-modal-' +
    id +
    '" data-rx-power-field="' +
    id +
    '" aria-haspopup="listbox">' +
    rxModalEsc(display) +
    '</div>'
  )
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
  if (!customerId || (_rxModalCtx && _rxModalCtx.source === 'pos')) return
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
    return rxModalPrimaryCxLabel()
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

function rxModalSyncCurrentStepFromDom () {
  if (_rxModalStep === 1) rxModalSyncPatientFromDom()
  else if (_rxModalStep === 2) rxModalSyncLifestyleFromDom()
  else if (_rxModalStep === 3) rxModalSyncEyetestFromDom()
}

function rxModalStepIsValid (step) {
  if (!_rxModalState || !_rxModalCtx) return false
  if (step === 1) {
    if (!_rxModalCtx.customerId || _rxModalCtx.customerId <= 0) {
      if (!_rxModalState.patient.walkinName) return false
    }
    if (!_rxModalState.patient.testedAt) return false
    return true
  }
  if (step === 2) return true
  if (step === 3) {
    var e = _rxModalState.eyetest
    return !!(rxModalParseNum(e.re_sph) || rxModalParseNum(e.le_sph))
  }
  return false
}

function rxModalSegmentStatus (stepNum) {
  if (stepNum === _rxModalStep) return 'active'
  if (stepNum < _rxModalStep) return rxModalStepIsValid(stepNum) ? 'done' : 'pending'
  return 'pending'
}

function rxModalSegmentMark (status) {
  if (status === 'done') return '✓'
  if (status === 'pending') return '●'
  return ''
}

function rxModalCanSaveAll () {
  rxModalSyncPatientFromDom()
  rxModalSyncLifestyleFromDom()
  rxModalSyncEyetestFromDom()
  return rxModalStepIsValid(1) && rxModalStepIsValid(2) && rxModalStepIsValid(3)
}

function rxModalPendingLabel () {
  rxModalSyncCurrentStepFromDom()
  if (!rxModalStepIsValid(1)) return 'Patient'
  if (!rxModalStepIsValid(2)) return 'Lifestyle'
  if (!rxModalStepIsValid(3)) return 'Eye test'
  return ''
}

function rxModalTryGoStep (n) {
  var target = Math.max(1, Math.min(3, n))
  if (target === _rxModalStep) return
  rxModalSyncCurrentStepFromDom()
  if (target > _rxModalStep && !rxModalValidateStep(_rxModalStep)) return
  rxModalGoStep(target)
}

function rxModalRenderStepnav () {
  var steps = (_rxModalCatalog && _rxModalCatalog.wizard_steps) || []
  var nav = document.getElementById('rx-modal-stepnav')
  if (!nav) return
  if (!nav.classList.contains('rx-segnav')) {
    nav.classList.remove('rx-stepnav')
    nav.classList.add('rx-segnav')
  }
  nav.innerHTML = steps
    .map(function (s, i) {
      var n = i + 1
      var status = rxModalSegmentStatus(n)
      var cls = 'rx-segnav-item is-' + status
      return (
        '<button type="button" class="' +
        cls +
        '" role="tab" data-rx-step="' +
        n +
        '" aria-selected="' +
        (n === _rxModalStep ? 'true' : 'false') +
        '">' +
        '<span class="rx-segnav-mark" aria-hidden="true">' +
        rxModalSegmentMark(status) +
        '</span>' +
        '<span class="rx-segnav-lbl">' +
        rxModalEsc(s.label) +
        '</span></button>'
      )
    })
    .join('')

  if (!nav.dataset.rxSegDelegated) {
    nav.dataset.rxSegDelegated = '1'
    nav.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-rx-step]') : null
      if (!btn || !nav.contains(btn)) return
      var step = parseInt(btn.getAttribute('data-rx-step'), 10)
      if (step >= 1 && step <= 3) rxModalTryGoStep(step)
    })
  }
}

var _RX_MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
var _rxBirthdayDrum = { year: '', month: '', day: '' }

function rxModalIstYear () {
  var today = typeof window.cosmosIstToday === 'function' ? window.cosmosIstToday() : ''
  if (today && today.length >= 4) return parseInt(today.slice(0, 4), 10)
  return parseInt(
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 4),
    10
  )
}

function rxModalDaysInMonth (year, month) {
  var y = parseInt(year, 10)
  var m = parseInt(month, 10)
  if (!Number.isFinite(y) || !Number.isFinite(m)) return 31
  return new Date(y, m, 0).getDate()
}

function rxModalFormatBirthdayDisplay (ymd) {
  if (!ymd) return ''
  var parts = String(ymd).slice(0, 10).split('-')
  if (parts.length !== 3) return String(ymd)
  var y = parseInt(parts[0], 10)
  var m = parseInt(parts[1], 10)
  var d = parseInt(parts[2], 10)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return String(ymd)
  var label = _RX_MONTH_SHORT[m - 1] || parts[1]
  return String(d) + ' ' + label + ' ' + String(y)
}

function rxModalCalcAgeYears (birthYmd) {
  if (!birthYmd) return null
  var today =
    typeof window.cosmosIstToday === 'function'
      ? window.cosmosIstToday()
      : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  var tp = String(today).slice(0, 10).split('-').map(Number)
  var bp = String(birthYmd).slice(0, 10).split('-').map(Number)
  if (tp.length !== 3 || bp.length !== 3) return null
  var age = tp[0] - bp[0]
  if (tp[1] < bp[1] || (tp[1] === bp[1] && tp[2] < bp[2])) age -= 1
  return age >= 0 && age < 130 ? age : null
}

function rxModalAgeLabel (birthYmd) {
  var age = rxModalCalcAgeYears(birthYmd)
  if (age == null) return '—'
  return 'Age ' + age
}

function rxModalSplitBirthday (ymd) {
  if (!ymd) return { year: '', month: '', day: '' }
  var p = String(ymd).slice(0, 10).split('-')
  if (p.length !== 3) return { year: '', month: '', day: '' }
  return { year: p[0], month: p[1], day: p[2] }
}

function rxModalComposeBirthday () {
  var y = _rxBirthdayDrum.year
  var m = _rxBirthdayDrum.month
  var d = _rxBirthdayDrum.day
  if (!y || !m || !d) return ''
  var maxD = rxModalDaysInMonth(y, m)
  var dayNum = Math.min(parseInt(d, 10), maxD)
  return (
    String(y) +
    '-' +
    String(m).padStart(2, '0') +
    '-' +
    String(dayNum).padStart(2, '0')
  )
}

function rxModalDrumPadHtml () {
  return '<div class="rx-drum-pad" aria-hidden="true"></div>'
}

function rxModalBuildYearDrumItems () {
  var end = rxModalIstYear()
  var start = end - 100
  var out = []
  for (var y = end; y >= start; y--) {
    var key = String(y)
    out.push({ value: key, label: key })
  }
  return out
}

function rxModalBuildMonthDrumItems () {
  var out = []
  for (var i = 0; i < 12; i++) {
    var key = String(i + 1).padStart(2, '0')
    out.push({ value: key, label: _RX_MONTH_SHORT[i] })
  }
  return out
}

function rxModalBuildDayDrumItems (year, month) {
  var max = rxModalDaysInMonth(year, month)
  var out = []
  for (var d = 1; d <= max; d++) {
    var key = String(d).padStart(2, '0')
    out.push({ value: key, label: String(d) })
  }
  return out
}

function rxModalRenderDrumCol (colEl, items, selected) {
  if (!colEl) return
  var html = rxModalDrumPadHtml()
  items.forEach(function (it) {
    html +=
      '<div class="rx-drum-item" data-drum-value="' +
      rxModalEsc(it.value) +
      '">' +
      rxModalEsc(it.label) +
      '</div>'
  })
  html += rxModalDrumPadHtml() + rxModalDrumPadHtml()
  colEl.innerHTML = html
  rxModalDrumScrollToValue(colEl, selected)
  requestAnimationFrame(function () {
    rxModalDrumHighlightCenter(colEl)
  })
}

function rxModalDrumScrollToValue (colEl, value) {
  if (!colEl || value === '' || value == null) return
  var target = null
  var want = String(value)
  colEl.querySelectorAll('.rx-drum-item').forEach(function (el) {
    if (el.getAttribute('data-drum-value') === want) target = el
  })
  if (!target) return
  var top = target.offsetTop - (colEl.clientHeight - target.offsetHeight) / 2
  colEl.scrollTop = Math.max(0, top)
}

function rxModalDrumHighlightCenter (colEl) {
  if (!colEl) return ''
  var items = colEl.querySelectorAll('.rx-drum-item')
  if (!items.length) return ''
  var mid = colEl.scrollTop + colEl.clientHeight / 2
  var best = null
  var bestDist = Infinity
  items.forEach(function (el) {
    el.classList.remove('is-center')
    var center = el.offsetTop + el.offsetHeight / 2
    var dist = Math.abs(center - mid)
    if (dist < bestDist) {
      bestDist = dist
      best = el
    }
  })
  if (best) best.classList.add('is-center')
  return best ? best.getAttribute('data-drum-value') || '' : ''
}

function rxModalDrumReadValue (colEl) {
  return rxModalDrumHighlightCenter(colEl)
}

function rxModalRefreshDayDrum () {
  var dayCol = document.getElementById('rx-drum-day')
  if (!dayCol) return
  var items = rxModalBuildDayDrumItems(_rxBirthdayDrum.year, _rxBirthdayDrum.month)
  var cur = _rxBirthdayDrum.day
  var has = items.some(function (it) { return it.value === cur })
  if (!has && items.length) cur = items[0].value
  _rxBirthdayDrum.day = cur
  rxModalRenderDrumCol(dayCol, items, cur)
}

function rxModalBindDrumCol (colEl, kind) {
  if (!colEl || colEl.dataset.rxDrumBound) return
  colEl.dataset.rxDrumBound = '1'
  var timer = null
  colEl.addEventListener('scroll', function () {
    if (timer) clearTimeout(timer)
    timer = setTimeout(function () {
      var val = rxModalDrumReadValue(colEl)
      if (!val) return
      _rxBirthdayDrum[kind] = val
      if (kind === 'year' || kind === 'month') rxModalRefreshDayDrum()
    }, 80)
  })
}

function rxModalEnsureBirthdaySheet () {
  if (document.getElementById('rx-birthday-sheet')) return
  var wrap = document.createElement('div')
  wrap.id = 'rx-birthday-sheet'
  wrap.className = 'rx-birthday-sheet'
  wrap.setAttribute('role', 'dialog')
  wrap.setAttribute('aria-modal', 'true')
  wrap.setAttribute('aria-hidden', 'true')
  wrap.innerHTML =
    '<div class="rx-birthday-sheet-panel">' +
    '<header class="rx-birthday-sheet-head">' +
    '<h3 class="rx-birthday-sheet-title">Set birthday</h3>' +
    '<button type="button" class="rx-birthday-sheet-close" id="rx-birthday-sheet-close" aria-label="Close">✕</button>' +
    '</header>' +
    '<div class="rx-drum-shell">' +
    '<div class="rx-drum-highlight" aria-hidden="true"></div>' +
    '<div class="rx-drum-cols">' +
    '<div class="rx-drum-col" id="rx-drum-year" aria-label="Year"></div>' +
    '<div class="rx-drum-col" id="rx-drum-month" aria-label="Month"></div>' +
    '<div class="rx-drum-col" id="rx-drum-day" aria-label="Day"></div>' +
    '</div></div>' +
    '<button type="button" class="btn primary rx-birthday-submit" id="rx-birthday-submit">Submit</button>' +
    '</div>'
  document.body.appendChild(wrap)
  wrap.addEventListener('click', function (e) {
    if (e.target === wrap) rxModalCloseBirthdaySheet()
  })
  var closeBtn = document.getElementById('rx-birthday-sheet-close')
  if (closeBtn) closeBtn.addEventListener('click', rxModalCloseBirthdaySheet)
  var submitBtn = document.getElementById('rx-birthday-submit')
  if (submitBtn) {
    submitBtn.addEventListener('click', function () {
      var yCol = document.getElementById('rx-drum-year')
      var mCol = document.getElementById('rx-drum-month')
      var dCol = document.getElementById('rx-drum-day')
      _rxBirthdayDrum.year = rxModalDrumReadValue(yCol) || _rxBirthdayDrum.year
      _rxBirthdayDrum.month = rxModalDrumReadValue(mCol) || _rxBirthdayDrum.month
      _rxBirthdayDrum.day = rxModalDrumReadValue(dCol) || _rxBirthdayDrum.day
      var iso = rxModalComposeBirthday()
      if (!iso) {
        if (typeof window.cosmosToastWarn === 'function') {
          window.cosmosToastWarn('Select year, month, and day.')
        }
        return
      }
      if (_rxModalState) _rxModalState.patient.birthday = iso
      rxModalCloseBirthdaySheet()
      rxModalUpdateBirthdayAgeDisplay()
    })
  }
  rxModalBindDrumCol(document.getElementById('rx-drum-year'), 'year')
  rxModalBindDrumCol(document.getElementById('rx-drum-month'), 'month')
  rxModalBindDrumCol(document.getElementById('rx-drum-day'), 'day')
}

function rxModalCloseBirthdaySheet () {
  var sheet = document.getElementById('rx-birthday-sheet')
  if (!sheet) return
  sheet.classList.remove('open')
  sheet.setAttribute('aria-hidden', 'true')
}

function rxModalOpenBirthdaySheet () {
  rxModalEnsureBirthdaySheet()
  var sheet = document.getElementById('rx-birthday-sheet')
  if (!sheet) return
  var cur = (_rxModalState && _rxModalState.patient.birthday) || ''
  if (!cur) {
    var defYear = String(rxModalIstYear() - 30)
    _rxBirthdayDrum = { year: defYear, month: '06', day: '15' }
  } else {
    _rxBirthdayDrum = rxModalSplitBirthday(cur)
  }
  rxModalRenderDrumCol(document.getElementById('rx-drum-year'), rxModalBuildYearDrumItems(), _rxBirthdayDrum.year)
  rxModalRenderDrumCol(document.getElementById('rx-drum-month'), rxModalBuildMonthDrumItems(), _rxBirthdayDrum.month)
  rxModalRefreshDayDrum()
  sheet.classList.add('open')
  sheet.setAttribute('aria-hidden', 'false')
}

function rxModalUpdateBirthdayAgeDisplay () {
  var btn = document.getElementById('rx-modal-birthday')
  var ageEl = document.getElementById('rx-modal-age')
  var bday = _rxModalState && _rxModalState.patient ? _rxModalState.patient.birthday : ''
  if (btn) {
    var display = rxModalFormatBirthdayDisplay(bday)
    btn.textContent = display || 'Set birthday'
    btn.classList.toggle('has-value', !!display)
  }
  if (ageEl) ageEl.textContent = rxModalAgeLabel(bday)
}

async function rxModalLoadPatientBirthday (customerId) {
  if (!customerId || customerId <= 0 || !_rxModalState) return
  try {
    var path =
      String(window.location.pathname || '').indexOf('/cx') === 0
        ? '/api/cx/customers/' + customerId + '/profile'
        : '/api/pos/customers/' + customerId + '/profile-brief'
    var res = await rxModalApiFetch('GET', path)
    var row = res && res.data
    var dob = row && row.dob != null ? String(row.dob).slice(0, 10) : ''
    if (dob) _rxModalState.patient.birthday = dob
  } catch (_) {}
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
      '<span class="rx-who-btn-name">' + rxModalEsc(rxModalPrimaryCxLabel()) + '</span>' +
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
    html.push('</div>')
    html.push(
      '<div id="rx-who-new-row" class="rx-who-new-row" hidden aria-live="polite">' +
      '<label class="rx-who-new-lbl" for="rx-who-new-name">New name</label>' +
      '<input type="text" id="rx-who-new-name" class="rx-who-input" placeholder="Enter name" autocomplete="off" maxlength="80">' +
      '<div class="rx-who-new-actions">' +
      '<button type="button" class="rx-who-add-submit" id="rx-who-confirm-btn">Add</button>' +
      '<button type="button" class="rx-who-add-cancel" id="rx-who-cancel-btn">Cancel</button>' +
      '</div>' +
      '</div>'
    )
    html.push('</div>')
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
  html.push('<div class="fgrp rx-birthday-fgrp">')
  html.push('<label for="rx-modal-birthday">Birthday</label>')
  html.push('<div class="rx-birthday-row">')
  var bdayDisp = rxModalFormatBirthdayDisplay(_rxModalState.patient.birthday)
  html.push(
    '<button type="button" class="rx-birthday-btn' +
      (bdayDisp ? ' has-value' : '') +
      '" id="rx-modal-birthday" aria-haspopup="dialog">' +
      rxModalEsc(bdayDisp || 'Set birthday') +
      '</button>'
  )
  html.push(
    '<span class="rx-age-chip" id="rx-modal-age" aria-live="polite">' +
      rxModalEsc(rxModalAgeLabel(_rxModalState.patient.birthday)) +
      '</span>'
  )
  html.push('</div></div>')
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
  if (_rxModalCtx.source === 'pos' && linked) {
    html.push(
      '<div class="rx-pos-use-saved-wrap">' +
        '<button type="button" class="rx-pos-use-saved-btn" id="rx-modal-use-saved-btn">Use existing prescription</button>' +
        '<span class="rx-pos-use-saved-sub">or continue to record a new test below</span>' +
      '</div>'
    )
  }
  return html.join('')
}

function rxModalApplyPosPatientName (ctx) {
  if (!ctx || ctx.source !== 'pos' || !ctx.patientName || !ctx.customerId) return
  var name = String(ctx.patientName).trim()
  if (!name) return
  var primary = String(ctx.customerName || '').trim()
  if (primary && name === primary) {
    _rxModalState.patient.familyKey = ''
    return
  }
  var match = (_rxModalCtx.familyNames || []).find(function (fn) {
    var fnName = String(fn.family_name || fn.name || '').trim()
    return fnName && fnName === name
  })
  if (match) {
    var id = match.family_name_id != null ? match.family_name_id : match.id
    _rxModalState.patient.familyKey = match._tempKey || ('fn:' + id)
  }
}

function rxModalPrefillEyetestFromLens (rx) {
  if (!rx) return
  var e = _rxModalState.eyetest
  var od = rx.od || {}
  var os = rx.os || {}
  e.re_sph = od.sph != null ? String(od.sph) : ''
  e.re_cyl = od.cyl != null ? String(od.cyl) : ''
  e.re_axis = od.axis != null ? String(od.axis) : ''
  e.re_add = od.add != null ? String(od.add) : ''
  e.le_sph = os.sph != null ? String(os.sph) : ''
  e.le_cyl = os.cyl != null ? String(os.cyl) : ''
  e.le_axis = os.axis != null ? String(os.axis) : ''
  e.le_add = os.add != null ? String(os.add) : ''
  e.pd = rx.pd != null ? String(rx.pd) : ''
}

function rxModalRenderLifestyleStep () {
  var linked = _rxModalCtx.customerId && _rxModalCtx.customerId > 0
  var html = []
  if (!linked) {
    html.push(
      '<div class="rx-lifestyle-skip">Lifestyle is saved on the Cx profile when this visitor is linked to a customer. You can continue to the eye test.</div>'
    )
  }
  html.push('<div class="fgrp rx-lifestyle-chip-group">')
  html.push('<label>Screen time (hours/day)</label>')
  html.push(rxModalPillsHtml(_rxModalCatalog.screen_time_options, _rxModalState.lifestyle.screen_hrs, 'rx-screen-pill', false))
  html.push('</div>')
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
  html.push('<div class="fgrp rx-lifestyle-chip-group">')
  html.push('<label>Family eye history</label>')
  html.push(rxModalPillsHtml(_rxModalCatalog.family_eye_history_options, _rxModalState.lifestyle.family_eye_history, 'rx-family-pill', false))
  html.push('</div>')
  return html.join('')
}

function rxModalRenderEyetestStep () {
  var e = _rxModalState.eyetest
  var html = []
  html.push('<div class="rx-et-shell">')
  html.push(
    '<div class="rx-et-patient-chip" id="rx-et-patient-chip">' + rxModalEsc(rxModalPatientChipLabel()) + '</div>'
  )
  html.push('<div class="rx-et-scroll">')
  html.push('<div><p class="rx-et-section">Pre-test vision</p>')
  html.push('<div class="rx-et-va-block"><span class="rx-et-va-label">Right eye (RE)</span>')
  html.push(rxModalVaChipsHtml('re', e.re_va))
  html.push('</div>')
  html.push('<div class="rx-et-va-block rx-et-va-block--le"><span class="rx-et-va-label">Left eye (LE)</span>')
  html.push(rxModalVaChipsHtml('le', e.le_va))
  html.push('</div></div>')
  html.push('<div><p class="rx-et-section">Prescribed power</p>')
  html.push('<div class="rx-et-eye-grid">')
  html.push('<article class="rx-et-eye-card">')
  html.push('<h3 class="rx-et-eye-title">RIGHT EYE (RE)</h3>')
  html.push(rxModalPowerComboBtn('re'))
  html.push('</article>')
  html.push('<article class="rx-et-eye-card">')
  html.push('<h3 class="rx-et-eye-title">LEFT EYE (LE)</h3>')
  html.push(rxModalPowerComboBtn('le'))
  html.push('</article>')
  html.push('</div></div>')
  html.push('<div><p class="rx-et-section">Other details</p>')
  html.push('<div class="rx-et-meta-grid">')
  html.push(
    '<div class="rx-et-meta-field"><label for="rx-modal-pd">PD (mm)</label>' +
      rxModalMetaPickerBtn('pd', 'PD (mm)', e.pd) +
      '</div>'
  )
  html.push(
    '<div class="rx-et-meta-field"><label for="rx-modal-lens-type">Lens type</label>' +
      rxModalMetaPickerBtn('lens-type', 'Lens type', e.lens_type) +
      '</div>'
  )
  html.push(
    '<div class="rx-et-meta-field rx-et-meta-notes"><label for="rx-modal-notes">Notes</label><input type="text" class="rx-et-meta-input" id="rx-modal-notes" placeholder="Optional" value="' +
      rxModalEsc(e.notes || '') +
      '"></div>'
  )
  html.push('</div></div>')
  html.push('</div>')
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
  ;['diabetes', 'hypertension', 'eye_surgery'].forEach(function (key) {
    var el = document.getElementById('rx-modal-' + key)
    if (el) _rxModalState.lifestyle[key] = el.checked
  })
}

function rxModalSyncEyetestFromDom () {
  ;['re-va', 'le-va'].forEach(function (suffix) {
    var el = document.getElementById('rx-modal-' + suffix)
    if (!el) return
    var key = suffix.replace(/-/g, '_')
    _rxModalState.eyetest[key] = el.value
  })
  var notes = document.getElementById('rx-modal-notes')
  if (notes) _rxModalState.eyetest.notes = notes.value
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
    patient_dob: _rxModalState.patient.birthday || null,
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
      var reCombo = document.getElementById('rx-modal-re-power')
      var leCombo = document.getElementById('rx-modal-le-power')
      if (reCombo) reCombo.classList.add('rx-field-err')
      if (leCombo) leCombo.classList.add('rx-field-err')
      if (reCombo && typeof window.cosmosFieldError === 'function') {
        window.cosmosFieldError(reCombo, 'Enter RE or LE SPH')
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
  var save = document.getElementById('rx-modal-save-btn')
  var next = document.getElementById('rx-modal-next-btn')
  var hint = document.getElementById('rx-modal-pending-hint')
  var isLastStep = _rxModalStep === 3

  if (next) {
    next.hidden = isLastStep
    next.style.display = isLastStep ? 'none' : ''
    if (!isLastStep) {
      next.disabled = _rxModalStep === 1 && !rxModalStepIsValid(1)
      next.classList.toggle('is-locked', next.disabled)
    }
  }
  if (save) {
    save.hidden = !isLastStep
    save.style.display = isLastStep ? '' : 'none'
    var canSave = rxModalCanSaveAll()
    save.disabled = !canSave
    save.classList.toggle('is-locked', !canSave)
  }

  if (next && !next.dataset.rxNextBound) {
    next.dataset.rxNextBound = '1'
    next.addEventListener('click', function () {
      rxModalSyncCurrentStepFromDom()
      if (_rxModalStep === 1 && !rxModalValidateStep(1)) return
      rxModalGoStep(_rxModalStep + 1)
    })
  }

  if (hint) {
    var pending = rxModalPendingLabel()
    if (!isLastStep || rxModalCanSaveAll() || !pending) {
      hint.hidden = true
      hint.textContent = ''
    } else {
      hint.hidden = false
      hint.textContent = 'Pending: ' + pending
    }
  }
  var foot = document.querySelector('#modal-add-rx .rx-wizard-foot')
  if (foot) foot.style.display = ''
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

  function rxModalCloseWhoNewRow() {
    var row = document.getElementById('rx-who-new-row')
    var add = document.getElementById('rx-who-add-btn')
    var inp = document.getElementById('rx-who-new-name')
    if (row) {
      row.hidden = true
      row.classList.remove('is-open')
    }
    if (add) add.hidden = false
    if (inp) {
      inp.value = ''
      if (typeof window.cosmosFieldClear === 'function') window.cosmosFieldClear(inp)
    }
  }

  function rxModalOpenWhoNewRow() {
    var row = document.getElementById('rx-who-new-row')
    var add = document.getElementById('rx-who-add-btn')
    var inp = document.getElementById('rx-who-new-name')
    if (!row) return
    if (add) add.hidden = true
    row.hidden = false
    row.classList.add('is-open')
    if (inp) {
      if (typeof window.cosmosFieldClear === 'function') window.cosmosFieldClear(inp)
      inp.focus()
    }
  }

  var addBtn = document.getElementById('rx-who-add-btn')
  if (addBtn) addBtn.addEventListener('click', rxModalOpenWhoNewRow)

  var cancelWhoBtn = document.getElementById('rx-who-cancel-btn')
  if (cancelWhoBtn) cancelWhoBtn.addEventListener('click', rxModalCloseWhoNewRow)

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

  var whoNewInp = document.getElementById('rx-who-new-name')
  if (whoNewInp) {
    whoNewInp.addEventListener('input', function () {
      if (typeof window.cosmosFieldClear === 'function') window.cosmosFieldClear(whoNewInp)
    })
    whoNewInp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (confirmBtn) confirmBtn.click()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        rxModalCloseWhoNewRow()
      }
    })
  }

  pane.querySelectorAll('[data-rx-screen-pill]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      _rxModalState.lifestyle.screen_hrs = btn.getAttribute('data-rx-screen-pill') || ''
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
      _rxModalState.lifestyle.family_eye_history = btn.getAttribute('data-rx-family-pill') || ''
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
      rxModalUpdateFooter()
    })
  })

  pane.querySelectorAll('[data-rx-power-eye]').forEach(function (btn) {
    function openEye () {
      rxModalOpenPowerWheelSheet(btn.getAttribute('data-rx-power-eye'))
    }
    btn.addEventListener('click', openEye)
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openEye()
      }
    })
  })

  pane.querySelectorAll('[data-rx-power-field]').forEach(function (btn) {
    function openField () {
      rxModalOpenPowerSheet(btn.getAttribute('data-rx-power-field'))
    }
    btn.addEventListener('click', openField)
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openField()
      }
    })
  })

  var bdayBtn = document.getElementById('rx-modal-birthday')
  if (bdayBtn && !bdayBtn.dataset.rxBdayBound) {
    bdayBtn.dataset.rxBdayBound = '1'
    bdayBtn.addEventListener('click', rxModalOpenBirthdaySheet)
  }

  var walkInp = document.getElementById('rx-modal-patient-walkin')
  if (walkInp && !walkInp.dataset.rxFooterBound) {
    walkInp.dataset.rxFooterBound = '1'
    walkInp.addEventListener('input', function () {
      rxModalSyncPatientFromDom()
      rxModalRenderStepnav()
      rxModalUpdateFooter()
    })
  }
  var dateInp = document.getElementById('rx-modal-date')
  if (dateInp && !dateInp.dataset.rxFooterBound) {
    dateInp.dataset.rxFooterBound = '1'
    dateInp.addEventListener('change', function () {
      rxModalSyncPatientFromDom()
      rxModalRenderStepnav()
      rxModalUpdateFooter()
    })
  }

  var useSavedBtn = document.getElementById('rx-modal-use-saved-btn')
  if (useSavedBtn && !useSavedBtn.dataset.rxUseSavedBound) {
    useSavedBtn.dataset.rxUseSavedBound = '1'
    useSavedBtn.addEventListener('click', function () {
      if (typeof window.openLensSavedRxModal === 'function') {
        window.openLensSavedRxModal({ fromRxWizard: true })
      } else if (typeof window.cosmosToastWarn === 'function') {
        window.cosmosToastWarn('Saved prescriptions are not available on this screen.')
      }
    })
  }
}

function rxModalGoStep (n) {
  var target = Math.max(1, Math.min(3, n))
  if (target !== _rxModalStep) {
    rxModalSyncCurrentStepFromDom()
  }
  _rxModalStep = target
  rxModalRenderPane()
}

async function rxModalLoadFamilyNames (ctx) {
  if (!ctx.customerId || ctx.customerId <= 0) return ctx
  if (!ctx.familyNames || !ctx.familyNames.length) {
    try {
      var res = await rxModalApiFetch('GET', rxModalFamilyApiPath(ctx.customerId))
      ctx.familyNames = res.data || []
    } catch (_) {
      ctx.familyNames = []
    }
  }
  await rxModalResolvePrimaryCxName(ctx)
  return ctx
}

window.closeRxModal = function () {
  rxModalClosePowerSheet()
  rxModalCloseBirthdaySheet()
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
  if (ctx.source === 'pos' && !rxModalCanSavePos()) {
    if (typeof window.cosmosToastWarn === 'function') {
      window.cosmosToastWarn('No permission to record prescriptions at POS.')
    }
    return
  }
  if (ctx.source === 'pos' && (!ctx.customerId || ctx.customerId <= 0)) {
    if (typeof window.cosmosToastError === 'function') window.cosmosToastError('Link a Cx customer first.')
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
    customerName:
      ctx.customerName ||
      ctx.primaryName ||
      ctx.full_name ||
      ctx.cx_display_name ||
      '',
    visitorName: ctx.visitorName || '',
    visitorPhone: ctx.visitorPhone || ctx.phone || '',
    familyNames: ctx.familyNames || [],
    patientName: ctx.patientName || ''
  }
  await rxModalLoadFamilyNames(_rxModalCtx)
  _rxModalState = rxModalDefaultState()
  _rxModalState.patient.walkinName = _rxModalCtx.visitorName || ''
  if (_rxModalCtx.customerId) {
    await rxModalLoadLifestyle(_rxModalCtx.customerId)
    await rxModalLoadPatientBirthday(_rxModalCtx.customerId)
  }
  if (_rxModalCtx.source === 'pos') rxModalApplyPosPatientName(_rxModalCtx)
  if (ctx.prefillFromLensWizard && ctx.lensRx) rxModalPrefillEyetestFromLens(ctx.lensRx)
  _rxModalStep = ctx.startStep && ctx.startStep >= 1 && ctx.startStep <= 3 ? ctx.startStep : 1

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
  rxModalSyncPatientFromDom()
  rxModalSyncLifestyleFromDom()
  rxModalSyncEyetestFromDom()
  if (!rxModalCanSaveAll()) {
    if (typeof window.cosmosToastWarn === 'function') {
      window.cosmosToastWarn('Complete all steps before saving.')
    }
    rxModalUpdateFooter()
    return
  }
  if (!rxModalValidateStep(3)) return
  var errEl = document.getElementById('rx-modal-error')
  var btn = document.getElementById('rx-modal-save-btn')
  var body = rxModalBuildSaveBody()
  if (errEl) errEl.style.display = 'none'
  if (btn && typeof window.cosmosBtnLoading === 'function') window.cosmosBtnLoading(btn)
  try {
    var savedPayload = null
    if (_rxModalCtx.source === 'gatepass') {
      var gpRes = await rxModalApiFetch('POST', '/api/gatepass/visitor/' + _rxModalCtx.visitorId + '/rx', body)
      savedPayload = (gpRes && gpRes.data) || gpRes || null
    } else if (_rxModalCtx.source === 'pos') {
      body.visitor_id = _rxModalCtx.visitorId || null
      var posRes = await rxModalApiFetch(
        'POST',
        '/api/pos/customers/' + _rxModalCtx.customerId + '/eye-tests',
        body
      )
      savedPayload = (posRes && posRes.data) || posRes || null
    } else {
      body.visitor_id = _rxModalCtx.visitorId || null
      var cxRes = await rxModalApiFetch('POST', '/api/cx/customers/' + _rxModalCtx.customerId + '/eye-tests', body)
      savedPayload = { test_id: cxRes && cxRes.test_id }
      if (cxRes && cxRes.test_id && !savedPayload.re_sph) {
        savedPayload = Object.assign({}, body, { test_id: cxRes.test_id })
      }
    }
    if (typeof window.cosmosBtnSuccess === 'function') window.cosmosBtnSuccess(btn)
    else if (typeof window.cosmosBtnDone === 'function') window.cosmosBtnDone(btn)
    if (typeof window.cosmosToastSuccess === 'function') window.cosmosToastSuccess('Prescription saved.')
    window.closeRxModal()
    if (typeof window._rxModalOnSaved === 'function') window._rxModalOnSaved(savedPayload)
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

function rxModalInitOnce () {
  if (window._rxModalBound) return
  window._rxModalBound = true
  rxModalEnsurePowerSheet()
  rxModalEnsureBirthdaySheet()
  var ov = document.getElementById('modal-add-rx')
  if (ov) {
    ov.addEventListener('click', function (e) {
      if (e.target === ov) window.closeRxModal()
    })
  }
  var closeBtn = document.getElementById('rx-modal-close-btn')
  if (closeBtn) closeBtn.addEventListener('click', window.closeRxModal)
  var saveBtn = document.getElementById('rx-modal-save-btn')
  if (saveBtn) saveBtn.addEventListener('click', function () { void window.saveRxModal() })
}

document.addEventListener('DOMContentLoaded', rxModalInitOnce)
