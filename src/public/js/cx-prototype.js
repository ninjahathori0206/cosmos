/* ─── CX (Customer Experience) — Analytics shell ───────────────────────────── */

const CX_API_KEY = 'CHANGE_ME_API_KEY'

function getToken () {
  return sessionStorage.getItem('cosmos_token') || ''
}

async function cxApiFetch (method, path, body) {
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': CX_API_KEY,
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
  customers: '/cx/customers'
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
  customers: 'Customers'
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
}

function cxApplyRouteFromPath () {
  var pageId = cxGetPageFromPath(window.location.pathname)
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
      else if (mods.pos !== false) window.location.href = '/pos/dashboard'
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
  } catch (_) {}
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

    var ordRes = await cxApiGet('/api/cx/orders?limit=24')
    var orders = ordRes.data || []
    var tbodyO = document.getElementById('cx-tbody-recent-orders')
    if (!orders.length && tbodyO) {
      tbodyO.innerHTML =
        '<tr><td colspan="6" class="empty" style="border:none">' +
        '<div class="empty-ic">\uD83E\uDDE9</div>' +
        '<div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">No orders yet</div>' +
        '<div style="font-size:13px;color:var(--text2);margin-bottom:16px">Recent POS orders will show here.</div>' +
        '</td></tr>'
    } else if (tbodyO) {
      tbodyO.innerHTML = orders
        .map(function (o) {
          var cust =
            escCx(o.customer_name || 'Walk-in') +
            (o.customer_phone
              ? '<br><span class="xs td3">' + escCx(o.customer_phone) + '</span>'
              : '')
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
    }
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
        return (
          '<tr>' +
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

document.addEventListener('DOMContentLoaded', function () {
  cxLoadUser()
  cxApplyRouteFromPath()
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
})
