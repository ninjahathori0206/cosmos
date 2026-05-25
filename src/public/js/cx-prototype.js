/* ─── CX (Customer Experience) — Analytics shell ───────────────────────────── */

function getToken () {
  return sessionStorage.getItem('cosmos_token') || ''
}

async function cxApiFetch (method, path, body) {
  const apiKey = await window.cosmosEnsureApiKey()
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
    Authorization: 'Bearer ' + getToken()
  }
  const res = await fetch(path, {
    method: method,
    headers: headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  let data = {}
  try {
    data = await res.json()
  } catch (_) {}
  if (!res.ok) {
    const msg =
      (data && (data.message || (data.errors && data.errors.join(', ')))) || 'HTTP ' + res.status
    throw new Error(msg)
  }
  if (data && Object.prototype.hasOwnProperty.call(data, 'success') && data.success === false) {
    const msg =
      (data.message || (data.errors && data.errors.join(', '))) || 'Request failed'
    throw new Error(msg)
  }
  return data
}

var cxApiGet = function (p) {
  return cxApiFetch('GET', p)
}

function escCx (s) {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** JWT permission keys from cosmos_user (lowercase). */
window.cosmosEffectiveCxPermissions = function cosmosEffectiveCxPermissions () {
  try {
    var u = JSON.parse(sessionStorage.getItem('cosmos_user') || '{}')
    var p = u.permissions
    if (!Array.isArray(p)) return []
    return p.map(function (x) { return String(x).toLowerCase() })
  } catch (_) {
    return []
  }
}

/**
 * If JWT has cx.* keys: require one of `keys` (OR).
 * Strict default: no cx.* in JWT → deny each scoped check (full CX not implied).
 * Legacy bypass (server): RBAC_LEGACY_EMPTY_PERMISSION_BYPASS / RBAC_STRICT_EMPTY_PERMISSIONS=false → no cx.* → allow.
 */
window.cosmosCxAllows = function cosmosCxAllows (keys) {
  var arr = Array.isArray(keys) ? keys : [keys]
  var perms = window.cosmosEffectiveCxPermissions()
  var scoped = perms.some(function (p) { return p.indexOf('cx.') === 0 })
  var strict = typeof window.cosmosRbacStrictEmptyPerms === 'function'
    ? window.cosmosRbacStrictEmptyPerms()
    : true
  if (!scoped) {
    if (strict) return false
    return true
  }
  var i
  for (i = 0; i < arr.length; i++) {
    if (perms.indexOf(String(arr[i]).toLowerCase()) >= 0) return true
  }
  return false
}

function cxApplyFinePermissionsUi () {
  var dash = document.querySelector('[data-cx-page="dashboard"]')
  var cust = document.querySelector('[data-cx-page="customers"]')
  var off = document.querySelector('[data-cx-page="offers"]')
  if (dash) dash.style.display = window.cosmosCxAllows(['cx.dashboard.view']) ? '' : 'none'
  if (cust) cust.style.display = window.cosmosCxAllows(['cx.customers.view']) ? '' : 'none'
  if (off) off.style.display = window.cosmosCxAllows(['cx.offers.view', 'cx.offers.manage']) ? '' : 'none'
  var newOfferBtn = document.getElementById('cx-btn-new-offer')
  if (newOfferBtn) newOfferBtn.style.display = window.cosmosCxAllows(['cx.offers.manage']) ? '' : 'none'
  var gmEye = document.getElementById('gm-eye-test-btn')
  if (gmEye) gmEye.style.display = window.cosmosCxAllows(['cx.eye_tests.create']) ? '' : 'none'
  var gmSave = document.getElementById('gm-save-btn')
  if (gmSave) gmSave.style.display = window.cosmosCxAllows(['cx.membership.manage']) ? '' : 'none'
}

function cxCustomerInitials (name) {
  var parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function cxIsMobileLayout () {
  try {
    return window.matchMedia('(max-width: 1024px)').matches
  } catch (_) {
    return false
  }
}

function cxCustomerEmptyHtml () {
  return (
    '<div class="empty">' +
    '<div class="empty-ic">\uD83D\uDC65</div>' +
    '<div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">No customers found</div>' +
    '<div style="font-size:13px;color:var(--text2)">Adjust search or register customers from POS.</div>' +
    '</div>'
  )
}

function cxDecodeDataAttr (el, key) {
  if (!el) return ''
  try {
    return decodeURIComponent(el.getAttribute(key) || '')
  } catch (_) {
    return ''
  }
}

function cxNormalizeSearchQuery (q) {
  var t = String(q || '').trim()
  if (!t) return ''
  var digits = t.replace(/\D/g, '')
  if (digits.length >= 4 && digits.length >= t.replace(/\s/g, '').length * 0.7) {
    return digits
  }
  return t
}

var _cxCustSearchDebounce = null

window.closeCxCustomerDetail = function () {
  var ov = document.getElementById('modal-cx-customer-detail')
  if (ov) ov.style.display = 'none'
}

window.openCxCustomerDetail = async function (el) {
  if (!el) return
  if (!window.cosmosCxAllows(['cx.customers.view'])) {
    if (typeof window.cosmosToastWarn === 'function') {
      window.cosmosToastWarn('No permission to view customers (cx.customers.view).')
    }
    return
  }
  var id = parseInt(el.getAttribute('data-cid'), 10)
  if (!id) return
  var name = cxDecodeDataAttr(el, 'data-cname')
  var phone = cxDecodeDataAttr(el, 'data-cphone')
  var store = cxDecodeDataAttr(el, 'data-cstore')
  var orders = cxDecodeDataAttr(el, 'data-orders')
  var revenue = cxDecodeDataAttr(el, 'data-revenue')
  document.getElementById('cx-cust-detail-title').textContent = name || 'Customer'
  document.getElementById('cx-cust-detail-name').textContent = name || 'Customer #' + id
  document.getElementById('cx-cust-detail-av').textContent = cxCustomerInitials(name || 'C')
  var sub = []
  if (phone) sub.push(phone)
  if (store) sub.push(store)
  document.getElementById('cx-cust-detail-sub').textContent = sub.join(' · ') || '—'
  document.getElementById('cx-cust-detail-stats').innerHTML =
    '<div class="cx-cust-detail-stat"><div class="lbl">Orders</div><div class="val">' +
    escCx(orders || '0') +
    '</div></div>' +
    '<div class="cx-cust-detail-stat"><div class="lbl">Lifetime</div><div class="val">' +
    escCx(revenue || fmtCxRs(0)) +
    '</div></div>'

  var memEl = document.getElementById('cx-cust-detail-membership')
  var grantBtn = document.getElementById('cx-cust-detail-grant-btn')
  if (memEl) {
    if (typeof window.cosmosSkeletonRows === 'function') {
      window.cosmosSkeletonRows('cx-cust-detail-membership', 1)
    } else {
      memEl.innerHTML = '<div class="skel skel-text" style="max-width:100%"></div>'
    }
  }
  if (grantBtn) {
    grantBtn.style.display = window.cosmosCxAllows(['cx.membership.manage']) ? '' : 'none'
    grantBtn.onclick = function () {
      window.closeCxCustomerDetail()
      if (typeof window.openGrantMembershipModal === 'function') {
        window.openGrantMembershipModal(id, name, phone, store)
      }
    }
  }

  var ov = document.getElementById('modal-cx-customer-detail')
  if (ov) ov.style.display = 'flex'

  try {
    var statusRes = await cxApiFetch('GET', '/api/cx/customers/' + id + '/membership')
    var active = (statusRes.data && statusRes.data.active_membership) || null
    if (!memEl) return
    if (active) {
      memEl.innerHTML =
        '<div style="padding:12px;border-radius:10px;background:var(--greenL);color:var(--green);font-weight:600">' +
        'Active tier: <strong>' +
        escCx(cxMembershipLabelFromActive(active)) +
        '</strong><br><span style="font-weight:500;font-size:12px">Expires ' +
        escCx(fmtCxDateOnly(active.expires_at)) +
        '</span></div>'
    } else {
      memEl.innerHTML =
        '<div style="padding:12px;border-radius:10px;background:var(--bg2);color:var(--text2)">No active Eyewoot Go membership.</div>'
    }
  } catch (err) {
    if (memEl) {
      memEl.innerHTML =
        '<span style="color:var(--red)">' +
        escCx(err && err.message ? err.message : 'Could not load membership status.') +
        '</span>'
    }
  }
}

function cxOpenCustomerFromEl (el) {
  window.openCxCustomerDetail(el)
}

function cxFormatMembershipSummary (row) {
  if (!row || (!row.membership_tier_name && !row.active_plan_key)) {
    return { tier: 'No active membership', type: '', expiry: '' }
  }
  return {
    tier: row.membership_tier_name || row.plan_display_name || row.active_plan_key || '—',
    type: row.membership_type || '',
    expiry: row.membership_expires_at ? fmtCxDateOnly(row.membership_expires_at) : ''
  }
}

function cxMembershipLabelFromActive (active) {
  if (!active) return 'No active membership'
  var tier =
    active.membership_tier_label || active.tier_name || active.plan_display_name || active.plan_key || ''
  var type = active.membership_type_label || active.membership_type || ''
  if (!tier && !type) return 'No active membership'
  var out = tier || '—'
  if (type) out += ' · Type: ' + type
  return out
}

function cxMembershipLabelFromRollup (r) {
  if (!r || (!r.membership_tier_name && !r.active_plan_key && !r.membership_type)) return '—'
  return cxMembershipLabelFromActive({
    membership_tier_label: r.membership_tier_name,
    tier_name: r.membership_tier_name,
    plan_display_name: r.plan_display_name,
    plan_key: r.active_plan_key,
    membership_type: r.membership_type
  })
}

function cxMembershipCardRowHtml (summary) {
  var text = summary.tier
  if (summary.type) text += ' · Type: ' + summary.type
  if (summary.expiry) text += ' (exp. ' + summary.expiry + ')'
  var cls = summary.tier === 'No active membership' ? '' : ' cx-cust-card__row--active-member'
  return (
    '<div class="cx-cust-card__row' +
    cls +
    '"><span>Membership tier</span><span>' +
    escCx(text) +
    '</span></div>'
  )
}

function cxRenderCustomerCard (r) {
  var cid = escCx(String(r.customer_id))
  var cname = encodeURIComponent(r.full_name || '')
  return (
    '<button type="button" class="cx-cust-card tr-link" data-cid="' +
    cid +
    '" data-cname="' +
    cname +
    '" data-cphone="' +
    encodeURIComponent(r.phone || '') +
    '" data-cstore="' +
    encodeURIComponent(r.home_store_name || '') +
    '" data-orders="' +
    encodeURIComponent(String(r.order_count)) +
    '" data-revenue="' +
    encodeURIComponent(fmtCxRs(r.lifetime_revenue)) +
    '" data-mtier="' +
    encodeURIComponent(r.membership_tier_name || '') +
    '" data-mtype="' +
    encodeURIComponent(r.membership_type || '') +
    '" data-mexp="' +
    encodeURIComponent(r.membership_expires_at || '') +
    '">' +
    '<div class="cx-cust-card__head">' +
    '<div class="cx-cust-card__av">' +
    escCx(cxCustomerInitials(r.full_name)) +
    '</div>' +
    '<div class="cx-cust-card__meta">' +
    '<div class="cx-cust-card__name">' +
    escCx(r.full_name) +
    '</div>' +
    '<div class="cx-cust-card__phone mono">' +
    escCx(r.phone || '\u2014') +
    '</div>' +
    '</div>' +
    '<span class="cx-cust-card__chev" aria-hidden="true">\u203A</span>' +
    '</div>' +
    cxMembershipCardRowHtml(cxFormatMembershipSummary(r)) +
    '<div class="cx-cust-card__row"><span>Home store</span><span>' +
    escCx(r.home_store_name || '\u2014') +
    '</span></div>' +
    '<div class="cx-cust-card__row"><span>Orders</span><span>' +
    escCx(String(r.order_count)) +
    '</span></div>' +
    '<div class="cx-cust-card__row"><span>Lifetime</span><span class="mono fw6">' +
    fmtCxRs(r.lifetime_revenue) +
    '</span></div>' +
    '<div class="cx-cust-card__row"><span>Last order</span><span>' +
    fmtCxDateOnly(r.last_order_at) +
    '</span></div>' +
    '</button>'
  )
}

function cxRenderCustomerTableRow (r) {
  var cid = escCx(String(r.customer_id))
  var cname = encodeURIComponent(r.full_name || '')
  return (
    '<tr class="tr-link" data-cid="' +
    cid +
    '" data-cname="' +
    cname +
    '" data-cphone="' +
    encodeURIComponent(r.phone || '') +
    '" data-cstore="' +
    encodeURIComponent(r.home_store_name || '') +
    '" data-orders="' +
    encodeURIComponent(String(r.order_count)) +
    '" data-revenue="' +
    encodeURIComponent(fmtCxRs(r.lifetime_revenue)) +
    '">' +
    '<td><div class="fw6">' +
    escCx(r.full_name) +
    '</div>' +
    (r.email ? '<div class="xs td3">' + escCx(r.email) + '</div>' : '') +
    '</td>' +
    '<td class="mono">' +
    escCx(r.phone) +
    '</td>' +
    '<td>' +
    escCx(r.home_store_name || '\u2014') +
    '</td>' +
    '<td class="text-right">' +
    escCx(String(r.order_count)) +
    '</td>' +
    '<td class="text-right mono fw6">' +
    fmtCxRs(r.lifetime_revenue) +
    '</td>' +
    '<td>' +
    escCx(cxMembershipLabelFromRollup(r)) +
    '</td>' +
    '<td class="td3" style="font-size:12px">' +
    fmtCxDateOnly(r.last_order_at) +
    '</td>' +
    '</tr>'
  )
}

function fmtCxRs (v) {
  var n = Number(v) || 0
  return (
    '\u20B9' +
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
}

function fmtCxDateTime (v) {
  if (typeof window.cosmosFmtDateTime === 'function') return window.cosmosFmtDateTime(v)
  if (!v) return '\u2014'
  return String(v)
}

function fmtCxDateOnly (v) {
  if (typeof window.cosmosFmtDate === 'function') return window.cosmosFmtDate(v)
  if (!v) return '\u2014'
  return String(v)
}

function cxOrderStatusBadge (status) {
  var s = String(status || '').toUpperCase()
  var cls = 'b-gray'
  if (s === 'COMPLETED' || s === 'DELIVERED' || s === 'CLOSED') cls = 'b-green'
  else if (s === 'OPEN' || s === 'IN_PROGRESS') cls = 'b-gold'
  return '<span class="b ' + cls + '">' + escCx(status || '\u2014') + '</span>'
}

var CX_PAGE_PATHS = {
  dashboard: '/cx/dashboard',
  customers: '/cx/customers',
  offers:    '/cx/offers'
}

function cxGetPageFromPath (pathname) {
  var normalized = String(pathname || '').replace(/\/+$/, '') || '/cx'
  var entries = Object.entries(CX_PAGE_PATHS)
  for (var i = 0; i < entries.length; i++) {
    if (entries[i][1] === normalized) return entries[i][0]
  }
  if (normalized === '/cx') return 'dashboard'
  return 'dashboard'
}

function cxGetNavEl (id) {
  return document.querySelector('.sidebar-nav .nav-item[data-cx-page="' + id + '"]') || null
}

window.cxOpenSidebar = function cxOpenSidebar () {
  var sb = document.getElementById('cx-sidebar') || document.querySelector('.sidebar')
  var ov = document.getElementById('cx-sidebar-overlay')
  if (sb) sb.classList.add('open')
  if (ov) ov.classList.add('open')
  if (window.cosmosLockAppBodyScroll) window.cosmosLockAppBodyScroll()
  else document.body.style.overflow = 'hidden'
  var btn = document.getElementById('cx-menu-toggle')
  if (btn) btn.setAttribute('aria-expanded', 'true')
}

window.cxCloseSidebar = function cxCloseSidebar () {
  var sb = document.getElementById('cx-sidebar') || document.querySelector('.sidebar')
  var ov = document.getElementById('cx-sidebar-overlay')
  if (sb) sb.classList.remove('open')
  if (ov) ov.classList.remove('open')
  document.body.style.overflow = ''
  var btn = document.getElementById('cx-menu-toggle')
  if (btn) btn.setAttribute('aria-expanded', 'false')
}

var CX_BC_MAP = {
  dashboard: 'Dashboard',
  customers: 'Customers',
  offers:    'Customer Offers'
}

function cxRebuildStatCards () {
  var grid = document.getElementById('cx-dash-stats-grid')
  if (!grid) return
  grid.innerHTML =
    '<div class="sc" style="--sc-color:var(--acc)">' +
    '<div class="sl">Registered customers</div>' +
    '<div class="sv" id="cx-stat-customers-count"></div>' +
    '<div class="sm">Active records in POS</div>' +
    '</div>' +
    '<div class="sc" style="--sc-color:var(--blue)">' +
    '<div class="sl">Lifetime revenue</div>' +
    '<div class="sv" data-format="currency" id="cx-stat-revenue"></div>' +
    '<div class="sm">Sum of order totals (all stores)</div>' +
    '</div>' +
    '<div class="sc" style="--sc-color:var(--green)">' +
    '<div class="sl">Total orders</div>' +
    '<div class="sv" id="cx-stat-orders-count"></div>' +
    '<div class="sm">POS / lab pipeline</div>' +
    '</div>' +
    '<div class="sc" style="--sc-color:var(--gold)">' +
    '<div class="sl">Avg order value</div>' +
    '<div class="sv" data-format="currency" id="cx-stat-avg"></div>' +
    '<div class="sm">Customers with orders: <span id="cx-stat-cwo"></span></div>' +
    '</div>'
}

window.cxNav = function (id, el, options) {
  var navOptions = options || {}
  document.querySelectorAll('.main .page').forEach(function (p) {
    p.classList.remove('active')
  })
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(function (n) {
    n.classList.remove('active')
  })
  var page = document.getElementById('page-' + id)
  if (page) page.classList.add('active')
  if (el) el.classList.add('active')
  var bc = document.getElementById('cx-bc')
  if (bc) bc.textContent = CX_BC_MAP[id] || id
  var nextPath = CX_PAGE_PATHS[id] || '/cx/dashboard'
  if (!navOptions.fromHistory && window.location.pathname !== nextPath) {
    window.history.pushState({ module: 'cx', page: id }, '', nextPath)
  }
  if (id === 'dashboard') window.loadCxDashboardPage()
  if (id === 'customers') window.loadCxCustomersPage()
  if (id === 'offers' && typeof window.loadOffersPage === 'function') window.loadOffersPage()
  if (typeof window.cxCloseSidebar === 'function') window.cxCloseSidebar()
}

function cxApplyRouteFromPath () {
  var pageId = cxGetPageFromPath(window.location.pathname)
  function allowed (pid) {
    if (pid === 'dashboard') return window.cosmosCxAllows(['cx.dashboard.view'])
    if (pid === 'customers') return window.cosmosCxAllows(['cx.customers.view'])
    if (pid === 'offers') return window.cosmosCxAllows(['cx.offers.view', 'cx.offers.manage'])
    return true
  }
  if (!allowed(pageId)) {
    if (window.cosmosCxAllows(['cx.dashboard.view'])) pageId = 'dashboard'
    else if (window.cosmosCxAllows(['cx.customers.view'])) pageId = 'customers'
    else if (window.cosmosCxAllows(['cx.offers.view', 'cx.offers.manage'])) pageId = 'offers'
    else {
      if (typeof window.cosmosToastError === 'function') {
        window.cosmosToastError('No CX screen permissions for this role. Ask an admin to assign CX permissions in Command Unit → Roles.')
      }
      return
    }
    var path = CX_PAGE_PATHS[pageId] || '/cx/dashboard'
    if (window.location.pathname !== path) {
      window.history.replaceState({ module: 'cx', page: pageId }, '', path)
    }
  }
  window.cxNav(pageId, cxGetNavEl(pageId), { fromHistory: true })
}

window.addEventListener('popstate', function () {
  cxApplyRouteFromPath()
})

function cxLoadUser () {
  try {
    var token = sessionStorage.getItem('cosmos_token')
    if (!token) {
      window.location.href = '/'
      return
    }
    var stored = sessionStorage.getItem('cosmos_user')
    if (!stored) return
    var u = JSON.parse(stored)
    var mods = u.modules
    var hasMap = mods && typeof mods === 'object' && Object.keys(mods).length > 0
    if (hasMap && mods.cx === false) {
      if (mods.command_unit !== false) window.location.href = '/command-unit/dashboard'
      else if (mods.foundry !== false) window.location.href = '/foundry/dashboard'
      else if (mods.finance !== false) window.location.href = '/finance/dashboard'
      else if (mods.storepilot !== false) window.location.href = '/storepilot/dashboard'
      else if (mods.pos !== false) window.location.href = '/storeos/login'
      else window.location.href = '/'
      return
    }
    var name = u.full_name || u.username || '?'
    var initials = name
      .split(' ')
      .filter(Boolean)
      .map(function (w) {
        return w[0]
      })
      .join('')
      .slice(0, 2)
      .toUpperCase()
    var av = document.getElementById('cx-user-av')
    var nm = document.getElementById('cx-user-name')
    if (av) av.textContent = initials
    if (nm) nm.textContent = name
    if (typeof window.initCosmosModuleSwitchFooter === 'function') {
      window.initCosmosModuleSwitchFooter(u)
    }
    cxApplyFinePermissionsUi()
  } catch (_) {}
}

function cxDashRecentOrdersQuerySuffix() {
  var sel = document.getElementById('cx-dash-orders-status')
  var v = sel && sel.value !== undefined && sel.value !== null ? String(sel.value) : ''
  if (v === 'COMPLETED') return '&status=COMPLETED'
  if (v === '__ALL__') return ''
  return '&exclude_completed=1'
}

window.cxDashReloadOrdersTable = async function () {
  var tbodyO = document.getElementById('cx-tbody-recent-orders')
  if (!tbodyO) return
  if (!window.cosmosCxAllows(['cx.orders.view'])) {
    tbodyO.innerHTML =
      '<tr><td colspan="6" style="padding:16px;font-size:13px;color:var(--text2)">Recent orders require <strong>CX — Orders list</strong> permission.</td></tr>'
    return
  }
  if (typeof window.cosmosSkeletonTable === 'function') {
    window.cosmosSkeletonTable('cx-tbody-recent-orders', 6, 8)
  }
  try {
    var qs = 'limit=24' + cxDashRecentOrdersQuerySuffix()
    var ordRes = await cxApiGet('/api/cx/orders?' + qs)
    var orders = ordRes.data || []
    var sel = document.getElementById('cx-dash-orders-status')
    var filt = sel && sel.value ? String(sel.value) : ''
    var emptyHead = 'No orders yet'
    var emptySub = filt === 'COMPLETED'
      ? 'Completed sales appear here. Store OS hides completed bills on the tablet Orders screen.'
      : filt === '__ALL__'
        ? 'No orders match across stores yet.'
        : 'Active (non-completed) POS orders appear here. Use Completed filter for settled bills.'
    if (!orders.length) {
      tbodyO.innerHTML =
        '<tr><td colspan="6" class="empty" style="border:none">' +
        '<div class="empty-ic">\uD83E\uDDE9</div>' +
        '<div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">' +
        emptyHead +
        '</div>' +
        '<div style="font-size:13px;color:var(--text2);margin-bottom:16px">' +
        emptySub +
        '</div>' +
        '</td></tr>'
      return
    }
    tbodyO.innerHTML = orders
      .map(function (o) {
        var cust =
          escCx(o.customer_name || 'Walk-in') +
          (o.customer_phone ? '<br><span class="xs td3">' + escCx(o.customer_phone) + '</span>' : '')
        return (
          '<tr>' +
          '<td><span class="mono">' +
          escCx(o.order_no) +
          '</span></td>' +
          '<td>' +
          escCx(o.store_name || '') +
          '</td>' +
          '<td>' +
          cust +
          '</td>' +
          '<td class="text-right mono fw6">' +
          fmtCxRs(o.total_amount) +
          '</td>' +
          '<td>' +
          cxOrderStatusBadge(o.status) +
          '</td>' +
          '<td class="td3" style="font-size:12px">' +
          fmtCxDateTime(o.created_at) +
          '</td>' +
          '</tr>'
        )
      })
      .join('')
  } catch (err) {
    var msg = err && err.message ? err.message : 'Could not load orders.'
    if (typeof window.cosmosToastError === 'function') window.cosmosToastError(msg)
    tbodyO.innerHTML =
      '<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--red)">Could not load orders.</td></tr>'
  }
}

window.loadCxDashboardPage = async function () {
  var grid = document.getElementById('cx-dash-stats-grid')
  if (grid && typeof window.cosmosSkeletonCards === 'function') {
    window.cosmosSkeletonCards('cx-dash-stats-grid', 4)
  }
  if (typeof window.cosmosSkeletonTable === 'function') {
    window.cosmosSkeletonTable('cx-tbody-revenue', 3, 6)
    window.cosmosSkeletonTable('cx-tbody-recent-orders', 6, 8)
  }
  try {
    var dashRes = await cxApiGet('/api/cx/dashboard')
    var d = dashRes.data || {}
    cxRebuildStatCards()
    var elCust = document.getElementById('cx-stat-customers-count')
    var elRev = document.getElementById('cx-stat-revenue')
    var elOrd = document.getElementById('cx-stat-orders-count')
    var elAvg = document.getElementById('cx-stat-avg')
    var elCwo = document.getElementById('cx-stat-cwo')
    if (typeof window.cosmosCountUp === 'function') {
      if (elCust) window.cosmosCountUp(elCust, d.total_customers || 0)
      if (elRev) window.cosmosCountUp(elRev, d.total_revenue || 0)
      if (elOrd) window.cosmosCountUp(elOrd, d.total_orders || 0)
      if (elAvg) window.cosmosCountUp(elAvg, d.avg_order_value || 0)
    } else {
      if (elCust) elCust.textContent = String(d.total_customers || 0)
      if (elRev) elRev.textContent = fmtCxRs(d.total_revenue)
      if (elOrd) elOrd.textContent = String(d.total_orders || 0)
      if (elAvg) elAvg.textContent = fmtCxRs(d.avg_order_value)
    }
    if (elCwo) elCwo.textContent = String(d.customers_with_orders || 0)

    var tbodyRev = document.getElementById('cx-tbody-revenue')
    var byStore = d.revenue_by_store || []
    if (!byStore.length && tbodyRev) {
      tbodyRev.innerHTML =
        '<tr><td colspan="3" class="empty" style="border:none">' +
        '<div class="empty-ic">\uD83C\uDFEC</div>' +
        '<div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">No store revenue yet</div>' +
        '<div style="font-size:13px;color:var(--text2)">Orders will appear here once sales are recorded in POS.</div>' +
        '</td></tr>'
    } else if (tbodyRev) {
      tbodyRev.innerHTML = byStore
        .map(function (r) {
          return (
            '<tr>' +
            '<td><div class="fw6">' +
            escCx(r.store_name) +
            '</div></td>' +
            '<td class="text-right mono">' +
            escCx(String(r.order_count)) +
            '</td>' +
            '<td class="text-right mono fw6">' +
            escCx(fmtCxRs(r.revenue)) +
            '</td>' +
            '</tr>'
          )
        })
        .join('')
    }

    await window.cxDashReloadOrdersTable()
  } catch (err) {
    var msg = err && err.message ? err.message : 'Could not load CX dashboard.'
    if (typeof window.cosmosToastError === 'function') window.cosmosToastError(msg)
    cxRebuildStatCards()
    var tbodyRev = document.getElementById('cx-tbody-revenue')
    var tbodyO = document.getElementById('cx-tbody-recent-orders')
    if (tbodyRev)
      tbodyRev.innerHTML =
        '<tr><td colspan="3" style="text-align:center;padding:18px;color:var(--red)">Could not load data.</td></tr>'
    if (tbodyO)
      tbodyO.innerHTML =
        '<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--red)">Could not load data.</td></tr>'
  }
}

window.loadCxCustomersPage = async function () {
  var mobile = cxIsMobileLayout()
  var list = document.getElementById('cx-customers-list')
  var wrap = document.getElementById('cx-customers-table-wrap')
  var tbody = document.getElementById('cx-tbody-customers')
  if (mobile && list) {
    if (wrap) wrap.style.display = 'none'
    list.style.display = 'flex'
    if (typeof window.cosmosSkeletonRows === 'function') {
      window.cosmosSkeletonRows('cx-customers-list', 8)
    } else if (list) {
      list.innerHTML = ''
    }
  } else {
    if (list) list.style.display = 'none'
    if (wrap) wrap.style.display = ''
    if (typeof window.cosmosSkeletonTable === 'function' && tbody) {
      window.cosmosSkeletonTable('cx-tbody-customers', 7, 10)
    }
  }
  try {
    var qInput = document.getElementById('cx-cust-search')
    var q = cxNormalizeSearchQuery(qInput && qInput.value ? qInput.value : '')
    var qs = q ? '?q=' + encodeURIComponent(q) + '&limit=200' : '?limit=200'
    var res = await cxApiGet('/api/cx/customers' + qs)
    var rows = res.data || []
    if (!rows.length) {
      if (mobile && list) {
        list.innerHTML = cxCustomerEmptyHtml()
      } else if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="7" style="border:none">' + cxCustomerEmptyHtml() + '</td></tr>'
      }
      return
    }
    if (mobile && list) {
      list.innerHTML = rows.map(cxRenderCustomerCard).join('')
      return
    }
    if (!tbody) return
    tbody.innerHTML = rows.map(cxRenderCustomerTableRow).join('')
  } catch (err) {
    var msg = err && err.message ? err.message : 'Could not load customers.'
    if (typeof window.cosmosToastError === 'function') window.cosmosToastError(msg)
    if (mobile && list) {
      list.innerHTML =
        '<div style="text-align:center;padding:18px;color:var(--red)">Could not load customers.</div>'
    } else if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center;padding:18px;color:var(--red)">Could not load customers.</td></tr>'
    }
  }
}

window.closeGrantMembershipModal = function () {
  var ov = document.getElementById('modal-grant-membership-overlay')
  if (ov) ov.style.display = 'none'
}

window._gmApplyPlanDefaults = function () {
  var sel = document.getElementById('gm-plan')
  if (!sel || !sel.options.length) return
  var opt = sel.options[sel.selectedIndex]
  if (!opt) return
  document.getElementById('gm-price').value = opt.dataset.price || ''
  document.getElementById('gm-days').value = opt.dataset.days || ''
}

window.openGrantMembershipModal = async function (customerId, customerName, customerPhone, homeStore) {
  customerName = customerName || ''
  customerPhone = customerPhone || ''
  homeStore = homeStore || ''
  document.getElementById('gm-customer-id').value = String(customerId)
  document.getElementById('gm-customer-name').value = customerName
  document.getElementById('gm-hero-name').textContent = customerName || 'Customer #' + customerId
  document.getElementById('gm-hero-av').textContent = cxCustomerInitials(customerName || 'C')
  var subParts = []
  if (customerPhone) subParts.push(customerPhone)
  if (homeStore) subParts.push(homeStore)
  document.getElementById('gm-hero-sub').textContent = subParts.join(' · ') || '—'
  document.getElementById('gm-hero-badges').style.display = 'none'
  document.getElementById('gm-active-plan-badge').textContent = ''
  document.getElementById('gm-active-expiry-line').textContent = ''
  document.getElementById('gm-info-banner').style.display = 'none'
  document.getElementById('gm-info-banner-text').innerHTML = ''
  document.getElementById('gm-modal-error').style.display = 'none'
  document.getElementById('gm-price').value = ''
  document.getElementById('gm-days').value = ''
  document.getElementById('gm-expires').value = ''
  var sel = document.getElementById('gm-plan')
  sel.innerHTML = ''
  sel.onchange = null
  document.getElementById('gm-current-status').innerHTML =
    '<div class="skel skel-stat" style="width:100%;max-width:none"></div>'
  document.getElementById('modal-grant-membership-overlay').style.display = 'flex'
  try {
    var plansRes = await cxApiFetch('GET', '/api/cx/plans')
    var statusRes = await cxApiFetch('GET', '/api/cx/customers/' + customerId + '/membership')
    var plans = plansRes.data || []
    var active = (statusRes.data && statusRes.data.active_membership) || null
    if (active) {
      var tierLabel = cxMembershipLabelFromActive(active)
      var expStr = fmtCxDateOnly(active.expires_at)
      var paidStr = fmtCxRs(active.price_paid)
      document.getElementById('gm-hero-badges').style.display = 'flex'
      document.getElementById('gm-active-plan-badge').textContent = tierLabel
      document.getElementById('gm-active-expiry-line').textContent = 'Expires ' + expStr
      document.getElementById('gm-info-banner').style.display = 'flex'
      document.getElementById('gm-info-banner-text').innerHTML =
        'Active membership: <strong>' +
        escCx(tierLabel) +
        '</strong> — paid ' +
        paidStr +
        '. Saving assigns a tier from Command Unit → Membership.'
      document.getElementById('gm-current-status').innerHTML = ''
    } else {
      document.getElementById('gm-current-status').innerHTML =
        '<strong>No active Eyewoot Go membership.</strong> Saving creates a new term; any previous active term is ended.'
    }
    if (!plans.length) {
      document.getElementById('gm-current-status').innerHTML =
        '<span style="color:var(--red)">No membership plans found.</span> ' +
        '<span style="display:block;margin-top:8px;font-size:13px;color:var(--text2)">' +
        'Add tiers in <strong>Command Unit → Membership</strong> or run SQL migration ' +
        '<span class="mono">62_seed_membership_plans_default.sql</span>, then reopen this screen.</span>'
      if (typeof window.cosmosToastWarn === 'function') {
        window.cosmosToastWarn('No membership plans in database. Configure tiers in Command Unit → Membership.')
      }
      return
    }
    plans.forEach(function (p) {
      var opt = document.createElement('option')
      opt.value = p.plan_key
      var tierName = p.tier_name || p.display_name || p.plan_key
      var typePart = p.membership_type ? ' · Type: ' + p.membership_type : ''
      opt.textContent =
        tierName + typePart + ' — \u20B9' + Number(p.price || 0).toLocaleString('en-IN') + ' / yr'
      opt.dataset.price = String(p.price)
      opt.dataset.days = String(p.validity_days)
      opt.dataset.tier = tierName
      sel.appendChild(opt)
    })
    window._gmApplyPlanDefaults()
    sel.onchange = function () {
      window._gmApplyPlanDefaults()
    }
  } catch (err) {
    var msg = err && err.message ? err.message : 'Could not load membership plans.'
    if (/permission denied/i.test(msg)) {
      msg =
        'Permission denied. Assign CX — Membership plans & grant (cx.membership.manage) in Command Unit → Roles, then sign out and sign in.'
    }
    document.getElementById('gm-current-status').innerHTML =
      '<span style="color:var(--red)">' + escCx(msg) + '</span>'
    if (typeof window.cosmosToastError === 'function') window.cosmosToastError(msg)
  }
}

window.saveGrantMembership = async function () {
  if (!window.cosmosCxAllows(['cx.membership.manage'])) {
    if (typeof window.cosmosToastWarn === 'function') window.cosmosToastWarn('No permission to save membership.')
    return
  }
  var errEl = document.getElementById('gm-modal-error')
  var btn = document.getElementById('gm-save-btn')
  errEl.style.display = 'none'
  var cid = document.getElementById('gm-customer-id').value
  var plan = document.getElementById('gm-plan').value
  if (!plan) {
    errEl.textContent = 'Select a membership plan.'
    errEl.style.display = 'block'
    return
  }
  var price = parseFloat(document.getElementById('gm-price').value)
  if (Number.isNaN(price) || price < 0) {
    errEl.textContent = 'Enter a valid price paid.'
    errEl.style.display = 'block'
    return
  }
  var body = { plan_key: plan, price_paid: price }
  var exp = document.getElementById('gm-expires').value.trim()
  if (exp) {
    body.expires_at = exp
  } else {
    var d = document.getElementById('gm-days').value.trim()
    if (d) {
      var nd = parseInt(d, 10)
      if (!Number.isNaN(nd) && nd > 0) body.validity_days = nd
    }
  }
  if (typeof window.cosmosBtnLoading === 'function') window.cosmosBtnLoading(btn)
  try {
    await cxApiFetch('POST', '/api/cx/customers/' + cid + '/membership', body)
    if (typeof window.cosmosBtnSuccess === 'function') window.cosmosBtnSuccess(btn)
    else if (typeof window.cosmosBtnDone === 'function') window.cosmosBtnDone(btn)
    window.closeGrantMembershipModal()
    if (typeof window.cosmosToastSuccess === 'function') window.cosmosToastSuccess('Eyewoot Go membership saved.')
    if (typeof window.loadCxCustomersPage === 'function') await window.loadCxCustomersPage()
  } catch (err) {
    if (typeof window.cosmosBtnDone === 'function') window.cosmosBtnDone(btn)
    errEl.textContent = err && err.message ? err.message : 'Save failed.'
    errEl.style.display = 'block'
  }
}

document.addEventListener('DOMContentLoaded', function () {
  ;(async function cxBoot () {
    if (typeof window.cosmosRefreshSession === 'function') {
      try {
        await window.cosmosRefreshSession()
      } catch (refreshErr) {
        if (refreshErr && (refreshErr.status === 401 || refreshErr.status === 403)) {
          if (typeof window.cosmosSignOut === 'function') window.cosmosSignOut()
          else window.location.href = '/'
          return
        }
      }
    }
    if (typeof window.cosmosLoadRbacBootstrap === 'function') {
      await window.cosmosLoadRbacBootstrap()
    }
    cxLoadUser()
    cxApplyFinePermissionsUi()
    cxApplyRouteFromPath()
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') window.cxCloseSidebar()
    })
    function cxBindCustomerPick (root, key) {
      if (!root || root.dataset[key]) return
      root.dataset[key] = '1'
      root.addEventListener('click', function (e) {
        var pick = e.target.closest('[data-cid]')
        if (!pick) return
        cxOpenCustomerFromEl(pick)
      })
    }
    cxBindCustomerPick(document.getElementById('cx-customers-table'), 'cxGrantMembershipBound')
    cxBindCustomerPick(document.getElementById('cx-customers-list'), 'cxGrantMembershipBoundList')
    if (!window._cxCustResizeBound) {
      window._cxCustResizeBound = true
      window.addEventListener('resize', function () {
        if (document.getElementById('page-customers') &&
          document.getElementById('page-customers').classList.contains('active')) {
          window.loadCxCustomersPage().catch(function () {})
        }
      })
    }
    function cxRunCustomerSearch () {
      var btn = document.getElementById('btn-cx-cust-search')
      if (btn && typeof window.cosmosBtnLoading === 'function') window.cosmosBtnLoading(btn)
      return window
        .loadCxCustomersPage()
        .then(function () {
          if (btn && typeof window.cosmosBtnDone === 'function') window.cosmosBtnDone(btn)
        })
        .catch(function () {
          if (btn && typeof window.cosmosBtnDone === 'function') window.cosmosBtnDone(btn)
        })
    }
    var btn = document.getElementById('btn-cx-cust-search')
    var inp = document.getElementById('cx-cust-search')
    var form = document.getElementById('cx-cust-search-form')
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault()
        cxRunCustomerSearch()
      })
    }
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault()
        cxRunCustomerSearch()
      })
    }
    if (inp) {
      inp.addEventListener('input', function () {
        if (typeof window.cosmosFieldClear === 'function') window.cosmosFieldClear(inp)
        clearTimeout(_cxCustSearchDebounce)
        var raw = String(inp.value || '').trim()
        var digits = raw.replace(/\D/g, '')
        if (raw.length < 2 && digits.length < 4) return
        _cxCustSearchDebounce = setTimeout(function () {
          cxRunCustomerSearch()
        }, 450)
      })
    }
    var cxDashSel = document.getElementById('cx-dash-orders-status')
    if (cxDashSel && !cxDashSel.dataset.cxDashBound) {
      cxDashSel.dataset.cxDashBound = '1'
      cxDashSel.addEventListener('change', function () {
        window.cxDashReloadOrdersTable().catch(function () {})
      })
    }
    var cxDashRef = document.getElementById('btn-cx-dash-orders-refresh')
    if (cxDashRef && !cxDashRef.dataset.cxDashBound) {
      cxDashRef.dataset.cxDashBound = '1'
      cxDashRef.addEventListener('click', function () {
        if (typeof window.cosmosBtnLoading === 'function') window.cosmosBtnLoading(cxDashRef)
        window
          .cxDashReloadOrdersTable()
          .then(function () {
            if (typeof window.cosmosBtnDone === 'function') window.cosmosBtnDone(cxDashRef)
          })
          .catch(function () {
            if (typeof window.cosmosBtnDone === 'function') window.cosmosBtnDone(cxDashRef)
          })
      })
    }
  })()
})
