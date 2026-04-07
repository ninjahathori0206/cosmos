/* ─── Store Pilot — Store Manager module ─────────────────────────────────────── */

// ── Mobile sidebar toggle ──────────────────────────────────────────────────────
function openSidebar() {
  document.querySelector('.sidebar').classList.add('open');
  document.getElementById('sp-sidebar-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('sp-sidebar-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

const SP_API_KEY = 'CHANGE_ME_API_KEY';

// ── Auth helpers ───────────────────────────────────────────────────────────────
function getToken() { return sessionStorage.getItem('cosmos_token') || ''; }

async function apiFetch(method, path, body) {
  const headers = {
    'Content-Type':  'application/json',
    'X-API-Key':     SP_API_KEY,
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

// ── Module state ───────────────────────────────────────────────────────────────
let _storeId         = null;
let _storeName       = null;
let _fStockDebounce  = null;
let _bcDebounce      = null;
let _scDebounce      = null;
let _dashTimer       = null;
let _tcDebounce      = null;
let _transferCart    = [];

// ── Breadcrumb map ─────────────────────────────────────────────────────────────
const spBcMap = {
  dashboard:              'Dashboard',
  'stock-browse':         'Stock View — Browse Catalogue',
  'store-catalogue':      'Stock View — Store Catalogue',
  'transfers-history':    'Foundry Connect — My Requests',
  'transfers-create':     'Foundry Connect — Request Goods',
  'incoming-transfers':   'Foundry Connect — Incoming Goods',
  'movement-list':        'Foundry Connect — Movement List',
  reports:                'Store Reports'
};

// ── Navigation ─────────────────────────────────────────────────────────────────
window.spNav = function (id, el) {
  document.querySelectorAll('.main .page').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav .nav-item').forEach((n) => n.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  if (el) el.classList.add('active');
  const bc = document.getElementById('sp-bc');
  if (bc) bc.textContent = spBcMap[id] || id;
  closeSidebar();
  loadStorePilotPage(id);
};

function loadStorePilotPage(id) {
  if (id === 'dashboard')          loadDashboard();
  if (id === 'stock-browse')       window.loadBrowseCatalogue();
  if (id === 'store-catalogue')    window.loadStoreCatalogue();
  if (id === 'transfers-history')  window.loadTransferHistory();
  if (id === 'transfers-create')   initTransferCreate();
  if (id === 'reports')            loadReports();
  if (id === 'incoming-transfers') loadIncomingTransfers();
  if (id === 'movement-list')      loadSpMovementList();
}

// ── Init ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadUser();
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
      if (mods.command_unit !== false) window.location.href = '/command-unit.html';
      else if (mods.foundry !== false) window.location.href = '/foundry.html';
      else if (mods.finance !== false) window.location.href = '/finance.html';
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
    _storeId   = u.store_id   || null;
    _storeName = u.store_name || null;
    if (typeof window.applyCosmosModuleSwitchNav === 'function') {
      window.applyCosmosModuleSwitchNav('sp-switch-module-wrap', u);
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
      lastEl.textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
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
              <td style="color:var(--text3);font-size:12px">${escHtml(r.from_location || 'HQ Warehouse')}</td>
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
      const badge = r.total_stock > 10
        ? `<span class="b b-green">${r.total_stock} in stock</span>`
        : r.total_stock > 0
          ? `<span class="b b-gold">${r.total_stock} in stock</span>`
          : `<span class="b b-red">Out of stock</span>`;
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

    const stockColor = sku.total_stock > 10 ? 'var(--green)' : sku.total_stock > 0 ? 'var(--gold)' : 'var(--red)';
    const locRows = locs.length
      ? locs.map((l) => {
          const qty = Number(l.qty) || 0;
          return `
            <div class="loc-row">
              <div>
                <div class="loc-name">${escHtml(l.location_name || l.location_type)}</div>
                <div class="loc-type">${escHtml(l.location_type || '')} ${l.store_name ? '· ' + escHtml(l.store_name) : ''}</div>
              </div>
              <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;color:${qty > 0 ? 'var(--text1)' : 'var(--text3)'}">${qty}</span>
            </div>`;
        }).join('')
      : '<div class="loc-row" style="color:var(--text3);font-size:13px">No stock in any location</div>';

    wrap.innerHTML = `
      <div class="detail-panel">
        <div class="detail-header">
          <div class="detail-sku">${escHtml(sku.sku_code)}</div>
          <div class="detail-desc">${escHtml(sku.description || sku.brand_name || '')}</div>
          <div style="display:flex;align-items:baseline;gap:10px;margin-top:10px">
            <div class="detail-total" style="color:${stockColor}">${sku.total_stock || 0}</div>
            <div style="font-size:12px;color:var(--text3)">total units across network</div>
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
          <span class="b ${l.qty > 0 ? 'b-green' : 'b-gray'}">${l.qty}</span>
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
  if (grid) grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state"><div class="ei">⏳</div><div class="et">Loading catalogue…</div></div></div>`;

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
      const whBadge   = whQty === null ? '' : `<span class="b ${whQty > 0 ? 'b-green' : 'b-red'}">${whQty} WH</span>`;
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
  showErr('sc-err', '');
  if (spin) spin.style.display = 'inline';
  if (grid) grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state"><div class="ei">⏳</div><div class="et">Loading store stock…</div></div></div>`;

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
    if (resultsEl) resultsEl.innerHTML = `<div class="empty-state"><div class="ei">🔍</div><div class="et">Search to see stock available at HQ Warehouse</div></div>`;
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
      resultsEl.innerHTML = `<div class="empty-state"><div class="ei">📦</div><div class="et">No HQ Warehouse stock found for "${escHtml(q)}"</div></div>`;
      return;
    }
    resultsEl.innerHTML = rows.map((r) => {
      const inCart    = _transferCart.some((c) => c.sku_id === r.sku_id);
      // API returns warehouse_qty from sp_StockTransfer_ListAvailable
      const warehouseQty = r.warehouse_qty != null ? Number(r.warehouse_qty) : 0;
      const displayName  = r.product_name  || r.description || r.brand_name || '';
      const colourPart   = r.colour_name   ? ` — ${r.colour_name}` : '';
      return `
        <div class="avail-row">
          <div style="flex:1;min-width:0">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:var(--acc)">${escHtml(r.sku_code)}</div>
            <div style="font-size:12.5px;color:var(--text2);margin-top:2px">${escHtml(displayName + colourPart)}</div>
          </div>
          <span class="b ${warehouseQty > 0 ? 'b-green' : 'b-red'}" style="white-space:nowrap">${warehouseQty} in Warehouse</span>
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
        <span style="font-size:11px;color:var(--text3)" title="Available in HQ Warehouse">/ ${item.avail_qty} WH</span>
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
    if (ri) ri.innerHTML = `<div class="empty-state"><div class="ei">🔍</div><div class="et">Search to see stock available at HQ Warehouse</div></div>`;
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
  if (monthEl) monthEl.textContent = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
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

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

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
          <div class="sm" style="color:var(--text3)">Requires POS</div>
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
                    <td style="color:var(--text3);font-size:12px">${escHtml(r.from_location || 'HQ Warehouse')}</td>
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
  if (listEl) listEl.innerHTML = '<div class="empty-state"><div class="ei">⏳</div><div class="et">Loading…</div></div>';

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

  detailEl.style.display = '';
  bodyEl.innerHTML = '<div style="padding:20px;color:var(--text3)">Loading…</div>';
  detailEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const data = await apiGet(`/api/stock-transfer-docs/${docId}`);
    const doc  = data.data;
    if (titleEl) titleEl.textContent = `Transfer #${doc.doc_id} — ${doc.store_name}`;

    const lines      = doc.lines || [];
    const isDispatched = doc.status === 'DISPATCHED';
    const isAccepted   = doc.status === 'ACCEPTED';

    const lineRows = lines.map((l) => `
      <div class="inc-verify-line">
        <div style="flex:1;min-width:0">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:var(--acc)">${escHtml(l.sku_code)}</div>
          <div style="font-size:12px;color:var(--text2)">${escHtml(l.product_name)}${l.colour_name ? ' — ' + escHtml(l.colour_name) : ''}</div>
        </div>
        <span style="font-size:12px;color:var(--text3);white-space:nowrap">Sent: <strong>${l.qty_sent}</strong></span>
        ${isAccepted ? `
          <input type="number" id="sp-recv-${l.line_id}" class="qty-input" min="0" max="${l.qty_sent}"
            value="${l.qty_received != null ? l.qty_received : l.qty_sent}"
            style="width:72px" placeholder="Rcvd">
        ` : (l.qty_received != null ? `<span class="b b-green" style="white-space:nowrap">Rcvd: ${l.qty_received}</span>` : '')}
      </div>`).join('');

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
        <div id="sp-inc-action-msg" style="font-size:12px;min-height:16px;margin-top:10px"></div>
        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
          ${isDispatched ? `<button class="btn primary" onclick="incAccept(${doc.doc_id})">✓ Accept Transfer</button>` : ''}
          ${isAccepted   ? `<button class="btn primary" onclick="incStock(${doc.doc_id},[${lines.map(l => l.line_id).join(',')}])">📦 Verify &amp; Stock</button>` : ''}
          ${doc.status === 'STOCKED' ? `<span style="color:var(--green);font-size:13px;font-weight:600">✓ Stock credited on ${fmtDate(doc.stocked_at)}</span>` : ''}
        </div>
      </div>`;
  } catch (err) {
    bodyEl.innerHTML = `<div style="padding:20px;color:var(--red)">Error: ${escHtml(err.message)}</div>`;
  }
};

window.closeIncDetail = function () {
  const el = document.getElementById('sp-inc-detail');
  if (el) el.style.display = 'none';
};

window.incAccept = async function (docId) {
  const msgEl = document.getElementById('sp-inc-action-msg');
  const btn   = document.querySelector('#sp-inc-detail .btn.primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Accepting…'; }
  if (msgEl) msgEl.textContent = '';

  try {
    await apiPut(`/api/stock-transfer-docs/${docId}/accept`, {});
    if (msgEl) { msgEl.style.color = 'var(--green)'; msgEl.textContent = '✓ Accepted. Enter received quantities and click Verify & Stock.'; }
    await expandIncTransfer(docId);
    loadIncomingTransfers();
  } catch (err) {
    if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Error: ' + err.message; }
    if (btn) { btn.disabled = false; btn.textContent = '✓ Accept Transfer'; }
  }
};

window.incStock = async function (docId, lineIds) {
  const msgEl = document.getElementById('sp-inc-action-msg');
  if (msgEl) msgEl.textContent = '';

  const lines = lineIds.map((lid) => {
    const input = document.getElementById(`sp-recv-${lid}`);
    return { line_id: lid, qty_received: input ? Math.max(0, Number(input.value) || 0) : 0 };
  });

  const btn = document.querySelector('#sp-inc-detail .btn.primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Stocking…'; }

  try {
    await apiPut(`/api/stock-transfer-docs/${docId}/stock`, { lines });
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
      wrap.innerHTML = '<div class="empty-state"><div class="ei">📋</div><div class="et">No transfer documents found</div><div class="es">Stock dispatched from HQ Warehouse will appear here.</div></div>';
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
          <div class="inc-tr-sub">HQ Warehouse → ${d.store_name || 'Your Store'} &nbsp;·&nbsp; ${d.dispatched_at ? new Date(d.dispatched_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }) : '—'}</div>
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
  panEl.style.display = '';
  titleEl.textContent = `Transfer Document DOC-${docId}`;
  bodyEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3)">Loading…</div>';
  panEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
