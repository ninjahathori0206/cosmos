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

function fmtCxRs (v) {
  var n = Number(v) || 0
  return (
    '\u20B9' +
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
}

function fmtCxDateTime (v) {
  if (!v) return '\u2014'
  var d = new Date(v)
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function fmtCxDateOnly (v) {
  if (!v) return '\u2014'
  var d = new Date(v)
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  })
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
  document.body.classList.remove('cx-mob-nav-open')
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
    if (typeof window.applyCosmosModuleSwitchNav === 'function') {
      window.applyCosmosModuleSwitchNav('cx-switch-module-wrap', u)
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
  if (typeof window.cosmosSkeletonTable === 'function') {
    window.cosmosSkeletonTable('cx-tbody-customers', 6, 10)
  }
  try {
    var qInput = document.getElementById('cx-cust-search')
    var q = qInput && qInput.value ? String(qInput.value).trim() : ''
    var qs = q ? '?q=' + encodeURIComponent(q) + '&limit=200' : '?limit=200'
    var res = await cxApiGet('/api/cx/customers' + qs)
    var rows = res.data || []
    var tbody = document.getElementById('cx-tbody-customers')
    if (!tbody) return
    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="border:none">' +
        '<div class="empty">' +
        '<div class="empty-ic">\uD83D\uDC65</div>' +
        '<div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">No customers found</div>' +
        '<div style="font-size:13px;color:var(--text2);margin-bottom:16px">Adjust search or register customers from POS.</div>' +
        '</div></td></tr>'
      return
    }
    tbody.innerHTML = rows
      .map(function (r) {
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
          '<td class="td3" style="font-size:12px">' +
          fmtCxDateOnly(r.last_order_at) +
          '</td>' +
          '</tr>'
        )
      })
      .join('')
  } catch (err) {
    var msg = err && err.message ? err.message : 'Could not load customers.'
    if (typeof window.cosmosToastError === 'function') window.cosmosToastError(msg)
    var tbody = document.getElementById('cx-tbody-customers')
    if (tbody)
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--red)">Could not load customers.</td></tr>'
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
      var planLabel = escCx(active.plan_display_name || active.plan_key)
      var expStr = fmtCxDateOnly(active.expires_at)
      var paidStr = fmtCxRs(active.price_paid)
      document.getElementById('gm-hero-badges').style.display = 'flex'
      document.getElementById('gm-active-plan-badge').textContent = planLabel
      document.getElementById('gm-active-expiry-line').textContent = 'Expires ' + expStr
      document.getElementById('gm-info-banner').style.display = 'flex'
      document.getElementById('gm-info-banner-text').innerHTML =
        'Active plan: <strong>' +
        planLabel +
        '</strong> — paid ' +
        paidStr +
        '. Saving now will renew or override the current plan.'
      document.getElementById('gm-current-status').innerHTML = ''
    } else {
      document.getElementById('gm-current-status').innerHTML =
        '<strong>No active Eyewoot Go membership.</strong> Saving creates a new term; any previous active term is ended.'
    }
    if (!plans.length) {
      document.getElementById('gm-current-status').innerHTML =
        '<span style="color:var(--red)">No active membership plans in the database.</span>'
      return
    }
    plans.forEach(function (p) {
      var opt = document.createElement('option')
      opt.value = p.plan_key
      opt.textContent = p.display_name + ' (' + p.plan_key + ')'
      opt.dataset.price = String(p.price)
      opt.dataset.days = String(p.validity_days)
      sel.appendChild(opt)
    })
    window._gmApplyPlanDefaults()
    sel.onchange = function () {
      window._gmApplyPlanDefaults()
    }
  } catch (err) {
    var msg = err && err.message ? err.message : 'Could not load.'
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
    if (typeof window.cosmosLoadRbacBootstrap === 'function') {
      await window.cosmosLoadRbacBootstrap()
    }
    cxLoadUser()
    cxApplyRouteFromPath()
    var cxTbl = document.getElementById('cx-customers-table')
    if (cxTbl && !cxTbl.dataset.cxGrantMembershipBound) {
      cxTbl.dataset.cxGrantMembershipBound = '1'
      cxTbl.addEventListener('click', function (e) {
        var tr = e.target.closest('tbody tr[data-cid]')
        if (!tr) return
        var idStr = tr.getAttribute('data-cid')
        if (!idStr) return
        var id = parseInt(idStr, 10)
        if (!id) return
        if (!window.cosmosCxAllows(['cx.membership.manage'])) {
          if (typeof window.cosmosToastWarn === 'function') {
            window.cosmosToastWarn('No permission to manage membership. Ask an admin for CX — Membership plans & grant.')
          }
          return
        }
        var name = ''
        var phone = ''
        var store = ''
        try {
          name = decodeURIComponent(tr.getAttribute('data-cname') || '')
        } catch (e2) {
          name = ''
        }
        try {
          phone = decodeURIComponent(tr.getAttribute('data-cphone') || '')
        } catch (e3) {
          phone = ''
        }
        try {
          store = decodeURIComponent(tr.getAttribute('data-cstore') || '')
        } catch (e4) {
          store = ''
        }
        if (typeof window.openGrantMembershipModal === 'function') {
          window.openGrantMembershipModal(id, name, phone, store)
        }
      })
    }
    var btn = document.getElementById('btn-cx-cust-search')
    var inp = document.getElementById('cx-cust-search')
    if (btn) {
      btn.addEventListener('click', function () {
        if (typeof window.cosmosBtnLoading === 'function') window.cosmosBtnLoading(btn)
        window
          .loadCxCustomersPage()
          .then(function () {
            if (typeof window.cosmosBtnDone === 'function') window.cosmosBtnDone(btn)
          })
          .catch(function () {
            if (typeof window.cosmosBtnDone === 'function') window.cosmosBtnDone(btn)
          })
      })
    }
    if (inp) {
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') btn && btn.click()
      })
      inp.addEventListener('input', function () {
        if (typeof window.cosmosFieldClear === 'function') window.cosmosFieldClear(inp)
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
