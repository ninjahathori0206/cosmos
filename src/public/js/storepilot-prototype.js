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
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' });
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
  'incoming-transfers': ['storepilot.transfers.view', 'foundry.transfers.view'],
  'movement-list': ['storepilot.transfers.view', 'foundry.transfers.view'],
  'transfers-history': ['storepilot.transfers.view', 'foundry.transfers.view'],
  reports: ['storepilot.reports.view']
};

// ── Breadcrumb map ─────────────────────────────────────────────────────────────
const spBcMap = {
  dashboard:              'Dashboard',
  'stock-browse':         'Stock View — Browse Catalogue',
  'store-catalogue':      'Stock View — Store Catalogue',
  'transfers-history':    'Foundry Connect — My Requests',
  'transfers-create':     'Foundry Connect — Request Goods',
  'incoming-transfers':   'Foundry Connect — Incoming Goods',
  'movement-list':        'Foundry Connect — Movement List',
  reports:                'Store Reports',
  'lab-orders':           'Lab Orders'
};

const SP_PAGE_PATHS = {
  dashboard: '/storepilot/dashboard',
  'stock-browse': '/storepilot/stock-browse',
  'store-catalogue': '/storepilot/store-catalogue',
  'transfers-history': '/storepilot/transfers-history',
  'transfers-create': '/storepilot/transfers-create',
  reports: '/storepilot/reports',
  'incoming-transfers': '/storepilot/incoming-transfers',
  'movement-list': '/storepilot/movement-list',
  'lab-orders': '/storepilot/lab-orders'
};

function getStorepilotPageFromPath(pathname) {
  const normalized = String(pathname || '').replace(/\/+$/, '') || '/storepilot';
  const exact = Object.entries(SP_PAGE_PATHS).find(([, route]) => route === normalized);
  if (exact) return exact[0];
  if (normalized === '/storepilot') return 'dashboard';
  return 'dashboard';
}

function getStorepilotNavEl(id) {
  return document.querySelector(`.sidebar-nav .nav-item[onclick*="spNav('${id}'"]`) || null;
}

// ── Navigation ─────────────────────────────────────────────────────────────────
window.spNav = function (id, el, options) {
  const navOptions = options || {};
  if (_spNoAccess) return;
  if (!canAccessSpView(id)) {
    renderNoAccessState('menu_access_denied');
    return;
  }
  document.querySelectorAll('.main .page').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav .nav-item').forEach((n) => n.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  if (el) el.classList.add('active');
  const bc = document.getElementById('sp-bc');
  if (bc) bc.textContent = spBcMap[id] || id;
  const nextPath = SP_PAGE_PATHS[id] || '/storepilot/dashboard';
  if (!navOptions.fromHistory && window.location.pathname !== nextPath) {
    window.history.pushState({ module: 'storepilot', page: id }, '', nextPath);
  }
  closeSidebar();
  loadStorePilotPage(id);
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
  if (id === 'transfers-history')  window.loadTransferHistory();
  if (id === 'transfers-create')   initTransferCreate();
  if (id === 'reports')            loadReports();
  if (id === 'incoming-transfers') loadIncomingTransfers();
  if (id === 'movement-list')      loadSpMovementList();
  if (id === 'lab-orders')         loadSpLabOrders();
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
      let blocks = []
      if (hasReady && canMutate) {
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

window.openSpHandoverModal = async function (orderId) {
  if (!canStorePilotManageLab()) {
    if (typeof cosmosToastWarn === 'function') {
      cosmosToastWarn('No permission for lab handover — assign StorePilot · Lab Orders — Manage for this role.')
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
    if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn)
    window.closeSpHandoverModal()
    const invMsg = res.data && res.data.invoice_no ? ' Invoice: ' + res.data.invoice_no + '.' : ''
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

/** Strict: require storepilot.lab.manage. Legacy: open mutations unless role has granular lab keys (then manage required). */
function canStorePilotManageLab() {
  const strict =
    typeof window.cosmosRbacStrictEmptyPerms === 'function'
      ? window.cosmosRbacStrictEmptyPerms()
      : true
  if (strict) {
    return _spPermissions.includes('storepilot.lab.manage')
  }
  if (!spJwtHasGranularLab()) return true
  return _spPermissions.includes('storepilot.lab.manage')
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
    while (sibling && !sibling.classList.contains('nav-group') && sibling.id !== 'sp-switch-module-wrap') {
      if (sibling.classList.contains('nav-item') && sibling.hasAttribute('data-storepilot-menu')) items.push(sibling);
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
  if (typeof window.cosmosLoadRbacBootstrap === 'function') {
    await window.cosmosLoadRbacBootstrap()
  }
  loadUser();
  if (_spNoAccess) return;
  await refreshWarehouseContext();
  loadDashboard();
  startDashRefresh();
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
    if (typeof window.applyCosmosModuleSwitchNav === 'function') {
      window.applyCosmosModuleSwitchNav('sp-switch-module-wrap', u);
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
  if (lastEl) lastEl.textContent = 'Loading…';

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
  const navItem = document.querySelector('.sidebar-nav .nav-item[onclick*="transfers-create"]');
  window.spNav('transfers-create', navItem || null);
  setTimeout(() => window.prefillTransferSku(skuId, skuCode, desc), 50);
};

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
  const navItem = document.querySelector('.sidebar-nav .nav-item[onclick*="transfers-create"]');
  window.spNav('transfers-create', navItem || null);
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
    const categoryTotals = {};

    rows.forEach((row) => {
      const rowQty = Math.max(0, Number(row.store_qty) || 0);
      const brandKey = (row.brand_name || 'Unbranded').trim();
      const categoryKey = (row.product_type || 'Uncategorized').trim();
      brandTotals[brandKey] = (brandTotals[brandKey] || 0) + rowQty;
      categoryTotals[categoryKey] = (categoryTotals[categoryKey] || 0) + rowQty;
    });

    const toSortedList = (totalsObj) => Object.entries(totalsObj)
      .sort((a, b) => b[1] - a[1])
      .map(([label, qty]) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text2)">${escHtml(label)}</span><span class="b ${qty > 0 ? 'b-green' : 'b-gray'}">${qty}</span></div>`)
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
            ${toSortedList(brandTotals) || '<span style="color:var(--text3)">No brand stock found</span>'}
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
  SUBMITTED:  'b-gold',
  APPROVED:   'b-blue',
  DISPATCHED: 'b-orange',
  RECEIVED:   'b-green',
  REJECTED:   'b-red'
};

let _spTrFilter = '';

window.setSpTrFilter = function (status, btn) {
  _spTrFilter = status;
  document.querySelectorAll('#page-transfers-history .btn.sm[id^="sp-tr-tab-"]').forEach((b) => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadTransferHistory();
};

window.loadTransferHistory = async function () {
  const wrap = document.getElementById('tr-history-wrap');
  showErr('fmov-err', '');
  if (wrap) wrap.innerHTML = `<div class="empty-state"><div class="ei">⏳</div><div class="et">Loading…</div></div>`;

  try {
    const qs = new URLSearchParams({ top_n: 100 });
    if (_spTrFilter) qs.set('status', _spTrFilter);
    const data = await apiGet('/api/transfer-requests?' + qs.toString());
    const rows = data.data || [];

    if (!rows.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="ei">📬</div><div class="et">No transfer requests${_spTrFilter ? ' with status ' + _spTrFilter : ''}</div></div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="tw">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Submitted</th>
              <th>Items</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r) => `
              <tr style="cursor:pointer" onclick="expandSpTrRequest(${r.request_id})">
                <td class="mono" style="font-weight:600;color:var(--acc)">#${r.request_id}</td>
                <td>${fmtDate(r.created_at)}</td>
                <td><span class="b b-gray">${r.line_count} SKU${r.line_count !== 1 ? 's' : ''}</span></td>
                <td><span class="b ${TR_STATUS_BADGE[r.status] || 'b-gray'}">${r.status}</span></td>
                <td style="font-size:12px;color:var(--text3)">${fmtDate(r.updated_at)}</td>
                <td>
                  ${r.status === 'DISPATCHED'
                    ? `<button class="btn sm primary" onclick="event.stopPropagation();spConfirmReceipt(${r.request_id})">✓ Confirm Receipt</button>`
                    : ''}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    showErr('fmov-err', 'Failed to load transfer requests: ' + err.message);
    if (wrap) wrap.innerHTML = '';
  }
};

window.expandSpTrRequest = async function (requestId) {
  const panel = document.getElementById('sp-tr-detail');
  const body  = document.getElementById('sp-tr-detail-body');
  const title = document.getElementById('sp-tr-detail-title');
  if (!panel) return;
  if (title) title.textContent = `Request #${requestId}`;
  if (body)  body.innerHTML = '<div style="padding:16px;color:var(--text3)">Loading…</div>';
  panel.style.display = '';

  try {
    const data = await apiGet(`/api/transfer-requests/${requestId}`);
    const req  = data.data;

    const linesHtml = (req.lines || []).map((l) => `
      <tr>
        <td class="mono">${escHtml(l.sku_code)}</td>
        <td>${escHtml(l.description || '')}</td>
        <td style="text-align:right"><span class="b b-gray">${l.requested_qty}</span></td>
        <td style="text-align:right">${l.approved_qty   != null ? `<span class="b b-blue">${l.approved_qty}</span>`   : '<span style="color:var(--text3)">—</span>'}</td>
        <td style="text-align:right">${l.dispatched_qty != null ? `<span class="b b-orange">${l.dispatched_qty}</span>` : '<span style="color:var(--text3)">—</span>'}</td>
        <td style="text-align:right">${l.received_qty   != null ? `<span class="b b-green">${l.received_qty}</span>`   : '<span style="color:var(--text3)">—</span>'}</td>
      </tr>`).join('');

    body.innerHTML = `
      <div style="padding:16px 20px">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
          <span class="b ${TR_STATUS_BADGE[req.status] || 'b-gray'}">${req.status}</span>
          ${req.reviewed_at  ? `<span style="font-size:12px;color:var(--text2)">Reviewed: ${fmtDate(req.reviewed_at)}</span>` : ''}
          ${req.dispatched_at ? `<span style="font-size:12px;color:var(--text2)">Dispatched: ${fmtDate(req.dispatched_at)}</span>` : ''}
          ${req.received_at  ? `<span style="font-size:12px;color:var(--text2)">Received: ${fmtDate(req.received_at)}</span>` : ''}
          ${req.review_notes ? `<span style="font-size:12px;color:var(--text2)">Note: <em>${escHtml(req.review_notes)}</em></span>` : ''}
        </div>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>SKU</th><th>Description</th>
                <th style="text-align:right">Requested</th>
                <th style="text-align:right">Approved</th>
                <th style="text-align:right">Dispatched</th>
                <th style="text-align:right">Received</th>
              </tr>
            </thead>
            <tbody>${linesHtml}</tbody>
          </table>
        </div>
        ${req.status === 'DISPATCHED' ? `
          <div style="margin-top:14px">
            <button class="btn primary" onclick="spConfirmReceipt(${req.request_id})">✓ Confirm Receipt</button>
            <span id="sp-tr-detail-msg" style="font-size:12px;margin-left:10px"></span>
          </div>` : ''}
      </div>`;
  } catch (err) {
    if (body) body.innerHTML = `<div style="padding:16px;color:var(--red)">Error: ${escHtml(err.message)}</div>`;
  }
};

window.closeSpTrDetail = function () {
  const panel = document.getElementById('sp-tr-detail');
  if (panel) panel.style.display = 'none';
};

window.spConfirmReceipt = async function (requestId) {
  const msgEl = document.getElementById('sp-tr-detail-msg');
  try {
    await apiPost(`/api/transfer-requests/${requestId}/status`, { status: 'RECEIVED' });
    if (msgEl) { msgEl.style.color = 'var(--green)'; msgEl.textContent = '✓ Receipt confirmed.'; }
    setTimeout(() => { loadTransferHistory(); window.closeSpTrDetail(); }, 1200);
  } catch (err) {
    if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Error: ' + err.message; }
    else        { alert('Error: ' + err.message); }
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

window.onTransferSearch = function (q) {
  clearTimeout(_tcDebounce);
  const resultsEl = document.getElementById('tc-results');
  if (!q.trim()) {
    if (resultsEl) resultsEl.innerHTML = `<div class="empty-state"><div class="ei">🔍</div><div class="et">Search to see stock available at ${primaryWarehouseLabelHtml()}</div></div>`;
    return;
  }
  _tcDebounce = setTimeout(() => doTransferSearch(q.trim()), 350);
};

async function doTransferSearch(q) {
  const spin      = document.getElementById('tc-spin');
  const resultsEl = document.getElementById('tc-results');
  showErr('tc-err', '');
  if (spin) spin.style.display = 'inline';
  try {
    const data = await apiGet('/api/stock-transfers/available?q=' + encodeURIComponent(q));
    const rows = data.data || [];
    if (!rows.length) {
      resultsEl.innerHTML = `<div class="empty-state"><div class="ei">📦</div><div class="et">No ${primaryWarehouseLabelHtml()} stock found for "${escHtml(q)}"</div></div>`;
      return;
    }
    resultsEl.innerHTML = rows.map((r) => {
      const inCart    = _transferCart.some((c) => c.sku_id === r.sku_id);
      // API returns warehouse_qty from sp_StockTransfer_ListAvailable
      const hasWarehouseQty = r.warehouse_qty != null;
      const warehouseQty = hasWarehouseQty ? Number(r.warehouse_qty) : (isStockAvailable(r, ['warehouse_qty']) ? 1 : 0);
      const displayName  = r.product_name  || r.description || r.brand_name || '';
      const colourPart   = r.colour_name   ? ` — ${r.colour_name}` : '';
      const availLabel = hasWarehouseQty ? `${warehouseQty} in Warehouse` : (warehouseQty > 0 ? 'Warehouse Available' : 'Warehouse Unavailable');
      return `
        <div class="avail-row">
          <div style="flex:1;min-width:0">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:var(--acc)">${escHtml(r.sku_code)}</div>
            <div style="font-size:12.5px;color:var(--text2);margin-top:2px">${escHtml(displayName + colourPart)}</div>
          </div>
          <span class="b ${warehouseQty > 0 ? 'b-green' : 'b-red'}" style="white-space:nowrap">${availLabel}</span>
          <button class="btn sm ${inCart ? '' : 'primary'}" style="min-width:64px"
            data-sku-id="${r.sku_id}"
            data-sku-code="${escHtml(r.sku_code)}"
            data-sku-desc="${escHtml(displayName + colourPart)}"
            data-avail="${warehouseQty}"
            onclick="addToCartFromBtn(this)"
            ${inCart ? 'disabled' : ''}>
            ${inCart ? '✓ Added' : '+ Add'}
          </button>
        </div>`;
    }).join('');
  } catch (err) {
    showErr('tc-err', 'Search failed: ' + err.message);
    if (resultsEl) resultsEl.innerHTML = '';
  } finally {
    if (spin) spin.style.display = 'none';
  }
}

window.addToCartFromBtn = function (btn) {
  const skuId   = Number(btn.dataset.skuId);
  const skuCode = btn.dataset.skuCode || '';
  const desc    = btn.dataset.skuDesc || '';
  const avail   = Number(btn.dataset.avail) || 9999;
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
          onchange="updateCartQty(${item.sku_id}, this.value)" oninput="updateCartQty(${item.sku_id}, this.value)">
        <span style="font-size:11px;color:var(--text3)" title="Available in ${primaryWarehouseTitleAttr()}">/ ${item.avail_qty} WH</span>
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
    if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'No store assigned to your account.'; }
    return;
  }
  if (!_transferCart.length) {
    if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Add at least one item to the request.'; }
    return;
  }

  const notes = (document.getElementById('tc-notes') || {}).value || null;
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }
  if (msgEl) { msgEl.textContent = ''; msgEl.style.color = ''; }

  try {
    const lines = _transferCart.map((c) => ({ sku_id: c.sku_id, qty: Math.max(1, Number(c.qty) || 1) }));
    await apiPost('/api/transfer-requests', { store_id: _storeId, lines, notes: notes || null });

    _transferCart = [];
    renderTransferCart();
    const si = document.getElementById('tc-search');   if (si) si.value = '';
    const ri = document.getElementById('tc-results');
    if (ri) ri.innerHTML = `<div class="empty-state"><div class="ei">🔍</div><div class="et">Search to see stock available at ${primaryWarehouseLabelHtml()}</div></div>`;
    const ni = document.getElementById('tc-notes');     if (ni) ni.value = '';

    if (msgEl) { msgEl.style.color = 'var(--green)'; msgEl.textContent = '✓ Request submitted — pending HQ approval.'; }
    setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 5000);
  } catch (err) {
    if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Error: ' + err.message; }
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit request'; }
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

// ── Incoming Transfers ─────────────────────────────────────────────────────────

let _incFilter = '';
/** @type {Record<number, { units: Record<number, boolean>, lines: Record<number, boolean> }>} */
let _incQrVerificationByDoc = {};
let _incDocLinesByDoc = {};

function spNormUnitBarcode(bc) {
  const s = String(bc || '').trim();
  if (/^\d+$/.test(s)) return s.padStart(7, '0');
  return s;
}

function spLineRequiresUnitScans(line) {
  if (!line) return false;
  const units = Array.isArray(line.units) ? line.units : [];
  return units.length > 0;
}

function spFindUnitOnDocLines(lines, scanned) {
  const norm = spNormUnitBarcode(scanned);
  const scanRaw = String(scanned || '').trim();
  for (const line of lines) {
    for (const u of (line.units || [])) {
      const bc = spNormUnitBarcode(u.unit_barcode);
      if (bc === norm || String(u.unit_id) === scanRaw) return { line, unit: u };
    }
  }
  return null;
}

function spNormalizeIncScan(raw) {
  let s = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const qSku = u.searchParams.get('sku') || u.searchParams.get('code') || u.searchParams.get('unit');
      if (qSku) return qSku.trim();
      const parts = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
      if (parts.length) return decodeURIComponent(parts[parts.length - 1]);
    } catch (_) { /* ignore */ }
  }
  if (s.startsWith('{') && s.endsWith('}')) {
    try {
      const parsed = JSON.parse(s);
      const unitBc = parsed.unit_barcode || parsed.unit || parsed.barcode;
      if (unitBc) return String(unitBc).trim();
      return String(parsed.sku_code || parsed.sku || parsed.code || '').trim() || s;
    } catch (_) { /* ignore */ }
  }
  if (/^\d{1,7}$/.test(s)) return s.padStart(7, '0');
  return s;
}

function spFreshIncVerification() {
  return { units: {}, lines: {} };
}

function spIsLineQrVerified(docId, line) {
  const v = _incQrVerificationByDoc[docId] || spFreshIncVerification();
  if (spLineRequiresUnitScans(line)) {
    const units = line.units || [];
    return units.length > 0 && units.every((u) => v.units[Number(u.unit_id)]);
  }
  return !!v.lines[Number(line.line_id)];
}

function spIsDocQrVerified(docId, lines) {
  if (!lines.length) return true;
  return lines.every((line) => spIsLineQrVerified(docId, line));
}

function spUpdateIncStockBtn(docId, lines) {
  const stockBtn = document.getElementById('sp-inc-stock-btn');
  if (stockBtn) stockBtn.disabled = !spIsDocQrVerified(docId, lines);
}

function spIncVerifiedUnitCount(docId, line) {
  const v = _incQrVerificationByDoc[docId] || spFreshIncVerification();
  return (line.units || []).filter((u) => v.units[Number(u.unit_id)]).length;
}

function spLineUsesSkuScanOnly(line) {
  if (!line) return true;
  const units = Array.isArray(line.units) ? line.units : [];
  return units.length === 0;
}

function spIncRefreshLineUi(docId, line) {
  const lineId = line.line_id;
  const verified = spIsLineQrVerified(docId, line);
  const badgeEl = document.getElementById('sp-qr-v-' + lineId);
  if (badgeEl) {
    if (spLineRequiresUnitScans(line)) {
      const n = spIncVerifiedUnitCount(docId, line);
      const total = (line.units || []).length;
      badgeEl.className = 'b ' + (verified ? 'b-green' : 'b-gray');
      badgeEl.textContent = n + '/' + total + ' units';
    } else {
      badgeEl.className = 'b ' + (verified ? 'b-green' : 'b-gray');
      badgeEl.textContent = verified ? 'QR Verified' : 'Pending QR';
    }
  }
  (line.units || []).forEach((u) => {
    const rowEl = document.getElementById('sp-qr-u-' + u.unit_id);
    if (!rowEl) return;
    const uv = !!((_incQrVerificationByDoc[docId] || spFreshIncVerification()).units[Number(u.unit_id)]);
    const badge = rowEl.querySelector('.sp-unit-v-badge');
    if (badge) {
      badge.className = 'b sp-unit-v-badge ' + (uv ? 'b-green' : 'b-gray');
      badge.textContent = uv ? 'Verified' : 'Pending';
    }
  });
  const recvEl = document.getElementById('sp-recv-' + lineId);
  if (recvEl && spLineRequiresUnitScans(line)) {
    recvEl.value = String(spIncVerifiedUnitCount(docId, line));
    recvEl.readOnly = true;
  }
}

function spIncDocHasUnitScanLines(lines) {
  return (lines || []).some((l) => spLineRequiresUnitScans(l));
}

function _spApplyBucketReceiveResult(docId, result) {
  const lines = _incDocLinesByDoc[docId] || [];
  _incQrVerificationByDoc[docId] = spFreshIncVerification();
  (result.scanned || []).forEach((s) => {
    const hit = spFindUnitOnDocLines(lines, s.unit_barcode || String(s.unit_id));
    if (hit && hit.unit && hit.unit.unit_id) {
      _incQrVerificationByDoc[docId].units[Number(hit.unit.unit_id)] = true;
    }
  });
  lines.forEach((l) => {
    spIncRefreshLineUi(docId, l);
    const recvInp = document.getElementById('sp-recv-' + l.line_id);
    if (recvInp && spLineRequiresUnitScans(l)) {
      recvInp.value = spIncVerifiedUnitCount(docId, l);
    }
  });
  spUpdateIncStockBtn(docId, lines);
  const msgEl = document.getElementById('sp-inc-action-msg');
  const sc = result.score || {};
  if (msgEl) {
    if (sc.total > 0 && sc.verified === sc.total) {
      msgEl.style.color = 'var(--green)';
      msgEl.textContent = '✓ All units verified. You can Verify & Stock.';
    } else {
      msgEl.style.color = 'var(--text2)';
      msgEl.textContent = (sc.verified || 0) + ' / ' + (sc.total || 0) + ' units verified.';
    }
  }
}

window.openIncomingTransferBucket = function openIncomingTransferBucket(docId) {
  const lines = _incDocLinesByDoc[docId] || [];
  const expected = [];
  lines.forEach((l) => {
    (l.units || []).forEach((u) => {
      expected.push({
        unit_barcode: u.unit_barcode,
        unit_id: u.unit_id,
        sku_code: l.sku_code,
        sku_id: l.sku_id,
        line_id: l.line_id
      });
    });
  });
  if (!expected.length) {
    if (typeof cosmosToastError === 'function') {
      cosmosToastError('No units on this transfer document. Ask HQ to re-dispatch with unit scans.');
    }
    return;
  }
  if (typeof window.openBucket !== 'function') {
    if (typeof cosmosToastError === 'function') cosmosToastError('Scan bucket is not loaded.');
    return;
  }
  stopIncQrCamera();
  window.openBucket({
    mode: 'RECEIVE',
    sessionId: docId,
    label: 'Transfer #' + docId,
    expected,
    onSubmit(result) {
      _spApplyBucketReceiveResult(docId, result);
    }
  });
};
let _incCameraStream = null;
let _incCameraRafId = null;
let _incCameraDocId = null;
let _incCameraDetector = null;
let _incCameraDecodeMode = null;
let _incCameraCanvas = null;
let _incCameraCanvasCtx = null;

function _isCameraSecureOrigin() {
  const host = window.location && window.location.hostname ? window.location.hostname.toLowerCase() : ''
  const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
  return !!window.isSecureContext || isLocalHost
}

function _getCameraStartBlockedReason() {
  if (!_isCameraSecureOrigin()) {
    return 'Camera requires HTTPS or localhost. Open this app on secure URL and retry. Use scanner input as fallback.'
  }
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
    return 'Camera API is unavailable in this browser. Use scanner input to verify SKUs.'
  }
  return ''
}

function _getCameraErrorMessage(err) {
  const errName = err && err.name ? err.name : ''
  if (errName === 'NotAllowedError' || errName === 'SecurityError') {
    return 'Camera permission denied or blocked. Allow camera for this site and ensure you are on HTTPS or localhost.'
  }
  if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
    return 'No camera device found. Connect a camera or use scanner input.'
  }
  if (errName === 'NotReadableError' || errName === 'TrackStartError') {
    return 'Camera is busy in another app/tab. Close it there and retry.'
  }
  if (errName === 'OverconstrainedError' || errName === 'ConstraintNotSatisfiedError') {
    return 'Requested camera settings are unsupported on this device. Try another browser/device or scanner input.'
  }
  return 'Unable to start camera scanner. Check permissions and secure origin (HTTPS/localhost).'
}

const INC_STATUS_BADGE = {
  DISPATCHED: '<span class="b b-orange">Dispatched</span>',
  ACCEPTED:   '<span class="b b-blue">Accepted</span>',
  STOCKED:    '<span class="b b-green">Stocked</span>'
};

window.setIncFilter = function (status, btn) {
  _incFilter = status;
  document.querySelectorAll('[id^="sp-inc-tab-"]').forEach((b) => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadIncomingTransfers();
};

window.loadIncomingTransfers = async function () {
  const listEl = document.getElementById('sp-inc-list');
  const badge  = document.getElementById('sp-inc-badge');
  showErr('sp-inc-err', '');
  if (listEl && typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('sp-inc-list', 6);
  else if (listEl) listEl.innerHTML = '';

  try {
    const qs = new URLSearchParams({ top_n: 100 });
    if (_incFilter) qs.set('status', _incFilter);
    const data = await apiGet('/api/stock-transfer-docs?' + qs.toString());
    const rows = data.data || [];

    // Update nav badge with DISPATCHED count
    const pendingCount = rows.filter((r) => r.status === 'DISPATCHED').length;
    if (badge) {
      badge.textContent = pendingCount || '';
      badge.style.display = pendingCount ? '' : 'none';
    }

    if (!rows.length) {
      if (listEl) listEl.innerHTML = '<div class="empty-state"><div class="ei">📭</div><div class="et">No incoming transfers</div></div>';
      return;
    }

    if (listEl) {
      listEl.innerHTML = rows.map((r) => `
        <div class="inc-tr-row" onclick="expandIncTransfer(${r.doc_id})">
          <div class="inc-tr-meta">
            <div class="inc-tr-id">Transfer #${r.doc_id}
              <span style="font-weight:400;color:var(--text3);font-size:11px;margin-left:6px">${r.doc_type === 'REQUEST' ? '(via request)' : '(direct)'}</span>
            </div>
            <div class="inc-tr-sub">${fmtDate(r.dispatched_at)} &middot; ${escHtml(r.line_count)} item${r.line_count !== 1 ? 's' : ''} &middot; by ${escHtml(r.dispatched_by_name || 'HQ')}</div>
          </div>
          ${INC_STATUS_BADGE[r.status] || r.status}
        </div>`).join('');
    }
  } catch (err) {
    showErr('sp-inc-err', 'Failed to load incoming transfers: ' + err.message);
    if (listEl) listEl.innerHTML = '';
  }
};

window.expandIncTransfer = async function (docId) {
  const detailEl = document.getElementById('sp-inc-detail');
  const titleEl  = document.getElementById('sp-inc-detail-title');
  const bodyEl   = document.getElementById('sp-inc-detail-body');
  if (!detailEl || !bodyEl) return;
  stopIncQrCamera();

  detailEl.style.display = '';
  if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('sp-inc-detail-body', 4);
  else bodyEl.innerHTML = '';

  // If mobile sidebar overlay is left open, it can hide the hamburger/topbar.
  // Also, Chrome mobile can mis-handle sticky headers when auto-scrolling.
  const overlayEl = document.getElementById('sp-sidebar-overlay')
  const sidebarEl = document.querySelector('.sidebar')
  const isSidebarOpen = !!(sidebarEl && sidebarEl.classList.contains('open'))
  const isOverlayOpen = !!(overlayEl && overlayEl.classList.contains('open'))
  const isBodyLocked = document.body.style.overflow === 'hidden'
  if (isSidebarOpen || isOverlayOpen || isBodyLocked) closeSidebar()

  const ua = navigator.userAgent || ''
  const isChromeLike = (/Chrome\//i.test(ua) || /CriOS\//i.test(ua)) && !(/Edg\//i.test(ua) || /OPR\//i.test(ua))
  if (!isChromeLike) detailEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

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

    bodyEl.innerHTML = `
      <div style="padding:16px 20px">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:16px">
          <div><div style="font-size:11px;color:var(--text3)">Status</div><div>${INC_STATUS_BADGE[doc.status] || doc.status}</div></div>
          <div><div style="font-size:11px;color:var(--text3)">Dispatched</div><div style="font-size:13px">${fmtDate(doc.dispatched_at)}</div></div>
          <div><div style="font-size:11px;color:var(--text3)">Type</div><div style="font-size:13px">${doc.doc_type === 'REQUEST' ? 'Store Request' : 'Direct Transfer'}</div></div>
          ${doc.source_request_id ? `<div><div style="font-size:11px;color:var(--text3)">Request #</div><div style="font-size:13px">${doc.source_request_id}</div></div>` : ''}
        </div>
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text2)">Items (${lines.length})</div>
        <div>${lineRows}</div>
        ${isAccepted ? `
          <div style="margin-top:14px;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--bg)">
            <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px">Stock verification — unit scan bucket</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              ${hasUnitLines
                ? `<button type="button" class="btn sm primary" onclick="openIncomingTransferBucket(${doc.doc_id})">📷 Open scan bucket</button>`
                : `<span style="font-size:12px;color:var(--gold)">No unit list on document — contact HQ to re-dispatch with unit scans.</span>`}
              <button type="button" class="btn sm" onclick="incResetQrVerification(${doc.doc_id})">Reset verification</button>
            </div>
            <div style="font-size:11px;color:var(--text3);margin-top:8px">
              ${hasUnitLines
                ? 'Only units on this Foundry transfer document can be scanned. Extra units are rejected. Verify &amp; Stock unlocks when all units are verified.'
                : 'Unit-level verification is required for this shipment.'}
            </div>
          </div>
        ` : ''}
        <div id="sp-inc-action-msg" style="font-size:12px;min-height:16px;margin-top:10px"></div>
        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
          ${isDispatched ? `<button class="btn primary" onclick="incAccept(${doc.doc_id})">✓ Accept Transfer</button>` : ''}
          ${isAccepted   ? `<button id="sp-inc-stock-btn" class="btn primary" onclick="incStock(${doc.doc_id},[${lineIds.join(',')}])" ${allQrVerified ? '' : 'disabled'}>📦 Verify &amp; Stock</button>` : ''}
          ${doc.status === 'STOCKED' ? `<span style="color:var(--green);font-size:13px;font-weight:600">✓ Stock credited on ${fmtDate(doc.stocked_at)}</span>` : ''}
        </div>
      </div>`;

  } catch (err) {
    bodyEl.innerHTML = `<div style="padding:20px;color:var(--red)">Error: ${escHtml(err.message)}</div>`;
  }
};

window.closeIncDetail = function () {
  stopIncQrCamera();
  const el = document.getElementById('sp-inc-detail');
  if (el) el.style.display = 'none';

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
  const btn   = document.querySelector('#sp-inc-detail .btn.primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Accepting…'; }
  if (msgEl) msgEl.textContent = '';

  try {
    await apiPut(`/api/stock-transfer-docs/${docId}/accept`, {});
    _incQrVerificationByDoc[docId] = spFreshIncVerification();
    if (msgEl) { msgEl.style.color = 'var(--green)'; msgEl.textContent = '✓ Accepted. Enter received quantities and click Verify & Stock.'; }
    await expandIncTransfer(docId);
    loadIncomingTransfers();
  } catch (err) {
    if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Error: ' + err.message; }
    if (btn) { btn.disabled = false; btn.textContent = '✓ Accept Transfer'; }
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

  const btn = document.querySelector('#sp-inc-detail .btn.primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Stocking…'; }

  try {
    await apiPut(`/api/stock-transfer-docs/${docId}/stock`, { lines });
    delete _incQrVerificationByDoc[docId];
    if (msgEl) { msgEl.style.color = 'var(--green)'; msgEl.textContent = '✓ Stock credited to your store balance.'; }
    await expandIncTransfer(docId);
    loadIncomingTransfers();
  } catch (err) {
    if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Error: ' + err.message; }
    if (btn) { btn.disabled = false; btn.textContent = '📦 Verify & Stock'; }
  }
};

// Incoming Transfers badge on startup
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data  = await apiGet('/api/stock-transfer-docs?status=DISPATCHED&top_n=50');
    const cnt   = (data.data || []).length;
    const badge = document.getElementById('sp-inc-badge');
    if (badge && cnt) { badge.textContent = cnt; badge.style.display = ''; }
  } catch (_) {}
});

// ── Movement List ───────────────────────────────────────────────────────────────
let _spMlFilter = '';

window.setSpMlFilter = function (status, btn) {
  _spMlFilter = status;
  document.querySelectorAll('#page-movement-list .btn.sm[id^="sp-ml-tab-"]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadSpMovementList();
};

window.closeSpMlDetail = function () {
  const d = document.getElementById('sp-ml-detail');
  if (d) d.style.display = 'none';

  // On mobile, the hamburger is controlled by the off-canvas sidebar overlay.
  // If it's still open when Doc Details closes, it can hide the topbar/hamburger.
  const overlayEl = document.getElementById('sp-sidebar-overlay')
  const sidebarEl = document.querySelector('.sidebar')
  const isSidebarOpen = !!(sidebarEl && sidebarEl.classList.contains('open'))
  const isOverlayOpen = !!(overlayEl && overlayEl.classList.contains('open'))
  const isBodyLocked = document.body.style.overflow === 'hidden'
  if (isSidebarOpen || isOverlayOpen || isBodyLocked) closeSidebar()
};

window.loadSpMovementList = async function () {
  const wrap  = document.getElementById('sp-ml-list');
  const errEl = document.getElementById('sp-ml-err');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  if (wrap)  wrap.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)">Loading…</div>';
  closeSpMlDetail();
  try {
    const qs   = _spMlFilter ? `?status=${_spMlFilter}` : '';
    const docs = await apiGet('/api/stock-transfer-docs' + qs);
    const list = Array.isArray(docs) ? docs : (docs.data || []);
    if (!list.length) {
      wrap.innerHTML = '<div class="empty-state"><div class="ei">📋</div><div class="et">No transfer documents found</div><div class="es">Stock dispatched from ' + primaryWarehouseLabelHtml() + ' will appear here.</div></div>';
      return;
    }
    const statusBadge = s => {
      const map = { DISPATCHED:'<span class="b b-blue">Dispatched</span>', ACCEPTED:'<span class="b b-orange">Accepted</span>', STOCKED:'<span class="b b-green">Stocked</span>' };
      return map[s] || `<span class="b">${s}</span>`;
    };
    wrap.innerHTML = list.map(d => `
      <div class="inc-tr-row" onclick="expandSpMlDoc(${d.doc_id})">
        <div class="inc-tr-meta">
          <div><span class="inc-tr-id">DOC-${d.doc_id}</span> &nbsp;${d.doc_type === 'DIRECT' ? '📦 Direct' : '📬 From Request #' + d.source_request_id}</div>
          <div class="inc-tr-sub">${primaryWarehouseLabelHtml()} → ${d.store_name || 'Your Store'} &nbsp;·&nbsp; ${d.dispatched_at ? new Date(d.dispatched_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }) : '—'}</div>
        </div>
        <div>${statusBadge(d.status)}</div>
      </div>`).join('');
  } catch (e) {
    if (errEl) { errEl.textContent = 'Failed to load: ' + e.message; errEl.style.display = ''; }
    if (wrap)  wrap.innerHTML = '';
  }
};

window.expandSpMlDoc = async function (docId) {
  const titleEl = document.getElementById('sp-ml-detail-title');
  const bodyEl  = document.getElementById('sp-ml-detail-body');
  const panEl   = document.getElementById('sp-ml-detail');
  if (!panEl) return;

  // Ensure the off-canvas sidebar isn't covering the header/hamburger.
  const overlayEl = document.getElementById('sp-sidebar-overlay')
  const sidebarEl = document.querySelector('.sidebar')
  const isSidebarOpen = !!(sidebarEl && sidebarEl.classList.contains('open'))
  const isOverlayOpen = !!(overlayEl && overlayEl.classList.contains('open'))
  const isBodyLocked = document.body.style.overflow === 'hidden'
  if (isSidebarOpen || isOverlayOpen || isBodyLocked) closeSidebar()

  panEl.style.display = '';
  titleEl.textContent = `Transfer Document DOC-${docId}`;
  bodyEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3)">Loading…</div>';
  // Chrome/mobile has an issue with `position: sticky` headers when calling
  // `scrollIntoView()` inside overflow containers. Safari works fine.
  // Skip auto-scroll for Chrome-like user agents and let the user scroll.
  const ua = navigator.userAgent || ''
  const isChromeLike = (/Chrome\//i.test(ua) || /CriOS\//i.test(ua)) && !(/Edg\//i.test(ua) || /OPR\//i.test(ua))
  if (!isChromeLike) panEl.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  try {
    const doc = await apiGet(`/api/stock-transfer-docs/${docId}`);
    const fmtDt = dt => dt ? new Date(dt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }) : '—';
    const statusBadge = s => {
      const map = { DISPATCHED:'<span class="b b-blue">Dispatched</span>', ACCEPTED:'<span class="b b-orange">Accepted</span>', STOCKED:'<span class="b b-green">Stocked</span>' };
      return map[s] || `<span class="b">${s}</span>`;
    };
    const lines = (doc.lines || []).map(l => `
      <tr>
        <td style="padding:6px 8px;font-family:monospace;font-size:12px">${l.sku_code || l.sku_id}</td>
        <td style="padding:6px 8px;font-size:13px">${[l.product_name, l.colour_name].filter(Boolean).join(' · ')}</td>
        <td style="padding:6px 8px;text-align:center">${l.qty_sent}</td>
        <td style="padding:6px 8px;text-align:center">${l.qty_received != null ? l.qty_received : '—'}</td>
      </tr>`).join('');
    bodyEl.innerHTML = `
      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border)">
        <div><div style="font-size:11px;color:var(--text3);margin-bottom:3px">Type</div>${doc.doc_type === 'DIRECT' ? 'Direct Transfer' : 'From Request #' + doc.source_request_id}</div>
        <div><div style="font-size:11px;color:var(--text3);margin-bottom:3px">Status</div>${statusBadge(doc.status)}</div>
        <div><div style="font-size:11px;color:var(--text3);margin-bottom:3px">Dispatched</div>${fmtDt(doc.dispatched_at)}</div>
        ${doc.accepted_at ? `<div><div style="font-size:11px;color:var(--text3);margin-bottom:3px">Accepted</div>${fmtDt(doc.accepted_at)}</div>` : ''}
        ${doc.stocked_at  ? `<div><div style="font-size:11px;color:var(--text3);margin-bottom:3px">Stocked</div>${fmtDt(doc.stocked_at)}</div>` : ''}
      </div>
      ${doc.notes ? `<div style="margin-bottom:14px;font-size:13px;color:var(--text2)">📝 ${doc.notes}</div>` : ''}
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="border-bottom:1px solid var(--border)">
          <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--text3)">SKU</th>
          <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--text3)">Description</th>
          <th style="text-align:center;padding:6px 8px;font-size:11px;color:var(--text3)">Sent</th>
          <th style="text-align:center;padding:6px 8px;font-size:11px;color:var(--text3)">Received</th>
        </tr></thead>
        <tbody>${lines}</tbody>
      </table>`;
  } catch (e) {
    bodyEl.innerHTML = `<div class="err-msg">Failed to load document: ${e.message}</div>`;
  }
};
