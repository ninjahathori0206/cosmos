/* ─── Store Pilot — Store Manager module ─────────────────────────────────────── */

// ── Mobile sidebar toggle ──────────────────────────────────────────────────────
function openSidebar() {
  document.querySelector('.sidebar').classList.add('open');
  document.getElementById('sp-sidebar-overlay').classList.add('open');
  if (window.cosmosLockAppBodyScroll) window.cosmosLockAppBodyScroll();
  else document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('sp-sidebar-overlay').classList.remove('open');
  if (window.cosmosLockAppBodyScroll) window.cosmosLockAppBodyScroll();
  else document.body.style.overflow = '';
}

function getToken() {
  return sessionStorage.getItem('cosmos_token') || '';
}

async function apiFetch(method, path, body) {
  let apiKey;
  try {
    apiKey = typeof window.cosmosEnsureApiKey === 'function'
      ? await window.cosmosEnsureApiKey()
      : '';
  } catch (e) {
    throw new Error(e.message || 'Invalid or missing API key');
  }
  if (!apiKey) throw new Error('Invalid or missing API key');
  const headers = {
    'Content-Type':  'application/json',
    'X-API-Key':     apiKey,
    'Authorization': 'Bearer ' + getToken()
  };
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data;
  try { data = await res.json(); } catch (_) { data = {}; }
  if (!res.ok) {
    const msg = (data && (data.message || (data.errors && data.errors.join(', ')))) || ('HTTP ' + res.status);
    throw new Error(msg);
  }
  return data;
}

const apiGet  = (p)    => apiFetch('GET',  p);
const apiPost = (p, b) => apiFetch('POST', p, b);
const apiPut  = (p, b) => apiFetch('PUT',  p, b);

// ── Utilities ──────────────────────────────────────────────────────────────────
function escHtml(s) {
  if (!s && s !== 0) return '—';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function istToday() {
  const [d, m, y] = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).split('/');
  return `${y}-${m}-${d}`;
}

function fmtDate(v) {
  if (typeof window.cosmosFmtDate === 'function') return window.cosmosFmtDate(v);
  if (!v) return '—';
  return String(v);
}

function fmtDateTime(v) {
  if (typeof window.cosmosFmtDateTime === 'function') return window.cosmosFmtDateTime(v);
  if (!v) return '—';
  return String(v);
}

function showErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

function isStockAvailable(row, qtyKeys = []) {
  if (!row || typeof row !== 'object') return false
  if (typeof row.is_available === 'boolean') return row.is_available
  const availability = String(row.availability || '').toUpperCase()
  if (availability === 'AVAILABLE') return true
  if (availability === 'NOT_AVAILABLE') return false
  return qtyKeys.some((key) => Number(row[key]) > 0)
}

// ── Module state ───────────────────────────────────────────────────────────────
let _storeId         = null;
let _storeName       = null;
let _fStockDebounce  = null;
let _bcDebounce      = null;
let _scDebounce      = null;
let _dashTimer       = null;
let _tcDebounce      = null;
let _tcSearchSeq     = 0;
const _tcSearchCache = Object.create(null);
let _transferCart    = [];
let _spPermissions   = [];
let _spNoAccess      = false;
let _warehouseDisplayName = 'Warehouse';

function primaryWarehouseLabel() {
  return _warehouseDisplayName || 'Warehouse';
}

function primaryWarehouseLabelHtml() {
  return String(primaryWarehouseLabel())
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function primaryWarehouseTitleAttr() {
  return String(primaryWarehouseLabel())
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

async function refreshWarehouseContext() {
  try {
    const wh = await apiGet('/api/foundry-lookups/warehouse-context');
    if (wh && wh.data && typeof wh.data.warehouse_display_name === 'string') {
      const t = wh.data.warehouse_display_name.trim();
      if (t) _warehouseDisplayName = t;
    }
  } catch (_) {}
}

const SP_MENU_PERM_MAP = {
  dashboard: ['storepilot.dashboard.view'],
  'stock-browse': ['storepilot.catalogue.view', 'foundry.catalogue.view'],
  'store-catalogue': ['storepilot.catalogue.view', 'foundry.catalogue.view'],
  'transfers-create': ['storepilot.transfers.create', 'foundry.transfers.create'],
  'transfers-history': ['storepilot.transfers.view', 'foundry.transfers.view'],
  reports: ['storepilot.reports.view'],
  invoices: ['storepilot.invoices.view'],
  collections: ['storepilot.collections.view']
};

// ── Breadcrumb map ─────────────────────────────────────────────────────────────
const spBcMap = {
  dashboard:              'Dashboard',
  'stock-browse':         'Stock View — Browse Catalogue',
  'store-catalogue':      'Stock View — Store Catalogue',
  'transfers-history':    'Foundry Connect — My Requests',
  'transfers-create':     'Foundry Connect — Request Goods',
  reports:                'Store Reports',
  'lab-orders':           'Lab Orders',
  invoices:               'Invoices',
  collections:            'Collection Book'
};

const spBcShortMap = {
  dashboard:              'Dashboard',
  'stock-browse':         'Browse Catalogue',
  'store-catalogue':      'Store Catalogue',
  'transfers-history':    'My Requests',
  'transfers-create':     'Request Goods',
  reports:                'Store Reports',
  'lab-orders':           'Lab Orders',
  invoices:               'Invoices',
  collections:            'Collection Book'
};

function spIsMobileChrome() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function spSetBreadcrumb(pageId) {
  const bc = document.getElementById('sp-bc');
  if (!bc) return;
  const full = spBcMap[pageId] || pageId;
  const short = spBcShortMap[pageId] || full;
  bc.textContent = spIsMobileChrome() ? short : full;
}

function spSyncTopbarMeta(pageId) {
  const lastEl = document.getElementById('dash-last-updated');
  if (!lastEl) return;
  if (pageId === 'dashboard') {
    lastEl.hidden = false;
    return;
  }
  lastEl.textContent = '';
  lastEl.hidden = true;
}

const SP_PAGE_PATHS = {
  dashboard: '/storepilot/dashboard',
  'stock-browse': '/storepilot/stock-browse',
  'store-catalogue': '/storepilot/store-catalogue',
  'transfers-history': '/storepilot/transfers-history',
  'transfers-create': '/storepilot/transfers-create',
  reports: '/storepilot/reports',
  'lab-orders': '/storepilot/lab-orders',
  invoices: '/storepilot/invoices',
  collections: '/storepilot/collections'
};

let _spOpenCreateRequestOnLoad = false;

function getStorepilotPageFromPath(pathname) {
  const normalized = String(pathname || '').replace(/\/+$/, '') || '/storepilot';
  if (normalized === '/storepilot/incoming-transfers' || normalized === '/storepilot/movement-list') {
    return 'transfers-history';
  }
  if (normalized === SP_PAGE_PATHS['transfers-create']) {
    _spOpenCreateRequestOnLoad = true;
    return 'transfers-history';
  }
  const exact = Object.entries(SP_PAGE_PATHS).find(([pageId, route]) => route === normalized && pageId !== 'transfers-create');
  if (exact) return exact[0];
  if (normalized === '/storepilot') return 'dashboard';
  return 'dashboard';
}

function spHydrateUserFromSession() {
  try {
    const stored = sessionStorage.getItem('cosmos_user');
    if (!stored) return;
    const u = JSON.parse(stored);
    _spPermissions = Array.isArray(u.permissions) ? u.permissions.map((x) => String(x).toLowerCase()) : [];
    _storeId   = u.store_id   || null;
    _storeName = u.store_name || null;
  } catch (_) {}
}

function spPrimeTransfersHistoryPage() {
  document.querySelectorAll('.main .page').forEach((p) => p.classList.remove('active'));
  const page = document.getElementById('page-transfers-history');
  if (page) page.classList.add('active');
  document.querySelectorAll('.sidebar-nav .nav-item').forEach((n) => n.classList.remove('active'));
  const navEl = getStorepilotNavEl('transfers-history');
  if (navEl) navEl.classList.add('active');
  document.body.setAttribute('data-sp-page', 'transfers-history');
  spSetBreadcrumb('transfers-history');
  spSyncTopbarMeta('transfers-history');
  spSyncCreateRequestBtn();
  if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('tr-history-wrap', 6);
}

function canSpCreateTransferRequest() {
  return hasAnyPermission(['storepilot.transfers.create', 'foundry.transfers.create']);
}

function spSyncCreateRequestBtn() {
  const btn = document.getElementById('sp-tr-create-btn');
  if (!btn) return;
  if (canSpCreateTransferRequest()) {
    btn.style.display = '';
    btn.removeAttribute('hidden');
    btn.disabled = false;
  } else {
    btn.style.display = 'none';
    btn.setAttribute('hidden', '');
  }
}

function getStorepilotNavEl(id) {
  return document.querySelector(`.sidebar-nav .nav-item[onclick*="spNav('${id}'"]`) || null;
}

// ── Navigation ─────────────────────────────────────────────────────────────────
window.spNav = function (id, el, options) {
  const navOptions = options || {};
  if (_spNoAccess) return;
  if (id === 'transfers-create') {
    const histEl = getStorepilotNavEl('transfers-history');
    window.spNav('transfers-history', histEl || el, navOptions);
    if (canSpCreateTransferRequest()) window.openSpCreateRequestModal();
    return;
  }
  if (!canAccessSpView(id)) {
    renderNoAccessState('menu_access_denied');
    return;
  }
  document.querySelectorAll('.main .page').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav .nav-item').forEach((n) => n.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  if (el) el.classList.add('active');
  document.body.setAttribute('data-sp-page', id);
  spSetBreadcrumb(id);
  spSyncTopbarMeta(id);
  const nextPath = SP_PAGE_PATHS[id] || '/storepilot/dashboard';
  if (!navOptions.fromHistory && window.location.pathname !== nextPath) {
    window.history.pushState({ module: 'storepilot', page: id }, '', nextPath);
  }
  closeSidebar();
  loadStorePilotPage(id);
  if (window.cosmosResetAppScroll) window.cosmosResetAppScroll();
};

function applyStorepilotRouteFromPath() {
  const pageId = getStorepilotPageFromPath(window.location.pathname);
  window.spNav(pageId, getStorepilotNavEl(pageId), { fromHistory: true });
}

window.addEventListener('popstate', () => {
  applyStorepilotRouteFromPath();
});

function loadStorePilotPage(id) {
  if (id === 'dashboard')          loadDashboard();
  if (id === 'stock-browse')       window.loadBrowseCatalogue();
  if (id === 'store-catalogue')    window.loadStoreCatalogue();
  if (id === 'transfers-history') {
    spSyncCreateRequestBtn();
    window.loadTransferHistory();
    if (_spOpenCreateRequestOnLoad && canSpCreateTransferRequest()) {
      _spOpenCreateRequestOnLoad = false;
      setTimeout(function () { window.openSpCreateRequestModal(); }, 0);
    }
  }
  if (id === 'reports')            loadReports();
  if (id === 'lab-orders')         loadSpLabOrders();
  if (id === 'invoices')           loadSpInvoices();
  if (id === 'collections' && typeof window.loadStoreCollections === 'function') loadStoreCollections('storepilot');
}

/** '' = all lab workflow statuses for this store (no lab_status API filter). */
let _spLabStatusFilter = ''
const SP_LAB_STATUS_LABELS = {
  ORDER_PLACED:        'Order Placed',
  ADVANCE_PAID:        'Accepted',
  LAB_FITTING:         'Fitting & Edging',
  QC_PASS:             'QC Pass',
  QC_FAIL_LAB:         'QC Fail',
  SENT_TO_LAB:         'Sent To Lab',
  DISPATCHED_TO_STORE: 'Dispatched To Store',
  RECEIVED_AT_STORE:   'Received At Store',
  STORE_QC_PASS:       'Store QC Passed',
  STORE_QC_PARTIAL:    'QC Partial (Minor Defect)',
  QC_FAIL_STORE:       'Store QC Failed',
  READY_FOR_DELIVERY:  'Ready For Handover'
}

// Statuses where a mandatory note must be entered before the transition is submitted.
const SP_LAB_STATUS_NOTE_REQUIRED = new Set(['STORE_QC_PARTIAL', 'QC_FAIL_STORE'])

// StorePilot handles early store chain: ORDER_PLACED → Accepted (ADVANCE_PAID) → SENT_TO_LAB, plus dispatch onward.
// Stages 16–18 (DELIVERED→BALANCE_COLLECTED→INVOICED) are auto-completed by Store OS on payment.
const SP_LAB_STATUS_NEXT = {
  ORDER_PLACED:        ['ADVANCE_PAID'],
  ADVANCE_PAID:        ['SENT_TO_LAB'],
  DISPATCHED_TO_STORE: ['RECEIVED_AT_STORE'],
  RECEIVED_AT_STORE:   ['STORE_QC_PASS', 'STORE_QC_PARTIAL', 'QC_FAIL_STORE'],
  STORE_QC_PASS:       ['READY_FOR_DELIVERY'],
  STORE_QC_PARTIAL:    ['READY_FOR_DELIVERY']
}

function spLabStatusLabel(status) {
  return SP_LAB_STATUS_LABELS[status] || String(status || '').replace(/_/g, ' ')
}

function spJobsFromOrderRow(r) {
  const ls = Array.isArray(r.lab_sub_orders) ? r.lab_sub_orders : []
  if (ls.length) {
    return ls.map(function (s) {
      return {
        sub_order_id: s.sub_order_id,
        lab_workflow_status: s.lab_workflow_status,
        sub_order_label: s.sub_order_label || r.order_no || ''
      }
    })
  }
  const sid = Number(r.sub_order_id) || 0
  if (!sid) return []
  return [{
    sub_order_id: sid,
    lab_workflow_status: r.lab_workflow_status,
    sub_order_label: r.order_no || ('#' + sid)
  }]
}

function spEscapeHtml(raw) {
  return String(raw || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
}

/** Actions for one lab sub-job (distinct element ids per sub_order_id). */
function renderSpLabJobActions(orderRow, job, canMutate) {
  const jid = Number(job.sub_order_id) || 0
  const curr = job.lab_workflow_status
  const uid = `${orderRow.order_id}-${jid}`
  const next = SP_LAB_STATUS_NEXT[curr] || []

  if (!jid) return '<span class="muted">No LAB line id</span>'

  if (curr === 'READY_FOR_DELIVERY') {
    return '<span class="muted" style="font-size:12px">Handover applies to the bill (button above).</span>'
  }
  let actionHtml = '<span class="muted">No action</span>'

  if (next.length === 1) {
    const s = next[0]
    const needsNote = SP_LAB_STATUS_NOTE_REQUIRED.has(s)
    const handler = needsNote
      ? `openSpQcNoteModal(${orderRow.order_id}, ${jid}, '${s}')`
      : `updateSpLabStatus(${orderRow.order_id}, ${jid}, '${s}')`
    actionHtml = canMutate
      ? `<button class="btn sm" id="sp-lab-btn-${uid}" onclick="${handler}">${spLabStatusLabel(s)}</button>`
      : '<span class="muted">View only</span>'
  } else if (next.length > 1) {
    const opts = next.map((s) => `<option value="${s}">${spLabStatusLabel(s)}</option>`).join('')
    actionHtml = canMutate
      ? `
          <div style="display:flex;gap:6px;align-items:center">
            <select id="sp-lab-next-${uid}" style="min-width:185px">${opts}</select>
            <button class="btn sm" id="sp-lab-btn-${uid}" onclick="updateSpLabStatusFromSelect(${orderRow.order_id}, ${jid})">Update</button>
          </div>
        `
      : '<span class="muted">View only</span>'
  }
  return actionHtml
}

window.setSpLabFilter = function (status, tabEl) {
  _spLabStatusFilter = status === undefined || status === null || status === '' ? '' : String(status)
  document.querySelectorAll('#page-lab-orders .tab').forEach((el) => el.classList.remove('active'))
  if (tabEl) tabEl.classList.add('active')
  window.loadSpLabOrders()
}

window.loadSpLabOrders = async function () {
  if (typeof window.closeSpQcNoteModal === 'function') window.closeSpQcNoteModal()
  const tbody = document.getElementById('sp-lab-orders-tbody')
  const searchEl = document.getElementById('sp-lab-search')
  if (!tbody) return
  if (typeof cosmosSkeletonTable === 'function') cosmosSkeletonTable('sp-lab-orders-tbody', 6)
  try {
    const qs = new URLSearchParams()
    qs.set('kind', 'LAB')
    qs.set('scope', 'store')
    qs.set('limit', '120')
    if (_spLabStatusFilter) qs.set('lab_status', _spLabStatusFilter)
    const q = searchEl && searchEl.value ? searchEl.value.trim() : ''
    if (q) qs.set('search', q)
    const resp = await apiGet('/api/orders?' + qs.toString())
    const rows = (resp && resp.data) ? resp.data : []
    const canMutate = canStorePilotManageLab()
    if (!rows.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty">
              <div class="empty-ic">🧪</div>
              <div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">No lab orders in this status</div>
              <div style="font-size:13px;color:var(--text2)">Try the <strong>All</strong> tab to see lab orders still at HQ, or another status. You can also search by order number.</div>
            </div>
          </td>
        </tr>
      `
      return
    }
    tbody.innerHTML = rows.map((r) => {
      const jobs = spJobsFromOrderRow(r)
      const statusShown = jobs.map((j) => spLabStatusLabel(j.lab_workflow_status)).filter(Boolean).join(' · ')
      const hasReady = jobs.some((j) => j.lab_workflow_status === 'READY_FOR_DELIVERY')
      const pendingInstant = spPendingInstantSubs(r)
      let blocks = []
      if (pendingInstant.length && canMutate) {
        pendingInstant.forEach((inst) => {
          const sid = Number(inst.sub_order_id) || 0
          const lbl = spEscapeHtml(inst.sub_order_label || ('#' + sid))
          blocks.push(`
          <div style="margin-bottom:8px">
            <button type="button" class="btn sm" style="border-color:var(--gold);color:var(--gold)" onclick="submitSpInstantSubHandover(${r.order_id}, ${sid})">Hand over frame · ${lbl}</button>
          </div>`)
        })
        blocks.push('<div class="muted" style="font-size:11px;margin-bottom:8px">Then use bill handover for lenses.</div>')
      }
      if (hasReady && canMutate && !pendingInstant.length) {
        blocks.push(`
          <div style="margin-bottom:8px">
            <button type="button" class="btn sm primary" id="sp-lab-btn-${r.order_id}-handover" onclick="openSpHandoverModal(${r.order_id})">🤝 Handover</button>
          </div>`)
      }
      blocks = blocks.concat(jobs.map((job) => {
        const jid = Number(job.sub_order_id) || 0
        return `
        <div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border)">
          <div class="muted" style="font-size:11px;margin-bottom:4px">${spEscapeHtml(job.sub_order_label)} · #${jid}</div>
          ${renderSpLabJobActions(r, job, canMutate)}
        </div>`
      }))
      const actionHtml = blocks.join('')
      const statusBadge = statusShown || spLabStatusLabel(r.lab_workflow_status)
      return `
        <tr>
          <td class="mono">
            <div>${r.order_no || ''}</div>
            <button type="button" onclick="window.cosmosTimelineOpen(${r.order_id},'${r.order_no || ''}')" style="background:none;border:none;color:var(--acc2);font-size:11px;cursor:pointer;padding:0;margin-top:2px;text-decoration:underline">📋 Timeline</button>
          </td>
          <td>${r.customer_name || 'Walk-in'}${r.customer_phone ? `<div class="muted" style="font-size:12px">${r.customer_phone}</div>` : ''}</td>
          <td><span class="badge blue">${statusBadge}</span></td>
          <td>₹${Number(r.total_amount || 0).toFixed(2)}</td>
          <td class="muted" style="font-size:12px">${new Date(r.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</td>
          <td>${actionHtml}</td>
        </tr>
      `
    }).join('')
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">Failed to load lab orders.</td></tr>'
    if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
  }
}

window.updateSpLabStatusFromSelect = function (orderId, subOrderId) {
  const uid = `${orderId}-${subOrderId}`
  const sel = document.getElementById(`sp-lab-next-${uid}`)
  if (!sel || !sel.value) return
  if (SP_LAB_STATUS_NOTE_REQUIRED.has(sel.value)) {
    window.openSpQcNoteModal(orderId, subOrderId, sel.value)
  } else {
    window.updateSpLabStatus(orderId, subOrderId, sel.value)
  }
}

window.updateSpLabStatus = async function (orderId, subOrderId, nextStatus, note) {
  if (!subOrderId || !nextStatus) return
  if (!canStorePilotManageLab()) {
    if (typeof cosmosToastWarn === 'function') {
      cosmosToastWarn('No permission to update lab workflow — assign StorePilot · Lab Orders — Manage for this role.')
    }
    return
  }
  const uid = `${orderId}-${subOrderId}`
  const btn = document.getElementById(`sp-lab-btn-${uid}`)
  if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn)
  try {
    const body = { sub_order_id: Number(subOrderId), to_status: nextStatus }
    if (note) body.note = note
    await apiPost(`/api/orders/${orderId}/lab-status`, body)
    if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn)
    if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Lab status updated')
    window.loadSpLabOrders()
  } catch (err) {
    if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn)
    if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
  }
}

// ── QC Note Modal ──────────────────────────────────────────────────────────
let _spQcNoteCtx = null

window.openSpQcNoteModal = function (orderId, subOrderId, toStatus) {
  if (!canStorePilotManageLab()) {
    if (typeof cosmosToastWarn === 'function') {
      cosmosToastWarn('No permission to update lab workflow — assign StorePilot · Lab Orders — Manage for this role.')
    }
    return
  }
  _spQcNoteCtx = { orderId, subOrderId, toStatus }
  const overlay = document.getElementById('overlay-sp-qc-note')
  const titleEl = document.getElementById('sp-qc-note-modal-title')
  const descEl  = document.getElementById('sp-qc-note-modal-desc')
  const input   = document.getElementById('sp-qc-note-input')
  const errEl   = document.getElementById('sp-qc-note-err')
  if (!overlay) return

  const isPartial = toStatus === 'STORE_QC_PARTIAL'
  titleEl.textContent = isPartial ? 'QC Partial — Describe Defect' : 'QC Fail — Reason Required'
  descEl.textContent  = isPartial
    ? 'Order has a minor defect but will be handed over to the customer. Note is mandatory and will be saved on the order.'
    : 'Order failed QC and will be sent back to Foundry for remake. Clearly describe the defect.'
  input.value = ''
  errEl.style.display = 'none'
  overlay.classList.add('open')
  setTimeout(() => input.focus(), 120)
}

window.closeSpQcNoteModal = function () {
  const overlay = document.getElementById('overlay-sp-qc-note')
  if (overlay) overlay.classList.remove('open')
  _spQcNoteCtx = null
}

window.confirmSpQcNote = async function () {
  if (!_spQcNoteCtx) return
  const input  = document.getElementById('sp-qc-note-input')
  const errEl  = document.getElementById('sp-qc-note-err')
  const btn    = document.getElementById('sp-qc-note-confirm-btn')
  const note   = (input && input.value || '').trim()
  if (!note) {
    if (errEl) { errEl.textContent = 'Note is required.'; errEl.style.display = 'block' }
    if (input && typeof cosmosFieldError === 'function') cosmosFieldError(input, 'Required')
    return
  }
  if (errEl) errEl.style.display = 'none'
  const { orderId, subOrderId, toStatus } = _spQcNoteCtx
  window.closeSpQcNoteModal()
  await window.updateSpLabStatus(orderId, subOrderId, toStatus, note)
}

// ── Handover Modal ─────────────────────────────────────────────────────────
let _spHandoverCtx = null

window.submitSpInstantSubHandover = async function (orderId, subOrderId) {
  if (!canStorePilotManageLab()) {
    if (typeof cosmosToastWarn === 'function') {
      cosmosToastWarn('No permission for handover — assign Lab Orders — Manage or POS — Lab workflow.')
    }
    return
  }
  try {
    const res = await apiPost('/api/orders/' + orderId + '/instant-sub-handover', { sub_order_id: Number(subOrderId) })
    const inv = res.data && res.data.invoice_no
    if (typeof cosmosToastSuccess === 'function') {
      cosmosToastSuccess(inv ? 'Frame handed over. Invoice: ' + inv : 'Frame handed over.')
    }
    window.loadSpLabOrders()
  } catch (err) {
    if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
  }
}

window.openSpHandoverModal = async function (orderId) {
  if (!canStorePilotManageLab()) {
    if (typeof cosmosToastWarn === 'function') {
      cosmosToastWarn('No permission for lab handover — assign Lab Orders — Manage or POS — Lab workflow.')
    }
    return
  }
  const overlay = document.getElementById('overlay-sp-handover')
  const body    = document.getElementById('sp-handover-modal-body')
  if (!overlay || !body) return
  body.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text2)">Loading order details…</div>'
  overlay.style.display = 'flex'
  overlay.classList.add('open')
  try {
    const resp = await apiGet('/api/orders/' + orderId)
    const order   = resp.data.order
    const summary = resp.data.payment_summary
    const handoverUi = resp.data.handover_ui || {}
    if (handoverUi.pending_instant_sub_orders && handoverUi.pending_instant_sub_orders.length) {
      const labels = handoverUi.pending_instant_sub_orders.map((s) => s.sub_order_label).join(', ')
      body.innerHTML = `
        <div style="padding:16px;color:var(--text1)">
          <div class="badge gold" style="width:fit-content;margin-bottom:10px">Frame first</div>
          <p style="font-size:14px;margin:0 0 12px">Hand over the frame line(s) <strong>${spEscapeHtml(labels)}</strong> from the lab orders list, then open bill handover again.</p>
          <button class="btn" onclick="closeSpHandoverModal()">Close</button>
        </div>`
      return
    }
    const balanceDue = Math.max(0, Number(summary && summary.amount_remaining || 0))
    const total      = Number(order.total_amount || 0)
    const orderNo    = order.order_no || ('#' + orderId)
    _spHandoverCtx   = { orderId, orderNo, balanceDue, customerId: order.customer_id, customerPhone: order.customer_phone || '' }

    const fmtRs = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    if (balanceDue < 0.01) {
      // Fully paid — just mark as delivered
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="badge green" style="width:fit-content">✓ Fully Paid at POS</div>
          <div style="font-size:14px;color:var(--text1)">
            Order <strong>${orderNo}</strong> — Total ${fmtRs(total)}<br>
            <span style="font-size:12px;color:var(--text2)">No balance due. Click Confirm to mark as <strong>Delivered</strong> and generate invoice.</span>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
            <button class="btn" onclick="closeSpHandoverModal()">Cancel</button>
            <button class="btn primary" id="btn-sp-handover-confirm" onclick="submitSpHandover(false)">✓ Confirm Handover</button>
          </div>
        </div>
      `
    } else {
      // Balance due — show payment form
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div style="font-size:14px;color:var(--text1)">
            Order <strong>${orderNo}</strong> — Total ${fmtRs(total)}
          </div>
          <div style="background:var(--goldL);border-radius:8px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:13px;font-weight:600;color:var(--gold)">Balance Due</span>
            <span style="font-size:20px;font-weight:800;color:var(--text1)">${fmtRs(balanceDue)}</span>
          </div>
          <div>
            <div class="field-label" style="margin-bottom:6px">Payment Method</div>
            <div style="display:flex;gap:8px">
              <button type="button" class="sp-pay-method-btn active" id="sp-pay-m-UPI" onclick="setSpPayMethod('UPI')">⬡ UPI</button>
              <button type="button" class="sp-pay-method-btn" id="sp-pay-m-CARD" onclick="setSpPayMethod('CARD')">▣ Card</button>
              <button type="button" class="sp-pay-method-btn" id="sp-pay-m-CASH" onclick="setSpPayMethod('CASH')">₹ Cash</button>
            </div>
          </div>
          <div id="sp-handover-cash-wrap" style="display:none">
            <label class="field-label" for="sp-handover-tendered">Tendered (cash)</label>
            <input id="sp-handover-tendered" type="number" inputmode="decimal" min="0" placeholder="Amount received" style="width:100%">
            <div id="sp-handover-change" style="font-size:12px;color:var(--green);font-weight:600;margin-top:4px;display:none"></div>
          </div>
          <div id="sp-handover-card-wrap" style="display:none">
            <label class="field-label" for="sp-handover-card-ref">Approval code / Last 4 <span style="color:var(--text3)">(optional)</span></label>
            <input id="sp-handover-card-ref" type="text" placeholder="e.g. 123456" style="width:100%">
          </div>
          <div id="sp-handover-err" class="form-error" style="display:none"></div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
            <button class="btn" onclick="closeSpHandoverModal()">Cancel</button>
            <button class="btn primary" id="btn-sp-handover-confirm" onclick="submitSpHandover(true)">Collect ${fmtRs(balanceDue)} &amp; Hand Over</button>
          </div>
        </div>
      `
      // Cash change listener
      const tEl = document.getElementById('sp-handover-tendered')
      if (tEl) {
        tEl.addEventListener('input', function () {
          const t = Number(this.value) || 0
          const chEl = document.getElementById('sp-handover-change')
          if (chEl) {
            if (t >= balanceDue) { chEl.textContent = 'Change: ' + fmtRs(t - balanceDue); chEl.style.display = '' }
            else chEl.style.display = 'none'
          }
        })
      }
      // Default to UPI selected
      setSpPayMethod('UPI')
    }
  } catch (err) {
    body.innerHTML = '<div style="color:var(--red);padding:16px">' + (err.message || 'Failed to load order.') + '</div>'
    if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
  }
}

window.setSpPayMethod = function (method) {
  ;['UPI', 'CARD', 'CASH'].forEach((m) => {
    const btn = document.getElementById('sp-pay-m-' + m)
    if (btn) btn.classList.toggle('active', m === method)
  })
  const cashWrap = document.getElementById('sp-handover-cash-wrap')
  const cardWrap = document.getElementById('sp-handover-card-wrap')
  if (cashWrap) cashWrap.style.display = method === 'CASH' ? '' : 'none'
  if (cardWrap) cardWrap.style.display = method === 'CARD' ? '' : 'none'
  if (_spHandoverCtx) _spHandoverCtx.method = method
}

window.closeSpHandoverModal = function () {
  const overlay = document.getElementById('overlay-sp-handover')
  if (overlay) { overlay.classList.remove('open'); setTimeout(() => { overlay.style.display = 'none' }, 200) }
  _spHandoverCtx = null
}

window.submitSpHandover = async function (hasBalance) {
  if (!_spHandoverCtx) return
  if (!canStorePilotManageLab()) {
    if (typeof cosmosToastWarn === 'function') {
      cosmosToastWarn('No permission for lab handover — assign StorePilot · Lab Orders — Manage for this role.')
    }
    return
  }
  const btn = document.getElementById('btn-sp-handover-confirm')
  const errEl = document.getElementById('sp-handover-err')
  if (errEl) errEl.style.display = 'none'
  const { orderId, balanceDue } = _spHandoverCtx

  let body = { order_id: orderId }

  if (hasBalance) {
    const method = _spHandoverCtx.method || 'UPI'
    const tEl = document.getElementById('sp-handover-tendered')
    const refEl = document.getElementById('sp-handover-card-ref')
    const tendered = tEl && tEl.value ? Number(tEl.value) : null

    if (method === 'CASH' && (tendered == null || tendered < balanceDue)) {
      if (errEl) { errEl.textContent = 'Tendered amount must be ≥ balance due (' + '₹' + balanceDue.toFixed(2) + ').'; errEl.style.display = 'block' }
      return
    }
    body.amount = balanceDue
    body.method = method
    if (method === 'CASH' && tendered) body.tendered = tendered
    if (method === 'CARD' && refEl && refEl.value.trim()) body.external_ref = refEl.value.trim()
  }

  if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn)
  try {
    const res = await apiPost('/api/orders/' + orderId + '/handover', body)
    const invNo = res.data && res.data.invoice_no
    if (!invNo) {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn)
      const msg = 'Handover did not complete — hand over the frame line first on MIXED orders, then retry.'
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block' }
      if (typeof cosmosToastError === 'function') cosmosToastError(msg)
      return
    }
    if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn)
    window.closeSpHandoverModal()
    const invMsg = invNo ? ' Invoice: ' + invNo + '.' : ''
    if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Order handed over successfully.' + invMsg)
    // Placeholder: receipt channels not connected yet — just show info
    if (typeof cosmosToastInfo === 'function') cosmosToastInfo('Receipt channels (WhatsApp / Email / SMS / Print) will be connected in the next phase.')
    window.loadSpLabOrders()
  } catch (err) {
    if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn)
    if (errEl) { errEl.textContent = err.message || 'Handover failed.'; errEl.style.display = 'block' }
    if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
  }
}

function hasAnyPermission(list) {
  if (!Array.isArray(list) || !list.length) return true;
  return list.some((perm) => _spPermissions.includes(perm));
}

function spJwtHasGranularLab() {
  return _spPermissions.some((p) => String(p).toLowerCase().startsWith('storepilot.lab.'))
}

/** Strict default: require storepilot.lab.view. Legacy: dashboard.view when JWT has no storepilot.lab.*. */
function canAccessSpLabOrdersMenu() {
  const strict =
    typeof window.cosmosRbacStrictEmptyPerms === 'function'
      ? window.cosmosRbacStrictEmptyPerms()
      : true
  if (strict) {
    return _spPermissions.includes('storepilot.lab.view')
  }
  if (!spJwtHasGranularLab()) {
    return _spPermissions.includes('storepilot.dashboard.view')
  }
  return _spPermissions.includes('storepilot.lab.view')
}

/** Strict: require storepilot.lab.manage or pos.lab.workflow. Legacy: open mutations unless granular lab keys (then manage/workflow required). */
function canStorePilotManageLab() {
  const canMutate = _spPermissions.includes('storepilot.lab.manage')
    || _spPermissions.includes('pos.lab.workflow')
  const strict =
    typeof window.cosmosRbacStrictEmptyPerms === 'function'
      ? window.cosmosRbacStrictEmptyPerms()
      : true
  if (strict) {
    return canMutate
  }
  if (!spJwtHasGranularLab()) return true
  return canMutate
}

function spPendingInstantSubs(row) {
  const list = Array.isArray(row.instant_sub_orders) ? row.instant_sub_orders : []
  return list.filter(
    (s) => String(s.handover_status || '').toUpperCase() !== 'HANDED_OVER'
  )
}

function canAccessSpView(id) {
  if (id === 'lab-orders') return canAccessSpLabOrdersMenu()
  const perms = SP_MENU_PERM_MAP[id] || [];
  return hasAnyPermission(perms);
}

function applyStorepilotPermissionNav() {
  const nav = document.querySelector('.sidebar-nav');
  if (!nav) return [];

  const visibleMenuIds = [];
  nav.querySelectorAll('.nav-item[data-storepilot-menu]').forEach((item) => {
    const menuId = item.getAttribute('data-storepilot-menu');
    if (!menuId) return;
    const allowed = canAccessSpView(menuId);
    item.style.display = allowed ? '' : 'none';
    if (allowed && menuId) visibleMenuIds.push(menuId);
  });

  nav.querySelectorAll('.nav-group').forEach((group) => {
    const items = [];
    let sibling = group.nextElementSibling;
    while (sibling && sibling.classList.contains('nav-item')) {
      if (sibling.hasAttribute('data-storepilot-menu')) items.push(sibling);
      sibling = sibling.nextElementSibling;
    }
    const hasVisible = items.some((el) => el.style.display !== 'none');
    group.style.display = hasVisible ? '' : 'none';
  });

  return visibleMenuIds;
}

function renderNoAccessState(reasonKey) {
  const main = document.querySelector('.main');
  const topbar = document.querySelector('.topbar');
  if (topbar) topbar.style.display = 'none';
  document.querySelectorAll('.main .page').forEach((p) => p.classList.remove('active'));
  if (!main) return;
  let box = document.getElementById('sp-no-access');
  if (!box) {
    box = document.createElement('div');
    box.id = 'sp-no-access';
    box.style.cssText = 'padding:40px 24px';
    main.appendChild(box);
  }
  const msg = reasonKey === 'menu_access_denied'
    ? 'You do not have permission for this menu.'
    : 'You do not have any StorePilot menu permissions.';
  box.innerHTML = `<div class="card"><div class="cb"><div style="font-weight:700;color:var(--text1);margin-bottom:6px">No access</div><div style="color:var(--text2)">${msg} Please contact administrator.</div></div></div>`;
}

// ── Init ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof window.cosmosRefreshSession === 'function') {
    try {
      await window.cosmosRefreshSession();
    } catch (refreshErr) {
      if (refreshErr && (refreshErr.status === 401 || refreshErr.status === 403)) {
        if (typeof window.cosmosSignOut === 'function') window.cosmosSignOut();
        else window.location.href = '/';
        return;
      }
    }
  }

  spHydrateUserFromSession();

  const routeFromPath = getStorepilotPageFromPath(window.location.pathname);
  if (routeFromPath === 'transfers-history') {
    spPrimeTransfersHistoryPage();
  }

  const bootstrapP = typeof window.cosmosLoadRbacBootstrap === 'function'
    ? window.cosmosLoadRbacBootstrap()
    : Promise.resolve();

  loadUser();
  spSyncCreateRequestBtn();
  if (_spNoAccess) return;

  await Promise.all([bootstrapP, refreshWarehouseContext()]);

  const activeSpPage = document.body.getAttribute('data-sp-page') || routeFromPath;
  if (activeSpPage === 'transfers-history') {
    spSyncCreateRequestBtn();
    window.loadTransferHistory();
    if (_spOpenCreateRequestOnLoad && canSpCreateTransferRequest()) {
      _spOpenCreateRequestOnLoad = false;
      setTimeout(function () { window.openSpCreateRequestModal(); }, 0);
    }
  } else {
    document.body.setAttribute('data-sp-page', 'dashboard');
    spSetBreadcrumb('dashboard');
    spSyncTopbarMeta('dashboard');
    const dashPage = document.getElementById('page-dashboard');
    if (dashPage && !document.querySelector('.main .page.active')) {
      document.querySelectorAll('.main .page').forEach((p) => p.classList.remove('active'));
      dashPage.classList.add('active');
    }
    loadDashboard();
    startDashRefresh();
  }

  window.addEventListener('resize', function spOnChromeResize() {
    const pageId = document.body.getAttribute('data-sp-page');
    if (pageId) spSetBreadcrumb(pageId);
  });
});

const ROLE_LABELS = {
  store_incharge: 'Store Incharge',
  store_manager:  'Store Manager',
  super_admin:    'Super Admin',
  hr_admin:       'HR Admin'
};

function loadUser() {
  try {
    const token = sessionStorage.getItem('cosmos_token');
    if (!token) { window.location.href = '/'; return; }
    const stored = sessionStorage.getItem('cosmos_user');
    if (!stored) return;
    const u = JSON.parse(stored);
    const mods = u.modules;
    const hasMap = mods && typeof mods === 'object' && Object.keys(mods).length > 0;
    if (hasMap && mods.storepilot === false) {
      if (mods.command_unit !== false) window.location.href = '/command-unit/dashboard';
      else if (mods.foundry !== false) window.location.href = '/foundry/dashboard';
      else if (mods.finance !== false) window.location.href = '/finance/dashboard';
      else if (mods.cx !== false) window.location.href = '/cx/dashboard';
      else window.location.href = '/';
      return;
    }
    const name = u.full_name || u.username || '?';
    const initials = name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    const av = document.getElementById('sp-user-av');
    const nm = document.getElementById('sp-user-name');
    const rl = document.getElementById('sp-user-role');
    if (av) av.textContent = initials;
    if (nm) nm.textContent = name;
    if (rl) rl.textContent = ROLE_LABELS[u.role] || u.role || 'Store Pilot';
    _spPermissions = Array.isArray(u.permissions) ? u.permissions.map((x) => String(x).toLowerCase()) : [];
    _storeId   = u.store_id   || null;
    _storeName = u.store_name || null;
    spSyncCreateRequestBtn();
    if (typeof window.initCosmosModuleSwitchFooter === 'function') {
      window.initCosmosModuleSwitchFooter(u);
    }
    const visibleMenuIds = applyStorepilotPermissionNav();
    if (!visibleMenuIds.length) {
      _spNoAccess = true;
      renderNoAccessState('no_menu_permissions');
      return;
    }
    const routeMenuId = getStorepilotPageFromPath(window.location.pathname);
    if (visibleMenuIds.includes(routeMenuId)) {
      window.spNav(routeMenuId, getStorepilotNavEl(routeMenuId), { fromHistory: true });
      return;
    }
    const activeItem = document.querySelector('.sidebar-nav .nav-item.active[data-storepilot-menu]');
    const activeMenuId = activeItem ? activeItem.getAttribute('data-storepilot-menu') : null;
    if (!activeMenuId || !visibleMenuIds.includes(activeMenuId)) {
      const firstId = visibleMenuIds[0];
      const firstEl = document.querySelector(`.sidebar-nav .nav-item[data-storepilot-menu="${firstId}"]`);
      if (firstId) window.spNav(firstId, firstEl || null);
    }
  } catch (_) {}
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function loadDashboard() {
  const lastEl = document.getElementById('dash-last-updated');
  if (lastEl) {
    lastEl.hidden = false;
    lastEl.textContent = 'Loading…';
  }

  const qs = new URLSearchParams({ top_n: 200 });
  if (_storeId) qs.set('to_store_id', _storeId);

  const skuPromise = _storeId
    ? apiGet('/api/stock-transfers/store-catalogue?' + new URLSearchParams({ store_id: _storeId }).toString())
    : apiGet('/api/skus?status=LIVE');

  Promise.allSettled([
    apiGet('/api/stock-transfers/history?' + qs.toString()),
    skuPromise
  ]).then(([trResult, skuResult]) => {
    const transfers = trResult.status === 'fulfilled' ? (trResult.value.data || []) : [];
    const skus      = skuResult.status === 'fulfilled' ? (skuResult.value.data || []) : [];

    const tcEl = document.getElementById('dash-transfer-count');
    const tmEl = document.getElementById('dash-transfer-meta');
    if (tcEl) tcEl.textContent = transfers.length;
    if (tmEl) tmEl.textContent = _storeId ? 'Inbound to this store' : 'Network total transfers';

    const scEl = document.getElementById('dash-sku-count');
    const scSm = document.querySelector('#page-dashboard .sg4 .sc:nth-child(2) .sm');
    if (scEl) scEl.textContent = skus.length;
    if (scSm) {
      scSm.textContent = _storeId
        ? 'SKUs with stock at this store'
        : 'Network catalogue (assign a store for in-store count)';
    }

    renderDashRecentTransfers(transfers.slice(0, 5));

    if (lastEl) {
      lastEl.textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    }
  });
}

function renderDashRecentTransfers(rows) {
  const el = document.getElementById('dash-recent-transfers');
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = `<div class="empty-state"><div class="ei">🚚</div><div class="et">No transfers yet${_storeId ? ' for this store' : ''}</div></div>`;
    return;
  }
  el.innerHTML = `
    <div class="tw">
      <table>
        <thead>
          <tr>
            <th>Date</th><th>SKU</th><th>Description</th><th>From</th><th style="text-align:right">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => {
            const qty = Number(r.qty) || Number(r.total_qty) || 0;
            return `<tr>
              <td>${fmtDate(r.created_at || r.transfer_date)}</td>
              <td class="mono">${escHtml(r.sku_code || r.sku_id)}</td>
              <td>${escHtml(r.description || r.sku_description || '')}</td>
              <td style="color:var(--text3);font-size:12px">${escHtml(r.from_location || primaryWarehouseLabel())}</td>
              <td style="text-align:right"><span class="b b-blue">${qty}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function startDashRefresh() {
  if (_dashTimer) clearInterval(_dashTimer);
  _dashTimer = setInterval(() => {
    const active = document.querySelector('.page.active');
    if (active && active.id === 'page-dashboard') loadDashboard();
  }, 60000);
}

// ── Stock View: Network Search ─────────────────────────────────────────────────
window.onFStockSearch = function (q) {
  clearTimeout(_fStockDebounce);
  if (!q.trim()) {
    const r = document.getElementById('fstock-results');
    const d = document.getElementById('fstock-detail-wrap');
    if (r) r.innerHTML = `<div class="empty-state"><div class="ei">🔍</div><div class="et">Type a SKU code or product name to search across all locations</div></div>`;
    if (d) d.innerHTML = `<div class="empty-state" style="padding-top:60px"><div class="ei">📦</div><div class="et">Select a SKU to see network distribution</div></div>`;
    return;
  }
  _fStockDebounce = setTimeout(() => doFStockSearch(q.trim()), 350);
};

async function doFStockSearch(q) {
  const spin      = document.getElementById('fstock-spin');
  const resultsEl = document.getElementById('fstock-results');
  showErr('fstock-err', '');
  if (spin) spin.style.display = 'inline';
  try {
    const data = await apiGet(`/api/stock-transfers/distribution/search?q=${encodeURIComponent(q)}&limit=20`);
    const rows = data.data || [];
    if (!rows.length) {
      resultsEl.innerHTML = `<div class="empty-state"><div class="ei">🔍</div><div class="et">No SKUs found for "${escHtml(q)}"</div></div>`;
      return;
    }
    resultsEl.innerHTML = rows.map((r) => {
      const canSeeQty = r.total_stock != null
      const isAvailable = isStockAvailable(r, ['total_stock'])
      const badge = canSeeQty
        ? (r.total_stock > 10
          ? `<span class="b b-green">${r.total_stock} in stock</span>`
          : r.total_stock > 0
            ? `<span class="b b-gold">${r.total_stock} in stock</span>`
            : `<span class="b b-red">Out of stock</span>`)
        : `<span class="b ${isAvailable ? 'b-green' : 'b-red'}">${isAvailable ? 'Available' : 'Out of stock'}</span>`
      return `
        <div class="result-row" onclick="loadStockDetail(${r.sku_id}, this)" data-sku-id="${r.sku_id}">
          <div>
            <div class="rr-code">${escHtml(r.sku_code)}</div>
            <div class="rr-desc">${escHtml(r.description || r.brand_name || '')}</div>
          </div>
          ${badge}
        </div>`;
    }).join('');
  } catch (err) {
    showErr('fstock-err', 'Search failed: ' + err.message);
    if (resultsEl) resultsEl.innerHTML = '';
  } finally {
    if (spin) spin.style.display = 'none';
  }
}

window.loadStockDetail = async function (skuId, rowEl) {
  document.querySelectorAll('#fstock-results .result-row').forEach((r) => r.classList.remove('selected'));
  if (rowEl) rowEl.classList.add('selected');

  const wrap = document.getElementById('fstock-detail-wrap');
  wrap.innerHTML = '<div class="empty-state" style="padding-top:60px"><div class="ei">⏳</div><div class="et">Loading…</div></div>';

  try {
    const data = await apiGet(`/api/stock-transfers/distribution/${skuId}`);
    const sku  = data.data && data.data.sku;
    const locs = (data.data && data.data.locations) || [];

    if (!sku) { wrap.innerHTML = '<div class="empty-state"><div class="et">SKU not found</div></div>'; return; }

    const hasTotalQty = sku.total_stock != null;
    const skuAvailable = isStockAvailable(sku, ['total_stock']);
    const stockColor = hasTotalQty
      ? (sku.total_stock > 10 ? 'var(--green)' : sku.total_stock > 0 ? 'var(--gold)' : 'var(--red)')
      : (skuAvailable ? 'var(--green)' : 'var(--red)');
    const locRows = locs.length
      ? locs.map((l) => {
          const hasQty = l.qty != null;
          const qty = Number(l.qty) || 0;
          const available = isStockAvailable(l, ['qty']);
          return `
            <div class="loc-row">
              <div>
                <div class="loc-name">${escHtml(l.location_name || l.location_type)}</div>
                <div class="loc-type">${escHtml(l.location_type || '')} ${l.store_name ? '· ' + escHtml(l.store_name) : ''}</div>
              </div>
              <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;color:${available ? 'var(--text1)' : 'var(--text3)'}">${hasQty ? qty : (available ? 'Available' : 'Not available')}</span>
            </div>`;
        }).join('')
      : '<div class="loc-row" style="color:var(--text3);font-size:13px">No stock in any location</div>';

    wrap.innerHTML = `
      <div class="detail-panel">
        <div class="detail-header">
          <div class="detail-sku">${escHtml(sku.sku_code)}</div>
          <div class="detail-desc">${escHtml(sku.description || sku.brand_name || '')}</div>
          <div style="display:flex;align-items:baseline;gap:10px;margin-top:10px">
            <div class="detail-total" style="color:${stockColor}">${hasTotalQty ? (sku.total_stock || 0) : (skuAvailable ? 'Available' : 'Not Available')}</div>
            <div style="font-size:12px;color:var(--text3)">${hasTotalQty ? 'total units across network' : 'network stock status'}</div>
          </div>
        </div>
        ${locRows}
        <div style="padding:14px 18px;border-top:1px solid var(--border)">
          <button class="btn sm primary"
            data-sku-id="${sku.sku_id || skuId}"
            data-sku-code="${escHtml(sku.sku_code)}"
            data-sku-desc="${escHtml(sku.description || sku.brand_name || '')}"
            onclick="requestTransferFromDetail(this)">
            ➕ Request transfer of this SKU
          </button>
        </div>
      </div>`;
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state"><div class="et" style="color:var(--red)">Error: ${escHtml(err.message)}</div></div>`;
  }
};

window.requestTransferFromDetail = function (btn) {
  const skuId   = Number(btn.dataset.skuId);
  const skuCode = btn.dataset.skuCode || '';
  const desc    = btn.dataset.skuDesc || '';
  spOpenCreateRequestWithPrefill(skuId, skuCode, desc);
};

function spOpenCreateRequestWithPrefill(skuId, skuCode, desc) {
  const onHistory = document.body.getAttribute('data-sp-page') === 'transfers-history';
  if (!onHistory) {
    const navItem = getStorepilotNavEl('transfers-history');
    window.spNav('transfers-history', navItem || null);
    setTimeout(function () {
      window.openSpCreateRequestModal();
      window.prefillTransferSku(skuId, skuCode, desc);
    }, 50);
    return;
  }
  window.openSpCreateRequestModal();
  window.prefillTransferSku(skuId, skuCode, desc);
}

// ── Shared SKU card helpers ────────────────────────────────────────────────────

function _skuCardInCart(skuId) {
  return _transferCart.some((c) => c.sku_id === skuId);
}

function _skuCardAddBtn(skuId, skuCode, desc, warehouseQty) {
  const inCart    = _skuCardInCart(skuId);
  const noStock   = warehouseQty != null && Number(warehouseQty) <= 0;
  const isDisabled = inCart || noStock;
  const label     = inCart ? '✓ Added' : noStock ? 'Out of Stock' : '+ Request';
  const cls       = inCart || noStock ? '' : 'primary';
  const availAttr = warehouseQty != null ? `data-avail-qty="${Number(warehouseQty)}"` : '';
  return `<button class="btn sm ${cls}" style="min-width:80px"
    data-sku-id="${skuId}" data-sku-code="${escHtml(skuCode)}" data-sku-desc="${escHtml(desc)}" ${availAttr}
    onclick="addToRequestCartFromCard(this)" ${isDisabled ? 'disabled' : ''}>
    ${label}
  </button>`;
}

function _refreshCartBars() {
  const count = _transferCart.length;
  ['bc', 'sc'].forEach((prefix) => {
    const bar   = document.getElementById(prefix + '-cart-bar');
    const label = document.getElementById(prefix + '-cart-count');
    if (bar)   bar.style.display   = count ? 'flex' : 'none';
    if (label) label.textContent   = count + ' item' + (count !== 1 ? 's' : '');
  });
}

window.addToRequestCartFromCard = function (btn) {
  const skuId    = Number(btn.dataset.skuId);
  const skuCode  = btn.dataset.skuCode || '';
  const desc     = btn.dataset.skuDesc || '';
  const availQty = btn.dataset.availQty != null ? Number(btn.dataset.availQty) : 9999;
  if (_transferCart.some((c) => c.sku_id === skuId)) return;
  _transferCart.push({ sku_id: skuId, sku_code: skuCode, description: desc, avail_qty: availQty, qty: 1 });
  renderTransferCart();
  btn.disabled = true;
  btn.textContent = '✓ Added';
  btn.classList.remove('primary');
  _refreshCartBars();
};

window.goToRequestGoods = function () {
  const onHistory = document.body.getAttribute('data-sp-page') === 'transfers-history';
  if (!onHistory) {
    const navItem = getStorepilotNavEl('transfers-history');
    window.spNav('transfers-history', navItem || null);
    setTimeout(function () { window.openSpCreateRequestModal(); }, 50);
    return;
  }
  window.openSpCreateRequestModal();
};

function spIsCreateRequestMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}

window.spSyncCreateRequestCartStrip = function () {
  const strip = document.getElementById('sp-create-request-cart-strip');
  const label = document.getElementById('sp-create-request-cart-strip-label');
  if (!strip) return;
  const n = _transferCart.length;
  if (!n) {
    strip.hidden = true;
    return;
  }
  strip.hidden = false;
  if (label) {
    label.textContent = n + ' item' + (n !== 1 ? 's' : '') + ' in cart';
  }
};

window.spScrollCreateRequestToCart = function () {
  const section = document.getElementById('sp-cr-cart-section');
  const body = document.querySelector('#overlay-sp-create-request .sp-create-request-body');
  if (section && section.scrollIntoView) {
    section.scrollIntoView({ behavior: spIsCreateRequestMobile() ? 'smooth' : 'auto', block: 'start' });
  } else if (body) {
    body.scrollTop = body.scrollHeight;
  }
};

window.openSpCreateRequestModal = function () {
  if (!canSpCreateTransferRequest()) {
    if (typeof cosmosToastWarn === 'function') {
      cosmosToastWarn('No permission to create transfer requests.');
    }
    return;
  }
  const overlay = document.getElementById('overlay-sp-create-request');
  if (!overlay) return;
  initTransferCreate();
  spSyncCreateRequestCartStrip();
  if (typeof window.cosmosEnsureApiKey === 'function') {
    window.cosmosEnsureApiKey().catch(function () {});
  }
  overlay.style.display = 'flex';
  overlay.classList.add('open');
  document.body.classList.add('sp-create-request-open');
  if (window.cosmosLockAppBodyScroll) window.cosmosLockAppBodyScroll();
  const body = overlay.querySelector('.sp-create-request-body');
  if (body) body.scrollTop = 0;
  if (!spIsCreateRequestMobile()) {
    setTimeout(function () {
      const search = document.getElementById('tc-search');
      if (search) search.focus();
    }, 120);
  }
};

window.closeSpCreateRequestModal = function () {
  const overlay = document.getElementById('overlay-sp-create-request');
  if (overlay) {
    overlay.classList.remove('open');
    setTimeout(function () { overlay.style.display = 'none'; }, 200);
  }
  document.body.classList.remove('sp-create-request-open');
  if (document.body.classList.contains('cosmos-app-shell')) {
    document.body.style.overflow = '';
  }
};

window.toggleSkuLocations = async function (btn, skuId) {
  const card    = btn.closest('.sku-card');
  const locsEl  = card && card.querySelector('.sku-card-locs');
  if (!locsEl) return;
  if (locsEl.classList.contains('open')) {
    locsEl.classList.remove('open');
    btn.textContent = 'Locations ▼';
    return;
  }
  btn.textContent = '…';
  try {
    const data  = await apiGet('/api/stock-transfers/distribution/' + skuId);
    const locs  = (data.data && data.data.locations) || [];
    if (!locs.length) {
      locsEl.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:8px 0">No stock records found.</div>`;
    } else {
      locsEl.innerHTML = locs.map((l) => `
        <div class="sku-loc-row">
          <span class="sku-loc-name">${escHtml(l.location_name || l.location_type)}</span>
          <span class="b ${isStockAvailable(l, ['qty']) ? 'b-green' : 'b-gray'}">${l.qty != null ? l.qty : (isStockAvailable(l, ['qty']) ? 'Available' : 'N/A')}</span>
        </div>`).join('');
    }
    locsEl.classList.add('open');
    btn.textContent = 'Locations ▲';
  } catch (err) {
    locsEl.innerHTML = `<div style="font-size:12px;color:var(--red);padding:8px 0">Error: ${escHtml(err.message)}</div>`;
    locsEl.classList.add('open');
    btn.textContent = 'Locations ▲';
  }
};

// ── Stock View: Browse Catalogue (card grid) ───────────────────────────────────

window.onBrowseCatalogueSearch = function (q) {
  clearTimeout(_bcDebounce);
  _bcDebounce = setTimeout(() => window.loadBrowseCatalogue(q.trim()), 350);
};

window.loadBrowseCatalogue = async function (q = '') {
  const grid = document.getElementById('bc-grid');
  const spin = document.getElementById('bc-spin');
  showErr('bc-err', '');
  if (spin) spin.style.display = 'inline';
  if (grid) {
    if (window.cosmosSkeletonCards) window.cosmosSkeletonCards('bc-grid', 6);
    else grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state"><div class="ei">⏳</div><div class="et">Loading catalogue…</div></div></div>`;
  }

  try {
    const qs = new URLSearchParams({ status: 'LIVE' });
    if (q) qs.set('q', q);
    const data = await apiGet('/api/skus?' + qs.toString());
    const rows = data.data || [];

    if (!rows.length) {
      grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state"><div class="ei">🗂️</div><div class="et">No live SKUs found${q ? ' for "' + escHtml(q) + '"' : ''}</div></div></div>`;
      return;
    }

    grid.innerHTML = rows.map((r) => {
      const skuId     = r.sku_id;
      const skuCode   = r.sku_code || '';
      const brand     = r.brand_name || r.brand_code || '';
      const name      = r.product_name || r.description || r.source_model_number || '';
      const type      = r.product_type || '';
      const colour    = r.colour_name  ? ` · ${r.colour_name}` : '';
      const whQty     = r.warehouse_qty != null ? Number(r.warehouse_qty) : (r.stock_qty != null ? Number(r.stock_qty) : null);
      const whAvailable = isStockAvailable(r, ['warehouse_qty', 'stock_qty']);
      const whBadge   = whQty !== null
        ? `<span class="b ${whQty > 0 ? 'b-green' : 'b-red'}">${whQty} WH</span>`
        : `<span class="b ${whAvailable ? 'b-green' : 'b-red'}">${whAvailable ? 'WH Available' : 'WH Unavailable'}</span>`;
      const desc      = name + colour;
      return `
        <div class="sku-card" data-sku-id="${skuId}">
          <div class="sku-card-head">
            <div class="sku-card-code">${escHtml(skuCode)}</div>
            <div class="sku-card-brand">${escHtml(brand)}${colour ? ' <span style="color:var(--text3)">·</span> ' + escHtml(r.colour_name) : ''}</div>
            <div class="sku-card-name">${escHtml(name)}</div>
          </div>
          <div class="sku-card-body">
            ${type ? `<span class="b b-gray">${escHtml(type)}</span>` : ''}
            ${whBadge}
          </div>
          <div class="sku-card-foot">
            ${_skuCardAddBtn(skuId, skuCode, desc, whQty)}
            <button class="btn sm" onclick="toggleSkuLocations(this,${skuId})" style="margin-left:auto">Locations ▼</button>
          </div>
          <div class="sku-card-locs"></div>
        </div>`;
    }).join('');

    _refreshCartBars();
  } catch (err) {
    showErr('bc-err', 'Failed to load catalogue: ' + err.message);
    if (grid) grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state"><div class="et" style="color:var(--red)">Error — see above</div></div></div>`;
  } finally {
    if (spin) spin.style.display = 'none';
  }
};

// ── Stock View: Store Catalogue (card grid) ────────────────────────────────────

window.onStoreCatalogueSearch = function (q) {
  clearTimeout(_scDebounce);
  _scDebounce = setTimeout(() => window.loadStoreCatalogue(q.trim()), 350);
};

window.loadStoreCatalogue = async function (q = '') {
  const grid = document.getElementById('sc-grid');
  const spin = document.getElementById('sc-spin');
  const summary = document.getElementById('sc-summary');
  showErr('sc-err', '');
  if (spin) spin.style.display = 'inline';
  if (grid) grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state"><div class="ei">⏳</div><div class="et">Loading store stock…</div></div></div>`;
  if (summary) summary.innerHTML = '';

  if (!_storeId) {
    if (grid) grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state"><div class="ei">🏪</div><div class="et">No store assigned to your account.</div></div></div>`;
    if (spin) spin.style.display = 'none';
    return;
  }

  try {
    const qs = new URLSearchParams({ store_id: _storeId });
    if (q) qs.set('q', q);
    const data = await apiGet('/api/stock-transfers/store-catalogue?' + qs.toString());
    const rows = data.data || [];
    const liveStockTotal = rows.reduce((sum, row) => sum + Math.max(0, Number(row.store_qty) || 0), 0);
    const brandTotals = {};
    const brandMrpTotals = {};
    const categoryTotals = {};

    rows.forEach((row) => {
      const rowQty = Math.max(0, Number(row.store_qty) || 0);
      const brandKey = (row.brand_name || 'Unbranded').trim();
      const categoryKey = (row.product_type || 'Uncategorized').trim();
      const mrpValue = Number(row.sale_price || 0);
      const mrpKey = mrpValue > 0 ? String(Math.round(mrpValue)) : 'No MRP';
      brandTotals[brandKey] = (brandTotals[brandKey] || 0) + rowQty;
      if (!brandMrpTotals[brandKey]) brandMrpTotals[brandKey] = {};
      brandMrpTotals[brandKey][mrpKey] = (brandMrpTotals[brandKey][mrpKey] || 0) + rowQty;
      categoryTotals[categoryKey] = (categoryTotals[categoryKey] || 0) + rowQty;
    });

    const toSortedList = (totalsObj) => Object.entries(totalsObj)
      .sort((a, b) => b[1] - a[1])
      .map(([label, qty]) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text2)">${escHtml(label)}</span><span class="b ${qty > 0 ? 'b-green' : 'b-gray'}">${qty}</span></div>`)
      .join('');

    const toBrandMrpList = () => Object.entries(brandTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([brand, brandQty]) => {
        const mrpRows = Object.entries(brandMrpTotals[brand] || {})
          .sort((a, b) => {
            const av = Number(a[0]);
            const bv = Number(b[0]);
            if (Number.isFinite(av) && Number.isFinite(bv)) return av - bv;
            if (Number.isFinite(av)) return -1;
            if (Number.isFinite(bv)) return 1;
            return String(a[0]).localeCompare(String(b[0]));
          })
          .map(([mrp, qty]) => `
            <div style="display:flex;justify-content:space-between;gap:10px;padding:3px 0 3px 12px">
              <span class="mono" style="color:var(--text2)">${escHtml(mrp)}</span>
              <span class="mono" style="font-weight:700;color:var(--text1)">${qty}</span>
            </div>`)
          .join('');
        return `
          <div style="padding:8px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;gap:10px">
              <span style="color:var(--text2);font-weight:700">${escHtml(brand)}</span>
              <span class="b ${brandQty > 0 ? 'b-green' : 'b-gray'}">${brandQty}</span>
            </div>
            <div style="margin-top:6px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--text3)">Sale Price (MRP) Wise</div>
            <div style="margin-top:3px">${mrpRows}</div>
          </div>`;
      })
      .join('');

    if (summary) {
      summary.innerHTML = `
        <div class="sc" style="--sc-color:var(--acc)">
          <div class="sl">Total SKU</div>
          <div class="sv">${rows.length}</div>
          <div class="sm">Distinct SKUs currently in this store</div>
        </div>
        <div class="sc" style="--sc-color:var(--green)">
          <div class="sl">Live Stock</div>
          <div class="sv">${liveStockTotal}</div>
          <div class="sm">Total units available in this store</div>
        </div>
        <div class="sc" style="--sc-color:var(--gold)">
          <div class="sl">Brand Wise Stock</div>
          <div class="sm" style="margin:0">
            ${toBrandMrpList() || '<span style="color:var(--text3)">No brand stock found</span>'}
          </div>
        </div>
        <div class="sc" style="--sc-color:var(--blue)">
          <div class="sl">Categories Wise Stock</div>
          <div class="sm" style="margin:0">
            ${toSortedList(categoryTotals) || '<span style="color:var(--text3)">No category stock found</span>'}
          </div>
        </div>`;
    }

    if (!rows.length) {
      grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state"><div class="ei">📦</div><div class="et">No items in stock at your store${q ? ' matching "' + escHtml(q) + '"' : ''}</div></div></div>`;
      return;
    }

    grid.innerHTML = rows.map((r) => {
      const skuId   = r.sku_id;
      const skuCode = r.sku_code || '';
      const brand   = r.brand_name || '';
      const name    = r.product_name || '';
      const type    = r.product_type || '';
      const colour  = r.colour_name ? ` · ${r.colour_name}` : '';
      const storeQty = Number(r.store_qty) || 0;
      const qtyBadge = `<span class="b ${storeQty > 5 ? 'b-green' : storeQty > 0 ? 'b-gold' : 'b-red'}">${storeQty} in store</span>`;
      const desc    = name + colour;
      return `
        <div class="sku-card" data-sku-id="${skuId}">
          <div class="sku-card-head">
            <div class="sku-card-code">${escHtml(skuCode)}</div>
            <div class="sku-card-brand">${escHtml(brand)}${colour ? ' <span style="color:var(--text3)">·</span> ' + escHtml(r.colour_name) : ''}</div>
            <div class="sku-card-name">${escHtml(name)}</div>
          </div>
          <div class="sku-card-body">
            ${type ? `<span class="b b-gray">${escHtml(type)}</span>` : ''}
            ${qtyBadge}
          </div>
          <div class="sku-card-foot">
            ${_skuCardAddBtn(skuId, skuCode, desc)}
          </div>
        </div>`;
    }).join('');

    _refreshCartBars();
  } catch (err) {
    showErr('sc-err', 'Failed to load store catalogue: ' + err.message);
    if (grid) grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state"><div class="et" style="color:var(--red)">Error — see above</div></div></div>`;
    if (summary) summary.innerHTML = '';
  } finally {
    if (spin) spin.style.display = 'none';
  }
};

// ── Transfers: History (Transfer Requests lifecycle) ───────────────────────────

const TR_STATUS_BADGE = {
  SUBMITTED:            'b-gold',
  APPROVED:             'b-blue',
  PARTIALLY_DISPATCHED: 'b-teal',
  DISPATCHED:           'b-orange',
  PARTIALLY_RECEIVED:   'b-teal',
  RECEIVED:             'b-green',
  REJECTED:             'b-red'
};

const TR_STATUS_LABEL = {
  SUBMITTED:            'Submitted',
  APPROVED:             'Approved',
  PARTIALLY_DISPATCHED: 'Partially dispatched',
  DISPATCHED:           'Dispatched',
  PARTIALLY_RECEIVED:   'Partially stocked at store',
  RECEIVED:             'Stocked at Store',
  REJECTED:             'Rejected'
};

function trLineCap(line) {
  if (line.approved_qty != null && Number(line.approved_qty) > 0) return Number(line.approved_qty);
  return Math.max(0, Number(line.requested_qty) || 0);
}

function trRequestQtySummary(req) {
  const lines = req.lines || [];
  let totalRequested = 0;
  let totalCap = 0;
  let totalDisp = 0;
  let totalRecv = 0;
  lines.forEach(function (l) {
    totalRequested += Math.max(0, Number(l.requested_qty) || 0);
    totalCap += trLineCap(l);
    totalDisp += Math.max(0, Number(l.dispatched_qty) || 0);
    if (l.received_qty != null) totalRecv += Math.max(0, Number(l.received_qty) || 0);
  });
  return {
    skuCount: lines.length,
    totalRequested: totalRequested,
    totalCap: totalCap,
    totalDisp: totalDisp,
    totalRecv: totalRecv,
    remainingToShip: Math.max(0, totalCap - totalDisp),
    remainingToStock: Math.max(0, totalCap - totalRecv)
  };
}

function spTrListProgressHtml(r) {
  const cap = Math.max(0, Number(r.total_approved_cap) || Number(r.total_requested_qty) || 0);
  const recv = Math.max(0, Number(r.total_received_qty) || 0);
  const rem = Math.max(0, cap - recv);
  if (cap < 1) return '';
  if (r.status === 'PARTIALLY_RECEIVED' || (recv > 0 && rem > 0)) {
    return '<strong>' + recv + '</strong> of <strong>' + cap + '</strong> stocked · <span class="cosmos-record-row__progress-rem">' + rem + ' remaining to receive</span>';
  }
  if (r.status === 'PARTIALLY_DISPATCHED') {
    const disp = Math.max(0, Number(r.total_dispatched_qty) || 0);
    const remShip = Math.max(0, cap - disp);
    if (remShip > 0) {
      return '<strong>' + disp + '</strong> of <strong>' + cap + '</strong> shipped · <span class="cosmos-record-row__progress-rem">' + remShip + ' remaining to ship</span>';
    }
  }
  return '';
}

function spSyncFilterTabs(containerId, activeKey) {
  const el = document.getElementById(containerId);
  if (el && window.cosmosFilterTabs) window.cosmosFilterTabs.sync(el, activeKey);
}

async function spLoadRequestShipments(requestId, wrapId) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return [];
  try {
    const list = await apiGet('/api/transfer-requests/' + requestId + '/shipments?top_n=50') || [];
    if (!list.length) {
      wrap.innerHTML = '<span style="color:var(--text3)">No transfer documents yet.</span>';
      return [];
    }
    const onClick = 'expandIncTransfer';
    wrap.innerHTML = window.cosmosDetailShipments
      ? window.cosmosDetailShipments.html(list.map(function (d) {
        return {
          doc_id: d.doc_id,
          status: d.status,
          line_count: d.line_count,
          dateLabel: typeof fmtDate === 'function' ? fmtDate(d.dispatched_at || d.created_at) : ''
        };
      }), { onDocClick: onClick })
      : '';
    return list;
  } catch (err) {
    wrap.innerHTML = '<span style="color:var(--red)">' + escHtml(err.message) + '</span>';
    return [];
  }
}

window.spOpenFirstActionableShipment = async function (requestId) {
  try {
    const list = await apiGet('/api/transfer-requests/' + requestId + '/shipments?top_n=50') || [];
    const actionable = list.find(function (d) {
      return d.status === 'DISPATCHED' || d.status === 'ACCEPTED';
    });
    if (actionable && typeof window.expandIncTransfer === 'function') {
      await window.expandIncTransfer(actionable.doc_id);
      return;
    }
    if (typeof cosmosToastInfo === 'function') {
      cosmosToastInfo('No shipments ready to stock yet.');
    }
  } catch (err) {
    if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
  }
};

function spRefreshAfterIncomingAction() {
  if (typeof window.loadTransferHistory === 'function') window.loadTransferHistory();
  if (_spOpenTrRequestId && document.getElementById('sp-tr-shipments-wrap')) {
    spLoadRequestShipments(_spOpenTrRequestId, 'sp-tr-shipments-wrap');
  }
}

function trComputeRemainderLines(lines) {
  const out = [];
  (lines || []).forEach(function (l) {
    const cap = trLineCap(l);
    const progressed = Math.max(
      Math.max(0, Number(l.dispatched_qty) || 0),
      Math.max(0, Number(l.received_qty) || 0)
    );
    const rem = cap - progressed;
    if (rem > 0) out.push({ sku_id: l.sku_id, sku_code: l.sku_code, qty: rem });
  });
  return out;
}

let _spTrFilter = '';

window.setSpTrFilter = function (status) {
  _spTrFilter = status == null ? '' : String(status);
  spSyncFilterTabs('sp-tr-filters', _spTrFilter);
  loadTransferHistory();
};

window.loadTransferHistory = async function () {
  const wrap = document.getElementById('tr-history-wrap');
  showErr('fmov-err', '');
  spSyncFilterTabs('sp-tr-filters', _spTrFilter);
  if (wrap && typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('tr-history-wrap', 6);

  try {
    const qs = new URLSearchParams({ top_n: 100 });
    if (_spTrFilter) qs.set('status', _spTrFilter);
    const data = await apiGet('/api/transfer-requests?' + qs.toString());
    const rows = Array.isArray(data) ? data : (data.data || []);

    if (!rows.length) {
      const createBtn = canSpCreateTransferRequest()
        ? '<button type="button" class="btn primary" onclick="openSpCreateRequestModal()">+ Create Request</button>'
        : '';
      wrap.innerHTML = `<div class="empty-state"><div class="ei">📬</div><div class="et" style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">No transfer requests</div><div class="es" style="font-size:13px;color:var(--text2);margin-bottom:16px">Use <strong>Create Request</strong> to submit a goods request to HQ.</div>${createBtn}</div>`;
      return;
    }

    wrap.innerHTML = rows.map(function (r) {
      const skuPart = (r.line_count || 0) + ' SKU' + ((r.line_count || 0) !== 1 ? 's' : '');
      const qtyPart = r.total_requested_qty != null ? ' · ' + r.total_requested_qty + ' pcs requested' : '';
      const progress = spTrListProgressHtml(r);
      if (!window.cosmosRecordRow) {
        return '<div class="cosmos-record-row tr-link" onclick="expandSpTrRequest(' + r.request_id + ')">#' + r.request_id + '</div>';
      }
      return window.cosmosRecordRow.html({
        primary: 'Request #' + r.request_id,
        secondary: fmtDate(r.created_at) + ' · ' + skuPart + qtyPart,
        progressHtml: progress,
        badgeHtml: '<span class="b ' + (TR_STATUS_BADGE[r.status] || 'b-gray') + '">' + escHtml(TR_STATUS_LABEL[r.status] || r.status) + '</span>',
        onClick: 'expandSpTrRequest(' + r.request_id + ')',
        ariaLabel: 'Open request ' + r.request_id
      });
    }).join('');
  } catch (err) {
    showErr('fmov-err', 'Failed to load transfer requests: ' + err.message);
    if (wrap) wrap.innerHTML = '';
  }
};

let _spOpenTrRequestId = null;

window.expandSpTrRequest = async function (requestId) {
  _spOpenTrRequestId = requestId;
  const body  = document.getElementById('sp-tr-detail-body');
  const title = document.getElementById('sp-tr-detail-title');
  const metaEl = document.getElementById('sp-tr-detail-meta');
  const actionsEl = document.getElementById('sp-tr-detail-actions');
  if (!body) return;

  if (window.cosmosDetailPanel) window.cosmosDetailPanel.prepareOpen('sp-tr-detail', 'sp-tr-detail-backdrop');
  if (title) title.textContent = 'Request #' + requestId;
  if (metaEl) metaEl.innerHTML = '';
  if (actionsEl) actionsEl.innerHTML = '';
  if (window.cosmosDetailPanel) window.cosmosDetailPanel.skeletonBody(body, 5);

  try {
    const data = await apiGet('/api/transfer-requests/' + requestId);
    const req  = data.data || data;

    if (title) title.textContent = 'Request #' + requestId + (req.store_name ? ' — ' + req.store_name : '');
    if (metaEl) {
      metaEl.innerHTML = '<span class="b ' + (TR_STATUS_BADGE[req.status] || 'b-gray') + '">' + escHtml(TR_STATUS_LABEL[req.status] || req.status) + '</span>' +
        '<span>' + escHtml(fmtDate(req.created_at)) + '</span>';
    }

    const qtySum = trRequestQtySummary(req);
    const remainderLines = trComputeRemainderLines(req.lines);
    const partialStock = req.status === 'PARTIALLY_RECEIVED'
      || (qtySum.totalRecv > 0 && qtySum.remainingToStock > 0);

    const linesHtml = (req.lines || []).map((l) => {
      const cap = trLineCap(l);
      const recv = l.received_qty != null ? Number(l.received_qty) : null;
      const recvShort = recv != null && recv < cap;
      const recvBadge = recv != null
        ? `<span class="b ${recvShort ? 'b-gold' : 'b-green'}">${recv}</span>`
        : '<span style="color:var(--text3)">—</span>';
      return `
      <tr>
        <td class="mono">${escHtml(l.sku_code)}</td>
        <td>${escHtml(l.description || '')}</td>
        <td style="text-align:right"><span class="b b-gray">${l.requested_qty}</span></td>
        <td style="text-align:right">${l.approved_qty   != null ? `<span class="b b-blue">${l.approved_qty}</span>`   : '<span style="color:var(--text3)">—</span>'}</td>
        <td style="text-align:right">${l.dispatched_qty != null ? `<span class="b b-orange">${l.dispatched_qty}</span>` : '<span style="color:var(--text3)">—</span>'}</td>
        <td style="text-align:right">${recvBadge}</td>
      </tr>`;
    }).join('');

    const qtyBanner = window.cosmosDetailQtySummary
      ? window.cosmosDetailQtySummary.html(qtySum, { showRemainingToStock: true, showRemainingToShip: true })
      : '';

    const chips = window.cosmosDetailChips ? window.cosmosDetailChips.html([
      { label: 'Status', valueHtml: '<span class="b ' + (TR_STATUS_BADGE[req.status] || 'b-gray') + '">' + escHtml(TR_STATUS_LABEL[req.status] || req.status) + '</span>' },
      { label: 'Submitted', value: fmtDate(req.created_at) },
      { label: 'By', value: req.requested_by_fullname || req.requested_by_name || '—' }
    ]) : '';

    let actionHtml = '';
    if (req.status === 'PARTIALLY_DISPATCHED' || (req.status === 'DISPATCHED' && qtySum.remainingToShip > 0)) {
      actionHtml = `<p style="margin-top:14px;font-size:13px;color:var(--text2)">HQ is still shipping the rest of this request. Stock each arrival from <strong>Shipments</strong> below.</p>`;
    }
    if (partialStock) {
      actionHtml += `<p style="margin-top:10px;font-size:13px;color:var(--text2)">Partially stocked vs approved quantity. Open a shipment below to stock more, or request the remainder.</p>`;
    }
    if (remainderLines.length) {
      const remPcs = remainderLines.reduce((s, x) => s + x.qty, 0);
      actionHtml += `<div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">` +
        `<button type="button" class="btn primary" id="sp-tr-remainder-btn" onclick="spCreateRemainderRequest(${req.request_id}, this)">Request remainder (${remPcs} pc${remPcs !== 1 ? 's' : ''})</button>` +
        `<button type="button" class="btn sm" onclick="spOpenFirstActionableShipment(${req.request_id})">Stock shipment</button>` +
        `</div>`;
    } else if (req.status === 'DISPATCHED' || req.status === 'PARTIALLY_DISPATCHED' || req.status === 'PARTIALLY_RECEIVED') {
      actionHtml += `<div style="margin-top:14px"><button type="button" class="btn sm primary" onclick="spOpenFirstActionableShipment(${req.request_id})">Stock shipment</button></div>`;
    }

    const tableBlock = window.cosmosDetailLinesTable
      ? window.cosmosDetailLinesTable.wrap(
        '<thead><tr><th>SKU</th><th>Description</th><th style="text-align:right">Requested</th><th style="text-align:right">Approved</th><th style="text-align:right">Dispatched</th><th style="text-align:right">Stocked</th></tr></thead><tbody>' + linesHtml + '</tbody>'
      )
      : '<div class="tw"><table><thead><tr><th>SKU</th><th>Description</th></tr></thead><tbody>' + linesHtml + '</tbody></table></div>';

    const showShipments = req.status === 'DISPATCHED' || req.status === 'PARTIALLY_DISPATCHED' ||
      req.status === 'PARTIALLY_RECEIVED' || req.status === 'RECEIVED';

    body.innerHTML = `
      <div style="padding:16px 20px">
        ${chips}
        ${qtyBanner}
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text2)">Line items</div>
        ${tableBlock}
        ${actionHtml}
        ${showShipments ? '<div style="margin-top:16px"><div style="font-weight:600;font-size:13px;margin-bottom:8px">Shipments</div><div id="sp-tr-shipments-wrap">Loading…</div></div>' : ''}
      </div>`;

    if (showShipments) spLoadRequestShipments(requestId, 'sp-tr-shipments-wrap');
  } catch (err) {
    if (body) body.innerHTML = `<div style="padding:16px;color:var(--red)">Error: ${escHtml(err.message)}</div>`;
  }
};

window.closeSpTrDetail = function () {
  if (window.cosmosDetailPanel) window.cosmosDetailPanel.close('sp-tr-detail', 'sp-tr-detail-backdrop');
};

window.spCreateRemainderRequest = async function (requestId, btn) {
  if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
  try {
    const result = await apiPost(`/api/transfer-requests/${requestId}/remainder`, {});
    const newId = result.data && result.data.request_id;
    if (typeof cosmosToastSuccess === 'function') {
      cosmosToastSuccess(newId ? `Remainder request #${newId} created.` : 'Remainder request created.');
    }
    loadTransferHistory();
    if (newId) expandSpTrRequest(newId);
    else closeSpTrDetail();
  } catch (err) {
    if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
  } finally {
    if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
  }
};

// ── Transfers: Request Transfer ────────────────────────────────────────────────
function initTransferCreate() {
  const noStoreEl = document.getElementById('transfer-create-no-store');
  const formEl    = document.getElementById('transfer-create-form');
  const destEl    = document.getElementById('tc-dest-store');
  if (!_storeId) {
    if (noStoreEl) noStoreEl.style.display = '';
    if (formEl)    formEl.style.display = 'none';
    return;
  }
  if (noStoreEl) noStoreEl.style.display = 'none';
  if (formEl)    formEl.style.display = '';
  if (destEl)    destEl.textContent = _storeName || `My store (Store #${_storeId})`;
}

function spNormalizeTransferSearchCode(raw) {
  const s = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  if (typeof window.transferNormalizeScanPayload === 'function') {
    return window.transferNormalizeScanPayload(s) || s;
  }
  return s;
}

function spIsLikelyUnitCode(raw) {
  const t = spNormalizeTransferSearchCode(raw);
  return /^\d{1,7}$/.test(t);
}

function spPaddedUnitCode(raw) {
  const t = spNormalizeTransferSearchCode(raw).replace(/\D/g, '');
  if (!t || t.length > 7) return '';
  return t.padStart(7, '0');
}

async function spFetchTransferSearchRows(q) {
  const norm = spNormalizeTransferSearchCode(q);
  if (!norm) return { rows: [] };
  const cacheKey = norm.toLowerCase();
  if (_tcSearchCache[cacheKey]) return { rows: _tcSearchCache[cacheKey] };
  const data = await apiGet('/api/transfer-requests/search-skus?q=' + encodeURIComponent(norm));
  const rows = data.data || [];
  if (rows.length) _tcSearchCache[cacheKey] = rows;
  return { rows: rows };
}

function renderTransferSearchResultRow(r) {
  const inCart    = _transferCart.some((c) => c.sku_id === r.sku_id);
  const hasWarehouseQty = r.warehouse_qty != null;
  const warehouseQty = hasWarehouseQty ? Number(r.warehouse_qty) : null;
  const warehouseAvailable = hasWarehouseQty ? warehouseQty > 0 : isStockAvailable(r, ['warehouse_qty', 'is_available']);
  const displayName  = r.product_name  || r.description || r.brand_name || '';
  const colourPart   = r.colour_name   ? ` — ${r.colour_name}` : '';
  const matchedUnit = r.unit_barcode ? String(r.unit_barcode).trim() : '';
  const availLabel = hasWarehouseQty
    ? `${warehouseQty} at HQ`
    : (r.availability === 'AVAILABLE' || warehouseAvailable ? 'HQ stock' : 'HQ — check qty');
  const availClass = warehouseAvailable ? 'b-green' : 'b-orange';
  const unitLine = matchedUnit
    ? `<div style="font-size:11px;color:var(--teal);font-weight:600;margin-top:4px">Matched unit ${escHtml(matchedUnit)}</div>`
    : '';
  const availCap = hasWarehouseQty && warehouseQty > 0 ? warehouseQty : 9999;
  return `
    <div class="avail-row">
      <div style="flex:1;min-width:0">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:var(--acc)">${escHtml(r.sku_code)}</div>
        <div style="font-size:12.5px;color:var(--text2);margin-top:2px">${escHtml(displayName + colourPart)}</div>
        ${unitLine}
      </div>
      <span class="b ${availClass}" style="white-space:nowrap" title="Informational only — request is not blocked">${availLabel}</span>
      <button class="btn sm ${inCart ? '' : 'primary'}" style="min-width:64px"
        data-sku-id="${r.sku_id}"
        data-sku-code="${escHtml(r.sku_code)}"
        data-sku-desc="${escHtml(displayName + colourPart)}"
        data-avail="${availCap}"
        onclick="addToCartFromBtn(this)"
        ${inCart ? 'disabled' : ''}>
        ${inCart ? '✓ Added' : '+ Add'}
      </button>
    </div>`;
}

window.onTransferSearch = function (q) {
  clearTimeout(_tcDebounce);
  const resultsEl = document.getElementById('tc-results');
  const trimmed = String(q || '').trim();
  if (!trimmed) {
    if (resultsEl) resultsEl.innerHTML = `<div class="empty-state"><div class="ei">🔍</div><div class="et">Search SKU by code, brand, or unit barcode</div></div>`;
    return;
  }
  const norm = spNormalizeTransferSearchCode(trimmed);
  const unitReady = spIsLikelyUnitCode(norm) && norm.length >= 7;
  const delay = unitReady ? 0 : (norm.length < 3 ? 450 : 220);
  if (unitReady) {
    doTransferSearch(trimmed);
    return;
  }
  _tcDebounce = setTimeout(function () { doTransferSearch(trimmed); }, delay);
};

async function doTransferSearch(q) {
  const spin      = document.getElementById('tc-spin');
  const resultsEl = document.getElementById('tc-results');
  const seq = ++_tcSearchSeq;
  showErr('tc-err', '');
  if (spin) spin.style.display = 'inline';
  if (resultsEl && typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('tc-results', 3);
  try {
    const fetched = await spFetchTransferSearchRows(q);
    if (seq !== _tcSearchSeq) return;
    const rows = fetched.rows || [];
    if (!rows.length) {
      const unitHint = spIsLikelyUnitCode(q) && spPaddedUnitCode(q)
        ? `unit code <strong>${escHtml(spPaddedUnitCode(q))}</strong>`
        : `"${escHtml(q)}"`;
      resultsEl.innerHTML = `<div class="empty-state"><div class="ei">📦</div><div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">No SKU found</div><div style="font-size:13px;color:var(--text2)">No matching SKU for ${unitHint}. Try SKU code, brand, or a valid 7-digit unit code.</div></div>`;
      return;
    }
    resultsEl.innerHTML = rows.map((r) => renderTransferSearchResultRow(r)).join('');
  } catch (err) {
    if (seq !== _tcSearchSeq) return;
    const msg = err.message || 'Search failed';
    showErr('tc-err', msg);
    if (resultsEl) resultsEl.innerHTML = '';
  } finally {
    if (seq === _tcSearchSeq && spin) spin.style.display = 'none';
  }
}

window.addToCartFromBtn = function (btn) {
  const skuId   = Number(btn.dataset.skuId);
  const skuCode = btn.dataset.skuCode || '';
  const desc    = btn.dataset.skuDesc || '';
  const avail   = btn.dataset.avail === '' ? null : (Number(btn.dataset.avail) || 9999);
  if (_transferCart.some((c) => c.sku_id === skuId)) return;
  _transferCart.push({ sku_id: skuId, sku_code: skuCode, description: desc, avail_qty: avail, qty: 1 });
  renderTransferCart();
  btn.disabled = true;
  btn.textContent = '✓ Added';
  btn.classList.remove('primary');
};

window.removeFromCart = function (skuId) {
  _transferCart = _transferCart.filter((c) => c.sku_id !== skuId);
  renderTransferCart();
  const q = (document.getElementById('tc-search') || {}).value || '';
  if (q.trim()) doTransferSearch(q.trim());
};

window.updateCartQty = function (skuId, rawVal) {
  const item = _transferCart.find((c) => c.sku_id === skuId);
  if (!item) return;
  item.qty = Math.max(1, Math.min(item.avail_qty || 9999, Number(rawVal) || 1));
};

function renderTransferCart() {
  const cartEl  = document.getElementById('tc-cart-body');
  const countEl = document.getElementById('tc-cart-count');
  _refreshCartBars();
  if (typeof window.spSyncCreateRequestCartStrip === 'function') window.spSyncCreateRequestCartStrip();
  if (!cartEl) return;
  if (countEl) countEl.textContent = _transferCart.length + ' item' + (_transferCart.length !== 1 ? 's' : '');

  if (!_transferCart.length) {
    cartEl.innerHTML = `<div class="empty-state" style="padding:28px 20px"><div class="ei">🛒</div><div class="et">Add items from search results</div></div>`;
    return;
  }

  cartEl.innerHTML = _transferCart.map((item) => `
    <div class="cart-item">
      <div style="flex:1;min-width:0">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:var(--acc)">${escHtml(item.sku_code)}</div>
        <div style="font-size:12px;color:var(--text2)">${escHtml(item.description)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        <input type="number" class="qty-input" min="1" max="${item.avail_qty || 9999}" value="${item.qty}"
          data-sku-id="${item.sku_id}"
          onchange="updateCartQty(${item.sku_id}, this.value)" oninput="updateCartQty(${item.sku_id}, this.value)">
        <span style="font-size:11px;color:var(--text3)" title="Available in ${primaryWarehouseTitleAttr()}">${item.avail_qty != null ? '/ ' + item.avail_qty + ' WH' : 'WH available'}</span>
        <button class="btn sm" style="color:var(--red);border-color:var(--red);padding:4px 8px"
          onclick="removeFromCart(${item.sku_id})">✕</button>
      </div>
    </div>`).join('');
}

window.clearTransferCart = function () {
  _transferCart = [];
  renderTransferCart();
  _refreshCartBars();
};

window.submitTransfer = async function () {
  const submitBtn = document.getElementById('tc-submit-btn');
  const msgEl     = document.getElementById('tc-submit-msg');

  if (!_storeId) {
    if (typeof cosmosToastError === 'function') cosmosToastError('No store assigned to your account.');
    return;
  }
  if (!_transferCart.length) {
    if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Add at least one item to the request.');
    return;
  }

  const notes = (document.getElementById('tc-notes') || {}).value || null;
  if (msgEl) { msgEl.textContent = ''; msgEl.style.color = ''; }
  if (submitBtn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(submitBtn);

  try {
    document.querySelectorAll('#tc-cart-body .qty-input[data-sku-id]').forEach((inp) => {
      updateCartQty(Number(inp.dataset.skuId), inp.value);
    });
    const lines = _transferCart.map((c) => ({ sku_id: c.sku_id, qty: Math.max(1, Number(c.qty) || 1) }));
    await apiPost('/api/transfer-requests', { store_id: _storeId, lines, notes: notes || null });

    _transferCart = [];
    renderTransferCart();
    const si = document.getElementById('tc-search');   if (si) si.value = '';
    const ri = document.getElementById('tc-results');
    if (ri) ri.innerHTML = `<div class="empty-state"><div class="ei">🔍</div><div class="et">Search SKU by code, brand, or unit barcode</div></div>`;
    const ni = document.getElementById('tc-notes');     if (ni) ni.value = '';

    if (submitBtn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(submitBtn);
    if (typeof cosmosToastSuccess === 'function') {
      cosmosToastSuccess('Request submitted — pending HQ approval.');
    }
    window.closeSpCreateRequestModal();
    if (typeof window.setSpTrFilter === 'function') window.setSpTrFilter('SUBMITTED');
    else window.loadTransferHistory();
  } catch (err) {
    if (submitBtn && typeof cosmosBtnDone === 'function') cosmosBtnDone(submitBtn);
    if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
  }
};

window.prefillTransferSku = function (skuId, skuCode, description) {
  initTransferCreate();
  if (!_transferCart.some((c) => c.sku_id === skuId)) {
    _transferCart.push({ sku_id: skuId, sku_code: skuCode, description, avail_qty: 9999, qty: 1 });
    renderTransferCart();
  }
};

// ── Reports ────────────────────────────────────────────────────────────────────
function loadReports() {
  const statsEl = document.getElementById('reports-stats');
  const tableEl = document.getElementById('reports-transfer-table');
  const monthEl = document.getElementById('reports-month-label');

  const now = new Date();
  if (monthEl) monthEl.textContent = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' });
  if (statsEl) statsEl.innerHTML = '<div style="grid-column:1/-1;padding:16px;color:var(--text3);font-size:13px">Loading report data…</div>';
  if (tableEl) tableEl.innerHTML = '<div class="empty-state"><div class="ei">⏳</div><div class="et">Loading…</div></div>';

  const qs = new URLSearchParams({ top_n: 500 });
  if (_storeId) qs.set('to_store_id', _storeId);

  const reportSkuPromise = _storeId
    ? apiGet('/api/stock-transfers/store-catalogue?' + new URLSearchParams({ store_id: _storeId }).toString())
    : apiGet('/api/skus?status=LIVE');

  Promise.allSettled([
    apiGet('/api/stock-transfers/history?' + qs.toString()),
    reportSkuPromise
  ]).then(([trResult, skuResult]) => {
    const allTransfers = trResult.status === 'fulfilled' ? (trResult.value.data || []) : [];
    const storeOrCatSkus = skuResult.status === 'fulfilled' ? (skuResult.value.data || []) : [];

    const istDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // "YYYY-MM-DD"
    const [iy, im, id] = istDateStr.split('-').map(Number);
    const monthStart = new Date(`${iy}-${String(im).padStart(2,'0')}-01T00:00:00+05:30`);
    const weekStart  = new Date(new Date(`${iy}-${String(im).padStart(2,'0')}-${String(id).padStart(2,'0')}T00:00:00+05:30`) - 6 * 864e5);

    const thisMonth = allTransfers.filter((r) => {
      const d = new Date(r.created_at || r.transfer_date);
      return !isNaN(d) && d >= monthStart;
    });
    const thisWeek = allTransfers.filter((r) => {
      const d = new Date(r.created_at || r.transfer_date);
      return !isNaN(d) && d >= weekStart;
    });

    const skuCount = storeOrCatSkus.length;
    const skuLabel = 'Live SKUs in store';
    const skuMeta = _storeId
      ? 'Distinct SKUs with on-hand stock at this store'
      : 'Network live catalogue (assign a store to see in-store count)';

    if (statsEl) {
      statsEl.innerHTML = `
        <div class="sc" style="--sc-color:var(--acc)">
          <div class="sl">Transfers this month</div>
          <div class="sv">${thisMonth.length}</div>
          <div class="sm">Inbound ${_storeId ? 'to this store' : 'network-wide'}</div>
        </div>
        <div class="sc" style="--sc-color:var(--gold)">
          <div class="sl">Transfers this week</div>
          <div class="sv">${thisWeek.length}</div>
          <div class="sm">Last 7 days</div>
        </div>
        <div class="sc" style="--sc-color:var(--blue)">
          <div class="sl">${skuLabel}</div>
          <div class="sv">${skuCount}</div>
          <div class="sm">${skuMeta}</div>
        </div>
        <div class="sc" style="--sc-color:#94A3B8;opacity:0.75">
          <div class="sl">Revenue this month</div>
          <div class="sv" style="color:var(--text3)">—</div>
          <div class="sm" style="color:var(--text3)">Not available</div>
        </div>`;
    }

    if (tableEl) {
      if (!thisMonth.length) {
        tableEl.innerHTML = `<div class="empty-state"><div class="ei">📋</div><div class="et">No transfers this month${_storeId ? ' for this store' : ''}</div></div>`;
      } else {
        tableEl.innerHTML = `
          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>SKU</th><th>Description</th>
                  <th>From</th><th style="text-align:right">Qty</th><th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${thisMonth.map((r) => {
                  const qty = Number(r.qty) || Number(r.total_qty) || 0;
                  return `<tr>
                    <td>${fmtDate(r.created_at || r.transfer_date)}</td>
                    <td class="mono">${escHtml(r.sku_code || r.sku_id)}</td>
                    <td>${escHtml(r.description || r.sku_description || '')}</td>
                    <td style="color:var(--text3);font-size:12px">${escHtml(r.from_location || primaryWarehouseLabel())}</td>
                    <td style="text-align:right"><span class="b b-blue">${qty}</span></td>
                    <td style="font-size:12px;color:var(--text3)">${escHtml(r.notes || '')}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`;
      }
    }
  });
}

window.expandIncTransfer = async function (docId) {
  const detailEl = document.getElementById('sp-inc-detail');
  const titleEl  = document.getElementById('sp-inc-detail-title');
  const bodyEl   = document.getElementById('sp-inc-detail-body');
  const msgEl    = document.getElementById('sp-inc-action-msg');
  if (!detailEl || !bodyEl) return;
  stopIncQrCamera();

  if (typeof window.cosmosOpenExtendedDetail === 'function') {
    window.cosmosOpenExtendedDetail('sp-inc-detail', 'sp-inc-detail-backdrop');
  }
  if (msgEl) { msgEl.textContent = ''; msgEl.style.color = ''; }
  const actionsEl = document.getElementById('sp-inc-detail-actions');
  if (actionsEl) actionsEl.innerHTML = '';
  if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('sp-inc-detail-body', 4);
  else bodyEl.innerHTML = '';

  const overlayEl = document.getElementById('sp-sidebar-overlay');
  const sidebarEl = document.querySelector('.sidebar');
  const isSidebarOpen = !!(sidebarEl && sidebarEl.classList.contains('open'));
  const isOverlayOpen = !!(overlayEl && overlayEl.classList.contains('open'));
  const isBodyLocked = document.body.style.overflow === 'hidden';
  if (isSidebarOpen || isOverlayOpen || isBodyLocked) closeSidebar();

  try {
    const data = await apiGet(`/api/stock-transfer-docs/${docId}`);
    const doc  = data.data;
    if (titleEl) titleEl.textContent = `Transfer #${doc.doc_id} — ${doc.store_name}`;

    const lines      = doc.lines || [];
    const isDispatched = doc.status === 'DISPATCHED';
    const isAccepted   = doc.status === 'ACCEPTED';
    _incDocLinesByDoc[docId] = lines;
    if (!_incQrVerificationByDoc[docId] || typeof _incQrVerificationByDoc[docId].units !== 'object') {
      _incQrVerificationByDoc[docId] = spFreshIncVerification();
    }
    const lineIds = lines.map((l) => l.line_id);
    const allQrVerified = isAccepted ? spIsDocQrVerified(docId, lines) : true;
    const hasUnitLines = spIncDocHasUnitScanLines(lines);
    spIncRenderDetailToolbar(doc, lines, lineIds);

    const lineRows = lines.map((l) => {
      const unitMode = spLineRequiresUnitScans(l);
      const verified = spIsLineQrVerified(docId, l);
      const v = _incQrVerificationByDoc[docId];
      const unitRowsFinal = unitMode && isAccepted
        ? (l.units || []).map((u) => {
          const uv = !!v.units[Number(u.unit_id)];
          return '<div id="sp-qr-u-' + u.unit_id + '" style="display:flex;align-items:center;gap:8px;font-size:11px;margin-top:4px;color:var(--text2)">' +
            '<span class="mono">' + escHtml(u.unit_barcode || String(u.unit_id)) + '</span>' +
            '<span class="b sp-unit-v-badge ' + (uv ? 'b-green' : 'b-gray') + '" style="font-size:10px">' + (uv ? 'Verified' : 'Pending') + '</span>' +
            '</div>';
        }).join('')
        : '';
      const lineBadge = isAccepted
        ? '<span id="sp-qr-v-' + l.line_id + '" class="b ' + (verified ? 'b-green' : 'b-gray') + '" style="white-space:nowrap">' +
          (unitMode
            ? (spIncVerifiedUnitCount(docId, l) + '/' + (l.units || []).length + ' units')
            : (verified ? 'QR Verified' : 'Pending QR')) +
          '</span>'
        : '';
      const recvVal = unitMode
        ? spIncVerifiedUnitCount(docId, l)
        : (l.qty_received != null ? l.qty_received : l.qty_sent);
      const recvInput = isAccepted
        ? '<input type="number" id="sp-recv-' + l.line_id + '" class="qty-input" min="0" max="' + l.qty_sent + '"' +
          ' value="' + recvVal + '" style="width:72px" placeholder="Rcvd"' +
          (unitMode ? ' readonly title="Set by verified unit scans"' : '') + '>'
        : (l.qty_received != null ? '<span class="b b-green" style="white-space:nowrap">Rcvd: ' + l.qty_received + '</span>' : '');
      return `
      <div class="inc-verify-line">
        <div style="flex:1;min-width:0">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:var(--acc)">${escHtml(l.sku_code)}</div>
          <div style="font-size:12px;color:var(--text2)">${escHtml(l.product_name)}${l.colour_name ? ' — ' + escHtml(l.colour_name) : ''}</div>
          ${unitRowsFinal}
        </div>
        <span style="font-size:12px;color:var(--text3);white-space:nowrap">Sent: <strong>${l.qty_sent}</strong></span>
        ${lineBadge}
        ${recvInput}
      </div>`;
    }).join('');

    let parentReqChip = '';
    if (doc.source_request_id) {
      try {
        const pr = await apiGet('/api/transfer-requests/' + doc.source_request_id);
        const ph = pr.data || pr;
        if (ph && ph.status) {
          parentReqChip = '<div class="cosmos-extended-detail__chip"><label>Request status</label><span class="b ' +
            (TR_STATUS_BADGE[ph.status] || 'b-gray') + '">' + escHtml(TR_STATUS_LABEL[ph.status] || ph.status) + '</span></div>';
        }
      } catch (_) { /* optional */ }
    }

    bodyEl.innerHTML = `
      <div style="padding:16px 20px">
        <div class="cosmos-extended-detail__chips">
          <div class="cosmos-extended-detail__chip"><label>Type</label><span>${doc.doc_type === 'REQUEST' ? 'Store Request' : 'Direct Transfer'}</span></div>
          ${doc.source_request_id ? '<div class="cosmos-extended-detail__chip"><label>Request #</label><span>' + doc.source_request_id + '</span></div>' : '<div class="cosmos-extended-detail__chip"><label>Request #</label><span>—</span></div>'}
          ${parentReqChip}
          <div class="cosmos-extended-detail__chip"><label>Items</label><span>${lines.length}</span></div>
          <div class="cosmos-extended-detail__chip"><label>Dispatched</label><span>${escHtml(fmtDate(doc.dispatched_at))}</span></div>
        </div>
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text2)">Line items</div>
        <div>${lineRows}</div>
        ${isAccepted ? `
          <p style="margin-top:14px;font-size:12px;color:var(--text3)">${hasUnitLines
            ? 'Use Open bucket in the toolbar to scan units on this transfer document. Verify &amp; Stock unlocks when every unit is verified.'
            : 'No unit list on this document — contact HQ to re-dispatch with unit scans.'}</p>
        ` : ''}
      </div>`;

  } catch (err) {
    bodyEl.innerHTML = `<div style="padding:20px;color:var(--red)">Error: ${escHtml(err.message)}</div>`;
    const actionsEl = document.getElementById('sp-inc-detail-actions');
    if (actionsEl) actionsEl.innerHTML = '';
  }
};

window.closeIncDetail = function () {
  stopIncQrCamera();
  if (typeof window.cosmosCloseExtendedDetail === 'function') {
    window.cosmosCloseExtendedDetail('sp-inc-detail', 'sp-inc-detail-backdrop');
  }

  // Clear any accidental sidebar overlay/body lock state.
  const overlayEl = document.getElementById('sp-sidebar-overlay')
  const sidebarEl = document.querySelector('.sidebar')
  const isSidebarOpen = !!(sidebarEl && sidebarEl.classList.contains('open'))
  const isOverlayOpen = !!(overlayEl && overlayEl.classList.contains('open'))
  const isBodyLocked = document.body.style.overflow === 'hidden'
  if (isSidebarOpen || isOverlayOpen || isBodyLocked) closeSidebar()
};

window.incAccept = async function (docId) {
  const msgEl = document.getElementById('sp-inc-action-msg');
  const btn = document.getElementById('sp-inc-accept-btn');
  if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
  if (msgEl) msgEl.textContent = '';

  try {
    await apiPut(`/api/stock-transfer-docs/${docId}/accept`, {});
    _incQrVerificationByDoc[docId] = spFreshIncVerification();
    if (msgEl) { msgEl.style.color = 'var(--green)'; msgEl.textContent = 'Accepted. Scan units with Open bucket, then Verify & Stock.'; }
    if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn);
    await expandIncTransfer(docId);
    spRefreshAfterIncomingAction();
  } catch (err) {
    if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Error: ' + err.message; }
    if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
    else if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
  }
};

window.incVerifyQr = async function (docId) {
  const msgEl = document.getElementById('sp-inc-action-msg');
  const inputEl = document.getElementById('sp-inc-qr-input');
  const rawValue = inputEl ? String(inputEl.value || '').trim() : '';
  if (!rawValue) {
    if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Scan or enter a QR/SKU value first.'; }
    return;
  }
  const isVerified = await _incProcessScannedQr(docId, rawValue);
  if (isVerified && inputEl) inputEl.value = '';
};

async function _incEnsureIncDocLines(docId) {
  let lines = _incDocLinesByDoc[docId] || [];
  const hasUnits = lines.some((l) => (l.units || []).length > 0);
  if (lines.length && hasUnits) return lines;
  try {
    const data = await apiGet('/api/stock-transfer-docs/' + docId);
    lines = data.data?.lines || lines;
    _incDocLinesByDoc[docId] = lines;
    if (lines.some((l) => (l.units || []).length > 0)) {
      await expandIncTransfer(docId);
    }
  } catch (_) { /* keep cached lines */ }
  return lines;
}

async function _incProcessScannedQr(docId, rawValue) {
  const msgEl = document.getElementById('sp-inc-action-msg');
  let lines = await _incEnsureIncDocLines(docId);
  if (!lines.length) {
    if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Document lines are not loaded yet.'; }
    return false;
  }

  const scanned = spNormalizeIncScan(rawValue);
  if (!scanned) return false;

  _incQrVerificationByDoc[docId] = _incQrVerificationByDoc[docId] || spFreshIncVerification();
  const v = _incQrVerificationByDoc[docId];
  const scanUpper = scanned.toUpperCase();

  const unitHit = spFindUnitOnDocLines(lines, scanned);
  if (unitHit) {
    const { line, unit: matchUnit } = unitHit;
    const uid = Number(matchUnit.unit_id);
    if (v.units[uid]) {
      if (msgEl) {
        msgEl.style.color = 'var(--gold)';
        msgEl.textContent = 'Unit ' + (matchUnit.unit_barcode || uid) + ' is already verified.';
      }
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Unit already verified');
      return false;
    }
    v.units[uid] = true;
    spIncRefreshLineUi(docId, line);
    spUpdateIncStockBtn(docId, lines);
    const allDone = spIsDocQrVerified(docId, lines);
    if (msgEl) {
      msgEl.style.color = 'var(--green)';
      msgEl.textContent = allDone
        ? '✓ All units verified. You can now Verify & Stock.'
        : '✓ Unit ' + (matchUnit.unit_barcode || uid) + ' verified. Scan remaining units.';
    }
    return true;
  }

  const matchedLine = lines.find((line) => {
    if (!spLineUsesSkuScanOnly(line)) return false;
    return String(line.sku_code || '').trim().toUpperCase() === scanUpper;
  });
  if (!matchedLine) {
    if (msgEl) {
      msgEl.style.color = 'var(--red)';
      msgEl.textContent = 'Scanned code ' + scanned + ' is not part of this transfer.';
    }
    return false;
  }

  const lineId = Number(matchedLine.line_id);
  if (v.lines[lineId]) {
    if (msgEl) { msgEl.style.color = 'var(--gold)'; msgEl.textContent = 'Line already verified.'; }
    return false;
  }
  v.lines[lineId] = true;
  spIncRefreshLineUi(docId, matchedLine);
  spUpdateIncStockBtn(docId, lines);
  const allQrVerified = spIsDocQrVerified(docId, lines);
  if (msgEl) {
    msgEl.style.color = 'var(--green)';
    msgEl.textContent = allQrVerified
      ? '✓ All lines verified. You can now Verify & Stock.'
      : '✓ ' + matchedLine.sku_code + ' verified. Continue scanning remaining items.';
  }
  return true;
}

window.startIncQrCamera = async function (docId) {
  const msgEl = document.getElementById('sp-inc-action-msg');
  const wrapEl = document.getElementById('sp-inc-camera-wrap');
  const videoEl = document.getElementById('sp-inc-camera-video');
  const lines = _incDocLinesByDoc[docId] || [];
  if (!lines.length || !videoEl || !wrapEl) {
    if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Open an accepted transfer with lines to start camera scan.'; }
    return;
  }
  const blockedReason = _getCameraStartBlockedReason()
  if (blockedReason) {
    if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = blockedReason; }
    return;
  }

  try {
    stopIncQrCamera();
    _incCameraDocId = docId;
    _incCameraDecodeMode = null;
    _incCameraDetector = null;
    _incCameraCanvas = null;
    _incCameraCanvasCtx = null;

    if ('BarcodeDetector' in window) {
      _incCameraDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
      _incCameraDecodeMode = 'native';
    } else {
      if (!window.jsQR) await _incLoadJsQrDecoder();
      if (!window.jsQR) throw new Error('QR decoder unavailable on this browser');
      _incCameraDecodeMode = 'jsqr';
      _incCameraCanvas = document.createElement('canvas');
      _incCameraCanvasCtx = _incCameraCanvas.getContext('2d', { willReadFrequently: true });
      if (!_incCameraCanvasCtx) throw new Error('Unable to initialise camera decoder');
    }

    _incCameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });
    videoEl.srcObject = _incCameraStream;
    wrapEl.style.display = '';
    const scanFrame = async () => {
      if (!_incCameraStream || _incCameraDocId !== docId) return;
      try {
        let scannedValue = '';
        if (_incCameraDecodeMode === 'native' && _incCameraDetector) {
          const codes = await _incCameraDetector.detect(videoEl);
          scannedValue = codes && codes.length && codes[0].rawValue ? codes[0].rawValue : '';
        } else if (_incCameraDecodeMode === 'jsqr' && _incCameraCanvas && _incCameraCanvasCtx && window.jsQR && videoEl.readyState >= 2) {
          const w = videoEl.videoWidth || 0;
          const h = videoEl.videoHeight || 0;
          if (w > 0 && h > 0) {
            _incCameraCanvas.width = w;
            _incCameraCanvas.height = h;
            _incCameraCanvasCtx.drawImage(videoEl, 0, 0, w, h);
            const imageData = _incCameraCanvasCtx.getImageData(0, 0, w, h);
            const code = window.jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
            scannedValue = code && code.data ? code.data : '';
          }
        }
        if (scannedValue) {
          const isVerified = await _incProcessScannedQr(docId, scannedValue);
          if (isVerified) {
            const inputEl = document.getElementById('sp-inc-qr-input');
            if (inputEl) inputEl.value = '';
          }
        }
      } catch (_) {}
      _incCameraRafId = requestAnimationFrame(scanFrame);
    };
    _incCameraRafId = requestAnimationFrame(scanFrame);
    if (msgEl) {
      msgEl.style.color = 'var(--green)';
      msgEl.textContent = _incCameraDecodeMode === 'native'
        ? 'Camera scanner started. Point camera at item QR code.'
        : 'Camera scanner started (compatibility mode). Point camera at item QR code.';
    }
  } catch (err) {
    stopIncQrCamera();
    if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = _getCameraErrorMessage(err); }
  }
};

async function _incLoadJsQrDecoder() {
  if (window.jsQR) return;
  if (window.__incJsQrLoadingPromise) {
    await window.__incJsQrLoadingPromise;
    return;
  }
  window.__incJsQrLoadingPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-sp-jsqr="1"]');
    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load QR decoder script')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    script.async = true;
    script.dataset.spJsqr = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load QR decoder script'));
    document.head.appendChild(script);
  });
  try {
    await window.__incJsQrLoadingPromise;
  } finally {
    window.__incJsQrLoadingPromise = null;
  }
}

window.stopIncQrCamera = function () {
  if (_incCameraRafId) {
    cancelAnimationFrame(_incCameraRafId);
    _incCameraRafId = null;
  }
  if (_incCameraStream) {
    _incCameraStream.getTracks().forEach((track) => track.stop());
    _incCameraStream = null;
  }
  _incCameraDocId = null;
  _incCameraDetector = null;
  _incCameraDecodeMode = null;
  _incCameraCanvas = null;
  _incCameraCanvasCtx = null;
  const wrapEl = document.getElementById('sp-inc-camera-wrap');
  const videoEl = document.getElementById('sp-inc-camera-video');
  if (wrapEl) wrapEl.style.display = 'none';
  if (videoEl) videoEl.srcObject = null;
};

window.incResetQrVerification = function (docId) {
  _incQrVerificationByDoc[docId] = spFreshIncVerification();
  const lines = _incDocLinesByDoc[docId] || [];
  lines.forEach((line) => {
    spIncRefreshLineUi(docId, line);
    if (spLineRequiresUnitScans(line)) {
      const recvEl = document.getElementById('sp-recv-' + line.line_id);
      if (recvEl) { recvEl.value = '0'; recvEl.readOnly = true; }
    }
  });
  spUpdateIncStockBtn(docId, lines);
  const msgEl = document.getElementById('sp-inc-action-msg');
  if (msgEl) { msgEl.style.color = 'var(--text2)'; msgEl.textContent = 'Verification reset. Scan all units or SKUs again.'; }
};

window.incStock = async function (docId, lineIds) {
  const msgEl = document.getElementById('sp-inc-action-msg');
  if (msgEl) msgEl.textContent = '';
  const linesMeta = _incDocLinesByDoc[docId] || [];
  if (!spIsDocQrVerified(docId, linesMeta)) {
    if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Please verify all units (or SKUs for bulk lines) before stocking.'; }
    if (typeof cosmosToastError === 'function') cosmosToastError('Complete unit/SKU verification first');
    return;
  }

  const lines = lineIds.map((lid) => {
    const input = document.getElementById(`sp-recv-${lid}`);
    return { line_id: lid, qty_received: input ? Math.max(0, Number(input.value) || 0) : 0 };
  });

  const btn = document.getElementById('sp-inc-stock-btn');
  if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);

  try {
    await apiPut(`/api/stock-transfer-docs/${docId}/stock`, { lines });
    delete _incQrVerificationByDoc[docId];
    if (msgEl) { msgEl.style.color = 'var(--green)'; msgEl.textContent = 'Stock credited to your store balance.'; }
    if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn);
    await expandIncTransfer(docId);
    spRefreshAfterIncomingAction();
  } catch (err) {
    if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Error: ' + err.message; }
    if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
    else if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
  }
};

window.expandSpMlDoc = window.expandIncTransfer;

// ══════════════════════════════════════════════════════════════════════════════
// INVOICES — store-scoped, last 7 days / global search
// ══════════════════════════════════════════════════════════════════════════════

let _spInvDebounce = null;
let _spInvLastQ    = null;
let _spInvRows     = [];

function fmtRupeesInv(v) {
  const n = Number(v) || 0;
  return '₹\u202F' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function spInvFormatDateTime(v) {
  if (!v) return '';
  const d = new Date(v);
  const date = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
  return date + ' · ' + time;
}

window.loadSpInvoices = async function (q) {
  const searchQ = q !== undefined ? q : (document.getElementById('sp-invoice-search') || {}).value || '';
  _spInvLastQ = searchQ.trim();
  const container = document.getElementById('sp-invoices-list');
  if (!container) return;
  if (typeof cosmosSkeletonCards === 'function') cosmosSkeletonCards('sp-invoices-list', 6);
  try {
    const qs = _spInvLastQ ? '?q=' + encodeURIComponent(_spInvLastQ) : '?days=7';
    const res = await apiGet('/api/pos/invoices' + qs);
    const rows = Array.isArray(res.data) ? res.data : [];
    _spInvRows = rows;
    if (!rows.length) {
      const msg = _spInvLastQ
        ? 'No invoices matching \u201C' + escHtml(_spInvLastQ) + '\u201D.'
        : 'No invoices in the last 7 days.';
      container.innerHTML =
        '<div class="empty" style="padding:40px 20px;text-align:center">' +
        '<div class="empty-ic">🧾</div>' +
        '<div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">No invoices found</div>' +
        '<div style="font-size:13px;color:var(--text2)">' + msg + '</div></div>';
      return;
    }
    let html = '<div class="sp-inv-grid">';
    for (const r of rows) {
      const inv  = escHtml(r.invoice_no || r.order_no || '—');
      const cust = escHtml(r.customer_name || 'Customer');
      const ph   = escHtml(r.customer_phone || '');
      const total = fmtRupeesInv(r.total_amount);
      const dt   = spInvFormatDateTime(r.created_at);
      const oid  = Number(r.order_id);
      html +=
        '<div class="sp-inv-card" role="article">' +
          '<div class="sp-inv-card-top">' +
            '<div class="sp-inv-no">' + inv + '</div>' +
            '<div class="sp-inv-date">' + escHtml(dt) + '</div>' +
          '</div>' +
          '<div class="sp-inv-cust">' + cust + '</div>' +
          (ph ? '<div class="sp-inv-phone">' + ph + '</div>' : '') +
          '<div class="sp-inv-card-bot">' +
            '<div class="sp-inv-total">' + total + '</div>' +
            '<button type="button" class="sp-inv-share" aria-label="Share invoice ' + inv + '"' +
              ' onclick="shareSpInvoice(' + oid + ', this)">' +
              '↗ Share</button>' +
          '</div>' +
        '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<div style="padding:16px;color:var(--red)">' + escHtml(err.message) + '</div>';
    if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
  }
};

window.onSpInvoiceSearch = function (val) {
  clearTimeout(_spInvDebounce);
  _spInvDebounce = setTimeout(function () { window.loadSpInvoices(val); }, 400);
};

function spInvCsvDateParts(createdAt) {
  if (!createdAt) return { date: '', time: '' };
  const d = new Date(createdAt);
  return {
    date: d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    time: d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })
  };
}

function spInvoiceListToCsvRows(rows) {
  const headers = [
    'Invoice No',
    'Order No',
    'Date',
    'Time',
    'Customer Name',
    'Customer Mobile',
    'Order Kind',
    'Status',
    'Subtotal',
    'GST',
    'Total',
    'Amount Paid',
    'Balance Due'
  ];
  const data = (rows || []).map(function (r) {
    const dt = spInvCsvDateParts(r.created_at);
    return [
      r.invoice_no || '',
      r.order_no || '',
      dt.date,
      dt.time,
      r.customer_name || '',
      r.customer_phone || '',
      r.order_kind || '',
      r.status || '',
      Number(r.subtotal_amount) || 0,
      Number(r.gst_amount) || 0,
      Number(r.total_amount) || 0,
      Number(r.amount_paid) || 0,
      Number(r.amount_remaining) || 0
    ];
  });
  return { headers: headers, data: data };
}

window.exportSpInvoicesCsv = async function () {
  if (typeof window.cosmosDownloadCsv !== 'function') {
    if (typeof cosmosToastError === 'function') cosmosToastError('CSV export is not available.');
    return;
  }
  const searchQ = ((document.getElementById('sp-invoice-search') || {}).value || '').trim();
  try {
    const params = new URLSearchParams();
    if (searchQ) params.set('q', searchQ);
    else params.set('days', '7');
    params.set('limit', '500');
    const res = await apiGet('/api/pos/invoices?' + params.toString());
    const rows = Array.isArray(res.data) ? res.data : [];
    if (!rows.length) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('No invoices to export for the current filters.');
      return;
    }
    const built = spInvoiceListToCsvRows(rows);
    const day = typeof istToday === 'function' ? istToday() : new Date().toISOString().slice(0, 10);
    window.cosmosDownloadCsv('store-invoices-' + day + '.csv', built.headers, built.data);
    if (typeof cosmosToastSuccess === 'function') {
      cosmosToastSuccess('Exported ' + rows.length + ' invoice(s) to CSV.');
    }
  } catch (err) {
    if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
  }
};

// ── Canvas receipt render + share (rich detail via API) ───────────────────────

window.shareSpInvoice = async function (orderId, btnEl) {
  const btn = btnEl || (typeof event !== 'undefined' && event.currentTarget ? event.currentTarget : null);
  if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
  try {
    if (typeof window.cosmosBuildInvoiceReceiptCanvas !== 'function') {
      throw new Error('Invoice share module not loaded.');
    }
    let detail = null
    try {
      const res = await apiGet('/api/pos/invoices/' + orderId)
      detail = res.data
    } catch (invErr) {
      const resOrd = await apiGet('/api/pos/orders/' + orderId)
      detail = resOrd.data
    }
    if (!detail) throw new Error('Invoice detail not found.');
    const canvas = window.cosmosBuildInvoiceReceiptCanvas(detail, 'storepilot');
    const invNo = detail.invoice_no || (detail.order && detail.order.invoice_no) || '';
    const cust = (detail.customer && detail.customer.full_name) || '';
    const total = (detail.payment_summary && detail.payment_summary.total_amount) != null
      ? detail.payment_summary.total_amount
      : (detail.order && detail.order.total_amount);
    const shareText = cust + (total != null ? ' — ' + fmtRupeesInv(total) : '');
    await window.cosmosShareInvoiceCanvas(canvas, invNo, shareText);
    if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
  } catch (err) {
    if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
  }
};
