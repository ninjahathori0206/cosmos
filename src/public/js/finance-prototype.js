/* ─── Finance Prototype — Client JS ─────────────────────────────────────────── */

const FIN_API_KEY = (typeof window !== 'undefined' && window.__COSMOS_API_KEY__) || ''

// ── Auth helpers ───────────────────────────────────────────────────────────────
function getToken() { return sessionStorage.getItem('cosmos_token') || ''; }

async function apiFetch(method, path, body) {
  const token = getToken();
  const headers = {
    'Content-Type':  'application/json',
    'X-API-Key':     FIN_API_KEY,
    'Authorization': 'Bearer ' + token
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

const apiGet  = (p)    => apiFetch('GET', p);
const apiPost = (p, b) => apiFetch('POST', p, b);
const apiPut  = (p, b) => apiFetch('PUT', p, b);

// ── Formatting helpers ─────────────────────────────────────────────────────────
function fmtRs(v) {
  const n = Number(v) || 0;
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function showErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

function showOk(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

// ── State ──────────────────────────────────────────────────────────────────────
let _suppliers = [];         // [{supplier_id, vendor_name, ...}]
let _ledgerRows = [];        // full supplier-summary rows
let _statementSupplierId = null;
let _pendingStatementBills = [];  // bills from statement for allocation

// ── Init ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadUser();
  loadDashboard();
  setDefaultPayDate();
});

function loadUser() {
  try {
    const token = sessionStorage.getItem('cosmos_token');
    if (!token) { window.location.href = '/'; return; }
    const stored = sessionStorage.getItem('cosmos_user');
    if (!stored) return;
    const u = JSON.parse(stored);
    const mods = u.modules;
    const hasMap = mods && typeof mods === 'object' && Object.keys(mods).length > 0;
    if (hasMap && mods.finance === false) {
      if (mods.command_unit !== false) window.location.href = '/command-unit.html';
      else if (mods.foundry !== false) window.location.href = '/foundry.html';
      else if (mods.storepilot !== false) window.location.href = '/storepilot.html';
      else window.location.href = '/';
      return;
    }
    const name = u.full_name || u.username || '?';
    const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0,2).toUpperCase();
    const av = document.getElementById('fin-user-av');
    const nm = document.getElementById('fin-user-name');
    if (av) av.textContent = initials;
    if (nm) nm.textContent = name;
    if (typeof window.applyCosmosModuleSwitchNav === 'function') {
      window.applyCosmosModuleSwitchNav('fin-switch-module-wrap', u);
    }
  } catch (_) {}
}

function setDefaultPayDate() {
  const d = document.getElementById('pay-date');
  if (d) d.value = istToday();
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
async function loadDashboard() {
  await Promise.all([loadDashStats(), loadDashSuppliers(), loadDashPayments()]);
}

async function loadDashStats() {
  try {
    const res = await apiGet('/api/finance/dashboard');
    const s = res.data || {};
    const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    el('ds-payable',     fmtRs(s.total_payable));
    el('ds-paid',        fmtRs(s.total_paid));
    el('ds-outstanding', fmtRs(s.total_outstanding));
    el('ds-overdue',     fmtRs(s.total_overdue));
    el('ds-suppliers-out', (s.suppliers_with_outstanding || 0) + ' suppliers with balance');
  } catch (err) {
    console.error('Dashboard stats error:', err.message);
  }
}

async function loadDashSuppliers() {
  const tbody = document.getElementById('dash-supplier-list');
  try {
    const res = await apiGet('/api/finance/supplier-summary');
    const rows = (res.data || []).slice(0, 8); // top 8 by outstanding
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:18px;color:var(--text3)">No supplier data</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => {
      const out = Number(r.outstanding);
      const badgeClass = out > 0 ? (r.overdue_bills > 0 ? 'b-red' : 'b-gold') : 'b-green';
      const badgeText  = out > 0 ? (r.overdue_bills > 0 ? 'Overdue' : 'Outstanding') : 'Clear';
      return `<tr style="cursor:pointer" onclick="openStatement(${r.supplier_id})">
        <td><div class="fw6">${escHtml(r.vendor_name)}</div><div class="xs td3">${escHtml(r.vendor_code)}</div></td>
        <td class="text-right mono fw6" style="color:${out > 0 ? 'var(--gold)' : 'var(--acc)'}">${fmtRs(out)}</td>
        <td><span class="b ${badgeClass}">${badgeText}</span></td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:18px;color:var(--red)">${escHtml(err.message)}</td></tr>`;
  }
}

async function loadDashPayments() {
  const tbody = document.getElementById('dash-payment-list');
  try {
    // Fetch summary for all suppliers, collect recent payments from statement
    // Use a quick SQL via supplier-summary which already has totals; for payment list
    // we'll fetch supplier summary then first supplier with payments
    // A cleaner approach: we call each supplier's payments — but that's N calls.
    // Instead render a simple "see supplier ledger" hint for now, fetched lazily.
    const res = await apiGet('/api/finance/supplier-summary');
    const suppliers = (res.data || []).filter(s => Number(s.total_paid) > 0).slice(0, 5);
    if (!suppliers.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:18px;color:var(--text3)">No payments recorded yet</td></tr>';
      return;
    }
    // Fetch the first few suppliers' payments for a combined recent list
    const paymentArrays = await Promise.all(
      suppliers.slice(0, 3).map(s =>
        apiGet('/api/finance/payments?supplier_id=' + s.supplier_id)
          .then(r => (r.data || []).map(p => ({ ...p, vendor_name: s.vendor_name })))
          .catch(() => [])
      )
    );
    const allPayments = paymentArrays.flat()
      .filter(p => !p.is_void)
      .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
      .slice(0, 8);

    if (!allPayments.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:18px;color:var(--text3)">No payments recorded yet</td></tr>';
      return;
    }
    tbody.innerHTML = allPayments.map(p => `
      <tr>
        <td>${fmtDate(p.payment_date)}</td>
        <td class="fw6">${escHtml(p.vendor_name)}</td>
        <td class="text-right mono">${fmtRs(p.amount)}</td>
        <td><span class="b b-blue xs">${escHtml(p.payment_mode)}</span></td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:18px;color:var(--red)">${escHtml(err.message)}</td></tr>`;
  }
}

// ── Supplier Ledger ────────────────────────────────────────────────────────────
window.loadLedger = async function loadLedger() {
  const tbody = document.getElementById('ledger-body');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text3)">Loading...</td></tr>';
  try {
    const res = await apiGet('/api/finance/supplier-summary');
    _ledgerRows = res.data || [];
    renderLedger(_ledgerRows);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--red)">${escHtml(err.message)}</td></tr>`;
  }
}

function renderLedger(rows) {
  const tbody = document.getElementById('ledger-body');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text3)">No active suppliers found</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const out  = Number(r.outstanding);
    const paid = Number(r.total_paid);
    const total = Number(r.total_purchase);
    const paidPct = total > 0 ? Math.min(100, Math.round(paid / total * 100)) : 0;

    let outBadge = '';
    if (out <= 0)              outBadge = '<span class="b b-green">Clear</span>';
    else if (r.overdue_bills > 0) outBadge = `<span class="b b-red">⚠ ${r.overdue_bills} Overdue</span>`;
    else                       outBadge = '<span class="b b-gold">Pending</span>';

    const creditDisp = r.credit_days !== null && r.credit_days !== undefined
      ? `<span class="mono">${r.credit_days}d</span>`
      : '<span class="td3">—</span>';

    return `<tr>
      <td>
        <div class="fw6">${escHtml(r.vendor_name)}</div>
        <div class="xs td3 mono">${escHtml(r.vendor_code)}${r.city ? ' · ' + escHtml(r.city) : ''}</div>
      </td>
      <td class="td2 xs">${escHtml(r.city || '—')}</td>
      <td class="text-right mono">${fmtRs(r.total_purchase)}</td>
      <td class="text-right">
        <div class="mono fw6" style="color:var(--acc)">${fmtRs(paid)}</div>
        ${total > 0 ? `<div class="pbar-wrap"><div class="pbar" style="width:${paidPct}%"></div></div>` : ''}
      </td>
      <td class="text-right mono fw6" style="color:${out > 0 ? 'var(--gold)' : 'var(--acc)'}">
        ${fmtRs(out)}
      </td>
      <td>
        ${creditDisp}
        <button class="btn xs" style="margin-left:6px" onclick="openCreditModal(${r.supplier_id},'${escHtml(r.vendor_name)}',${r.credit_days !== null && r.credit_days !== undefined ? r.credit_days : 'null'})">Edit</button>
      </td>
      <td>${outBadge}</td>
      <td>
        <button class="btn xs primary" onclick="openStatement(${r.supplier_id})">Statement →</button>
      </td>
    </tr>`;
  }).join('');
}

window.filterLedger = function filterLedger() {
  const q = (document.getElementById('ledger-search')?.value || '').toLowerCase();
  const filtered = q
    ? _ledgerRows.filter(r =>
        (r.vendor_name || '').toLowerCase().includes(q) ||
        (r.vendor_code || '').toLowerCase().includes(q) ||
        (r.city || '').toLowerCase().includes(q))
    : _ledgerRows;
  renderLedger(filtered);
}

// Called when user navigates to supplier-ledger page
const _origNav = window.nav ? window.nav : null;
// Wrap nav to lazy-load ledger
(function patchNav() {
  const origNav = window.nav;
  if (!origNav) return;
  let _prInited = false;
  let _ifInited = false;
  window.nav = function(id, el) {
    origNav(id, el);
    if (id === 'supplier-ledger')  loadLedger();
    if (id === 'supplier-master')  loadSupplierMaster();
    if (id === 'payments')         loadPaymentSuppliers();
    if (id === 'purchase-reports') {
      if (!_prInited) { _prInited = true; initPurchaseReports(); }
    }
    if (id === 'item-finance') {
      if (!_ifInited) { _ifInited = true; initItemFinance(); }
    }
  };
})();

// ── Supplier Statement Modal ────────────────────────────────────────────────────
window.openStatement = async function openStatement(supplierId) {
  _statementSupplierId = supplierId;
  _pendingStatementBills = [];
  const body = document.getElementById('stmt-modal-body');
  const title = document.getElementById('stmt-modal-title');
  body.innerHTML = '<div class="empty"><div class="empty-ic">⏳</div><div class="empty-text">Loading statement...</div></div>';
  openM('modal-statement');

  try {
    const res = await apiGet('/api/finance/supplier/' + supplierId + '/statement');
    const { supplier, bills, payments } = res.data;

    title.textContent = supplier.vendor_name + ' — Statement';
    _pendingStatementBills = bills;

    // Supplier summary header
    const totalBillAmt = bills.reduce((s, b) => s + Number(b.bill_amount || 0), 0);
    const totalPaid    = payments.filter(p => !p.is_void).reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalOut     = totalBillAmt - totalPaid;

    let html = `<div class="stmt-header">
      <div class="stmt-kv"><div class="stmt-k">Supplier</div><div class="stmt-v">${escHtml(supplier.vendor_name)}</div></div>
      <div class="stmt-kv"><div class="stmt-k">Credit Days</div><div class="stmt-v">${supplier.credit_days !== null ? supplier.credit_days + 'd' : '—'}</div></div>
      <div class="stmt-kv"><div class="stmt-k">Total Purchase</div><div class="stmt-v">${fmtRs(totalBillAmt)}</div></div>
      <div class="stmt-kv"><div class="stmt-k">Total Paid</div><div class="stmt-v" style="color:var(--acc)">${fmtRs(totalPaid)}</div></div>
      <div class="stmt-kv"><div class="stmt-k">Outstanding</div><div class="stmt-v" style="color:${totalOut > 0 ? 'var(--gold)' : 'var(--acc)'}">${fmtRs(totalOut)}</div></div>
    </div>`;

    // Bills section
    html += `<div style="padding:16px 20px">`;
    html += `<div class="section-lbl mb2">Bills (${bills.length})</div>`;
    if (!bills.length) {
      html += '<div class="empty td3 xs" style="padding:16px 0">No verified bills yet</div>';
    } else {
      html += `<div class="tw"><table>
        <thead><tr><th>Bill Ref</th><th>Bill Date</th><th>Bill Amount</th><th>Paid</th><th>Outstanding</th><th>Due Date</th><th>Status</th></tr></thead>
        <tbody>`;
      html += bills.map(b => {
        const out = Number(b.outstanding);
        const paid = Number(b.paid_amount);
        const total = Number(b.bill_amount);
        const pctPaid = total > 0 ? Math.min(100, Math.round(paid / total * 100)) : 0;
        let dueBadge = '';
        if (b.days_overdue !== null) {
          if (b.days_overdue > 0 && out > 0) {
            dueBadge = `<span class="b b-red xs">${b.days_overdue}d overdue</span>`;
          } else if (b.days_overdue <= 0 && out > 0) {
            dueBadge = `<span class="b b-gold xs">${Math.abs(b.days_overdue)}d left</span>`;
          } else if (out <= 0) {
            dueBadge = '<span class="b b-green xs">Paid</span>';
          }
        } else if (out <= 0) {
          dueBadge = '<span class="b b-green xs">Paid</span>';
        }
        return `<tr>
          <td class="mono xs">${escHtml(b.bill_number || b.bill_ref || '#' + b.header_id)}</td>
          <td>${fmtDate(b.bill_date)}</td>
          <td class="text-right mono">${fmtRs(b.bill_amount)}</td>
          <td class="text-right">
            <div class="mono" style="color:var(--acc)">${fmtRs(paid)}</div>
            ${total > 0 ? `<div class="pbar-wrap" style="width:80px"><div class="pbar" style="width:${pctPaid}%"></div></div>` : ''}
          </td>
          <td class="text-right mono fw6" style="color:${out > 0 ? 'var(--gold)' : 'var(--acc)'}">${fmtRs(out)}</td>
          <td>${fmtDate(b.due_date)}</td>
          <td>${dueBadge}</td>
        </tr>`;
      }).join('');
      html += '</tbody></table></div>';
    }

    // Payments section
    html += `<div class="section-lbl mt3 mb2">Payments (${payments.filter(p => !p.is_void).length})</div>`;
    if (!payments.length) {
      html += '<div class="empty td3 xs" style="padding:8px 0">No payments recorded</div>';
    } else {
      html += `<div class="tw"><table>
        <thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Reference</th><th>Notes</th><th>Status</th></tr></thead>
        <tbody>`;
      html += payments.map(p => `<tr style="opacity:${p.is_void ? 0.45 : 1}">
        <td>${fmtDate(p.payment_date)}</td>
        <td class="mono fw6">${fmtRs(p.amount)}</td>
        <td><span class="b b-blue xs">${escHtml(p.payment_mode)}</span></td>
        <td class="mono xs">${escHtml(p.reference_no || '—')}</td>
        <td class="xs td2">${escHtml(p.notes || '—')}</td>
        <td>${p.is_void ? `<span class="b b-red xs">Void</span>` : '<span class="b b-green xs">Active</span>'}</td>
      </tr>`).join('');
      html += '</tbody></table></div>';
    }

    html += '</div>';

    body.innerHTML = html;
    const payBtn = document.getElementById('stmt-pay-btn');
    if (payBtn) payBtn.style.display = '';
  } catch (err) {
    body.innerHTML = `<div class="empty"><div class="empty-ic">⚠️</div><div class="empty-text">${escHtml(err.message)}</div></div>`;
  }
}

window.openPaymentFromStatement = function openPaymentFromStatement() {
  closeM('modal-statement');
  // Pre-select the supplier on the payments page
  nav('payments', document.querySelector('[onclick*=payments]'));
  setTimeout(() => {
    const sel = document.getElementById('pay-supplier');
    if (sel && _statementSupplierId) {
      sel.value = _statementSupplierId;
      onPaySupplierChange();
    }
  }, 100);
}

// ── Credit Days Modal ──────────────────────────────────────────────────────────
window.openCreditModal = function openCreditModal(supplierId, supplierName, creditDays) {
  document.getElementById('credit-supplier-id').value   = supplierId;
  document.getElementById('credit-supplier-name').value = supplierName;
  document.getElementById('credit-days-input').value    = creditDays !== null && creditDays !== undefined ? creditDays : '';
  showErr('credit-error', '');
  openM('modal-credit');
}

window.saveCreditDays = async function saveCreditDays() {
  const supplierId = Number(document.getElementById('credit-supplier-id').value);
  const raw = document.getElementById('credit-days-input').value.trim();
  const days = raw === '' ? null : Number(raw);
  if (raw !== '' && (isNaN(days) || days < 0 || days > 365)) {
    showErr('credit-error', 'Credit days must be between 0 and 365.');
    return;
  }
  try {
    await apiPut('/api/finance/supplier/' + supplierId + '/credit-days', { credit_days: days });
    closeM('modal-credit');
    await loadLedger();
  } catch (err) {
    showErr('credit-error', err.message);
  }
}

// ── Record Payment ─────────────────────────────────────────────────────────────
window.loadPaymentSuppliers = async function loadPaymentSuppliers() {
  try {
    const res = await apiGet('/api/finance/supplier-summary');
    _suppliers = res.data || [];
    const sel = document.getElementById('pay-supplier');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Select Supplier —</option>';
    _suppliers.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.supplier_id;
      opt.textContent = s.vendor_name + (s.city ? ' (' + s.city + ')' : '');
      sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
  } catch (err) {
    console.error('loadPaymentSuppliers:', err.message);
  }
}

window.onPaySupplierChange = async function onPaySupplierChange() {
  const supplierId = Number(document.getElementById('pay-supplier')?.value);
  const card  = document.getElementById('pay-outstanding-card');
  const body  = document.getElementById('pay-outstanding-body');
  const title = document.getElementById('pay-outstanding-title');
  const allocSection = document.getElementById('alloc-section');
  const allocRows    = document.getElementById('alloc-rows');

  if (!supplierId) {
    if (card) card.style.display = 'none';
    if (allocSection) allocSection.style.display = 'none';
    _pendingStatementBills = [];
    return;
  }
  if (card) card.style.display = '';

  body.innerHTML = '<div class="xs td3">Loading...</div>';
  _pendingStatementBills = [];

  try {
    const res = await apiGet('/api/finance/supplier/' + supplierId + '/statement');
    const { supplier, bills } = res.data;

    if (title) title.textContent = escHtml(supplier.vendor_name) + ' — Outstanding Bills';

    const outstanding = bills.filter(b => Number(b.outstanding) > 0.005);
    _pendingStatementBills = outstanding;

    if (!outstanding.length) {
      body.innerHTML = '<div class="xs td3" style="padding:8px 0">No outstanding bills — supplier is clear.</div>';
      if (allocSection) allocSection.style.display = 'none';
      return;
    }

    body.innerHTML = outstanding.map(b => {
      const out = Number(b.outstanding);
      const paid = Number(b.paid_amount);
      const total = Number(b.bill_amount);
      const pctPaid = total > 0 ? Math.min(100, Math.round(paid / total * 100)) : 0;
      const billLabel = b.bill_number || b.bill_ref || 'Bill #' + b.header_id;
      const dueBadge = b.days_overdue !== null
        ? (b.days_overdue > 0
            ? `<span class="b b-red xs">${b.days_overdue}d overdue</span>`
            : `<span class="b b-gold xs">${Math.abs(b.days_overdue)}d left</span>`)
        : '';
      return `<div class="alloc-row" style="flex-direction:column;align-items:flex-start;gap:4px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
          <span class="mono xs fw6">${escHtml(billLabel)}</span>
          ${dueBadge}
        </div>
        <div style="display:flex;justify-content:space-between;width:100%">
          <span class="xs td2">${fmtDate(b.bill_date)}</span>
          <span class="mono xs" style="color:var(--gold)">${fmtRs(out)} outstanding</span>
        </div>
        ${total > 0 ? `<div class="pbar-wrap" style="width:100%"><div class="pbar" style="width:${pctPaid}%"></div></div>` : ''}
      </div>`;
    }).join('');

    // Build allocation rows in the form
    if (allocSection) allocSection.style.display = '';
    if (allocRows) {
      allocRows.innerHTML = outstanding.map(b => {
        const out = Number(b.outstanding);
        const billLabel = b.bill_number || b.bill_ref || 'Bill #' + b.header_id;
        return `<div class="alloc-row" id="alloc-bill-${b.header_id}">
          <div class="alloc-desc">
            <div class="xs fw6">${escHtml(billLabel)}</div>
            <div class="xs td3">${fmtDate(b.bill_date)} · ${fmtRs(out)} outstanding</div>
          </div>
          <input type="number" class="alloc-inp" id="alloc-amt-${b.header_id}"
            placeholder="0.00" min="0" step="0.01" max="${out.toFixed(2)}"
            oninput="updateAllocRemaining()">
        </div>`;
      }).join('');
    }
    updateAllocRemaining();
  } catch (err) {
    body.innerHTML = `<div class="xs" style="color:var(--red)">${escHtml(err.message)}</div>`;
    if (allocSection) allocSection.style.display = 'none';
  }
}

window.onPayAmountChange = function onPayAmountChange() {
  updateAllocRemaining();
}

window.updateAllocRemaining = function updateAllocRemaining() {
  const totalAmt = Number(document.getElementById('pay-amount')?.value) || 0;
  let allocTotal = 0;
  _pendingStatementBills.forEach(b => {
    const inp = document.getElementById('alloc-amt-' + b.header_id);
    if (inp) allocTotal += Number(inp.value) || 0;
  });
  const rem = totalAmt - allocTotal;
  const remEl = document.getElementById('alloc-remaining');
  if (remEl) {
    if (totalAmt > 0) {
      const color = Math.abs(rem) < 0.01 ? 'var(--acc)' : (rem < 0 ? 'var(--red)' : 'var(--text2)');
      remEl.style.color = color;
      remEl.textContent = rem < -0.005
        ? `Over-allocated by ${fmtRs(Math.abs(rem))}`
        : rem > 0.005
          ? `${fmtRs(rem)} unallocated`
          : 'Fully allocated';
    } else {
      remEl.textContent = '';
    }
  }
}

window.submitPayment = async function submitPayment() {
  showErr('payment-error', '');
  showOk('payment-ok', '');

  const supplierId = Number(document.getElementById('pay-supplier')?.value);
  const payDate    = document.getElementById('pay-date')?.value;
  const amount     = Number(document.getElementById('pay-amount')?.value);
  const mode       = document.getElementById('pay-mode')?.value;
  const refNo      = document.getElementById('pay-ref')?.value?.trim();
  const bank       = document.getElementById('pay-bank')?.value?.trim();
  const notes      = document.getElementById('pay-notes')?.value?.trim();

  if (!supplierId) return showErr('payment-error', 'Please select a supplier.');
  if (!payDate)    return showErr('payment-error', 'Please select a payment date.');
  if (!amount || amount <= 0) return showErr('payment-error', 'Please enter a valid payment amount.');

  // Collect allocations
  const allocations = [];
  _pendingStatementBills.forEach(b => {
    const inp = document.getElementById('alloc-amt-' + b.header_id);
    const amt = Number(inp?.value) || 0;
    if (amt > 0.005) allocations.push({ header_id: b.header_id, allocated_amt: amt });
  });

  // Validate over-allocation
  const allocTotal = allocations.reduce((s, a) => s + a.allocated_amt, 0);
  if (allocTotal > amount + 0.01) {
    return showErr('payment-error', `Allocated total (${fmtRs(allocTotal)}) exceeds payment amount (${fmtRs(amount)}).`);
  }

  try {
    await apiPost('/api/finance/payments', {
      supplier_id:  supplierId,
      payment_date: payDate,
      amount,
      payment_mode: mode,
      reference_no: refNo || null,
      bank_account: bank || null,
      notes: notes || null,
      allocations
    });

    showOk('payment-ok', 'Payment recorded successfully.');

    // Reset form
    document.getElementById('pay-amount').value = '';
    document.getElementById('pay-ref').value    = '';
    document.getElementById('pay-bank').value   = '';
    document.getElementById('pay-notes').value  = '';
    setDefaultPayDate();
    // Reload outstanding panel and ledger cache
    onPaySupplierChange();
    _ledgerRows = [];   // invalidate cache so next visit to ledger reloads fresh
    // Refresh dashboard totals
    loadDashStats();
    loadDashSuppliers();

    setTimeout(() => showOk('payment-ok', ''), 4000);
  } catch (err) {
    showErr('payment-error', err.message);
  }
}

// ── Supplier Master ────────────────────────────────────────────────────────────
let _smRows    = [];   // all supplier master rows
let _smCodeTimer = null;

window.loadSupplierMaster = async function loadSupplierMaster() {
  const tbody = document.getElementById('sm-body');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text3)">Loading...</td></tr>';
  try {
    const res = await apiGet('/api/suppliers');
    _smRows = res.data || [];
    renderSupplierMaster(_smRows);
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--red)">${escHtml(err.message)}</td></tr>`;
  }
};

function renderSupplierMaster(rows) {
  const tbody = document.getElementById('sm-body');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text3)">No suppliers found. Add your first supplier.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const statusBadge = r.vendor_status === 'active'
      ? '<span class="b b-green">Active</span>'
      : '<span class="b b-red">Inactive</span>';

    const creditDisp = r.credit_days != null
      ? `${r.credit_days}d (${escHtml(r.payment_terms || 'custom')})`
      : (r.payment_terms ? escHtml(r.payment_terms) : '<span class="td3">—</span>');

    const bankDisp = r.bank_name
      ? `<div class="xs fw6">${escHtml(r.bank_name)}</div><div class="xs td3 mono">${escHtml(r.bank_ifsc || '—')}</div>`
      : '<span class="td3 xs">—</span>';

    const openBal = Number(r.opening_balance) || 0;

    return `<tr>
      <td>
        <div class="fw6">${escHtml(r.vendor_name)}</div>
        <div class="xs td3 mono">${escHtml(r.vendor_code)}</div>
      </td>
      <td class="xs">${escHtml(r.city || '—')}${r.state ? ', ' + escHtml(r.state) : ''}</td>
      <td>
        <div class="xs">${escHtml(r.contact_person || '—')}</div>
        <div class="xs td3">${escHtml(r.contact_phone || '')}</div>
      </td>
      <td class="xs">${creditDisp}</td>
      <td class="text-right mono xs" style="color:${openBal > 0 ? 'var(--gold)' : 'var(--text3)'}">
        ${openBal > 0 ? fmtRs(openBal) : '—'}
      </td>
      <td>${bankDisp}</td>
      <td>${statusBadge}</td>
      <td style="white-space:nowrap">
        <button class="btn xs" onclick="openSupplierForm(${r.supplier_id})">Edit</button>
        <button class="btn xs primary" style="margin-left:4px" onclick="openStatement(${r.supplier_id}); nav('supplier-ledger', document.querySelector('[onclick*=supplier-ledger]'))">Ledger</button>
      </td>
    </tr>`;
  }).join('');
}

window.filterSupplierMaster = function filterSupplierMaster() {
  const q = (document.getElementById('sm-search')?.value || '').toLowerCase();
  const filtered = q
    ? _smRows.filter(r =>
        (r.vendor_name || '').toLowerCase().includes(q) ||
        (r.vendor_code || '').toLowerCase().includes(q) ||
        (r.city || '').toLowerCase().includes(q))
    : _smRows;
  renderSupplierMaster(filtered);
};

// ── Supplier Form (Create / Edit) ─────────────────────────────────────────────
window.openSupplierForm = async function openSupplierForm(supplierId) {
  showErr('sf-error', '');
  const isNew = !supplierId;
  document.getElementById('sf-modal-title').textContent = isNew ? 'New Supplier' : 'Edit Supplier';
  document.getElementById('sf-supplier-id').value = supplierId || '';
  document.getElementById('sf-deactivate-btn').style.display = isNew ? 'none' : '';

  // Clear all fields
  ['sf-vendor-name','sf-vendor-code','sf-city','sf-state','sf-gstin',
   'sf-contact-person','sf-contact-phone','sf-payment-terms','sf-credit-days',
   'sf-opening-balance','sf-bank-name','sf-bank-holder','sf-bank-account','sf-bank-ifsc'
  ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  if (!isNew) {
    try {
      const res = await apiGet('/api/suppliers/' + supplierId);
      const s = res.data;
      const fv = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
      fv('sf-vendor-name',    s.vendor_name);
      fv('sf-vendor-code',    s.vendor_code);
      fv('sf-city',           s.city);
      fv('sf-state',          s.state);
      fv('sf-gstin',          s.gstin);
      fv('sf-contact-person', s.contact_person);
      fv('sf-contact-phone',  s.contact_phone);
      fv('sf-payment-terms',  s.payment_terms);
      fv('sf-credit-days',    s.credit_days);
      fv('sf-opening-balance',s.opening_balance);
      fv('sf-bank-name',      s.bank_name);
      fv('sf-bank-holder',    s.bank_account_holder);
      fv('sf-bank-account',   s.bank_account_no);
      fv('sf-bank-ifsc',      s.bank_ifsc);
    } catch (err) {
      showErr('sf-error', 'Could not load supplier: ' + err.message);
    }
  }

  openM('modal-supplier-form');
};

window.sfAutoCode = function sfAutoCode() {
  const codeEl = document.getElementById('sf-vendor-code');
  const suppId = document.getElementById('sf-supplier-id').value;
  if (suppId) return; // editing — don't auto-suggest
  if (!codeEl || codeEl.value.trim()) return; // already has value
  const name = document.getElementById('sf-vendor-name')?.value || '';
  clearTimeout(_smCodeTimer);
  if (name.length < 2) return;
  _smCodeTimer = setTimeout(async () => {
    try {
      const res = await apiGet('/api/suppliers/auto-code?name=' + encodeURIComponent(name));
      if (!codeEl.value.trim()) codeEl.value = res.data && res.data.vendor_code || '';
    } catch (_) {}
  }, 600);
};

window.saveSupplierForm = async function saveSupplierForm() {
  showErr('sf-error', '');
  const supplierId = document.getElementById('sf-supplier-id').value;
  const isNew = !supplierId;

  const gv = (id) => document.getElementById(id)?.value?.trim() || null;
  const gn = (id) => { const v = document.getElementById(id)?.value?.trim(); return v ? Number(v) : null; };

  const vendorName = gv('sf-vendor-name');
  if (!vendorName) return showErr('sf-error', 'Supplier name is required.');

  const payload = {
    vendor_name:           vendorName,
    vendor_code:           gv('sf-vendor-code') || undefined,
    city:                  gv('sf-city'),
    state:                 gv('sf-state'),
    gstin:                 gv('sf-gstin'),
    contact_person:        gv('sf-contact-person'),
    contact_phone:         gv('sf-contact-phone'),
    payment_terms:         gv('sf-payment-terms'),
    credit_days:           gn('sf-credit-days'),
    opening_balance:       gn('sf-opening-balance') || 0,
    bank_name:             gv('sf-bank-name'),
    bank_account_holder:   gv('sf-bank-holder'),
    bank_account_no:       gv('sf-bank-account'),
    bank_ifsc:             (gv('sf-bank-ifsc') || '').toUpperCase() || null
  };

  try {
    if (isNew) {
      await apiPost('/api/suppliers', payload);
    } else {
      await apiFetch('PUT', '/api/suppliers/' + supplierId, payload);
    }
    closeM('modal-supplier-form');
    loadSupplierMaster();
    // Invalidate ledger so it reloads fresh
    _ledgerRows = [];
  } catch (err) {
    showErr('sf-error', err.message);
  }
};

window.deactivateSupplier = async function deactivateSupplier() {
  const supplierId = document.getElementById('sf-supplier-id').value;
  if (!supplierId) return;
  if (!window.confirm('Deactivate this supplier? They will no longer appear in active lists.')) return;
  try {
    await apiFetch('PUT', '/api/suppliers/' + supplierId + '/status', { status: 'inactive' });
    closeM('modal-supplier-form');
    loadSupplierMaster();
    _ledgerRows = [];
  } catch (err) {
    showErr('sf-error', err.message);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASE REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

let _prBillRows = [];   // full bill result for client-side search

const PR_STATUS_LABELS = {
  PENDING_BILL_VERIFICATION: 'Pending Verification',
  BILL_VERIFIED:             'Bill Verified',
  BRANDING_DISPATCH:         'Branding Dispatch',
  BRANDING_COMPLETE:         'Branding Complete',
  SKU_GENERATED:             'SKU Generated',
  COMPLETE:                  'Complete'
};

const PR_STATUS_COLORS = {
  PENDING_BILL_VERIFICATION: '#f59e0b',
  BILL_VERIFIED:             '#3b82f6',
  BRANDING_DISPATCH:         '#8b5cf6',
  BRANDING_COMPLETE:         '#6366f1',
  SKU_GENERATED:             '#0ea5e9',
  COMPLETE:                  '#10b981'
};

async function initPurchaseReports() {
  // Populate supplier dropdown
  try {
    const res = await apiGet('/api/suppliers');
    const sel = document.getElementById('pr-supplier');
    (res.data || []).forEach(s => {
      const o = document.createElement('option');
      o.value = s.supplier_id;
      o.textContent = s.vendor_name;
      sel.appendChild(o);
    });
  } catch (_) {}

  // Populate category dropdown
  try {
    const res = await apiGet('/api/finance/purchase-report/categories');
    const sel = document.getElementById('pr-category');
    (res.data || []).forEach(cat => {
      const o = document.createElement('option');
      o.value = cat;
      o.textContent = cat;
      sel.appendChild(o);
    });
  } catch (_) {}
}

window.runPurchaseReport = async function runPurchaseReport() {
  const fromDate  = document.getElementById('pr-from').value || '';
  const toDate    = document.getElementById('pr-to').value || '';
  const suppId    = document.getElementById('pr-supplier').value || '';
  const category  = document.getElementById('pr-category').value || '';

  // Build query string
  const params = new URLSearchParams();
  if (fromDate)  params.set('from_date',       fromDate);
  if (toDate)    params.set('to_date',         toDate);
  if (suppId)    params.set('supplier_id',     suppId);
  if (category)  params.set('category',        category);

  // Hide initial prompt
  document.getElementById('pr-initial').style.display = 'none';
  document.getElementById('pr-summary-row').style.display = 'none';
  document.getElementById('pr-breakdown-card').style.display = 'none';
  document.getElementById('pr-bills-card').style.display = 'none';

  try {
    const res = await apiGet('/api/finance/purchase-report?' + params.toString());
    const { summary, supplierBreakdown, bills } = res.data || {};

    // Summary cards
    if (summary) {
      document.getElementById('pr-s-bills').textContent       = (summary.total_bills || 0).toLocaleString('en-IN');
      document.getElementById('pr-s-suppliers').textContent   = (summary.supplier_count || 0).toLocaleString('en-IN');
      document.getElementById('pr-s-amount').textContent      = fmtRs(summary.total_amount);
      document.getElementById('pr-s-paid').textContent        = fmtRs(summary.total_paid);
      document.getElementById('pr-s-outstanding').textContent = fmtRs(summary.total_outstanding);
      document.getElementById('pr-s-qty').textContent         = (summary.total_qty || 0).toLocaleString('en-IN');
      document.getElementById('pr-summary-row').style.display = 'block';
    }

    // Supplier breakdown
    if (supplierBreakdown && supplierBreakdown.length > 0) {
      const tbody = document.getElementById('pr-breakdown-body');
      tbody.innerHTML = supplierBreakdown.map(r => `
        <tr>
          <td>${escHtml(r.supplier_name || '—')}</td>
          <td class="tr">${r.bill_count}</td>
          <td class="tr">${fmtRs(r.total_amount)}</td>
          <td class="tr" style="color:#10b981">${fmtRs(r.total_paid)}</td>
          <td class="tr" style="color:${Number(r.total_outstanding) > 0 ? '#f59e0b' : 'var(--tx2)'}">${fmtRs(r.total_outstanding)}</td>
          <td class="tr">${Number(r.total_qty || 0).toLocaleString('en-IN')}</td>
        </tr>
      `).join('');
      document.getElementById('pr-breakdown-count').textContent = supplierBreakdown.length + ' suppliers';
      document.getElementById('pr-breakdown-card').style.display = '';
    }

    // Bills
    _prBillRows = bills || [];
    document.getElementById('pr-bill-search').value = '';
    prRenderBills(_prBillRows);
    document.getElementById('pr-bills-count').textContent = _prBillRows.length + ' bills';
    document.getElementById('pr-bills-card').style.display = '';

  } catch (err) {
    alert('Report error: ' + err.message);
    document.getElementById('pr-initial').style.display = '';
  }
};

function prRenderBills(rows) {
  const tbody = document.getElementById('pr-bills-body');
  const empty = document.getElementById('pr-bills-empty');
  if (!rows || rows.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  tbody.innerHTML = rows.map(b => {
    const statusLabel = PR_STATUS_LABELS[b.pipeline_status] || b.pipeline_status || '—';
    const statusColor = PR_STATUS_COLORS[b.pipeline_status] || '#94a3b8';
    const outstanding = Number(b.outstanding || 0);
    return `<tr>
      <td>${fmtDate(b.purchase_date)}</td>
      <td>${escHtml(b.supplier_name || '—')}</td>
      <td>${escHtml(b.bill_ref || '—')}</td>
      <td>${escHtml(b.bill_number || '—')}</td>
      <td><span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${statusColor}22;color:${statusColor};font-weight:500;white-space:nowrap">${statusLabel}</span></td>
      <td class="tr">${fmtRs(b.bill_amount)}</td>
      <td class="tr" style="color:#10b981">${fmtRs(b.paid_amount)}</td>
      <td class="tr" style="color:${outstanding > 0 ? '#f59e0b' : 'var(--tx2)'}">${fmtRs(outstanding)}</td>
      <td class="tr">${b.item_count || 0}</td>
      <td class="tr">${Number(b.total_qty || 0).toLocaleString('en-IN')}</td>
    </tr>`;
  }).join('');
}

window.prFilterBills = function prFilterBills() {
  const q = (document.getElementById('pr-bill-search').value || '').toLowerCase();
  if (!q) return prRenderBills(_prBillRows);
  prRenderBills(_prBillRows.filter(b =>
    (b.supplier_name || '').toLowerCase().includes(q) ||
    (b.bill_ref      || '').toLowerCase().includes(q) ||
    (b.bill_number   || '').toLowerCase().includes(q)
  ));
};

window.prClear = function prClear() {
  document.getElementById('pr-from').value     = '';
  document.getElementById('pr-to').value       = '';
  document.getElementById('pr-supplier').value = '';
  document.getElementById('pr-category').value = '';
  document.getElementById('pr-summary-row').style.display   = 'none';
  document.getElementById('pr-breakdown-card').style.display = 'none';
  document.getElementById('pr-bills-card').style.display     = 'none';
  document.getElementById('pr-initial').style.display        = '';
  _prBillRows = [];
};

// ─────────────────────────────────────────────────────────────────────────────
// ITEM FINANCE
// ─────────────────────────────────────────────────────────────────────────────

let _ifItemRows = [];

async function initItemFinance() {
  try {
    const res = await apiGet('/api/finance/item-finance/filters');
    const { brands, productTypes } = res.data || {};

    const brandSel = document.getElementById('if-brand');
    (brands || []).forEach((b) => {
      const o = document.createElement('option');
      o.value = b.brand_id;
      o.textContent = b.brand_name;
      brandSel.appendChild(o);
    });

    const typeSel = document.getElementById('if-type');
    (productTypes || []).forEach((t) => {
      const o = document.createElement('option');
      o.value = t;
      o.textContent = t;
      typeSel.appendChild(o);
    });
  } catch (_) {}
}

window.runItemFinance = async function runItemFinance() {
  const brandId = document.getElementById('if-brand').value  || '';
  const type    = document.getElementById('if-type').value   || '';
  const status  = document.getElementById('if-status').value || '';
  const q       = document.getElementById('if-q').value.trim() || '';

  const params = new URLSearchParams();
  if (brandId) params.set('brand_id',     brandId);
  if (type)    params.set('product_type', type);
  if (status)  params.set('status',       status);
  if (q)       params.set('q',            q);

  document.getElementById('if-initial').style.display   = 'none';
  document.getElementById('if-summary-row').style.display = 'none';
  document.getElementById('if-table-card').style.display  = 'none';

  try {
    // #region agent log
    fetch('http://127.0.0.1:7701/ingest/24aa53f2-1d4f-48eb-8837-69df532a7134',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1d0c1b'},body:JSON.stringify({sessionId:'1d0c1b',runId:'item-finance-pre-fix',hypothesisId:'H1-H3',location:'src/public/js/finance-prototype.js:runItemFinance:start',message:'Item finance report started',data:{filters:{brandId,type,status,q},dom:{summaryRow:!!document.getElementById('if-summary-row'),summaryCards:document.querySelectorAll('#if-summary-row .stat-card').length,costEl:!!document.getElementById('if-s-cost-val'),saleEl:!!document.getElementById('if-s-sale-val'),marginEl:!!document.getElementById('if-s-margin')}},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const res = await apiGet('/api/finance/item-finance?' + params.toString());
    const { summary, items } = res.data || {};

    // #region agent log
    fetch('http://127.0.0.1:7701/ingest/24aa53f2-1d4f-48eb-8837-69df532a7134',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1d0c1b'},body:JSON.stringify({sessionId:'1d0c1b',runId:'item-finance-pre-fix',hypothesisId:'H1-H2',location:'src/public/js/finance-prototype.js:runItemFinance:response',message:'Item finance API payload received',data:{summaryKeys:summary?Object.keys(summary):[],summaryTypes:summary?{total_skus:typeof summary.total_skus,in_stock_skus:typeof summary.in_stock_skus,total_stock_qty:typeof summary.total_stock_qty,total_cost_value:typeof summary.total_cost_value,total_sale_value:typeof summary.total_sale_value,portfolio_margin_pct:typeof summary.portfolio_margin_pct}:{},itemCount:Array.isArray(items)?items.length:-1,firstItemMarginType:Array.isArray(items)&&items[0]?typeof items[0].margin_pct:'missing'},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    if (summary) {
      const portfolioMargin = summary.portfolio_margin_pct != null
        ? summary.portfolio_margin_pct.toFixed(1) + '%' : '—';
      document.getElementById('if-s-skus').textContent      = Number(summary.total_skus      || 0).toLocaleString('en-IN');
      document.getElementById('if-s-instock').textContent   = Number(summary.in_stock_skus   || 0).toLocaleString('en-IN');
      document.getElementById('if-s-stock-qty').textContent = Number(summary.total_stock_qty || 0).toLocaleString('en-IN');
      document.getElementById('if-s-cost-val').textContent  = fmtRs(summary.total_cost_value);
      document.getElementById('if-s-sale-val').textContent  = fmtRs(summary.total_sale_value);
      document.getElementById('if-s-margin').textContent    = portfolioMargin;
      document.getElementById('if-summary-row').style.display = 'block';

      // #region agent log
      fetch('http://127.0.0.1:7701/ingest/24aa53f2-1d4f-48eb-8837-69df532a7134',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1d0c1b'},body:JSON.stringify({sessionId:'1d0c1b',runId:'item-finance-pre-fix',hypothesisId:'H3-H4',location:'src/public/js/finance-prototype.js:runItemFinance:summary-rendered',message:'Item finance summary rendered',data:(()=>{const firstCard=document.querySelector('#if-summary-row .stat-card');const summaryRow=document.getElementById('if-summary-row');const cardStyle=firstCard?getComputedStyle(firstCard):null;return{summaryDisplay:summaryRow?summaryRow.style.display:'missing',cardCount:document.querySelectorAll('#if-summary-row .stat-card').length,firstCardBackground:cardStyle?cardStyle.backgroundColor:'missing',firstCardBorderTop:cardStyle?cardStyle.borderTop:'missing',firstCardPadding:cardStyle?cardStyle.padding:'missing'};})(),timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }

    _ifItemRows = items || [];
    document.getElementById('if-search').value = '';
    ifRenderItems(_ifItemRows);
    document.getElementById('if-row-count').textContent = _ifItemRows.length + ' SKUs';
    document.getElementById('if-table-card').style.display = '';

  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7701/ingest/24aa53f2-1d4f-48eb-8837-69df532a7134',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1d0c1b'},body:JSON.stringify({sessionId:'1d0c1b',runId:'item-finance-pre-fix',hypothesisId:'H2',location:'src/public/js/finance-prototype.js:runItemFinance:catch',message:'Item finance render failed',data:{error:err&&err.message?err.message:String(err)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    alert('Report error: ' + err.message);
    document.getElementById('if-initial').style.display = '';
  }
};

function ifRenderItems(rows) {
  const tbody = document.getElementById('if-tbody');
  const empty = document.getElementById('if-empty');
  // #region agent log
  fetch('http://127.0.0.1:7701/ingest/24aa53f2-1d4f-48eb-8837-69df532a7134',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1d0c1b'},body:JSON.stringify({sessionId:'1d0c1b',runId:'item-finance-pre-fix',hypothesisId:'H2',location:'src/public/js/finance-prototype.js:ifRenderItems:start',message:'Item rows rendering',data:{rowCount:Array.isArray(rows)?rows.length:-1,firstRow:Array.isArray(rows)&&rows[0]?{sku_code:rows[0].sku_code,marginType:typeof rows[0].margin_pct,stockType:typeof rows[0].stock_qty,costType:typeof rows[0].cost_value,saleType:typeof rows[0].sale_value}:null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!rows || rows.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  tbody.innerHTML = rows.map((r) => {
    const margin = r.margin_pct != null
      ? r.margin_pct.toFixed(1) + '%' : '—';
    const marginColor = r.margin_pct != null
      ? (Number(r.margin_pct) >= 30 ? '#10b981' : Number(r.margin_pct) >= 15 ? '#f59e0b' : '#ef4444')
      : 'var(--tx2)';
    const stockColor = Number(r.stock_qty) > 0 ? '#10b981' : '#94a3b8';
    const statusBg   = r.status === 'ACTIVE' ? '#10b98122' : '#94a3b822';
    const statusClr  = r.status === 'ACTIVE' ? '#10b981'   : '#94a3b8';
    return `<tr>
      <td class="mono" style="font-size:12px;font-weight:600">${escHtml(r.sku_code)}</td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escHtml(r.product_name)}">${escHtml(r.product_name)}</td>
      <td>${escHtml(r.brand_name)}</td>
      <td><span style="font-size:11px;padding:2px 7px;border-radius:10px;background:#64748b22;color:#64748b;font-weight:500">${escHtml(r.product_type || '—')}</span></td>
      <td>${escHtml(r.colour_name)}${r.colour_code ? ` <span style="font-size:10px;color:var(--muted)">(${escHtml(r.colour_code)})</span>` : ''}</td>
      <td class="tr mono" style="font-size:12px">${fmtRs(r.sale_price)}</td>
      <td class="tr" style="font-weight:600;color:${marginColor}">${margin}</td>
      <td class="tr" style="color:${stockColor};font-weight:600">${Number(r.stock_qty).toLocaleString('en-IN')}</td>
      <td class="tr mono" style="font-size:12px">${fmtRs(r.cost_value)}</td>
      <td class="tr mono" style="font-size:12px">${fmtRs(r.sale_value)}</td>
      <td><span style="font-size:11px;padding:2px 7px;border-radius:10px;background:${statusBg};color:${statusClr};font-weight:500">${escHtml(r.status || '—')}</span></td>
    </tr>`;
  }).join('');
}

window.ifFilterItems = function ifFilterItems() {
  const q = (document.getElementById('if-search').value || '').toLowerCase();
  if (!q) return ifRenderItems(_ifItemRows);
  ifRenderItems(_ifItemRows.filter((r) =>
    (r.sku_code     || '').toLowerCase().includes(q) ||
    (r.product_name || '').toLowerCase().includes(q) ||
    (r.brand_name   || '').toLowerCase().includes(q) ||
    (r.colour_name  || '').toLowerCase().includes(q) ||
    (r.product_type || '').toLowerCase().includes(q)
  ));
};

window.ifClear = function ifClear() {
  document.getElementById('if-brand').value  = '';
  document.getElementById('if-type').value   = '';
  document.getElementById('if-status').value = '';
  document.getElementById('if-q').value      = '';
  document.getElementById('if-summary-row').style.display = 'none';
  document.getElementById('if-table-card').style.display  = 'none';
  document.getElementById('if-initial').style.display     = '';
  _ifItemRows = [];
};
