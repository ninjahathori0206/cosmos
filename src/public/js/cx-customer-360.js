/* ─── CX Customer 360 — full-page customer view ─────────────────────────── */

var CX360_TAB_KEYS = [
  'summary',
  'profile',
  'lifestyle',
  'visits',
  'prescriptions',
  'orders',
  'invoices',
  'membership',
  'coins',
  'offers',
  'audit'
]

var CX360_TAB_LABELS = {
  summary: 'Summary',
  profile: 'Profile',
  lifestyle: 'Lifestyle',
  visits: 'Visits',
  prescriptions: 'Prescriptions',
  orders: 'Orders',
  invoices: 'Invoices',
  membership: 'Membership',
  coins: 'Coins',
  offers: 'Offers',
  audit: 'Audit'
}

var CX360_MORE_TABS = [
  'profile',
  'lifestyle',
  'prescriptions',
  'invoices',
  'membership',
  'coins',
  'offers',
  'audit'
]

var CX360_MOB_SEG = ['summary', 'visits', 'orders', 'more']

var _cx360 = {
  customerId: null,
  tab: 'summary',
  mobSeg: 'summary',
  moreTab: null,
  header: null,
  loaded: {},
  purposeLabels: null
}

function cx360IsMobile () {
  if (typeof cxIsMobileLayout === 'function') return cxIsMobileLayout()
  try {
    return window.matchMedia('(max-width: 1024px)').matches
  } catch (_) {
    return false
  }
}

function cx360ParsePath (pathname) {
  var n = String(pathname || '').replace(/\/+$/, '')
  var m = n.match(/^\/cx\/customers\/(\d+)(?:\/([a-z]+))?$/)
  if (!m) return null
  var tab = m[2] || 'summary'
  if (CX360_TAB_KEYS.indexOf(tab) < 0) tab = 'summary'
  return { customerId: parseInt(m[1], 10), tab: tab }
}

function cx360Path (customerId, tab) {
  var t = tab && tab !== 'summary' ? '/' + tab : ''
  return '/cx/customers/' + customerId + t
}

function cx360Empty (icon, headline, sub, actionHtml) {
  var subBlock = sub
    ? '<div style="font-size:13px;color:var(--text2);margin-bottom:16px">' + escCx(sub) + '</div>'
    : ''
  return (
    '<div class="empty">' +
    '<div class="empty-ic">' +
    icon +
    '</div>' +
    '<div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">' +
    escCx(headline) +
    '</div>' +
    subBlock +
    (actionHtml || '') +
    '</div>'
  )
}

function cx360VisitStatusBadge (status) {
  var s = String(status || '').toLowerCase()
  var cls = 'b-gray'
  if (s === 'completed' || s === 'served') cls = 'b-green'
  else if (s === 'no_show' || s === 'cancelled') cls = 'b-gray'
  else if (s === 'waiting' || s === 'in_service' || s === 'called') cls = 'b-gold'
  return '<span class="b ' + cls + '">' + escCx(status || '—') + '</span>'
}

function cx360PurposeLabel (key) {
  if (!key) return '—'
  if (_cx360.purposeLabels && _cx360.purposeLabels[key]) return _cx360.purposeLabels[key]
  return String(key).replace(/_/g, ' ')
}

async function cx360LoadPurposeLabels () {
  if (_cx360.purposeLabels) return _cx360.purposeLabels
  _cx360.purposeLabels = {}
  try {
    var res = await cxApiFetch('GET', '/api/meta/gatepass-purposes')
    var rows = res.data || []
    rows.forEach(function (r) {
      if (r.key) _cx360.purposeLabels[r.key] = r.label || r.key
    })
  } catch (_) {}
  return _cx360.purposeLabels
}

function cx360UpdateShellLayout () {
  var mobile = cx360IsMobile()
  document.body.classList.toggle('cx360-mobile', mobile)
  var bc = document.getElementById('cx-bc')
  if (!bc) return
  if (!_cx360.header) {
    bc.textContent = mobile ? 'Customer 360' : 'Customer'
    return
  }
  bc.textContent = mobile
    ? 'Customer 360'
    : (_cx360.header.full_name || 'Customer')
}

function cx360RenderHeaderUi (h) {
  if (!h) return
  var name = h.full_name || 'Customer #' + _cx360.customerId
  var initials = cxCustomerInitials(name)
  var subParts = []
  if (h.phone) subParts.push(h.phone)
  if (h.home_store_name) subParts.push(h.home_store_name)
  if (h.member_since) subParts.push('Member since ' + fmtCxDateOnly(h.member_since))
  var sub = subParts.join(' · ') || '—'

  var chips =
    (h.is_active === false || h.is_active === 0
      ? '<span class="cx360-chip cx360-chip--gray">Inactive</span>'
      : '<span class="cx360-chip cx360-chip--green">Active</span>') +
    (h.membership_tier_name
      ? '<span class="cx360-chip">' + escCx(h.membership_tier_name) + '</span>'
      : '')

  var deskAv = document.getElementById('cx360-desk-av')
  var deskName = document.getElementById('cx360-desk-name')
  var deskSub = document.getElementById('cx360-desk-sub')
  var deskChips = document.getElementById('cx360-desk-chips')
  var bcName = document.getElementById('cx360-bc-name')
  if (deskAv) deskAv.textContent = initials
  if (deskName) deskName.textContent = name
  if (deskSub) deskSub.textContent = sub
  if (deskChips) deskChips.innerHTML = chips
  if (bcName) bcName.textContent = name

  var mobAv = document.getElementById('cx360-mob-av')
  var mobName = document.getElementById('cx360-mob-name')
  var mobSub = document.getElementById('cx360-mob-sub')
  var mobChips = document.getElementById('cx360-mob-chips')
  if (mobAv) mobAv.textContent = initials
  if (mobName) mobName.textContent = name
  if (mobSub) mobSub.textContent = sub
  if (mobChips) mobChips.innerHTML = chips

  var orders = h.order_count != null ? Number(h.order_count) : 0
  var rev = h.lifetime_revenue != null ? Number(h.lifetime_revenue) : 0
  var live = h.coins_live != null ? Number(h.coins_live) : h.live_coins != null ? Number(h.live_coins) : 0
  var pending = h.coins_pending != null ? Number(h.coins_pending) : h.pending_coins != null ? Number(h.pending_coins) : 0

  var elOrd = document.getElementById('cx360-stat-orders')
  var elRev = document.getElementById('cx360-stat-revenue')
  var elCoins = document.getElementById('cx360-stat-coins')
  var elPending = document.getElementById('cx360-stat-pending')
  if (elOrd && typeof window.cosmosCountUp === 'function') window.cosmosCountUp(elOrd, orders)
  else if (elOrd) elOrd.textContent = String(orders)
  if (elRev && typeof window.cosmosCountUp === 'function') window.cosmosCountUp(elRev, rev)
  else if (elRev) elRev.textContent = fmtCxRs(rev)
  if (elCoins && typeof window.cosmosCountUp === 'function') window.cosmosCountUp(elCoins, live)
  else if (elCoins) elCoins.textContent = String(live)
  if (elPending && typeof window.cosmosCountUp === 'function') window.cosmosCountUp(elPending, pending)
  else if (elPending) elPending.textContent = String(pending)

  var metrics = document.getElementById('cx360-mob-metrics')
  if (metrics) {
    metrics.innerHTML =
      '<div class="cx360-metric-chip"><div class="lbl">Orders</div><div class="val">' +
      escCx(String(orders)) +
      '</div></div>' +
      '<div class="cx360-metric-chip"><div class="lbl">Revenue</div><div class="val">' +
      escCx(fmtCxRs(rev)) +
      '</div></div>' +
      '<div class="cx360-metric-chip"><div class="lbl">Coins</div><div class="val">' +
      escCx(String(live)) +
      '</div></div>' +
      '<div class="cx360-metric-chip"><div class="lbl">Pending</div><div class="val">' +
      escCx(String(pending)) +
      '</div></div>'
  }

  cx360BindActionButtons(h)
  cx360UpdateShellLayout()
}

function cx360BindActionButtons (h) {
  var canMem = window.cosmosCxAllows(['cx.membership.manage'])
  var canCoins = window.cosmosCxAllows(['cx.coins.manual', 'cx.admin'])
  var name = (h && h.full_name) || ''
  var phone = (h && h.phone) || ''
  var store = (h && h.home_store_name) || ''

  function onGrant () {
    if (typeof window.openGrantMembershipModal === 'function') {
      window.openGrantMembershipModal(_cx360.customerId, name, phone, store)
    }
  }
  function onCoins () {
    window.cx360OpenCoinsModal()
  }

  var deskActions = document.getElementById('cx360-desk-actions')
  if (deskActions) {
    deskActions.innerHTML = ''
    if (canMem) {
      var b1 = document.createElement('button')
      b1.type = 'button'
      b1.className = 'btn primary sm'
      b1.textContent = 'Grant membership'
      b1.addEventListener('click', onGrant)
      deskActions.appendChild(b1)
    }
    if (canCoins) {
      var b2 = document.createElement('button')
      b2.type = 'button'
      b2.className = 'btn sm'
      b2.textContent = 'Adjust coins'
      b2.addEventListener('click', onCoins)
      deskActions.appendChild(b2)
    }
    if (window.cosmosCxAllows(['cx.eye_tests.create'])) {
      var b3 = document.createElement('button')
      b3.type = 'button'
      b3.className = 'btn sm'
      b3.textContent = '+ Eye test'
      b3.addEventListener('click', function () {
        if (typeof window.openEyeTestModal === 'function') {
          window.openEyeTestModal(_cx360.customerId, name)
        }
      })
      deskActions.appendChild(b3)
    }
  }

  var gm = document.getElementById('cx360-btn-grant-mob')
  var cm = document.getElementById('cx360-btn-coins-mob')
  if (gm) {
    gm.hidden = !canMem
    gm.onclick = onGrant
  }
  if (cm) {
    cm.hidden = !canCoins
    cm.onclick = onCoins
  }
}

window.cx360ReloadHeader = async function () {
  if (!_cx360.customerId) return
  delete _cx360.loaded.header
  await cx360LoadHeader(true)
}

window.cx360ReloadTab = function (tab) {
  if (!tab || !_cx360.customerId) return
  delete _cx360.loaded[tab]
  if (cx360IsMobile()) {
    if (CX360_MOB_SEG.indexOf(tab) >= 0 && tab !== 'more') _cx360.mobSeg = tab
    else {
      _cx360.mobSeg = 'more'
      _cx360.moreTab = tab
    }
    cx360SyncMobSegUi()
  }
  void cx360LoadTab(tab)
}

function cx360BuildDeskTabs () {
  var nav = document.getElementById('cx360-desk-tabs')
  if (!nav || nav.dataset.built) return
  nav.dataset.built = '1'
  nav.innerHTML = CX360_TAB_KEYS.map(function (key) {
    return (
      '<button type="button" class="cx360-tab" role="tab" data-cx360-tab="' +
      key +
      '" aria-selected="false">' +
      escCx(CX360_TAB_LABELS[key]) +
      '</button>'
    )
  }).join('')
  nav.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-cx360-tab]')
    if (!btn) return
    window.cx360SetTab(btn.getAttribute('data-cx360-tab'))
  })
}

function cx360BuildMoreList () {
  var list = document.getElementById('cx360-more-list')
  if (!list || list.dataset.built) return
  list.dataset.built = '1'
  list.innerHTML = CX360_MORE_TABS.map(function (key) {
    return (
      '<button type="button" class="cx360-more-item" data-cx360-more-tab="' +
      key +
      '">' +
      escCx(CX360_TAB_LABELS[key]) +
      '</button>'
    )
  }).join('')
  list.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-cx360-more-tab]')
    if (!btn) return
    window.cx360CloseMoreSheet()
    _cx360.moreTab = btn.getAttribute('data-cx360-more-tab')
    _cx360.mobSeg = 'more'
    cx360SyncMobSegUi()
    void cx360LoadTab(_cx360.moreTab)
  })
}

function cx360SyncDeskTabUi () {
  document.querySelectorAll('#cx360-desk-tabs .cx360-tab').forEach(function (btn) {
    var on = btn.getAttribute('data-cx360-tab') === _cx360.tab
    btn.classList.toggle('active', on)
    btn.setAttribute('aria-selected', on ? 'true' : 'false')
  })
}

function cx360SyncMobSegUi () {
  document.querySelectorAll('#cx360-mob-seg .cx360-seg-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-cx360-seg') === _cx360.mobSeg)
  })
}

window.cx360SetTab = function (tab, options) {
  var opts = options || {}
  if (CX360_TAB_KEYS.indexOf(tab) < 0) tab = 'summary'
  _cx360.tab = tab
  if (cx360IsMobile()) {
    if (CX360_MOB_SEG.indexOf(tab) >= 0 && tab !== 'more') _cx360.mobSeg = tab
    else if (tab !== 'summary') {
      _cx360.mobSeg = 'more'
      _cx360.moreTab = tab
    } else {
      _cx360.mobSeg = 'summary'
    }
    cx360SyncMobSegUi()
  }
  cx360SyncDeskTabUi()
  if (!opts.fromHistory && _cx360.customerId) {
    var path = cx360Path(_cx360.customerId, tab)
    if (window.location.pathname !== path) {
      window.history.pushState({ module: 'cx', page: 'customer360', customerId: _cx360.customerId, tab: tab }, '', path)
    }
  }
  void cx360LoadTab(tab)
}

async function cx360LoadHeader (force) {
  if (!force && _cx360.loaded.header && _cx360.header) {
    cx360RenderHeaderUi(_cx360.header)
    return _cx360.header
  }
  var res = await cxApiFetch('GET', '/api/cx/customers/' + _cx360.customerId + '/360')
  _cx360.header = res.data || {}
  _cx360.loaded.header = true
  cx360RenderHeaderUi(_cx360.header)
  return _cx360.header
}

async function cx360LoadTab (tab) {
  if (_cx360.loaded[tab]) return
  var panel = document.getElementById('cx360-desk-panel')
  var mobBody = document.getElementById('cx360-mob-body')
  var target = cx360IsMobile() ? mobBody : panel
  if (!target) return

  if (typeof window.cosmosSkeletonRows === 'function') {
    if (cx360IsMobile()) window.cosmosSkeletonRows('cx360-mob-body', 4)
    else {
      target.innerHTML = '<div class="card"><div class="cb" id="cx360-panel-skel"></div></div>'
      window.cosmosSkeletonRows('cx360-panel-skel', 4)
    }
  }

  try {
    var html = ''
    if (tab === 'summary') html = await cx360RenderSummary()
    else if (tab === 'profile') html = await cx360RenderProfile()
    else if (tab === 'lifestyle') html = await cx360RenderLifestyle()
    else if (tab === 'visits') html = await cx360RenderVisits()
    else if (tab === 'prescriptions') html = await cx360RenderPrescriptions()
    else if (tab === 'orders') html = await cx360RenderOrders()
    else if (tab === 'invoices') html = await cx360RenderInvoices()
    else if (tab === 'membership') html = await cx360RenderMembership()
    else if (tab === 'coins') html = await cx360RenderCoins()
    else if (tab === 'offers') html = await cx360RenderOffers()
    else if (tab === 'audit') html = await cx360RenderAudit()
    _cx360.loaded[tab] = true
    if (cx360IsMobile()) mobBody.innerHTML = html
    else panel.innerHTML = html
    cx360BindTabInteractions(tab)
  } catch (err) {
    var msg = err && err.message ? err.message : 'Could not load section.'
    var errHtml =
      '<div class="card"><div class="cb" style="color:var(--red)">' + escCx(msg) + '</div></div>'
    if (cx360IsMobile()) mobBody.innerHTML = errHtml
    else panel.innerHTML = errHtml
    if (typeof window.cosmosToastError === 'function') window.cosmosToastError(msg)
  }
}

function cx360BindTabInteractions (tab) {
  if (tab === 'profile') cx360BindProfileForm()
  if (tab === 'lifestyle') cx360BindLifestyleForm()
  if (tab === 'membership') {
    var grantBtn = document.getElementById('cx360-grant-mem-btn')
    if (grantBtn && !grantBtn.dataset.bound) {
      grantBtn.dataset.bound = '1'
      grantBtn.addEventListener('click', function () {
        var h = _cx360.header || {}
        if (typeof window.openGrantMembershipModal === 'function') {
          window.openGrantMembershipModal(
            _cx360.customerId,
            h.full_name || '',
            h.phone || '',
            h.home_store_name || ''
          )
        }
      })
    }
    document.querySelectorAll('[data-cx360-dep-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        void cxRemoveFamilyMember(_cx360.customerId, btn.getAttribute('data-cx360-dep-remove'))
      })
    })
    var famBtn = document.getElementById('cx360-add-buddy-btn')
    if (famBtn) {
      famBtn.addEventListener('click', function () {
        if (typeof window.openCxFamilyMemberModal === 'function') {
          window.openCxFamilyMemberModal(_cx360.customerId)
        }
      })
    }
  }
}

async function cx360RenderSummary () {
  var h = _cx360.header || (await cx360LoadHeader())
  var mem = ''
  try {
    var mres = await cxApiFetch('GET', '/api/cx/customers/' + _cx360.customerId + '/membership')
    var payload = mres.data || {}
    var active = payload.active_membership
    if (payload.membership_role === 'dependent' && payload.inherited_from) {
      mem =
        'Buddy plan via <strong>' +
        escCx(payload.inherited_from.full_name || 'plan holder') +
        '</strong>'
    } else if (active) {
      mem = 'Active: <strong>' + escCx(cxMembershipLabelFromActive(active)) + '</strong>'
    } else {
      mem = 'No active Eyewoot Go membership.'
    }
  } catch (_) {
    mem = 'Membership status unavailable.'
  }

  var visitHint = ''
  if (h.visit_count != null) {
    visitHint =
      '<div class="cx360-row"><div class="cx360-row-main"><div class="cx360-row-title">Store visits</div>' +
      '<div class="cx360-row-sub">' +
      escCx(String(h.visit_count)) +
      ' check-ins recorded</div></div></div>'
  }

  if (cx360IsMobile()) {
    return (
      '<div class="cx360-list-card"><div class="sec">Membership</div><div class="cx360-row"><div class="cx360-row-main"><div class="cx360-row-sub">' +
      mem +
      '</div></div></div></div>' +
      (visitHint
        ? '<div class="cx360-list-card"><div class="sec">Visits</div>' + visitHint + '</div>'
        : '') +
      '<div class="cx360-list-card"><div class="sec">Contact</div>' +
      '<div class="cx360-row"><div class="cx360-row-main"><div class="cx360-row-title">Phone</div><div class="cx360-row-sub">' +
      escCx(h.phone || '—') +
      '</div></div></div>' +
      '<div class="cx360-row"><div class="cx360-row-main"><div class="cx360-row-title">Email</div><div class="cx360-row-sub">' +
      escCx(h.email || '—') +
      '</div></div></div></div>'
    )
  }

  return (
    '<div class="card"><div class="ch"><div class="ct">Overview</div></div><div class="cb">' +
    '<dl class="cx360-kv">' +
    '<dt>Membership</dt><dd>' +
    mem +
    '</dd>' +
    '<dt>Phone</dt><dd>' +
    escCx(h.phone || '—') +
    '</dd>' +
    '<dt>Email</dt><dd>' +
    escCx(h.email || '—') +
    '</dd>' +
    '<dt>Home store</dt><dd>' +
    escCx(h.home_store_name || '—') +
    '</dd>' +
    (h.visit_count != null ? '<dt>Visits</dt><dd>' + escCx(String(h.visit_count)) + '</dd>' : '') +
    '</dl></div></div>'
  )
}

async function cx360RenderProfile () {
  var res = await cxApiFetch('GET', '/api/cx/customers/' + _cx360.customerId + '/profile')
  var p = res.data || {}
  var canEdit = window.cosmosCxAllows(['cx.customers.edit', 'cx.admin'])
  if (!canEdit) {
    return (
      '<div class="card"><div class="ch"><div class="ct">Profile</div></div><div class="cb"><dl class="cx360-kv">' +
      '<dt>Full name</dt><dd>' +
      escCx(p.full_name || '—') +
      '</dd><dt>Email</dt><dd>' +
      escCx(p.email || '—') +
      '</dd><dt>Date of birth</dt><dd>' +
      escCx(p.dob ? fmtCxDateOnly(p.dob) : '—') +
      '</dd><dt>Phone</dt><dd>' +
      escCx(p.phone || '—') +
      '</dd></dl></div></div>'
    )
  }
  return (
    '<div class="card"><div class="ch"><div class="ct">Profile</div></div><div class="cb" style="display:flex;flex-direction:column;gap:12px">' +
    '<div class="fgrp"><label for="cx360-prof-name">Full name</label><input type="text" id="cx360-prof-name" value="' +
    escCx(p.full_name || '') +
    '"></div>' +
    '<div class="fgrp"><label for="cx360-prof-email">Email</label><input type="email" id="cx360-prof-email" value="' +
    escCx(p.email || '') +
    '"></div>' +
    '<div class="fgrp"><label for="cx360-prof-dob">Date of birth</label><input type="date" id="cx360-prof-dob" value="' +
    escCx(p.dob ? String(p.dob).slice(0, 10) : '') +
    '"></div>' +
    '<div id="cx360-prof-error" style="color:var(--red);font-size:12px;display:none"></div>' +
    '<button type="button" class="btn primary" id="cx360-prof-save">Save profile</button></div></div>'
  )
}

function cx360BindProfileForm () {
  var btn = document.getElementById('cx360-prof-save')
  if (!btn || btn.dataset.bound) return
  btn.dataset.bound = '1'
  var fields = ['cx360-prof-name', 'cx360-prof-email', 'cx360-prof-dob']
  fields.forEach(function (id) {
    var el = document.getElementById(id)
    if (el && typeof window.cosmosFieldClear === 'function') {
      el.addEventListener('input', function () {
        window.cosmosFieldClear(el)
      })
    }
  })
  btn.addEventListener('click', async function () {
    var errEl = document.getElementById('cx360-prof-error')
    var nameEl = document.getElementById('cx360-prof-name')
    if (!nameEl.value.trim()) {
      if (typeof window.cosmosFieldError === 'function') window.cosmosFieldError(nameEl, 'Required')
      return
    }
    if (errEl) errEl.style.display = 'none'
    if (typeof window.cosmosBtnLoading === 'function') window.cosmosBtnLoading(btn)
    try {
      await cxApiFetch('PUT', '/api/cx/customers/' + _cx360.customerId + '/profile', {
        full_name: nameEl.value.trim(),
        email: document.getElementById('cx360-prof-email').value.trim() || null,
        dob: document.getElementById('cx360-prof-dob').value || null
      })
      if (typeof window.cosmosBtnSuccess === 'function') window.cosmosBtnSuccess(btn)
      if (typeof window.cosmosToastSuccess === 'function') window.cosmosToastSuccess('Profile saved.')
      delete _cx360.loaded.profile
      delete _cx360.loaded.header
      await cx360LoadHeader(true)
    } catch (err) {
      if (typeof window.cosmosBtnDone === 'function') window.cosmosBtnDone(btn)
      if (typeof window.cosmosToastError === 'function') window.cosmosToastError(err.message)
    }
  })
}

async function cx360RenderLifestyle () {
  var res = await cxApiFetch('GET', '/api/cx/customers/' + _cx360.customerId + '/lifestyle')
  var L = res.data || {}
  var canEdit = window.cosmosCxAllows(['cx.customers.edit', 'cx.admin'])
  if (!canEdit) {
    return (
      '<div class="card"><div class="ch"><div class="ct">Lifestyle</div></div><div class="cb"><dl class="cx360-kv">' +
      '<dt>Screen hours</dt><dd>' +
      escCx(L.screen_hrs != null ? String(L.screen_hrs) : '—') +
      '</dd><dt>Frame preference</dt><dd>' +
      escCx(L.frame_pref || '—') +
      '</dd><dt>Budget</dt><dd>' +
      escCx(
        L.budget_min != null || L.budget_max != null
          ? fmtCxRs(L.budget_min || 0) + ' – ' + fmtCxRs(L.budget_max || 0)
          : '—'
      ) +
      '</dd><dt>Notes</dt><dd>' +
      escCx(L.notes || '—') +
      '</dd></dl></div></div>'
    )
  }
  return (
    '<div class="card"><div class="ch"><div class="ct">Lifestyle</div></div><div class="cb" style="display:flex;flex-direction:column;gap:12px">' +
    '<div class="fgrp"><label for="cx360-life-screen">Screen hours / day</label><input type="number" id="cx360-life-screen" min="0" value="' +
    escCx(L.screen_hrs != null ? String(L.screen_hrs) : '') +
    '"></div>' +
    '<div class="fgrp"><label for="cx360-life-frame">Frame preference</label><input type="text" id="cx360-life-frame" value="' +
    escCx(L.frame_pref || '') +
    '"></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
    '<div class="fgrp"><label for="cx360-life-bmin">Budget min (₹)</label><input type="number" id="cx360-life-bmin" min="0" value="' +
    escCx(L.budget_min != null ? String(L.budget_min) : '') +
    '"></div>' +
    '<div class="fgrp"><label for="cx360-life-bmax">Budget max (₹)</label><input type="number" id="cx360-life-bmax" min="0" value="' +
    escCx(L.budget_max != null ? String(L.budget_max) : '') +
    '"></div></div>' +
    '<div class="fgrp"><label for="cx360-life-notes">Notes</label><input type="text" id="cx360-life-notes" value="' +
    escCx(L.notes || '') +
    '"></div>' +
    '<button type="button" class="btn primary" id="cx360-life-save">Save lifestyle</button></div></div>'
  )
}

function cx360BindLifestyleForm () {
  var btn = document.getElementById('cx360-life-save')
  if (!btn || btn.dataset.bound) return
  btn.dataset.bound = '1'
  btn.addEventListener('click', async function () {
    if (typeof window.cosmosBtnLoading === 'function') window.cosmosBtnLoading(btn)
    try {
      await cxApiFetch('PUT', '/api/cx/customers/' + _cx360.customerId + '/lifestyle', {
        screen_hrs: document.getElementById('cx360-life-screen').value || null,
        frame_pref: document.getElementById('cx360-life-frame').value.trim() || null,
        budget_min: document.getElementById('cx360-life-bmin').value || null,
        budget_max: document.getElementById('cx360-life-bmax').value || null,
        notes: document.getElementById('cx360-life-notes').value.trim() || null
      })
      if (typeof window.cosmosBtnSuccess === 'function') window.cosmosBtnSuccess(btn)
      if (typeof window.cosmosToastSuccess === 'function') window.cosmosToastSuccess('Lifestyle saved.')
      delete _cx360.loaded.lifestyle
    } catch (err) {
      if (typeof window.cosmosBtnDone === 'function') window.cosmosBtnDone(btn)
      if (typeof window.cosmosToastError === 'function') window.cosmosToastError(err.message)
    }
  })
}

async function cx360RenderVisits () {
  await cx360LoadPurposeLabels()
  var res = await cxApiFetch('GET', '/api/cx/customers/' + _cx360.customerId + '/visits')
  var rows = res.data || []
  if (!rows.length) {
    return cx360Empty('🏪', 'No store visits yet', '')
  }
  if (cx360IsMobile()) {
    return rows
      .map(function (v) {
        return (
          '<article class="cx360-visit-card">' +
          '<div class="cx360-visit-top"><div class="cx360-visit-store">' +
          escCx(v.store_name || 'Store') +
          '</div>' +
          cx360VisitStatusBadge(v.status) +
          '</div>' +
          '<div class="cx360-visit-meta">' +
          fmtCxDateTime(v.checkin_at) +
          ' · ' +
          escCx(cx360PurposeLabel(v.purpose)) +
          (v.wait_minutes != null ? '<br>Wait: ' + escCx(String(v.wait_minutes)) + ' min' : '') +
          (v.checkout_at ? '<br>Out: ' + escCx(fmtCxDateTime(v.checkout_at)) : '') +
          (v.checkin_channel ? '<br>Channel: ' + escCx(v.checkin_channel) : '') +
          '</div></article>'
        )
      })
      .join('')
  }
  var trs = rows
    .map(function (v) {
      return (
        '<tr class="tr-link" tabindex="0">' +
        '<td>' +
        escCx(fmtCxDateTime(v.checkin_at)) +
        '</td><td>' +
        escCx(v.store_name || '—') +
        '</td><td>' +
        escCx(cx360PurposeLabel(v.purpose)) +
        '</td><td>' +
        cx360VisitStatusBadge(v.status) +
        '</td><td>' +
        escCx(v.wait_minutes != null ? String(v.wait_minutes) + ' min' : '—') +
        '</td><td>' +
        escCx(v.checkout_at ? fmtCxDateTime(v.checkout_at) : '—') +
        '</td><td>' +
        escCx(v.checkin_channel || '—') +
        '</td></tr>'
      )
    })
    .join('')
  return (
    '<div class="card"><div class="ch"><div class="ct">Store visits</div></div><div class="tw"><table><thead><tr>' +
    '<th>Check-in</th><th>Store</th><th>Purpose</th><th>Status</th><th>Wait</th><th>Checkout</th><th>Channel</th>' +
    '</tr></thead><tbody>' +
    trs +
    '</tbody></table></div></div>'
  )
}

function cx360RxRowHtml (t) {
  var re = [t.re_sph, t.re_cyl, t.re_axis, t.re_add].filter(function (x) {
    return x != null && x !== ''
  })
  var le = [t.le_sph, t.le_cyl, t.le_axis, t.le_add].filter(function (x) {
    return x != null && x !== ''
  })
  return (
    '<div class="cx360-rx-row" style="padding:12px 0;border-bottom:1px solid var(--border)">' +
    '<div style="font-weight:600">' +
    escCx(fmtCxDateOnly(t.tested_at || t.created_at)) +
    (t.store_name ? ' · ' + escCx(t.store_name) : '') +
    (t.visitor_id ? ' · Visit #' + escCx(String(t.visitor_id)) : '') +
    '</div>' +
    '<div class="td2" style="font-size:12px;margin-top:4px">RE: ' +
    escCx(re.length ? re.join(' / ') : '—') +
    ' · LE: ' +
    escCx(le.length ? le.join(' / ') : '—') +
    (t.pd ? ' · PD ' + escCx(String(t.pd)) : '') +
    '</div></div>'
  )
}

function cx360GroupPrescriptions (rows, primaryName) {
  var primary = []
  var byFamily = {}
  ;(rows || []).forEach(function (t) {
    if (t.family_name_id && t.family_name) {
      var key = String(t.family_name_id)
      if (!byFamily[key]) byFamily[key] = { name: t.family_name, rows: [] }
      byFamily[key].rows.push(t)
    } else {
      primary.push(t)
    }
  })
  var sections = []
  var pLabel = primaryName || 'Customer'
  if (primary.length) {
    sections.push({
      title: 'PRIMARY — ' + pLabel,
      html: primary.map(cx360RxRowHtml).join('')
    })
  }
  Object.keys(byFamily)
    .sort(function (a, b) {
      return String(byFamily[a].name).localeCompare(String(byFamily[b].name))
    })
    .forEach(function (k) {
      var g = byFamily[k]
      sections.push({
        title: 'FAMILY — ' + g.name,
        html: g.rows.map(cx360RxRowHtml).join('')
      })
    })
  return sections
}

window.cx360OpenAddRxModal = function () {
  if (typeof window.openRxModal !== 'function') return
  var h = _cx360.header || {}
  window.openRxModal({
    source: 'cx',
    customerId: _cx360.customerId,
    customerName: h.full_name || '',
    visitorName: null
  })
  window._rxModalOnSaved = function () {
    delete _cx360.loaded.prescriptions
    void cx360LoadTab('prescriptions')
  }
}

async function cx360RenderPrescriptions () {
  var res = await cxApiFetch('GET', '/api/cx/customers/' + _cx360.customerId + '/prescriptions')
  var rows = res.data || []
  var primaryName = (_cx360.header && _cx360.header.full_name) || 'Customer'
  var canAdd = window.cosmosCxAllows(['cx.eye_tests.create'])
  if (!rows.length) {
    var addBtn = ''
    if (canAdd) {
      addBtn =
        '<button type="button" class="btn primary" id="cx360-add-rx">+ Add Rx</button>'
    }
    return cx360Empty('👓', 'No prescriptions yet', '', addBtn)
  }
  var sections = cx360GroupPrescriptions(rows, primaryName)
  if (!sections.length) {
    sections.push({ title: 'PRESCRIPTIONS', html: rows.map(cx360RxRowHtml).join('') })
  }
  var inner = sections
    .map(function (sec) {
      if (cx360IsMobile()) {
        return (
          '<div class="cx360-list-card"><div class="sec">' +
          escCx(sec.title) +
          '</div>' +
          sec.html +
          '</div>'
        )
      }
      return (
        '<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--text3);margin-bottom:8px">' +
        escCx(sec.title) +
        '</div>' +
        sec.html +
        '</div>'
      )
    })
    .join('')
  return (
    '<div class="card"><div class="ch"><div class="ct">Prescriptions</div>' +
    (canAdd ? '<button type="button" class="btn sm primary" id="cx360-add-rx">+ Add Rx</button>' : '') +
    '</div><div class="cb">' +
    inner +
    '</div></div>'
  )
}

async function cx360RenderOrders () {
  var res = await cxApiFetch('GET', '/api/cx/customers/' + _cx360.customerId + '/orders')
  var rows = res.data || []
  if (!rows.length) {
    return cx360Empty('📦', 'No orders yet', '')
  }
  if (cx360IsMobile()) {
    return (
      '<div class="cx360-list-card"><div class="sec">Orders</div>' +
      rows
        .map(function (o) {
          return (
            '<div class="cx360-row"><div class="cx360-row-main"><div class="cx360-row-title">' +
            escCx(o.order_no || 'Order #' + o.order_id) +
            '</div><div class="cx360-row-sub">' +
            escCx(o.store_name || '') +
            ' · ' +
            escCx(fmtCxRs(o.total_amount)) +
            ' · ' +
            escCx(fmtCxDateTime(o.created_at)) +
            '</div></div>' +
            cxOrderStatusBadge(o.status) +
            '</div>'
          )
        })
        .join('') +
      '</div>'
    )
  }
  return (
    '<div class="card"><div class="tw"><table><thead><tr><th>Order</th><th>Store</th><th class="text-right">Total</th><th>Status</th><th>When</th></tr></thead><tbody>' +
    rows
      .map(function (o) {
        return (
          '<tr class="tr-link"><td>' +
          escCx(o.order_no || o.order_id) +
          '</td><td>' +
          escCx(o.store_name || '—') +
          '</td><td class="text-right">' +
          escCx(fmtCxRs(o.total_amount)) +
          '</td><td>' +
          cxOrderStatusBadge(o.status) +
          '</td><td>' +
          escCx(fmtCxDateTime(o.created_at)) +
          '</td></tr>'
        )
      })
      .join('') +
    '</tbody></table></div></div>'
  )
}

async function cx360RenderInvoices () {
  var res = await cxApiFetch('GET', '/api/cx/customers/' + _cx360.customerId + '/invoices')
  var rows = res.data || []
  if (!rows.length) {
    return cx360Empty('🧾', 'No invoices yet', '')
  }
  return (
    '<div class="card"><div class="tw"><table><thead><tr><th>Invoice</th><th>Store</th><th class="text-right">Amount</th><th>When</th></tr></thead><tbody>' +
    rows
      .map(function (inv) {
        return (
          '<tr class="tr-link"><td>' +
          escCx(inv.invoice_no || inv.invoice_id) +
          '</td><td>' +
          escCx(inv.store_name || '—') +
          '</td><td class="text-right">' +
          escCx(fmtCxRs(inv.total_amount || inv.grand_total)) +
          '</td><td>' +
          escCx(fmtCxDateTime(inv.created_at || inv.invoice_date)) +
          '</td></tr>'
        )
      })
      .join('') +
    '</tbody></table></div></div>'
  )
}

async function cx360RenderMembership () {
  var res = await cxApiFetch('GET', '/api/cx/customers/' + _cx360.customerId + '/membership')
  var payload = res.data || {}
  var active = payload.active_membership
  var dependents = payload.dependents || []
  var html = '<div class="card"><div class="ch"><div class="ct">Membership</div>'
  if (window.cosmosCxAllows(['cx.membership.manage'])) {
    html += '<button type="button" class="btn sm primary" id="cx360-grant-mem-btn">Grant / renew</button>'
  }
  html += '</div><div class="cb">'
  if (payload.membership_role === 'dependent' && payload.inherited_from) {
    html +=
      '<p>Buddy plan via <strong>' +
      escCx(payload.inherited_from.full_name || 'plan holder') +
      '</strong></p>'
  } else if (active) {
    html +=
      '<p style="color:var(--green);font-weight:600">Active: ' +
      escCx(cxMembershipLabelFromActive(active)) +
      '<br><span style="font-weight:500;font-size:12px;color:var(--text2)">Expires ' +
      escCx(fmtCxDateOnly(active.expires_at)) +
      '</span></p>'
  } else {
    html += '<p style="color:var(--text2)">No active Eyewoot Go membership.</p>'
  }
  if (payload.membership_role === 'primary' && active && dependents.length) {
    html += '<div style="margin-top:14px;font-weight:600">Your Buddies</div>'
    dependents.forEach(function (d) {
      var remove = window.cosmosCxAllows(['cx.membership.manage'])
        ? ' <button type="button" class="btn sm" data-cx360-dep-remove="' +
          escCx(String(d.dependent_id)) +
          '">Remove</button>'
        : ''
      html +=
        '<div style="padding:8px 0;border-bottom:1px solid var(--border)"><strong>' +
        escCx(d.full_name || 'Buddy') +
        '</strong> · ' +
        escCx(d.relationship_label || d.relationship || '') +
        remove +
        '</div>'
    })
  }
  if (
    window.cosmosCxAllows(['cx.membership.manage']) &&
    payload.membership_role === 'primary' &&
    active &&
    (payload.slots_remaining == null || payload.slots_remaining > 0)
  ) {
    html +=
      '<button type="button" class="btn sm" id="cx360-add-buddy-btn" style="margin-top:12px">+ Add buddy</button>'
  }
  html += '</div></div>'
  return html
}

async function cx360RenderCoins () {
  var res = await cxApiFetch('GET', '/api/cx/customers/' + _cx360.customerId + '/coins')
  var data = res.data || {}
  var live = data.live_balance != null ? data.live_balance : 0
  var ledger = data.ledger || []
  var head =
    '<div class="card" style="margin-bottom:14px"><div class="cb"><div style="font-size:13px;color:var(--text2)">Live balance</div><div style="font-size:24px;font-weight:700;font-family:JetBrains Mono,monospace">' +
    escCx(String(live)) +
    ' coins</div></div></div>'
  if (!ledger.length) {
    return head + cx360Empty('🪙', 'No coin activity', '')
  }
  return (
    head +
    '<div class="card"><div class="tw"><table><thead><tr><th>When</th><th>Type</th><th class="text-right">Δ</th><th>Status</th><th>Reason</th></tr></thead><tbody>' +
    ledger
      .map(function (row) {
        var delta = row.coins_delta != null ? Number(row.coins_delta) : 0
        var sign = delta > 0 ? '+' : ''
        return (
          '<tr><td>' +
          escCx(fmtCxDateTime(row.created_at)) +
          '</td><td>' +
          escCx(row.entry_type || '—') +
          '</td><td class="text-right" style="font-family:JetBrains Mono,monospace">' +
          escCx(sign + String(delta)) +
          '</td><td>' +
          escCx(row.status || '—') +
          '</td><td>' +
          escCx(row.reason || row.reference_type || '—') +
          '</td></tr>'
        )
      })
      .join('') +
    '</tbody></table></div></div>'
  )
}

function cx360OfferDiscountLabel (o) {
  var t = String(o.discount_type || '').toUpperCase()
  var v = o.discount_value
  if (t === 'PCT') return v + '% off'
  if (t === 'FLAT') return '₹' + v + ' off'
  if (t === 'CASHBACK' && o.cashback_rate != null) return o.cashback_rate + '% cashback'
  if (t === 'FREEBIE') return 'Free item'
  if (t === 'BOGO_LOWEST_FREE') return 'BOGO — lowest free'
  if (t === 'BUY_FRAME_GET_LENS_FREE') return 'Free lens with frame'
  if (t === 'BUY_LENS_GET_FRAME_FREE') return 'Free frame with lens'
  return t || 'Offer'
}

function cx360OfferCapabilityPill (cap) {
  if (!cap) return '<span class="b b-gray">All customers</span>'
  if (cap === 'has_plus_access') return '<span class="b b-gold">Plus</span>'
  return '<span class="b b-gray">' + escCx(cap) + '</span>'
}

function cx360FmtOfferDate (wire) {
  if (!wire) return '—'
  if (typeof window.cosmosFmtDate === 'function') return window.cosmosFmtDate(wire)
  return new Date(wire).toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

async function cx360RenderOffers () {
  if (!window.cosmosCxAllows(['cx.customers.view'])) {
    return cx360Empty('🎁', 'Offers not available', 'You need permission to view customers.')
  }
  var liveRes = await cxApiFetch('GET', '/api/cx/customers/' + _cx360.customerId + '/offers-live')
  var live = liveRes.data || []
  var assignHtml = ''
  if (window.cosmosCxAllows(['cx.offers.view', 'cx.offers.manage'])) {
    try {
      var assignRes = await cxApiFetch(
        'GET',
        '/api/cx/customers/' + _cx360.customerId + '/offers-assignments?active_only=1'
      )
      var assigned = assignRes.data || []
      if (assigned.length) {
        assignHtml =
          '<div class="card" style="margin-top:16px"><div class="ch"><div class="ct">Manual assignments</div></div>'
          + '<div class="tw"><table><thead><tr><th>Offer</th><th>Assigned</th><th>Status</th></tr></thead><tbody>'
          + assigned
            .map(function (a) {
              return (
                '<tr><td>' +
                escCx(a.title || a.offer_id) +
                '</td><td>' +
                escCx(fmtCxDateTime(a.assigned_at)) +
                '</td><td><span class="b b-green">Active</span></td></tr>'
              )
            })
            .join('') +
          '</tbody></table></div></div>'
      }
    } catch (_) {}
  }
  if (!live.length) {
    var emptySub =
      'No active offers match this customer’s membership right now. Configure offers in Command Unit → Promotion.'
    return (
      cx360Empty('🎁', 'No live offers', emptySub) +
      assignHtml
    )
  }
  var liveTable =
    '<div class="card"><div class="ch"><div class="ct">Live offers</div>'
    + '<div class="td-muted text-xs" style="margin-top:4px">Same catalogue as Eyewoot Go — filtered by membership and validity.</div></div>'
    + '<div class="tw"><table><thead><tr><th>Offer</th><th>Benefit</th><th>Eligibility</th><th>Valid until</th></tr></thead><tbody>'
    + live
      .map(function (o) {
        var icon = o.icon_emoji ? '<span style="font-size:18px;margin-right:6px">' + escCx(o.icon_emoji) + '</span>' : ''
        var desc = o.description
          ? '<div class="td-muted text-xs" style="margin-top:2px">' + escCx(o.description) + '</div>'
          : ''
        return (
          '<tr><td><div class="fw-600">' +
          icon +
          escCx(o.title || 'Offer') +
          '</div>' +
          desc +
          '</td><td class="fw-600">' +
          escCx(cx360OfferDiscountLabel(o)) +
          '</td><td>' +
          cx360OfferCapabilityPill(o.required_capability) +
          '</td><td>' +
          escCx(cx360FmtOfferDate(o.valid_to)) +
          '</td></tr>'
        )
      })
      .join('') +
    '</tbody></table></div></div>'
  return liveTable + assignHtml
}

async function cx360RenderAudit () {
  if (!window.cosmosCxAllows(['cx.audit.view', 'cx.admin'])) {
    return cx360Empty('📋', 'Audit restricted', '')
  }
  var res = await cxApiFetch('GET', '/api/cx/customers/' + _cx360.customerId + '/audit')
  var rows = res.data || []
  if (!rows.length) {
    return cx360Empty('📋', 'No audit entries', '')
  }
  return (
    '<div class="card"><div class="tw"><table><thead><tr><th>When</th><th>Action</th><th>Detail</th><th>By</th></tr></thead><tbody>' +
    rows
      .map(function (a) {
        return (
          '<tr><td>' +
          escCx(fmtCxDateTime(a.created_at)) +
          '</td><td>' +
          escCx(a.action || '—') +
          '</td><td>' +
          escCx(a.detail || a.entity_type || '—') +
          '</td><td>' +
          escCx(a.actor_name || '—') +
          '</td></tr>'
        )
      })
      .join('') +
    '</tbody></table></div></div>'
  )
}

window.cx360OpenCoinsModal = function () {
  var existing = document.getElementById('cx360-coins-modal')
  if (!existing) {
    existing = document.createElement('div')
    existing.id = 'cx360-coins-modal'
    existing.className = 'overlay'
    existing.setAttribute('role', 'dialog')
    existing.setAttribute('aria-modal', 'true')
    existing.innerHTML =
      '<div class="cx-modal" style="max-width:400px" onclick="event.stopPropagation()">' +
      '<div class="cx-mh"><div class="cx-mt">Adjust coins</div>' +
      '<button type="button" class="cx-mclose" id="cx360-coins-close" aria-label="Close">✕</button></div>' +
      '<div class="cx-mb" style="display:flex;flex-direction:column;gap:12px">' +
      '<div class="fgrp"><label for="cx360-coins-delta">Coins delta (+/−)</label><input type="number" id="cx360-coins-delta" step="1"></div>' +
      '<div class="fgrp"><label for="cx360-coins-reason">Reason <span class="label-req">*</span></label><input type="text" id="cx360-coins-reason"></div>' +
      '<div id="cx360-coins-error" style="color:var(--red);font-size:12px;display:none"></div>' +
      '<button type="button" class="btn primary" id="cx360-coins-save">Apply adjustment</button>' +
      '</div></div>'
    document.body.appendChild(existing)
    existing.addEventListener('click', function (e) {
      if (e.target === existing) window.cx360CloseCoinsModal()
    })
    document.getElementById('cx360-coins-close').addEventListener('click', window.cx360CloseCoinsModal)
    document.getElementById('cx360-coins-save').addEventListener('click', window.cx360SaveCoinsAdjustment)
  }
  document.getElementById('cx360-coins-delta').value = ''
  document.getElementById('cx360-coins-reason').value = ''
  var err = document.getElementById('cx360-coins-error')
  if (err) err.style.display = 'none'
  existing.style.display = 'flex'
}

window.cx360CloseCoinsModal = function () {
  var m = document.getElementById('cx360-coins-modal')
  if (m) m.style.display = 'none'
}

window.cx360SaveCoinsAdjustment = async function () {
  var btn = document.getElementById('cx360-coins-save')
  var deltaEl = document.getElementById('cx360-coins-delta')
  var reasonEl = document.getElementById('cx360-coins-reason')
  var errEl = document.getElementById('cx360-coins-error')
  var delta = parseInt(deltaEl.value, 10)
  var reason = reasonEl.value.trim()
  if (!Number.isFinite(delta) || delta === 0) {
    if (typeof window.cosmosFieldError === 'function') window.cosmosFieldError(deltaEl, 'Enter non-zero delta')
    return
  }
  if (!reason) {
    if (typeof window.cosmosFieldError === 'function') window.cosmosFieldError(reasonEl, 'Required')
    return
  }
  if (errEl) errEl.style.display = 'none'
  if (typeof window.cosmosBtnLoading === 'function') window.cosmosBtnLoading(btn)
  try {
    await cxApiFetch('POST', '/api/cx/customers/' + _cx360.customerId + '/coins/manual', {
      coins_delta: delta,
      reason: reason
    })
    if (typeof window.cosmosBtnSuccess === 'function') window.cosmosBtnSuccess(btn)
    window.cx360CloseCoinsModal()
    if (typeof window.cosmosToastSuccess === 'function') window.cosmosToastSuccess('Coins adjusted.')
    delete _cx360.loaded.coins
    delete _cx360.loaded.header
    await cx360LoadHeader(true)
    window.cx360ReloadTab('coins')
  } catch (err) {
    if (typeof window.cosmosBtnDone === 'function') window.cosmosBtnDone(btn)
    if (typeof window.cosmosToastError === 'function') window.cosmosToastError(err.message)
  }
}

window.cx360CloseMoreSheet = function () {
  var sheet = document.getElementById('cx360-more-sheet')
  if (sheet) sheet.classList.remove('open')
}

window.cx360Open = function (customerId, tab) {
  if (!window.cosmosCxAllows(['cx.customers.view'])) {
    if (typeof window.cosmosToastWarn === 'function') {
      window.cosmosToastWarn('No permission to view customers.')
    }
    return
  }
  var t = tab || 'summary'
  var path = cx360Path(customerId, t)
  if (window.location.pathname !== path) {
    window.history.pushState(
      { module: 'cx', page: 'customer360', customerId: customerId, tab: t },
      '',
      path
    )
  }
  window.cx360ApplyRoute({ tab: t })
}

window.cx360ApplyRoute = function (options) {
  var opts = options || {}
  var parsed = cx360ParsePath(window.location.pathname)
  if (!parsed || !parsed.customerId) return
  _cx360.customerId = parsed.customerId
  _cx360.tab = opts.tab || parsed.tab || 'summary'
  _cx360.loaded = {}
  _cx360.header = null

  document.body.classList.add('cx360-active', 'cx-page-customer360')
  document.body.classList.remove('cx-page-dashboard', 'cx-page-customers', 'cx-page-offers')
  document.querySelectorAll('.main .page').forEach(function (p) {
    p.classList.remove('active')
  })
  document.querySelectorAll('.cosmos-tab[data-cx-page], .cosmos-btab[data-cx-page]').forEach(function (n) {
    n.classList.remove('active')
  })
  var page = document.getElementById('page-customer-360')
  if (page) page.classList.add('active')

  cx360BuildDeskTabs()
  cx360BuildMoreList()
  cx360UpdateShellLayout()

  if (cx360IsMobile()) {
    if (CX360_MOB_SEG.indexOf(_cx360.tab) >= 0 && _cx360.tab !== 'more') _cx360.mobSeg = _cx360.tab
    else if (_cx360.tab !== 'summary') {
      _cx360.mobSeg = 'more'
      _cx360.moreTab = _cx360.tab
    } else _cx360.mobSeg = 'summary'
    cx360SyncMobSegUi()
  }

  cx360SyncDeskTabUi()
  if (window.cosmosResetAppScroll) window.cosmosResetAppScroll()

  void cx360LoadHeader().then(function () {
    var loadTab = _cx360.tab
    if (cx360IsMobile() && _cx360.mobSeg === 'more' && _cx360.moreTab) loadTab = _cx360.moreTab
    else if (cx360IsMobile()) loadTab = _cx360.mobSeg === 'more' ? _cx360.moreTab || 'summary' : _cx360.mobSeg
    return cx360LoadTab(loadTab)
  })
}

window.cx360Teardown = function () {
  document.body.classList.remove('cx360-active', 'cx360-mobile', 'cx-page-customer360')
  _cx360.customerId = null
  _cx360.loaded = {}
}

window.cx360Back = function () {
  window.cx360Teardown()
  document.body.classList.add('cx-page-customers')
  var navEl =
    document.querySelector('.cosmos-topnav-tabs .cosmos-tab[data-cx-page="customers"]') ||
    document.querySelector('.cosmos-bottom-tabs .cosmos-btab[data-cx-page="customers"]')
  if (window.history.length > 1) {
    window.history.pushState({ module: 'cx', page: 'customers' }, '', '/cx/customers')
  }
  window.cxNav('customers', navEl, { fromHistory: true })
}

function cx360InitOnce () {
  if (window._cx360Bound) return
  window._cx360Bound = true

  var backDesk = document.getElementById('cx360-back-desk')
  var backMob = document.getElementById('cx360-back-mob')
  if (backDesk) backDesk.addEventListener('click', window.cx360Back)
  if (backMob) backMob.addEventListener('click', window.cx360Back)

  var seg = document.getElementById('cx360-mob-seg')
  if (seg) {
    seg.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cx360-seg]')
      if (!btn) return
      var segKey = btn.getAttribute('data-cx360-seg')
      if (segKey === 'more') {
        document.getElementById('cx360-more-sheet').classList.add('open')
        return
      }
      _cx360.mobSeg = segKey
      _cx360.moreTab = null
      cx360SyncMobSegUi()
      window.cx360SetTab(segKey)
    })
  }

  var moreClose = document.getElementById('cx360-more-close')
  var moreSheet = document.getElementById('cx360-more-sheet')
  if (moreClose) moreClose.addEventListener('click', window.cx360CloseMoreSheet)
  if (moreSheet) {
    moreSheet.addEventListener('click', function (e) {
      if (e.target === moreSheet) window.cx360CloseMoreSheet()
    })
  }

  document.addEventListener('click', function (e) {
    if (e.target.id === 'cx360-add-rx' || e.target.id === 'cx360-add-eyetest') {
      window.cx360OpenAddRxModal()
    }
  })

  if (!window._cx360ResizeBound) {
    window._cx360ResizeBound = true
    window.addEventListener('resize', function () {
      if (!document.getElementById('page-customer-360') || !document.getElementById('page-customer-360').classList.contains('active')) return
      cx360UpdateShellLayout()
      var activeTab = _cx360.tab
      delete _cx360.loaded[activeTab]
      void cx360LoadTab(activeTab)
    })
  }
}

document.addEventListener('DOMContentLoaded', cx360InitOnce)
