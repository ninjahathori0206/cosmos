
document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.nav-item[data-foundry-permission="foundry.bill_verification.view"]').forEach((el) => { el.style.display = 'none'; });
  const bvPage = document.getElementById('page-bill-verify');
  if (bvPage) bvPage.style.display = 'none';
  // Visual-only theme polish for Foundry prototype screens.
  // Keeps existing behavior and structure intact.
  (function injectFoundryPrototypeUiPolish() {
    if (document.getElementById('fy-ui-polish')) return;
    const style = document.createElement('style');
    style.id = 'fy-ui-polish';
    style.textContent = `
      :root{
        --bg:#f8fafc;
        --bg2:#eef2ff;
        --text:#0f172a;
        --text2:#334155;
        --text3:#64748b;
        --border:#dbe4f0;
        --acc:#4f46e5;
        --acc2:#2563eb;
        --accL:#e0e7ff;
        --green:#166534;
        --greenL:#dcfce7;
        --red:#dc2626;
        --redL:#fee2e2;
        --gold:#b45309;
        --goldL:#fef3c7;
        --teal:#0f766e;
        --tealL:#ccfbf1;
      }
      body{background:var(--bg)}
      .sidebar{border-right:1px solid var(--border)}
      .sidebar-nav .nav-item{
        border:1px solid transparent;
        border-radius:10px;
        margin:2px 6px;
        transition:background .15s ease,border-color .15s ease,color .15s ease;
      }
      .sidebar-nav .nav-item:hover{background:#f1f5f9;border-color:var(--border)}
      .sidebar-nav .nav-item.active{background:var(--acc2);color:#fff;border-color:var(--acc2)}
      .card{
        border:1px solid var(--border) !important;
        border-radius:12px !important;
        box-shadow:0 4px 14px rgba(15,23,42,.04);
      }
      .ch{border-bottom:1px solid var(--border)}
      .ct{letter-spacing:.01em}
      .btn{
        border-radius:9px !important;
        border:1px solid transparent;
        transition:background .15s ease,border-color .15s ease,transform .06s ease;
      }
      .btn:hover{transform:translateY(-1px)}
      .btn.primary{background:var(--acc2) !important}
      .btn.primary:hover{background:#1d4ed8 !important}
      .btn.xs,.btn.sm{font-weight:600}
      input,select,textarea{
        border:1px solid var(--border) !important;
        border-radius:9px !important;
        background:#fff !important;
        color:var(--text) !important;
        transition:border-color .15s ease, box-shadow .15s ease;
      }
      input:focus,select:focus,textarea:focus{
        border-color:var(--acc2) !important;
        box-shadow:0 0 0 2px rgba(37,99,235,.14);
        outline:none;
      }
      .tw table thead th{
        background:#eef2ff;
        color:#4338ca;
      }
      .tw table tbody tr:hover td{background:#f8fbff}
      .b{border-radius:999px;padding:2px 8px}
      .b-green{background:var(--greenL);color:var(--green)}
      .b-red{background:var(--redL);color:var(--red)}
      .b-gold{background:var(--goldL);color:var(--gold)}
      .b-blue{background:#dbeafe;color:#1d4ed8}
      .b-teal{background:var(--tealL);color:var(--teal)}
      .digi-media-grid{display:grid;grid-template-columns:100px 1fr;gap:10px;align-items:start}
      .digi-upload-tile{
        min-height:92px;border:1.5px dashed #c7d2fe;border-radius:10px;
        background:#f8faff;color:#4f46e5;display:flex;align-items:center;justify-content:center;
        text-align:center;font-size:11px;font-weight:600;line-height:1.3;cursor:pointer;padding:8px;
      }
      .digi-media-strip{display:flex;gap:8px;flex-wrap:wrap}
      .digi-media-thumb{
        width:112px;height:84px;border-radius:8px;border:1px solid var(--border);
        overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;position:relative;
      }
      .digi-media-thumb img,.digi-media-thumb video{width:100%;height:100%;object-fit:cover}
      .digi-media-actions{display:flex;gap:6px;margin-top:6px}
      .digi-media-actions .btn{padding:4px 8px !important;font-size:11px}
      .ml-toolbar{
        display:flex;gap:10px;align-items:center;justify-content:space-between;
        padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:#fff;margin-bottom:10px;
      }
      .ml-toolbar .ml-search{max-width:320px;width:100%}
      .ml-count{font-size:12px;color:var(--text3);white-space:nowrap}
      .ml-rows{display:flex;flex-direction:column;gap:8px}
      .ml-row-dense{
        display:flex;align-items:center;justify-content:space-between;gap:12px;
        border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:#fff;cursor:pointer;
      }
      .ml-row-dense:hover{background:#f8fbff}
      .ml-pri{font-size:13px;font-weight:600;color:var(--text)}
      .ml-sec{font-size:12px;color:var(--text3);margin-top:2px}
      .ml-meta-grid{
        display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px;
      }
      .ml-meta-card{border:1px solid var(--border);border-radius:10px;padding:9px 10px;background:#fff}
      .ml-meta-k{font-size:11px;color:var(--text3);margin-bottom:3px}
      .ml-meta-v{font-size:13px;font-weight:600;color:var(--text)}
      .ml-lines-table th{background:#eef2ff;color:#4338ca}
      .ml-lines-table td,.ml-lines-table th{padding:7px 8px;border-bottom:1px solid var(--border)}
      .br-summary{
        display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px
      }
      .br-kpi{
        border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:#fff;min-width:140px
      }
      .br-kpi .k{font-size:11px;color:var(--text3);margin-bottom:2px}
      .br-kpi .v{font-size:13px;font-weight:700;color:var(--text)}
      .br-item-card{
        border:1px solid var(--border);border-radius:10px;background:#fff;padding:10px 12px;margin-bottom:10px
      }
      .br-item-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:8px}
      .br-item-title{font-size:13px;font-weight:700;color:var(--text)}
      .br-item-sub{font-size:12px;color:var(--text3)}
      .br-pill{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid var(--border);background:var(--bg)}
      .br-meta-strip{
        display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px
      }
      .br-meta-cell{
        border:1px solid var(--border);border-radius:8px;background:var(--bg);padding:6px 8px;display:flex;gap:6px;align-items:center
      }
      .br-meta-cell .k{font-size:11px;color:var(--text3)}
      .br-meta-cell .v{font-size:12px;font-weight:600;color:var(--text)}
      .br-table th{background:#f1f5ff;color:#4f46e5;font-size:10px}
      .br-table td{padding:6px 8px}
      #branding-receipt-verify-wrap .tw table th{background:#f1f5ff;color:#4f46e5}
      #branding-receipt-verify-wrap .tw table td,#branding-receipt-verify-wrap .tw table th{padding:6px 8px}
    `;
    document.head.appendChild(style);
  })();

  const token = sessionStorage.getItem('cosmos_token');
  const userRaw = sessionStorage.getItem('cosmos_user');

  if (!token || !userRaw) { window.location.href = '/'; return; }

  let apiKey;
  try {
    apiKey = await window.cosmosEnsureApiKey();
  } catch (e) {
    if (typeof cosmosToastError === 'function') cosmosToastError(e.message || 'Invalid or missing API key');
    sessionStorage.removeItem('cosmos_token');
    sessionStorage.removeItem('cosmos_user');
    window.location.href = '/';
    return;
  }

  const user = JSON.parse(userRaw);
  const userPermissions = Array.isArray(user.permissions) ? user.permissions : [];

  /** Matches PUT /api/purchases/:id/revert-to-draft (OR semantics). */
  function fyCanRevertPurchaseToDraft() {
    if (user && String(user.role || '') === 'super_admin') return true;
    const pl = userPermissions.map((x) => String(x).toLowerCase());
    return (
      pl.includes('foundry.purchases.edit')
      || pl.includes('foundry.purchases.create')
      || pl.includes('foundry.bill_verification.create')
    );
  }

  /** Needed to open New Purchase and edit the draft after revert. */
  function fyCanEditPurchaseDraftAfterRevert() {
    if (user && String(user.role || '') === 'super_admin') return true;
    const pl = userPermissions.map((x) => String(x).toLowerCase());
    return pl.includes('foundry.purchases.create') || pl.includes('foundry.purchases.edit');
  }

  const mods = user.modules;
  const hasMap = mods && typeof mods === 'object' && Object.keys(mods).length > 0;
  if (hasMap && mods.foundry === false) {
    if (mods.command_unit !== false) window.location.href = '/command-unit/dashboard';
    else if (mods.finance !== false) window.location.href = '/finance/dashboard';
    else if (mods.storepilot !== false) window.location.href = '/storepilot/dashboard';
    else if (mods.pos !== false) window.location.href = '/storeos/login';
    else if (mods.cx !== false) window.location.href = '/cx/dashboard';
    else window.location.href = '/';
    return;
  }

  const nameEl = document.getElementById('foundry-user-name');
  const roleEl = document.getElementById('foundry-user-role');
  const avEl   = document.getElementById('foundry-user-av');
  if (nameEl) nameEl.textContent = user.full_name || user.username || 'User';
  if (roleEl) roleEl.textContent = user.role || 'Procurement';
  if (avEl && user.full_name) {
    avEl.textContent = user.full_name.split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  }

  if (typeof window.initCosmosModuleSwitchFooter === 'function') {
    window.initCosmosModuleSwitchFooter(user);
  }

  // ── Foundry permission helpers (Phase B catalogue — OR comma-separated keys) ─
  function foundryHasAnyPerm(keysStrOrArr) {
    if (user.role === 'super_admin') return true;
    const arr = Array.isArray(keysStrOrArr)
      ? keysStrOrArr
      : String(keysStrOrArr || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!arr.length) return true;
    return arr.some((k) => userPermissions.includes(k));
  }

  const FOUNDRY_PAGE_VIEW_BY_PAGE = {
    'sku-catalogue': ['foundry.catalogue.view'],
    'stock-view': ['foundry.stock.view'],
    'lens-packages': ['foundry.lens.packages.view'],
    'lens-addons': ['foundry.lens.addons.view'],
    'lens-package-addons': ['foundry.lens.matrix.view'],
    'lens-wizard-rules': ['foundry.lens.wizard.view'],
    'master-catalogue': ['foundry.master_catalogue.view', 'foundry.purchases.view'],
    'rate-intelligence': ['foundry.rate_intelligence.view']
  };

  const FOUNDRY_CATALOGUE_EDIT_BY_PAGE = {
    'sku-catalogue': ['foundry.catalogue.edit'],
    'lens-packages': ['foundry.lens.packages.edit'],
    'lens-addons': ['foundry.lens.addons.edit'],
    'lens-package-addons': ['foundry.lens.matrix.edit'],
    'lens-wizard-rules': ['foundry.lens.wizard.edit'],
    'master-catalogue': ['foundry.master_catalogue.edit', 'foundry.purchases.create', 'foundry.purchases.edit']
  };

  function foundryPageCanView(pageId) {
    const keys = FOUNDRY_PAGE_VIEW_BY_PAGE[pageId];
    if (!keys || !keys.length) return true;
    return foundryHasAnyPerm(keys);
  }

  function foundryCatalogueCanViewPage(pageId) {
    return foundryPageCanView(pageId);
  }

  function foundryCatalogueCanEditPage(pageId) {
    return foundryHasAnyPerm(FOUNDRY_CATALOGUE_EDIT_BY_PAGE[pageId] || ['foundry.catalogue.edit']);
  }

  // ── Foundry sidebar permission gating ─────────────────────────────────────
  // Hide nav items the current user lacks permission for, then collapse any
  // nav-group heading that has no visible items beneath it.
  (function applyFoundryPermissionNav() {
    // super_admin (empty permissions array with role super_admin) sees everything
    if (user.role === 'super_admin') return;

    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;

    document.querySelectorAll('[data-foundry-permission]').forEach((el) => {
      const required = el.getAttribute('data-foundry-permission');
      if (required && !foundryHasAnyPerm(required)) {
        el.style.display = 'none';
      }
    });

    // Hide nav-group headings whose subsequent permission-gated items are all hidden
    nav.querySelectorAll('.nav-group[data-foundry-nav-group]').forEach((group) => {
      // Collect all nav-items between this group and the next sibling group (or end)
      const items = [];
      let sibling = group.nextElementSibling;
      while (sibling && sibling.classList.contains('nav-item')) {
        if (sibling.hasAttribute('data-foundry-permission')) {
          items.push(sibling);
        }
        sibling = sibling.nextElementSibling;
      }
      const allHidden = items.length > 0 && items.every((el) => el.style.display === 'none');
      if (allHidden) group.style.display = 'none';
    });
  })();

  // ── HTTP helpers ──────────────────────────────────────────────────────────
  function authHeaders(extra) {
    return Object.assign({ 'X-API-Key': apiKey, Authorization: `Bearer ${token}` }, extra || {});
  }

  function _buildApiError(data, status) {
    let msg = (data && data.message) ? data.message : `HTTP ${status}`;
    if (data && Array.isArray(data.errors) && data.errors.length) msg += ' — ' + data.errors.join('; ');
    // Surface raw SQL/server error detail when present
    if (data && data.error) msg += ' | Detail: ' + data.error;
    return new Error(msg);
  }

  async function _parseApiJsonResponse(res) {
    const text = await res.text();
    if (!text) {
      if (res.status === 429) {
        throw new Error('Too many requests — wait a moment and refresh the page.');
      }
      throw new Error(`HTTP ${res.status}: empty response`);
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch (_e) {
      if (res.status === 429) {
        throw new Error('Too many requests — wait a moment and refresh the page.');
      }
      const snippet = text.length > 120 ? text.slice(0, 120) + '…' : text;
      throw new Error(`HTTP ${res.status}: ${snippet}`);
    }
    return data;
  }

  async function apiGet(path) {
    const res = await fetch(path, { headers: authHeaders(), cache: 'no-store' });
    const data = await _parseApiJsonResponse(res);
    if (!res.ok || !data.success) throw _buildApiError(data, res.status);
    return data.data;
  }

  async function apiPost(path, body) {
    const res = await fetch(path, { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body), cache: 'no-store' });
    const data = await _parseApiJsonResponse(res);
    if (!res.ok || !data.success) throw _buildApiError(data, res.status);
    return data.data;
  }

  async function apiPut(path, body) {
    const res = await fetch(path, { method: 'PUT', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body), cache: 'no-store' });
    const data = await _parseApiJsonResponse(res);
    if (!res.ok || !data.success) throw _buildApiError(data, res.status);
    return data.data;
  }

  /** Try several GET paths (e.g. primary + fallback when an older server lacks one route). */
  async function apiGetFirst(paths) {
    let lastErr;
    for (const p of paths) {
      try {
        return await apiGet(p);
      } catch (e) {
        lastErr = e;
        const m = e && e.message ? e.message : '';
        if (m.includes('Resource not found') || m.includes('HTTP 404')) continue;
        throw e;
      }
    }
    throw lastErr;
  }

  // ── Format helpers ────────────────────────────────────────────────────────
  const inr = (n) => n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const inrD = (n) => n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── IST date helper ───────────────────────────────────────────────────────
  function istToday() {
    const [d, m, y] = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).split('/');
    return `${y}-${m}-${d}`;
  }

  function fmtDate(d) {
    if (typeof window.cosmosFmtDate === 'function') return window.cosmosFmtDate(d);
    if (!d) return '—';
    return String(d);
  }

  function fmtDateTime(d) {
    if (typeof window.cosmosFmtDateTime === 'function') return window.cosmosFmtDateTime(d);
    if (!d) return '—';
    return String(d);
  }

  const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

  function showErr(containerId, msg) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  }

  /** Label for `purchase_items.category` / product master keys — same keys as Foundry Settings → Product Types. */
  function productTypeLabel(key) {
    if (!key) return '—';
    const found = (_lookups.product_type || []).find((x) => x.key === key);
    return found ? found.label : key;
  }

  function stageBadge(s) {
    const map = {
      DRAFT:                     ['b-gray',  'Draft'],
      PENDING_BILL_VERIFICATION: ['b-gold',  'Challan submitted'],
      CHALLAN_VALUED:              ['b-teal',  'Valued by Finance'],
      BILL_DISCREPANCY:          ['b-red',   'Bill Discrepancy'],
      PENDING_BRANDING:          ['b-blue',  'Pending Branding'],
      BRANDING_DISPATCHED:       ['b-blue',  'Branding Dispatched'],
      PENDING_DIGITISATION:      ['b-teal',  'Pending Digitisation'],
      WAREHOUSE_READY:           ['b-green', 'Warehouse Ready']
    };
    const [cls, label] = map[s] || ['b-gray', s];
    return `<span class="b ${cls}">${label}</span>`;
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let _allSuppliers      = [];
  let _allMakers         = [];
  let _lookups           = {};
  let _homeBrands        = [];
  let _allBrandingAgents = [];
  let _itemCount         = 0;
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

  let _warehouseRefreshPromise = null;

  async function refreshWarehouseContext() {
    if (_warehouseRefreshPromise) return _warehouseRefreshPromise;
    _warehouseRefreshPromise = (async () => {
      try {
        const wh = await apiGet('/api/foundry-lookups/warehouse-context');
        if (wh && typeof wh.warehouse_display_name === 'string') {
          const t = wh.warehouse_display_name.trim();
          if (t) _warehouseDisplayName = t;
        }
      } catch (e) {
        console.error('refreshWarehouseContext', e);
      }
    })();
    try {
      await _warehouseRefreshPromise;
    } finally {
      _warehouseRefreshPromise = null;
    }
  }
  window._brandingReceiptDraftByHeader = {};
  /** When set, New Purchase opens this draft for edit (line items + header). */
  window._resumeDraftHeaderId = null;
  /** Active draft header id while the New Purchase form is bound to an existing draft. */
  window._editingDraftHeaderId = null;
  window._currentHeaderId = null;
  window._purchaseActiveItemIdx = 1;
  window._purchaseLineModes = {};
  window.getPurchaseActiveIdx = function() {
    return window._purchaseActiveItemIdx || 1;
  };

  // ── Lookup / initial data ─────────────────────────────────────────────────
  let _formDataLoadPromise = null;
  let _formDataReady = false;

  async function loadFormData(forceReload) {
    if (_formDataLoadPromise) return _formDataLoadPromise;
    if (!forceReload && _formDataReady) return;
    _formDataLoadPromise = _loadFormDataInner(forceReload);
    try {
      await _formDataLoadPromise;
    } finally {
      _formDataLoadPromise = null;
    }
  }

  async function _loadFormDataInner(forceReload) {
    // Use allSettled so one failing endpoint (e.g. branding-agents) does not block suppliers.
    // Use GET /api/suppliers?status=active (full list) — search?q= uses sp_Supplier_Search TOP 20 only.
    showErr('new-purchase-error', '');
    await refreshWarehouseContext();
    const [supR, makersR, lookupsR, brandsR, agentsR] = await Promise.allSettled([
      apiGet('/api/suppliers?status=active'),
      apiGet('/api/maker-master'),
      apiGet('/api/foundry-lookups'),
      apiGet('/api/home-brands'),
      apiGet('/api/branding-agents')
    ]);

    if (supR.status === 'fulfilled') {
      _allSuppliers = supR.value || [];
      _formDataReady = true;
    } else {
      console.error('loadFormData: suppliers', supR.reason);
      _allSuppliers = [];
      const msg = supR.reason && supR.reason.message ? supR.reason.message : String(supR.reason);
      showErr('new-purchase-error', 'Could not load suppliers: ' + msg);
    }

    if (makersR.status === 'fulfilled') _allMakers = makersR.value || [];
    else console.error('loadFormData: maker-master', makersR.reason);

    if (brandsR.status === 'fulfilled') _homeBrands = brandsR.value || [];
    else console.error('loadFormData: home-brands', brandsR.reason);

    if (agentsR.status === 'fulfilled') _allBrandingAgents = agentsR.value || [];
    else console.error('loadFormData: branding-agents', agentsR.reason);

    const lookupArr = lookupsR.status === 'fulfilled' ? (lookupsR.value || []) : [];
    if (lookupsR.status === 'rejected') console.error('loadFormData: foundry-lookups', lookupsR.reason);

    _lookups = {};
    lookupArr.forEach((row) => {
      const t = row.lookup_type;
      if (!_lookups[t]) _lookups[t] = [];
      _lookups[t].push({ key: row.lookup_key, label: row.lookup_label, id: row.lookup_id });
    });

    if (!_lookups.product_type || !_lookups.product_type.length) {
      _lookups.product_type = (lookupArr || [])
        .filter((row) => row.lookup_type === 'product_type')
        .map((row) => ({
          key: row.lookup_key,
          label: row.lookup_label,
          id: row.lookup_id
        }));
    }

    populateAllSupplierSelects();
    populateMakerSelects();
    syncPurchaseItemProductTypeSelects();
    populateCollectionDefaultsMakerDatalist();
    syncCollectionDefaultsProductTypeSelect();
  }

  /** Rebuild Product Type dropdown options on existing item rows after lookups refresh. */
  function syncPurchaseItemProductTypeSelects() {
    document.querySelectorAll('[id^="item-product-type-"]').forEach((sel) => {
      const cur = sel.value;
      let html = '<option value="">— Select Product Type —</option>';
      (_lookups.product_type || []).forEach((pt) => {
        html += `<option value="${pt.key}">${pt.label}</option>`;
      });
      sel.innerHTML = html;
      if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
    });
  }

  function populateCollectionDefaultsMakerDatalist() {
    const ml = document.getElementById('coll-default-maker-list');
    if (!ml) return;
    ml.innerHTML = (_allMakers || []).map((m) => `<option value="${String(m.maker_name || '').replace(/"/g, '&quot;')}"></option>`).join('');
  }

  function syncCollectionDefaultsProductTypeSelect() {
    const sel = document.getElementById('coll-default-product-type');
    if (!sel) return;
    const cur = sel.value;
    let html = '<option value="">— Select Product Type —</option>';
    (_lookups.product_type || []).forEach((pt) => {
      html += `<option value="${pt.key}">${pt.label}</option>`;
    });
    sel.innerHTML = html;
    if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
  }

  function resetCollectionDefaultsCard() {
    const ids = ['coll-default-maker-name', 'coll-default-maker', 'coll-default-source-brand', 'coll-default-source-coll'];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const pt = document.getElementById('coll-default-product-type');
    if (pt) pt.value = '';
    const cb = document.getElementById('coll-default-apply-new');
    if (cb) cb.checked = true;
    const cRate = document.getElementById('coll-default-rate');
    if (cRate) cRate.value = '';
    const cGst = document.getElementById('coll-default-gst');
    if (cGst) cGst.value = '';
    const cBrand = document.getElementById('coll-default-branding');
    if (cBrand) cBrand.checked = false;
    setDatalistOptions('coll-default-source-brand-list', []);
    setDatalistOptions('coll-default-source-coll-list', []);
    if (typeof window.refreshApplyCollMinimalUi === 'function') window.refreshApplyCollMinimalUi();
  }

  /** Apply strip values to one line item (used for new lines and “apply to all”). */
  async function applyPurchaseCollectionDefaultsToItem(idx) {
    const makerName = val('coll-default-maker-name');
    const pt = val('coll-default-product-type');
    const sb = val('coll-default-source-brand');
    const sc = val('coll-default-source-coll');
    const defRate = String(val('coll-default-rate') || '').trim();
    const defGst = String(val('coll-default-gst') || '').trim();
    const collBrandEl = document.getElementById('coll-default-branding');
    const itemBrandEl = document.getElementById(`item-branding-${idx}`);
    if (itemBrandEl && collBrandEl) itemBrandEl.checked = collBrandEl.checked;

    const hasIdentity = !!(makerName || pt || sb || sc);
    if (!hasIdentity && defRate === '' && defGst === '') {
      if (typeof window.calcItemBill === 'function') window.calcItemBill(idx);
      return;
    }

    if (hasIdentity) {
      const dstMaker = document.getElementById(`item-maker-name-${idx}`);
      if (dstMaker && makerName) {
        dstMaker.value = makerName;
        await window.onMakerInputChange(idx);
      }

      const dstPt = document.getElementById(`item-product-type-${idx}`);
      if (dstPt && pt) dstPt.value = pt;

      const dstBrand = document.getElementById(`item-source-brand-${idx}`);
      if (dstBrand && sb) dstBrand.value = sb;
      const dstColl = document.getElementById(`item-source-coll-${idx}`);
      if (dstColl && sc) dstColl.value = sc;

      await window.onSourceBrandInputChange(idx);
      await window.onSourceCollectionInputChange(idx);
      await window.onSourceModelInputChange(idx);
    }

    const dstRate = document.getElementById(`item-rate-${idx}`);
    if (dstRate && defRate !== '') dstRate.value = defRate;
    const dstGst = document.getElementById(`item-gst-${idx}`);
    if (dstGst && defGst !== '') dstGst.value = defGst;

    if (typeof window.calcItemBill === 'function') window.calcItemBill(idx);
  }

  window.onCollectionDefaultMakerInputChange = async function() {
    const makerName = val('coll-default-maker-name');
    const matched = resolveMakerByName(makerName);
    const hidden = document.getElementById('coll-default-maker');
    const prevMm = hidden ? hidden.value : '';
    const nextMm = matched ? String(matched.maker_id) : '';
    if (hidden) hidden.value = nextMm;

    if (prevMm !== nextMm) {
      const b = document.getElementById('coll-default-source-brand');
      const c = document.getElementById('coll-default-source-coll');
      if (b) b.value = '';
      if (c) c.value = '';
      setDatalistOptions('coll-default-source-brand-list', []);
      setDatalistOptions('coll-default-source-coll-list', []);
    }

    if (matched) {
      const brands = await loadSourceSuggestions('source_brand', { maker_master_id: matched.maker_id, q: '' });
      setDatalistOptions('coll-default-source-brand-list', brands);
    }
  };

  window.onCollectionDefaultSourceBrandInputChange = async function() {
    const mmId = val('coll-default-maker');
    const sourceBrand = val('coll-default-source-brand');
    if (!mmId) {
      setDatalistOptions('coll-default-source-brand-list', []);
      setDatalistOptions('coll-default-source-coll-list', []);
      return;
    }
    const mm = Number(mmId);

    const brands = await loadSourceSuggestions('source_brand', { maker_master_id: mm, q: sourceBrand });
    setDatalistOptions('coll-default-source-brand-list', brands);

    if (!sourceBrand) {
      setDatalistOptions('coll-default-source-coll-list', []);
      return;
    }

    const brandList = document.getElementById('coll-default-source-brand-list');
    const knownBrands = brandList
      ? [...brandList.options].map((o) => o.value.trim().toUpperCase())
      : [];
    const typedUpper = sourceBrand.trim().toUpperCase();
    if (!knownBrands.includes(typedUpper)) {
      setDatalistOptions('coll-default-source-coll-list', []);
      return;
    }

    const collections = await loadSourceSuggestions('source_collection', { maker_master_id: mm, source_brand: sourceBrand, q: '' });
    setDatalistOptions('coll-default-source-coll-list', collections);
  };

  window.onCollectionDefaultSourceCollectionInputChange = async function() {
    const mmId = val('coll-default-maker');
    const sourceBrand = val('coll-default-source-brand');
    const sourceColl = val('coll-default-source-coll');
    if (!mmId || !sourceBrand) return;

    const mm = Number(mmId);
    const collections = await loadSourceSuggestions('source_collection', {
      maker_master_id: mm,
      source_brand: sourceBrand,
      q: sourceColl
    });
    setDatalistOptions('coll-default-source-coll-list', collections);
  };

  window.applyCollectionDefaultsToAllPurchaseItems = async function() {
    const cards = document.querySelectorAll('.purchase-item-card');
    if (!cards.length) return;
    for (const card of cards) {
      const idx = parseInt(card.dataset.idx, 10);
      await applyPurchaseCollectionDefaultsToItem(idx);
    }
  };

  function supplierIdOf(s) {
    if (!s) return '';
    const id = s.supplier_id != null ? s.supplier_id : s.Supplier_Id;
    return id != null ? id : '';
  }

  function buildSupplierOptions(placeholder) {
    let html = `<option value="">${placeholder || '— Select Supplier —'}</option>`;
    (_allSuppliers || []).forEach((s) => {
      const id = supplierIdOf(s);
      const name = s.vendor_name || s.Vendor_Name || '—';
      const code = s.vendor_code || s.Vendor_Code || '';
      html += `<option value="${id}">${name}${code ? ' (' + code + ')' : ''}</option>`;
    });
    return html;
  }

  function buildMakerOptions(placeholder) {
    let html = `<option value="">${placeholder || '— No Maker —'}</option>`;
    (_allMakers || []).forEach((m) => {
      html += `<option value="${m.maker_id}">${m.maker_name}${m.country ? ', ' + m.country : ''}</option>`;
    });
    return html;
  }

  function populateAllSupplierSelects() {
    document.querySelectorAll('.supplier-select').forEach((sel) => {
      const cur = sel.value;
      sel.innerHTML = buildSupplierOptions('— Select Supplier —');
      if (cur) sel.value = cur;
    });
    const bs = document.getElementById('bill-supplier-select');
    if (bs) { const cur = bs.value; bs.innerHTML = buildSupplierOptions('— Select Supplier —'); if (cur) bs.value = cur; }
    const es = document.getElementById('edit-supplier-select');
    if (es) { const cur = es.value; es.innerHTML = buildSupplierOptions('— Select Supplier —'); if (cur) es.value = cur; }
  }

  function populateMakerSelects() {
    document.querySelectorAll('.maker-select').forEach((sel) => {
      const cur = sel.value;
      sel.innerHTML = buildMakerOptions('— No Maker —');
      if (cur) sel.value = cur;
    });
  }

  function setDatalistOptions(listId, values) {
    const list = document.getElementById(listId);
    if (!list) return;
    const unique = [...new Set((values || []).map((v) => String(v || '').trim()).filter(Boolean))];
    list.innerHTML = unique.map((v) => `<option value="${v.replace(/"/g, '&quot;')}"></option>`).join('');
  }

  function resolveMakerByName(name) {
    const needle = String(name || '').trim().toLowerCase();
    if (!needle) return null;
    return (_allMakers || []).find((m) => String(m.maker_name || '').trim().toLowerCase() === needle) || null;
  }

  async function loadSourceSuggestions(field, params) {
    const qs = new URLSearchParams({ field, limit: '25' });
    if (params && params.q != null && String(params.q).trim() !== '') qs.set('q', String(params.q).trim());
    if (params && params.source_brand) qs.set('source_brand', params.source_brand);
    if (params && params.source_collection != null) qs.set('source_collection', params.source_collection);
    if (params && params.maker_master_id != null && params.maker_master_id !== '') {
      qs.set('maker_master_id', String(params.maker_master_id));
    }
    try {
      return await apiGet(`/api/products/source-suggestions?${qs.toString()}`);
    } catch (_) {
      return [];
    }
  }

  window.onMakerInputChange = async function(idx) {
    const makerName = val(`item-maker-name-${idx}`);
    const matched = resolveMakerByName(makerName);
    const hidden = document.getElementById(`item-maker-${idx}`);
    const prevMm = hidden ? hidden.value : '';
    const nextMm = matched ? String(matched.maker_id) : '';
    if (hidden) hidden.value = nextMm;

    if (prevMm !== nextMm) {
      ['item-source-brand', 'item-source-coll', 'item-source-model'].forEach((prefix) => {
        const el = document.getElementById(`${prefix}-${idx}`);
        if (el) el.value = '';
      });
      setDatalistOptions(`item-source-brand-list-${idx}`, []);
      setDatalistOptions(`item-source-coll-list-${idx}`, []);
      setDatalistOptions(`item-source-model-list-${idx}`, []);
    }

    if (matched) {
      const brands = await loadSourceSuggestions('source_brand', { maker_master_id: matched.maker_id, q: '' });
      setDatalistOptions(`item-source-brand-list-${idx}`, brands);
    }
  };

  window.onSourceBrandInputChange = async function(idx) {
    const mmId = val(`item-maker-${idx}`);
    const sourceBrand = val(`item-source-brand-${idx}`);
    if (!mmId) {
      setDatalistOptions(`item-source-brand-list-${idx}`, []);
      setDatalistOptions(`item-source-coll-list-${idx}`, []);
      setDatalistOptions(`item-source-model-list-${idx}`, []);
      return;
    }
    const mm = Number(mmId);

    // Refresh brand suggestions (partial match is fine here)
    const brands = await loadSourceSuggestions('source_brand', { maker_master_id: mm, q: sourceBrand });
    setDatalistOptions(`item-source-brand-list-${idx}`, brands);

    if (!sourceBrand) {
      setDatalistOptions(`item-source-coll-list-${idx}`, []);
      setDatalistOptions(`item-source-model-list-${idx}`, []);
      return;
    }

    // Only fetch collections/models when the typed brand exactly matches a known brand value.
    // The SP uses an exact match on source_brand so partial text would return zero results.
    const brandList = document.getElementById(`item-source-brand-list-${idx}`);
    const knownBrands = brandList
      ? [...brandList.options].map((o) => o.value.trim().toUpperCase())
      : [];
    const typedUpper = sourceBrand.trim().toUpperCase();
    if (!knownBrands.includes(typedUpper)) {
      // Partial / unrecognised brand — clear dependent lists without fetching
      setDatalistOptions(`item-source-coll-list-${idx}`, []);
      setDatalistOptions(`item-source-model-list-${idx}`, []);
      return;
    }

    const [collections, models] = await Promise.all([
      loadSourceSuggestions('source_collection', { maker_master_id: mm, source_brand: sourceBrand, q: '' }),
      loadSourceSuggestions('source_model_number', {
        maker_master_id: mm,
        source_brand: sourceBrand,
        source_collection: '',
        q: ''
      })
    ]);
    setDatalistOptions(`item-source-coll-list-${idx}`, collections);
    setDatalistOptions(`item-source-model-list-${idx}`, models);
  };

  window.onSourceCollectionInputChange = async function(idx) {
    const mmId = val(`item-maker-${idx}`);
    const sourceBrand = val(`item-source-brand-${idx}`);
    const sourceColl = val(`item-source-coll-${idx}`);
    if (!mmId || !sourceBrand) return;

    const mm = Number(mmId);
    const collections = await loadSourceSuggestions('source_collection', {
      maker_master_id: mm,
      source_brand: sourceBrand,
      q: sourceColl
    });
    setDatalistOptions(`item-source-coll-list-${idx}`, collections);

    const models = await loadSourceSuggestions('source_model_number', {
      maker_master_id: mm,
      source_brand: sourceBrand,
      source_collection: sourceColl,
      q: ''
    });
    setDatalistOptions(`item-source-model-list-${idx}`, models);
  };

  window.onSourceModelInputChange = async function(idx) {
    const mmId = val(`item-maker-${idx}`);
    const sourceBrand = val(`item-source-brand-${idx}`);
    const sourceColl = val(`item-source-coll-${idx}`);
    const sourceModel = val(`item-source-model-${idx}`);
    if (!mmId || !sourceBrand) return;

    const models = await loadSourceSuggestions('source_model_number', {
      maker_master_id: Number(mmId),
      source_brand: sourceBrand,
      source_collection: sourceColl,
      q: sourceModel
    });
    setDatalistOptions(`item-source-model-list-${idx}`, models);
  };

  // ── Existing Product Search (global bar + per-line target idx) ────────────
  let _purchaseSearchTimer = null;

  function updatePurchaseGlobalModeButtonStyles(mode) {
    const newBtn = document.getElementById('purchase-entry-mode-new');
    const searchBtn = document.getElementById('purchase-entry-mode-search');
    if (mode === 'search') {
      if (newBtn) { newBtn.style.background = ''; newBtn.style.color = ''; newBtn.style.borderColor = ''; }
      if (searchBtn) { searchBtn.style.background = 'var(--acc2)'; searchBtn.style.color = '#fff'; searchBtn.style.borderColor = 'var(--acc2)'; }
    } else {
      if (searchBtn) { searchBtn.style.background = ''; searchBtn.style.color = ''; searchBtn.style.borderColor = ''; }
      if (newBtn) { newBtn.style.background = 'var(--acc2)'; newBtn.style.color = '#fff'; newBtn.style.borderColor = 'var(--acc2)'; }
    }
  }

  function refreshPurchaseEditSurfacesForActive() {
    const active = window.getPurchaseActiveIdx();
    const modes = window._purchaseLineModes || {};
    document.querySelectorAll('.purchase-item-card').forEach((card) => {
      const i = parseInt(card.dataset.idx, 10);
      const surf = document.getElementById(`item-purchase-edit-surface-${i}`);
      if (!surf) return;
      const m = modes[i] || 'new';
      if (i === active && m === 'search') surf.style.display = 'none';
      else surf.style.display = '';
    });
    const searchWrap = document.getElementById('purchase-global-search-wrap');
    const am = modes[active] || 'new';
    if (searchWrap) searchWrap.style.display = am === 'search' ? 'block' : 'none';
    updatePurchaseGlobalModeButtonStyles(am);
  }

  window.setPurchaseActiveItem = function(idx) {
    window._purchaseActiveItemIdx = idx;
    const label = document.getElementById('purchase-active-item-label');
    if (label) label.textContent = `Editing: Item #${idx}`;
    document.querySelectorAll('.purchase-item-card').forEach((c) => c.classList.remove('purchase-item-card--active'));
    const card = document.getElementById(`item-card-${idx}`);
    if (card) card.classList.add('purchase-item-card--active');
    refreshPurchaseEditSurfacesForActive();
  };

  window.setPurchaseItemMode = function(idx, mode) {
    if (!window._purchaseLineModes) window._purchaseLineModes = {};
    window._purchaseLineModes[idx] = mode;
    const selectedBanner = document.getElementById(`item-selected-banner-${idx}`);
    if (mode === 'search') {
      if (!document.getElementById(`item-selected-pm-${idx}`)?.value) {
        if (selectedBanner) selectedBanner.style.display = 'none';
      }
      setTimeout(() => {
        const q = document.getElementById('purchase-global-search-q');
        if (q && window.getPurchaseActiveIdx() === idx) q.focus();
      }, 50);
    }
    refreshPurchaseEditSurfacesForActive();
  };

  window.onPurchaseItemSearch = function() {
    const idx = window.getPurchaseActiveIdx();
    clearTimeout(_purchaseSearchTimer);
    const q = val('purchase-global-search-q');
    const resultsEl = document.getElementById('purchase-global-search-results');
    const spinner = document.getElementById('purchase-global-search-spinner');

    if (!q || q.length < 2) {
      if (resultsEl) resultsEl.style.display = 'none';
      return;
    }

    if (spinner) spinner.style.display = 'inline';
    _purchaseSearchTimer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, limit: 15 });
        const mmId = val(`item-maker-${idx}`);
        if (mmId) params.set('maker_master_id', mmId);
        const data = await apiGet(`/api/products/search?${params}`);
        renderProductSearchResults(idx, Array.isArray(data) ? data : []);
      } catch (err) {
        if (resultsEl) { resultsEl.innerHTML = `<div style="padding:12px;color:var(--red);font-size:12.5px">Search error: ${err.message}</div>`; resultsEl.style.display = 'block'; }
      } finally {
        if (spinner) spinner.style.display = 'none';
      }
    }, 350);
  };

  function renderProductSearchResults(idx, rows) {
    const el = document.getElementById('purchase-global-search-results');
    if (!el) return;
    if (!rows.length) {
      el.innerHTML = '<div style="padding:12px;color:var(--text3);font-size:12.5px;text-align:center">No matching products found</div>';
      el.style.display = 'block';
      return;
    }
    el.innerHTML = rows.map((r) => {
      const liveBadge = r.live_sku_count > 0
        ? `<span style="background:#c8e6c9;color:#1b5e20;padding:1px 6px;border-radius:10px;font-size:10.5px;font-weight:600;margin-left:6px">${r.live_sku_count} live SKU${r.live_sku_count !== 1 ? 's' : ''}</span>`
        : '';
      const purchaseBadge = r.total_purchases > 0
        ? `<span style="background:#e3f2fd;color:#1565c0;padding:1px 6px;border-radius:10px;font-size:10.5px;font-weight:600;margin-left:4px">${r.total_purchases} purchase${r.total_purchases !== 1 ? 's' : ''}</span>`
        : '';
      const lastDate = r.last_purchase_date
        ? `<span style="color:var(--text3);font-size:11px;margin-left:4px">· last ${fmtDate(r.last_purchase_date)}</span>`
        : '';
      const rateBadge = r.last_purchase_rate != null
        ? `<span style="background:#f3e5f5;color:#6a1b9a;padding:1px 6px;border-radius:10px;font-size:10.5px;font-weight:600;margin-left:4px">₹${Number(r.last_purchase_rate).toLocaleString('en-IN')}/unit</span>`
        : '';
      const makerLine = [r.maker_name, r.source_brand, r.source_collection].filter(Boolean).join(' · ');
      return `<div class="search-result-row" onclick="selectExistingProduct(${idx}, ${JSON.stringify(r).replace(/"/g, '&quot;')})"
          style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.15s"
          onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''">
          <div style="font-weight:600;font-size:13px">${r.source_model_number || r.style_model || '—'}${liveBadge}${purchaseBadge}${rateBadge}${lastDate}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:2px">${makerLine || '—'} &nbsp;·&nbsp; <span style="color:var(--text3)">${r.product_type || ''}</span></div>
        </div>`;
    }).join('');
    el.style.display = 'block';
  }

  window.selectExistingProduct = function(idx, product) {
    if (typeof product === 'string') { try { product = JSON.parse(product); } catch(_) { return; } }

    // Store the selected product_master_id
    const pmEl = document.getElementById(`item-selected-pm-${idx}`);
    if (pmEl) pmEl.value = product.product_id;

    // Populate source fields in the background for downstream compatibility
    const makerNameEl = document.getElementById(`item-maker-name-${idx}`);
    const makerEl     = document.getElementById(`item-maker-${idx}`);
    const brandEl     = document.getElementById(`item-source-brand-${idx}`);
    const collEl      = document.getElementById(`item-source-coll-${idx}`);
    const modelEl     = document.getElementById(`item-source-model-${idx}`);
    const ptEl        = document.getElementById(`item-product-type-${idx}`);

    if (product.maker_name && makerNameEl) makerNameEl.value = product.maker_name;
    if (product.maker_master_id && makerEl) makerEl.value = String(product.maker_master_id);
    if (product.source_brand  && brandEl)  brandEl.value  = product.source_brand;
    if (product.source_collection && collEl) collEl.value  = product.source_collection || '';
    if (product.source_model_number && modelEl) modelEl.value = product.source_model_number;
    if (product.product_type && ptEl) {
      const opt = [...ptEl.options].find((o) => o.value === product.product_type);
      if (opt) ptEl.value = product.product_type;
    }

    // Show selected banner
    const banner  = document.getElementById(`item-selected-banner-${idx}`);
    const descEl  = document.getElementById(`item-selected-desc-${idx}`);
    const badgeEl = document.getElementById(`item-selected-badge-${idx}`);
    if (descEl) {
      const parts = [
        product.maker_name && `<strong>${product.maker_name}</strong>`,
        product.source_brand && `Brand: ${product.source_brand}`,
        product.source_collection && `Collection: ${product.source_collection}`,
        product.source_model_number && `Model: <strong class="mono">${product.source_model_number}</strong>`,
        product.product_type && `Type: ${product.product_type}`,
        product.last_purchase_rate != null && `Last Rate: <strong>₹${Number(product.last_purchase_rate).toLocaleString('en-IN')}/unit</strong>`
      ].filter(Boolean);
      descEl.innerHTML = parts.join(' &nbsp;·&nbsp; ');
    }
    if (badgeEl) {
      badgeEl.textContent = product.live_sku_count > 0 ? `${product.live_sku_count} Live SKU${product.live_sku_count !== 1 ? 's' : ''} · Restock Candidate` : 'New Colours Only';
      badgeEl.style.background = product.live_sku_count > 0 ? '#c8e6c9' : '#fff9c4';
      badgeEl.style.color      = product.live_sku_count > 0 ? '#1b5e20' : '#f57f17';
    }
    if (banner) banner.style.display = 'block';

    // Switch to "new product" mode so source fields (now populated) are visible and locked-ish
    setPurchaseItemMode(idx, 'new');

    const resultsEl = document.getElementById('purchase-global-search-results');
    if (resultsEl) resultsEl.style.display = 'none';

    // Make source fields read-only to show they came from search
    [brandEl, collEl, modelEl, makerNameEl].forEach((el) => {
      if (el) { el.readOnly = true; el.style.background = 'var(--bg)'; el.style.color = 'var(--text2)'; }
    });
    if (ptEl) { ptEl.disabled = true; ptEl.style.opacity = '0.75'; }
  };

  window.clearExistingProductSelection = function(idx) {
    const pmEl = document.getElementById(`item-selected-pm-${idx}`);
    if (pmEl) pmEl.value = '';

    const banner = document.getElementById(`item-selected-banner-${idx}`);
    if (banner) banner.style.display = 'none';

    // Re-enable source fields
    ['item-source-brand', 'item-source-coll', 'item-source-model', 'item-maker-name'].forEach((prefix) => {
      const el = document.getElementById(`${prefix}-${idx}`);
      if (el) { el.readOnly = false; el.style.background = ''; el.style.color = ''; el.value = ''; }
    });
    const ptEl = document.getElementById(`item-product-type-${idx}`);
    if (ptEl) { ptEl.disabled = false; ptEl.style.opacity = ''; ptEl.value = ''; }
    const makerEl = document.getElementById(`item-maker-${idx}`);
    if (makerEl) makerEl.value = '';

    setPurchaseItemMode(idx, 'new');

    const qEl = document.getElementById('purchase-global-search-q');
    if (qEl) qEl.value = '';
    const resultsEl = document.getElementById('purchase-global-search-results');
    if (resultsEl) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; }
  };

  // ── Supplier auto-code ────────────────────────────────────────────────────
  window.onBillSupplierChange = function(sel) {
    const supplierHint = document.getElementById('bill-supplier-hint');
    const s = (_allSuppliers || []).find((x) => String(supplierIdOf(x)) === String(sel.value));
    if (s) {
      if (supplierHint) {
        supplierHint.textContent = [s.city, s.state].filter(Boolean).join(', ') + (s.contact_phone ? ' · ' + s.contact_phone : '');
        supplierHint.style.display = 'block';
      }
    } else if (supplierHint) {
      supplierHint.style.display = 'none';
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────
  function fyDashSafe(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fyDashGreetingWord() {
    const hour = Number(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }));
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function fyDashGreetingDateLine() {
    return new Date().toLocaleDateString('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    }) + ' · Procurement overview';
  }

  function fyUpdateDashGreeting() {
    const greetEl = document.getElementById('fy-dash-greeting');
    const subEl = document.getElementById('fy-dash-greeting-sub');
    const nameEl = document.getElementById('foundry-user-name');
    const first = nameEl && nameEl.textContent
      ? String(nameEl.textContent).trim().split(/\s+/)[0]
      : 'there';
    if (greetEl) greetEl.textContent = fyDashGreetingWord() + ', ' + first;
    if (subEl) subEl.textContent = fyDashGreetingDateLine();
  }

  function fyCanFoundryPerm(key) {
    if (user.role === 'super_admin') return true;
    return !!(key && userPermissions.includes(key));
  }

  function fyInitDashQuickActions() {
    const wrap = document.getElementById('fy-dash-quick-actions');
    if (!wrap) return;
    const chips = [
      { label: '+ New Purchase', perm: 'foundry.purchases.create', primary: true, page: 'new-purchase', sel: '[onclick*=new-purchase]' },
      { label: 'Bill Verify', perm: 'foundry.bill_verification.view', page: 'bill-verify', sel: '[onclick*=bill-verify]' },
      { label: 'Goods Request', perm: 'foundry.transfers.view', page: 'transfer-requests', sel: '#nav-transfer-requests' },
      { label: 'Lab Orders', perm: 'foundry.lab.view', page: 'lab-orders', sel: '[onclick*=lab-orders]' }
    ];
    wrap.innerHTML = chips.filter((c) => fyCanFoundryPerm(c.perm)).map((c) => {
      const cls = c.primary ? 'fy-dash-quick-chip primary' : 'fy-dash-quick-chip';
      return `<button type="button" class="${cls}" data-fy-dash-nav="${fyDashSafe(c.page)}" data-fy-dash-sel="${fyDashSafe(c.sel)}">${fyDashSafe(c.label)}</button>`;
    }).join('');
    wrap.querySelectorAll('[data-fy-dash-nav]').forEach((btn) => {
      btn.addEventListener('click', function () {
        const page = btn.getAttribute('data-fy-dash-nav');
        const sel = btn.getAttribute('data-fy-dash-sel');
        const target = sel ? document.querySelector(sel) : null;
        nav(page, target);
      });
    });
  }

  function fyDashStageText(status) {
    const map = {
      DRAFT: 'Draft',
      PENDING_BILL_VERIFICATION: 'Pending bill',
      CHALLAN_VALUED: 'Valued by Finance',
      BILL_DISCREPANCY: 'Bill discrepancy',
      PENDING_BRANDING: 'Pending branding',
      BRANDING_DISPATCHED: 'Branding dispatched',
      PENDING_DIGITISATION: 'Pending digitisation',
      WAREHOUSE_READY: 'Warehouse ready'
    };
    return map[status] || status || '—';
  }

  function fyDashPurchaseLine(r) {
    const supplier = r.supplier_name || r.bill_ref || r.challan_number || 'Purchase';
    return '#' + r.header_id + ' · ' + supplier;
  }

  function fyDashOpenPurchase(headerId) {
    if (typeof window.openPurchaseView === 'function') window.openPurchaseView(headerId);
    else nav('purchases', document.querySelector('[onclick*=purchases]'));
  }

  function fyRenderDashRecentDesktop(rows) {
    const tb = document.getElementById('dash-recent-purchases');
    if (!tb) return;
    const recent = rows.slice(0, 6);
    if (!recent.length) {
      tb.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:18px;color:var(--text3)">No recent purchases.</td></tr>';
      return;
    }
    tb.innerHTML = recent.map((r) => `<tr class="tr-link" tabindex="0" role="button" onclick="openPurchaseView(${r.header_id})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPurchaseView(${r.header_id})}">
      <td class="mono xs">#${r.header_id}</td>
      <td>${fyDashSafe(r.supplier_name || '—')}</td>
      <td class="tc">${r.total_qty || 0}</td>
      <td class="mono xs">${inrD(r.expected_bill_amt)}</td>
      <td>${stageBadge(r.pipeline_status)}</td>
    </tr>`).join('');
  }

  function fyRenderDashRecentMobile(rows) {
    const el = document.getElementById('fy-dash-recent-mobile');
    if (!el) return;
    const recent = rows.slice(0, 5);
    if (!recent.length) {
      el.innerHTML = `<div class="fy-dash-empty"><div class="fy-dash-empty-head">No purchases yet</div><div class="fy-dash-empty-sub">Register your first purchase to get started.</div>${fyCanFoundryPerm('foundry.purchases.create') ? '<button type="button" class="btn primary sm" onclick="nav(\'new-purchase\',document.querySelector(\'[onclick*=new-purchase]\'))">+ New Purchase</button>' : ''}</div>`;
      return;
    }
    el.innerHTML = recent.map((r) => {
      const qty = Number(r.total_qty || 0);
      return `<button type="button" class="fy-dash-card tr-link" onclick="openPurchaseView(${r.header_id})" aria-label="Purchase ${r.header_id}">
        <div class="fy-dash-card__title">${fyDashSafe(fyDashPurchaseLine(r))}</div>
        <div class="fy-dash-card__row">
          <span class="fy-dash-card__meta">${qty} pcs · ${fyDashSafe(fyDashStageText(r.pipeline_status))}</span>
          <span class="fy-dash-card__chev" aria-hidden="true">›</span>
        </div>
      </button>`;
    }).join('');
  }

  function fyRenderDashLowStockDesktop(lowRows) {
    const lowStockTbody = document.getElementById('dash-low-stock');
    const lowStockCount = document.getElementById('dash-low-stock-count');
    if (!lowStockTbody || !lowStockCount) return;
    lowStockCount.className = lowRows.length ? 'b b-red' : 'b b-gray';
    lowStockCount.textContent = lowRows.length ? `${lowRows.length} SKUs` : 'No alerts';
    if (!lowRows.length) {
      lowStockTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:18px;color:var(--text3)">No low stock alerts.</td></tr>';
      return;
    }
    lowStockTbody.innerHTML = lowRows.map((r) => {
      const qty = Number(r.available_qty ?? r.warehouse_qty ?? r.qty ?? 0);
      const threshold = Number(r.threshold_qty ?? r.min_qty ?? 5);
      const qtyColor = qty <= 2 ? 'var(--red)' : 'var(--gold)';
      return `<tr>
        <td class="mono xs">${fyDashSafe(r.sku_code || r.sku || '—')}</td>
        <td>${fyDashSafe(r.product_name || r.display_name || r.model_name || '—')}</td>
        <td class="fw6" style="color:${qtyColor}">${qty}</td>
        <td class="td2">${threshold}</td>
      </tr>`;
    }).join('');
  }

  function fyRenderDashLowStockMobile(lowRows) {
    const el = document.getElementById('fy-dash-low-mobile');
    const badge = document.getElementById('fy-dash-low-stock-count-mobile');
    if (badge) {
      badge.className = lowRows.length ? 'b b-red' : 'b b-gray';
      badge.textContent = lowRows.length ? `${lowRows.length} SKUs` : 'No alerts';
    }
    if (!el) return;
    if (!lowRows.length) {
      el.innerHTML = '<div class="fy-dash-empty"><div class="fy-dash-empty-head">Stock levels look healthy</div><div class="fy-dash-empty-sub">No SKUs are below threshold right now.</div></div>';
      return;
    }
    el.innerHTML = lowRows.slice(0, 6).map((r) => {
      const qty = Number(r.available_qty ?? r.warehouse_qty ?? r.qty ?? 0);
      const threshold = Number(r.threshold_qty ?? r.min_qty ?? 5);
      const qtyCls = qty <= 2 ? 'is-low' : 'is-warn';
      return `<div class="fy-dash-card" style="cursor:default">
        <div class="fy-dash-card__title mono xs">${fyDashSafe(r.sku_code || r.sku || '—')} · ${fyDashSafe(r.product_name || r.display_name || r.model_name || '—')}</div>
        <div class="fy-dash-card__row">
          <span class="fy-dash-card__meta">Threshold ${threshold}</span>
          <span class="fy-dash-card__qty ${qtyCls}">Qty ${qty}</span>
        </div>
      </div>`;
    }).join('');
  }

  function fyRenderDashPipelineDesktop(activeRows) {
    const tb = document.getElementById('dash-pipeline');
    if (!tb) return;
    if (!activeRows.length) {
      tb.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:18px;color:var(--text3)">No active pipeline items.</td></tr>';
      return;
    }
    tb.innerHTML = activeRows.slice(0, 12).map((r) => `<tr class="tr-link" tabindex="0" role="button" onclick="openPurchaseView(${r.header_id})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPurchaseView(${r.header_id})}">
      <td class="mono xs">#${r.header_id}</td>
      <td>${fyDashSafe(r.supplier_name || '—')}</td>
      <td>${fyDashSafe(r.supplier_name || '—')}</td>
      <td class="tc">${r.total_qty || 0}</td>
      <td class="mono xs">${inrD(r.expected_bill_amt)}</td>
      <td>${stageBadge(r.pipeline_status)}</td>
      <td class="tc">${r.days_open != null ? r.days_open : '—'}</td>
      <td></td>
    </tr>`).join('');
  }

  function fyRenderDashPipelineMobile(activeRows) {
    const el = document.getElementById('fy-dash-pipeline-mobile');
    if (!el) return;
    if (!activeRows.length) {
      el.innerHTML = `<div class="fy-dash-empty"><div class="fy-dash-empty-head">No active pipeline items</div><div class="fy-dash-empty-sub">Completed purchases drop off this list automatically.</div><button type="button" class="btn sm" onclick="nav('purchases',document.querySelector('[onclick*=purchases]'))">View purchases</button></div>`;
      return;
    }
    el.innerHTML = activeRows.slice(0, 8).map((r) => {
      const days = r.days_open != null ? r.days_open : '—';
      return `<button type="button" class="fy-dash-card tr-link" onclick="openPurchaseView(${r.header_id})" aria-label="Pipeline purchase ${r.header_id}">
        <div class="fy-dash-card__row">
          <span class="fy-dash-card__title" style="margin:0">#${r.header_id} · ${fyDashSafe(r.supplier_name || 'Supplier')} · ${days} days</span>
          <span class="fy-dash-card__chev" aria-hidden="true">›</span>
        </div>
        <div class="fy-dash-card__badge">${stageBadge(r.pipeline_status)}</div>
      </button>`;
    }).join('');
  }

  async function loadDashboard() {
    fyUpdateDashGreeting();
    fyInitDashQuickActions();

    const lowStockTbody = document.getElementById('dash-low-stock');
    const recentTbody = document.getElementById('dash-recent-purchases');
    const pipelineTbody = document.getElementById('dash-pipeline');
    const lowStockCount = document.getElementById('dash-low-stock-count');
    const lowMobile = document.getElementById('fy-dash-low-mobile');
    const recentMobile = document.getElementById('fy-dash-recent-mobile');
    const pipelineMobile = document.getElementById('fy-dash-pipeline-mobile');

    if (window.cosmosSkeletonTable && lowStockTbody) window.cosmosSkeletonTable('dash-low-stock', 4, 4);
    else if (lowStockTbody) lowStockTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:18px;color:var(--text3)">Loading...</td></tr>';

    if (window.cosmosSkeletonTable && recentTbody) window.cosmosSkeletonTable('dash-recent-purchases', 5, 4);
    else if (recentTbody) recentTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:18px;color:var(--text3)">Loading...</td></tr>';

    if (window.cosmosSkeletonTable && pipelineTbody) window.cosmosSkeletonTable('dash-pipeline', 8, 4);
    else if (pipelineTbody) pipelineTbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:18px;color:var(--text3)">Loading...</td></tr>';

    if (window.cosmosSkeletonRows && recentMobile) window.cosmosSkeletonRows('fy-dash-recent-mobile', 3);
    if (window.cosmosSkeletonRows && lowMobile) window.cosmosSkeletonRows('fy-dash-low-mobile', 3);
    if (window.cosmosSkeletonRows && pipelineMobile) window.cosmosSkeletonRows('fy-dash-pipeline-mobile', 3);

    if (lowStockCount) {
      lowStockCount.className = 'b b-gray';
      lowStockCount.textContent = 'Loading…';
    }
    const lowStockCountMobile = document.getElementById('fy-dash-low-stock-count-mobile');
    if (lowStockCountMobile) {
      lowStockCountMobile.className = 'b b-gray';
      lowStockCountMobile.textContent = 'Loading…';
    }

    try {
      await refreshWarehouseContext();
      const [data, availableStock, purchases] = await Promise.all([
        apiGet('/api/purchases/dashboard-stats'),
        apiGet('/api/stock-transfers/available').catch(() => []),
        apiGet('/api/purchases').catch(() => [])
      ]);
      const p = data.purchases || {};
      const purchaseRows = Array.isArray(purchases) ? purchases : [];
      const setV = (id, v, asCurrency) => {
        const el = document.getElementById(id);
        if (!el) return;
        const num = Number(v != null ? v : 0);
        if (window.cosmosCountUp && Number.isFinite(num)) {
          if (asCurrency) el.dataset.format = 'currency';
          else delete el.dataset.format;
          window.cosmosCountUp(el, num, 600);
          return;
        }
        el.textContent = num;
      };
      const activePurchases = Number(p.active_purchases || 0);
      const donePurchases = Number(p.warehouse_ready || 0);
      const pendingBill = purchaseRows.filter((r) => r.pipeline_status === 'PENDING_BILL_VERIFICATION').length;
      setV('dash-active-purchases', activePurchases);
      const activeMeta = document.getElementById('dash-pending-bill');
      if (activeMeta) {
        activeMeta.textContent = pendingBill
          ? `${pendingBill} pending bill · ${donePurchases} done`
          : `${activePurchases} to process · ${donePurchases} done`;
      }
      setV('dash-skus', (data.skus || {}).total_skus);
      setV('dash-warehouse', (data.stock || {}).warehouse_stock);
      setV('dash-suppliers', (data.suppliers || {}).active_suppliers);

      const rows = Array.isArray(availableStock) ? availableStock : [];
      const lowRows = rows
        .filter((r) => Number(r.available_qty ?? r.warehouse_qty ?? r.qty ?? 0) <= 5)
        .sort((a, b) => Number(a.available_qty ?? a.warehouse_qty ?? a.qty ?? 0) - Number(b.available_qty ?? b.warehouse_qty ?? b.qty ?? 0))
        .slice(0, 8);

      fyRenderDashLowStockDesktop(lowRows);
      fyRenderDashLowStockMobile(lowRows);

      const sortedPurchases = purchaseRows.slice().sort((a, b) => Number(b.header_id || 0) - Number(a.header_id || 0));
      fyRenderDashRecentDesktop(sortedPurchases);
      fyRenderDashRecentMobile(sortedPurchases);

      const activePipeline = sortedPurchases.filter((r) => r.pipeline_status && r.pipeline_status !== 'WAREHOUSE_READY');
      fyRenderDashPipelineDesktop(activePipeline);
      fyRenderDashPipelineMobile(activePipeline);
    } catch (err) {
      console.error('loadDashboard:', err);
      if (window.cosmosToastError) window.cosmosToastError(err.message || 'Could not load dashboard.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NEW PURCHASE FORM (multi-item)
  // ─────────────────────────────────────────────────────────────────────────
  function setNewPurchaseDraftBanner(headerId) {
    const el = document.getElementById('new-purchase-draft-banner');
    if (!el) return;
    if (headerId) {
      el.style.display = 'block';
      el.innerHTML = `<div style="font-size:14px;font-weight:600;color:var(--text1);margin-bottom:4px">Editing draft purchase <span class="mono">#${headerId}</span></div>
        <div style="font-size:13px;color:var(--text2)">Save as Draft to keep changes, or use Save All Items → Bill Verification when you are ready to verify the supplier invoice.</div>`;
    } else {
      el.style.display = 'none';
      el.innerHTML = '';
    }
  }

  function unlockPurchaseLineFieldsForEdit(idx) {
    ['item-source-brand', 'item-source-coll', 'item-source-model', 'item-maker-name'].forEach((prefix) => {
      const field = document.getElementById(`${prefix}-${idx}`);
      if (field) { field.readOnly = false; field.style.background = ''; field.style.color = ''; }
    });
    const ptEl = document.getElementById(`item-product-type-${idx}`);
    if (ptEl) { ptEl.disabled = false; ptEl.style.opacity = ''; }
  }

  function initNewPurchaseForm() {
    window._editingDraftHeaderId = null;
    setNewPurchaseDraftBanner(null);
    _itemCount = 0;
    const container = document.getElementById('purchase-items-container');
    if (container) container.innerHTML = '';
    resetCollectionDefaultsCard();
    const today = istToday();
    // Set today as default in flatpickr if not already set
    const fpEl = document.getElementById('bill-purchase-date-input');
    if (fpEl && !fpEl.value && fpEl._flatpickr) fpEl._flatpickr.setDate(new Date(), true);
    addPurchaseItem();
    window._purchaseLineModes = { 1: 'new' };
    if (typeof window.setPurchaseActiveItem === 'function') window.setPurchaseActiveItem(1);
    if (typeof window.setPurchaseItemMode === 'function') window.setPurchaseItemMode(1, 'new');
    if (typeof window.refreshApplyCollMinimalUi === 'function') window.refreshApplyCollMinimalUi();
  }

  window.refreshApplyCollMinimalUi = function() {
    const page = document.getElementById('page-new-purchase');
    const cb = document.getElementById('coll-default-apply-new');
    const on = !!(cb && cb.checked);
    if (page) page.classList.toggle('apply-coll-minimal-ui', on);
  };

  window.addPurchaseItem = function(opts) {
    const skipDefaultsApply = opts && opts.skipDefaultsApply;
    _itemCount++;
    const idx = _itemCount;
    const container = document.getElementById('purchase-items-container');
    if (!container) return;

    const card = document.createElement('div');
    card.className = 'card mb4 purchase-item-card';
    card.id = `item-card-${idx}`;
    card.dataset.idx = idx;
    let ptOpts = '<option value="">— Select Product Type —</option>';
    (_lookups.product_type || []).forEach((pt) => {
      ptOpts += `<option value="${pt.key}">${pt.label}</option>`;
    });
    card.innerHTML = `
      <div class="ch">
        <div class="ct">Item #${idx}</div>
        ${_itemCount > 1 ? `<button type="button" class="btn sm" style="margin-left:auto;color:var(--red)" onclick="event.stopPropagation();removePurchaseItem(${idx})">✕ Remove</button>` : ''}
      </div>
      <div class="cb">
        <input type="hidden" id="item-selected-pm-${idx}">

        <div id="item-selected-banner-${idx}" style="display:none;background:#e8f5e9;border:1px solid #66bb6a;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12.5px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <span style="font-weight:700;color:#2e7d32">✓ Existing Product Selected</span>
              <span style="margin-left:8px;background:#c8e6c9;color:#1b5e20;padding:1px 7px;border-radius:10px;font-size:11px;font-weight:600" id="item-selected-badge-${idx}">Restock Candidate</span>
              <div id="item-selected-desc-${idx}" style="margin-top:5px;color:var(--text2);line-height:1.5"></div>
            </div>
            <button type="button" class="btn xs" style="color:var(--red);flex-shrink:0;margin-left:12px" onclick="event.stopPropagation();clearExistingProductSelection(${idx})">✕ Clear</button>
          </div>
        </div>

        <div id="item-purchase-edit-surface-${idx}">
          <div id="item-source-fields-${idx}">
            <div class="item-line-collection-dup">
              <div class="fg3 mb3">
                <div class="fgrp">
                  <label>Product Type <span class="req">*</span></label>
                  <select id="item-product-type-${idx}">${ptOpts}</select>
                </div>
                <div class="fgrp">
                  <label>Manufacturer <span class="req">*</span></label>
                  <input id="item-maker-name-${idx}" list="item-maker-list-${idx}" placeholder="e.g. Gandhi" oninput="onMakerInputChange(${idx})">
                  <datalist id="item-maker-list-${idx}">
                    ${(_allMakers || []).map((m) => `<option value="${String(m.maker_name || '').replace(/"/g, '&quot;')}"></option>`).join('')}
                  </datalist>
                  <input type="hidden" id="item-maker-${idx}">
                </div>
                <div class="fgrp">
                  <label>Source Brand <span class="req">*</span></label>
                  <input id="item-source-brand-${idx}" list="item-source-brand-list-${idx}" placeholder="e.g. IKON" onfocus="onSourceBrandInputChange(${idx})" oninput="onSourceBrandInputChange(${idx})">
                  <datalist id="item-source-brand-list-${idx}"></datalist>
                </div>
                <div class="fgrp">
                  <label>Source Collection</label>
                  <input id="item-source-coll-${idx}" list="item-source-coll-list-${idx}" placeholder="Optional — filtered by brand" onfocus="onSourceCollectionInputChange(${idx})" oninput="onSourceCollectionInputChange(${idx})">
                  <datalist id="item-source-coll-list-${idx}"></datalist>
                </div>
              </div>
            </div>

            <div id="item-repeat-banner-${idx}" style="display:none;background:var(--goldL);border:1px solid var(--gold);border-radius:8px;padding:8px 12px;font-size:12.5px;margin-bottom:12px">
              🔁 This product exists. Details will be pre-filled.
            </div>
          </div>

          <div class="mb3" style="border-top:1px solid var(--border);padding-top:12px">
            <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
              <input type="checkbox" id="item-branding-${idx}" style="width:16px;height:16px;cursor:pointer;accent-color:var(--acc2)">
              <label for="item-branding-${idx}" style="font-size:13px;font-weight:600;cursor:pointer">Branding Required</label>
            </div>
          </div>

          <div class="purchase-item-quick-row">
            <div class="fgrp">
              <label>Source Model Number <span class="req">*</span></label>
              <input id="item-source-model-${idx}" list="item-source-model-list-${idx}" placeholder="e.g. VR-01" onfocus="onSourceModelInputChange(${idx})" oninput="onSourceModelInputChange(${idx})">
              <datalist id="item-source-model-list-${idx}"></datalist>
            </div>
            <div class="fgrp">
              <label>Quantity <span class="req">*</span></label>
              <input type="number" id="item-qty-${idx}" placeholder="Total units" oninput="validateColourQty(${idx})">
            </div>
          </div>
        </div>

        <div class="purchase-colour-section">
          <div class="section-lbl mb2" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <span>Colour Variants</span>
            <button type="button" class="btn xs" onclick="event.stopPropagation();addColourToItem(${idx})">+ Add colour</button>
          </div>
          <div id="colours-container-${idx}"></div>
          <div id="colour-qty-warn-${idx}" style="display:none;color:var(--red);font-size:12px;margin:4px 0 8px"></div>
        </div>
      </div>`;
    container.appendChild(card);
    card.addEventListener('click', (ev) => {
      if (ev.target.closest('button, input, select, textarea, label, a, option')) return;
      if (typeof window.setPurchaseActiveItem === 'function') window.setPurchaseActiveItem(idx);
    });
    if (!window._purchaseLineModes) window._purchaseLineModes = {};
    window._purchaseLineModes[idx] = 'new';
    if (typeof window.setPurchaseActiveItem === 'function') window.setPurchaseActiveItem(idx);

    if (!skipDefaultsApply && document.getElementById('coll-default-apply-new')?.checked) {
      void (async () => {
        try {
          await applyPurchaseCollectionDefaultsToItem(idx);
        } catch (e) {
          console.error('applyPurchaseCollectionDefaultsToItem', e);
        }
      })();
    }

    const hint = document.getElementById('items-count-hint');
    if (hint) hint.textContent = _itemCount === 1 ? '1 item' : `${_itemCount} items`;
  };

  window.removePurchaseItem = function(idx) {
    const wasActive = window.getPurchaseActiveIdx() === idx;
    const card = document.getElementById(`item-card-${idx}`);
    if (card) card.remove();
    if (window._purchaseLineModes) delete window._purchaseLineModes[idx];
    recalcGrandTotal();
    const remaining = document.querySelectorAll('.purchase-item-card');
    const hint = document.getElementById('items-count-hint');
    if (hint) hint.textContent = remaining.length === 1 ? '1 item' : `${remaining.length} items`;
    if (!remaining.length) return;
    if (wasActive || !document.getElementById(`item-card-${window._purchaseActiveItemIdx}`)) {
      const last = remaining[remaining.length - 1];
      const ni = parseInt(last.dataset.idx, 10);
      if (typeof window.setPurchaseActiveItem === 'function') window.setPurchaseActiveItem(ni);
    }
  };

  window.duplicatePurchaseItem = async function() {
    const cards = document.querySelectorAll('.purchase-item-card');
    if (!cards.length) { alert('Add an item first before duplicating.'); return; }
    // Source is the last card
    const srcCard = cards[cards.length - 1];
    const srcIdx  = parseInt(srcCard.dataset.idx, 10);

    // Snapshot source values before adding a new card (DOM won't change for srcIdx)
    const snapshot = {};
    ['source-brand', 'source-coll', 'source-model', 'rate', 'qty', 'gst'].forEach((f) => {
      const el = document.getElementById(`item-${f}-${srcIdx}`);
      snapshot[f] = el ? el.value : '';
    });
    const srcMakerNameVal = document.getElementById(`item-maker-name-${srcIdx}`)?.value || '';
    const srcPtVal        = document.getElementById(`item-product-type-${srcIdx}`)?.value || '';
    const srcBrandingVal  = document.getElementById(`item-branding-${srcIdx}`)?.checked || false;

    // Add a new blank item card (do not apply collection-defaults strip — would overwrite copy)
    window.addPurchaseItem({ skipDefaultsApply: true });
    const newIdx = _itemCount;

    // Set maker FIRST and await so onMakerInputChange can set the hidden ID.
    // onMakerInputChange clears source-brand/coll/model when the maker changes,
    // so we must restore those values only after it resolves.
    const dstMakerName = document.getElementById(`item-maker-name-${newIdx}`);
    if (dstMakerName) {
      dstMakerName.value = srcMakerNameVal;
      await window.onMakerInputChange(newIdx);
    }

    // Now restore source fields (safe — onMakerInputChange has already run)
    ['source-brand', 'source-coll', 'source-model', 'rate', 'qty', 'gst'].forEach((f) => {
      const dstEl = document.getElementById(`item-${f}-${newIdx}`);
      if (dstEl) dstEl.value = snapshot[f];
    });

    // Reload dependent datalists without clearing values
    window.onSourceBrandInputChange(newIdx);
    window.onSourceCollectionInputChange(newIdx);
    window.onSourceModelInputChange(newIdx);

    const dstPt = document.getElementById(`item-product-type-${newIdx}`);
    if (dstPt) dstPt.value = srcPtVal;

    // Copy branding checkbox
    const dstBranding = document.getElementById(`item-branding-${newIdx}`);
    if (dstBranding) dstBranding.checked = srcBrandingVal;

    // Copy colour rows — remove the auto-added blank colour first
    const dstColourContainer = document.getElementById(`colours-container-${newIdx}`);
    if (dstColourContainer) dstColourContainer.innerHTML = '';
    if (_colourCounters) _colourCounters[newIdx] = 0;

    // Collect source colour rows and replicate
    const srcRows = document.querySelectorAll(`[id^="colour-row-${srcIdx}-"]`);
    srcRows.forEach((row) => {
      const parts = row.id.split('-'); // colour-row-{srcIdx}-{cidx}
      const srcCidx = parseInt(parts[parts.length - 1], 10);
      const srcName = document.getElementById(`clr-name-${srcIdx}-${srcCidx}`)?.value || '';
      const srcCode = document.getElementById(`clr-code-${srcIdx}-${srcCidx}`)?.value || '';
      const srcQty  = document.getElementById(`clr-qty-${srcIdx}-${srcCidx}`)?.value || '';
      window.addColourToItem(newIdx);
      const newCidx = _colourCounters[newIdx];
      const dstName = document.getElementById(`clr-name-${newIdx}-${newCidx}`);
      const dstCode = document.getElementById(`clr-code-${newIdx}-${newCidx}`);
      const dstQty  = document.getElementById(`clr-qty-${newIdx}-${newCidx}`);
      if (dstName) dstName.value = srcName;
      if (dstCode) dstCode.value = srcCode;
      if (dstQty)  dstQty.value  = srcQty;
    });

    // Recalculate totals for the new card
    calcItemBill(newIdx);
    validateColourQty(newIdx);
    // On mobile Chrome, auto-scrolling via scrollIntoView can trigger sticky-header bugs.
    // Skip scrolling on mobile; on desktop we can still bring it into view.
    const newCard = document.getElementById(`item-card-${newIdx}`);
    if (newCard) {
      const isMobile = !!(window.matchMedia && window.matchMedia('(max-width: 768px)').matches)
      if (!isMobile) {
        const ua = navigator.userAgent || ''
        const isChromeLike = (/Chrome\//i.test(ua) || /CriOS\//i.test(ua)) && !(/Edg\//i.test(ua) || /OPR\//i.test(ua))
        // Bring the new card into view on desktop.
        newCard.scrollIntoView({ behavior: isChromeLike ? 'auto' : 'smooth', block: 'start' })
      }
    }
  };

  /** Same manufacturer / brand / collection / rate / GST / branding as last item; clear model & qty & colours. */
  window.duplicatePurchaseItemSameCollection = async function() {
    const cards = document.querySelectorAll('.purchase-item-card');
    if (!cards.length) {
      alert('Add an item first before adding the next model.');
      return;
    }
    const srcCard = cards[cards.length - 1];
    const srcIdx = parseInt(srcCard.dataset.idx, 10);

    const snapshot = {};
    ['source-brand', 'source-coll', 'rate', 'gst'].forEach((f) => {
      const el = document.getElementById(`item-${f}-${srcIdx}`);
      snapshot[f] = el ? el.value : '';
    });
    const srcMakerNameVal = document.getElementById(`item-maker-name-${srcIdx}`)?.value || '';
    const srcPtVal = document.getElementById(`item-product-type-${srcIdx}`)?.value || '';
    const srcBrandingVal = document.getElementById(`item-branding-${srcIdx}`)?.checked || false;

    window.addPurchaseItem({ skipDefaultsApply: true });
    const newIdx = _itemCount;

    const dstMakerName = document.getElementById(`item-maker-name-${newIdx}`);
    if (dstMakerName) {
      dstMakerName.value = srcMakerNameVal;
      await window.onMakerInputChange(newIdx);
    }

    const dstBrand = document.getElementById(`item-source-brand-${newIdx}`);
    const dstColl = document.getElementById(`item-source-coll-${newIdx}`);
    if (dstBrand) dstBrand.value = snapshot['source-brand'] || '';
    if (dstColl) dstColl.value = snapshot['source-coll'] || '';

    const dstRate = document.getElementById(`item-rate-${newIdx}`);
    if (dstRate) dstRate.value = snapshot['rate'] || '';
    const dstGst = document.getElementById(`item-gst-${newIdx}`);
    if (dstGst) dstGst.value = snapshot['gst'] || '';

    await window.onSourceBrandInputChange(newIdx);
    await window.onSourceCollectionInputChange(newIdx);

    const dstPt = document.getElementById(`item-product-type-${newIdx}`);
    if (dstPt) dstPt.value = srcPtVal;

    const dstBranding = document.getElementById(`item-branding-${newIdx}`);
    if (dstBranding) dstBranding.checked = srcBrandingVal;

    calcItemBill(newIdx);
    validateColourQty(newIdx);

    const modelEl = document.getElementById(`item-source-model-${newIdx}`);
    if (modelEl) modelEl.focus();

    const newCard = document.getElementById(`item-card-${newIdx}`);
    if (newCard) {
      const isMobile = !!(window.matchMedia && window.matchMedia('(max-width: 768px)').matches)
      if (!isMobile) {
        const ua = navigator.userAgent || ''
        const isChromeLike = (/Chrome\//i.test(ua) || /CriOS\//i.test(ua)) && !(/Edg\//i.test(ua) || /OPR\//i.test(ua))
        newCard.scrollIntoView({ behavior: isChromeLike ? 'auto' : 'smooth', block: 'start' })
      }
    }
  };

  let _colourCounters = {};
  window.addColourToItem = function(idx) {
    if (!_colourCounters[idx]) _colourCounters[idx] = 0;
    _colourCounters[idx]++;
    const cidx = _colourCounters[idx];
    const container = document.getElementById(`colours-container-${idx}`);
    if (!container) return;
    const row = document.createElement('div');
    row.id = `colour-row-${idx}-${cidx}`;
    row.className = 'flex ic g2 mb2';
    row.innerHTML = `
      <input placeholder="Colour name" id="clr-name-${idx}-${cidx}" style="flex:2" oninput="validateColourQty(${idx})">
      <input placeholder="Code" id="clr-code-${idx}-${cidx}" style="flex:1" class="mono">
      <input type="number" placeholder="Qty" id="clr-qty-${idx}-${cidx}" style="width:80px" oninput="validateColourQty(${idx})">
      <button type="button" class="btn xs" style="color:var(--red)" onclick="document.getElementById('colour-row-${idx}-${cidx}').remove();validateColourQty(${idx})">✕</button>`;
    container.appendChild(row);
  };

  window.validateColourQty = function(idx) {
    const totalQty = Number(val(`item-qty-${idx}`)) || 0;
    const qtyInputs  = document.querySelectorAll(`[id^="clr-qty-${idx}-"]`);
    const nameInputs = document.querySelectorAll(`[id^="clr-name-${idx}-"]`);
    const warn = document.getElementById(`colour-qty-warn-${idx}`);
    if (!warn) return true;

    let sum = 0;
    let hasAnyColourData = false;
    qtyInputs.forEach((r) => { sum += Number(r.value) || 0; });
    nameInputs.forEach((n) => { if (n.value.trim()) hasAnyColourData = true; });
    qtyInputs.forEach((r)  => { if (Number(r.value) > 0) hasAnyColourData = true; });

    if (!hasAnyColourData) {
      warn.style.display = 'none';
      return true;
    }
    if (sum !== totalQty) {
      warn.textContent = `Colour qty total (${sum}) must equal item qty (${totalQty})`;
      warn.style.display = 'block';
      return false;
    }
    warn.style.display = 'none';
    return true;
  };

  window.calcItemBill = function(idx) {
    const rate = parseFloat(val(`item-rate-${idx}`)) || 0;
    const qty  = parseInt(val(`item-qty-${idx}`))  || 0;
    const gst  = (parseFloat(val(`item-gst-${idx}`)) || 0) / 100;  // user enters 12, calc uses 0.12
    const base = rate * qty;
    const gstAmt = base * gst;
    const total = base + gstAmt;
    const setT = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = inrD(v); };
    setT(`item-base-${idx}`, base);
    setT(`item-gst-amt-${idx}`, gstAmt);
    setT(`item-total-${idx}`, total);
    recalcGrandTotal();
  };

  window.recalcGrandTotal = function() {
    let subTotal = 0, gstTotal = 0;
    document.querySelectorAll('.purchase-item-card').forEach((card) => {
      const i = card.dataset.idx;
      const rate = parseFloat(val(`item-rate-${i}`)) || 0;
      const qty  = parseInt(val(`item-qty-${i}`))   || 0;
      const gst  = (parseFloat(val(`item-gst-${i}`)) || 0) / 100;  // user enters %, divide to get fraction
      const base = rate * qty;
      subTotal += base;
      gstTotal += base * gst;
    });
    const transport = parseFloat(val('bill-transport-input')) || 0;
    const grand = subTotal + gstTotal + transport;
    const setT = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = inrD(v); };
    setT('grand-subtotal', subTotal);
    setT('grand-gst', gstTotal);
    setT('grand-transport', transport);
    setT('grand-total', grand);
  };

  async function loadDraftPurchaseIntoForm(headerId) {
    showErr('new-purchase-error', '');
    const id = Number(headerId);
    if (!id) return;
    try {
      const data = await apiGet(`/api/purchases/${id}`);
      const h = data.header;
      const items = data.items || [];
      if (!h || h.pipeline_status !== 'DRAFT') {
        const msg = h && h.pipeline_status ? 'This purchase is not a draft anymore.' : 'Purchase not found.';
        if (typeof cosmosToastError === 'function') cosmosToastError(msg);
        showErr('new-purchase-error', msg);
        initNewPurchaseForm();
        return;
      }

      const container = document.getElementById('purchase-items-container');
      if (container) container.innerHTML = '';
      _itemCount = 0;
      _colourCounters = {};

      const sup = document.getElementById('bill-supplier-select');
      if (sup) sup.value = String(h.supplier_id || '');
      const billRefEl = document.getElementById('bill-ref-input');
      if (billRefEl) billRefEl.value = h.challan_number || h.bill_ref || '';
      const challanDateEl = document.getElementById('challan-date-input');
      if (challanDateEl && h.challan_date) {
        if (challanDateEl._flatpickr) challanDateEl._flatpickr.setDate(new Date(h.challan_date), true);
        else challanDateEl.value = h.challan_date;
      }
      const transportEl = document.getElementById('bill-transport-input');
      if (transportEl) transportEl.value = h.transport_cost != null ? String(h.transport_cost) : '0';
      const poEl = document.getElementById('bill-po-ref-input');
      if (poEl) poEl.value = h.po_reference || '';
      const notesEl = document.getElementById('bill-notes-input');
      if (notesEl) notesEl.value = h.notes || '';

      const pdEl = document.getElementById('bill-purchase-date-input');
      if (pdEl && h.purchase_date) {
        const d = new Date(h.purchase_date);
        if (pdEl._flatpickr) pdEl._flatpickr.setDate(d, true);
        else pdEl.value = new Date(h.purchase_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      }

      window._purchaseLineModes = {};
      items.forEach(() => {
        addPurchaseItem({ skipDefaultsApply: true });
      });

      const cards = document.querySelectorAll('.purchase-item-card');
      items.forEach((it, ord) => {
        const card = cards[ord];
        if (!card) return;
        const idx = parseInt(card.dataset.idx, 10);
        const pmEl = document.getElementById(`item-selected-pm-${idx}`);
        if (pmEl) pmEl.value = String(it.product_master_id || '');
        const makerNameEl = document.getElementById(`item-maker-name-${idx}`);
        const makerEl = document.getElementById(`item-maker-${idx}`);
        if (it.maker_name && makerNameEl) makerNameEl.value = it.maker_name;
        if (it.maker_master_id != null && makerEl) makerEl.value = String(it.maker_master_id);
        const brandEl = document.getElementById(`item-source-brand-${idx}`);
        if (brandEl) brandEl.value = it.source_brand || '';
        const collEl = document.getElementById(`item-source-coll-${idx}`);
        if (collEl) collEl.value = it.source_collection || '';
        const modelEl = document.getElementById(`item-source-model-${idx}`);
        const modelVal = it.style_model || it.source_model_number || '';
        if (modelEl) modelEl.value = modelVal;
        const ptEl = document.getElementById(`item-product-type-${idx}`);
        if (ptEl && it.category) ptEl.value = it.category;
        const rateEl = document.getElementById(`item-rate-${idx}`);
        if (rateEl) rateEl.value = it.purchase_rate != null ? String(it.purchase_rate) : '';
        const qtyEl = document.getElementById(`item-qty-${idx}`);
        if (qtyEl) qtyEl.value = it.quantity != null ? String(it.quantity) : '';
        const gstEl = document.getElementById(`item-gst-${idx}`);
        const gFrac = Number(it.gst_pct) || 0;
        if (gstEl) gstEl.value = String(Math.round(gFrac * 10000) / 100);
        const br = document.getElementById(`item-branding-${idx}`);
        if (br) br.checked = !!it.branding_required;

        const colCont = document.getElementById(`colours-container-${idx}`);
        if (colCont) colCont.innerHTML = '';
        const cols = it.colours || [];
        const isStdOnly = cols.length === 1
          && String(cols[0].colour_name || '').toLowerCase() === 'standard'
          && String(cols[0].colour_code || '').toUpperCase() === 'STD';
        if (cols.length && !isStdOnly) {
          cols.forEach((c) => {
            addColourToItem(idx);
            const cidx = _colourCounters[idx];
            const nEl = document.getElementById(`clr-name-${idx}-${cidx}`);
            const codeEl = document.getElementById(`clr-code-${idx}-${cidx}`);
            const qEl = document.getElementById(`clr-qty-${idx}-${cidx}`);
            if (nEl) nEl.value = c.colour_name || '';
            if (codeEl) codeEl.value = c.colour_code || '';
            if (qEl) qEl.value = c.quantity != null ? String(c.quantity) : '';
          });
        }

        const banner = document.getElementById(`item-selected-banner-${idx}`);
        if (banner) banner.style.display = 'none';
        unlockPurchaseLineFieldsForEdit(idx);
        window._purchaseLineModes[idx] = 'new';
        calcItemBill(idx);
        validateColourQty(idx);
      });

      window._editingDraftHeaderId = id;
      setNewPurchaseDraftBanner(id);
      if (typeof window.setPurchaseActiveItem === 'function') window.setPurchaseActiveItem(1);
      recalcGrandTotal();
      const hint = document.getElementById('items-count-hint');
      if (hint) hint.textContent = items.length === 1 ? '1 item' : `${items.length} items`;
      if (typeof cosmosToastInfo === 'function') {
        cosmosToastInfo('Draft loaded — edit lines and save.');
      }
    } catch (e) {
      const m = e && e.message ? e.message : String(e);
      if (typeof cosmosToastError === 'function') cosmosToastError(m);
      showErr('new-purchase-error', m);
      initNewPurchaseForm();
    }
  }

  window.resumeDraftPurchaseForEdit = function(headerId) {
    const hid = Number(headerId);
    if (!hid) return;
    window._resumeDraftHeaderId = hid;
    const navBtn = document.querySelector('.nav-item[onclick*="new-purchase"]');
    nav('new-purchase', navBtn || undefined);
  };

  // ── Save Purchase (submit to bill verification or save as draft) ─────────
  async function savePurchaseInternal(asDraft) {
    showErr('new-purchase-error', '');
    const supplierId = val('bill-supplier-select');
    const challanNum = val('bill-ref-input');
    const challanDate = (typeof getFpIso === 'function' ? getFpIso('challan-date-input') : null) || val('challan-date-input');
    const purchDate  = (typeof getFpIso === 'function' ? getFpIso('bill-purchase-date-input') : null) || val('bill-purchase-date-input');
    const poRef      = val('bill-po-ref-input');
    const notes      = val('bill-notes-input');

    if (!supplierId)  return showErr('new-purchase-error', 'Please select a Supplier.');
    if (!purchDate)   return showErr('new-purchase-error', 'Please enter a Purchase date.');
    if (!asDraft) {
      if (!challanNum || !String(challanNum).trim()) return showErr('new-purchase-error', 'Enter Challan No. before submitting.');
      if (!challanDate) return showErr('new-purchase-error', 'Enter Challan date before submitting.');
    }

    const itemCards = document.querySelectorAll('.purchase-item-card');
    if (!itemCards.length) return showErr('new-purchase-error', 'Add at least one item.');

    const itemsPayload = [];
    for (const card of itemCards) {
      const i = card.dataset.idx;
      const sourceBrand = val(`item-source-brand-${i}`);
      const sourceColl = val(`item-source-coll-${i}`) || null;
      const sourceModel = val(`item-source-model-${i}`);
      const qty        = parseInt(val(`item-qty-${i}`), 10);
      const makerMasterId = val(`item-maker-${i}`) || null;
      const category = val(`item-product-type-${i}`);
      const brandingRequired = document.getElementById(`item-branding-${i}`)?.checked ?? false;

      if (!makerMasterId) {
        return showErr('new-purchase-error', `Item #${i}: Select Manufacturer from the list (type name and pick a match).`);
      }
      if (!sourceBrand) return showErr('new-purchase-error', `Item #${i}: Enter Source Brand.`);
      if (!sourceModel) return showErr('new-purchase-error', `Item #${i}: Enter Source Model Number.`);
      if (!category) return showErr('new-purchase-error', `Item #${i}: Select Product Type.`);
      if (!qty  || qty  <= 0)  return showErr('new-purchase-error', `Item #${i}: Enter a valid Quantity.`);
      if (!validateColourQty(i)) return showErr('new-purchase-error', `Item #${i}: Colour quantities must match item total.`);

      const colours = [];
      const colourRows = card.querySelectorAll(`[id^="clr-qty-${i}-"]`);
      colourRows.forEach((cqEl) => {
        const cidx = cqEl.id.split('-').pop();
        const cName = val(`clr-name-${i}-${cidx}`);
        const cCode = val(`clr-code-${i}-${cidx}`);
        const cQty  = parseInt(cqEl.value) || 0;
        if (cName && cQty > 0) colours.push({ colour_name: cName, colour_code: cCode || cName.replace(/\s+/g,'').toUpperCase().slice(0,8), quantity: cQty });
      });
      if (colours.length === 0) {
        colours.push({ colour_name: 'Standard', colour_code: 'STD', quantity: qty });
      }
      let productMasterId = val(`item-selected-pm-${i}`) || null;

      if (!productMasterId) {
        try {
          const chk = await apiGet(
            `/api/products/check-repeat?source_brand=${encodeURIComponent(sourceBrand)}&source_model_number=${encodeURIComponent(sourceModel)}&maker_master_id=${encodeURIComponent(makerMasterId)}`
          );
          productMasterId = chk && (chk.product_master_id || (chk.data && chk.data.product_id));
        } catch (_) { productMasterId = null; }
      }

      if (!productMasterId) {
        const ewCollection = sourceColl || sourceBrand;
        try {
          const pm = await apiPost('/api/products', {
            source_brand: sourceBrand,
            source_collection: sourceColl,
            source_model_number: sourceModel,
            ew_collection: ewCollection,
            style_model: sourceModel,
            product_type: category,
            branding_required: brandingRequired,
            maker_master_id: Number(makerMasterId)
          });
          productMasterId = pm && pm.product_id;
        } catch (err) { return showErr('new-purchase-error', `Item #${i}: Could not save product — ${err.message}`); }
      }

      if (!productMasterId) return showErr('new-purchase-error', `Item #${i}: Failed to resolve product master.`);

      itemsPayload.push({
        product_master_id: productMasterId,
        maker_master_id:   Number(makerMasterId),
        category,
        quantity:          qty,
        colours
      });
    }

    const editingDraftId = window._editingDraftHeaderId ? Number(window._editingDraftHeaderId) : 0;

    const btnSubmit = document.getElementById('save-purchase-btn');
    const btnDraft  = document.getElementById('save-purchase-draft-btn');
    const activeBtn = asDraft ? btnDraft : btnSubmit;
    if (activeBtn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(activeBtn);
    else if (activeBtn) { activeBtn.disabled = true; }

    try {
      const payload = {
        supplier_id: Number(supplierId),
        source_type: null,
        challan_number: challanNum || null,
        challan_date: challanDate || null,
        purchase_date: purchDate,
        po_reference: poRef || null,
        notes: notes || null,
        items: itemsPayload,
        save_as_draft: !!asDraft
      };

      let result;
      if (editingDraftId) {
        result = await apiPut(`/api/purchases/${editingDraftId}/draft`, payload);
      } else {
        result = await apiPost('/api/purchases', payload);
      }

      const headerId = (result.header && result.header.header_id) || editingDraftId;
      window._currentHeaderId = headerId;
      window._editingDraftHeaderId = null;
      setNewPurchaseDraftBanner(null);
      document.getElementById('purchase-items-container').innerHTML = '';
      _itemCount = 0;
      _colourCounters = {};
      document.getElementById('bill-supplier-select').value   = '';
      document.getElementById('bill-ref-input').value = '';
      const cdEl = document.getElementById('challan-date-input');
      if (cdEl && cdEl._flatpickr) cdEl._flatpickr.clear(); else if (cdEl) cdEl.value = '';
      const pdEl = document.getElementById('bill-purchase-date-input');
      if (pdEl && pdEl._flatpickr) pdEl._flatpickr.clear(); else if (pdEl) pdEl.value = '';

      if (asDraft) {
        if (typeof cosmosToastSuccess === 'function') {
          cosmosToastSuccess(editingDraftId ? 'Draft updated.' : 'Purchase saved as draft. Submit challan from All Purchases when ready.');
        }
        if (editingDraftId) {
          window._resumeDraftHeaderId = editingDraftId;
          const navBtn = document.querySelector('.nav-item[onclick*="new-purchase"]');
          const path = (typeof FOUNDRY_PAGE_PATHS !== 'undefined' && FOUNDRY_PAGE_PATHS['new-purchase']) || '/foundry/new-purchase';
          if (window.history && typeof window.history.replaceState === 'function') {
            window.history.replaceState({ module: 'foundry', page: 'new-purchase' }, '', `${path}?draft=${editingDraftId}`);
          }
          nav('new-purchase', navBtn || undefined);
        } else {
          const navPurch = document.querySelector('.sidebar-nav .nav-item[onclick*="purchases"]')
            || document.querySelector('[onclick*="purchases"]');
          nav('purchases', navPurch || undefined);
        }
      } else {
        if (editingDraftId && window.history && typeof window.history.replaceState === 'function') {
          const path = (typeof FOUNDRY_PAGE_PATHS !== 'undefined' && FOUNDRY_PAGE_PATHS['new-purchase']) || '/foundry/new-purchase';
          window.history.replaceState({ module: 'foundry', page: 'new-purchase' }, '', path);
        }
        if (typeof cosmosToastSuccess === 'function') {
          cosmosToastSuccess('Challan submitted. Finance will set payable amounts; ops can continue in parallel.');
        }
        const navPurch = document.querySelector('.sidebar-nav .nav-item[onclick*="purchases"]')
          || document.querySelector('[onclick*="purchases"]');
        nav('purchases', navPurch || undefined);
        loadPurchases();
      }
    } catch (err) {
      showErr('new-purchase-error', err.message);
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    } finally {
      if (btnSubmit && typeof cosmosBtnDone === 'function') cosmosBtnDone(btnSubmit);
      else if (btnSubmit) { btnSubmit.disabled = false; }
      if (btnDraft && typeof cosmosBtnDone === 'function') cosmosBtnDone(btnDraft);
      else if (btnDraft) { btnDraft.disabled = false; }
    }
  }

  window.handleSavePurchase = async function() {
    await savePurchaseInternal(false);
  };

  window.handleSavePurchaseDraft = async function() {
    await savePurchaseInternal(true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PURCHASES LIST
  // ─────────────────────────────────────────────────────────────────────────
  async function loadPurchases() {
    const tb  = document.getElementById('purchases-tbody');
    const q   = val('purchases-search');
    const stg = val('purchases-stage-filter');
    if (!tb) return;
    tb.innerHTML = '<tr><td colspan="9" class="tc td2 p12">Loading…</td></tr>';
    try {
      const rows = await apiGet(`/api/purchases?${q ? 'q='+encodeURIComponent(q)+'&' : ''}${stg ? 'pipeline_status='+stg : ''}`);
      // Update stat counts
      const counts = { PENDING_BILL_VERIFICATION: 0, PENDING_BRANDING: 0, BRANDING_DISPATCHED: 0, PENDING_DIGITISATION: 0, WAREHOUSE_READY: 0 };
      rows.forEach((r) => {
        if (r.pipeline_status in counts) counts[r.pipeline_status]++;
        if (r.pipeline_status === 'BRANDING_DISPATCHED') counts.PENDING_BRANDING++;
      });
      const setV = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      setV('pstat-bill',   rows.filter((r) => r.pipeline_status === 'PENDING_BILL_VERIFICATION').length);
      setV('pstat-brand',  rows.filter((r) => ['PENDING_BRANDING','BRANDING_DISPATCHED'].includes(r.pipeline_status)).length);
      setV('pstat-digit',  rows.filter((r) => r.pipeline_status === 'PENDING_DIGITISATION').length);
      setV('pstat-wh',     rows.filter((r) => r.pipeline_status === 'WAREHOUSE_READY').length);

      // Update sidebar nav badge: count non-WAREHOUSE_READY purchases
      const activeCount = rows.filter((r) => r.pipeline_status !== 'WAREHOUSE_READY').length;
      const purchaseBadge = document.getElementById('purchases-nav-badge');
      if (purchaseBadge) { purchaseBadge.textContent = activeCount; purchaseBadge.style.display = activeCount > 0 ? '' : 'none'; }

      if (!rows.length) { tb.innerHTML = '<tr><td colspan="9" class="tc td2 p12">No purchases found</td></tr>'; return; }

      tb.innerHTML = rows.map((r) => {
        const actions = [];
        if (r.pipeline_status === 'PENDING_BILL_VERIFICATION') {
          actions.push(`<button class="btn xs primary" data-action="open-bill-verify" data-id="${r.header_id}">Verify Bill</button>`);
          if (fyCanRevertPurchaseToDraft()) {
            actions.push(`<button type="button" class="btn xs" data-action="revert-to-purchase" data-id="${r.header_id}">Correct in purchase stage</button>`);
          }
        } else if (r.pipeline_status === 'BILL_DISCREPANCY') {
          actions.push(`<button type="button" class="btn xs primary" data-action="open-bill-verify" data-id="${r.header_id}">Review discrepancy</button>`);
          if (fyCanRevertPurchaseToDraft()) {
            actions.push(`<button type="button" class="btn xs" data-action="revert-to-purchase" data-id="${r.header_id}">Correct in purchase stage</button>`);
          }
          actions.push(`<button type="button" class="btn xs" data-action="open-purchase-view" data-id="${r.header_id}">View</button>`);
        } else if (r.pipeline_status === 'DRAFT') {
          actions.push(`<button type="button" class="btn xs" data-action="resume-draft" data-id="${r.header_id}">Edit draft</button>`);
          actions.push(`<button type="button" class="btn xs primary" data-action="submit-draft" data-id="${r.header_id}">Submit challan</button>`);
        }
        else if (['PENDING_BRANDING','BRANDING_DISPATCHED'].includes(r.pipeline_status))
          actions.push(`<button class="btn xs primary" data-action="open-branding" data-id="${r.header_id}">Branding</button>`);
        else if (r.pipeline_status === 'PENDING_DIGITISATION')
          actions.push(`<button class="btn xs primary" data-action="open-digitisation" data-id="${r.header_id}">Digitise</button>`);
        else if (r.pipeline_status === 'WAREHOUSE_READY')
          actions.push(`<button class="btn xs" data-action="open-purchase-view" data-id="${r.header_id}">View</button>`);

        return `<tr>
          <td class="mono xs">#${r.header_id}</td>
          <td class="fw6">${r.supplier_name || '—'}</td>
          <td class="mono xs td2">${r.challan_number || r.bill_ref || '—'}</td>
          <td class="tc">${r.item_count || 0}</td>
          <td class="tc">${r.total_qty || 0}</td>
          <td class="mono xs">${inrD(r.expected_bill_amt)}</td>
          <td>${stageBadge(r.pipeline_status)}</td>
          <td class="xs td2">${fmtDate(r.created_at)}</td>
          <td class="tc">${actions.join('')}</td>
        </tr>`;
      }).join('');
    } catch (err) { tb.innerHTML = `<tr><td colspan="9" class="tc td2 p12" style="color:var(--red)">${err.message}</td></tr>`; }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BILL VERIFICATION PAGE
  // ─────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  // PURCHASE VIEW — full pipeline history, all stages clickable
  // ─────────────────────────────────────────────────────────────────────────
  window.openPurchaseView = async function openPurchaseView(headerId) {
    window._currentHeaderId = headerId;
    nav('purchase-view', null, true);

    // Reset UI
    for (let s = 1; s <= 5; s++) {
      const p = document.getElementById(`pv-stage-${s}`);
      if (p) { p.style.display = 'none'; p.innerHTML = ''; }
      const step = document.getElementById(`pv-step-${s}`);
      if (step) { step.className = 'pstep'; }
    }
    const loadEl = document.getElementById('pv-loading');
    const errEl  = document.getElementById('pv-error');
    if (loadEl) loadEl.style.display = '';
    if (errEl)  errEl.style.display  = 'none';

    try {
      const [purchData, skuData] = await Promise.all([
        apiGet(`/api/purchases/${headerId}`),
        apiGet(`/api/purchases/${headerId}/skus`)
      ]);
      const h     = purchData.header;
      const items = purchData.items || [];
      const skus  = _pvMergeBrandOntoSkus(items, skuData || []);
      window._pvCurrentSkus = skus;

      const titleEl = document.getElementById('pv-title');
      const subEl   = document.getElementById('pv-subtitle');
      if (titleEl) titleEl.textContent = `Purchase #${h.header_id} — ${h.supplier_name || ''}`;
      if (subEl) {
        const chNum = h.challan_number || h.bill_ref;
        const chPart = chNum
          ? ` &nbsp;·&nbsp; Challan <span class="mono fw6">${_mcEsc(String(chNum))}</span>`
          : '';
        subEl.innerHTML = `${stageBadge(h.pipeline_status)} &nbsp;·&nbsp; ${items.length} item${items.length !== 1 ? 's' : ''} · ${fmtDate(h.purchase_date)}${chPart}`;
      }

      // Populate each stage panel
      _pvRenderStage1(h, items);
      _pvRenderStage2(h, items);
      _pvRenderStage3(h);
      _pvRenderStage4(items, skus);
      _pvRenderStage5(h, skus);

      if (loadEl) loadEl.style.display = 'none';

      // Mark completed stages (done class) + the active/current stage
      const stageNum = { DRAFT: 1, PENDING_BILL_VERIFICATION: 1, PENDING_BRANDING: 2,
        BRANDING_DISPATCHED: 3, PENDING_DIGITISATION: 4, WAREHOUSE_READY: 5 };
      const completedUpTo = stageNum[h.pipeline_status] || 5;
      for (let s = 1; s <= 5; s++) {
        const step = document.getElementById(`pv-step-${s}`);
        if (!step) continue;
        if (s < completedUpTo) step.classList.add('done');
        else if (s === completedUpTo) step.classList.add('done', 'active');
      }

      // Default: show highest completed stage
      switchPVStage(completedUpTo);

    } catch (err) {
      if (loadEl) loadEl.style.display = 'none';
      if (errEl)  { errEl.textContent = err.message; errEl.style.display = ''; }
    }
  };

  window.switchPVStage = function(n) {
    for (let s = 1; s <= 5; s++) {
      const panel = document.getElementById(`pv-stage-${s}`);
      const step  = document.getElementById(`pv-step-${s}`);
      if (panel) panel.style.display = (s === n) ? '' : 'none';
      if (step) {
        step.classList.remove('active');
        if (s === n) step.classList.add('active');
      }
    }
    if (typeof window.pvUpdatePrintSelectedBtn === 'function') window.pvUpdatePrintSelectedBtn();
  };

  // Stage 1 — Purchase Registration
  function _pvRenderStage1(h, items) {
    const el = document.getElementById('pv-stage-1');
    if (!el) return;
    const rows = items.map((it) => `<tr>
      <td class="fw6">${it.ew_collection || ''} · ${it.style_model || ''}</td>
      <td>${it.brand_name || it.source_brand || '—'}</td>
      <td class="tc">${productTypeLabel(it.category)}</td>
      <td class="tc">${it.quantity}</td>
    </tr>`).join('');
    el.innerHTML = `<div class="main-side">
      <div class="col-stack">
        <div class="card">
          <div class="ch"><div class="ct">Purchase Registration Details</div></div>
          <div class="cb">
            <div class="fg3 mb4">
              <div><div class="xs td2">Supplier</div><div class="fw6">${h.supplier_name || '—'}</div></div>
              <div><div class="xs td2">Challan No.</div><div class="fw6 mono">${h.challan_number || h.bill_ref || '—'}</div></div>
              <div><div class="xs td2">Challan date</div><div class="fw6">${h.challan_date ? fmtDate(h.challan_date) : '—'}</div></div>
              <div><div class="xs td2">Purchase Date</div><div class="fw6">${fmtDate(h.purchase_date)}</div></div>
              <div><div class="xs td2">Registered</div><div class="fw6">${fmtDateTime(h.created_at)}</div></div>
            </div>
            <div class="section-lbl mb2">Items Purchased</div>
            <div class="tw"><table>
              <thead><tr><th>Product</th><th>Brand</th><th>Product Type</th><th>Qty</th></tr></thead>
              <tbody>${rows || '<tr><td colspan="4" class="tc td2">No items</td></tr>'}</tbody>
            </table></div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // Stage 2 — Bill Verification
  function _pvRenderStage2(h) {
    const el = document.getElementById('pv-stage-2');
    if (!el) return;
    const verified = h.bill_status === 'VERIFIED';
    el.innerHTML = `<div class="main-side">
      <div class="col-stack">
        <div class="card">
          <div class="ch"><div class="ct">Bill Verification Details</div>
            <span class="b ${verified ? 'b-green' : 'b-gold'}">${verified ? '✓ Verified' : 'Pending'}</span>
          </div>
          <div class="cb">
            <div class="fg3 mb4">
              <div><div class="xs td2">Bill Number</div><div class="fw6 mono">${h.bill_number || '—'}</div></div>
              <div><div class="xs td2">Bill Date</div><div class="fw6">${fmtDate(h.bill_date)}</div></div>
            </div>
            ${h.discrepancy_note ? `<div class="xs td2 mt3">Note: ${h.discrepancy_note}</div>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  }

  // Stage 3 — Branding
  function _pvRenderStage3(h) {
    const el = document.getElementById('pv-stage-3');
    if (!el) return;
    const bypassed  = !!h.bypass_reason;
    const received  = !!h.received_at;
    el.innerHTML = `<div class="main-side">
      <div class="col-stack">
        <div class="card">
          <div class="ch"><div class="ct">Branding Stage</div>
            <span class="b b-green">${bypassed ? 'Bypassed' : (received ? '✓ Received' : 'Dispatched')}</span>
          </div>
          <div class="cb">
            <div class="fg3">
              ${bypassed ? `
                <div><div class="xs td2">Status</div><div class="fw6">Bypassed to Digitisation</div></div>
                <div><div class="xs td2">Reason</div><div class="fw6">${h.bypass_reason}</div></div>` : `
                <div><div class="xs td2">Dispatched At</div><div class="fw6">${fmtDateTime(h.dispatched_at) || '—'}</div></div>
                <div><div class="xs td2">Received At</div><div class="fw6">${fmtDateTime(h.received_at) || '—'}</div></div>
                <div><div class="xs td2">Branding Agent</div><div class="fw6">${h.branding_agent_name || '—'}</div></div>
                ${h.branding_instructions ? `<div><div class="xs td2">Instructions</div><div class="fw6">${h.branding_instructions}</div></div>` : ''}`}
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  function _pvActiveStagePanel() {
    for (let s = 5; s >= 4; s--) {
      const el = document.getElementById('pv-stage-' + s);
      if (el && el.style.display !== 'none') return el;
    }
    return null;
  }

  /** Purchase items carry brand_name; SKU list from GetSKUs often does not — merge for label print. */
  function _pvMergeBrandOntoSkus(items, skus) {
    const brandByItemId = {};
    const brandCodeByItemId = {};
    (items || []).forEach(function (it) {
      const b = it.brand_name || it.locked_home_brand_name || it.source_brand || it.maker_name || '';
      const trimmed = String(b).trim();
      if (it.item_id && trimmed && trimmed !== '—') brandByItemId[Number(it.item_id)] = trimmed;
      const c = it.brand_code || it.locked_home_brand_code || '';
      const codeTrim = String(c).trim();
      if (it.item_id && codeTrim) brandCodeByItemId[Number(it.item_id)] = codeTrim;
    });
    return (skus || []).map(function (sk) {
      let out = sk;
      const hasName = sk.brand_name && String(sk.brand_name).trim() && String(sk.brand_name).trim() !== '—';
      const hasCode = sk.brand_code && String(sk.brand_code).trim();
      const fromName = brandByItemId[Number(sk.item_id)];
      const fromCode = brandCodeByItemId[Number(sk.item_id)];
      if ((!hasName && fromName) || (!hasCode && fromCode)) {
        out = Object.assign({}, sk);
        if (!hasName && fromName) out.brand_name = fromName;
        if (!hasCode && fromCode) out.brand_code = fromCode;
      }
      return out;
    });
  }

  function _bcStripBrandLine(sk) {
    const candidates = [
      sk.brand_name,
      sk.locked_home_brand_name,
      sk.source_brand,
      sk.maker_name
    ];
    for (let i = 0; i < candidates.length; i++) {
      const s = candidates[i] != null ? String(candidates[i]).trim() : '';
      if (s && s !== '—') return s;
    }
    return '';
  }

  function _bcCompactBrandSegment(sk) {
    const code = sk.brand_code != null ? String(sk.brand_code).trim() : '';
    if (code) return code.toUpperCase().slice(0, 6);
    const name = _bcStripBrandLine(sk);
    if (name) {
      const letters = name.replace(/[^A-Za-z0-9]/g, '');
      if (letters.length >= 1) return letters.slice(0, 3).toUpperCase();
    }
    return '—';
  }

  function _bcCompactPriceSegment(sk) {
    if (sk.sale_price == null || sk.sale_price === '') return '—';
    const n = Math.round(Number(sk.sale_price));
    if (!Number.isFinite(n)) return '—';
    return String(n);
  }

  function _bcCompactBottomLine(sk) {
    return _bcCompactBrandSegment(sk) + '-' + _bcCompactPriceSegment(sk);
  }

  function _pvBarcodeToolbarHtml() {
    return `<button type="button" class="btn btn-sm primary pv-print-selected-btn" onclick="pvPrintSelectedBarcodes()" disabled style="font-size:12px;padding:6px 12px;white-space:nowrap;min-height:40px" title="Print labels only for checked rows">Print labels (selected)</button>
      <button type="button" class="btn btn-sm" onclick="window.openBarcodeModal(window._pvCurrentSkus)" style="font-size:12px;padding:6px 12px;white-space:nowrap;min-height:40px" title="Print a label for every SKU on this purchase">Print all labels</button>`;
  }

  function _pvSkuSelectCellHtml(sk) {
    const sid = sk.sku_id != null ? Number(sk.sku_id) : 0;
    const code = _mcEsc(sk.sku_code || '');
    return `<td class="tc" style="width:36px"><input type="checkbox" class="pv-sku-chk" data-sku-id="${sid}" data-sku-code="${code}" onchange="pvUpdatePrintSelectedBtn()" onclick="event.stopPropagation()"></td>`;
  }

  window.pvPrintBarcodesForSkuIds = function pvPrintBarcodesForSkuIds(skuIds) {
    const all = window._pvCurrentSkus || [];
    const numSet = new Set();
    const codeSet = new Set();
    (skuIds || []).forEach(function (x) {
      const n = Number(x);
      if (n > 0) numSet.add(n);
      else if (typeof x === 'string' && String(x).trim()) codeSet.add(String(x).trim());
    });
    const filtered = all.filter(function (sk) {
      const sid = Number(sk.sku_id);
      if (sid > 0 && numSet.has(sid)) return true;
      if (sk.sku_code && codeSet.has(String(sk.sku_code).trim())) return true;
      return false;
    });
    if (!filtered.length) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('No SKUs selected for print.');
      return;
    }
    if (typeof window.openBarcodeModal !== 'function') {
      if (typeof cosmosToastError === 'function') cosmosToastError('Barcode print is not loaded yet.');
      return;
    }
    window.openBarcodeModal(filtered, { source: 'purchase-view' });
  };

  window.pvPrintSelectedBarcodes = function pvPrintSelectedBarcodes() {
    const panel = _pvActiveStagePanel();
    const chks = panel ? panel.querySelectorAll('.pv-sku-chk:checked') : [];
    const keys = [];
    chks.forEach(function (c) {
      const id = Number(c.getAttribute('data-sku-id'));
      if (id > 0) keys.push(id);
      else {
        const code = c.getAttribute('data-sku-code');
        if (code) keys.push(code);
      }
    });
    if (!keys.length) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Select at least one SKU to print.');
      return;
    }
    pvPrintBarcodesForSkuIds(keys);
  };

  window.pvToggleAllSkuChecks = function pvToggleAllSkuChecks(checked) {
    const panel = _pvActiveStagePanel();
    const scope = panel || document;
    scope.querySelectorAll('.pv-sku-chk').forEach(function (c) {
      c.checked = !!checked;
    });
    pvUpdatePrintSelectedBtn();
  };

  window.pvUpdatePrintSelectedBtn = function pvUpdatePrintSelectedBtn() {
    const panel = _pvActiveStagePanel();
    const n = panel ? panel.querySelectorAll('.pv-sku-chk:checked').length : 0;
    document.querySelectorAll('.pv-print-selected-btn').forEach(function (btn) {
      btn.disabled = n < 1;
    });
  };

  // Stage 4 — Digitisation
  function _pvRenderStage4(items, skus) {
    const el = document.getElementById('pv-stage-4');
    if (!el) return;
    const rows = skus.map((sk) => `<tr>
      ${_pvSkuSelectCellHtml(sk)}
      <td class="mono xs fw6">${sk.sku_code}</td>
      <td class="mono xs">${sk.barcode}</td>
      <td>${sk.ew_collection || ''} · ${sk.style_model || ''}</td>
      <td>${sk.colour_name || '—'}</td>
      <td class="mono xs">${inrD(sk.sale_price)}</td>
      <td class="tc">${sk.quantity}</td>
      <td><span class="b b-green xs">${sk.status}</span></td>
    </tr>`).join('');
    const printToolbar = skus.length ? _pvBarcodeToolbarHtml() : '';
    el.innerHTML = `<div class="card">
      <div class="ch" style="gap:12px">
        <div class="ct" style="min-width:0">Generated SKUs</div>
        <div class="flex ic g2" style="flex-shrink:0;margin-left:auto">
          <span class="b b-teal xs">${skus.length} SKUs</span>
          ${printToolbar}
        </div>
      </div>
      <div class="cb">
        <div class="tw"><table>
          <thead><tr>
            <th class="tc" style="width:36px"><input type="checkbox" title="Select all" onchange="pvToggleAllSkuChecks(this.checked)" onclick="event.stopPropagation()"></th>
            <th>SKU Code</th><th>Barcode</th><th>Product</th><th>Colour</th><th>Sale Price</th><th>Qty</th><th>Status</th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="8" class="tc td2">No SKUs generated</td></tr>'}</tbody>
        </table></div>
      </div>
    </div>`;
    pvUpdatePrintSelectedBtn();
  }

  // Stage 5 — Warehouse
  function _pvRenderStage5(h, skus) {
    const el = document.getElementById('pv-stage-5');
    if (!el) return;
    const totalQty   = skus.reduce((s, sk) => s + Number(sk.quantity || 0), 0);
    const totalValue = skus.reduce((s, sk) => s + (Number(sk.sale_price || 0) * Number(sk.quantity || 0)), 0);

    // Product summary cards (grouped by product)
    const productMap = {};
    skus.forEach((sk) => {
      const key = sk.product_master_id || sk.sku_code;
      if (!productMap[key]) productMap[key] = { ...sk, colours: [] };
      productMap[key].colours.push({ colour_name: sk.colour_name, colour_code: sk.colour_code, qty: sk.quantity, sku_code: sk.sku_code });
    });

    const productCards = Object.values(productMap).map((p) => {
      const imgEl = p.image_url
        ? `<img src="${p.image_url}" style="width:100%;height:120px;object-fit:cover;border-radius:6px 6px 0 0">`
        : `<div style="width:100%;height:80px;display:flex;align-items:center;justify-content:center;font-size:32px;background:#f7f7f7;border-radius:6px 6px 0 0">${p.pm_product_type === 'SUNGLASSES' ? '🕶️' : '👓'}</div>`;
      const vidEl = p.video_url
        ? `<video src="${p.video_url}" controls style="width:100%;max-height:100px;border-radius:0;border-top:1px solid var(--border)"></video>`
        : '';
      const specParts = [
        p.frame_material ? p.frame_material : null,
        p.frame_width    ? `W:${p.frame_width}mm` : null,
        p.lens_height    ? `L:${p.lens_height}mm` : null,
      ].filter(Boolean).join(' · ');
      const colourRows = p.colours.map((c) => `<div class="flex ic" style="justify-content:space-between;padding:2px 0;border-bottom:1px solid #f0f0f0">
          <span class="xs">${c.colour_name || '—'} ${c.colour_code ? `<span class="td2">(${c.colour_code})</span>` : ''}</span>
          <span class="xs fw6">${c.qty} units</span>
        </div>`).join('');
      return `<div class="card" style="padding:0;overflow:hidden;min-width:200px;flex:0 0 200px">
        ${imgEl}${vidEl}
        <div style="padding:10px">
          <div class="fw6 xs">${p.ew_collection || ''} · ${p.style_model || ''}</div>
          <div class="xs td2 mt1">${p.brand_name || '—'}</div>
          ${specParts ? `<div class="xs td2 mt1">${specParts}</div>` : ''}
          ${p.description ? `<div class="xs td2 mt1" style="line-height:1.4">${p.description}</div>` : ''}
          <hr style="border:none;border-top:1px solid #eee;margin:6px 0">
          ${colourRows}
          <div class="flex ic mt2" style="justify-content:space-between">
            <span class="xs td2">Sale Price</span>
            <span class="xs fw6 mono" style="color:var(--primary)">${inrD(p.sale_price)}</span>
          </div>
        </div>
      </div>`;
    }).join('');

    const tableRows = skus.map((sk) => `<tr>
      ${_pvSkuSelectCellHtml(sk)}
      <td class="mono xs fw6">${sk.sku_code}</td>
      <td>${sk.ew_collection || ''} · ${sk.style_model || ''}</td>
      <td>${sk.colour_name || '—'}</td>
      <td class="mono xs">${inrD(sk.sale_price)}</td>
      <td class="tc fw6">${sk.quantity}</td>
      <td class="mono xs">${inrD(Number(sk.sale_price || 0) * Number(sk.quantity || 0))}</td>
    </tr>`).join('');

    const printToolbar5 = skus.length ? _pvBarcodeToolbarHtml() : '';

    el.innerHTML = `<div class="main-side">
      <div class="col-stack">
        <div class="card">
          <div class="ch" style="gap:12px">
            <div class="ct" style="min-width:0">Warehouse Stock Added</div>
            <div class="flex ic g2" style="flex-shrink:0;margin-left:auto">
              ${printToolbar5}
              <span class="b b-green">✓ LIVE</span>
            </div>
          </div>
          <div class="cb">
            <div class="fg4 mb4">
              <div><div class="xs td2">Warehouse Date</div><div class="fw6">${fmtDateTime(h.warehouse_at) || '—'}</div></div>
              <div><div class="xs td2">Total SKUs</div><div class="fw6">${skus.length}</div></div>
              <div><div class="xs td2">Total Units</div><div class="fw6">${totalQty}</div></div>
              <div><div class="xs td2">Catalogue Value</div><div class="fw6 mono" style="color:var(--green)">${inrD(totalValue)}</div></div>
            </div>
            ${productCards ? `<div style="display:flex;gap:14px;overflow-x:auto;padding-bottom:8px;margin-bottom:16px">${productCards}</div>` : ''}
            <div class="section-lbl mb2">SKU Details</div>
            <div class="tw"><table>
              <thead><tr>
                <th class="tc" style="width:36px"><input type="checkbox" title="Select all" onchange="pvToggleAllSkuChecks(this.checked)" onclick="event.stopPropagation()"></th>
                <th>SKU Code</th><th>Product</th><th>Colour</th><th>Sale Price</th><th>Qty</th><th>Value</th>
              </tr></thead>
              <tbody>${tableRows || '<tr><td colspan="7" class="tc td2">No SKUs</td></tr>'}</tbody>
            </table></div>
          </div>
        </div>
      </div>
    </div>`;
    pvUpdatePrintSelectedBtn();
  }

  window.runRevertPurchaseToDraft = async function runRevertPurchaseToDraft(headerId, buttonEl) {
    const id = Number(headerId);
    if (!id) return;
    if (!window.confirm('Return this purchase to the purchase registration stage? Bill verification fields will be cleared. You can edit lines and submit to bill verification again.')) return;
    if (buttonEl && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(buttonEl);
    try {
      await apiPut(`/api/purchases/${id}/revert-to-draft`, {});
      if (typeof cosmosToastSuccess === 'function') {
        cosmosToastSuccess(
          fyCanEditPurchaseDraftAfterRevert()
            ? 'Purchase moved to draft. Edit and submit again when ready.'
            : 'Purchase moved to draft. Someone with purchase registration access can edit lines and resubmit to bill verification.'
        );
      }
      loadPurchases();
      if (fyCanEditPurchaseDraftAfterRevert()) {
        resumeDraftPurchaseForEdit(id);
      } else {
        const navPurch = document.querySelector('.nav-item[onclick*="purchases"]');
        nav('purchases', navPurch || undefined);
      }
    } catch (e) {
      const m = e && e.message ? e.message : String(e);
      if (typeof cosmosToastError === 'function') cosmosToastError(m);
      else showErr('bill-verify-error', m);
    } finally {
      if (buttonEl && typeof cosmosBtnDone === 'function') cosmosBtnDone(buttonEl);
    }
  };

  window.handleRevertPurchaseToDraft = function handleRevertPurchaseToDraft(buttonEl) {
    const id = window._currentHeaderId;
    if (!id) {
      if (typeof cosmosToastError === 'function') cosmosToastError('No purchase selected.');
      return;
    }
    return window.runRevertPurchaseToDraft(id, buttonEl);
  };

  window.openBillVerifyPage = async function openBillVerifyPage(headerId) {
    window._currentHeaderId = headerId;
    nav('bill-verify', document.querySelector('.nav-item[onclick*="bill-verify"]'), true);
    showBvDetail();
    showErr('bill-verify-error', '');
    const formCard = document.getElementById('bill-entry-form-card');
    const verifyBtn = document.getElementById('verify-bill-btn');
    const revertBtn = document.getElementById('bv-revert-to-purchase-btn');
    if (formCard) formCard.style.display = '';
    if (verifyBtn) verifyBtn.style.display = '';
    if (revertBtn) revertBtn.style.display = 'none';
    try {
      const data = await apiGet(`/api/purchases/${headerId}`);
      const h = data.header;
      const items = data.items || [];

      const isPending = h.pipeline_status === 'PENDING_BILL_VERIFICATION';
      const isDisc = h.pipeline_status === 'BILL_DISCREPANCY';
      if (!isPending && !isDisc) {
        return window.openPurchaseView(headerId);
      }

      document.getElementById('bv-title').textContent = `Purchase #${h.header_id} — ${h.supplier_name || ''}`;
      const badge = document.getElementById('bv-status-badge');
      if (isPending) {
        badge.className = 'b b-gold';
        badge.textContent = 'Pending Bill Verification';
        document.getElementById('bv-meta').innerHTML = `
        <div><div class="xs td2">Supplier</div><div class="fw6">${h.supplier_name || '—'}</div></div>
        <div><div class="xs td2">Challan No.</div><div class="fw6 mono">${h.challan_number || h.bill_ref || '—'}</div></div>
        <div><div class="xs td2">Challan date</div><div class="fw6">${h.challan_date ? fmtDate(h.challan_date) : '—'}</div></div>
        <div><div class="xs td2">Purchase Date</div><div class="fw6">${fmtDate(h.purchase_date)}</div></div>`;
        if (formCard) formCard.style.display = '';
        if (verifyBtn) verifyBtn.style.display = '';
        const billDateEl = document.getElementById('bill-date-input');
        if (billDateEl && !billDateEl.value && billDateEl._flatpickr) billDateEl._flatpickr.setDate(new Date(), true);
      } else {
        badge.className = 'b b-red';
        badge.textContent = 'Bill Discrepancy';
        const discNote = h.discrepancy_note ? _mcEsc(String(h.discrepancy_note)) : '';
        document.getElementById('bv-meta').innerHTML = `
        <div><div class="xs td2">Supplier</div><div class="fw6">${h.supplier_name || '—'}</div></div>
        <div><div class="xs td2">Challan No.</div><div class="fw6 mono">${h.challan_number || h.bill_ref || '—'}</div></div>
        <div><div class="xs td2">Challan date</div><div class="fw6">${h.challan_date ? fmtDate(h.challan_date) : '—'}</div></div>
        <div><div class="xs td2">Purchase Date</div><div class="fw6">${fmtDate(h.purchase_date)}</div></div>
        <div><div class="xs td2">Entered bill amount</div><div class="fw6 mono">${inrD(h.actual_bill_amt)}</div></div>
        <div><div class="xs td2">Bill number</div><div class="fw6 mono">${_mcEsc(h.bill_number || '—')}</div></div>
        <div><div class="xs td2">Bill date</div><div class="fw6">${fmtDate(h.bill_date)}</div></div>
        ${discNote ? `<div style="grid-column:1/-1"><div class="xs td2">Discrepancy note</div><div class="fw6">${discNote}</div></div>` : ''}`;
        if (formCard) formCard.style.display = 'none';
        if (verifyBtn) verifyBtn.style.display = 'none';
      }

      let itemRows = '';
      items.forEach((it) => {
        itemRows += `<tr>
          <td class="fw6">${it.ew_collection || ''} · ${it.style_model || ''}</td>
          <td>${it.brand_name || it.source_brand || '—'}</td>
          <td><span class="b b-gray xs">${productTypeLabel(it.category)}</span></td>
          <td class="mono xs">${inrD(it.purchase_rate)}</td>
          <td class="tc">${it.quantity}</td>
          <td class="tc mono xs">${(it.gst_pct * 100).toFixed(1)}%</td>
          <td class="mono xs">${inrD(it.item_total)}</td>
        </tr>`;
      });
      document.getElementById('bv-items-tbody').innerHTML = itemRows || '<tr><td colspan="7" class="tc td2">No items</td></tr>';

      const itemsSubtotal = items.reduce((s, it) => s + Number(it.base_value), 0);
      const totalGst      = items.reduce((s, it) => s + Number(it.gst_amt), 0);
      const transport     = Number(h.transport_cost) || 0;
      const expected      = Number(h.expected_bill_amt) || (itemsSubtotal + totalGst + transport);

      document.getElementById('bv-subtotal').textContent   = inrD(itemsSubtotal);
      document.getElementById('bv-transport').textContent  = inrD(transport);
      document.getElementById('bv-gst').textContent        = inrD(totalGst);
      document.getElementById('bv-expected').textContent   = inrD(expected);

      if (revertBtn) revertBtn.style.display = fyCanRevertPurchaseToDraft() ? '' : 'none';
    } catch (err) {
      showErr('bill-verify-error', err.message);
      if (revertBtn) revertBtn.style.display = 'none';
    }
  };

  window.reconcile = function() {
    const actual   = parseFloat(document.getElementById('actual-bill')?.value) || 0;
    const expected = parseFloat(document.getElementById('bv-expected')?.textContent?.replace(/[₹,]/g,'')) || 0;
    const diff     = actual - expected;
    const el       = document.getElementById('reconcile-result');
    if (!el || !actual) { if (el) el.innerHTML = ''; return; }
    const abs = Math.abs(diff);
    const ok  = abs <= 50;
    el.innerHTML = `<div style="background:${ok?'var(--greenL)':'var(--redL)'};border:1.5px solid ${ok?'#6EE7B7':'var(--red)'};border-radius:8px;padding:10px 14px;font-size:13px;margin-top:8px">
      ${ok ? '✅' : '⚠️'} Variance: <strong>${diff > 0 ? '+' : ''}${inrD(diff)}</strong> ${ok ? '— Within threshold, will auto-approve.' : '— Exceeds ±₹50 threshold. Will be flagged.'}
    </div>`;
  };

  window.handleVerifyBill = async function() {
    const headerId  = window._currentHeaderId;
    if (!headerId) return showErr('bill-verify-error', 'No purchase selected.');
    const actual    = parseFloat(val('actual-bill'));
    const billNum   = val('bill-number-input');
    const billDate  = (typeof getFpIso === 'function' ? getFpIso('bill-date-input') : null) || val('bill-date-input');
    const discrNote = val('discrepancy-note-input');
    if (!actual || actual <= 0) return showErr('bill-verify-error', 'Enter Actual Bill Amount.');
    if (!billNum)  return showErr('bill-verify-error', 'Enter Bill Number.');
    if (!billDate) return showErr('bill-verify-error', 'Enter Bill Date.');
    const btn = document.getElementById('verify-bill-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Verifying…'; }
    showErr('bill-verify-error', '');
    try {
      const res = await apiPut(`/api/purchases/${headerId}/verify-bill`, {
        actual_bill_amt: actual,
        bill_number: billNum,
        bill_date: billDate,
        discrepancy_note: discrNote || null
      });
      // Navigate based on next stage
      const next = res && res.pipeline_status;
      if (next === 'PENDING_BRANDING' || next === 'BRANDING_DISPATCHED') {
        openBrandingPage(headerId);
      } else if (next === 'PENDING_DIGITISATION') {
        openDigitisationPage(headerId);
      } else {
        loadPurchases();
        nav('purchases', document.querySelector('.nav-item[onclick*="nav(\'purchases\'"]'));
      }
      // Reset form
      document.getElementById('actual-bill').value = '';
      document.getElementById('bill-number-input').value = '';
      const bdEl = document.getElementById('bill-date-input');
      if (bdEl && bdEl._flatpickr) bdEl._flatpickr.clear(); else if (bdEl) bdEl.value = '';
      document.getElementById('reconcile-result').innerHTML = '';
    } catch (err) { showErr('bill-verify-error', err.message); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Verify Bill → Next Stage'; } }
  };

  window.printBillSummary = function() {
    const headerId = window._currentHeaderId;
    if (!headerId) return;
    const title  = document.getElementById('bv-title')?.textContent || '';
    const meta   = document.getElementById('bv-meta')?.innerHTML || '';
    const items  = document.getElementById('bv-items-tbody')?.innerHTML || '';
    const breakdown = document.getElementById('bv-breakdown')?.innerHTML || '';
    openPrintWindow(`Bill Summary — ${title}`, `
      <h2>${title}</h2>
      <div style="display:flex;gap:24px;margin-bottom:16px">${meta}</div>
      <h3>Items</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr>
          <th style="border-bottom:2px solid #000;padding:6px 8px;text-align:left">Product</th>
          <th style="border-bottom:2px solid #000;padding:6px 8px">Brand</th>
          <th style="border-bottom:2px solid #000;padding:6px 8px">Rate</th>
          <th style="border-bottom:2px solid #000;padding:6px 8px">Qty</th>
          <th style="border-bottom:2px solid #000;padding:6px 8px">GST%</th>
          <th style="border-bottom:2px solid #000;padding:6px 8px">Total</th>
        </tr></thead>
        <tbody>${items}</tbody>
      </table>
      <div style="margin-top:16px;max-width:300px">${breakdown}</div>`);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // BRANDING PAGE
  // ─────────────────────────────────────────────────────────────────────────
  window.openBrandingPage = async function openBrandingPage(headerId) {
    window._currentHeaderId = headerId;
    nav('branding', document.querySelector('.nav-item[onclick*="nav(\'branding\'"]'), true);
    showBrandingDetail();
    try {
      const data = await apiGet(`/api/purchases/${headerId}`);
      const h = data.header;
      const items = data.items || [];

      // Update header meta
      const title = `Purchase #${h.header_id} — ${h.supplier_name || ''}`;
      document.getElementById('branding-hdr-title').textContent = title;
      const badge = document.getElementById('branding-status-badge');
      badge.className = 'b';
      if (h.pipeline_status === 'BRANDING_DISPATCHED') { badge.classList.add('b-blue'); badge.textContent = 'Dispatched'; }
      else { badge.classList.add('b-gold'); badge.textContent = 'Pending Dispatch'; }

      document.getElementById('branding-meta').innerHTML = `
        <div><div class="xs td2">Supplier</div><div class="fw6">${h.supplier_name || '—'}</div></div>
        <div><div class="xs td2">Challan No.</div><div class="mono xs fw6">${h.challan_number || h.bill_ref || '—'}</div></div>
        <div><div class="xs td2">Challan date</div><div class="fw6">${h.challan_date ? fmtDate(h.challan_date) : '—'}</div></div>
        <div><div class="xs td2">Purchase Date</div><div class="fw6">${fmtDate(h.purchase_date)}</div></div>`;

      // Build all-items colour table
      let allItemsHtml = '';
      const isPendingDispatch = h.pipeline_status === 'PENDING_BRANDING';
      const totalItemQty = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
      const totalColourRows = items.reduce((s, it) => s + ((it.colours || []).length), 0);
      const brandingRequiredCount = items.filter((it) => !!it.branding_required).length;
      const toBoolish = (v) => {
        if (v === true || v === 1) return true;
        if (typeof v === 'string') {
          const t = v.trim().toLowerCase();
          return t === 'true' || t === '1' || t === 'yes';
        }
        return false;
      };
      items.forEach((it) => {
        const needsBranding = it.branding_required;
        const isBrandLockedUi = toBoolish(it.is_brand_locked)
          || Number(it.locked_home_brand_id || 0) > 0
          || toBoolish(it.is_existing_product)
          || Number(it.home_brand_id || 0) > 0
          || (it.colours || []).some((c) => Number(c.linked_sku_id || 0) > 0);
        // Brand selector — shown for items needing branding in PENDING_BRANDING state;
        // read-only display when already dispatched/received.
        let brandRowHtml = '';
        const collDefault = (it.ew_collection || it.source_collection || '').replace(/"/g, '&quot;');
        if (needsBranding) {
          if (isPendingDispatch && !isBrandLockedUi) {
            const brandOpts = (_homeBrands || []).map((b) =>
              `<option value="${b.brand_id}" ${Number(b.brand_id) === Number(it.home_brand_id) ? 'selected' : ''}>${b.brand_name}</option>`
            ).join('');
            const srcCollHint = it.source_collection || '—';
            brandRowHtml = `
              <div class="fgrp mt2" style="margin-bottom:10px">
                <label style="font-size:12px;font-weight:600">Brand Name <span class="req">*</span></label>
                <div class="xs td2" style="margin-top:2px;margin-bottom:2px">Source brand: <span class="fw6">${it.source_brand || '—'}</span></div>
                <select id="brand-sel-${it.item_id}" data-item-id="${it.item_id}" data-brand-locked="0" style="margin-top:4px">
                  <option value="">— Select Brand —</option>
                  ${brandOpts}
                </select>
              </div>
              <div class="fgrp mt2" style="margin-bottom:10px">
                <label style="font-size:12px;font-weight:600">Collection Name <span class="req">*</span></label>
                <div class="xs td2" style="margin-top:2px;margin-bottom:2px">Source collection: <span class="fw6">${srcCollHint}</span></div>
                <input type="text" id="coll-inp-${it.item_id}" data-item-id="${it.item_id}" data-brand-locked="0" placeholder="Eyewoot / home collection name" value="${collDefault}" style="margin-top:4px;width:100%;max-width:420px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px">
              </div>`;
          } else if (isPendingDispatch && isBrandLockedUi) {
            const brandDisplay = it.locked_home_brand_name || it.brand_name || '—';
            const collDisplay = it.ew_collection || '—';
            brandRowHtml = `
              <div class="digi-restock-note" style="margin-top:6px;margin-bottom:10px">
                Existing product detected. Home Brand and Collection are recalled from existing product details and locked.
              </div>
              <div style="font-size:12px;margin-top:6px;margin-bottom:8px">
                <span class="xs td2">Brand:</span> <span class="fw6">${brandDisplay}</span>
                <span class="xs td2" style="margin-left:12px">Collection:</span> <span class="fw6">${collDisplay}</span>
              </div>`;
          } else {
            const brandDisplay = it.brand_name || '—';
            const collDisplay = it.ew_collection || '—';
            brandRowHtml = `
              <div style="font-size:12px;margin-top:6px;margin-bottom:8px">
                <span class="xs td2">Brand:</span> <span class="fw6">${brandDisplay}</span>
                <span class="xs td2" style="margin-left:12px">Collection:</span> <span class="fw6">${collDisplay}</span>
                ${it.source_collection ? `<span class="xs td2" style="margin-left:8px">(source: ${it.source_collection})</span>` : ''}
              </div>`;
          }
        } else {
          const srcBrandLabel = it.source_brand || '—';
          const srcCollLabel = it.source_collection || '—';
          brandRowHtml = `
            <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;margin-bottom:8px">
              <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;flex-wrap:wrap">
                <span style="font-size:11px;color:var(--text3)">Brand Name</span>
                <span style="font-size:13px;font-weight:600">${srcBrandLabel}</span>
                <span style="font-size:11px;padding:2px 7px;border-radius:10px;background:var(--goldL);color:var(--gold);font-weight:500;white-space:nowrap">= Source Brand · No branding needed</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;flex-wrap:wrap">
                <span style="font-size:11px;color:var(--text3)">Collection Name</span>
                <span style="font-size:13px;font-weight:600">${srcCollLabel}</span>
                <span style="font-size:11px;padding:2px 7px;border-radius:10px;background:var(--goldL);color:var(--gold);font-weight:500;white-space:nowrap">= Source Collection · No branding needed</span>
              </div>
            </div>`;
        }

        const totalColourQty = (it.colours || []).reduce((s, c) => s + Number(c.quantity || 0), 0);
        allItemsHtml += `
          <div class="br-item-card">
            <div class="br-item-head">
              <div>
                <div class="br-item-title">${it.ew_collection || '—'} · ${it.style_model || '—'}</div>
                <div class="br-item-sub">Item #${it.item_id || '—'} · ${it.quantity || 0} units</div>
              </div>
              <div class="br-pill">${needsBranding ? 'Branding Required' : 'No Branding Needed'}</div>
            </div>
            ${brandRowHtml}
            <div class="br-meta-strip">
              <div class="br-meta-cell"><span class="k">Colour Lines</span><span class="v">${(it.colours || []).length}</span></div>
              <div class="br-meta-cell"><span class="k">Total Colour Qty</span><span class="v">${totalColourQty}</span></div>
            </div>
            <table class="br-table" style="width:100%;font-size:13px">
              <thead><tr>
                <th>Colour</th>
                <th>Code</th>
                <th style="text-align:center">Quantity</th>
              </tr></thead>
              <tbody>
                ${(it.colours || []).map((c) => `<tr>
                  <td>${c.colour_name}</td>
                  <td class="mono xs">${c.colour_code}</td>
                  <td style="text-align:center">${c.quantity}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`;
      });
      document.getElementById('branding-items-area').innerHTML = `
        <div class="br-summary">
          <div class="br-kpi"><div class="k">Items</div><div class="v">${items.length}</div></div>
          <div class="br-kpi"><div class="k">Branding Required</div><div class="v">${brandingRequiredCount}</div></div>
          <div class="br-kpi"><div class="k">Total Qty</div><div class="v">${totalItemQty}</div></div>
          <div class="br-kpi"><div class="k">Colour Lines</div><div class="v">${totalColourRows}</div></div>
        </div>
        ${allItemsHtml || '<div class="empty">No items</div>'}`;
      // Store for print function
      window._currentBrandingData = { header: h, items };

      // Show/hide dispatch vs receipt panel; inject Branding Agent dropdown for dispatch
      const dispatchBtn = document.getElementById('branding-dispatch-btn');
      const receiptCard = document.getElementById('branding-receipt-card');
      const bypassCard  = document.getElementById('branding-bypass-card');
      if (h.pipeline_status === 'PENDING_BRANDING') {
        if (dispatchBtn) dispatchBtn.style.display = '';
        if (receiptCard) receiptCard.style.display = 'none';
        if (bypassCard)  bypassCard.style.display  = 'none';

        // Inject Branding Agent selector before the instructions textarea
        const instrEl = document.getElementById('branding-instructions-input');
        if (instrEl && !document.getElementById('branding-agent-sel')) {
          const agentOpts = (_allBrandingAgents || [])
            .map((a) => `<option value="${a.agent_id}">${a.agent_name}${a.city ? ' · ' + a.city : ''}</option>`)
            .join('');
          const agentWrap = document.createElement('div');
          agentWrap.id = 'branding-agent-field';
          agentWrap.style.cssText = 'margin-bottom:12px';
          agentWrap.innerHTML = `
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Branding Agent <span class="req">*</span></label>
            <select id="branding-agent-sel" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg);color:var(--text)">
              <option value="">— Select Branding Agent —</option>
              ${agentOpts}
            </select>`;
          instrEl.parentNode.insertBefore(agentWrap, instrEl);
        }
      } else if (h.pipeline_status === 'BRANDING_DISPATCHED') {
        if (dispatchBtn) dispatchBtn.style.display = 'none';
        if (receiptCard) receiptCard.style.display = '';
        if (bypassCard)  bypassCard.style.display  = 'none';
        const dispDate = document.getElementById('branding-dispatched-date');
        if (dispDate) dispDate.textContent = fmtDateTime(h.dispatched_at);
        // Show assigned branding agent name
        const agentInfo = document.getElementById('branding-dispatched-agent');
        if (agentInfo) agentInfo.textContent = h.branding_agent_name || '—';
        ensureBrandingReceiptVerificationUI(headerId, items);
      }

    } catch (err) { console.error('openBrandingPage:', err); }
  }

  window.handleBrandingDispatch = async function() {
    const headerId = window._currentHeaderId;
    if (!headerId) return;
    const instructions = val('branding-instructions-input');

    // Validate Branding Agent selection
    const agentSel = document.getElementById('branding-agent-sel');
    const agentId  = agentSel ? (agentSel.value ? Number(agentSel.value) : null) : null;
    if (!agentId) {
      alert('Please select a Branding Agent before dispatching.');
      return;
    }

    // Collect brand + collection for items that require branding
    const itemBrands = [];
    const missingBrand = [];
    const missingColl = [];
    document.querySelectorAll('[id^="brand-sel-"][data-brand-locked="0"]').forEach((sel) => {
      if (sel.dataset.brandLocked === '1') return;
      const itemId = Number(sel.dataset.itemId);
      const collInp = document.getElementById(`coll-inp-${itemId}`);
      if (collInp && collInp.dataset.brandLocked === '1') return;
      const collVal = collInp ? collInp.value.trim() : '';
      if (sel.value) {
        if (!collVal) missingColl.push(itemId);
        else itemBrands.push({ item_id: itemId, home_brand_id: Number(sel.value), ew_collection: collVal });
      } else {
        missingBrand.push(itemId);
      }
    });

    if (missingBrand.length > 0) {
      alert(`Please select a Brand Name for all items that require branding (${missingBrand.length} item(s) missing).`);
      return;
    }
    if (missingColl.length > 0) {
      alert(`Please enter a Collection Name for all items that require branding (${missingColl.length} item(s) missing).`);
      return;
    }

    const btn = document.getElementById('branding-dispatch-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Dispatching…'; }
    try {
      await apiPut(`/api/purchases/${headerId}/branding-dispatch`, {
        branding_instructions: instructions || null,
        branding_agent_id:     agentId,
        item_brands:           itemBrands
      });
      await openBrandingPage(headerId);
      // Auto-pop Dispatch Order print after successful dispatch
      printBrandingDispatch();
    } catch (err) { alert(err.message); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Confirm Dispatch → DISPATCHED TO BRANDING'; } }
  };

  window.handleBrandingReceive = async function() {
    const headerId = window._currentHeaderId;
    if (!headerId) return;
    const verify = computeBrandingReceiptMismatches(headerId);
    renderBrandingReceiptSummary(headerId);
    if (verify.itemMismatches.length || verify.colourMismatches.length) {
      alert(`Cannot confirm receipt. Quantity mismatches found (Item: ${verify.itemMismatches.length}, Colour: ${verify.colourMismatches.length}).`);
      return;
    }
    const btn = document.getElementById('branding-receive-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Confirming…'; }
    try {
      await apiPut(`/api/purchases/${headerId}/branding-receive`, {});
      openDigitisationPage(headerId);
    } catch (err) { alert(err.message); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Confirm Receipt → Digitisation'; } }
  };

  function ensureBrandingReceiptDraft(headerId, items) {
    if (!headerId) return null;
    const key = String(headerId);
    let draft = window._brandingReceiptDraftByHeader[key];
    if (!draft) draft = { items: {}, colours: {} };
    (items || []).forEach((it, itemIdx) => {
      const itemId = Number(it.item_id || itemIdx + 1);
      const itemKey = String(itemId);
      const expectedItemQty = Number(it.quantity || 0);
      if (!draft.items[itemKey]) {
        draft.items[itemKey] = {
          item_id: itemId,
          label: it.style_model || `Item #${itemId}`,
          expected_qty: expectedItemQty,
          received_qty: expectedItemQty
        };
      }
      (it.colours || []).forEach((c, cIdx) => {
        const colourId = Number(c.colour_id || cIdx + 1);
        const colourKey = `${itemKey}:${colourId}`;
        const expectedColourQty = Number(c.quantity || 0);
        if (!draft.colours[colourKey]) {
          draft.colours[colourKey] = {
            item_id: itemId,
            colour_id: colourId,
            item_label: it.style_model || `Item #${itemId}`,
            colour_label: c.colour_name || `Colour #${colourId}`,
            expected_qty: expectedColourQty,
            received_qty: expectedColourQty
          };
        }
      });
    });
    window._brandingReceiptDraftByHeader[key] = draft;
    return draft;
  }

  function computeBrandingReceiptMismatches(headerId) {
    const draft = window._brandingReceiptDraftByHeader[String(headerId)] || { items: {}, colours: {} };
    const itemMismatches = Object.values(draft.items).filter((x) => Number(x.received_qty || 0) !== Number(x.expected_qty || 0));
    const colourMismatches = Object.values(draft.colours).filter((x) => Number(x.received_qty || 0) !== Number(x.expected_qty || 0));
    return { itemMismatches, colourMismatches };
  }

  function renderBrandingReceiptSummary(headerId) {
    const wrap = document.getElementById('branding-receipt-verify-summary');
    if (!wrap) return;
    const { itemMismatches, colourMismatches } = computeBrandingReceiptMismatches(headerId);
    const total = itemMismatches.length + colourMismatches.length;
    if (!total) {
      wrap.innerHTML = '<div class="branding-verify-summary-ok">All quantities matched. Confirm Receipt is enabled.</div>';
      return;
    }
    const itemList = itemMismatches.slice(0, 6).map((m) => `<li>Item ${_mcEsc(m.label || m.item_id)}: expected ${m.expected_qty}, received ${m.received_qty}</li>`).join('');
    const colourList = colourMismatches.slice(0, 6).map((m) => `<li>${_mcEsc(m.item_label || ('Item #' + m.item_id))} · ${_mcEsc(m.colour_label)}: expected ${m.expected_qty}, received ${m.received_qty}</li>`).join('');
    wrap.innerHTML = `
      <div class="branding-verify-summary-error">Mismatches found: ${total} (Items: ${itemMismatches.length}, Colours: ${colourMismatches.length})</div>
      <div class="branding-verify-summary-grid">
        <div class="branding-verify-summary-col">
          <div class="xs td2 branding-verify-summary-title">Item-level mismatches</div>
          <ul class="branding-verify-summary-list">${itemList || '<li class="td2">None</li>'}</ul>
        </div>
        <div class="branding-verify-summary-col">
          <div class="xs td2 branding-verify-summary-title">Colour-level mismatches</div>
          <ul class="branding-verify-summary-list">${colourList || '<li class="td2">None</li>'}</ul>
        </div>
      </div>`;
  }

  window.handleBrandingReceiptQtyInput = function(headerId, type, key, rawValue) {
    const draft = window._brandingReceiptDraftByHeader[String(headerId)];
    if (!draft) return;
    const valNum = Math.max(0, Number(rawValue || 0));
    if (type === 'item' && draft.items[key]) draft.items[key].received_qty = valNum;
    if (type === 'colour' && draft.colours[key]) draft.colours[key].received_qty = valNum;
    renderBrandingReceiptSummary(headerId);
  };

  function ensureBrandingReceiptVerificationUI(headerId, items) {
    const receiptCard = document.getElementById('branding-receipt-card');
    if (!receiptCard) return;
    const draft = ensureBrandingReceiptDraft(headerId, items);
    if (!draft) return;
    let host = document.getElementById('branding-receipt-verify-wrap');
    if (!host) {
      host = document.createElement('div');
      host.id = 'branding-receipt-verify-wrap';
      host.className = 'branding-verify-wrap';
      receiptCard.appendChild(host);
    }

    const itemRows = Object.entries(draft.items).map(([k, it]) => `
      <tr>
        <td>${_mcEsc(it.label)}</td>
        <td class="tc">${Number(it.expected_qty || 0)}</td>
        <td><input class="branding-verify-input" type="number" min="0" step="1" value="${Number(it.received_qty || 0)}" oninput="handleBrandingReceiptQtyInput(${headerId}, 'item', '${k}', this.value)"></td>
      </tr>`).join('');

    const colourRows = Object.entries(draft.colours).map(([k, c]) => `
      <tr>
        <td>${_mcEsc(c.item_label)}</td>
        <td>${_mcEsc(c.colour_label)}</td>
        <td class="tc">${Number(c.expected_qty || 0)}</td>
        <td><input class="branding-verify-input" type="number" min="0" step="1" value="${Number(c.received_qty || 0)}" oninput="handleBrandingReceiptQtyInput(${headerId}, 'colour', '${k}', this.value)"></td>
      </tr>`).join('');

    host.innerHTML = `
      <div class="branding-verify-title">Receipt Quantity Verification</div>
      <div class="branding-verify-subtitle">Confirm Receipt is blocked until item-wise and colour-wise received quantities match expected quantities.</div>
      <div id="branding-receipt-verify-summary" class="branding-verify-summary"></div>
      <div class="branding-verify-grid">
        <div class="tw branding-verify-table-wrap">
          <table class="branding-verify-table">
            <thead><tr><th>Item</th><th class="tc">Expected Qty</th><th>Received Qty</th></tr></thead>
            <tbody>${itemRows || '<tr><td colspan="3" class="tc td2 p12">No items</td></tr>'}</tbody>
          </table>
        </div>
        <div class="tw branding-verify-table-wrap">
          <table class="branding-verify-table">
            <thead><tr><th>Item</th><th>Colour</th><th class="tc">Expected Qty</th><th>Received Qty</th></tr></thead>
            <tbody>${colourRows || '<tr><td colspan="4" class="tc td2 p12">No colours</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
    renderBrandingReceiptSummary(headerId);
  }

  window.showBrandingBypassModal = function() {
    const bypassCard = document.getElementById('branding-bypass-card');
    if (bypassCard) bypassCard.style.display = bypassCard.style.display === 'none' ? '' : 'none';
  };

  window.handleBrandingBypass = async function() {
    const headerId = window._currentHeaderId;
    const reason   = val('bypass-reason-input');
    if (!reason) return alert('Bypass reason is required.');
    try {
      await apiPut(`/api/purchases/${headerId}/branding-bypass`, { bypass_reason: reason });
      openDigitisationPage(headerId);
    } catch (err) { alert(err.message); }
  };

  window.printBrandingDispatch = function() {
    const headerId = window._currentHeaderId;
    if (!headerId) return;
    const bd    = window._currentBrandingData || {};
    const h     = bd.header || {};
    const items = bd.items  || [];
    const instrEl = document.getElementById('branding-instructions-input');
    const instr   = instrEl ? instrEl.value : '';

    // Build brand-wise totals — group by home brand_name
    const brandMap = {};
    let grandTotalQty = 0;
    items.forEach((it) => {
      const brandKey = it.brand_name || it.source_brand || 'Unbranded';
      if (!brandMap[brandKey]) brandMap[brandKey] = { qty: 0, collections: new Set(), styles: [] };
      brandMap[brandKey].qty += (it.quantity || 0);
      if (it.ew_collection) brandMap[brandKey].collections.add(it.ew_collection);
      brandMap[brandKey].styles.push(it);
      grandTotalQty += (it.quantity || 0);
    });

    // Build items table rows — includes Brand column
    let itemRowsHtml = '';
    items.forEach((it) => {
      const colours = (it.colours || []);
      const brandDisplay = it.brand_name || it.source_brand || '—';
      const colourRows = colours.map((c) => `
        <tr>
          <td style="padding:6px 10px">${brandDisplay}</td>
          <td style="padding:6px 10px">${it.ew_collection || '—'}</td>
          <td style="padding:6px 10px">${it.style_model || '—'}</td>
          <td style="padding:6px 10px">${c.colour_name}</td>
          <td class="mono" style="padding:6px 10px">${c.colour_code}</td>
          <td style="padding:6px 10px;text-align:center">${c.quantity}</td>
        </tr>`).join('');
      const itemSubtotal = colours.reduce((s, c) => s + (c.quantity || 0), 0);
      itemRowsHtml += colourRows;
      itemRowsHtml += `
        <tr style="background:#f5f5f5;font-weight:600">
          <td colspan="5" style="padding:5px 10px;font-size:12px">Sub-total — ${brandDisplay} · ${it.ew_collection || ''} · ${it.style_model || ''}</td>
          <td style="padding:5px 10px;text-align:center">${itemSubtotal}</td>
        </tr>`;
    });

    // Brand-wise summary rows — group by home brand
    let brandSummaryRows = Object.entries(brandMap).map(([brand, info]) => `
      <tr>
        <td style="padding:7px 12px;font-weight:700">${brand}</td>
        <td style="padding:7px 12px">${[...info.collections].join(', ') || '—'}</td>
        <td style="padding:7px 12px">${info.styles.map((s) => s.style_model).join(', ')}</td>
        <td style="padding:7px 12px;text-align:center;font-weight:700">${info.qty}</td>
      </tr>`).join('');

    const today = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' });

    openPrintWindow(`Branding Dispatch Order — Purchase #${h.header_id}`, `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
        <div>
          <h2 style="margin:0 0 4px">Branding Dispatch Order</h2>
          <div style="font-size:12px;color:#666">Generated: ${today}</div>
        </div>
        <div style="text-align:right;font-size:13px">
          <div><strong>Purchase #${h.header_id}</strong></div>
          <div>Supplier: ${h.supplier_name || '—'}</div>
          <div>Challan No.: ${h.challan_number || h.bill_ref || '—'}</div>
          <div>Challan date: ${h.challan_date ? fmtDate(h.challan_date) : '—'}</div>
          <div>Purchase Date: ${fmtDate(h.purchase_date)}</div>
        </div>
      </div>

      <h3 style="border-bottom:2px solid #333;padding-bottom:6px">Product &amp; Colour-wise Quantities</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
        <thead>
          <tr style="background:#222;color:#fff">
            <th style="padding:8px 10px;text-align:left">Brand</th>
            <th style="padding:8px 10px;text-align:left">Collection</th>
            <th style="padding:8px 10px;text-align:left">Style / Model</th>
            <th style="padding:8px 10px;text-align:left">Colour</th>
            <th style="padding:8px 10px;text-align:left">Code</th>
            <th style="padding:8px 10px;text-align:center">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${itemRowsHtml}
          <tr style="background:#111;color:#fff;font-size:14px;font-weight:700">
            <td colspan="5" style="padding:8px 10px">GRAND TOTAL QTY</td>
            <td style="padding:8px 10px;text-align:center">${grandTotalQty}</td>
          </tr>
        </tbody>
      </table>

      <h3 style="border-bottom:2px solid #333;padding-bottom:6px">Brand-wise Summary</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
        <thead>
          <tr style="background:#444;color:#fff">
            <th style="padding:8px 12px;text-align:left">Brand</th>
            <th style="padding:8px 12px;text-align:left">Collections</th>
            <th style="padding:8px 12px;text-align:left">Styles</th>
            <th style="padding:8px 12px;text-align:center">Total Qty</th>
          </tr>
        </thead>
        <tbody>
          ${brandSummaryRows}
          <tr style="background:#111;color:#fff;font-weight:700">
            <td colspan="3" style="padding:8px 12px">TOTAL</td>
            <td style="padding:8px 12px;text-align:center">${grandTotalQty}</td>
          </tr>
        </tbody>
      </table>

      ${instr ? `<h3>Special Instructions</h3><p style="border:1px solid #ccc;padding:10px;border-radius:4px">${instr}</p>` : ''}

      <div style="margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:24px;font-size:13px">
        <div>
          <p style="margin-bottom:4px"><strong>Dispatched By:</strong></p>
          <p>Name: _______________________</p>
          <p>Date: _______________________</p>
          <p>Signature: __________________</p>
        </div>
        <div>
          <p style="margin-bottom:4px"><strong>Received By (Branding Unit):</strong></p>
          <p>Name: _______________________</p>
          <p>Date: _______________________</p>
          <p>Signature: __________________</p>
        </div>
      </div>`);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DIGITISATION PAGE
  // ─────────────────────────────────────────────────────────────────────────
  window.openDigitisationPage = async function openDigitisationPage(headerId) {
    window._currentHeaderId = headerId;
    nav('digitisation', document.querySelector('.nav-item[onclick*="nav(\'digitisation\'"]'), true);
    showDigiDetail();
    const container  = document.getElementById('digi-items-container');
    const summaryBar = document.getElementById('digi-summary-bar');
    if (container)  container.innerHTML  = '<div class="empty"><div class="empty-ic">⏳</div><div>Loading…</div></div>';
    if (summaryBar) summaryBar.innerHTML = '<span class="xs td2">Loading…</span>';

    try {
      const [purchData, skuData] = await Promise.all([
        apiGet(`/api/purchases/${headerId}`),
        apiGet(`/api/purchases/${headerId}/skus`)
      ]);
      const h     = purchData.header;
      const items = purchData.items || [];
      const skus  = skuData || [];

      // Summary bar
      const totalColours = items.reduce((s, it) => s + (it.colours || []).length, 0);
      const doneColours  = skus.length;
      const pendingColours = Math.max(totalColours - doneColours, 0);
      const readyPct = totalColours ? Math.round((doneColours / totalColours) * 100) : 0;
      if (summaryBar) {
        summaryBar.innerHTML = `
          <div><div class="xs td2">Purchase</div><div class="fw6">#${h.header_id}</div></div>
          <div><div class="xs td2">Supplier</div><div class="fw6">${h.supplier_name || '—'}</div></div>
          <div><div class="xs td2">Challan No.</div><div class="fw6 mono">${h.challan_number || h.bill_ref || '—'}</div></div>
          <div><div class="xs td2">Challan date</div><div class="fw6">${h.challan_date ? fmtDate(h.challan_date) : '—'}</div></div>
          <div><div class="xs td2">Items</div><div class="fw6">${items.length}</div></div>
          <div><div class="xs td2">SKUs Generated</div><div class="fw6" style="color:${doneColours===totalColours?'var(--green)':'var(--gold)'}">${doneColours} / ${totalColours}</div></div>
          <div><div class="xs td2">Pending Colours</div><div class="fw6" style="color:${pendingColours ? 'var(--red)' : 'var(--green)'}">${pendingColours}</div></div>
          <div><div class="xs td2">Ready %</div><div class="fw6" style="color:${readyPct === 100 ? 'var(--green)' : 'var(--acc2)'}">${readyPct}%</div></div>`;
      }

      // Progress label
      const progLabel = document.getElementById('digi-progress-label');
      if (progLabel) progLabel.textContent = `${doneColours} / ${totalColours} SKUs generated`;

      // Sub-step
      const pstepSub = document.getElementById('digi-pstep-sub');
      if (pstepSub) pstepSub.textContent = `${doneColours} of ${totalColours} SKUs done`;

      // Build item sections with colour tabs + top-level item selector
      if (!container) return;
      container.innerHTML = '';
      if (items.length > 1) {
        const itemTabs = items.map((item, idx) => {
          const label = `${item.ew_collection || 'Item'} · ${item.style_model || `#${idx + 1}`}`;
          return `<div class="tab${idx === 0 ? ' active' : ''}" data-item-tab="${item.item_id}" onclick="switchDigiItemTab(this, ${item.item_id})">${label}</div>`;
        }).join('');
        const tabsWrap = document.createElement('div');
        tabsWrap.className = 'card mb4';
        tabsWrap.innerHTML = `
          <div class="section-lbl mb2">Items</div>
          <div class="tabs" id="digi-item-tabs">${itemTabs}</div>`;
        container.appendChild(tabsWrap);
      }

      items.forEach((item, itemIdx) => {
        const colours = item.colours || [];
        const doneInItem = colours.reduce((acc, c) => acc + (skus.some((sk) => sk.item_colour_id === c.colour_id) ? 1 : 0), 0);
        const pendingInItem = Math.max(colours.length - doneInItem, 0);
        const section = document.createElement('div');
        section.className = 'card mb4';
        section.id = `digi-item-section-${item.item_id}`;
        if (itemIdx !== 0) section.style.display = 'none';
        section.dataset.pending = String(pendingInItem);
        section.dataset.done = String(doneInItem);
        section.dataset.search = `${item.ew_collection || ''} ${item.style_model || ''} ${item.brand_name || item.source_brand || ''}`.toLowerCase();

        let tabsHtml = '';
        let panelsHtml = '';

        colours.forEach((col, colIdx) => {
          const existingSku = skus.find((sk) => sk.item_colour_id === col.colour_id);
          // Locked restock UI only when a colour is tied to an existing LIVE SKU — must match API
          // purchases.js:isRestock = Boolean(getRestockContext()?.linked_sku_id). Items with home_brand
          // alone can still need a NEW colour variant → editable MRP until a link exists.
          const isRestockLinked = Boolean(col.linked_sku_id);
          const isRestockDone = Boolean(existingSku && (existingSku.is_restock || existingSku.stock_action === 'RESTOCK_EXISTING'));
          const isRestock = isRestockLinked || isRestockDone;
          const isDone = !!existingSku;
          const tabId  = `digi-panel-${item.item_id}-${col.colour_id}`;
          const imgId  = `clr-img-${item.item_id}-${col.colour_id}`;

          // Colour-level media — prefer SKU level, fall back to colour record
          const colourImgUrl = col.image_url || (existingSku && existingSku.image_url) || null;
          const colourVidUrl = col.video_url || (existingSku && existingSku.video_url) || null;
          const mediaThumbs = [];
          if (colourImgUrl) {
            mediaThumbs.push(`<div class="digi-media-thumb">
              <img src="${colourImgUrl}" alt="${col.colour_name}"
                onerror="this.parentElement.innerHTML='<span class=\\'xs td2\\'>Image failed</span>'">
            </div>`);
          }
          if (colourVidUrl) {
            mediaThumbs.push(`<div class="digi-media-thumb"><video src="${colourVidUrl}" controls></video></div>`);
          }
          const currentMedia = mediaThumbs.length
            ? mediaThumbs.join('')
            : `<div class="digi-media-thumb"><span class="xs td2">No media yet</span></div>`;

          tabsHtml += `<div class="tab${colIdx === 0 ? ' active' : ''}" data-digi-status="${isDone ? 'done' : 'pending'}" onclick="switchDigiTab(this, '${tabId}')">
            ${col.colour_name} ${isDone ? `<span class="b ${isRestockDone ? 'b-blue' : 'b-green'} xs">${isRestockDone ? 'Restock' : 'Done'}</span>` : '<span class="b b-gold xs">Pending</span>'}
          </div>`;

          panelsHtml += `<div id="${tabId}" ${colIdx !== 0 ? 'style="display:none"' : ''}>
            <div class="two-col mt2">
              <div class="col-stack">
                <div class="card">
                  <div class="ch"><div class="ct">SKU Details</div></div>
                  <div class="cb">
                    ${isDone && isRestockDone ? `
                      <div class="digi-restock-card">
                        <div class="digi-restock-title">Reused from existing SKU</div>
                        <div class="digi-restock-meta">
                          <div><span class="digi-restock-lbl">SKU</span><strong class="mono">${_mcEsc((existingSku && existingSku.sku_code) || col.linked_sku_code || '—')}</strong></div>
                          <div><span class="digi-restock-lbl">Barcode</span><strong class="mono">${_mcEsc((existingSku && existingSku.barcode) || col.linked_barcode || '—')}</strong></div>
                          <div><span class="digi-restock-lbl">Sale Price</span><strong>${inrD(Number((existingSku && existingSku.sale_price) || col.linked_sale_price || 0))}</strong></div>
                          <div><span class="digi-restock-lbl">Purchase Entry</span><strong class="mono">${_mcEsc(existingSku.purchase_event_id || '—')}</strong></div>
                        </div>
                      </div>` : isDone ? `
                      <div class="alert alert-blue" style="margin-bottom:0"><span>✅</span>
                        <div>SKU Generated: <strong class="mono">${existingSku.sku_code}</strong><br>
                        Barcode: <span class="mono">${existingSku.barcode}</span><br>
                        Sale Price: ${inrD(existingSku.sale_price)}</div>
                    </div>` : isRestock ? `
                      <div class="digi-restock-note" style="margin-bottom:10px">
                        Existing item detected. Selling price is inherited from linked SKU and cannot be changed here.
                        Use SKU Catalogue to update sale price; history is tracked there.
                      </div>
                      <div class="fg2">
                        <div class="fgrp"><label>Colour</label><input value="${col.colour_name}" readonly style="background:var(--bg)"></div>
                        <div class="fgrp"><label>Quantity</label><input value="${col.quantity}" readonly style="background:var(--bg)"></div>
                        <div class="fgrp"><label>Linked SKU</label><input value="${col.linked_sku_code || '—'}" readonly style="background:var(--bg)"></div>
                        <div class="fgrp"><label>Current Sale Price</label><input value="${inrD(Number(col.linked_sale_price || 0))}" readonly style="background:var(--bg)"></div>
                      </div>
                      <button class="btn primary w100 mt2" onclick="handleGenerateSKU(${headerId},${item.item_id},${col.colour_id}, true)">
                        Generate Purchase Entry for ${col.colour_name}
                      </button>` : `
                      <div class="fg2">
                        <div class="fgrp"><label>Colour</label><input value="${col.colour_name}" readonly style="background:var(--bg)"></div>
                        <div class="fgrp"><label>Quantity</label><input value="${col.quantity}" readonly style="background:var(--bg)"></div>
                        <div class="fgrp"><label>Sale Price (MRP) ₹ <span class="req">*</span></label>
                          <input type="number" id="sale-price-${item.item_id}-${col.colour_id}" placeholder="e.g. 1490" min="1"></div>
                      </div>
                      <button class="btn primary w100 mt2" onclick="handleGenerateSKU(${headerId},${item.item_id},${col.colour_id})">
                        Generate SKU for ${col.colour_name}
                      </button>`}
                  </div>
                </div>
              </div>
              <div class="col-stack">
                <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px">
                  <div class="section-lbl mb3">${col.colour_name} — Media</div>
                  <div class="digi-media-grid">
                    ${isRestock ? `
                    <div class="digi-upload-tile digi-upload-tile-locked">
                      Locked for restock<br>Using existing SKU media
                    </div>` : `<div class="digi-upload-tile" onclick="document.getElementById('${imgId}-file').click()">
                      Click to upload<br>or drag and drop
                    </div>`}
                    <div>
                      <div id="${imgId}-current" class="digi-media-strip">${currentMedia}</div>
                      <div id="${imgId}-preview" class="digi-media-strip" style="display:none"></div>
                      ${isRestock ? `<div class="xs td2">Media editing is locked for linked restock SKUs.</div>` : `<div class="digi-media-actions">
                        <button type="button" class="btn sm" onclick="document.getElementById('${imgId}-file').click()">Replace</button>
                        <button type="button" class="btn sm" onclick="clearColourMediaSelection('${imgId}')">Remove</button>
                      </div>`}
                    </div>
                  </div>
                  ${isRestock ? `<div id="${imgId}-lock" class="digi-restock-lock-flag" style="display:none"></div>` : ''}
                  <input type="file" id="${imgId}-file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,video/avi,video/x-matroska"
                    style="display:none" onchange="handleColourMediaPreview('${imgId}')" ${isRestock ? 'disabled' : ''}>
                  <div class="xs td2 mt1 mb2">Upload one file (Photo max 5 MB or Video max 100 MB)</div>
                  <div id="${imgId}-msg" style="display:none;font-size:12px;margin-bottom:6px"></div>
                  ${isRestock
                    ? '<button class="btn sm" disabled>Media Locked for Restock</button>'
                    : `<button id="${imgId}-save-btn" class="btn sm" onclick="handleSaveColourMedia(${headerId},${col.colour_id},'${imgId}')">💾 Save Media</button>`}
                </div>
              </div>
            </div>
          </div>`;
        });

        // Product details section (per item — text specs only; photos are per colour tab above)
        const pdId = `pd-${item.item_id}`;
        const isItemRestockLocked = colours.some((c) => {
          const sku = skus.find((sk) => sk.item_colour_id === c.colour_id);
          return Boolean((sku && (sku.is_restock || sku.stock_action === 'RESTOCK_EXISTING')) || c.linked_sku_id);
        });
        const pdReadOnlyAttr = isItemRestockLocked ? 'readonly' : '';
        const productDetailsHtml = `
          <div style="border-top:1.5px solid var(--border);padding-top:16px;margin-top:8px">
            <div class="section-lbl mb3">Product Details for Catalogue
              <span class="xs td2" style="font-weight:400;margin-left:8px">(shared specs — saved to product master)</span>
            </div>
            ${isItemRestockLocked ? `<div id="${pdId}-lock" class="digi-restock-note">Restock linked item: product details are locked and reused from the existing SKU connection.</div>` : ''}
            <div class="fg3 mb3">
              <div class="fgrp" style="grid-column:1/-1">
                <label>Product Description</label>
                <textarea id="${pdId}-desc" rows="2" placeholder="e.g. Premium metal frame eyeglasses with spring hinges and UV400 lenses" ${pdReadOnlyAttr}>${item.description || ''}</textarea>
              </div>
              <div class="fgrp">
                <label>Frame Material</label>
                <input id="${pdId}-material" placeholder="e.g. Stainless Steel, Titanium, Acetate" value="${item.frame_material || ''}" ${pdReadOnlyAttr}>
              </div>
              <div class="fgrp">
                <label>Frame Width (mm)</label>
                <input type="number" id="${pdId}-width" placeholder="e.g. 135" step="0.1" value="${item.frame_width || ''}" ${pdReadOnlyAttr}>
              </div>
              <div class="fgrp">
                <label>Lens Height (mm)</label>
                <input type="number" id="${pdId}-height" placeholder="e.g. 42" step="0.1" value="${item.lens_height || ''}" ${pdReadOnlyAttr}>
              </div>
              <div class="fgrp">
                <label>Temple Length (mm)</label>
                <input type="number" id="${pdId}-temple" placeholder="e.g. 145" step="0.1" value="${item.temple_length || ''}" ${pdReadOnlyAttr}>
              </div>
            </div>
            <div id="${pdId}-msg" style="display:none;font-size:12.5px;margin-bottom:8px"></div>
            ${isItemRestockLocked
              ? '<button class="btn sm mt2" disabled>Product Specs Locked for Restock</button>'
              : `<button class="btn sm mt2" onclick="handleSaveProductDetails(${headerId}, ${item.item_id}, ${item.product_master_id}, '${pdId}')">💾 Save Product Specs</button>`}
          </div>`;

        section.innerHTML = `
          <div class="ch"><div class="ct">${item.ew_collection || ''} · ${item.style_model || ''}</div>
            <span class="xs td2">${item.quantity} units · ${doneInItem}/${colours.length} done${pendingInItem ? ` · ${pendingInItem} pending` : ''}</span>
          </div>
          <div class="cb">
            <div class="tabs">${tabsHtml}</div>
            ${panelsHtml}
            ${productDetailsHtml}
          </div>`;
        container.appendChild(section);
      });

      // Publish button state
      const pubBtn = document.getElementById('publish-all-btn');
      if (pubBtn) {
        pubBtn.disabled = doneColours < totalColours;
        if (doneColours < totalColours) {
          pubBtn.title = 'Generate all SKUs first';
          pubBtn.style.opacity = '0.5';
        } else {
          pubBtn.style.opacity = '1';
          pubBtn.title = '';
        }
      }

    } catch (err) { if (container) container.innerHTML = `<div class="empty" style="color:var(--red)">${err.message}</div>`; }
  }

  window.switchDigiTab = function(el, panelId) {
    const section = el.closest('.card');
    if (!section) return;
    section.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    section.querySelectorAll('[id^="digi-panel-"]').forEach((p) => { p.style.display = 'none'; });
    el.classList.add('active');
    const panel = document.getElementById(panelId);
    if (panel) panel.style.display = '';
  };

  // Top-level item selector for Digitisation (same UX intent as colour tabs)
  window.switchDigiItemTab = function(el, itemId) {
    const tabsWrap = document.getElementById('digi-item-tabs');
    if (tabsWrap) tabsWrap.querySelectorAll('[data-item-tab]').forEach((t) => t.classList.remove('active'));
    if (el) el.classList.add('active');
    document.querySelectorAll('[id^="digi-item-section-"]').forEach((sec) => {
      sec.style.display = sec.id === `digi-item-section-${itemId}` ? '' : 'none';
    });
  };

  window.handleGenerateSKU = async function(headerId, itemId, colourId) {
    const priceEl = document.getElementById(`sale-price-${itemId}-${colourId}`);
    const isRestockTrigger = !priceEl;
    const price = isRestockTrigger ? null : parseFloat(priceEl.value);
    if (!isRestockTrigger && (!price || price <= 0)) return alert('Enter a valid Sale Price.');
    const btn = document.querySelector(`button[onclick*="handleGenerateSKU(${headerId},${itemId},${colourId}"]`);
    if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
    try {
      const response = await apiPost(`/api/purchases/${headerId}/generate-sku`, {
        item_id: itemId, item_colour_id: colourId, sale_price: price
      });
      if (isRestockTrigger) {
        const eventId = response && response.purchase_event_id
          ? response.purchase_event_id
          : response && response.data && response.data.purchase_event_id;
        if (eventId) {
          alert(`Restock purchase entry generated: ${eventId}`);
        }
      }
      await openDigitisationPage(headerId);
    } catch (err) { alert(err.message); }
    finally {
      if (btn) { btn.disabled = false; btn.textContent = isRestockTrigger ? `Generate Purchase Entry` : 'Generate SKU'; }
    }
  };

  // Show local preview when a file is selected
  window.handleProductImagePreview = function(pdId) {
    const fileEl = document.getElementById(`${pdId}-img-file`);
    const previewEl = document.getElementById(`${pdId}-img-preview`);
    const msgEl = document.getElementById(`${pdId}-img-msg`);
    if (!fileEl || !fileEl.files[0]) return;
    const file = fileEl.files[0];
    if (file.size > 5 * 1024 * 1024) {
      if (msgEl) { msgEl.textContent = '⚠️ File exceeds 5 MB limit.'; msgEl.style.color = 'var(--red)'; msgEl.style.display = ''; }
      fileEl.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (previewEl) {
        previewEl.innerHTML = `<img src="${e.target.result}" style="max-width:160px;max-height:120px;border-radius:8px;border:1px solid var(--border);object-fit:cover"><div class="xs td2 mt1" style="color:var(--gold)">⬆ Ready to upload — click Save</div>`;
        previewEl.style.display = '';
      }
      if (msgEl) msgEl.style.display = 'none';
    };
    reader.readAsDataURL(file);
  };

  window.handleSaveProductDetails = async function(headerId, itemId, productMasterId, pdId) {
    const getV  = (sfx) => { const el = document.getElementById(`${pdId}-${sfx}`); return el ? el.value.trim() || null : null; };
    const toN   = (sfx) => { const v = parseFloat(document.getElementById(`${pdId}-${sfx}`)?.value); return isNaN(v) ? null : v; };
    const msgEl = document.getElementById(`${pdId}-msg`);
    if (document.getElementById(`${pdId}-lock`)) {
      if (msgEl) {
        msgEl.textContent = 'Restock linked item: product details are locked.';
        msgEl.style.color = 'var(--text2)';
        msgEl.style.display = '';
      }
      return;
    }
    const btn   = document.querySelector(`button[onclick*="handleSaveProductDetails(${itemId}"]`);
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      // Save product spec details (no image — images are per colour tab)
      await apiPut(`/api/products/${productMasterId}/details`, {
        description:    getV('desc'),
        frame_material: getV('material'),
        frame_width:    toN('width'),
        lens_height:    toN('height'),
        temple_length:  toN('temple'),
        header_id:      headerId,
        item_id:        itemId
      });

      if (msgEl) {
        msgEl.textContent = '✅ Product details saved successfully.';
        msgEl.style.color = 'var(--green)';
        msgEl.style.display = '';
        setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
      }
    } catch (err) {
      if (msgEl) { msgEl.textContent = '❌ ' + err.message; msgEl.style.color = 'var(--red)'; msgEl.style.display = ''; }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 Save Product Specs'; }
    }
  };

  // Unified preview handler for per-colour media selection (image or video)
  window.handleColourMediaPreview = function(imgId) {
    const fileEl    = document.getElementById(`${imgId}-file`);
    const previewEl = document.getElementById(`${imgId}-preview`);
    const msgEl     = document.getElementById(`${imgId}-msg`);
    if (!fileEl || !fileEl.files[0]) return;
    const file = fileEl.files[0];
    const isVideo = file.type.startsWith('video/');
    if (!isVideo && !file.type.startsWith('image/')) {
      if (msgEl) { msgEl.textContent = '⚠️ Unsupported file type.'; msgEl.style.color = 'var(--red)'; msgEl.style.display = ''; }
      fileEl.value = '';
      return;
    }
    const maxBytes = isVideo ? (100 * 1024 * 1024) : (5 * 1024 * 1024);
    if (file.size > maxBytes) {
      if (msgEl) { msgEl.textContent = `⚠️ File exceeds ${isVideo ? '100 MB' : '5 MB'} limit.`; msgEl.style.color = 'var(--red)'; msgEl.style.display = ''; }
      fileEl.value = '';
      return;
    }
    if (isVideo) {
      const objectUrl = URL.createObjectURL(file);
      if (previewEl) {
        previewEl.innerHTML = `<div class="digi-media-thumb"><video src="${objectUrl}" controls style="width:100%;height:100%;object-fit:cover"></video></div>
          <div class="xs td2" style="color:var(--gold)">⬆ Ready — click Save Media</div>`;
        previewEl.style.display = '';
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (previewEl) {
          previewEl.innerHTML = `<div class="digi-media-thumb"><img src="${e.target.result}" style="object-fit:cover"></div>
            <div class="xs td2" style="color:var(--gold)">⬆ Ready — click Save Media</div>`;
          previewEl.style.display = '';
        }
      };
      reader.readAsDataURL(file);
    }
    if (msgEl) msgEl.style.display = 'none';
  };

  // Backward-compatible wrappers
  window.handleColourImagePreview = function(imgId) { window.handleColourMediaPreview(imgId); };
  window.handleColourVideoPreview = function(imgId) { window.handleColourMediaPreview(imgId); };

  window.clearColourMediaSelection = function(imgId) {
    const fileEl = document.getElementById(`${imgId}-file`);
    const previewEl = document.getElementById(`${imgId}-preview`);
    const msgEl = document.getElementById(`${imgId}-msg`);
    if (fileEl) fileEl.value = '';
    if (previewEl) { previewEl.innerHTML = ''; previewEl.style.display = 'none'; }
    if (msgEl) { msgEl.textContent = 'Selection removed.'; msgEl.style.color = 'var(--text3)'; msgEl.style.display = ''; }
  };

  // Unified upload + persist for selected media per colour variant
  window.handleSaveColourMedia = async function(headerId, colourId, imgId, mediaType) {
    if (document.getElementById(`${imgId}-lock`)) {
      const lockMsgEl = document.getElementById(`${imgId}-msg`);
      if (lockMsgEl) {
        lockMsgEl.textContent = 'Restock linked SKU: media editing is locked.';
        lockMsgEl.style.color = 'var(--text2)';
        lockMsgEl.style.display = '';
      }
      return;
    }
    const fileEl = document.getElementById(`${imgId}-file`);
    const selected = fileEl && fileEl.files && fileEl.files[0] ? fileEl.files[0] : null;
    const inferredVideo = selected ? selected.type.startsWith('video/') : false;
    const isVideo = typeof mediaType === 'string' ? mediaType === 'video' : inferredVideo;
    const fileKey = `${imgId}-file`;
    const msgKey  = `${imgId}-msg`;
    const prevKey = `${imgId}-preview`;
    const currKey = `${imgId}-current`;
    const uploadEp  = isVideo ? '/api/uploads/product-video' : '/api/uploads/product-image';
    const fieldName = isVideo ? 'video' : 'image';
    const btnLabel  = '💾 Save Media';
    const sizeLabel = isVideo ? '100 MB' : '5 MB';

    const msgEl  = document.getElementById(msgKey);
    const btn    = document.getElementById(`${imgId}-save-btn`) || document.querySelector(`button[onclick*="handleSaveColourMedia(${headerId},${colourId},'${imgId}'"]`);

    if (!fileEl || !fileEl.files[0]) {
      if (msgEl) { msgEl.textContent = '⚠️ Please choose a media file first.'; msgEl.style.color = 'var(--gold)'; msgEl.style.display = ''; }
      return;
    }
    if (fileEl.files[0].size > (isVideo ? 100 : 5) * 1024 * 1024) {
      if (msgEl) { msgEl.textContent = `⚠️ File exceeds ${sizeLabel} limit.`; msgEl.style.color = 'var(--red)'; msgEl.style.display = ''; }
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }
    if (msgEl) { msgEl.textContent = '⬆ Uploading…'; msgEl.style.color = 'var(--text2)'; msgEl.style.display = ''; }

    try {
      // 1. Upload file to server
      const formData = new FormData();
      formData.append(fieldName, fileEl.files[0]);
      const uploadRes  = await fetch(uploadEp, { method: 'POST', headers: authHeaders(), body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.success) throw new Error(uploadData.message || 'Upload failed');
      const mediaUrl = uploadData.data.url;

      // 2. Persist URL to DB via colour media endpoint
      const payload = isVideo ? { video_url: mediaUrl } : { image_url: mediaUrl };
      await apiPut(`/api/purchases/${headerId}/colours/${colourId}/media`, payload);

      // 3. Clear local selected preview
      const previewEl = document.getElementById(prevKey);
      if (previewEl) previewEl.style.display = 'none';
      fileEl.value = '';

      if (msgEl) { msgEl.textContent = `✅ ${isVideo ? 'Video' : 'Photo'} saved! Refreshing…`; msgEl.style.color = 'var(--green)'; msgEl.style.display = ''; }
      await openDigitisationPage(headerId);
    } catch (err) {
      if (msgEl) { msgEl.textContent = '❌ ' + err.message; msgEl.style.color = 'var(--red)'; msgEl.style.display = ''; }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = btnLabel; }
    }
  };

  window.handleWarehouseReady = async function(headerId) {
    if (!confirm('Publish all SKUs to warehouse? This will make them LIVE.')) return;
    const btn = document.getElementById('publish-all-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Publishing…'; }
    try {
      await apiPut(`/api/purchases/${headerId}/warehouse-ready`, {});
      const skus = await apiGet(`/api/purchases/${headerId}/skus`);
      window.openBarcodeModal(skus, { defaultType: 'QR' });
      loadPurchases();
      nav('purchases', document.querySelector('.nav-item[onclick*="nav(\'purchases\'"]'));
    } catch (err) { alert(err.message); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Publish All to Warehouse ✓'; } }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PDF PRINT HELPER
  // ─────────────────────────────────────────────────────────────────────────
  function openPrintWindow(title, bodyHtml) {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return alert('Please allow popups to print.');
    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 13px; color: #111; margin: 30px; }
        h2 { font-size: 18px; margin-bottom: 8px; }
        h3 { font-size: 14px; margin-top: 16px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; font-size: 12px; }
        th { background: #f5f5f5; font-weight: 600; }
        .meta-grid { display: flex; gap: 24px; margin-bottom: 16px; }
        .meta-grid > div { flex: 1; }
        .xs { font-size: 11px; color: #666; }
        .fw6 { font-weight: 600; }
        .mono { font-family: monospace; }
        @media print { body { margin: 0; } }
      </style></head>
      <body>
        <div style="display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:16px">
          <div><strong>EYEWOOT</strong> — Cosmos ERP<br><span class="xs">Foundry Module — Procurement Pipeline</span></div>
          <div style="text-align:right;font-size:11px">Printed: ${fmtDateTime(new Date())}</div>
        </div>
        ${bodyHtml}
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 600);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODAL HELPERS (override Foundry_Prototype.html globals — class `open`, not inline display)
  // Inline display:none would beat `.overlay.open { display:flex }` and block reopening.
  // ─────────────────────────────────────────────────────────────────────────
  window.openM = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.removeProperty('display');
    el.classList.add('open');
  };
  let _submitChallanHeaderId = null;
  let _submitChallanTriggerBtn = null;

  function ensureSubmitChallanDatePicker() {
    const el = document.getElementById('submit-challan-date-input');
    if (!el || el._flatpickr || typeof flatpickr === 'undefined') return;
    flatpickr(el, {
      dateFormat: 'd/m/Y',
      allowInput: false,
      disableMobile: true,
      onChange(selectedDates) {
        const iso = selectedDates[0]
          ? selectedDates[0].toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
          : '';
        let hidden = el.parentElement.querySelector('input[type=hidden][data-fp]');
        if (!hidden) {
          hidden = document.createElement('input');
          hidden.type = 'hidden';
          hidden.dataset.fp = '1';
          hidden.id = el.id + '_iso';
          el.parentElement.appendChild(hidden);
        }
        hidden.value = iso;
      }
    });
  }

  window.openSubmitChallanModal = async function openSubmitChallanModal(headerId, triggerBtn) {
    _submitChallanHeaderId = Number(headerId);
    _submitChallanTriggerBtn = triggerBtn || null;
    showErr('submit-challan-error', '');
    const numEl = document.getElementById('submit-challan-number');
    const dateEl = document.getElementById('submit-challan-date-input');
    if (numEl) {
      numEl.value = '';
      if (typeof cosmosFieldClear === 'function') cosmosFieldClear(numEl);
    }
    if (dateEl) {
      if (typeof cosmosFieldClear === 'function') cosmosFieldClear(dateEl);
    }
    const hint = document.getElementById('submit-challan-hint');
    if (hint) hint.textContent = 'Enter the supplier challan details to release this draft to ops and Finance.';
    ensureSubmitChallanDatePicker();
    if (dateEl && dateEl._flatpickr) dateEl._flatpickr.setDate(new Date(), true);
    else if (dateEl) dateEl.value = '';

    try {
      const data = await apiGet(`/api/purchases/${_submitChallanHeaderId}`);
      const h = data.header;
      if (h && h.pipeline_status === 'DRAFT') {
        if (numEl && (h.challan_number || h.bill_ref)) numEl.value = h.challan_number || h.bill_ref || '';
        if (dateEl && h.challan_date) {
          const d = new Date(h.challan_date);
          if (dateEl._flatpickr) dateEl._flatpickr.setDate(d, true);
          else dateEl.value = fmtDate(h.challan_date);
        }
        const supplierLabel = h.vendor_name || h.supplier_name || '';
        if (hint && supplierLabel) {
          hint.textContent = `Draft #${_submitChallanHeaderId} · ${supplierLabel} — enter challan details to submit.`;
        }
      }
    } catch (_) { /* optional preload */ }

    window.openM('modal-submit-challan');
    if (numEl) numEl.focus();
  };

  window.confirmSubmitChallanFromModal = async function confirmSubmitChallanFromModal() {
    const headerId = _submitChallanHeaderId;
    if (!headerId) return;
    showErr('submit-challan-error', '');
    const numEl = document.getElementById('submit-challan-number');
    const dateEl = document.getElementById('submit-challan-date-input');
    const challanNum = numEl ? numEl.value.trim() : '';
    const challanDate = (typeof getFpIso === 'function' ? getFpIso('submit-challan-date-input') : null)
      || (dateEl ? dateEl.value.trim() : '');

    if (!challanNum) {
      if (typeof cosmosFieldError === 'function') cosmosFieldError(numEl, 'Required');
      return;
    }
    if (!challanDate) {
      if (typeof cosmosFieldError === 'function') cosmosFieldError(dateEl, 'Required');
      return;
    }

    const btn = document.getElementById('submit-challan-confirm-btn');
    const listBtn = _submitChallanTriggerBtn;
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    if (listBtn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(listBtn);

    try {
      await apiPut(`/api/purchases/${headerId}/submit-draft`, {
        challan_number: challanNum,
        challan_date: challanDate
      });
      if (typeof cosmosToastSuccess === 'function') {
        cosmosToastSuccess('Challan submitted. Finance can value it; branding/digitisation can proceed.');
      }
      window.closeM('modal-submit-challan');
      _submitChallanHeaderId = null;
      _submitChallanTriggerBtn = null;
      loadPurchases();
    } catch (e) {
      const m = e && e.message ? e.message : String(e);
      showErr('submit-challan-error', m);
      if (typeof cosmosToastError === 'function') cosmosToastError(m);
    } finally {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
      if (listBtn && typeof cosmosBtnDone === 'function') cosmosBtnDone(listBtn);
    }
  };

  window.closeM = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('open');
    el.style.removeProperty('display');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STAGE LIST VIEWS (Bill Verify / Branding / Digitisation)
  // ─────────────────────────────────────────────────────────────────────────

  function showBvList() {
    document.getElementById('bv-list-section').style.display   = '';
    document.getElementById('bv-detail-section').style.display = 'none';
    const btn = document.getElementById('bv-print-btn');
    if (btn) btn.style.display = 'none';
  }
  function showBvDetail() {
    document.getElementById('bv-list-section').style.display   = 'none';
    document.getElementById('bv-detail-section').style.display = '';
    const btn = document.getElementById('bv-print-btn');
    if (btn) btn.style.display = '';
  }
  function showBrandingList() {
    document.getElementById('branding-list-section').style.display   = '';
    document.getElementById('branding-detail-section').style.display = 'none';
    const btn = document.getElementById('branding-print-btn');
    if (btn) btn.style.display = 'none';
  }
  function showBrandingDetail() {
    document.getElementById('branding-list-section').style.display   = 'none';
    document.getElementById('branding-detail-section').style.display = '';
    const btn = document.getElementById('branding-print-btn');
    if (btn) btn.style.display = '';
  }
  function showDigiList() {
    document.getElementById('digi-list-section').style.display   = '';
    document.getElementById('digi-detail-section').style.display = 'none';
  }
  function showDigiDetail() {
    document.getElementById('digi-list-section').style.display   = 'none';
    document.getElementById('digi-detail-section').style.display = '';
  }
  // expose for back-buttons in HTML
  window.showBvList       = showBvList;
  window.showBrandingList = showBrandingList;
  window.showDigiList     = showDigiList;

  async function loadBillVerifyList() {
    showBvList();
    const tb = document.getElementById('bv-list-tbody');
    if (tb) tb.innerHTML = '<tr><td colspan="8" class="tc td2 p12">Loading…</td></tr>';
    try {
      const rows = await apiGet('/api/purchases?pipeline_status=PENDING_BILL_VERIFICATION');
      const cnt = document.getElementById('bv-list-count');
      if (cnt) cnt.textContent = rows.length + ' pending';
      // Update sidebar badge
      const bvBadge = document.getElementById('bv-nav-badge');
      if (bvBadge) { bvBadge.textContent = rows.length; bvBadge.style.display = rows.length > 0 ? '' : 'none'; }
      if (!rows.length) {
        if (tb) tb.innerHTML = '<tr><td colspan="8" class="tc td2 p12">No bills pending verification</td></tr>';
        return;
      }
      if (tb) {
        tb.innerHTML = rows.map((r) => {
          const revertBtn = fyCanRevertPurchaseToDraft()
            ? `<button type="button" class="btn xs" data-action="revert-to-purchase" data-id="${r.header_id}">Correct in purchase stage</button>`
            : '';
          return `<tr>
        <td class="mono xs fw6">#${r.header_id}</td>
        <td class="fw6">${r.supplier_name || '—'}</td>
        <td class="mono xs td2">${r.bill_ref || r.bill_number || '—'}</td>
        <td class="tc">${r.item_count || 0}</td>
        <td class="tc">${r.total_qty || 0}</td>
        <td class="mono xs">${inrD(r.expected_bill_amt)}</td>
        <td class="xs td2">${fmtDate(r.created_at)}</td>
        <td><div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end">
          <button type="button" class="btn xs primary" data-action="open-bill-verify" data-id="${r.header_id}">Verify Bill</button>
          ${revertBtn}
        </div></td>
      </tr>`;
        }).join('');
      }
    } catch (err) {
      if (tb) tb.innerHTML = `<tr><td colspan="8" class="tc td2 p12" style="color:var(--red)">${err.message}</td></tr>`;
    }
  }

  let _brandingHistoryDetailCache = {};
  let _brandingHistoryOpenRowId = null;

  function isBrandingActiveStatus(status) {
    return ['PENDING_BRANDING', 'BRANDING_DISPATCHED'].includes(status);
  }

  function isBrandingHistoryStatus(status) {
    return ['PENDING_DIGITISATION', 'WAREHOUSE_READY'].includes(status);
  }

  function renderBrandingHistoryDetail(data) {
    const h = (data && data.header) || {};
    const items = Array.isArray(data && data.items) ? data.items : [];
    const brandingItems = items.filter((it) => !!it.branding_required);
    const totalQty = brandingItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
    const missingBrand = brandingItems.filter((it) => !Number(it.home_brand_id || it.locked_home_brand_id || 0)).length;
    const missingCollection = brandingItems.filter((it) => !(it.ew_collection || '').trim()).length;

    const itemRows = brandingItems.length
      ? brandingItems.map((it, idx) => `<tr>
          <td class="xs">${idx + 1}</td>
          <td class="fw6">${_mcEsc(it.style_model || `Item #${it.item_id || idx + 1}`)}</td>
          <td>${_mcEsc(it.brand_name || '—')}</td>
          <td>${_mcEsc(it.ew_collection || '—')}</td>
          <td class="tc">${Number(it.quantity || 0)}</td>
          <td class="tc">${Array.isArray(it.colours) ? it.colours.length : 0}</td>
        </tr>`).join('')
      : '<tr><td colspan="6" class="tc td2 p12">No branding-required items in this dispatch</td></tr>';

    return `<div class="card" style="margin:8px 0 12px">
      <div class="cb" style="padding:12px">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px">
          <div class="fw6">Dispatch #${h.header_id || '—'}</div>
          <div>${stageBadge(h.pipeline_status)}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:10px">
          <div class="card" style="padding:8px"><div class="xs td2">Dispatch Date</div><div class="fw6">${fmtDateTime(h.dispatched_at || h.updated_at || h.created_at)}</div></div>
          <div class="card" style="padding:8px"><div class="xs td2">Receive Date</div><div class="fw6">${fmtDateTime(h.received_at)}</div></div>
          <div class="card" style="padding:8px"><div class="xs td2">Branding Agent</div><div class="fw6">${_mcEsc(h.branding_agent_name || '—')}</div></div>
          <div class="card" style="padding:8px"><div class="xs td2">Branding Items / Qty</div><div class="fw6">${brandingItems.length} / ${totalQty}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div class="card" style="padding:8px"><div class="xs td2">Dispatch Instructions</div><div>${_mcEsc(h.branding_instructions || '—')}</div></div>
          <div class="card" style="padding:8px"><div class="xs td2">Bypass Reason</div><div>${_mcEsc(h.bypass_reason || '—')}</div></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <span class="b ${missingBrand ? 'b-red' : 'b-green'}">Missing Brand: ${missingBrand}</span>
          <span class="b ${missingCollection ? 'b-red' : 'b-green'}">Missing Collection: ${missingCollection}</span>
        </div>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th style="width:60px">#</th>
                <th>Style / Model</th>
                <th>Brand Name</th>
                <th>Collection</th>
                <th class="tc">Qty</th>
                <th class="tc">Colours</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
  }

  window.toggleBrandingHistoryDetail = async function toggleBrandingHistoryDetail(headerId) {
    const detailRow = document.getElementById(`branding-hist-row-${headerId}`);
    const detailCell = document.getElementById(`branding-hist-cell-${headerId}`);
    if (!detailRow || !detailCell) return;

    const isOpen = detailRow.style.display !== 'none';
    if (isOpen) {
      detailRow.style.display = 'none';
      _brandingHistoryOpenRowId = null;
      return;
    }

    if (_brandingHistoryOpenRowId && _brandingHistoryOpenRowId !== headerId) {
      const prev = document.getElementById(`branding-hist-row-${_brandingHistoryOpenRowId}`);
      if (prev) prev.style.display = 'none';
    }

    _brandingHistoryOpenRowId = headerId;
    detailRow.style.display = '';

    if (_brandingHistoryDetailCache[headerId]) {
      detailCell.innerHTML = renderBrandingHistoryDetail(_brandingHistoryDetailCache[headerId]);
      return;
    }

    detailCell.innerHTML = '<div class="p12 td2">Loading dispatch details…</div>';
    try {
      const data = await apiGet(`/api/purchases/${headerId}`);
      _brandingHistoryDetailCache[headerId] = data;
      detailCell.innerHTML = renderBrandingHistoryDetail(data);
    } catch (err) {
      detailCell.innerHTML = `<div class="p12" style="color:var(--red)">Could not load dispatch details: ${_mcEsc(err.message || 'Unknown error')}</div>`;
    }
  };

  async function loadBrandingList() {
    showBrandingList();
    const tb = document.getElementById('branding-list-tbody');
    if (tb) tb.innerHTML = '<tr><td colspan="8" class="tc td2 p12">Loading…</td></tr>';
    if (typeof window._brandingListMode === 'undefined') window._brandingListMode = 'pending';

    function ensureBrandingHistoryToolbar() {
      const section = document.getElementById('branding-list-section');
      if (!section || document.getElementById('branding-list-toolbar')) return;
      const toolbar = document.createElement('div');
      toolbar.id = 'branding-list-toolbar';
      toolbar.className = 'flex ic g2 mb3';
      toolbar.style.cssText = 'justify-content:space-between;flex-wrap:wrap;gap:8px';
      toolbar.innerHTML = `
        <div class="flex ic g2">
          <button type="button" class="btn sm" id="branding-tab-pending">Pending</button>
          <button type="button" class="btn sm" id="branding-tab-history">History</button>
          <button type="button" class="btn sm" id="branding-tab-all">All</button>
        </div>
        <div class="xs td2" id="branding-list-mode-note"></div>`;
      const tableWrap = section.querySelector('.tw') || section.querySelector('table')?.parentElement || null;
      if (tableWrap && tableWrap.parentNode) {
        tableWrap.parentNode.insertBefore(toolbar, tableWrap);
      } else {
        section.prepend(toolbar);
      }

      const bind = (id, mode) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.onclick = () => {
          window._brandingListMode = mode;
          loadBrandingList();
        };
      };
      bind('branding-tab-pending', 'pending');
      bind('branding-tab-history', 'history');
      bind('branding-tab-all', 'all');
    }

    function updateBrandingToolbarState(totalPending, totalHistory, visibleRows) {
      const tabPending = document.getElementById('branding-tab-pending');
      const tabHistory = document.getElementById('branding-tab-history');
      const tabAll = document.getElementById('branding-tab-all');
      [tabPending, tabHistory, tabAll].forEach((b) => { if (b) b.classList.remove('primary'); });
      if (window._brandingListMode === 'history' && tabHistory) tabHistory.classList.add('primary');
      else if (window._brandingListMode === 'all' && tabAll) tabAll.classList.add('primary');
      else if (tabPending) tabPending.classList.add('primary');
      const note = document.getElementById('branding-list-mode-note');
      if (note) note.textContent = `Pending: ${totalPending} · History: ${totalHistory} · Showing: ${visibleRows}`;
    }

    ensureBrandingHistoryToolbar();
    try {
      const all = await apiGet('/api/purchases');
      const pendingRows = all.filter((r) => ['PENDING_BRANDING','BRANDING_DISPATCHED'].includes(r.pipeline_status));
      const historyRows = all.filter((r) => ['PENDING_DIGITISATION','WAREHOUSE_READY'].includes(r.pipeline_status));
      let rows = pendingRows;
      if (window._brandingListMode === 'history') rows = historyRows;
      else if (window._brandingListMode === 'all') rows = [...pendingRows, ...historyRows];
      const cnt = document.getElementById('branding-list-count');
      if (cnt) {
        const label = window._brandingListMode === 'history' ? 'history'
          : (window._brandingListMode === 'all' ? 'total' : 'pending');
        cnt.textContent = `${rows.length} ${label}`;
      }
      // Update sidebar badge
      const brandBadge = document.getElementById('branding-nav-badge');
      if (brandBadge) { brandBadge.textContent = pendingRows.length; brandBadge.style.display = pendingRows.length > 0 ? '' : 'none'; }
      updateBrandingToolbarState(pendingRows.length, historyRows.length, rows.length);
      if (!rows.length) {
        if (tb) tb.innerHTML = `<tr><td colspan="8" class="tc td2 p12">${window._brandingListMode === 'history' ? 'No branding history found' : 'No bills pending branding'}</td></tr>`;
        return;
      }
      if (tb) tb.innerHTML = rows.map((r) => {
        const active = isBrandingActiveStatus(r.pipeline_status);
        const history = isBrandingHistoryStatus(r.pipeline_status);
        const actionHtml = active
          ? `<button class="btn xs primary" data-action="open-branding" data-id="${r.header_id}">View / Manage</button>`
          : (history
            ? `<button class="btn xs primary" data-action="toggle-branding-history" data-id="${r.header_id}">View Details</button>`
            : `<button class="btn xs" data-action="open-purchase-view" data-id="${r.header_id}">View</button>`);
        const rowAction = history ? ` data-action="toggle-branding-history" data-id="${r.header_id}"` : '';
        const rowStyle = history ? ' style="cursor:pointer"' : '';
        const detailRow = history ? `
          <tr id="branding-hist-row-${r.header_id}" style="display:none;background:#f8fbff">
            <td colspan="8" id="branding-hist-cell-${r.header_id}" class="p0"></td>
          </tr>` : '';
        return `<tr${rowAction}${rowStyle}>
          <td class="mono xs fw6">#${r.header_id}</td>
          <td class="fw6">${r.supplier_name || '—'}</td>
          <td class="mono xs td2">${r.challan_number || r.bill_ref || '—'}</td>
          <td class="tc">${r.item_count || 0}</td>
          <td class="tc">${r.total_qty || 0}</td>
          <td>${stageBadge(r.pipeline_status)}</td>
          <td class="xs td2">${fmtDate(r.created_at)}</td>
          <td>${actionHtml}</td>
        </tr>${detailRow}`;
      }).join('');
    } catch (err) {
      if (tb) tb.innerHTML = `<tr><td colspan="8" class="tc td2 p12" style="color:var(--red)">${err.message}</td></tr>`;
    }
  }

  async function loadDigitisationList() {
    showDigiList();
    const tb = document.getElementById('digi-list-tbody');
    if (tb) tb.innerHTML = '<tr><td colspan="7" class="tc td2 p12">Loading…</td></tr>';
    try {
      const rows = await apiGet('/api/purchases?pipeline_status=PENDING_DIGITISATION');
      const cnt = document.getElementById('digi-list-count');
      if (cnt) cnt.textContent = rows.length + ' pending';
      // Update sidebar badge
      const digiBadge = document.getElementById('digi-nav-badge');
      if (digiBadge) { digiBadge.textContent = rows.length; digiBadge.style.display = rows.length > 0 ? '' : 'none'; }
      if (!rows.length) {
        if (tb) tb.innerHTML = '<tr><td colspan="7" class="tc td2 p12">No bills pending digitisation</td></tr>';
        return;
      }
      if (tb) tb.innerHTML = rows.map((r) => `<tr>
        <td class="mono xs fw6">#${r.header_id}</td>
        <td class="fw6">${r.supplier_name || '—'}</td>
        <td class="mono xs td2">${r.challan_number || r.bill_ref || r.bill_number || '—'}</td>
        <td class="tc">${r.item_count || 0}</td>
        <td class="tc">${r.total_qty || 0}</td>
        <td class="xs td2">${fmtDate(r.created_at)}</td>
        <td><button class="btn xs primary" data-action="open-digitisation" data-id="${r.header_id}">Digitise</button></td>
      </tr>`).join('');
    } catch (err) {
      if (tb) tb.innerHTML = `<tr><td colspan="7" class="tc td2 p12" style="color:var(--red)">${err.message}</td></tr>`;
    }
  }

  // Patch openBillVerifyPage / openBrandingPage / openDigitisationPage to switch to detail
  const _origOpenBV   = openBillVerifyPage;
  const _origOpenBR   = openBrandingPage;
  const _origOpenDigi = openDigitisationPage;

  // ─────────────────────────────────────────────────────────────────────────
  // MASTER CATALOGUE (product_master)
  // ─────────────────────────────────────────────────────────────────────────
  let _mcSearchTimer = null;
  window.debounceMcSearch = function() {
    clearTimeout(_mcSearchTimer);
    _mcSearchTimer = setTimeout(() => window.loadMasterCatalogue(), 350);
  };

  function _mcEsc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _mcSourceTypeBadge(st) {
    if (st == null || String(st).trim() === '') return '—';
    const u = String(st).toUpperCase();
    let cls = 'b-gray';
    if (u === 'LOCAL_SUPPLIER' || u.includes('LOCAL')) cls = 'b-blue';
    else if (u === 'DIRECT_BRAND' || u.includes('DIRECT')) cls = 'b-purple';
    else if (u === 'IMPORT') cls = 'b-gold';
    else if (u === 'INHOUSE') cls = 'b-teal';
    const labelMap = {
      LOCAL_SUPPLIER: 'Local Supplier',
      DIRECT_BRAND: 'Direct Brand',
      IMPORT: 'Import',
      INHOUSE: 'In-house'
    };
    const label = labelMap[u] || u.replace(/_/g, ' ');
    return `<span class="b ${cls}">${_mcEsc(label)}</span>`;
  }

  function _mcCatalogueStatusBadge(status) {
    const u = (status || '').toUpperCase();
    if (u === 'ACTIVE') return '<span class="b b-green">Active</span>';
    if (u === 'DRAFT') return '<span class="b b-gold">Draft</span>';
    if (u === 'DISCONTINUED') return '<span class="b b-red">Discontinued</span>';
    return `<span class="b b-gray">${_mcEsc(status || '—')}</span>`;
  }

  function _mcInr(n) {
    if (n == null || n === '') return '—';
    const x = Number(n);
    if (Number.isNaN(x)) return '—';
    return '₹' + x.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function _mcDetailKV(label, innerHtml) {
    return `<div style="margin-bottom:14px">
      <div class="xs td2" style="text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;font-weight:600">${_mcEsc(label)}</div>
      <div style="font-size:14px">${innerHtml}</div>
    </div>`;
  }

  let _mcBrandFilterReady = false;
  let _mcRowById = {};
  let _mcDetailSkus = [];
  const canEditMasterDigitisationFields = foundryCatalogueCanEditPage('master-catalogue');

  async function _mcEnsureBrandFilter() {
    if (_mcBrandFilterReady) return;
    const sel = document.getElementById('mc-brand-filter');
    if (!sel) return;
    try {
      const brands = await apiGet('/api/home-brands');
      const list = Array.isArray(brands) ? brands : [];
      list.forEach((b) => {
        if (b.brand_id == null) return;
        const opt = document.createElement('option');
        opt.value = String(b.brand_id);
        opt.textContent = b.brand_name || `Brand #${b.brand_id}`;
        sel.appendChild(opt);
      });
      _mcBrandFilterReady = true;
    } catch (_) {
      /* non-fatal — user can still filter by other fields */
    }
  }

  window.handleMasterSkuEditorSkuChange = function() {
    const skuSel = document.getElementById('mc-edit-sku-id');
    if (!skuSel) return;
    const skuId = Number(skuSel.value || 0);
    const selected = _mcDetailSkus.find((s) => Number(s.sku_id) === skuId) || null;
    const mrpEl = document.getElementById('mc-edit-mrp');
    const imgEl = document.getElementById('mc-edit-photo');
    const vidEl = document.getElementById('mc-edit-video');
    if (mrpEl) mrpEl.value = selected && selected.sale_price != null ? Number(selected.sale_price) : '';
    if (imgEl) imgEl.value = selected && selected.image_url ? selected.image_url : '';
    if (vidEl) vidEl.value = selected && selected.video_url ? selected.video_url : '';
  };

  window.handleMasterDigitisationSave = async function(productId) {
    if (!canEditMasterDigitisationFields) return;
    const saveBtn = document.getElementById('mc-edit-save-btn');
    const msgEl = document.getElementById('mc-edit-msg');
    const skuSel = document.getElementById('mc-edit-sku-id');
    const selectedSkuId = Number((skuSel && skuSel.value) || 0);
    const payload = {
      description: val('mc-edit-description') || null,
      frame_material: val('mc-edit-frame-material') || null,
      frame_width: val('mc-edit-frame-width') ? Number(val('mc-edit-frame-width')) : null,
      lens_height: val('mc-edit-lens-height') ? Number(val('mc-edit-lens-height')) : null,
      temple_length: val('mc-edit-temple-length') ? Number(val('mc-edit-temple-length')) : null,
      image_url: val('mc-edit-photo') || null
    };
    const mrpRaw = val('mc-edit-mrp');
    const mrpValue = mrpRaw ? Number(mrpRaw) : null;
    const videoUrl = val('mc-edit-video') || null;

    if (mrpRaw && (!Number.isFinite(mrpValue) || mrpValue <= 0)) {
      if (msgEl) {
        msgEl.textContent = 'Enter a valid MRP value.'
        msgEl.style.display = ''
        msgEl.style.color = 'var(--red)'
      }
      return
    }

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
    if (msgEl) { msgEl.style.display = 'none'; msgEl.textContent = ''; }
    try {
      await apiPut(`/api/products/${productId}/details`, payload);
      if (selectedSkuId > 0 && mrpValue != null) {
        await apiPut(`/api/skus/${selectedSkuId}/sale-price`, {
          sale_price: mrpValue,
          reason: 'MASTER_CATALOGUE_DIGITISATION_EDIT'
        });
      }
      if (selectedSkuId > 0) {
        await apiPut(`/api/skus/${selectedSkuId}/media`, {
          image_url: payload.image_url,
          video_url: videoUrl
        });
      }
      if (msgEl) {
        msgEl.textContent = 'Digitisation fields saved.'
        msgEl.style.display = ''
        msgEl.style.color = 'var(--green)'
      }
      await loadMasterCatalogue();
      await openMasterProductDetail(productId);
    } catch (err) {
      if (msgEl) {
        msgEl.textContent = err.message || 'Failed to save changes'
        msgEl.style.display = ''
        msgEl.style.color = 'var(--red)'
      }
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
    }
  };

  window.openMasterProductDetail = async function(productId) {
    const row = _mcRowById[productId];
    if (!row) return;
    const titleEl = document.getElementById('mc-detail-title');
    const idEl = document.getElementById('mc-detail-id');
    const bodyEl = document.getElementById('mc-detail-body');
    if (titleEl) titleEl.textContent = row.brand_name || 'Product';
    if (idEl) idEl.textContent = row.product_id ? `product_id ${row.product_id}` : '';
    if (!bodyEl) return;
    bodyEl.innerHTML = '<div class="tc td2 p12">Loading details…</div>';
    if (typeof openM === 'function') openM('modal-master-product');

    try {
      const [product, skus] = await Promise.all([
        apiGet(`/api/products/${productId}`),
        apiGet(`/api/skus/by-product/${productId}`)
      ]);
      _mcDetailSkus = Array.isArray(skus) ? skus : [];
      const r = product || row;
      const selectedSku = _mcDetailSkus[0] || null;
      const skuOptions = _mcDetailSkus.length
        ? _mcDetailSkus.map((s, idx) => `<option value="${Number(s.sku_id || 0)}"${idx === 0 ? ' selected' : ''}>${_mcEsc(s.sku_code || `SKU ${s.sku_id}`)} · ${_mcEsc(s.colour_name || '—')}</option>`).join('')
        : '<option value="">No SKU variants</option>';
      const styleBlock = (() => {
        const sm = r.style_model ? `<div>${_mcEsc(r.style_model)}</div>` : '';
        const sn = r.source_model_number && String(r.source_model_number).trim() !== ''
          ? `<div class="xs td2 mono" style="margin-top:4px">Source model #: ${_mcEsc(r.source_model_number)}</div>`
          : '';
        if (!sm && !sn) return '—';
        return sm + sn;
      })();
      const purchaseBlock = (() => {
        const c = Number(r.purchase_count) || 0;
        if (c === 0) return '<span class="td2">No purchase lines yet</span>';
        const lo = r.purchase_rate_min;
        const hi = r.purchase_rate_max;
        if (lo == null && hi == null) return '—';
        if (lo != null && hi != null) {
          return `<div>Lowest: <span class="mono fw6">${_mcInr(lo)}</span></div><div style="margin-top:6px">Highest: <span class="mono fw6">${_mcInr(hi)}</span></div>`;
        }
        return `<div><span class="mono fw6">${_mcInr(lo != null ? lo : hi)}</span></div>`;
      })();

      bodyEl.innerHTML = `
        ${_mcDetailKV('Brand', _mcEsc(r.brand_name || '—'))}
        ${_mcDetailKV('EW collection', _mcEsc(r.ew_collection || '—'))}
        ${_mcDetailKV('Style', styleBlock)}
        ${_mcDetailKV('Manufacturer', _mcEsc(r.manufacturer_name || '—'))}
        ${_mcDetailKV('Source brand', _mcEsc(r.source_brand || '—'))}
        ${_mcDetailKV('Source collection', _mcEsc(r.source_collection || '—'))}
        ${_mcDetailKV('Purchase (readonly)', purchaseBlock)}
        <hr style="border:none;border-top:1px solid #eee;margin:10px 0 14px">
        <div class="xs td2" style="text-transform:uppercase;letter-spacing:.04em;font-weight:600;margin-bottom:8px">Digitisation fields (editable)</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div style="grid-column:1/-1">
            <label class="xs td2">Description</label>
            <textarea id="mc-edit-description" rows="3" style="width:100%">${_mcEsc(r.description || '')}</textarea>
          </div>
          <div>
            <label class="xs td2">Frame material</label>
            <input id="mc-edit-frame-material" value="${_mcEsc(r.frame_material || '')}">
          </div>
          <div>
            <label class="xs td2">MRP</label>
            <input id="mc-edit-mrp" type="number" min="1" step="0.01" value="${selectedSku && selectedSku.sale_price != null ? Number(selectedSku.sale_price) : ''}">
          </div>
          <div>
            <label class="xs td2">Frame width (mm)</label>
            <input id="mc-edit-frame-width" type="number" min="0" step="0.1" value="${r.frame_width != null ? Number(r.frame_width) : ''}">
          </div>
          <div>
            <label class="xs td2">Lens height (mm)</label>
            <input id="mc-edit-lens-height" type="number" min="0" step="0.1" value="${r.lens_height != null ? Number(r.lens_height) : ''}">
          </div>
          <div>
            <label class="xs td2">Temple length (mm)</label>
            <input id="mc-edit-temple-length" type="number" min="0" step="0.1" value="${r.temple_length != null ? Number(r.temple_length) : ''}">
          </div>
          <div>
            <label class="xs td2">Photo URL</label>
            <input id="mc-edit-photo" value="${_mcEsc((selectedSku && selectedSku.image_url) || r.image_url || '')}">
          </div>
          <div>
            <label class="xs td2">Video URL</label>
            <input id="mc-edit-video" value="${_mcEsc((selectedSku && selectedSku.video_url) || '')}">
          </div>
          <div style="grid-column:1/-1">
            <label class="xs td2">SKU variant for MRP/Media</label>
            <select id="mc-edit-sku-id" onchange="handleMasterSkuEditorSkuChange()">${skuOptions}</select>
          </div>
        </div>
        <div id="mc-edit-msg" class="xs" style="margin-top:10px;display:none"></div>
        <div style="margin-top:10px">
          <button id="mc-edit-save-btn" class="btn primary" onclick="handleMasterDigitisationSave(${Number(productId)})" ${canEditMasterDigitisationFields ? '' : 'disabled'}>Save</button>
          ${canEditMasterDigitisationFields ? '' : '<span class="xs td2" style="margin-left:8px">Read-only access</span>'}
        </div>`;
    } catch (err) {
      bodyEl.innerHTML = `<div class="tc" style="color:var(--red)">${_mcEsc(err.message || 'Unable to load details')}</div>`;
    }
  };

  window.loadMasterCatalogue = async function loadMasterCatalogue() {
    const tbody = document.getElementById('mc-tbody');
    const subEl = document.getElementById('mc-subtitle');
    const q = val('mc-search');
    const sourceType = val('mc-source-type');
    const catStatus = val('mc-status');
    const productType = val('mc-product-type');
    const brandId = val('mc-brand-filter');

    await _mcEnsureBrandFilter();

    const params = new URLSearchParams();
    if (catStatus) params.set('catalogue_status', catStatus);
    if (sourceType) params.set('source_type', sourceType);
    if (productType) params.set('product_type', productType);
    if (brandId) params.set('brand_id', brandId);
    if (q) params.set('q', q);
    const qs = params.toString();

    if (tbody) {
      if (window.cosmosSkeletonTable) window.cosmosSkeletonTable('mc-tbody', 7, 6);
      else tbody.innerHTML = '<tr><td colspan="7" class="tc td2 p12">Loading…</td></tr>';
    }

    try {
      const rows = await apiGet(`/api/products${qs ? `?${qs}` : ''}`);
      if (!tbody) return;

      _mcRowById = {};
      rows.forEach((row) => {
        if (row.product_id != null) _mcRowById[row.product_id] = row;
      });

      const parts = [];
      parts.push(`${rows.length} product${rows.length !== 1 ? 's' : ''}`);
      if (catStatus === 'ACTIVE') parts.push('Active catalogue');
      else if (catStatus) parts.push(catStatus);
      else parts.push('All statuses');
      if (subEl) subEl.textContent = parts.join(' · ');

      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="tc td2 p12">No products found</td></tr>';
        return;
      }

      tbody.innerHTML = rows.map((r) => {
        const brand = _mcEsc(r.brand_name || '—');
        const ew = _mcEsc(r.ew_collection || '—');
        const styleShort = _mcEsc(
          (r.style_model && String(r.style_model).trim()) ? r.style_model : (r.source_model_number || '—')
        );
        const manufacturer = _mcEsc(r.manufacturer_name || '—');
        const stBadge = _mcSourceTypeBadge(r.source_type);
        const stStatus = _mcCatalogueStatusBadge(r.catalogue_status);
        const pid = Number(r.product_id);
        return `<tr>
          <td class="fw6">${brand}</td>
          <td>${ew}</td>
          <td class="mono xs">${styleShort}</td>
          <td class="xs">${manufacturer}</td>
          <td>${stBadge}</td>
          <td>${stStatus}</td>
          <td class="tc"><button type="button" class="btn xs primary" onclick="openMasterProductDetail(${pid})">Details</button></td>
        </tr>`;
      }).join('');
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="tc td2 p12" style="color:var(--red)">${_mcEsc(msg)}</td></tr>`;
      if (subEl) subEl.textContent = '';
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SKU CATALOGUE
  // ─────────────────────────────────────────────────────────────────────────
  let _catView = 'grid';
  let _catSearchTimer = null;
  window.debounceCatSearch = function() {
    clearTimeout(_catSearchTimer);
    _catSearchTimer = setTimeout(() => window.loadSkuCatalogue(), 350);
  };

  window.setCatalogueView = function(view) {
    _catView = view;
    const grid  = document.getElementById('sku-cat-grid');
    const table = document.getElementById('sku-cat-table');
    const gb    = document.getElementById('cat-grid-btn');
    const tb    = document.getElementById('cat-table-btn');
    if (view === 'grid') {
      if (grid)  grid.style.display  = 'grid';
      if (table) table.style.display = 'none';
      if (gb) { gb.style.background = 'var(--acc2)'; gb.style.color = '#fff'; }
      if (tb) { tb.style.background = ''; tb.style.color = ''; }
    } else {
      if (grid)  grid.style.display  = 'none';
      if (table) table.style.display = '';
      if (gb) { gb.style.background = ''; gb.style.color = ''; }
      if (tb) { tb.style.background = 'var(--acc2)'; tb.style.color = '#fff'; }
    }
  };

  window.loadSkuCatalogue = async function loadSkuCatalogue() {
    const q          = val('cat-search');
    const brandId    = val('cat-brand-filter');
    const productType = val('cat-type-filter');
    const status     = val('cat-status-filter') || 'LIVE';
    const grid  = document.getElementById('sku-cat-grid');
    const tbody = document.getElementById('sku-cat-tbody');
    const subEl = document.getElementById('sku-cat-subtitle');

    let qs = `status=${encodeURIComponent(status)}`;
    if (q)           qs += `&q=${encodeURIComponent(q)}`;
    if (brandId)     qs += `&brand_id=${encodeURIComponent(brandId)}`;
    if (productType) qs += `&product_type=${encodeURIComponent(productType)}`;

    if (grid) {
      if (window.cosmosSkeletonCards) window.cosmosSkeletonCards('sku-cat-grid', 6);
      else grid.innerHTML = '<div class="empty"><div class="empty-ic">⏳</div><div>Loading…</div></div>';
    }
    if (tbody) {
      if (window.cosmosSkeletonTable) window.cosmosSkeletonTable('sku-cat-tbody', 10, 6);
      else tbody.innerHTML = '<tr><td colspan="10" class="tc td2 p12">Loading…</td></tr>';
    }

    try {
      const rows = await apiGet(`/api/skus?${qs}`);
      _skuCatalogueRows = rows;

      // ── Group by product_id ──────────────────────────────────────────────────
      const groupMap = new Map();
      rows.forEach((r) => {
        if (!groupMap.has(r.product_id)) {
          groupMap.set(r.product_id, {
            product_id: r.product_id, ew_collection: r.ew_collection,
            style_model: r.style_model, brand_name: r.brand_name, brand_id: r.brand_id,
            pm_product_type: r.pm_product_type, description: r.description,
            frame_material: r.frame_material, frame_width: r.frame_width,
            lens_height: r.lens_height, temple_length: r.temple_length,
            colours: []
          });
        }
        groupMap.get(r.product_id).colours.push({
          sku_id: r.sku_id, sku_code: r.sku_code, barcode: r.barcode,
          colour_name: r.colour_name, colour_code: r.colour_code,
          image_url: r.image_url, video_url: r.video_url,
          sale_price: r.sale_price, cost_price: r.cost_price,
          stock_qty: r.stock_qty, total_qty: r.total_qty, status: r.status
        });
      });
      const groups = [...groupMap.values()];

      // Update brand filter (once)
      const brandSel = document.getElementById('cat-brand-filter');
      if (brandSel && brandSel.options.length <= 1) {
        const brands = [...new Map(rows.filter((r) => r.brand_name).map((r) => [r.brand_id, r.brand_name])).entries()];
        brands.forEach(([id, name]) => {
          const opt = document.createElement('option');
          opt.value = id; opt.textContent = name;
          brandSel.appendChild(opt);
        });
      }

      if (subEl) subEl.textContent =
        `${groups.length} model${groups.length !== 1 ? 's' : ''} · ${rows.length} colour variant${rows.length !== 1 ? 's' : ''} — all published`;

      if (!groups.length) {
        if (grid)  grid.innerHTML  = '<div class="empty" style="grid-column:1/-1"><div class="empty-ic">📦</div><div>No products found</div></div>';
        if (tbody) tbody.innerHTML = '<tr><td colspan="11" class="tc td2 p12">No products found</td></tr>';
        setCatalogueView(_catView);
        return;
      }

      const stockClr = (qty) => qty > 10 ? 'b-green' : qty > 0 ? 'b-gold' : 'b-red';

      // ── Grid — one card per model, colour swatches switch the view ────────────
      if (grid) {
        grid.innerHTML = groups.map((g) => {
          const first   = g.colours[0];
          const pid     = g.product_id;
          const name    = `${g.ew_collection || ''} · ${g.style_model || ''}`;
          const specs   = [g.frame_material, g.frame_width ? `${g.frame_width}mm` : null, g.lens_height ? `${g.lens_height}mm` : null]
            .filter(Boolean).join(' / ');
          const imgHtml = first.image_url
            ? `<img src="${first.image_url}" alt="${name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : '';
          const fallback = `<div class="sku-img-fallback" style="${first.image_url ? 'display:none' : ''}">${g.pm_product_type === 'SUNGLASSES' ? '🕶️' : '👓'}</div>`;

          const swatches = g.colours.map((c, i) => {
            const bg = swatchBg(c.colour_name, c.colour_code);
            return `<div class="sku-swatch${i === 0 ? ' active' : ''}"
              style="background:${bg}"
              onclick="selectSkuColour(${pid},${c.sku_id},this)"
              title="${c.colour_name || ''}${c.colour_code ? ' ('+c.colour_code+')' : ''}"></div>`;
          }).join('') + (g.colours.length > 1 ? `<span class="sku-swatch-count">${g.colours.length}</span>` : '');

          return `<div class="sku-card" id="skupg-${pid}">
            <div class="sku-img" id="skupg-${pid}-img">${imgHtml}${fallback}</div>
            <div class="sku-body">
              <div class="sku-brand">${g.brand_name || '—'}</div>
              <div class="sku-name">${name}</div>
              ${specs ? `<div class="sku-spec">${specs}</div>` : ''}
              <div class="sku-swatches">${swatches}</div>
              <div class="sku-colour-label">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${swatchBg(first.colour_name,first.colour_code)};border:1px solid rgba(0,0,0,.15);margin-right:5px;vertical-align:middle" id="skupg-${pid}-colour-dot"></span>
                <span id="skupg-${pid}-colour">${first.colour_name || '—'}</span>
              </div>
              <div class="sku-price-row">
                <div class="sku-price" id="skupg-${pid}-price">${inrD(first.sale_price)}</div>
                <span class="b ${stockClr(first.stock_qty)} xs" id="skupg-${pid}-stock">${first.stock_qty} in stock</span>
              </div>
              <div class="sku-code" id="skupg-${pid}-sku-code">${first.sku_code}</div>
              <div class="sku-card-actions">
                <button class="btn primary sku-view-btn" id="skupg-${pid}-view-btn"
                  onclick="openSkuDetail(${first.sku_id})">View Details</button>
              </div>
            </div>
          </div>`;
        }).join('');
      }

      // ── Table — product group header + colour sub-rows ─────────────────────────
      if (tbody) {
        tbody.innerHTML = groups.map((g) => {
          const name  = `${g.ew_collection || ''} · ${g.style_model || ''}`;
          const specs = [g.frame_material, g.frame_width ? `${g.frame_width}mm` : null, g.lens_height ? `${g.lens_height}mm` : null]
            .filter(Boolean).join(' / ');
          const hdr = `<tr class="tbl-group-hdr">
            <td colspan="9">
              📦 <strong>${name}</strong>&emsp;
              <span>${g.brand_name || ''}</span>
              ${specs ? `<span class="xs td2"> · ${specs}</span>` : ''}
              <span class="b b-gray xs" style="margin-left:8px">${g.pm_product_type || ''}</span>
              <span class="xs td2" style="margin-left:8px">${g.colours.length} variant${g.colours.length !== 1 ? 's' : ''}</span>
            </td>
          </tr>`;
          const colRows = g.colours.map((c) => {
            const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${swatchBg(c.colour_name,c.colour_code)};margin-right:5px;vertical-align:middle;border:1px solid rgba(0,0,0,.15)"></span>`;
            return `<tr class="tbl-colour-row">
              <td class="mono xs fw6">${c.sku_code}</td>
              <td>${dot}${c.colour_name || '—'} ${c.colour_code ? `<span class="xs td2">(${c.colour_code})</span>` : ''}</td>
              <td class="td2">${g.brand_name || '—'}</td>
              <td><span class="b b-gray xs">${g.pm_product_type || '—'}</span></td>
              <td class="mono xs">${inrD(c.sale_price)}</td>
              <td class="tc"><span class="b ${stockClr(c.stock_qty)} xs">${c.stock_qty}</span></td>
              <td>${c.total_qty || '—'}</td>
              <td><span class="b b-green xs">${c.status}</span></td>
              <td class="sku-table-actions">
                <button class="btn sm" onclick="openSkuDetail(${c.sku_id})">View</button>
              </td>
            </tr>`;
          }).join('');
          return hdr + colRows;
        }).join('');
      }

      // Apply current view
      setCatalogueView(_catView);

    } catch (err) {
      if (grid)  grid.innerHTML  = `<div class="empty" style="color:var(--red);grid-column:1/-1">${err.message}</div>`;
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="tc td2" style="color:var(--red)">${err.message}</td></tr>`;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SKU CATALOGUE HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  let _skuCatalogueRows = []; // cache from last loadSkuCatalogue

  // Returns a CSS background colour for a swatch given colour name / code
  function swatchBg(colourName = '', colourCode = '') {
    const src = (colourCode || colourName || '').toLowerCase().trim();
    if (/^#[0-9a-f]{3,6}$/i.test(src)) return src;
    const map = {
      black:'#222', blk:'#222', dark:'#333', charcoal:'#444',
      white:'#f5f5f5', wht:'#f5f5f5', ivory:'#fffff0', cream:'#fffdd0', off:'#f0ede0',
      red:'#e53e3e', maroon:'#800000', crimson:'#dc143c', coral:'#ff7f6b',
      blue:'#3182ce', navy:'#001a4d', royal:'#4169e1', sky:'#87ceeb', teal:'#2dd4bf', cyan:'#00bcd4',
      green:'#38a169', olive:'#6b7c3a', lime:'#84cc16', mint:'#98d8c8', forest:'#228b22',
      yellow:'#ecc94b', lemon:'#fff44f', gold:'#d4af37', amber:'#f59e0b',
      orange:'#ed8936', rust:'#b7410e', copper:'#b87333',
      pink:'#ed64a6', rose:'#fb7185', magenta:'#e91e99', fuchsia:'#ff00ff',
      purple:'#805ad5', violet:'#7c3aed', lavender:'#c4b5fd', plum:'#8e4585',
      brown:'#8b4513', tan:'#d2b48c', beige:'#f5f0e1', camel:'#c19a6b', mocha:'#8b6345',
      grey:'#888', gray:'#888', gry:'#888', silver:'#c0c0c0', smoke:'#9e9e9e',
      transparent:'#e0e0e0', clear:'#e0e0e0',
      tortoise:'#704214', tortoiseshell:'#704214',
      gunmetal:'#4a4a50', bronze:'#8c7038',
    };
    for (const [key, val] of Object.entries(map)) {
      if (src.includes(key)) return val;
    }
    // Deterministic hue from string
    let hash = 0;
    for (let i = 0; i < src.length; i++) hash = src.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360},50%,50%)`;
  }

  // Returns white or dark text colour for contrast on a swatch
  function swatchFg(bg) {
    if (!bg || bg === '#f5f5f5' || bg === '#fffdd0' || bg === '#f5f0e1' || bg === '#fff44f' || bg === '#ecc94b') return '#222';
    if (bg.startsWith('hsl')) {
      const h = parseInt(bg.replace('hsl(',''));
      return (h > 40 && h < 200) ? '#222' : '#fff';
    }
    return '#fff';
  }

  // Switch which colour is shown on a grouped product card
  window.selectSkuColour = function(productId, skuId, swatchEl) {
    const sku = _skuCatalogueRows.find((r) => r.sku_id === skuId);
    if (!sku) return;

    // Update active swatch
    const card = document.getElementById(`skupg-${productId}`);
    if (card) card.querySelectorAll('.sku-swatch').forEach((s) => s.classList.remove('active'));
    if (swatchEl) swatchEl.classList.add('active');

    // Update image
    const imgEl = document.getElementById(`skupg-${productId}-img`);
    if (imgEl) {
      if (sku.image_url) {
        imgEl.innerHTML = `<img src="${sku.image_url}" alt="${sku.colour_name}"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="sku-img-fallback" style="display:none">${sku.pm_product_type === 'SUNGLASSES' ? '🕶️' : '👓'}</div>`;
      } else {
        imgEl.innerHTML = `<div class="sku-img-fallback">${sku.pm_product_type === 'SUNGLASSES' ? '🕶️' : '👓'}</div>`;
      }
    }

    // Update colour dot + label
    const dotEl  = document.getElementById(`skupg-${productId}-colour-dot`);
    const colEl  = document.getElementById(`skupg-${productId}-colour`);
    if (dotEl) dotEl.style.background = swatchBg(sku.colour_name, sku.colour_code);
    if (colEl) colEl.textContent = sku.colour_name || '—';

    // Update price + stock
    const priceEl = document.getElementById(`skupg-${productId}-price`);
    const stockEl = document.getElementById(`skupg-${productId}-stock`);
    if (priceEl) priceEl.textContent = inrD(sku.sale_price);
    if (stockEl) {
      const _wh = Number(sku.warehouse_qty ?? sku.stock_qty) || 0;
      const cls = _wh > 10 ? 'b-green' : _wh > 0 ? 'b-gold' : 'b-red';
      stockEl.className = `b ${cls} xs`;
      stockEl.textContent = `${_wh} units`;
    }

    // Update SKU code
    const codeEl = document.getElementById(`skupg-${productId}-sku-code`);
    if (codeEl) codeEl.textContent = sku.sku_code;

    // Update View Details button target
    const btnEl = document.getElementById(`skupg-${productId}-view-btn`);
    if (btnEl) btnEl.setAttribute('onclick', `openSkuDetail(${skuId})`);
  };

  // Renders detail for one SKU row inside the modal
  function _renderSkuDetailContent(r, siblings) {
    const imgSec = r.image_url
      ? `<img src="${r.image_url}" alt="${r.colour_name}" style="width:100%;max-height:220px;object-fit:contain;border-radius:8px;margin-bottom:10px;background:#f7f7f7">`
      : `<div style="width:100%;height:140px;display:flex;align-items:center;justify-content:center;background:#f7f7f7;border-radius:8px;font-size:48px;margin-bottom:10px">${r.pm_product_type === 'SUNGLASSES' ? '🕶️' : '👓'}</div>`;
    const vidSec = r.video_url
      ? `<video src="${r.video_url}" controls style="width:100%;border-radius:8px;border:1px solid var(--border);margin-bottom:10px;max-height:180px"></video>`
      : '';
    const specs = [
      ['Frame Material', r.frame_material],
      ['Frame Width',   r.frame_width   ? `${r.frame_width} mm`   : null],
      ['Lens Height',   r.lens_height   ? `${r.lens_height} mm`   : null],
      ['Temple Length', r.temple_length ? `${r.temple_length} mm` : null],
    ].filter(([,v]) => v).map(([k,v]) => `<div><div class="label-sm td2">${k}</div><div class="fw6">${v}</div></div>`).join('');
    // Colour swatches row (all siblings of same product)
    const swatchRow = siblings.length > 1 ? `
      <div style="margin-bottom:12px">
        <div class="label-sm td2 mb1">Available Colours</div>
        <div class="sku-swatches">
          ${siblings.map((s) => {
            const bg  = swatchBg(s.colour_name, s.colour_code);
            const act = s.sku_id === r.sku_id ? ' active' : '';
            return `<div class="sku-swatch${act}" style="background:${bg}" title="${s.colour_name || ''}"
              onclick="openSkuDetail(${s.sku_id})"></div>`;
          }).join('')}
        </div>
      </div>` : '';

    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div>${imgSec}${vidSec}
          ${r.description ? `<div class="xs td2" style="line-height:1.5">${r.description}</div>` : ''}
        </div>
        <div>
          ${swatchRow}
          <div style="margin-bottom:10px">
            <div class="label-sm td2 xs">SKU Code</div>
            <div class="mono fw6" style="font-size:15px">${r.sku_code}</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
            <div><div class="label-sm td2">Brand</div><div class="fw6">${r.brand_name || '—'}</div></div>
            <div><div class="label-sm td2">Type</div><div><span class="b b-gray xs">${r.pm_product_type || '—'}</span></div></div>
            <div><div class="label-sm td2">Colour</div>
              <div style="display:flex;align-items:center;gap:5px">
                <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${swatchBg(r.colour_name,r.colour_code)};border:1px solid rgba(0,0,0,.15)"></span>
                <span>${r.colour_name || '—'}${r.colour_code ? ` <span class="xs td2">(${r.colour_code})</span>` : ''}</span>
              </div>
            </div>
          </div>
          <hr style="border:none;border-top:1px solid #eee;margin:8px 0">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
            <div><div class="label-sm td2">Sale Price</div><div class="mono fw6" style="color:var(--primary)">${inrD(r.sale_price)}</div></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
            <div><div class="label-sm td2">Warehouse Stock</div><div class="fw6" style="font-size:16px;color:${(Number(r.warehouse_qty ?? r.stock_qty) || 0) > 0 ? 'var(--green)' : 'var(--red)'}">${Number(r.warehouse_qty ?? r.stock_qty) || 0} units</div></div>
            <div><div class="label-sm td2">Total Purchased</div><div class="fw6">${r.total_qty || '—'}</div></div>
          </div>
          ${specs ? `<hr style="border:none;border-top:1px solid #eee;margin:8px 0"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${specs}</div>` : ''}
          <div class="xs td2 mt2">Listed: ${fmtDateTime(r.created_at)}</div>
        </div>
      </div>`;
  }

  window.openSkuDetail = function(skuId) {
    const body  = document.getElementById('sku-detail-body');
    const title = document.getElementById('sku-detail-title');
    document.getElementById('modal-sku-detail').style.display = 'flex';
    const r = _skuCatalogueRows.find((x) => x.sku_id === skuId);
    if (!r) { body.innerHTML = '<div class="tc td2">Details not found.</div>'; return; }
    title.textContent = `${r.ew_collection || ''} · ${r.style_model || ''}`;
    // Siblings = all SKUs from same product
    const siblings = _skuCatalogueRows.filter((x) => x.product_id === r.product_id);
    body.innerHTML = _renderSkuDetailContent(r, siblings);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SKU STOCK DISTRIBUTION VIEW
  // ─────────────────────────────────────────────────────────────────────────
  let _svSearchTimer = null;

  function svIsAvailable(row, qtyKeys) {
    if (!row || typeof row !== 'object') return false;
    if (typeof row.is_available === 'boolean') return row.is_available;
    const availability = String(row.availability || '').toUpperCase();
    if (availability === 'AVAILABLE') return true;
    if (availability === 'NOT_AVAILABLE') return false;
    const keys = Array.isArray(qtyKeys) ? qtyKeys : [];
    return keys.some((key) => Number(row[key]) > 0);
  }

  function svShow(id) {
    ['sv-empty-state','sv-distribution-panel','sv-error-state'].forEach((x) => {
      const el = document.getElementById(x);
      if (el) el.style.display = x === id ? 'block' : 'none';
    });
    if (id === 'sv-distribution-panel') {
      const d = document.getElementById('sv-distribution-panel');
      if (d) d.style.display = 'block';
    }
  }

  window.onStockViewSearch = function() {
    clearTimeout(_svSearchTimer);
    const q = (document.getElementById('sv-search-q')?.value || '').trim();
    const resEl = document.getElementById('sv-search-results');
    const spinner = document.getElementById('sv-search-spinner');
    if (!q || q.length < 2) { if (resEl) resEl.style.display = 'none'; return; }
    if (spinner) spinner.style.display = 'inline';
    _svSearchTimer = setTimeout(async () => {
      try {
        const data = await apiGet(`/api/stock-transfers/distribution/search?q=${encodeURIComponent(q)}&limit=15`);
        svRenderSearchDropdown(Array.isArray(data) ? data : []);
      } catch (err) {
        if (resEl) { resEl.innerHTML = `<div style="padding:12px;color:var(--red);font-size:12.5px">Search error: ${err.message}</div>`; resEl.style.display = 'block'; }
      } finally {
        if (spinner) spinner.style.display = 'none';
      }
    }, 350);
  };

  window.doStockViewSearch = async function() {
    const q = (document.getElementById('sv-search-q')?.value || '').trim();
    if (!q) return;
    const spinner = document.getElementById('sv-search-spinner');
    if (spinner) spinner.style.display = 'inline';
    try {
      const data = await apiGet(`/api/stock-transfers/distribution/search?q=${encodeURIComponent(q)}&limit=15`);
      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 1) {
        // Single match — load distribution directly
        svHideDropdown();
        await svLoadDistribution(rows[0].sku_id);
      } else {
        svRenderSearchDropdown(rows);
      }
    } catch (err) {
      svShowError(err.message);
    } finally {
      if (spinner) spinner.style.display = 'none';
    }
  };

  function svHideDropdown() {
    const el = document.getElementById('sv-search-results');
    if (el) el.style.display = 'none';
  }

  function svRenderSearchDropdown(rows) {
    const el = document.getElementById('sv-search-results');
    if (!el) return;
    if (!rows.length) {
      el.innerHTML = '<div style="padding:12px;color:var(--text3);font-size:12.5px;text-align:center">No SKUs found</div>';
      el.style.display = 'block';
      return;
    }
    el.innerHTML = rows.map((r) => {
      const hasTotalQty = r.total_stock != null;
      const available = svIsAvailable(r, ['total_stock', 'warehouse_qty', 'stock_qty']);
      const stockBadge = hasTotalQty
        ? (r.total_stock > 0
          ? `<span style="background:var(--greenL);color:var(--green);padding:1px 6px;border-radius:10px;font-size:10.5px;font-weight:600;margin-left:6px">${r.total_stock} in stock</span>`
          : `<span style="background:var(--redL);color:var(--red);padding:1px 6px;border-radius:10px;font-size:10.5px;font-weight:600;margin-left:6px">Out of stock</span>`)
        : `<span style="background:${available ? 'var(--greenL)' : 'var(--redL)'};color:${available ? 'var(--green)' : 'var(--red)'};padding:1px 6px;border-radius:10px;font-size:10.5px;font-weight:600;margin-left:6px">${available ? 'Available' : 'Out of stock'}</span>`;
      const whBadge = r.warehouse_qty != null
        ? (r.warehouse_qty > 0
          ? `<span style="background:var(--accL);color:var(--acc);padding:1px 6px;border-radius:10px;font-size:10.5px;margin-left:4px">${r.warehouse_qty} WH</span>`
          : '')
        : '';
      return `<div onclick="svSelectSku(${r.sku_id})"
          style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .15s"
          onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''">
          <div style="font-weight:600;font-size:13px" class="mono">${r.sku_code}${stockBadge}${whBadge}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:2px">${r.product_name || '—'} &nbsp;·&nbsp; ${r.colour_name || '—'} &nbsp;·&nbsp; <span style="color:var(--text3)">₹${Number(r.sale_price||0).toLocaleString('en-IN')}</span></div>
        </div>`;
    }).join('');
    el.style.display = 'block';
  }

  window.svSelectSku = async function(skuId) {
    svHideDropdown();
    await svLoadDistribution(skuId);
  };

  async function svLoadDistribution(skuId) {
    svShow('sv-empty-state');
    const errorEl = document.getElementById('sv-error-state');
    if (errorEl) errorEl.style.display = 'none';
    try {
      const data = await apiGet(`/api/stock-transfers/distribution/${skuId}`);
      svRenderDistribution(data);
    } catch (err) {
      svShowError(err.message);
    }
  }

  function svShowError(msg) {
    svShow('sv-empty-state');
    const el = document.getElementById('sv-error-state');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  function svRenderDistribution(data) {
    const sku = data.sku;
    const locs = data.locations || [];
    const hasTotalQty = sku && sku.total_stock != null;
    const skuAvailable = svIsAvailable(sku, ['total_stock', 'warehouse_qty', 'store_qty']);
    const locQtyList = locs
      .map((l) => Number(l.qty))
      .filter((n) => Number.isFinite(n));

    // SKU header
    const headerEl = document.getElementById('sv-sku-header');
    if (headerEl) {
      headerEl.innerHTML = `
        <div>
          <div class="mono" style="font-size:13px;color:var(--acc);margin-bottom:2px">${sku.sku_code}</div>
          <div class="fw6" style="font-size:15px">${sku.product_name || '—'} · ${sku.colour_name || '—'}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:3px">${[sku.brand_name, sku.product_type].filter(Boolean).join(' · ')} &nbsp;·&nbsp; <span class="mono">₹${Number(sku.sale_price||0).toLocaleString('en-IN')}</span></div>
        </div>
        <div style="text-align:right">
          <div class="xs td2">Total Stock</div>
          <div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:28px;font-weight:800;color:var(--acc)">${hasTotalQty ? sku.total_stock : (skuAvailable ? 'Available' : 'Not available')}</div>
          <div class="xs td2">${hasTotalQty ? 'units across all locations' : 'network stock status'}</div>
        </div>`;
    }

    // Location rows
    const locsEl = document.getElementById('sv-locations-list');
    if (locsEl) {
      if (!locs.length) {
        locsEl.innerHTML = '<div style="padding:16px;color:var(--text3);font-size:13px;text-align:center">No stock in any location</div>';
      } else {
        const maxQty = locQtyList.length ? Math.max(...locQtyList, 1) : 1;
        const pct = (q) => Math.round((q / maxQty) * 100);
        const locIcon = (t) => t === 'WAREHOUSE' ? '🏭' : t === 'STORE' || t === 'AT_STORE' ? '🏪' : t === 'IN_TRANSIT' ? '🚚' : '📦';
        const locBadge = (t) => {
          if (t === 'WAREHOUSE') return `<span class="b b-green xs">Warehouse</span>`;
          if (t === 'STORE' || t === 'AT_STORE') return `<span class="b b-gray xs">At Store</span>`;
          if (t === 'IN_TRANSIT') return `<span class="b b-orange xs">In Transit</span>`;
          return `<span class="b b-teal xs">${t}</span>`;
        };

        const firstLocQty = Number(locs[0] && locs[0].qty);
        const barPct = Number.isFinite(firstLocQty) ? pct(firstLocQty) : 0;
        locsEl.innerHTML = `
          <div class="pbar-wrap" style="height:8px;margin-bottom:20px">
            <div class="pbar" style="width:${barPct}%;background:linear-gradient(90deg,var(--acc),var(--teal))"></div>
          </div>
          ${locs.map((l) => `
            <div class="loc-row">
              <div class="loc-icon">${locIcon(l.location_type)}</div>
              <div style="flex:1">
                <div class="loc-name">${l.location_name}</div>
                <div class="loc-sub">Updated: ${l.last_updated || '—'}</div>
              </div>
              <div style="text-align:right">
                <div class="loc-units">${l.qty != null ? l.qty : (svIsAvailable(l, ['qty']) ? 'Available' : 'N/A')}</div>
                ${locBadge(l.location_type)}
              </div>
              ${l.location_type === 'WAREHOUSE' ? `<button class="btn xs primary" onclick="nav('stock-transfer',document.querySelector('.nav-item[onclick*=\\'stock-transfer\\']'))">Transfer</button>` : ''}
            </div>`).join('')}`;
      }
    }

    // Stock accounting summary — always show Warehouse + Stores rows
    const accEl = document.getElementById('sv-accounting');
    if (accEl) {
      // Prefer explicit fields from RS1 header (warehouse_qty / store_qty added in SP update)
      const hasWarehouseQty = sku.warehouse_qty != null;
      const hasStoreQty = sku.store_qty != null;
      const hasAnyBreakdownQty = hasWarehouseQty || hasStoreQty;
      const wqty = hasWarehouseQty
        ? Number(sku.warehouse_qty)
        : locs
          .filter((l) => l.location_type === 'WAREHOUSE' && l.qty != null)
          .reduce((s, l) => s + Number(l.qty || 0), 0);
      const sqty = hasStoreQty
        ? Number(sku.store_qty)
        : locs
          .filter((l) => (l.location_type === 'STORE' || l.location_type === 'AT_STORE') && l.qty != null)
          .reduce((s, l) => s + Number(l.qty || 0), 0);
      const tqty = hasAnyBreakdownQty ? (wqty + sqty) : (hasTotalQty ? sku.total_stock : null);
      const warehouseAvailable = hasAnyBreakdownQty ? wqty > 0 : locs.some((l) => l.location_type === 'WAREHOUSE' && svIsAvailable(l, ['qty']));
      const storesAvailable = hasAnyBreakdownQty ? sqty > 0 : locs.some((l) => (l.location_type === 'STORE' || l.location_type === 'AT_STORE') && svIsAvailable(l, ['qty']));
      const totalAvailable = tqty != null ? Number(tqty) > 0 : skuAvailable;

      const warehouseRow = `
        <div class="flex ic" style="justify-content:space-between;padding:4px 0">
          <span class="xs td2" style="display:flex;align-items:center;gap:4px">🏭 <span>${primaryWarehouseLabelHtml()}</span></span>
          <span class="mono fw6" style="color:${warehouseAvailable ? 'var(--green)' : 'var(--text3)'}">${hasAnyBreakdownQty ? wqty : (warehouseAvailable ? 'Available' : 'N/A')}</span>
        </div>`;
      const storeRow = `
        <div class="flex ic" style="justify-content:space-between;padding:4px 0">
          <span class="xs td2" style="display:flex;align-items:center;gap:4px">🏪 <span>At Stores</span></span>
          <span class="mono fw6">${hasAnyBreakdownQty ? sqty : (storesAvailable ? 'Available' : 'N/A')}</span>
        </div>`;

      accEl.innerHTML = warehouseRow + storeRow + `
        <hr class="sep" style="margin:4px 0">
        <div class="flex ic" style="justify-content:space-between"><span class="sm-txt fw6">Total</span><span class="mono fw6" style="color:var(--acc)">${tqty != null ? tqty : (totalAvailable ? 'Available' : 'Not available')}</span></div>
        <hr class="sep" style="margin:4px 0">
        <div class="flex ic" style="justify-content:space-between"><span class="xs td2">Sale Price</span><span class="mono xs">₹${Number(sku.sale_price||0).toLocaleString('en-IN')}</span></div>
        <div class="flex ic" style="justify-content:space-between"><span class="xs td2">Barcode</span><span class="mono xs">${sku.barcode || '—'}</span></div>`;
    }

    svShow('sv-distribution-panel');
  }

  window.loadStockView = function() {
    svShow('sv-empty-state');
    const qEl = document.getElementById('sv-search-q');
    if (qEl) qEl.focus();
  };

  // ── Lens config (POS catalogue) — /api/foundry/lens-config ────────────────────
  let _lcActivePage = 'lens-packages';
  function lcCanEdit() {
    return foundryCatalogueCanEditPage(_lcActivePage);
  }
  let _lcData = null;
  let _lcSelCatId = null;
  let _lcSelPkgId = null;
  const _lcMatrixTimers = Object.create(null);

  function lcEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function lcPosLabel(pb, pn, legacy) {
    const b = String(pb || '').trim();
    const n = String(pn || '').trim();
    const l = String(legacy || '').trim();
    if (b && n) return `${b} · ${n}`;
    if (n) return n;
    if (b) return b;
    return l || '—';
  }

  function lcBool(v) {
    if (v === true || v === 1) return true;
    if (v === false || v === 0) return false;
    if (typeof v === 'string' && (v === '1' || v === 'true')) return true;
    return Boolean(v);
  }

  function lcApplyEditVisibility() {
    ['lc-btn-add-cat', 'lc-btn-add-pkg', 'lc-pkg-th-edit', 'lc-pkg-save-row', 'lc-addon-new-btn', 'lc-addon-th-actions'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = lcCanEdit() ? '' : 'none';
    });
    const wr = document.getElementById('lc-pkg-addons-wrap');
    if (wr) wr.style.display = lcCanEdit() && _lcSelPkgId ? '' : 'none';
  }

  async function lcFetchConfig() {
    return apiGet('/api/foundry/lens-config');
  }

  function lcPackageAddonSet(pkgId) {
    if (!_lcData || !pkgId) return [];
    const set = new Set(
      (_lcData.packageAddons || []).filter((l) => Number(l.package_id) === Number(pkgId)).map((l) => Number(l.addon_id))
    );
    return Array.from(set);
  }

  function lcScheduleMatrixSave(packageId) {
    const pid = Number(packageId);
    if (!lcCanEdit() || !Number.isFinite(pid)) return;
    const key = String(pid);
    if (_lcMatrixTimers[key]) clearTimeout(_lcMatrixTimers[key]);
    _lcMatrixTimers[key] = setTimeout(async () => {
      delete _lcMatrixTimers[key];
      const row = document.querySelector(`tr[data-lc-pkg-row="${pid}"]`);
      if (!row) return;
      const cbs = row.querySelectorAll('input[data-lc-aid]');
      const ids = [];
      cbs.forEach((cb) => {
        if (cb.checked) ids.push(Number(cb.getAttribute('data-lc-aid')));
      });
      try {
        await apiPut(`/api/foundry/lens-config/packages/${pid}/addons`, { addon_ids: ids });
        if (_lcData && Array.isArray(_lcData.packageAddons)) {
          _lcData.packageAddons = _lcData.packageAddons.filter((x) => Number(x.package_id) !== pid);
          ids.forEach((aid) => _lcData.packageAddons.push({ package_id: pid, addon_id: aid }));
        }
      } catch (err) {
        if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Save failed');
        if (typeof window.loadLensMatrixPage === 'function') window.loadLensMatrixPage();
      }
    }, 450);
  }

  function lcSchedulePkgEditorAddonPersist() {
    const pid = Number(document.getElementById('lc-pkg-id') && document.getElementById('lc-pkg-id').value);
    if (!lcCanEdit() || !Number.isFinite(pid) || pid < 1) return;
    const wrap = document.getElementById('lc-pkg-addons-chk');
    if (!wrap) return;
    const ids = [];
    wrap.querySelectorAll('input[type="checkbox"][data-lc-pkg-addon]').forEach((cb) => {
      if (cb.checked) ids.push(Number(cb.getAttribute('data-lc-pkg-addon')));
    });
    const key = 'editor-' + pid;
    if (_lcMatrixTimers[key]) clearTimeout(_lcMatrixTimers[key]);
    _lcMatrixTimers[key] = setTimeout(async () => {
      delete _lcMatrixTimers[key];
      try {
        await apiPut(`/api/foundry/lens-config/packages/${pid}/addons`, { addon_ids: ids });
        if (_lcData && Array.isArray(_lcData.packageAddons)) {
          _lcData.packageAddons = _lcData.packageAddons.filter((x) => Number(x.package_id) !== pid);
          ids.forEach((aid) => _lcData.packageAddons.push({ package_id: pid, addon_id: aid }));
        }
      } catch (err) {
        if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Add-on links failed');
      }
    }, 400);
  }

  function lcRenderCategoryRows() {
    const tb = document.getElementById('lc-cat-tbody');
    if (!tb || !_lcData) return;
    const table = tb.closest && tb.closest('table');
    if (table && !table.dataset.lcCategoryBrandHidden) {
      const firstHead = table.querySelector('thead th:first-child');
      if (firstHead && /pos\s*brand/i.test(firstHead.textContent || '')) {
        firstHead.remove();
      }
      table.dataset.lcCategoryBrandHidden = '1';
    }
    const cats = _lcData.categories || [];
    if (!cats.length) {
      tb.innerHTML = '<tr><td class="td2 p12" style="color:var(--text3)">No categories</td></tr>';
      return;
    }
    tb.innerHTML = cats
      .map((c) => {
        const active = lcBool(c.is_active);
        const sel = Number(_lcSelCatId) === Number(c.id);
        const dot = active ? '<span class="b b-green xs">On</span>' : '<span class="b b-gray xs">Off</span>';
        const btn = lcCanEdit()
          ? `<button type="button" class="btn xs" onclick="event.stopPropagation();window.lcEditCategory && window.lcEditCategory(${Number(c.id)})">Edit</button>`
          : '';
        const name = lcEsc(String(c.pos_name || c.name || '').trim() || '—');
        return `<tr class="tr-link${sel ? ' lc-cat-sel' : ''}" data-lc-cat="${Number(c.id)}" style="${sel ? 'background:var(--accL);' : ''}"><td class="td2"><div class="fw6">${name}</div><div class="xs td2">${dot} ${btn}</div></td></tr>`;
      })
      .join('');
    tb.querySelectorAll('tr[data-lc-cat]').forEach((tr) => {
      tr.addEventListener('click', () => {
        _lcSelCatId = Number(tr.getAttribute('data-lc-cat'));
        lcRenderCategoryRows();
        lcRenderPackageRows();
        lcRefreshPkgEditor();
      });
    });
  }

  function lcRenderPackageRows() {
    const tb = document.getElementById('lc-pkg-tbody');
    const lbl = document.getElementById('lc-pkg-cat-label');
    if (!tb || !_lcData) return;
    const cats = _lcData.categories || [];
    const cat = cats.find((c) => Number(c.id) === Number(_lcSelCatId));
    if (lbl) lbl.textContent = cat ? `· ${lcPosLabel(cat.pos_brand, cat.pos_name, cat.name)}` : '';
    const pkgs = (_lcData.packages || []).filter((p) => Number(p.category_id) === Number(_lcSelCatId));
    if (!pkgs.length) {
      tb.innerHTML = `<tr><td colspan="${lcCanEdit() ? 5 : 4}" class="td2 p12" style="color:var(--text3)">No packages in this category</td></tr>`;
      return;
    }
    const colspan = lcCanEdit() ? 5 : 4;
    tb.innerHTML = pkgs
      .map((p) => {
        const active = lcBool(p.is_active);
        const dot = active ? '<span class="b b-green xs">Yes</span>' : '<span class="b b-gray xs">No</span>';
        const edit = lcCanEdit()
          ? `<td class="tc"><button type="button" class="btn xs primary" onclick="event.stopPropagation();window.lcSelectPackage && window.lcSelectPackage(${Number(p.id)})">Edit</button></td>`
          : '';
        return `<tr class="tr-link${Number(_lcSelPkgId) === Number(p.id) ? ' lc-pkg-sel' : ''}" data-lc-pkg="${Number(p.id)}" style="${Number(_lcSelPkgId) === Number(p.id) ? 'background:var(--accL);' : ''}"><td>${lcEsc(String(p.pos_brand || '').trim() || '—')}</td><td>${lcEsc(String(p.pos_name || p.name || '').trim() || '—')}</td><td class="tc mono">${inr(p.price)}</td><td class="tc">${dot}</td>${edit}</tr>`;
      })
      .join('');
    tb.querySelectorAll('tr[data-lc-pkg]').forEach((tr) => {
      tr.addEventListener('click', () => {
        window.lcSelectPackage(Number(tr.getAttribute('data-lc-pkg')));
      });
    });
  }

  function lcRefreshPkgEditor() {
    const empty = document.getElementById('lc-pkg-editor-empty');
    const form = document.getElementById('lc-pkg-editor-form');
    const hint = document.getElementById('lc-pkg-editor-hint');
    const aw = document.getElementById('lc-pkg-addons-wrap');
    if (!_lcSelPkgId || !_lcData) {
      if (empty) empty.style.display = '';
      if (form) form.style.display = 'none';
      if (hint) hint.textContent = 'Select a package row or create one.';
      if (aw) aw.style.display = 'none';
      lcApplyEditVisibility();
      return;
    }
    const p = (_lcData.packages || []).find((x) => Number(x.id) === Number(_lcSelPkgId));
    if (!p) {
      if (empty) empty.style.display = '';
      if (form) form.style.display = 'none';
      lcApplyEditVisibility();
      return;
    }
    if (empty) empty.style.display = 'none';
    if (form) form.style.display = '';
    if (hint) hint.textContent = `Editing package #${p.id}`;
    document.getElementById('lc-pkg-id').value = String(p.id);
    document.getElementById('lc-pkg-pos-brand').value = p.pos_brand || '';
    document.getElementById('lc-pkg-pos-name').value = p.pos_name || p.name || '';
    document.getElementById('lc-pkg-int-brand').value = p.internal_brand || '';
    document.getElementById('lc-pkg-int-name').value = p.internal_name || p.name || '';
    document.getElementById('lc-pkg-price').value = p.price != null ? String(p.price) : '';
    document.getElementById('lc-pkg-sort').value = String(p.sort_order != null ? p.sort_order : 0);
    document.getElementById('lc-pkg-active').checked = lcBool(p.is_active);
    const feat1 = document.getElementById('lc-pkg-card-feat1');
    const feat2 = document.getElementById('lc-pkg-card-feat2');
    const warr = document.getElementById('lc-pkg-card-warranty');
    const warrTone = document.getElementById('lc-pkg-card-warranty-tone');
    if (feat1) feat1.value = p.card_feat_line1 || '';
    if (feat2) feat2.value = p.card_feat_line2 || '';
    if (warr) warr.value = p.card_warranty_label || '';
    if (warrTone) warrTone.value = String(p.card_warranty_tone != null ? p.card_warranty_tone : 1);
    const chk = document.getElementById('lc-pkg-addons-chk');
    if (chk && lcCanEdit()) {
      const allowed = new Set(lcPackageAddonSet(p.id));
      const addons = (_lcData.addons || []).filter((a) => lcBool(a.is_active));
      chk.innerHTML = addons
        .map((a) => {
          const id = Number(a.id);
          const on = allowed.has(id);
          return `<label class="flex ic g2" style="font-size:13px;cursor:pointer"><input type="checkbox" data-lc-pkg-addon="${id}" ${on ? 'checked' : ''}> ${lcEsc(lcPosLabel(a.pos_brand, a.pos_name, a.name))} <span class="xs td2 mono">(${inr(a.price)})</span></label>`;
        })
        .join('');
      chk.querySelectorAll('input[data-lc-pkg-addon]').forEach((cb) => {
        cb.addEventListener('change', () => lcSchedulePkgEditorAddonPersist());
      });
    }
    if (aw) aw.style.display = lcCanEdit() ? '' : 'none';
    lcApplyEditVisibility();
  }

  window.lcSelectPackage = function (id) {
    _lcSelPkgId = Number(id);
    lcRenderPackageRows();
    lcRefreshPkgEditor();
  };

  window.lcOpenNewPackage = function () {
    if (!lcCanEdit()) return;
    if (!_lcSelCatId) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Select a category first.');
      return;
    }
    _lcSelPkgId = null;
    lcRenderPackageRows();
    const empty = document.getElementById('lc-pkg-editor-empty');
    const form = document.getElementById('lc-pkg-editor-form');
    const hint = document.getElementById('lc-pkg-editor-hint');
    if (empty) empty.style.display = 'none';
    if (form) form.style.display = '';
    if (hint) hint.textContent = 'New package (unsaved)';
    document.getElementById('lc-pkg-id').value = '';
    document.getElementById('lc-pkg-pos-brand').value = '';
    document.getElementById('lc-pkg-pos-name').value = '';
    document.getElementById('lc-pkg-int-brand').value = '';
    document.getElementById('lc-pkg-int-name').value = '';
    document.getElementById('lc-pkg-price').value = '0';
    document.getElementById('lc-pkg-sort').value = '0';
    document.getElementById('lc-pkg-active').checked = true;
    const feat1 = document.getElementById('lc-pkg-card-feat1');
    const feat2 = document.getElementById('lc-pkg-card-feat2');
    const warr = document.getElementById('lc-pkg-card-warranty');
    const warrTone = document.getElementById('lc-pkg-card-warranty-tone');
    if (feat1) feat1.value = '';
    if (feat2) feat2.value = '';
    if (warr) warr.value = '';
    if (warrTone) warrTone.value = '1';
    const chk = document.getElementById('lc-pkg-addons-chk');
    if (chk) chk.innerHTML = '';
    document.getElementById('lc-pkg-addons-wrap').style.display = 'none';
    lcApplyEditVisibility();
  };

  window.lcSavePackage = async function () {
    if (!lcCanEdit()) return;
    const posNameEl = document.getElementById('lc-pkg-pos-name');
    const priceEl = document.getElementById('lc-pkg-price');
    if (!posNameEl || !String(posNameEl.value || '').trim()) {
      if (typeof cosmosFieldError === 'function') cosmosFieldError(posNameEl, 'Required');
      return;
    }
    if (typeof cosmosFieldClear === 'function') cosmosFieldClear(posNameEl);
    const price = parseFloat(priceEl && priceEl.value);
    if (!Number.isFinite(price) || price < 0) {
      if (typeof cosmosFieldError === 'function') cosmosFieldError(priceEl, 'Valid price required');
      return;
    }
    if (typeof cosmosFieldClear === 'function') cosmosFieldClear(priceEl);
    const btn = document.getElementById('lc-pkg-save-btn');
    if (typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    const body = {
      category_id: Number(_lcSelCatId),
      pos_brand: (document.getElementById('lc-pkg-pos-brand').value || '').trim(),
      pos_name: String(posNameEl.value || '').trim(),
      internal_brand: (document.getElementById('lc-pkg-int-brand').value || '').trim(),
      internal_name: (document.getElementById('lc-pkg-int-name').value || '').trim() || String(posNameEl.value || '').trim(),
      price,
      sort_order: parseInt(document.getElementById('lc-pkg-sort').value, 10) || 0,
      is_active: document.getElementById('lc-pkg-active').checked,
      card_feat_line1: (document.getElementById('lc-pkg-card-feat1') && document.getElementById('lc-pkg-card-feat1').value || '').trim() || null,
      card_feat_line2: (document.getElementById('lc-pkg-card-feat2') && document.getElementById('lc-pkg-card-feat2').value || '').trim() || null,
      card_warranty_label: (document.getElementById('lc-pkg-card-warranty') && document.getElementById('lc-pkg-card-warranty').value || '').trim() || null,
      card_warranty_tone: parseInt(document.getElementById('lc-pkg-card-warranty-tone') && document.getElementById('lc-pkg-card-warranty-tone').value, 10) || 1
    };
    const idStr = document.getElementById('lc-pkg-id').value;
    try {
      let newId;
      if (idStr) {
        await apiPut(`/api/foundry/lens-config/packages/${encodeURIComponent(idStr)}`, body);
        newId = Number(idStr);
      } else {
        const r = await apiPost('/api/foundry/lens-config/packages', body);
        newId = r && r.id ? Number(r.id) : null;
      }
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Package saved');
      if (typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn);
      else if (typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
      _lcData = await lcFetchConfig();
      if (newId) _lcSelPkgId = newId;
      document.getElementById('lc-pkg-id').value = _lcSelPkgId ? String(_lcSelPkgId) : '';
      lcRenderCategoryRows();
      lcRenderPackageRows();
      lcRefreshPkgEditor();
    } catch (err) {
      if (typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Save failed');
    }
  };

  window.loadLensPackagesPage = async function () {
    _lcActivePage = 'lens-packages';
    const ctb = document.getElementById('lc-cat-tbody');
    const ptb = document.getElementById('lc-pkg-tbody');
    if (!ctb || !ptb) return;
    if (typeof cosmosSkeletonTable === 'function') {
      cosmosSkeletonTable('lc-cat-tbody', 1, 4);
      cosmosSkeletonTable('lc-pkg-tbody', lcCanEdit() ? 5 : 4, 6);
    }
    lcApplyEditVisibility();
    try {
      _lcData = await lcFetchConfig();
      const cats = _lcData.categories || [];
      if (!_lcSelCatId && cats.length) _lcSelCatId = Number(cats[0].id);
      if (_lcSelCatId && !cats.some((c) => Number(c.id) === Number(_lcSelCatId))) {
        _lcSelCatId = cats.length ? Number(cats[0].id) : null;
      }
      lcRenderCategoryRows();
      lcRenderPackageRows();
      if (_lcSelPkgId && !(_lcData.packages || []).some((p) => Number(p.id) === Number(_lcSelPkgId))) {
        _lcSelPkgId = null;
      }
      lcRefreshPkgEditor();
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Could not load lens config');
      ctb.innerHTML = '<tr><td class="td2 p12" style="color:var(--red)">Failed to load</td></tr>';
      ptb.innerHTML = '';
    }
  };

  window.lcEditCategory = function (id) {
    if (!lcCanEdit() || !_lcData) return;
    const c = (_lcData.categories || []).find((x) => Number(x.id) === Number(id));
    if (!c) return;
    document.getElementById('lc-cat-id').value = String(c.id);
    document.getElementById('lc-cat-pos-brand').value = c.pos_brand || '';
    document.getElementById('lc-cat-pos-name').value = c.pos_name || c.name || '';
    document.getElementById('lc-cat-int-brand').value = c.internal_brand || '';
    document.getElementById('lc-cat-int-name').value = c.internal_name || '';
    document.getElementById('lc-cat-sort').value = String(c.sort_order != null ? c.sort_order : 0);
    document.getElementById('lc-cat-active').checked = lcBool(c.is_active);
    document.getElementById('lc-cat-notes').value = c.notes || '';
    // Wizard fields
    document.getElementById('lc-cat-show-wizard').checked = c.show_in_pos_wizard !== false && c.show_in_pos_wizard !== 0;
    document.getElementById('lc-cat-wizard-subtitle').value = c.wizard_subtitle || '';
    document.getElementById('lc-cat-wizard-icon').value = c.wizard_icon || '';
    document.getElementById('lc-cat-wizard-tone').value = String(c.wizard_tone || 1);
    openM('lc-modal-cat');
  };

  window.lcSaveCategory = async function () {
    if (!lcCanEdit()) return;
    const posName = document.getElementById('lc-cat-pos-name');
    if (!String(posName.value || '').trim()) {
      if (typeof cosmosFieldError === 'function') cosmosFieldError(posName, 'Required');
      return;
    }
    if (typeof cosmosFieldClear === 'function') cosmosFieldClear(posName);
    const btn = document.getElementById('lc-cat-save-btn');
    if (typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    const body = {
      pos_brand: (document.getElementById('lc-cat-pos-brand').value || '').trim(),
      pos_name: String(posName.value || '').trim(),
      internal_brand: (document.getElementById('lc-cat-int-brand').value || '').trim(),
      internal_name: (document.getElementById('lc-cat-int-name').value || '').trim() || String(posName.value || '').trim(),
      sort_order: parseInt(document.getElementById('lc-cat-sort').value, 10) || 0,
      is_active: document.getElementById('lc-cat-active').checked,
      notes: (document.getElementById('lc-cat-notes').value || '').trim() || null,
      show_in_pos_wizard: document.getElementById('lc-cat-show-wizard').checked,
      wizard_subtitle: (document.getElementById('lc-cat-wizard-subtitle').value || '').trim() || null,
      wizard_icon: (document.getElementById('lc-cat-wizard-icon').value || '').trim() || null,
      wizard_tone: parseInt(document.getElementById('lc-cat-wizard-tone').value, 10) || 1
    };
    const idStr = document.getElementById('lc-cat-id').value;
    try {
      if (idStr) {
        await apiPut(`/api/foundry/lens-config/categories/${encodeURIComponent(idStr)}`, body);
      } else {
        await apiPost('/api/foundry/lens-config/categories', body);
      }
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Category saved');
      if (typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn);
      else if (typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
      closeM('lc-modal-cat');
      _lcData = await lcFetchConfig();
      const cats = _lcData.categories || [];
      if (!_lcSelCatId && cats.length) _lcSelCatId = Number(cats[0].id);
      lcRenderCategoryRows();
      lcRenderPackageRows();
      lcRefreshPkgEditor();
    } catch (err) {
      if (typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Save failed');
    }
  };

  window.lcOpenNewCategory = function () {
    if (!lcCanEdit()) return;
    document.getElementById('lc-cat-id').value = '';
    document.getElementById('lc-cat-pos-brand').value = '';
    document.getElementById('lc-cat-pos-name').value = '';
    document.getElementById('lc-cat-int-brand').value = '';
    document.getElementById('lc-cat-int-name').value = '';
    document.getElementById('lc-cat-sort').value = '0';
    document.getElementById('lc-cat-active').checked = true;
    document.getElementById('lc-cat-notes').value = '';
    document.getElementById('lc-cat-show-wizard').checked = true;
    document.getElementById('lc-cat-wizard-subtitle').value = '';
    document.getElementById('lc-cat-wizard-icon').value = '';
    document.getElementById('lc-cat-wizard-tone').value = '1';
    openM('lc-modal-cat');
  };

  window.lcOpenNewAddon = function () {
    if (!lcCanEdit()) return;
    document.getElementById('lc-ad-id').value = '';
    document.getElementById('lc-ad-pos-brand').value = '';
    document.getElementById('lc-ad-pos-name').value = '';
    document.getElementById('lc-ad-int-brand').value = '';
    document.getElementById('lc-ad-int-name').value = '';
    document.getElementById('lc-ad-price').value = '0';
    document.getElementById('lc-ad-sort').value = '0';
    document.getElementById('lc-ad-active').checked = true;
    openM('lc-modal-addon');
  };

  window.lcEditAddon = function (id) {
    if (!lcCanEdit() || !_lcData) return;
    const a = (_lcData.addons || []).find((x) => Number(x.id) === Number(id));
    if (!a) return;
    document.getElementById('lc-ad-id').value = String(a.id);
    document.getElementById('lc-ad-pos-brand').value = a.pos_brand || '';
    document.getElementById('lc-ad-pos-name').value = a.pos_name || a.name || '';
    document.getElementById('lc-ad-int-brand').value = a.internal_brand || '';
    document.getElementById('lc-ad-int-name').value = a.internal_name || a.name || '';
    document.getElementById('lc-ad-price').value = a.price != null ? String(a.price) : '0';
    document.getElementById('lc-ad-sort').value = String(a.sort_order != null ? a.sort_order : 0);
    document.getElementById('lc-ad-active').checked = lcBool(a.is_active);
    openM('lc-modal-addon');
  };

  window.lcSaveAddon = async function () {
    if (!lcCanEdit()) return;
    const nm = document.getElementById('lc-ad-pos-name');
    const pr = document.getElementById('lc-ad-price');
    if (!String(nm.value || '').trim()) {
      if (typeof cosmosFieldError === 'function') cosmosFieldError(nm, 'Required');
      return;
    }
    const price = parseFloat(pr.value);
    if (!Number.isFinite(price) || price < 0) {
      if (typeof cosmosFieldError === 'function') cosmosFieldError(pr, 'Valid price');
      return;
    }
    if (typeof cosmosFieldClear === 'function') {
      cosmosFieldClear(nm);
      cosmosFieldClear(pr);
    }
    const btn = document.getElementById('lc-ad-save-btn');
    if (typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    const body = {
      pos_brand: (document.getElementById('lc-ad-pos-brand').value || '').trim(),
      pos_name: String(nm.value || '').trim(),
      internal_brand: (document.getElementById('lc-ad-int-brand').value || '').trim(),
      internal_name: (document.getElementById('lc-ad-int-name').value || '').trim() || String(nm.value || '').trim(),
      price,
      sort_order: parseInt(document.getElementById('lc-ad-sort').value, 10) || 0,
      is_active: document.getElementById('lc-ad-active').checked
    };
    const idStr = document.getElementById('lc-ad-id').value;
    try {
      if (idStr) {
        await apiPut(`/api/foundry/lens-config/addons/${encodeURIComponent(idStr)}`, body);
      } else {
        await apiPost('/api/foundry/lens-config/addons', body);
      }
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Add-on saved');
      if (typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn);
      else if (typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
      closeM('lc-modal-addon');
      _lcData = await lcFetchConfig();
      if (document.getElementById('lc-addon-tbody')) window.loadLensAddonsPage();
    } catch (err) {
      if (typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Save failed');
    }
  };

  window.loadLensAddonsPage = async function () {
    _lcActivePage = 'lens-addons';
    const tb = document.getElementById('lc-addon-tbody');
    if (!tb) return;
    const ncol = lcCanEdit() ? 7 : 6;
    if (typeof cosmosSkeletonTable === 'function') cosmosSkeletonTable('lc-addon-tbody', ncol, 8);
    lcApplyEditVisibility();
    try {
      if (!_lcData) _lcData = await lcFetchConfig();
      const rows = _lcData.addons || [];
      if (!rows.length) {
        tb.innerHTML = `<tr><td colspan="${ncol}" class="td2 p12">No add-ons yet</td></tr>`;
        return;
      }
      tb.innerHTML = rows
        .map((a) => {
          const on = lcBool(a.is_active);
          const dot = on ? '<span class="b b-green xs">Yes</span>' : '<span class="b b-gray xs">No</span>';
          const ed = lcCanEdit()
            ? `<td class="tc"><button type="button" class="btn xs" onclick="window.lcEditAddon(${Number(a.id)})">Edit</button></td>`
            : '';
          return `<tr><td>${lcEsc(String(a.pos_brand || '').trim() || '—')}</td><td>${lcEsc(String(a.pos_name || a.name || '').trim() || '—')}</td><td class="xs" style="color:var(--text3)">${lcEsc(String(a.internal_brand || '').trim() || '—')}</td><td class="xs" style="color:var(--gold)">${lcEsc(String(a.internal_name || a.name || '').trim() || '—')}</td><td class="tc mono">${inr(a.price)}</td><td class="tc">${dot}</td>${ed}</tr>`;
        })
        .join('');
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Load failed');
    }
  };

  window.loadLensMatrixPage = async function () {
    _lcActivePage = 'lens-package-addons';
    const thead = document.getElementById('lc-matrix-thead');
    const tb = document.getElementById('lc-matrix-tbody');
    if (!thead || !tb) return;
    thead.innerHTML = '<tr><th>Package</th></tr>';
    tb.innerHTML = '';
    if (typeof cosmosSkeletonTable === 'function') cosmosSkeletonTable('lc-matrix-tbody', 4, 3);
    try {
      if (!_lcData) _lcData = await lcFetchConfig();
      const addons = (_lcData.addons || []).slice().sort((a, b) => (Number(a.sort_order)||0) - (Number(b.sort_order)||0) || Number(a.id) - Number(b.id));
      const pkgs = (_lcData.packages || []).slice().sort((a, b) => Number(a.category_id) - Number(b.category_id) || (Number(a.sort_order)||0) - (Number(b.sort_order)||0));
      const thr = ['<th>Package</th>'].concat(
        addons.map((a) => `<th class="tc xs">${lcEsc(lcPosLabel(a.pos_brand, a.pos_name, a.name))}</th>`)
      );
      thead.innerHTML = `<tr>${thr.join('')}</tr>`;
      if (!pkgs.length) {
        const span = 1 + addons.length;
        tb.innerHTML = `<tr><td colspan="${span}" class="td2 p12">No packages</td></tr>`;
        return;
      }
      tb.innerHTML = pkgs
        .map((p) => {
          const plab = lcEsc(lcPosLabel(p.pos_brand, p.pos_name, p.name));
          const allowed = new Set(lcPackageAddonSet(p.id));
          const cells = addons
            .map((a) => {
              const aid = Number(a.id);
              const on = allowed.has(aid);
              if (!lcCanEdit()) {
                return `<td class="tc">${on ? '●' : '—'}</td>`;
              }
              return `<td class="tc"><input type="checkbox" data-lc-aid="${aid}" ${on ? 'checked' : ''} aria-label="link"></td>`;
            })
            .join('');
          return `<tr data-lc-pkg-row="${Number(p.id)}"><td class="td2 fw6">${plab}</td>${cells}</tr>`;
        })
        .join('');
      if (lcCanEdit()) {
        tb.querySelectorAll('tr[data-lc-pkg-row]').forEach((tr) => {
          const pid = Number(tr.getAttribute('data-lc-pkg-row'));
          tr.querySelectorAll('input[data-lc-aid]').forEach((cb) => {
            cb.addEventListener('change', () => lcScheduleMatrixSave(pid));
          });
        });
      }
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Load failed');
    }
  };

  // ── Lens Wizard Rules page ─────────────────────────────────────────────────
  let _lwrProductTypes = [];
  let _lwrBridgeRows = [];
  let _lwrCategories = [];
  let _lwrSelectedPtKey = null;

  const LWR_POLICY_LABELS = {
    NEVER: 'Never (no lens wizard)',
    OPTIONAL: 'Optional (frame-only or with lenses)',
    REQUIRED: 'Required (always configure)'
  };

  function lwrRenderPolicyTable() {
    const tb = document.getElementById('lwr-policy-tbody');
    if (!tb) return;
    if (!_lwrProductTypes.length) {
      tb.innerHTML = '' +
        '<tr><td colspan="3" class="p12">' +
        '<div class="empty" style="text-align:left;padding:8px 0">' +
        '<div class="empty-ic" aria-hidden="true">📋</div>' +
        '<div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">No product types in POS config</div>' +
        '<div style="font-size:13px;color:var(--text2);margin-bottom:16px;max-width:52ch">' +
        'No product types configured. Add them in Command Unit → Foundry Settings → Product Types (single source for dropdowns and POS rules).' +
        '</div>' +
        '<button type="button" class="btn primary sm" onclick="window.loadLensWizardRulesPage && window.loadLensWizardRulesPage()">↻ Refresh</button>' +
        '</div></td></tr>';
      return;
    }
    tb.innerHTML = _lwrProductTypes.map(function (pt) {
      const opts = ['NEVER', 'OPTIONAL', 'REQUIRED'].map(function (v) {
        return `<option value="${v}" ${pt.lens_wizard_policy === v ? 'selected' : ''}>${lcEsc(LWR_POLICY_LABELS[v] || v)}</option>`;
      }).join('');
      const activeRows = _lwrBridgeRows.filter(function (r) { return r.product_type_key === pt.product_type_key; });
      const allowSummary = activeRows.length
        ? `${activeRows.length} categor${activeRows.length > 1 ? 'ies' : 'y'} restricted`
        : 'All eligible categories';
      const ptKeyEsc = lcEsc(pt.product_type_key);
      return `<tr class="tr-link" onclick="window.lwrSelectProductType && window.lwrSelectProductType('${ptKeyEsc}')">
        <td class="fw6">${ptKeyEsc}</td>
        <td>
          ${lcCanEdit()
            ? `<select class="inp-sel xs" data-lwr-pt="${ptKeyEsc}" onclick="event.stopPropagation()" onchange="window.lwrPolicyChange && window.lwrPolicyChange(this)">${opts}</select>`
            : `<span>${lcEsc(LWR_POLICY_LABELS[pt.lens_wizard_policy] || pt.lens_wizard_policy)}</span>`
          }
        </td>
        <td class="xs td2">${pt.lens_wizard_policy === 'NEVER' ? '—' : lcEsc(allowSummary)}</td>
      </tr>`;
    }).join('');
  }

  window.lwrPolicyChange = async function (sel) {
    const key = sel.getAttribute('data-lwr-pt');
    const policy = sel.value;
    try {
      await apiPut(`/api/foundry/lens-config/product-type-rules/${encodeURIComponent(key)}`, { lens_wizard_policy: policy });
      const pt = _lwrProductTypes.find(function (x) { return x.product_type_key === key; });
      if (pt) pt.lens_wizard_policy = policy;
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Policy updated');
      lwrRenderPolicyTable();
      if (_lwrSelectedPtKey === key) window.lwrSelectProductType(key);
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Failed to save');
    }
  };

  window.lwrSelectProductType = function (key) {
    _lwrSelectedPtKey = key;
    const pt = _lwrProductTypes.find(function (x) { return x.product_type_key === key; });
    const card = document.getElementById('lwr-allowlist-card');
    const title = document.getElementById('lwr-allowlist-title');
    const bodyEl = document.getElementById('lwr-allowlist-body');
    if (!card || !bodyEl) return;
    if (!pt || pt.lens_wizard_policy === 'NEVER') { card.style.display = 'none'; return; }
    card.style.display = '';
    if (title) title.textContent = `Lens categories for ${key}`;
    const existingIds = new Set(_lwrBridgeRows
      .filter(function (r) { return r.product_type_key === key; })
      .map(function (r) { return r.lens_category_id; })
    );
    const cats = (_lwrCategories || []).filter(function (c) { return c.is_active !== false && c.is_active !== 0; });
    if (!cats.length) {
      bodyEl.innerHTML = '<span class="td2 xs">No categories found. Add them in Lens packages first.</span>';
      return;
    }
    bodyEl.innerHTML = cats.map(function (c) {
      const label = lcPosLabel(c.pos_brand, c.pos_name, c.name);
      const checked = existingIds.has(Number(c.id));
      return `<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;min-width:180px;padding:4px 0">
        <input type="checkbox" data-lwr-cat-id="${Number(c.id)}" ${checked ? 'checked' : ''} ${lcCanEdit() ? '' : 'disabled'}>
        ${lcEsc(label)}
      </label>`;
    }).join('');
  };

  window.lwrSaveAllowList = async function () {
    if (!_lwrSelectedPtKey) return;
    const bodyEl = document.getElementById('lwr-allowlist-body');
    if (!bodyEl) return;
    const checkboxes = bodyEl.querySelectorAll('input[data-lwr-cat-id]');
    const anyChecked = Array.from(checkboxes).some(function (cb) { return cb.checked; });
    const category_ids = anyChecked
      ? Array.from(checkboxes).filter(function (cb) { return cb.checked; }).map(function (cb, i) {
          return { id: Number(cb.getAttribute('data-lwr-cat-id')), sort_order: i };
        })
      : [];
    const btn = document.getElementById('lwr-allowlist-save-btn');
    if (typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      await apiPut(`/api/foundry/lens-config/product-type-rules/${encodeURIComponent(_lwrSelectedPtKey)}`, { category_ids });
      if (typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn);
      else if (typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
      _lwrBridgeRows = _lwrBridgeRows.filter(function (r) { return r.product_type_key !== _lwrSelectedPtKey; });
      category_ids.forEach(function (x, i) {
        _lwrBridgeRows.push({ product_type_key: _lwrSelectedPtKey, lens_category_id: x.id, sort_order: i });
      });
      lwrRenderPolicyTable();
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Allow-list saved');
    } catch (err) {
      if (typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Failed to save');
    }
  };

  window.loadLensWizardRulesPage = async function () {
    _lcActivePage = 'lens-wizard-rules';
    const tb = document.getElementById('lwr-policy-tbody');
    if (!tb) return;
    if (typeof cosmosSkeletonTable === 'function') cosmosSkeletonTable('lwr-policy-tbody', 3, 3);
    const card = document.getElementById('lwr-allowlist-card');
    if (card) card.style.display = 'none';
    try {
      // Prefer full lens-config GET (includes productTypes + bridgeRows) so one round-trip
      // works even if an older proxy/process lacks GET …/product-type-rules.
      let data = await apiGetFirst([
        '/api/foundry/lens-config',
        '/api/foundry/lens-config/product-type-rules'
      ]);
      if (data && Array.isArray(data.categories)) {
        _lcData = data;
        _lwrProductTypes = data.productTypes || [];
        _lwrBridgeRows = data.bridgeRows || [];
        _lwrCategories = data.categories || [];
      } else {
        _lwrProductTypes = (data && data.productTypes) || [];
        _lwrBridgeRows = (data && data.bridgeRows) || [];
        if (!_lcData) _lcData = await lcFetchConfig();
        _lwrCategories = (_lcData && _lcData.categories) || [];
      }
      lwrRenderPolicyTable();
      if (_lwrSelectedPtKey) window.lwrSelectProductType(_lwrSelectedPtKey);
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Could not load rules');
      if (tb) tb.innerHTML = '<tr><td colspan="3" style="color:var(--red);padding:12px">Failed to load</td></tr>';
    }
  };

  const FOUNDRY_PAGE_PATHS = {
    dashboard: '/foundry/dashboard',
    purchases: '/foundry/purchases',
    'new-purchase': '/foundry/new-purchase',
    'bill-verify': '/foundry/bill-verify',
    branding: '/foundry/branding',
    digitisation: '/foundry/digitisation',
    'sku-catalogue': '/foundry/sku-catalogue',
    'stock-view': '/foundry/stock-view',
    'lens-packages': '/foundry/lens-packages',
    'lens-addons': '/foundry/lens-addons',
    'lens-package-addons': '/foundry/lens-package-addons',
    'lens-wizard-rules': '/foundry/lens-wizard-rules',
    'master-catalogue': '/foundry/master-catalogue',
    'rate-intelligence': '/foundry/rate-intelligence',
    'stock-transfer': '/foundry/stock-transfer',
    'transfer-requests': '/foundry/transfer-requests',
    'lab-orders': '/foundry/lab-orders'
  };

  function foundryNormalizeNavPageId(pageId) {
    const id = String(pageId || '');
    if (id === 'movement-list') return 'transfer-requests';
    return id;
  }

  function getFoundryPageFromPath(pathname) {
    const normalized = String(pathname || '').replace(/\/+$/, '') || '/foundry';
    if (normalized === '/foundry/movement-list') return 'transfer-requests';
    if (normalized === '/foundry/lens-portfolio') return 'lens-packages';
    const exact = Object.entries(FOUNDRY_PAGE_PATHS).find(([, route]) => route === normalized);
    if (exact) return exact[0];
    if (normalized === '/foundry') return 'dashboard';
    return 'dashboard';
  }

  function getFoundryNavEl(id) {
    return document.querySelector(`.nav-item[onclick*="nav('${id}'"]`) || null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NAV PAGE CHANGE EVENTS + CLEAN URL SYNC
  // ─────────────────────────────────────────────────────────────────────────
  const origNav = window.nav;
  window.nav = function(id, el, skipList, options) {
    id = foundryNormalizeNavPageId(id);
    const navOptions = options || {};
    if (FOUNDRY_PAGE_VIEW_BY_PAGE[id] && !foundryPageCanView(id)) {
      if (typeof cosmosToastWarn === 'function') {
        cosmosToastWarn('You do not have permission to open this screen.');
      }
      if (id !== 'dashboard') {
        const fallback = Object.keys(FOUNDRY_PAGE_VIEW_BY_PAGE).find((pid) => foundryPageCanView(pid)) || 'dashboard';
        window.nav(fallback, getFoundryNavEl(fallback), false, navOptions);
      }
      return;
    }
    if (typeof origNav === 'function') origNav(id, el);
    const nextPath = FOUNDRY_PAGE_PATHS[id] || '/foundry/dashboard';
    let pathForHistory = nextPath;
    if (id === 'new-purchase' && window._resumeDraftHeaderId) {
      pathForHistory = `${FOUNDRY_PAGE_PATHS['new-purchase']}?draft=${window._resumeDraftHeaderId}`;
    }
    if (!navOptions.fromHistory) {
      const cur = window.location.pathname + (window.location.search || '');
      if (cur !== pathForHistory) {
        window.history.pushState({ module: 'foundry', page: id }, '', pathForHistory);
      }
    }
    if (id === 'dashboard')    loadDashboard();
    if (id === 'purchases')    loadPurchases();
    if (id === 'new-purchase') {
      const resumeSnapshot = window._resumeDraftHeaderId;
      window._resumeDraftHeaderId = null;
      void (async () => {
        await loadFormData();
        if (resumeSnapshot) {
          await loadDraftPurchaseIntoForm(resumeSnapshot);
        } else {
          initNewPurchaseForm();
        }
      })();
    }
    if (id === 'sku-catalogue')    loadSkuCatalogue();
    if (id === 'master-catalogue') loadMasterCatalogue();
    if (id === 'stock-view')       loadStockView();
    if (id === 'stock-transfer' && typeof window.stInit === 'function') window.stInit();
    if (id === 'transfer-requests') {
      void Promise.all([
        typeof ftrInitViewTabs === 'function' ? ftrInitViewTabs() : Promise.resolve(),
        typeof ftrInitStoreFilter === 'function' ? ftrInitStoreFilter() : Promise.resolve()
      ]).then(function () {
        if (typeof window.loadTransferRequests === 'function') window.loadTransferRequests();
      });
    }
    if (id === 'lens-packages' && typeof window.loadLensPackagesPage === 'function') window.loadLensPackagesPage();
    if (id === 'lens-addons' && typeof window.loadLensAddonsPage === 'function') window.loadLensAddonsPage();
    if (id === 'lens-package-addons' && typeof window.loadLensMatrixPage === 'function') window.loadLensMatrixPage();
    if (id === 'lens-wizard-rules' && typeof window.loadLensWizardRulesPage === 'function') window.loadLensWizardRulesPage();
    // loadLabOrders is assigned later in this file; guard avoids ReferenceError + aborted init on /foundry/lab-orders refresh.
    if (id === 'lab-orders') {
      void (typeof fyInitLabStoreFilter === 'function' ? fyInitLabStoreFilter() : Promise.resolve()).then(function () {
        if (typeof window.loadLabOrders === 'function') window.loadLabOrders();
      });
    }
    // Only load the list when navigating from sidebar (not when opening a detail directly)
    if (!skipList) {
      if (id === 'bill-verify')  loadBillVerifyList();
      if (id === 'branding')     loadBrandingList();
      if (id === 'digitisation') loadDigitisationList();
    }
  };

  function applyFoundryRouteFromPath() {
    const pageId = getFoundryPageFromPath(window.location.pathname);
    const qs = new URLSearchParams(window.location.search || '');
    const draftQ = qs.get('draft');
    if (pageId === 'new-purchase' && draftQ && /^\d+$/.test(String(draftQ))) {
      window._resumeDraftHeaderId = Number(draftQ);
    }
    window.nav(pageId, getFoundryNavEl(pageId), false, { fromHistory: true });
  }

  window.addEventListener('popstate', () => {
    if (window.cosmosIsMobileBackBlocked && window.cosmosIsMobileBackBlocked()) return;
    applyFoundryRouteFromPath();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BARCODE PRINT (TSC P210 · TSPL2 · roll/label geometry is parameterized)
  // ─────────────────────────────────────────────────────────────────────────

  let _bcSkus = [];        // current set of SKUs in the modal
  let _bcUsbDevice = null; // connected WebUSB device
  let _bcUsbOrientationHintShown = false;
  let _bcPreviewDebounceTimer = null;

  // TSC P210 USB vendor/product IDs (TSC Auto ID)
  const TSC_VENDOR_ID = 0x0EB8;
  /** localStorage key prefix — horizontal TSPL calibration per USB identity */
  const BC_CALIB_STORAGE_PREFIX = 'cosmos.foundry.bcAlign.v1';
  /** Org-wide label format presets (server) + last-selected key (browser) */
  const BC_FORMAT_KEY_STORAGE = 'cosmos.foundry.bcFormatKey.v1';
  const BC_FORMAT_FIELD_MAP = [
    { configKey: 'marginTop', inputId: 'bc-margin-top' },
    { configKey: 'marginBottom', inputId: 'bc-margin-bottom' },
    { configKey: 'marginLeft', inputId: 'bc-margin-left' },
    { configKey: 'marginRight', inputId: 'bc-margin-right' },
    { configKey: 'gapRow', inputId: 'bc-gap-row' },
    { configKey: 'gapCol', inputId: 'bc-gap-col' },
    { configKey: 'labelWidthMm', inputId: 'bc-label-width' },
    { configKey: 'labelHeightMm', inputId: 'bc-label-height' },
    { configKey: 'labelsPerRow', inputId: 'bc-labels-per-row' },
    { configKey: 'dotsPerMm', inputId: 'bc-dots-per-mm' },
    { configKey: 'qrCellSize', inputId: 'bc-qr-cell-size' },
    { configKey: 'qrVisualSizeMm', inputId: 'bc-qr-visual-size-mm' },
    { configKey: 'qrTopRatio', inputId: 'bc-qr-top-ratio' },
    { configKey: 'textTopRatio', inputId: 'bc-text-top-ratio' },
    { configKey: 'textXMul', inputId: 'bc-text-x-mul' },
    { configKey: 'textYMul', inputId: 'bc-text-y-mul' },
    { configKey: 'textFontId', inputId: 'bc-text-font-id' },
    { configKey: 'textFontPt', inputId: 'bc-text-font-pt' }
  ];
  const BC_FORMAT_INPUT_IDS = BC_FORMAT_FIELD_MAP.map(function (f) { return f.inputId; });
  let _bcLabelFormats = [];
  let _bcLabelFormatsLoaded = false;
  let _bcActiveFormatConfig = { layoutType: 'grid' };
  let _bcActiveFormatRow = null;

  const BC_STRIP_CONFIG_KEYS = ['layoutType', 'printWidthMm', 'zone1WidthMm', 'zone2WidthMm', 'tailWidthMm'];
  const BC_COMPACT_CONFIG_KEYS = ['layoutType', 'bottomBandHeightMm', 'rightRailWidthMm'];
  const BC_COMPACT_QR_INSET_MM = 0;
  const BC_COMPACT_TEXT_GAP_MM = 1;

  const BC_LARGE_LABEL_FALLBACK = {
    format_key: 'large_label',
    name: 'Large label',
    description: 'Roll label — 40×28 mm (legacy grid)',
    is_default: false,
    config: {
      v: 1, layoutType: 'grid', marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
      gapRow: 0, gapCol: 0, labelWidthMm: 40, labelHeightMm: 28, labelsPerRow: 1, dotsPerMm: 8,
      qrCellSize: 4, qrVisualSizeMm: 14, qrTopRatio: 0, textTopRatio: 0.72,
      textXMul: 2, textYMul: 2, textFontId: 2, textFontPt: 5
    }
  };

  const BC_SMALL_15X15_FALLBACK = {
    format_key: 'small_15x15',
    name: '15×15mm Small Label',
    description: '6-up on 109mm roll · QR + vertical unit id + brand/MRP footer',
    is_default: true,
    label_type: 'SQUARE',
    page_width_mm: 109,
    columns: 6,
    col_gap_mm: 3,
    row_gap_mm: 3,
    margin_left_mm: 2,
    margin_right_mm: 2,
    margin_top_mm: 2,
    label_width_mm: 15,
    label_height_mm: 15,
    config: {
      v: 1, layoutType: 'compact', marginTop: 2, marginBottom: 0, marginLeft: 2, marginRight: 2,
      gapRow: 3, gapCol: 3, labelWidthMm: 15, labelHeightMm: 15, labelsPerRow: 6, dotsPerMm: 8,
      qrCellSize: 3, qrVisualSizeMm: 10, textXMul: 1, textYMul: 1, textFontId: 1, textFontPt: 8, pageWidthMm: 109
    },
    zones: [
      { zone_key: 'qr', zone_type: 'qr', label: 'QR Code', printable: true, x_mm: 0, y_mm: 0, width_mm: 10, height_mm: 10, content: '{unit_id}', error_level: 'L', writing_mode: 'horizontal' },
      { zone_key: 'uid_strip', zone_type: 'text', label: 'Unit ID', printable: true, x_mm: 10.5, y_mm: 0, width_mm: 4, height_mm: 15, content: '{unit_id}', writing_mode: 'vertical', error_level: 'L' },
      { zone_key: 'footer', zone_type: 'text', label: 'Brand - MRP', printable: true, x_mm: 0, y_mm: 10.5, width_mm: 10, height_mm: 4.5, content: '{brand}-{mrp}', writing_mode: 'horizontal', error_level: 'L', border_top: true }
    ]
  };

  const BC_SMALL_15X15_ALT_FALLBACK = {
    format_key: 'small_15x15_alt',
    name: '15×15mm — Brand rail + Unit band',
    description: 'QR + vertical brand/MRP rail + horizontal unit code band',
    label_type: 'SQUARE',
    page_width_mm: 109,
    columns: 6,
    col_gap_mm: 3,
    row_gap_mm: 2,
    margin_left_mm: 2,
    margin_right_mm: 2,
    margin_top_mm: 2,
    label_width_mm: 15,
    label_height_mm: 15,
    config: {
      v: 1, layoutType: 'compact-alt', marginTop: 2, marginBottom: 0, marginLeft: 2, marginRight: 2,
      gapRow: 2, gapCol: 3, labelWidthMm: 15, labelHeightMm: 15, labelsPerRow: 6, dotsPerMm: 8,
      qrCellSize: 3, qrVisualSizeMm: 9, textXMul: 1, textYMul: 1, textFontId: 2, textFontPt: 8, pageWidthMm: 109
    },
    zones: [
      { zone_key: 'qr', zone_type: 'qr', label: 'QR Code', printable: true, x_mm: 0, y_mm: 0, width_mm: 10, height_mm: 10, content: '{unit_id}', error_level: 'L', writing_mode: 'horizontal' },
      { zone_key: 'brand_rail', zone_type: 'text', label: 'Brand - MRP', printable: true, x_mm: 10.5, y_mm: 0, width_mm: 4.5, height_mm: 15, content: '{brand}-{mrp}', writing_mode: 'vertical', error_level: 'L' },
      { zone_key: 'unit_band', zone_type: 'text', label: 'Unit ID', printable: true, x_mm: 0, y_mm: 10.5, width_mm: 10.5, height_mm: 4.5, content: '{unit_id}', writing_mode: 'horizontal', error_level: 'L', border_top: true }
    ]
  };

  const BC_SMALL_15X15_FIXED_FALLBACK = {
    format_key: 'small_15x15_fixed',
    name: '15×15mm — Fixed (Brand rail + Unit footer)',
    description: '10×10 QR · brand vertical rail · 7-digit unit footer',
    label_type: 'SQUARE',
    page_width_mm: 109,
    columns: 6,
    col_gap_mm: 3,
    row_gap_mm: 2,
    margin_left_mm: 2,
    margin_right_mm: 2,
    margin_top_mm: 0,
    label_width_mm: 15,
    label_height_mm: 15,
    config: {
      v: 1, layoutType: 'compact-fixed', marginTop: 0, marginBottom: 0, marginLeft: 2, marginRight: 2,
      gapRow: 2, gapCol: 3, labelWidthMm: 15, labelHeightMm: 15, labelsPerRow: 6, dotsPerMm: 8,
      qrCellSize: 3, qrVisualSizeMm: 10, textXMul: 1, textYMul: 1, textFontId: 1, textFontPt: 8, pageWidthMm: 109
    },
    zones: [
      { zone_key: 'qr', zone_type: 'qr', label: 'QR Code', printable: true, x_mm: 0, y_mm: 0, width_mm: 10, height_mm: 10, content: '{unit_id}', error_level: 'L', writing_mode: 'horizontal' },
      { zone_key: 'brand_rail', zone_type: 'text', label: 'Brand - MRP', printable: true, x_mm: 10, y_mm: 0, width_mm: 5, height_mm: 15, content: '{brand}-{mrp}', writing_mode: 'vertical', error_level: 'L' },
      { zone_key: 'unit_footer', zone_type: 'text', label: 'Unit ID', printable: true, x_mm: 0, y_mm: 10, width_mm: 10, height_mm: 5, content: '{unit_id}', writing_mode: 'horizontal', error_level: 'L', border_top: true }
    ]
  };

  const BC_STRIP_104X12_FALLBACK = {
    format_key: 'strip_104x12',
    name: '104×12mm Frame Wrap Label',
    description: '66 mm print (QR + brand) + 34 mm tail on 108 mm roll',
    label_type: 'STRIP',
    page_width_mm: 108,
    columns: 1,
    col_gap_mm: 0,
    row_gap_mm: 2,
    margin_left_mm: 2,
    margin_right_mm: 2,
    margin_top_mm: 2,
    label_width_mm: 104,
    label_height_mm: 12,
    config: {
      v: 1, layoutType: 'strip', marginTop: 2, marginBottom: 0, marginLeft: 2, marginRight: 2,
      gapRow: 2, gapCol: 0, labelWidthMm: 104, labelHeightMm: 12, labelsPerRow: 1, dotsPerMm: 8,
      qrCellSize: 3, qrVisualSizeMm: 10, textXMul: 1, textYMul: 1, textFontId: 2, textFontPt: 6,
      printWidthMm: 66, zone1WidthMm: 33, zone2WidthMm: 33, tailWidthMm: 34, pageWidthMm: 108
    },
    zones: [
      { zone_key: 'zone_qr_sku', zone_type: 'qr', label: 'Zone 1 — QR', printable: true, x_mm: 0, y_mm: 0, width_mm: 33, height_mm: 12, content: '{unit_id}', error_level: 'L', writing_mode: 'horizontal' },
      { zone_key: 'zone_brand_mrp', zone_type: 'text', label: 'Zone 2 — Brand', printable: true, x_mm: 33, y_mm: 0, width_mm: 33, height_mm: 12, content: '{brand}\n{model}\nMRP {mrp}', writing_mode: 'horizontal', error_level: 'L' },
      { zone_key: 'tail', zone_type: 'tail', label: 'Tail', printable: false, x_mm: 66, y_mm: 0, width_mm: 38, height_mm: 12, content: '' }
    ]
  };

  function _bcGetActiveFormatConfig() {
    return Object.assign({ layoutType: 'grid' }, _bcActiveFormatConfig || {});
  }

  function _bcTsplDirectionFromFormat(fmtOptional) {
    const fmt = fmtOptional || _bcActiveFormatRow;
    const cfg = fmt && fmt.config && typeof fmt.config === 'object'
      ? fmt.config
      : _bcGetActiveFormatConfig();
    const orient = cfg && cfg.printOrientation;
    if (orient) {
      const s = String(orient).trim().toLowerCase();
      if (s === 'portrait_180' || s === 'landscape_180') return 1;
      if (s === 'portrait' || s === 'landscape') return 0;
    }
    if (String(cfg.layoutType || '').toLowerCase() === 'compact-fixed') return 1;
    return 0;
  }

  function _bcPrintOrientationLabel(fmtOptional) {
    const fmt = fmtOptional || _bcActiveFormatRow;
    const cfg = fmt && fmt.config && typeof fmt.config === 'object'
      ? fmt.config
      : _bcGetActiveFormatConfig();
    const labels = {
      portrait: 'Portrait',
      portrait_180: 'Portrait 180°',
      landscape: 'Landscape',
      landscape_180: 'Landscape 180°'
    };
    const orient = cfg && cfg.printOrientation;
    if (orient && labels[String(orient).toLowerCase()]) return labels[String(orient).toLowerCase()];
    if (String(cfg.layoutType || '').toLowerCase() === 'compact-fixed') return 'Portrait 180°';
    return 'Portrait';
  }

  function _bcRollSizeHintMm(fmt) {
    if (!fmt) return '';
    const cfg = fmt.config && typeof fmt.config === 'object' ? fmt.config : {};
    const lw = fmt.label_width_mm || cfg.labelWidthMm || 15;
    const lh = fmt.label_height_mm || cfg.labelHeightMm || 15;
    const cols = Number(fmt.columns) || Number(cfg.labelsPerRow) || 1;
    if (cols > 1) {
      const ml = Number(fmt.margin_left_mm) || Number(cfg.marginLeft) || 0;
      const mr = Number(fmt.margin_right_mm) || Number(cfg.marginRight) || 0;
      const cg = Number(fmt.col_gap_mm) || Number(cfg.gapCol) || 0;
      const pw = fmt.page_width_mm != null ? fmt.page_width_mm : (ml + cols * lw + Math.max(0, cols - 1) * cg + mr);
      return pw + '×' + lh + ' mm';
    }
    return lw + '×' + lh + ' mm';
  }

  function _bcMaybeUsbOrientationHint() {
    if (_bcUsbOrientationHintShown || typeof cosmosToastInfo !== 'function') return;
    _bcUsbOrientationHintShown = true;
    cosmosToastInfo('USB labels use template orientation — browser print dialog is not used.');
  }

  function _bcGetLayoutType() {
    if (_bcFormatHasZones()) {
      if (_bcActiveFormatRow && _bcActiveFormatRow.label_type === 'STRIP') return 'strip';
      return 'compact';
    }
    if (_bcActiveFormatRow && _bcActiveFormatRow.label_type === 'STRIP') return 'strip';
    if (_bcActiveFormatRow && _bcActiveFormatRow.label_type === 'SQUARE') return 'compact';
    const t = String(_bcGetActiveFormatConfig().layoutType || 'grid').toLowerCase();
    if (t === 'strip') return 'strip';
    if (t === 'compact' || t === 'compact-alt' || t === 'compact-fixed') return 'compact';
    return 'grid';
  }

  function _bcIsCompactFixedLayout() {
    return String(_bcGetActiveFormatConfig().layoutType || '').toLowerCase() === 'compact-fixed';
  }

  function _bcCompactColumnsPerRow() {
    if (_bcActiveFormatRow && _bcActiveFormatRow.columns > 0) {
      return Math.round(Number(_bcActiveFormatRow.columns));
    }
    const cfg = _bcGetActiveFormatConfig();
    const fromCfg = Number(cfg.labelsPerRow);
    if (Number.isFinite(fromCfg) && fromCfg > 0) return Math.round(fromCfg);
    return _bcReadLabelGeometryMm().cols;
  }

  function _bcIsCompactMultiColumn() {
    return _bcGetLayoutType() === 'compact' && _bcCompactColumnsPerRow() > 1;
  }

  function _bcRefreshZoneMarginUi() {
    const hasZones = _bcFormatHasZones();
    const topEl = document.getElementById('bc-margin-top');
    const bottomEl = document.getElementById('bc-margin-bottom');
    const noteId = 'bc-zone-margin-note';
    let note = document.getElementById(noteId);
    if (topEl) topEl.disabled = !!hasZones;
    if (bottomEl) bottomEl.disabled = !!hasZones;
    if (hasZones) {
      if (!note) {
        const box = document.querySelector('#bc-advanced-wrap .mt3');
        if (box) {
          note = document.createElement('div');
          note.id = noteId;
          note.style.cssText = 'font-size:10px;color:var(--gold);margin-bottom:8px;line-height:1.4';
          const anchor = box.querySelector('.section-lbl');
          if (anchor && anchor.nextSibling) box.insertBefore(note, anchor.nextSibling);
          else box.insertBefore(note, box.firstChild);
        }
      }
      if (note) {
        note.textContent =
          'Zone templates (Command Unit): top/bottom inset does not apply — use zone Y positions only. ' +
          'Left/right inset and row gap still apply to the roll row. In the print dialog set Margins to None.';
      }
    } else if (note) {
      note.remove();
    }
  }

  function _bcUpdateFormatHint() {
    const el = document.getElementById('bc-format-hint');
    if (!el) return;
    const key = _bcGetSelectedFormatKey();
    let fmt = _bcLabelFormats.find(function (f) { return f.format_key === key; });
    if (_bcFormatHasZones() && fmt) {
      const n = (fmt.zones || []).filter(function (z) { return z.printable !== false && z.zone_type !== 'tail'; }).length;
      el.textContent =
        (fmt.description ? fmt.description + ' · ' : '') +
        'USB: ' + _bcPrintOrientationLabel(fmt) + ' · roll ' + _bcRollSizeHintMm(fmt) + ' · ' +
        'Zone template (' + n + ' printable zone' + (n !== 1 ? 's' : '') + ') — matches Command Unit Label Templates.';
      return;
    }
    if (fmt && fmt.description) {
      el.textContent = fmt.description;
      return;
    }
    if (_bcGetLayoutType() === 'strip') {
      el.textContent = 'For frames: QR and product details on the wrap. The grey tail is not printed — only for wrapping.';
    } else if (_bcGetLayoutType() === 'compact') {
      el.textContent = 'Small sticker: QR on top, product code on the side, brand and price along the bottom.';
    } else if (_bcIsCompactMultiColumn()) {
      const cols = _bcCompactColumnsPerRow();
      el.textContent =
        'Each sticker: QR (left), unit number down the right side, brand and price along the bottom. ' +
        cols + ' stickers per row on a 109 mm roll.';
    } else {
      el.textContent = 'Standard sticker: scan the QR at billing; staff can read the product code printed below it.';
    }
  }

  function _bcCanEditLabelFormats() {
    return typeof foundryHasAnyPerm === 'function' && foundryHasAnyPerm('foundry.label_formats.edit');
  }

  function _bcRefreshLabelFormatActions() {
    const wrap = document.getElementById('bc-format-actions');
    if (wrap) wrap.style.display = _bcCanEditLabelFormats() ? 'flex' : 'none';
  }

  function _bcFormatOptionLabel(fmt) {
    if (!fmt) return 'Label type';
    const key = String(fmt.format_key || '');
    const cfg = fmt.config && typeof fmt.config === 'object' ? fmt.config : {};
    const w = cfg.labelWidthMm;
    const h = cfg.labelHeightMm;
    const size = w && h ? ' (' + w + '×' + h + ' mm)' : '';
    const def = fmt.is_default ? ' — recommended' : '';
    if (key === 'large_label') return 'Large roll label — standard shelf tag' + size + def;
    if (key === 'small_label') return 'Small square sticker — one per row (brand + price)' + size;
    if (key === 'small_15x15_continuous_109') return '15×15 continuous roll — 6 per row (QR + unit # + brand/price)' + size;
    if (key === 'eyewear_strip_12x100') return 'Frame wrap strip — for spectacle frames' + size;
    const name = String(fmt.name || key || 'Label').trim();
    return name + size + def;
  }

  function _bcComputePrintJobStats() {
    let totalLabels = 0;
    const layout = _bcGetLayoutType();
    if (layout === 'strip') {
      _bcSelectedStripItems().forEach(function (item) { totalLabels += item.copies; });
    } else if (layout === 'compact') {
      _bcSelectedCompactItems().forEach(function (item) { totalLabels += item.copies; });
    } else {
      _bcSelectedItems().forEach(function (item) { totalLabels += item.copies; });
    }
    const skuCount = new Set(_bcSkus.map(function (sk) { return sk.sku_code; }).filter(Boolean)).size;
    const key = _bcGetSelectedFormatKey();
    let fmt = _bcLabelFormats.find(function (f) { return f.format_key === key; });
    if (!fmt && key) fmt = { format_key: key, name: key };
    return {
      totalLabels: totalLabels,
      skuCount: skuCount,
      formatLabel: _bcFormatOptionLabel(fmt)
    };
  }

  function _bcRefreshOperatorJobSummary() {
    const jobEl = document.getElementById('bc-job-summary');
    const summaryEl = document.getElementById('bc-summary');
    const stats = _bcComputePrintJobStats();
    const n = stats.totalLabels;
    const s = stats.skuCount;
    if (jobEl) {
      if (!n) {
        jobEl.innerHTML = 'No labels to print. Go back and select products with checkboxes, or use <strong>Print all labels</strong>.';
        return;
      }
      const labelWord = n === 1 ? 'label' : 'labels';
      const skuWord = s === 1 ? 'product type' : 'product types';
      jobEl.innerHTML =
        '<strong>' + n + ' ' + labelWord + '</strong> will be printed (' +
        s + ' ' + skuWord + '). Check the preview on the right, then press <strong>Print now</strong>.';
    }
    if (summaryEl) {
      summaryEl.textContent = stats.formatLabel ? ('Label type: ' + stats.formatLabel) : '';
    }
  }

  window.bcToggleAdvancedSettings = function () {
    const wrap = document.getElementById('bc-advanced-wrap');
    const btn = document.getElementById('bc-advanced-toggle');
    if (!wrap) return;
    const opening = wrap.style.display === 'none' || !wrap.style.display;
    wrap.style.display = opening ? 'block' : 'none';
    wrap.hidden = !opening;
    if (btn) {
      btn.textContent = opening ? 'Hide advanced printer settings' : 'Show advanced printer settings';
      btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
    }
    if (opening && typeof bcRenderPreview === 'function') bcRenderPreview();
  };

  function _bcReadStoredFormatKey() {
    try { return String(localStorage.getItem(BC_FORMAT_KEY_STORAGE) || '').trim(); } catch (_e) { return ''; }
  }

  function _bcWriteStoredFormatKey(key) {
    try { if (key) localStorage.setItem(BC_FORMAT_KEY_STORAGE, String(key)); } catch (_e) { /* ignore */ }
  }

  function _bcCollectFormatConfig() {
    const out = { v: 1 };
    BC_FORMAT_FIELD_MAP.forEach(function (f) {
      const el = document.getElementById(f.inputId);
      out[f.configKey] = el && 'value' in el ? el.value : '';
    });
    BC_STRIP_CONFIG_KEYS.forEach(function (k) {
      if (_bcActiveFormatConfig[k] !== undefined && _bcActiveFormatConfig[k] !== null) {
        out[k] = _bcActiveFormatConfig[k];
      }
    });
    BC_COMPACT_CONFIG_KEYS.forEach(function (k) {
      if (_bcActiveFormatConfig[k] !== undefined && _bcActiveFormatConfig[k] !== null) {
        out[k] = _bcActiveFormatConfig[k];
      }
    });
    return out;
  }

  function _bcNormalizeSmallLabelFormat(fmt) {
    if (!fmt || fmt.format_key !== 'small_label') return fmt;
    const cfg = fmt.config && typeof fmt.config === 'object' ? fmt.config : {};
    if (String(cfg.layoutType || '').toLowerCase() === 'compact') return fmt;
    return Object.assign({}, fmt, {
      description: BC_SMALL_COMPACT_FALLBACK.description,
      config: Object.assign({}, BC_SMALL_COMPACT_FALLBACK.config, cfg, { layoutType: 'compact' })
    });
  }

  function _bcApplyFormatConfig(config) {
    if (!config || typeof config !== 'object') return;
    BC_FORMAT_FIELD_MAP.forEach(function (f) {
      if (config[f.configKey] === undefined || config[f.configKey] === null) return;
      const el = document.getElementById(f.inputId);
      if (el && 'value' in el) el.value = String(config[f.configKey]);
    });
  }

  const BC_LABEL_FORMAT_FALLBACKS = [
    BC_LARGE_LABEL_FALLBACK,
    BC_SMALL_15X15_FALLBACK,
    BC_SMALL_15X15_ALT_FALLBACK,
    BC_SMALL_15X15_FIXED_FALLBACK,
    BC_STRIP_104X12_FALLBACK
  ];

  function _bcFormatHasZones() {
    const row = _bcActiveFormatRow;
    return !!(row && Array.isArray(row.zones) && row.zones.length);
  }

  /** Zone templates from Command Unit must not fall through to legacy grid preview. */
  function _bcNormalizeFormatRowForZones(fmt) {
    if (!fmt) return fmt;
    let out = Object.assign({}, fmt);
    const zones = Array.isArray(out.zones) ? out.zones : [];
    if (!zones.length) return _bcNormalizeSmallLabelFormat(out);
    const isStrip = out.label_type === 'STRIP' || zones.some(function (z) { return z.zone_type === 'tail'; });
    if (isStrip) {
      out.label_type = 'STRIP';
    } else {
      out.label_type = 'SQUARE';
      out.config = Object.assign({ layoutType: 'compact', v: 1 }, out.config || {}, { layoutType: 'compact' });
    }
    return _bcNormalizeSmallLabelFormat(out);
  }

  function _bcApplyZoneTokens(tpl, item) {
    const s = String(tpl || '');
    const parts = String(item.bottomLine || '').split('-');
    const brand = item.brand != null ? String(item.brand) : (parts[0] || '');
    const mrp = item.mrp != null ? String(item.mrp) : (parts[1] || '');
    return s
      .replace(/\{unit_id\}/g, String(item.code || item.unitText || ''))
      .replace(/\{sku_code\}/g, String(item.sku_code || item.label || ''))
      .replace(/\{brand\}/g, brand)
      .replace(/\{model\}/g, String(item.model || ''))
      .replace(/\{mrp\}/g, mrp);
  }

  function _bcZoneCellMarkup(item, fmt, qrPreviewPx, options) {
    options = options || {};
    const lw = fmt.label_width_mm || fmt.config.labelWidthMm || 15;
    const lh = fmt.label_height_mm || fmt.config.labelHeightMm || 15;
    const zones = fmt.zones || [];
    const { qrVisualSizeMm } = _bcReadQrConfig();
    let html = '<div class="bc-zone-row" style="position:relative;width:' + lw + 'mm;height:' + lh + 'mm;box-sizing:border-box;border:1px solid var(--border);overflow:hidden;background:var(--card);flex-shrink:0' + (options.outerExtra || '') + '">';
    zones.forEach(function (z) {
      const isTail = z.zone_type === 'tail' || z.printable === false;
      const bg = isTail ? 'repeating-linear-gradient(-45deg,transparent,transparent 2px,var(--border) 2px,var(--border) 3px)' : (z.zone_type === 'qr' ? 'var(--accL)' : 'var(--bg)');
      const borderTop = z.border_top ? 'border-top:1px dashed var(--border);' : '';
      html += '<div style="position:absolute;left:' + z.x_mm + 'mm;top:' + z.y_mm + 'mm;width:' + z.width_mm + 'mm;height:' + z.height_mm + 'mm;box-sizing:border-box;overflow:hidden;' + borderTop + 'background:' + bg + ';opacity:' + (isTail ? '0.45' : '1') + '">';
      if (z.zone_type === 'qr') {
        if (options.dataUrl) {
          html += '<img src="' + options.dataUrl + '" style="width:100%;height:100%;object-fit:contain" alt="">';
        } else {
          html += '<div class="qr-placeholder" data-qr-code="' + _bcEsc(item.code) + '" data-qr-px="' + qrPreviewPx + '" style="width:100%;height:100%"></div>';
        }
      } else if (!isTail) {
        const txt = _bcEsc(_bcApplyZoneTokens(z.content, item));
        const alignApi = window.cosmosLabelZoneAlign;
        const alignCss = alignApi ? alignApi.zoneAlignCss(z) : 'display:flex;width:100%;height:100%;align-items:flex-start;';
        const textCss = alignApi && alignApi.zonePreviewTextStyle
          ? alignApi.zonePreviewTextStyle(z)
          : 'font-size:' + (z.font_size_pt || 8) + 'pt;font-weight:700;line-height:1.15;color:var(--text1);white-space:pre-wrap;word-break:break-word;max-width:100%;';
        html += '<div style="' + alignCss + '"><span class="mono" style="' + textCss + '">' + txt + '</span></div>';
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function _bcMergeLabelFormatFallbacks(list) {
    const out = Array.isArray(list) ? list.slice() : [];
    BC_LABEL_FORMAT_FALLBACKS.forEach(function (fb) {
      if (!out.some(function (f) { return f.format_key === fb.format_key; })) {
        out.push(Object.assign({}, fb));
      }
    });
    if (!out.some(function (f) { return f.is_default; }) && out[0]) {
      const def = out.find(function (f) { return f.format_key === BC_SMALL_15X15_FALLBACK.format_key; }) || out[0];
      if (def) def.is_default = true;
    }
    return out.map(_bcNormalizeSmallLabelFormat);
  }

  function _bcSetFormatSelectLoading(loading) {
    const sel = document.getElementById('bc-format-select');
    if (!sel) return;
    if (loading) {
      sel.disabled = true;
      sel.innerHTML = '<option value="">Loading formats…</option>';
    } else {
      sel.disabled = false;
    }
  }

  function _bcPopulateFormatSelect(formats, selectedKey) {
    const sel = document.getElementById('bc-format-select');
    if (!sel) return;
    const list = Array.isArray(formats) ? formats : [];
    sel.disabled = false;
    sel.innerHTML = list.map(function (f) {
      const key = _bcEsc(f.format_key || '');
      const label = _bcEsc(_bcFormatOptionLabel(f));
      return '<option value="' + key + '">' + label + '</option>';
    }).join('');
    if (selectedKey && list.some(function (f) { return f.format_key === selectedKey; })) {
      sel.value = selectedKey;
    } else {
      const def = list.find(function (f) { return f.is_default; });
      if (def) sel.value = def.format_key;
      else if (list[0]) sel.value = list[0].format_key;
    }
  }

  function _bcGetSelectedFormatKey() {
    return String(document.getElementById('bc-format-select')?.value || '').trim();
  }

  function _bcMergeFormatIntoCache(row) {
    if (!row || !row.format_key) return null;
    const normalized = _bcNormalizeFormatRowForZones(row);
    const idx = _bcLabelFormats.findIndex(function (f) { return f.format_key === normalized.format_key; });
    if (idx >= 0) _bcLabelFormats[idx] = normalized;
    else _bcLabelFormats.push(normalized);
    return normalized;
  }

  /** Load full template (zones_json) from server — list row can be stale vs Command Unit saves. */
  async function _bcFetchLabelFormatDetail(formatKey) {
    const key = String(formatKey || '').trim();
    if (!key) return null;
    try {
      const row = await apiGet('/api/foundry/label-print-formats/' + encodeURIComponent(key));
      return _bcMergeFormatIntoCache(row);
    } catch (_e) {
      const cached = _bcLabelFormats.find(function (f) { return f.format_key === key; });
      return cached ? _bcNormalizeSmallLabelFormat(cached) : null;
    }
  }

  let _bcNoZonesWarnedKey = '';

  async function _bcApplyLabelFormatByKey(formatKey) {
    const key = String(formatKey || '').trim();
    let fmt = key ? await _bcFetchLabelFormatDetail(key) : null;
    if (!fmt && key) {
      fmt = _bcNormalizeFormatRowForZones(_bcLabelFormats.find(function (f) { return f.format_key === key; }));
    } else if (fmt) {
      fmt = _bcNormalizeFormatRowForZones(fmt);
      _bcMergeFormatIntoCache(fmt);
    }
    _bcActiveFormatRow = fmt || null;
    if (fmt && fmt.config) {
      _bcActiveFormatConfig = Object.assign({ layoutType: 'grid', v: 1 }, fmt.config);
      _bcApplyFormatConfig(fmt.config);
    } else {
      _bcActiveFormatConfig = { layoutType: 'grid', v: 1 };
    }
    if (key) _bcWriteStoredFormatKey(key);
    _bcUpdateFormatHint();
    _bcRefreshZoneMarginUi();
    _bcRefreshCompactTunePanel();
    _bcRefreshOperatorJobSummary();
    if (fmt && !_bcFormatHasZones() && key && _bcNoZonesWarnedKey !== key) {
      _bcNoZonesWarnedKey = key;
      if (typeof cosmosToastWarn === 'function') {
        cosmosToastWarn(
          '“' + (fmt.name || key) + '” has no saved zone layout — Foundry is using the built-in compact sticker. ' +
          'Open Command Unit → Label Templates, add zones, click Save, then reopen this dialog.'
        );
      }
    }
    if (_bcSkus.length) _bcRenderPreviewNow();
    else if (typeof bcRenderPreview === 'function') bcRenderPreview();
  }

  async function _bcEnsureLabelFormatsLoaded() {
    if (_bcLabelFormatsLoaded && _bcLabelFormats.length) return _bcLabelFormats;
    try {
      const res = await apiGet('/api/meta/label-print-formats');
      const list = res && res.formats ? res.formats : (Array.isArray(res) ? res : []);
      _bcLabelFormats = _bcMergeLabelFormatFallbacks(list);
    } catch (err) {
      _bcLabelFormats = _bcMergeLabelFormatFallbacks([]);
      if (typeof cosmosToastWarn === 'function') {
        cosmosToastWarn(
          'Using built-in label presets (could not sync from server). ' +
          (err && err.message ? err.message : '')
        );
      }
    }
    _bcLabelFormatsLoaded = true;
    return _bcLabelFormats;
  }

  window.bcOnFormatSelectChange = async function() {
    await _bcApplyLabelFormatByKey(_bcGetSelectedFormatKey());
  };

  window.bcUpdateLabelFormat = async function() {
    if (!_bcCanEditLabelFormats()) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('You do not have permission to edit label formats.');
      return;
    }
    const key = _bcGetSelectedFormatKey();
    if (!key) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Select a label format first.');
      return;
    }
    const btn = document.getElementById('bc-format-update-btn');
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      const updated = await apiPut('/api/foundry/label-print-formats/' + encodeURIComponent(key), {
        config: _bcCollectFormatConfig()
      });
      const row = updated && updated.format_key ? updated : (updated && updated.data ? updated.data : null);
      if (row) {
        const idx = _bcLabelFormats.findIndex(function (f) { return f.format_key === key; });
        if (idx >= 0) _bcLabelFormats[idx] = row;
      }
      if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn);
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Label format updated.');
      bcRenderPreview();
    } catch (err) {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Update failed.');
    }
  };

  window.bcSaveLabelFormatAsNew = async function() {
    if (!_bcCanEditLabelFormats()) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('You do not have permission to create label formats.');
      return;
    }
    const name = window.prompt('Name for this label format:', '');
    if (!name || !String(name).trim()) return;
    const btn = document.getElementById('bc-format-save-new-btn');
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      const created = await apiPost('/api/foundry/label-print-formats', {
        name: String(name).trim(),
        config: _bcCollectFormatConfig()
      });
      const row = created && created.format_key ? created : (created && created.data ? created.data : null);
      if (row) {
        _bcLabelFormats.push(row);
        _bcPopulateFormatSelect(_bcLabelFormats, row.format_key);
        _bcWriteStoredFormatKey(row.format_key);
      }
      if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn);
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Label format saved.');
      bcRenderPreview();
    } catch (err) {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Save failed.');
    }
  };

  window.bcSetDefaultLabelFormat = async function() {
    if (!_bcCanEditLabelFormats()) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('You do not have permission to edit label formats.');
      return;
    }
    const key = _bcGetSelectedFormatKey();
    if (!key) return;
    const btn = document.getElementById('bc-format-default-btn');
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      await apiPut('/api/foundry/label-print-formats/' + encodeURIComponent(key), { is_default: true });
      _bcLabelFormats = _bcLabelFormats.map(function (f) {
        return Object.assign({}, f, { is_default: f.format_key === key });
      });
      _bcPopulateFormatSelect(_bcLabelFormats, key);
      if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn);
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Default label format set.');
    } catch (err) {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Could not set default.');
    }
  };
  let _bcCalibSaveTimer = null;
  let _jsBarcodeLoader = null;
  let _html5QrLoader = null;

  function _loadScriptOnce(src, attrs, stateKey) {
    if (window[stateKey]) return Promise.resolve();
    if (attrs.loaderRef.current) return attrs.loaderRef.current;
    attrs.loaderRef.current = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      if (attrs.integrity) script.integrity = attrs.integrity;
      if (attrs.crossorigin) script.crossOrigin = attrs.crossorigin;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    }).finally(() => {
      attrs.loaderRef.current = null;
    });
    return attrs.loaderRef.current;
  }

  function loadJsBarcodeLib() {
    return _loadScriptOnce(
      'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js',
      {
        integrity: 'sha384-Kk5SjBOKprEnGfyBWfD2zROFd1Cu8kwOXxG2GIhYPcoDL2rBJS9P8Ud1ZMy4412a',
        crossorigin: 'anonymous',
        loaderRef: {
          get current() { return _jsBarcodeLoader; },
          set current(v) { _jsBarcodeLoader = v; }
        }
      },
      'JsBarcode'
    );
  }

  let _qrCodeLoader = null;
  const _BC_QR_CACHE_MAX = 500;
  const _bcQrCache = new Map();
  const BC_QR_UNIT_RE = /^\d{7}$/;
  const BC_QR_RENDER_OPTS = Object.freeze({
    errorCorrectionLevel: 'L',
    version: 1,
    margin: 2,
    width: 120
  });

  function _bcQrCacheSet(key, value) {
    if (_bcQrCache.size >= _BC_QR_CACHE_MAX) {
      _bcQrCache.delete(_bcQrCache.keys().next().value);
    }
    _bcQrCache.set(key, value);
  }

  function loadBcQrLib() {
    if (window._QRCode_loaded && typeof QRCode !== 'undefined') return Promise.resolve();
    if (_qrCodeLoader) return _qrCodeLoader;
    const sources = [
      '/js/vendor/qrcode.min.js',
      'https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js'
    ];
    _qrCodeLoader = new Promise((resolve, reject) => {
      let idx = 0;
      function tryNext() {
        if (typeof QRCode !== 'undefined') {
          window._QRCode_loaded = true;
          resolve();
          return;
        }
        if (idx >= sources.length) {
          reject(new Error('Failed to load QR library. Hard-refresh the page or check that /js/vendor/qrcode.min.js is reachable.'));
          return;
        }
        const s = document.createElement('script');
        s.src = sources[idx];
        idx += 1;
        s.async = true;
        s.onload = () => {
          if (typeof QRCode !== 'undefined') {
            window._QRCode_loaded = true;
            resolve();
          } else {
            tryNext();
          }
        };
        s.onerror = tryNext;
        document.head.appendChild(s);
      }
      tryNext();
    }).finally(() => {
      _qrCodeLoader = null;
    });
    return _qrCodeLoader;
  }

  function _bcNormalizeQrUnitCode(raw) {
    const digits = String(raw == null ? '' : raw).replace(/\D/g, '');
    return BC_QR_UNIT_RE.test(digits) ? digits : null;
  }

  async function _bcQrDataUrl(code) {
    const seven = _bcNormalizeQrUnitCode(code);
    if (!seven) throw new Error('QR requires a 7-digit unit barcode');
    const key = '7|' + seven;
    if (_bcQrCache.has(key)) return _bcQrCache.get(key);
    if (typeof QRCode === 'undefined') await loadBcQrLib();
    const dataUrl = await QRCode.toDataURL(seven, Object.assign({}, BC_QR_RENDER_OPTS));
    _bcQrCacheSet(key, dataUrl);
    return dataUrl;
  }

  function _bcFillQrPlaceholders(container) {
    const placeholders = Array.from(container.querySelectorAll('.qr-placeholder'));
    if (!placeholders.length) return;
    const BATCH = 24;
    let idx = 0;
    function nextBatch() {
      const slice = placeholders.slice(idx, idx + BATCH);
      if (!slice.length) return;
      idx += BATCH;
      Promise.all(slice.map(async (el) => {
        const code = el.getAttribute('data-qr-code');
        if (!code || !_bcNormalizeQrUnitCode(code)) {
          el.style.background = 'var(--redL)';
          el.title = 'QR requires a 7-digit unit barcode';
          return;
        }
        try {
          const dataUrl = await _bcQrDataUrl(code);
          const img = document.createElement('img');
          img.src = dataUrl;
          img.className = 'qr-img';
          img.style.cssText = el.style.cssText;
          img.style.display = 'block';
          el.replaceWith(img);
        } catch (_e) {
          el.style.background = 'var(--redL)';
          el.title = 'QR generation failed for: ' + code;
        }
      })).then(() => requestAnimationFrame(nextBatch));
    }
    requestAnimationFrame(nextBatch);
  }

  function _bcEsc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _bcQrPayload(sk) {
    return _bcNormalizeQrUnitCode(sk && sk.unit_barcode) || '';
  }

  function _bcFilterSkusForQrLabels(skus) {
    const ready = [];
    let skipped = 0;
    (skus || []).forEach(function (sk) {
      if (_bcQrPayload(sk)) ready.push(sk);
      else skipped += 1;
    });
    return { ready: ready, skipped: skipped };
  }

  async function _bcExpandSkusWithUnits(skus) {
    const out = [];
    for (let i = 0; i < skus.length; i++) {
      const sk = skus[i];
      let units = Array.isArray(sk.units) ? sk.units : null;
      if (!units && sk.sku_id) {
        try {
          const res = await apiGet('/api/skus/' + encodeURIComponent(String(sk.sku_id)) + '/units');
          units = Array.isArray(res) ? res : [];
        } catch (_e) {
          units = [];
        }
      }
      if (units && units.length) {
        for (let u = 0; u < units.length; u++) {
          const row = units[u];
          out.push(Object.assign({}, sk, {
            unit_barcode: row.unit_barcode,
            unit_no: row.unit_no,
            quantity: 1
          }));
        }
      } else {
        out.push(sk);
      }
    }
    return out;
  }

  function _bcIsUnitRow(sk) {
    return !!_bcQrPayload(sk);
  }

  function _bcRowCopies(sk) {
    return _bcIsUnitRow(sk) ? 1 : 0;
  }

  window.openBarcodeModal = async function(skus, opts) {
    opts = opts || {};
    if (!skus || !skus.length) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('No products selected to print.');
      return;
    }
    _bcQrCache.clear();
    _bcLabelFormatsLoaded = false;
    _bcNoZonesWarnedKey = '';
    try {
      await Promise.all([loadJsBarcodeLib(), loadBcQrLib()]);
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Failed to load print libraries.');
      else alert(err.message || 'Failed to load print libraries.');
      return;
    }
    const expanded = await _bcExpandSkusWithUnits(skus);
    const qrFilter = _bcFilterSkusForQrLabels(expanded);
    _bcSkus = qrFilter.ready;
    if (qrFilter.skipped > 0 && typeof cosmosToastWarn === 'function') {
      cosmosToastWarn(
        qrFilter.ready.length + ' label' + (qrFilter.ready.length !== 1 ? 's' : '') +
        ' ready; ' + qrFilter.skipped + ' skipped (no 7-digit unit barcode).'
      );
    }
    if (!_bcSkus.length) {
      if (typeof cosmosToastWarn === 'function') {
        cosmosToastWarn('No labels with a 7-digit unit barcode. Run unit backfill or re-generate SKUs, then try again.');
      }
      return;
    }

    if (_bcPreviewDebounceTimer) {
      clearTimeout(_bcPreviewDebounceTimer);
      _bcPreviewDebounceTimer = null;
    }

    _bcEnsureCalibrationListeners();
    try {
      await _bcTryReconnectUsbPrinter();
    } catch (e) {
      /* ignore */
    }
    if (_bcUsbDevice && _bcUsbDevice.opened) {
      _bcUpdatePrinterStatus('connected', _bcUsbDevice.productName || 'USB printer');
      _bcUpdateCalibrationHint(
        'Horizontal calibration is remembered for this printer on this browser. Adjust below if a new roll still looks shifted.'
      );
    } else {
      _bcUsbDevice = null;
      _bcUpdatePrinterStatus(null);
      _bcUpdateCalibrationHint(
        'Connect USB once — saved horizontal calibration loads automatically for that printer.'
      );
    }

    openM('modal-barcode-print');
    _bcSetFormatSelectLoading(true);

    const formats = await _bcEnsureLabelFormatsLoaded();
    const storedKey = _bcReadStoredFormatKey();
    _bcPopulateFormatSelect(formats, storedKey);
    await _bcApplyLabelFormatByKey(_bcGetSelectedFormatKey());
    _bcRefreshLabelFormatActions();
    _bcRefreshOperatorJobSummary();
    _bcSchedulePersistCalibration();

  };
  // Build list of {code: 7-digit unit barcode, label: sku_code for text, copies}
  function _bcSelectedItems() {
    return _bcSkus.map(function (sk) {
      const code = _bcQrPayload(sk);
      if (!code) return null;
      return {
        code: code,
        label: sk.sku_code || '',
        copies: _bcRowCopies(sk)
      };
    }).filter(Boolean);
  }

  function _bcTruncateStripLine(text, maxLen) {
    const s = String(text || '').trim();
    if (!s) return '';
    if (s.length <= maxLen) return s;
    return s.slice(0, Math.max(1, maxLen - 1)) + '…';
  }

  function _bcStripModelLine(sk) {
    const parts = [sk.ew_collection, sk.style_model].filter(function (x) {
      return x != null && String(x).trim() !== '';
    });
    return parts.join(' · ') || String(sk.style_model || '').trim() || '—';
  }

  function _bcStripMrpLine(sk) {
    if (sk.sale_price == null || sk.sale_price === '') return 'MRP —';
    return 'MRP ' + inrD(sk.sale_price);
  }

  function _bcSelectedStripItems() {
    return _bcSkus.map(function (sk) {
      const code = _bcQrPayload(sk);
      if (!code) return null;
      return {
        code: code,
        unitText: code,
        brand: _bcTruncateStripLine(_bcStripBrandLine(sk) || '—', 22),
        model: _bcTruncateStripLine(_bcStripModelLine(sk), 26),
        mrp: _bcTruncateStripLine(_bcStripMrpLine(sk), 18),
        copies: 1
      };
    }).filter(Boolean);
  }

  function _bcSelectedCompactItems() {
    return _bcSkus.map(function (sk) {
      const code = _bcQrPayload(sk);
      if (!code) return null;
      return {
        code: code,
        unitText: code,
        sku_code: sk.sku_code || '',
        brand: _bcCompactBrandSegment(sk),
        mrp: _bcCompactPriceSegment(sk),
        model: _bcTruncateStripLine(_bcStripModelLine(sk), 20),
        bottomLine: _bcTruncateStripLine(_bcCompactBottomLine(sk), 14),
        copies: 1
      };
    }).filter(Boolean);
  }

  function _bcReadCompactLayoutMm() {
    const cfg = _bcGetActiveFormatConfig();
    const labelW = Number(cfg.labelWidthMm) || 15;
    const labelH = Number(cfg.labelHeightMm) || 15;
    const bottom = Number(cfg.bottomBandHeightMm) || 4;
    const { qrVisualSizeMm } = _bcReadQrConfig();
    const layoutType = cfg.layoutType || 'compact';
    if (layoutType === 'compact-fixed') {
      const qrSize = Math.min(qrVisualSizeMm, labelW, labelH);
      const leftColW = qrSize;
      const railW = Math.max(1, labelW - leftColW);
      const footerH = Math.max(1, labelH - qrSize);
      return {
        labelW: labelW,
        labelH: labelH,
        bottom: footerH,
        contentH: labelH,
        padL: 0,
        padR: 0,
        innerW: labelW,
        qrInsetMm: 0,
        textGapMm: 0,
        qrZoneW: leftColW,
        qrBlockW: leftColW,
        railStartMm: leftColW,
        railW: railW,
        qrBottomMm: qrSize,
        brandTopMm: qrSize,
        bottomPadTopMm: 0,
        rail: railW,
        qrMainW: leftColW,
        layoutKind: 'compact-fixed',
        leftColW: leftColW,
        footerH: footerH,
        qrSize: qrSize,
        swapBands: true
      };
    }
    const mm = _bcReadMarginsMm();
    const padL = mm.left;
    const padR = mm.right;
    const swapBands = layoutType === 'compact-alt';
    const qrInsetMm = BC_COMPACT_QR_INSET_MM;
    const textGapMm = BC_COMPACT_TEXT_GAP_MM;
    const innerW = Math.max(1, labelW - padL - padR);
    const qrBlockW = 2 * qrInsetMm + qrVisualSizeMm;
    const railStartMm = padL + qrBlockW + textGapMm;
    const railW = Math.max(1, labelW - railStartMm - padR);
    const qrBottomMm = qrInsetMm + qrVisualSizeMm;
    const brandTopMm = qrBottomMm + textGapMm;
    const contentH = Math.max(1, labelH - bottom);
    const bottomPadTopMm = Math.max(0, brandTopMm - contentH);
    return {
      labelW: labelW,
      labelH: labelH,
      bottom: bottom,
      contentH: contentH,
      padL: padL,
      padR: padR,
      innerW: innerW,
      qrInsetMm: qrInsetMm,
      textGapMm: textGapMm,
      qrZoneW: qrBlockW,
      qrBlockW: qrBlockW,
      railStartMm: railStartMm,
      railW: railW,
      qrBottomMm: qrBottomMm,
      brandTopMm: brandTopMm,
      bottomPadTopMm: bottomPadTopMm,
      rail: railW,
      qrMainW: qrBlockW,
      swapBands: swapBands,
      layoutKind: layoutType
    };
  }

  function _bcCompactFontPt() {
    const { textFontPt } = _bcReadTextConfig();
    return Math.max(4, textFontPt);
  }

  function _bcCompactRailFontPt(text, maxRunwayMm, preferredPt) {
    const MM_PER_PT = 25.4 / 72;
    const CHAR_W = 0.62;
    const len = Math.max(1, String(text || '').length);
    let pt = Math.max(4, preferredPt);
    while (pt > 4 && len * pt * MM_PER_PT * CHAR_W > maxRunwayMm - 0.3) {
      pt -= 0.5;
    }
    return pt;
  }

  function _bcSyncCompactTuneFromAdvanced() {
    const pairs = [
      ['bc-op-margin-left', 'bc-margin-left'],
      ['bc-op-margin-right', 'bc-margin-right'],
      ['bc-op-font-pt', 'bc-text-font-pt']
    ];
    pairs.forEach(function (pair) {
      const op = document.getElementById(pair[0]);
      const adv = document.getElementById(pair[1]);
      if (op && adv) op.value = adv.value;
    });
  }

  window.bcOnCompactTuneInput = function () {
    const pairs = [
      ['bc-op-margin-left', 'bc-margin-left'],
      ['bc-op-margin-right', 'bc-margin-right'],
      ['bc-op-font-pt', 'bc-text-font-pt']
    ];
    pairs.forEach(function (pair) {
      const op = document.getElementById(pair[0]);
      const adv = document.getElementById(pair[1]);
      if (op && adv) adv.value = op.value;
    });
    if (typeof window.bcRenderPreview === 'function') window.bcRenderPreview();
  };

  function _bcRefreshCompactTunePanel() {
    const wrap = document.getElementById('bc-compact-tune');
    if (!wrap) return;
    const show = _bcGetLayoutType() === 'compact' && !_bcIsCompactFixedLayout();
    wrap.hidden = !show;
    wrap.style.display = show ? 'block' : 'none';
    if (show) _bcSyncCompactTuneFromAdvanced();
  }

  /** One 6-up row on 109 mm continuous roll — browser @page size for fallback print. */
  function _bcReadCompactMultiPageMm() {
    const lay = _bcReadCompactLayoutMm();
    const gp = _bcReadGapMm();
    const mm = _bcReadMarginsMm();
    const cols = _bcCompactColumnsPerRow();
    const cfg = _bcGetActiveFormatConfig();
    const computedW = mm.left + cols * lay.labelW + Math.max(0, cols - 1) * gp.colGap + mm.right;
    const pageW = Number(cfg.pageWidthMm);
    return {
      pageW: Number.isFinite(pageW) && pageW > 0 ? pageW : computedW,
      pageH: lay.labelH,
      colGap: gp.colGap,
      padLeft: mm.left
    };
  }

  function _bcReadStripLayoutMm() {
    const cfg = _bcGetActiveFormatConfig();
    const z1 = Number(cfg.zone1WidthMm) || 33;
    const z2 = Number(cfg.zone2WidthMm) || 33;
    const tail = Number(cfg.tailWidthMm) || 34;
    const totalW = Number(cfg.labelWidthMm) || z1 + z2 + tail;
    return {
      totalW: totalW,
      labelH: Number(cfg.labelHeightMm) || 12,
      printW: Number(cfg.printWidthMm) || z1 + z2,
      z1: z1,
      z2: z2,
      tail: tail
    };
  }

  /** Legacy server QR URL — preview/print use client-side _bcQrDataUrl instead. */
  function _bcQRSrc(code, px) {
    return `/api/qr?data=${encodeURIComponent(code)}&size=${px || 60}`;
  }

  function _bcClamp(n, min, max) {
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function _bcReadFloat(id, fallback, min, max) {
    const v = parseFloat(document.getElementById(id)?.value ?? String(fallback))
    if (!Number.isFinite(v)) return fallback
    return _bcClamp(v, min, max)
  }

  function _bcReadInt(id, fallback, min, max) {
    const v = parseInt(document.getElementById(id)?.value ?? String(fallback), 10)
    if (!Number.isFinite(v)) return fallback
    return Math.round(_bcClamp(v, min, max))
  }

  function _bcReadLabelGeometryMm() {
    const labelW = _bcReadFloat('bc-label-width', 15, 1, 200)
    const labelH = _bcReadFloat('bc-label-height', 15, 1, 200)
    const cols = _bcReadInt('bc-labels-per-row', 6, 1, 40)
    return { labelW, labelH, cols }
  }

  function _bcReadDotsPerMm() {
    return _bcReadFloat('bc-dots-per-mm', 8, 1, 40)
  }

  function _bcReadQrConfig() {
    const qrCellSize = _bcReadInt('bc-qr-cell-size', 3, 1, 10)
    const qrVisualSizeMm = _bcReadFloat('bc-qr-visual-size-mm', 12, 1, 200)
    const qrTopRatio = _bcReadFloat('bc-qr-top-ratio', 0.04, 0, 1)
    return { qrCellSize, qrVisualSizeMm, qrTopRatio }
  }

  function _bcReadTextConfig() {
    const textTopRatio = _bcReadFloat('bc-text-top-ratio', 0.75, 0, 1)
    const textFontPt = _bcReadFloat('bc-text-font-pt', 5, 0.1, 100)
    const textXMul = _bcReadInt('bc-text-x-mul', 1, 1, 10)
    const textYMul = _bcReadInt('bc-text-y-mul', 1, 1, 10)
    const textFontId = _bcReadInt('bc-text-font-id', 1, 0, 3)
    return { textTopRatio, textFontPt, textXMul, textYMul, textFontId }
  }

  /** Fills #bc-live-summary from current modal inputs (no fixed printer presets). */
  function _bcUpdateBarcodeLiveSummary() {
    const box = document.getElementById('bc-live-summary');
    if (!box) return;

    const dotsPerMm = _bcReadDotsPerMm();
    const calib = _bcReadTsplOffsetXMM();

    if (_bcGetLayoutType() === 'strip') {
      const lay = _bcReadStripLayoutMm();
      const { qrCellSize, qrVisualSizeMm } = _bcReadQrConfig();
      const { textFontPt, textXMul, textYMul, textFontId } = _bcReadTextConfig();
      const wDots = Math.round(lay.totalW * dotsPerMm);
      const hDots = Math.round(lay.labelH * dotsPerMm);
      const lines = [
        `Eyewear strip · TSPL2 SIZE ${lay.totalW.toFixed(2)} × ${lay.labelH.toFixed(2)} mm (~${wDots} × ${hDots} dots)`,
        `Print zone ${lay.printW} mm = Zone1 ${lay.z1} (QR + unit) + Zone2 ${lay.z2} (brand · model · MRP) · Tail ${lay.tail} mm non-print`,
        `QR ${qrVisualSizeMm} mm · TSPL QRCODE cell ${qrCellSize} · Brand scale ${textXMul}×${textYMul} · Preview ${textFontPt} pt · Font id ${textFontId}`
      ];
      if (calib !== 0) lines.push(`USB horizontal calibration ${calib > 0 ? '+' : ''}${calib} mm`);
      box.innerHTML = lines.map((line) => _bcEsc(line)).join('<br>');
      return;
    }

    if (_bcGetLayoutType() === 'compact') {
      const lay = _bcReadCompactLayoutMm();
      const { qrCellSize, qrVisualSizeMm } = _bcReadQrConfig();
      const { textFontPt, textXMul, textYMul, textFontId } = _bcReadTextConfig();
      const cols = _bcCompactColumnsPerRow();
      const mm = _bcReadMarginsMm();
      const gp = _bcReadGapMm();
      const sheetW = mm.left + cols * lay.labelW + Math.max(0, cols - 1) * gp.colGap + mm.right;
      const wDots = Math.round((_bcIsCompactMultiColumn() ? sheetW : lay.labelW) * dotsPerMm);
      const hDots = Math.round(lay.labelH * dotsPerMm);
      const lines = [];
      if (_bcIsCompactMultiColumn()) {
        lines.push(
          `Compact 15×15 roll · TSPL2 row SIZE ${sheetW.toFixed(2)} × ${lay.labelH.toFixed(2)} mm (~${wDots} × ${hDots} dots)`,
          `${cols} stickers/row · cell ${lay.labelW}×${lay.labelH} mm · QR + vertical unit id + brand/price footer`
        );
      } else {
        lines.push(
          `Compact QR 15×15 · TSPL2 SIZE ${lay.labelW.toFixed(2)} × ${lay.labelH.toFixed(2)} mm (~${wDots} × ${hDots} dots)`
        );
      }
      if (lay.layoutKind === 'compact-fixed') {
        const mod = _bcTsplQrModuleCount('0000000');
        const qrDots = mod * qrCellSize;
        lines.push(
          `Fixed 15×15 · QR ${lay.qrSize} mm + rail ${lay.railW} mm + footer ${lay.footerH} mm · zero inset`,
          `TSPL DIRECTION 1 · QRCODE 1,1 cell ${qrCellSize} (~${qrDots} dots) · unit TEXT y=${1 + qrDots} · brand TEXT x=${1 + qrDots} rot 270°`,
          `Font id ${textFontId} · scale ${textXMul}×${textYMul} · preview ${_bcCompactFontPt()} pt`
        );
      } else {
        lines.push(
          `QR ${qrVisualSizeMm} mm · unit rail ${lay.railW.toFixed(1)} mm · ${BC_COMPACT_TEXT_GAP_MM} mm gap QR→text · bottom ${lay.bottom} mm (brand top at QR+${BC_COMPACT_TEXT_GAP_MM} mm)`,
          `Cell inset left ${lay.padL} mm · right ${lay.padR} mm · preview font ${_bcCompactFontPt()} pt`,
          `TSPL QRCODE cell ${qrCellSize} · Text ${textXMul}×${textYMul} · Font id ${textFontId}`
        );
      }
      if (calib !== 0) lines.push(`USB horizontal calibration ${calib > 0 ? '+' : ''}${calib} mm`);
      box.innerHTML = lines.map((line) => _bcEsc(line)).join('<br>');
      return;
    }

    const mm = _bcReadMarginsMm();
    const gp = _bcReadGapMm();
    const { labelW, labelH, cols } = _bcReadLabelGeometryMm();
    const { qrCellSize, qrVisualSizeMm, qrTopRatio } = _bcReadQrConfig();
    const { textTopRatio, textFontPt, textXMul, textYMul, textFontId } = _bcReadTextConfig();

    const sheetW = mm.left + cols * labelW + Math.max(0, cols - 1) * gp.colGap + mm.right;
    const wDots = Math.round(sheetW * dotsPerMm);
    const hDots = Math.round(labelH * dotsPerMm);

    const lines = [];
    lines.push(
      `QR code · TSPL2 row SIZE ${sheetW.toFixed(2)} × ${labelH.toFixed(
        2
      )} mm (~${wDots} × ${hDots} dots at ${dotsPerMm} dots/mm)`
    );
    lines.push(
      `SIZE width = left ${mm.left} + right ${mm.right} + (${cols} × ${labelW}) + (${Math.max(
        0,
        cols - 1
      )} × ${gp.colGap}) = ${sheetW.toFixed(2)} mm`
    );
    lines.push(
      `Feed gap (row) ${gp.rowGap} mm · Column gap ${gp.colGap} mm · Cell inset margins top/right/bottom/left ${mm.top} / ${mm.right} / ${mm.bottom} / ${mm.left} mm`
    );

    lines.push(
      `QR preview ${qrVisualSizeMm} mm · TSPL QRCODE cell ${qrCellSize} · QR top ratio ${qrTopRatio} · Text top ratio ${textTopRatio} · Preview font ${textFontPt} pt · TSPL TEXT scale ${textXMul}×${textYMul} · TSPL font id ${textFontId}`
    );

    if (calib !== 0) {
      lines.push(`USB horizontal calibration ${calib > 0 ? '+' : ''}${calib} mm`);
    }

    box.innerHTML = lines.map((line) => _bcEsc(line)).join('<br>');
  }

  // Render the visual preview of labels in the modal (debounced; QR filled client-side in batches)
  window.bcRenderPreview = function() {
    if (_bcGetLayoutType() === 'compact') _bcSyncCompactTuneFromAdvanced();
    if (_bcPreviewDebounceTimer) clearTimeout(_bcPreviewDebounceTimer);
    _bcPreviewDebounceTimer = setTimeout(_bcRenderPreviewNow, 200);
  };

  function _bcRenderZoneStripPreviewNow() {
    const previewEl = document.getElementById('bc-preview-rows');
    if (!previewEl || !_bcActiveFormatRow) return;
    const fmt = _bcActiveFormatRow;
    const dotsPerMm = _bcReadDotsPerMm();
    const { qrVisualSizeMm } = _bcReadQrConfig();
    const qrPreviewPx = _bcClamp(Math.round(qrVisualSizeMm * dotsPerMm), 40, 400);
    const gp = _bcReadGapMm();
    const items = _bcSelectedStripItems();
    if (!items.length) {
      previewEl.innerHTML = '<div class="bc-empty-preview">Nothing to preview yet. Select products on the purchase screen first.</div>';
      return;
    }
    let inner = '';
    items.forEach(function (item) {
      inner += _bcZoneCellMarkup(item, fmt, qrPreviewPx, { outerExtra: ';margin-bottom:' + (gp.rowGap || 2) + 'mm' });
    });
    previewEl.innerHTML = '<div style="display:flex;flex-direction:column;align-items:flex-start">' + inner + '</div>';
    _bcFillQrPlaceholders(previewEl);
    _bcRefreshOperatorJobSummary();
  }

  function _bcRenderZoneCompactPreviewNow() {
    const previewEl = document.getElementById('bc-preview-rows');
    if (!previewEl || !_bcActiveFormatRow) return;
    const fmt = _bcActiveFormatRow;
    const dotsPerMm = _bcReadDotsPerMm();
    const qrPreviewPx = _bcClamp(Math.round((fmt.config.qrVisualSizeMm || 10) * dotsPerMm), 40, 400);
    const gp = _bcReadGapMm();
    const cols = Number(fmt.columns) || _bcCompactColumnsPerRow();
    const items = _bcSelectedCompactItems();
    if (!items.length) {
      previewEl.innerHTML = '<div class="bc-empty-preview">Nothing to preview yet. Select products on the purchase screen first.</div>';
      return;
    }
    let inner = '';
    if (cols > 1) {
      for (let i = 0; i < items.length; i += cols) {
        inner += '<div style="display:flex;gap:' + gp.colGap + 'mm;margin-bottom:' + (gp.rowGap || 2) + 'mm">';
        for (let c = 0; c < cols; c++) {
          const item = items[i + c];
          if (item) inner += _bcZoneCellMarkup(item, fmt, qrPreviewPx);
          else inner += '<div style="width:' + (fmt.label_width_mm || 15) + 'mm;height:' + (fmt.label_height_mm || 15) + 'mm"></div>';
        }
        inner += '</div>';
      }
    } else {
      items.forEach(function (item) {
        inner += _bcZoneCellMarkup(item, fmt, qrPreviewPx, { outerExtra: ';margin-bottom:2mm' });
      });
    }
    previewEl.innerHTML = '<div style="display:flex;flex-direction:column;align-items:flex-start">' + inner + '</div>';
    _bcFillQrPlaceholders(previewEl);
    _bcRefreshOperatorJobSummary();
  }

  function _bcRenderStripPreviewNow() {
    if (_bcFormatHasZones()) {
      _bcRenderZoneStripPreviewNow();
      return;
    }
    _bcUpdateBarcodeLiveSummary();

    const previewEl = document.getElementById('bc-preview-rows');
    const summaryEl = document.getElementById('bc-summary');
    if (!previewEl) return;

    const lay = _bcReadStripLayoutMm();
    const dotsPerMm = _bcReadDotsPerMm();
    const { qrVisualSizeMm } = _bcReadQrConfig();
    const { textFontPt } = _bcReadTextConfig();
    const qrPreviewPx = _bcClamp(Math.round(qrVisualSizeMm * dotsPerMm), 40, 400);
    const gp = _bcReadGapMm();

    const items = _bcSelectedStripItems();
    if (!items.length) {
      previewEl.innerHTML = '<div class="bc-empty-preview">Nothing to preview yet. Select products on the purchase screen first.</div>';
      _bcRefreshOperatorJobSummary();
      return;
    }

    const expanded = [];
    items.forEach(function (item) {
      for (let c = 0; c < item.copies; c++) expanded.push(item);
    });

    const brandPt = Math.max(textFontPt + 0.5, textFontPt * 1.12);
    let inner = '';
    expanded.forEach(function (item) {
      inner += `<div class="bc-strip-row" style="display:flex;width:${lay.totalW}mm;height:${lay.labelH}mm;box-sizing:border-box;border:1px solid var(--border);border-radius:2px;overflow:hidden;background:var(--card);margin-bottom:${gp.rowGap || 2}mm">
        <div class="bc-strip-z1" style="width:${lay.z1}mm;height:100%;display:flex;align-items:center;gap:1mm;padding:0 1mm;box-sizing:border-box;border-right:1px dashed var(--border)">
          <div class="qr-placeholder" data-qr-code="${_bcEsc(item.code)}" data-qr-px="${qrPreviewPx}"
            style="width:${qrVisualSizeMm}mm;height:${qrVisualSizeMm}mm;flex-shrink:0;background:var(--border);border-radius:1px"></div>
          <div class="mono" style="font-size:${textFontPt}pt;font-weight:600;line-height:1.1;color:var(--text1);word-break:break-all">${_bcEsc(item.unitText)}</div>
        </div>
        <div class="bc-strip-z2" style="width:${lay.z2}mm;height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 1.5mm;box-sizing:border-box;text-align:center;overflow:hidden">
          <div style="font-size:${brandPt}pt;font-weight:700;line-height:1.05;color:var(--text1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_bcEsc(item.brand)}</div>
          <div style="font-size:${textFontPt}pt;line-height:1.05;color:var(--text2);margin-top:0.3mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_bcEsc(item.model)}</div>
          <div style="font-size:${textFontPt}pt;line-height:1.05;color:var(--text2);margin-top:0.3mm">${_bcEsc(item.mrp)}</div>
        </div>
        <div class="bc-strip-tail" style="width:${lay.tail}mm;height:100%;box-sizing:border-box;border-left:1px dashed var(--border);background:repeating-linear-gradient(-45deg,transparent,transparent 2px,var(--border) 2px,var(--border) 3px);opacity:0.35" title="Non-print tail"></div>
      </div>`;
    });

    previewEl.innerHTML = `<div style="display:flex;flex-direction:column;align-items:flex-start">${inner}</div>`;
    _bcFillQrPlaceholders(previewEl);

    _bcRefreshOperatorJobSummary();
  }

  function _bcCompactCellMarkup(item, lay, qrVisualSizeMm, qrPreviewPx, railPt, bottomPt, options) {
    options = options || {};
    const e = options.rawText ? function (s) { return s; } : _bcEsc;
    const outerExtra = options.outerExtra ? String(options.outerExtra) : '';
    const isPrint = options.theme === 'print';
    const lineColor = isPrint ? '#ccc' : 'var(--border)';
    const textColor = isPrint ? '#111827' : 'var(--text1)';
    const qrPhBg = isPrint ? '#e5e7eb' : 'var(--border)';
    const borderCss = options.borderCss != null ? options.borderCss : 'border:1px solid var(--border);border-radius:2px';
    const cardBg = options.cardBg != null ? options.cardBg : 'background:var(--card)';
    const railBg = options.railBg != null ? options.railBg : 'background:var(--bg2)';
    const qrBlock = options.dataUrl
      ? '<img src="' + options.dataUrl + '" style="width:' + qrVisualSizeMm + 'mm;height:' + qrVisualSizeMm + 'mm;display:block" alt="">'
      : '<div class="qr-placeholder" data-qr-code="' + _bcEsc(item.code) + '" data-qr-px="' + qrPreviewPx + '" style="width:' + qrVisualSizeMm + 'mm;height:' + qrVisualSizeMm + 'mm;flex-shrink:0;background:' + qrPhBg + ';border-radius:1px"></div>';
    if (lay.layoutKind === 'compact-fixed') {
      const railText = item.bottomLine;
      const footerText = item.unitText;
      const railFontPt = _bcCompactRailFontPt(railText, lay.labelH, bottomPt);
      return '<div class="bc-compact-row" style="width:' + lay.labelW + 'mm;height:' + lay.labelH + 'mm;box-sizing:border-box;' + borderCss + ';overflow:hidden;' + cardBg + ';position:relative;flex-shrink:0' + outerExtra + '">' +
        '<div style="width:' + lay.leftColW + 'mm;height:' + lay.labelH + 'mm;box-sizing:border-box;display:flex;flex-direction:column;flex-shrink:0">' +
        '<div style="height:' + lay.qrSize + 'mm;flex-shrink:0;display:flex;align-items:flex-start;justify-content:flex-start;overflow:hidden;border-bottom:1px dashed ' + lineColor + ';box-sizing:border-box">' +
        qrBlock +
        '</div>' +
        '<div style="height:' + lay.footerH + 'mm;flex-shrink:0;display:flex;align-items:center;justify-content:flex-start;overflow:hidden;box-sizing:border-box">' +
        '<span class="mono" style="font-size:' + bottomPt + 'pt;font-weight:700;line-height:1;color:' + textColor + ';white-space:nowrap;overflow:hidden">' + e(footerText) + '</span>' +
        '</div></div>' +
        '<div style="position:absolute;left:' + lay.leftColW + 'mm;top:0;bottom:0;width:' + lay.railW + 'mm;box-sizing:border-box;display:flex;align-items:flex-start;justify-content:center;overflow:visible;border-left:1px dashed ' + lineColor + ';' + railBg + '">' +
        '<span class="mono" style="writing-mode:vertical-rl;text-orientation:mixed;font-size:' + railFontPt + 'pt;font-weight:700;line-height:1;color:' + textColor + ';white-space:nowrap">' + e(railText) + '</span>' +
        '</div></div>';
    }
    const padL = lay.padL || 0;
    const padR = lay.padR || 0;
    const bottomPadL = padL;
    const bottomPadR = padR;
    // compact-alt: rail shows brand, bottom shows unit code; compact: rail shows unit code, bottom shows brand
    const railText = lay.swapBands ? item.bottomLine : item.unitText;
    const bottomText = lay.swapBands ? item.unitText : item.bottomLine;
    const railReserveMm = (lay.textGapMm || 0) + lay.railW + padR;
    const railFontPt = _bcCompactRailFontPt(railText, lay.labelH, bottomPt);
    const railRightMm = padR;
    return '<div class="bc-compact-row" style="width:' + lay.labelW + 'mm;height:' + lay.labelH + 'mm;box-sizing:border-box;' + borderCss + ';overflow:hidden;' + cardBg + ';position:relative;flex-shrink:0' + outerExtra + '">' +
      '<div style="width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;padding-left:' + padL + 'mm;padding-right:' + railReserveMm + 'mm">' +
      '<div style="flex:1;min-height:0;display:flex;align-items:flex-start;justify-content:flex-start;overflow:hidden">' +
      qrBlock +
      '</div>' +
      '<div style="height:' + lay.bottom + 'mm;flex-shrink:0;display:flex;align-items:center;justify-content:flex-start;border-top:1px dashed ' + lineColor + ';box-sizing:border-box;padding:0 ' + bottomPadR + 'mm 0 ' + bottomPadL + 'mm;overflow:hidden">' +
      '<span class="mono" style="font-size:' + bottomPt + 'pt;font-weight:700;line-height:1;color:' + textColor + ';white-space:nowrap;overflow:hidden">' + e(bottomText) + '</span>' +
      '</div></div>' +
      '<div style="position:absolute;right:' + railRightMm + 'mm;top:0;bottom:0;width:' + lay.railW + 'mm;box-sizing:border-box;display:flex;align-items:flex-start;justify-content:center;overflow:visible;border-left:1px dashed ' + lineColor + ';' + railBg + '">' +
      '<span class="mono" style="writing-mode:vertical-rl;text-orientation:mixed;font-size:' + railFontPt + 'pt;font-weight:700;line-height:1;color:' + textColor + ';white-space:nowrap">' + e(railText) + '</span>' +
      '</div></div>';
  }

  function _bcCompactCellPreviewHtml(item, lay, qrVisualSizeMm, qrPreviewPx, railPt, bottomPt, extraStyle) {
    const extra = extraStyle ? String(extraStyle) : '';
    return _bcCompactCellMarkup(item, lay, qrVisualSizeMm, qrPreviewPx, railPt, bottomPt, { outerExtra: extra });
  }

  function _bcRenderCompactMultiPreviewNow() {
    if (_bcFormatHasZones()) {
      _bcRenderZoneCompactPreviewNow();
      return;
    }
    _bcUpdateBarcodeLiveSummary();
    const previewEl = document.getElementById('bc-preview-rows');
    if (!previewEl) return;

    const lay = _bcReadCompactLayoutMm();
    const dotsPerMm = _bcReadDotsPerMm();
    const { qrVisualSizeMm } = _bcReadQrConfig();
    const { textFontPt } = _bcReadTextConfig();
    const qrPreviewPx = _bcClamp(Math.round(qrVisualSizeMm * dotsPerMm), 40, 400);
    const gp = _bcReadGapMm();
    const cols = _bcCompactColumnsPerRow();
    const fontPt = _bcCompactFontPt();
    const railPt = fontPt;
    const bottomPt = fontPt;

    const items = _bcSelectedCompactItems();
    if (!items.length) {
      previewEl.innerHTML = '<div class="bc-empty-preview">Nothing to preview yet. Select products on the purchase screen first.</div>';
      _bcRefreshOperatorJobSummary();
      return;
    }

    const expanded = [];
    items.forEach(function (item) {
      for (let c = 0; c < item.copies; c++) expanded.push(item);
    });

    const rollRows = [];
    for (let i = 0; i < expanded.length; i += cols) rollRows.push(expanded.slice(i, i + cols));

    let inner = '';
    rollRows.forEach(function (row) {
      inner += '<div class="bc-compact-roll-row" style="display:flex;flex-wrap:nowrap;gap:' + gp.colGap + 'mm;margin-bottom:' + (gp.rowGap || 2) + 'mm;align-items:flex-start">';
      for (let col = 0; col < cols; col++) {
        const item = row[col];
        if (!item) {
          inner += '<div style="width:' + lay.labelW + 'mm;height:' + lay.labelH + 'mm;flex-shrink:0"></div>';
          continue;
        }
        inner += _bcCompactCellPreviewHtml(item, lay, qrVisualSizeMm, qrPreviewPx, railPt, bottomPt);
      }
      inner += '</div>';
    });
    previewEl.innerHTML = '<div style="display:flex;flex-direction:column;align-items:flex-start">' + inner + '</div>';
    _bcFillQrPlaceholders(previewEl);
    _bcRefreshOperatorJobSummary();
  }

  function _bcRenderCompactPreviewNow() {
    if (_bcFormatHasZones()) {
      _bcRenderZoneCompactPreviewNow();
      return;
    }
    _bcUpdateBarcodeLiveSummary();

    const previewEl = document.getElementById('bc-preview-rows');
    if (!previewEl) return;

    const lay = _bcReadCompactLayoutMm();
    const dotsPerMm = _bcReadDotsPerMm();
    const { qrVisualSizeMm } = _bcReadQrConfig();
    const { textFontPt } = _bcReadTextConfig();
    const qrPreviewPx = _bcClamp(Math.round(qrVisualSizeMm * dotsPerMm), 40, 400);
    const gp = _bcReadGapMm();
    const fontPt = _bcCompactFontPt();
    const railPt = fontPt;
    const bottomPt = fontPt;

    const items = _bcSelectedCompactItems();
    if (!items.length) {
      previewEl.innerHTML = '<div class="bc-empty-preview">Nothing to preview yet. Select products on the purchase screen first.</div>';
      _bcRefreshOperatorJobSummary();
      return;
    }

    const expanded = [];
    items.forEach(function (item) {
      for (let c = 0; c < item.copies; c++) expanded.push(item);
    });

    let inner = '';
    expanded.forEach(function (item) {
      inner += _bcCompactCellPreviewHtml(item, lay, qrVisualSizeMm, qrPreviewPx, railPt, bottomPt, ';margin-bottom:' + (gp.rowGap || 2) + 'mm');
    });
    previewEl.innerHTML = inner;
    _bcFillQrPlaceholders(previewEl);

    _bcRefreshOperatorJobSummary();
  }

  function _bcRenderPreviewNow() {
    if (_bcFormatHasZones()) {
      if (_bcActiveFormatRow && _bcActiveFormatRow.label_type === 'STRIP') {
        _bcRenderZoneStripPreviewNow();
      } else {
        _bcRenderZoneCompactPreviewNow();
      }
      return;
    }
    if (_bcGetLayoutType() === 'strip') {
      _bcRenderStripPreviewNow();
      return;
    }
    if (_bcGetLayoutType() === 'compact') {
      if (_bcIsCompactMultiColumn()) _bcRenderCompactMultiPreviewNow();
      else _bcRenderCompactPreviewNow();
      return;
    }

    _bcUpdateBarcodeLiveSummary();

    const previewEl = document.getElementById('bc-preview-rows');
    const summaryEl = document.getElementById('bc-summary');
    if (!previewEl) return;

    const mm = _bcReadMarginsMm();
    const gp = _bcReadGapMm();
    const { labelW, labelH, cols } = _bcReadLabelGeometryMm();
    const dotsPerMm = _bcReadDotsPerMm();
    const { qrVisualSizeMm, qrTopRatio } = _bcReadQrConfig();
    const { textTopRatio, textFontPt } = _bcReadTextConfig();

    const contentH = Math.max(0, labelH - mm.top - mm.bottom);
    const qrTopMm = mm.top + qrTopRatio * contentH;
    const textTopMm = mm.top + textTopRatio * contentH;

    const qrPreviewPx = _bcClamp(Math.round(qrVisualSizeMm * dotsPerMm), 40, 400);
    previewEl.style.padding = `0mm ${mm.right}mm 0mm ${mm.left}mm`;
    previewEl.style.boxSizing = 'border-box';

    const items = _bcSelectedItems();

    if (!items.length) {
      previewEl.innerHTML = '<div class="bc-empty-preview">Nothing to preview yet. Select products on the purchase screen first.</div>';
      _bcRefreshOperatorJobSummary();
      return;
    }

    // Expand by copies — each entry is {code: pid, label: sku_code}
    const expanded = [];
    items.forEach(({ code, label, copies }) => { for (let c = 0; c < copies; c++) expanded.push({ code, label }); });

    // Group into rows of `cols`
    const rows = [];
    for (let i = 0; i < expanded.length; i += cols) rows.push(expanded.slice(i, i + cols));

    // Build HTML — QR encodes pid (code), text below shows sku_code (label)
    const rowGapCss = `${gp.rowGap}mm`;
    const colGapCss = `${gp.colGap}mm`;
    let inner = '';
    rows.forEach((row) => {
      inner += `<div class="bc-label-row" style="display:flex;flex-wrap:nowrap;gap:${colGapCss};align-items:flex-start">`;
      for (let col = 0; col < cols; col++) {
        const item = row[col];
        if (!item) {
          inner += `<div class="bc-empty-cell" style="width:${labelW}mm;height:${labelH}mm"></div>`
          continue
        }

        inner += `<div class="bc-label-cell" style="position:relative;width:${labelW}mm;height:${labelH}mm;padding:0;box-sizing:border-box">
            <div class="qr-placeholder"
              data-qr-code="${_bcEsc(item.code)}"
              data-qr-px="${qrPreviewPx}"
              style="position:absolute;left:50%;transform:translateX(-50%);top:${qrTopMm}mm;width:${qrVisualSizeMm}mm;height:${qrVisualSizeMm}mm;background:#e5e7eb;border-radius:2px;">
            </div>
            <div class="bc-label-code" style="position:absolute;left:0;right:0;top:${textTopMm}mm;font-size:${textFontPt}pt;font-weight:700;margin-top:0;padding:0;line-height:1.1;white-space:normal;word-break:break-word;overflow-wrap:anywhere;max-height:2.2em;overflow:hidden">${_bcEsc(item.label)}</div>
          </div>`;
      }
      inner += '</div>';
    });
    previewEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:${rowGapCss}">${inner}</div>`;

    _bcFillQrPlaceholders(previewEl);

    _bcRefreshOperatorJobSummary();
  }

  function _bcCalibrationStorageKey(device) {
    if (!device || typeof device.vendorId !== 'number') return '';
    const sn = typeof device.serialNumber === 'string' ? device.serialNumber.trim() : '';
    const safeSn = (sn ? sn.replace(/[^\w.-]/g, '_') : 'no-serial').slice(0, 96);
    return `${BC_CALIB_STORAGE_PREFIX}:${device.vendorId}:${device.productId}:${safeSn}`;
  }

  function _bcUpdateCalibrationHint(msg) {
    const el = document.getElementById('bc-calibration-hint');
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
  }

  /** Load persisted TSPL X offset (mm) into the control for this USB device. */
  function _bcApplyCalibrationFromStorage(device) {
    const input = document.getElementById('bc-tspl-offset-x-mm');
    if (!input || !device) return;
    const key = _bcCalibrationStorageKey(device);
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj.tsplOffsetXMM !== 'number' || !Number.isFinite(obj.tsplOffsetXMM)) return;
      const clamped = Math.max(-20, Math.min(20, obj.tsplOffsetXMM));
      input.value = String(clamped);
    } catch (e) {
      /* ignore corrupt storage */
    }
  }

  function _bcPersistCalibrationNow(device) {
    const input = document.getElementById('bc-tspl-offset-x-mm');
    if (!input || !device) return;
    const key = _bcCalibrationStorageKey(device);
    if (!key) return;
    const raw = parseFloat(input.value ?? '0');
    const tsplOffsetXMM = Number.isFinite(raw) ? Math.max(-20, Math.min(20, raw)) : 0;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          tsplOffsetXMM,
          savedAt: new Date().toISOString(),
        })
      );
    } catch (e) {
      /* quota / private mode */
    }
  }

  function _bcSchedulePersistCalibration() {
    if (!_bcUsbDevice || !_bcUsbDevice.opened) return;
    clearTimeout(_bcCalibSaveTimer);
    _bcCalibSaveTimer = setTimeout(() => _bcPersistCalibrationNow(_bcUsbDevice), 450);
  }

  function _bcEnsureCalibrationListeners() {
    const input = document.getElementById('bc-tspl-offset-x-mm');
    if (!input || input.dataset.calibListen === '1') return;
    input.dataset.calibListen = '1';
    input.addEventListener('input', _bcSchedulePersistCalibration);
    input.addEventListener('change', () => {
      if (_bcUsbDevice && _bcUsbDevice.opened) _bcPersistCalibrationNow(_bcUsbDevice);
    });
  }

  /** Re-open an already-authorised USB label printer (no picker). */
  async function _bcTryReconnectUsbPrinter() {
    if (!navigator.usb) return;
    if (_bcUsbDevice && _bcUsbDevice.opened) return;

    if (_bcUsbDevice && !_bcUsbDevice.opened) _bcUsbDevice = null;

    let devices = [];
    try {
      devices = await navigator.usb.getDevices();
    } catch (e) {
      return;
    }

    const match = devices.find(
      (d) => d.vendorId === TSC_VENDOR_ID || d.vendorId === 0x0519 || d.vendorId === 0x154f
    );
    if (!match) return;

    try {
      if (!match.opened) {
        await match.open();
        if (match.configuration === null) await match.selectConfiguration(1);
        await match.claimInterface(0);
      }
      _bcUsbDevice = match;
      _bcApplyCalibrationFromStorage(match);
    } catch (e) {
      _bcUsbDevice = null;
    }
  }

  window.bcForgetPrinterCalibration = function() {
    if (!_bcUsbDevice) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Connect the printer first.');
      else alert('Connect the printer first.');
      return;
    }
    const key = _bcCalibrationStorageKey(_bcUsbDevice);
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        /* ignore */
      }
    }
    const input = document.getElementById('bc-tspl-offset-x-mm');
    if (input) input.value = '0';
    _bcUpdateCalibrationHint('Saved calibration cleared. Adjust again if needed.');
    if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Forgot calibration for this printer.');
  };

  // ── WebUSB: Connect to TSC P210 ────────────────────────────────────────
  window.bcConnectPrinter = async function() {
    if (!navigator.usb) {
      alert('WebUSB is not supported in this browser.\nPlease use Google Chrome or Microsoft Edge.');
      return;
    }
    try {
      _bcEnsureCalibrationListeners();
      _bcUpdatePrinterStatus('connecting');
      const device = await navigator.usb.requestDevice({
        filters: [
          { vendorId: TSC_VENDOR_ID },          // TSC Auto ID
          { vendorId: 0x0519 },                 // some TSC models
          { vendorId: 0x154F },                 // SATO (fallback)
        ]
      });
      await device.open();
      if (device.configuration === null) await device.selectConfiguration(1);
      await device.claimInterface(0);
      _bcUsbDevice = device;
      _bcApplyCalibrationFromStorage(device);
      _bcUpdateCalibrationHint(
        'Calibration for this printer loads automatically next time. Changes save as you type.'
      );
      _bcUpdatePrinterStatus('connected', device.productName || 'TSC P210');
    } catch (err) {
      _bcUsbDevice = null;
      _bcUpdatePrinterStatus('error', err.message || 'Connection failed');
    }
  };

  function _bcUpdatePrinterStatus(state, msg) {
    const dot  = document.getElementById('bc-status-dot');
    const text = document.getElementById('bc-status-text');
    if (!dot || !text) return;
    const map = {
      null:        ['var(--text3)', 'Label printer not connected — click Connect label printer, or printing will open in your browser.'],
      connecting:  ['var(--gold)', 'Connecting to label printer…'],
      connected:   ['var(--green)', 'Ready to print — ' + (msg || 'printer connected') + '.'],
      error:       ['var(--red)', 'Could not connect to the printer' + (msg ? ' (' + msg + ')' : '') + '. You can still print using the browser window.'],
    };
    const pair = map[state] || map[null];
    dot.style.background = pair[0];
    text.textContent = pair[1];
  }

  // ── TSPL2 Command Generator ────────────────────────────────────────────
  function _bcReadMarginsMm() {
    const clip = (v) => Math.max(0, Math.min(60, v));
    const g = (id) => clip(parseFloat(document.getElementById(id)?.value || '0') || 0);
    return {
      top: g('bc-margin-top'),
      bottom: g('bc-margin-bottom'),
      left: g('bc-margin-left'),
      right: g('bc-margin-right'),
    };
  }

  /** Row gap = TSPL feed GAP (mm). Column gap = extra space between adjacent labels in one row (mm). */
  function _bcReadGapMm() {
    const elRow = document.getElementById('bc-gap-row');
    const elCol = document.getElementById('bc-gap-col');
    const rowRaw = parseFloat(elRow?.value ?? '0');
    const colRaw = parseFloat(elCol?.value ?? '0');
    const rowGap = Math.max(0, Math.min(30, Number.isFinite(rowRaw) ? rowRaw : 2));
    const colGap = Math.max(0, Math.min(30, Number.isFinite(colRaw) ? colRaw : 0));
    return { rowGap, colGap };
  }

  /** Extra horizontal shift for WebUSB TSPL only (mm). Negative moves QR/barcode/text left. */
  function _bcReadTsplOffsetXMM() {
    const el = document.getElementById('bc-tspl-offset-x-mm');
    if (!el) return 0;
    const raw = parseFloat(el.value ?? '0');
    if (!Number.isFinite(raw)) return 0;
    return Math.max(-20, Math.min(20, raw));
  }

  function _bcTsplQuote(s) {
    return String(s == null ? '' : s).replace(/"/g, "'");
  }

function _bcSplitTextForLabel(raw, maxLineLength = 18) {
  const text = String(raw || '').trim()
  if (!text) return ['']
  if (text.length <= maxLineLength) return [text]

  const words = text.split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''

  const pushCurrent = () => {
    if (!current) return
    lines.push(current)
    current = ''
  }

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxLineLength) {
      current = next
      continue
    }
    pushCurrent()

    if (word.length > maxLineLength) {
      lines.push(word.slice(0, maxLineLength))
      current = word.slice(maxLineLength)
    } else {
      current = word
    }

    if (lines.length >= 2) break
  }
  pushCurrent()

  if (lines.length === 0) return [text.slice(0, maxLineLength)]
  return lines.slice(0, 2)
}

  function _bcGenerateTSPL2(labelBatches, labelType) {
    /*
      labelBatches: array of rows, each row = array of up to 6 {code, label} objects
        code  = PID (unique purchase identifier, encoded in QR for scanning)
        label = SKU (stable product identifier, printed as text below QR for search)
      Returns: Uint8Array of TSPL2 command bytes
    */
    const { labelW, labelH, cols } = _bcReadLabelGeometryMm();
    const dotsPerMm = _bcReadDotsPerMm();
    const marginsMm = _bcReadMarginsMm();
    const { rowGap, colGap } = _bcReadGapMm();
    const tsplOffsetXMM = _bcReadTsplOffsetXMM();

    const mmToDot = (mm) => Math.round(mm * dotsPerMm);
    const sheetWidthMm = marginsMm.left + (cols * labelW) + ((cols - 1) * colGap) + marginsMm.right;
    const maxXDots = mmToDot(sheetWidthMm);

    const { qrCellSize, qrVisualSizeMm, qrTopRatio } = _bcReadQrConfig();
    const { textTopRatio, textXMul, textYMul, textFontId } = _bcReadTextConfig();

    const qrLeftInsetMm =
      labelType === 'QR'
        ? Math.max(0, (labelW - qrVisualSizeMm) / 2)
        : 0;

    const contentH = Math.max(0, labelH - marginsMm.top - marginsMm.bottom);
    const qrTopMm = marginsMm.top + qrTopRatio * contentH;
    const textTopMm = marginsMm.top + textTopRatio * contentH;

    const qrTopDots = mmToDot(qrTopMm);
    const textTopDots = mmToDot(textTopMm);
    const textLineGapDots = Math.max(8, Math.round(2.2 * dotsPerMm * Math.max(1, textYMul)));

    let cmds = '';
    cmds += `SIZE ${sheetWidthMm} mm, ${labelH} mm\r\n`;
    cmds += `GAP ${rowGap} mm, 0 mm\r\n`;
    cmds += 'DIRECTION ' + _bcTsplDirectionFromFormat() + '\r\n';

    labelBatches.forEach((row) => {
      cmds += 'CLS\r\n';

      row.forEach((item, col) => {
        if (!item) return;

        const cellLeftXmm = marginsMm.left + (col * (labelW + colGap));
        let x = mmToDot(cellLeftXmm + qrLeftInsetMm + tsplOffsetXMM);
        x = Math.max(0, Math.min(x, maxXDots));

        const code = _bcTsplQuote(item.code);
        const labelLines = _bcSplitTextForLabel(item.label).map(_bcTsplQuote)

        if (labelType === 'QR') {
          cmds += `QRCODE ${x},${qrTopDots},L,${qrCellSize},A,0,"${code}"\r\n`;
          labelLines.forEach((line, idx) => {
            const y = textTopDots + (idx * textLineGapDots)
            cmds += `TEXT ${x},${y},"${textFontId}",0,${textXMul},${textYMul},"${line}"\r\n`
          })
        } else {
          cmds += `BARCODE ${x},${qrTopDots},"128",60,1,0,2,2,"${code}"\r\n`;
          labelLines.forEach((line, idx) => {
            const y = textTopDots + (idx * textLineGapDots)
            cmds += `TEXT ${x},${y},"${textFontId}",0,${textXMul},${textYMul},"${line}"\r\n`
          })
        }
      });

      cmds += 'PRINT 1, 1\r\n';
    });

    return new TextEncoder().encode(cmds);
  }

  function _bcGenerateTSPL2Strip(strips) {
    const lay = _bcReadStripLayoutMm();
    const dotsPerMm = _bcReadDotsPerMm();
    const { rowGap } = _bcReadGapMm();
    const tsplOffsetXMM = _bcReadTsplOffsetXMM();
    const { qrCellSize, qrVisualSizeMm } = _bcReadQrConfig();
    const { textXMul, textYMul, textFontId } = _bcReadTextConfig();
    const brandYMul = Math.min(10, textYMul + 1);
    const mmToDot = function (mm) { return Math.round(mm * dotsPerMm); };
    const qrLeftMm = 0.8;
    const unitTextXmm = qrLeftMm + qrVisualSizeMm + 0.8;
    const z2StartMm = lay.z1;
    const line1Ymm = 1.2;
    const line2Ymm = 4.6;
    const line3Ymm = 8.0;

    let cmds = '';
    cmds += `SIZE ${lay.totalW} mm, ${lay.labelH} mm\r\n`;
    cmds += `GAP ${rowGap} mm, 0 mm\r\n`;
    cmds += 'DIRECTION ' + _bcTsplDirectionFromFormat() + '\r\n';
    strips.forEach(function (item) {
      if (!item) return;
      cmds += 'CLS\r\n';

      const code = _bcTsplQuote(item.code);
      const unitText = _bcTsplQuote(item.unitText || item.code);
      const brand = _bcTsplQuote(item.brand);
      const model = _bcTsplQuote(item.model);
      const mrp = _bcTsplQuote(item.mrp);

      const qrX = mmToDot(qrLeftMm + tsplOffsetXMM);
      const qrY = mmToDot(0.8);
      cmds += `QRCODE ${Math.max(0, qrX)},${qrY},L,${qrCellSize},A,0,"${code}"\r\n`;

      const unitX = mmToDot(unitTextXmm + tsplOffsetXMM);
      const unitY = mmToDot(3.2);
      cmds += `TEXT ${Math.max(0, unitX)},${unitY},"${textFontId}",0,${textXMul},${textYMul},"${unitText}"\r\n`;

      const z2X = mmToDot(z2StartMm + 1 + tsplOffsetXMM);
      cmds += `TEXT ${Math.max(0, z2X)},${mmToDot(line1Ymm)},"${textFontId}",0,${textXMul},${brandYMul},"${brand}"\r\n`;
      cmds += `TEXT ${Math.max(0, z2X)},${mmToDot(line2Ymm)},"${textFontId}",0,${textXMul},${textYMul},"${model}"\r\n`;
      cmds += `TEXT ${Math.max(0, z2X)},${mmToDot(line3Ymm)},"${textFontId}",0,${textXMul},${textYMul},"${mrp}"\r\n`;

      cmds += 'PRINT 1, 1\r\n';
    });

    return new TextEncoder().encode(cmds);
  }

  /** QR symbol module width (21 = Version 1) for TSPL dot layout — numeric L ECC. */
  function _bcTsplQrModuleCount(data) {
    const len = String(data || '').length;
    if (!len) return 21;
    if (/^\d+$/.test(String(data))) {
      if (len <= 7) return 21;
      if (len <= 14) return 25;
      if (len <= 24) return 29;
      if (len <= 34) return 33;
      if (len <= 44) return 37;
      if (len <= 54) return 41;
      if (len <= 64) return 45;
      if (len <= 84) return 49;
    }
    return 21;
  }

  function _bcGenerateTSPL2FromZones(itemsOrBatches, options) {
    options = options || {};
    const fmt = _bcActiveFormatRow;
    if (!fmt || !fmt.zones || !fmt.zones.length) return new TextEncoder().encode('');
    const cfg = _bcGetActiveFormatConfig();
    const dotsPerMm = Number(cfg.dotsPerMm) || 8;
    const qrCellSize = Number(cfg.qrCellSize) || 3;
    const textFontId = Number(cfg.textFontId) != null ? cfg.textFontId : 1;
    const textXMul = Number(cfg.textXMul) || 1;
    const textYMul = Number(cfg.textYMul) || 1;
    const mmToDot = function (mm) { return Math.round(mm * dotsPerMm); };
    const tsplOffsetXMM = _bcReadTsplOffsetXMM();
    const lw = fmt.label_width_mm || cfg.labelWidthMm || 15;
    const lh = fmt.label_height_mm || cfg.labelHeightMm || 15;
    const rowGapMm = Math.max(0, Number(fmt.row_gap_mm) || Number(cfg.gapRow) || 0);
    const marginLeft = Number(fmt.margin_left_mm) || 0;
    const colGap = Number(fmt.col_gap_mm) || 0;
    const multiCol = !!options.multiCol;
    const cols = multiCol ? (Number(fmt.columns) || cfg.labelsPerRow || 1) : 1;
    const direction = _bcTsplDirectionFromFormat(fmt);

    function cellTspl(item, cellLeftMm) {
      let block = '';
      const cellLeftDots = mmToDot(cellLeftMm + tsplOffsetXMM);
      fmt.zones.forEach(function (z) {
        if (!z.printable || z.zone_type === 'tail') return;
        const xd = mmToDot(z.x_mm) + cellLeftDots + 1;
        const yd = mmToDot(z.y_mm) + 1;
        if (z.zone_type === 'qr') {
          const qrData = _bcTsplQuote(_bcApplyZoneTokens(z.content, item));
          block += 'QRCODE ' + xd + ',' + yd + ',L,' + qrCellSize + ',A,0,"' + qrData + '"\r\n';
        } else if (z.zone_type === 'text') {
          const txt = _bcTsplQuote(_bcApplyZoneTokens(z.content, item));
          const alignApi = window.cosmosLabelZoneAlign;
          if (alignApi) {
            block += alignApi.zoneTextTsplLine(z, xd, yd, dotsPerMm, textFontId, textXMul, textYMul, txt) + '\r\n';
          } else {
            const rot = z.writing_mode === 'vertical' ? 270 : 0;
            block += 'TEXT ' + xd + ',' + yd + ',"' + textFontId + '",' + rot + ',' + textXMul + ',' + textYMul + ',"' + txt + '"\r\n';
          }
        }
      });
      return block;
    }

    let cmds = 'CLS\r\n';
    if (multiCol) {
      const batches = itemsOrBatches;
      const sheetW = marginLeft + cols * lw + Math.max(0, cols - 1) * colGap + (Number(fmt.margin_right_mm) || 0);
      cmds += 'SIZE ' + sheetW + ' mm, ' + lh + ' mm\r\n';
      cmds += 'GAP ' + rowGapMm + ' mm, 0 mm\r\n';
      cmds += 'DIRECTION ' + direction + '\r\n';
      batches.forEach(function (row) {
        const hasItem = row && row.some(function (item) { return !!item; });
        if (!hasItem) return;
        cmds += 'CLS\r\n';
        row.forEach(function (item, col) {
          if (!item) return;
          const cellLeftMm = marginLeft + col * (lw + colGap);
          cmds += cellTspl(item, cellLeftMm);
        });
        cmds += 'PRINT 1,1\r\n';
      });
    } else {
      const items = itemsOrBatches;
      cmds += 'SIZE ' + lw + ' mm, ' + lh + ' mm\r\n';
      cmds += 'GAP ' + rowGapMm + ' mm, 0 mm\r\n';
      cmds += 'DIRECTION ' + direction + '\r\n';
      items.forEach(function (item) {
        if (!item) return;
        cmds += 'CLS\r\n';
        cmds += cellTspl(item, 0);
        cmds += 'PRINT 1,1\r\n';
      });
    }
    return new TextEncoder().encode(cmds);
  }

  /** compact-fixed TSPL dots: QRCODE at 1,1 · unit below QR · brand 270° flush right (zero gaps). */
  function _bcTsplCompactFixedDots(code, qrCellSize, cellLeftDots) {
    const pad = 1;
    const qrDots = _bcTsplQrModuleCount(code) * qrCellSize;
    const qrX = cellLeftDots + pad;
    const qrY = pad;
    return {
      qrX: qrX,
      qrY: qrY,
      footerX: qrX,
      footerY: qrY + qrDots,
      footerRot: 0,
      railX: qrX + qrDots,
      railY: qrY,
      railRot: 270
    };
  }

  function _bcGenerateTSPL2Compact(labels) {
    const lay = _bcReadCompactLayoutMm();
    const dotsPerMm = _bcReadDotsPerMm();
    const gp = _bcReadGapMm();
    const tsplOffsetXMM = _bcReadTsplOffsetXMM();
    const { qrCellSize } = _bcReadQrConfig();
    const { textXMul, textYMul, textFontId } = _bcReadTextConfig();
    const mmToDot = function (mm) { return Math.round(mm * dotsPerMm); };
    const isFixed = lay.layoutKind === 'compact-fixed';
    const gapMm = isFixed ? Math.max(gp.colGap, gp.rowGap) : gp.rowGap;
    const direction = _bcTsplDirectionFromFormat();

    let cmds = '';
    cmds += `SIZE ${lay.labelW} mm, ${lay.labelH} mm\r\n`;
    cmds += `GAP ${gapMm} mm, 0 mm\r\n`;
    cmds += `DIRECTION ${direction}\r\n`;
    labels.forEach(function (item) {
      if (!item) return;
      cmds += 'CLS\r\n';

      const code = _bcTsplQuote(item.code);
      const unitText = _bcTsplQuote(item.unitText);
      const bottom = _bcTsplQuote(item.bottomLine);
      const railStr = isFixed ? bottom : unitText;
      const footerStr = isFixed ? unitText : bottom;

      if (isFixed) {
        const g = _bcTsplCompactFixedDots(item.code, qrCellSize, mmToDot(tsplOffsetXMM));
        cmds += `QRCODE ${g.qrX},${g.qrY},L,${qrCellSize},A,0,"${code}"\r\n`;
        cmds += `TEXT ${g.footerX},${g.footerY},"${textFontId}",${g.footerRot},${textXMul},${textYMul},"${footerStr}"\r\n`;
        cmds += `TEXT ${g.railX},${g.railY},"${textFontId}",${g.railRot},${textXMul},${textYMul},"${railStr}"\r\n`;
      } else {
        const qrX = Math.max(0, mmToDot(lay.padL + lay.qrInsetMm + tsplOffsetXMM));
        const qrY = mmToDot(lay.qrInsetMm);
        cmds += `QRCODE ${qrX},${qrY},L,${qrCellSize},A,0,"${code}"\r\n`;

        const railX = Math.max(0, mmToDot(lay.railStartMm + tsplOffsetXMM));
        const railY = mmToDot(lay.qrInsetMm);
        cmds += `TEXT ${railX},${railY},"${textFontId}",90,${textXMul},${textYMul},"${railStr}"\r\n`;

        const bottomX = Math.max(0, mmToDot(lay.padL + 0.5 + tsplOffsetXMM));
        const bottomY = mmToDot(lay.brandTopMm);
        cmds += `TEXT ${bottomX},${bottomY},"${textFontId}",0,${textXMul},${textYMul},"${footerStr}"\r\n`;
      }

      cmds += 'PRINT 1, 1\r\n';
    });

    return new TextEncoder().encode(cmds);
  }

  function _bcGenerateTSPL2CompactRows(batches) {
    const lay = _bcReadCompactLayoutMm();
    const { labelW, labelH, cols } = _bcReadLabelGeometryMm();
    const marginsMm = _bcReadMarginsMm();
    const gp = _bcReadGapMm();
    const tsplOffsetXMM = _bcReadTsplOffsetXMM();
    const dotsPerMm = _bcReadDotsPerMm();
    const { qrCellSize } = _bcReadQrConfig();
    const { textXMul, textYMul, textFontId } = _bcReadTextConfig();
    const mmToDot = function (mm) { return Math.round(mm * dotsPerMm); };
    const sheetWidthMm = marginsMm.left + (cols * labelW) + (Math.max(0, cols - 1) * gp.colGap) + marginsMm.right;
    const maxXDots = mmToDot(sheetWidthMm);
    const isFixed = lay.layoutKind === 'compact-fixed';
    const gapMm = isFixed ? Math.max(gp.colGap, gp.rowGap) : gp.rowGap;
    const direction = _bcTsplDirectionFromFormat();

    let cmds = '';
    cmds += 'SIZE ' + sheetWidthMm + ' mm, ' + labelH + ' mm\r\n';
    cmds += 'GAP ' + gapMm + ' mm, 0 mm\r\n';
    cmds += 'DIRECTION ' + direction + '\r\n';
    batches.forEach(function (row) {
      cmds += 'CLS\r\n';

      row.forEach(function (item, col) {
        if (!item) return;
        const cellLeftMm = marginsMm.left + (col * (labelW + gp.colGap));
        const code = _bcTsplQuote(item.code);
        const unitText = _bcTsplQuote(item.unitText);
        const bottom = _bcTsplQuote(item.bottomLine);
        const railStr = isFixed ? bottom : unitText;
        const footerStr = isFixed ? unitText : bottom;

        if (isFixed) {
          const cellLeftDots = mmToDot(cellLeftMm + tsplOffsetXMM);
          const g = _bcTsplCompactFixedDots(item.code, qrCellSize, cellLeftDots);
          const qrX = Math.max(0, Math.min(g.qrX, maxXDots));
          const railX = Math.max(0, Math.min(g.railX, maxXDots));
          const footerX = Math.max(0, Math.min(g.footerX, maxXDots));
          cmds += 'QRCODE ' + qrX + ',' + g.qrY + ',L,' + qrCellSize + ',A,0,"' + code + '"\r\n';
          cmds += 'TEXT ' + footerX + ',' + g.footerY + ',"' + textFontId + '",' + g.footerRot + ',' + textXMul + ',' + textYMul + ',"' + footerStr + '"\r\n';
          cmds += 'TEXT ' + railX + ',' + g.railY + ',"' + textFontId + '",' + g.railRot + ',' + textXMul + ',' + textYMul + ',"' + railStr + '"\r\n';
        } else {
          let qrX = mmToDot(cellLeftMm + lay.padL + lay.qrInsetMm + tsplOffsetXMM);
          qrX = Math.max(0, Math.min(qrX, maxXDots));
          const qrY = mmToDot(lay.qrInsetMm);
          cmds += 'QRCODE ' + qrX + ',' + qrY + ',L,' + qrCellSize + ',A,0,"' + code + '"\r\n';

          const railXmm = cellLeftMm + lay.railStartMm;
          let railX = mmToDot(railXmm + tsplOffsetXMM);
          railX = Math.max(0, Math.min(railX, maxXDots));
          const railY = mmToDot(lay.qrInsetMm);
          cmds += 'TEXT ' + railX + ',' + railY + ',"' + textFontId + '",90,' + textXMul + ',' + textYMul + ',"' + railStr + '"\r\n';

          let bottomX = mmToDot(cellLeftMm + lay.padL + 0.5 + tsplOffsetXMM);
          bottomX = Math.max(0, Math.min(bottomX, maxXDots));
          const bottomY = mmToDot(lay.brandTopMm);
          cmds += 'TEXT ' + bottomX + ',' + bottomY + ',"' + textFontId + '",0,' + textXMul + ',' + textYMul + ',"' + footerStr + '"\r\n';
        }
      });

      cmds += 'PRINT 1, 1\r\n';
    });

    return new TextEncoder().encode(cmds);
  }

  async function _bcFindUsbBulkEndpoint() {
    if (!_bcUsbDevice) return null;
    for (const iface of _bcUsbDevice.configuration.interfaces) {
      for (const alt of iface.alternates) {
        for (const ep of alt.endpoints) {
          if (ep.direction === 'out' && ep.type === 'bulk') return ep.endpointNumber;
        }
      }
    }
    return null;
  }

  async function _bcPrintZoneLabels(printBtn) {
    const isStrip = _bcActiveFormatRow && _bcActiveFormatRow.label_type === 'STRIP';
    const compactItems = isStrip ? _bcSelectedStripItems() : _bcSelectedCompactItems();
    if (!compactItems.length) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('No labels to print. Go back and select products first.');
      return;
    }
    const expanded = [];
    compactItems.forEach(function (item) {
      for (let c = 0; c < item.copies; c++) expanded.push(item);
    });
    const multiCol = !isStrip && _bcIsCompactMultiColumn();
    const cols = _bcCompactColumnsPerRow();
    const batches = [];
    if (multiCol) {
      for (let i = 0; i < expanded.length; i += cols) batches.push(expanded.slice(i, i + cols));
    }
    if (!_bcUsbDevice) {
      await _bcPrintFallbackZoneLabels(multiCol ? batches : expanded, { multiCol: multiCol, isStrip: isStrip });
      return;
    }
    if (printBtn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(printBtn);
    try {
      const endpointNumber = await _bcFindUsbBulkEndpoint();
      if (endpointNumber === null) throw new Error('No bulk-out endpoint found on printer.');
      _bcMaybeUsbOrientationHint();
      const data = _bcGenerateTSPL2FromZones(multiCol ? batches : expanded, { multiCol: multiCol });
      await _bcUsbDevice.transferOut(endpointNumber, data);
      _bcPersistCalibrationNow(_bcUsbDevice);
      if (printBtn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(printBtn);
      else if (printBtn) cosmosBtnDone(printBtn);
      if (typeof cosmosToastSuccess === 'function') {
        cosmosToastSuccess('Sent ' + expanded.length + ' label' + (expanded.length !== 1 ? 's' : '') + ' to printer.');
      }
    } catch (err) {
      if (printBtn && typeof cosmosBtnDone === 'function') cosmosBtnDone(printBtn);
      _bcUpdatePrinterStatus('error', err.message);
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message + ' — falling back to browser print…');
      await _bcPrintFallbackZoneLabels(multiCol ? batches : expanded, { multiCol: multiCol, isStrip: isStrip });
    }
  }

  async function _bcPrintFallbackZoneLabels(itemsOrBatches, options) {
    options = options || {};
    const fmt = _bcActiveFormatRow;
    if (!fmt) return;
    const dotsPerMm = _bcReadDotsPerMm();
    const { qrVisualSizeMm } = _bcReadQrConfig();
    const qrPreviewPx = _bcClamp(Math.round((fmt.config.qrVisualSizeMm || qrVisualSizeMm) * dotsPerMm), 40, 400);
    const lw = fmt.label_width_mm || fmt.config.labelWidthMm || 15;
    const lh = fmt.label_height_mm || fmt.config.labelHeightMm || 15;
    const marginLeft = Number(fmt.margin_left_mm) || 0;
    const marginRight = Number(fmt.margin_right_mm) || 0;
    const colGap = Number(fmt.col_gap_mm) || 0;
    const cols = options.multiCol ? (Number(fmt.columns) || 6) : 1;
    const pageW = marginLeft + cols * lw + Math.max(0, cols - 1) * colGap + marginRight;
    const pageH = lh;
    try {
      await loadBcQrLib();
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Failed to load QR library for print.');
      return;
    }
    const printDataUrls = new Map();
    const flat = options.multiCol
      ? itemsOrBatches.reduce(function (acc, row) { return acc.concat(row); }, [])
      : itemsOrBatches;
    await Promise.all(flat.map(async function (item) {
      if (!item) return;
      const url = await _bcQrDataUrl(item.code).catch(function () { return ''; });
      printDataUrls.set(item.code, url);
    }));
    let rows = '';
    if (options.multiCol) {
      itemsOrBatches.forEach(function (row) {
        const hasItem = row && row.some(function (item) { return !!item; });
        if (!hasItem) return;
        rows += '<div class="bc-print-row" style="padding-left:' + marginLeft + 'mm;gap:' + colGap + 'mm">';
        row.forEach(function (item) {
          if (!item) return;
          rows += _bcZoneCellMarkup(item, fmt, qrPreviewPx, {
            dataUrl: printDataUrls.get(item.code) || '',
            theme: 'print',
            outerExtra: ''
          });
        });
        rows += '</div>';
      });
    } else {
      itemsOrBatches.forEach(function (item) {
        if (!item) return;
        rows += '<div class="bc-print-row" style="padding-left:' + marginLeft + 'mm">';
        rows += _bcZoneCellMarkup(item, fmt, qrPreviewPx, {
          dataUrl: printDataUrls.get(item.code) || '',
          theme: 'print',
          outerExtra: ''
        });
        rows += '</div>';
      });
    }
    const pageCss =
      '@page{size:' + pageW + 'mm ' + pageH + 'mm;margin:0}' +
      'html,body{margin:0;padding:0;width:' + pageW + 'mm;font-family:Arial,sans-serif}' +
      '.bc-print-row{width:' + pageW + 'mm;height:' + pageH + 'mm;display:flex;flex-wrap:nowrap;align-items:flex-start;' +
      'box-sizing:border-box;page-break-after:always;overflow:hidden}' +
      '.bc-print-row:last-child{page-break-after:auto}' +
      '.mono{font-family:Consolas,monospace}' +
      '@media print{.bc-zone-row{border:none!important}}';
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Pop-up blocked. Allow pop-ups and try again.');
      return;
    }
    win.document.write('<!DOCTYPE html><html><head><title>Zone labels — ' + pageW + '×' + pageH + ' mm per row</title>' +
      '<style>' + pageCss + '</style></head>' +
      '<body>' + rows + '<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>');
    win.document.close();
  }

  // ── Print via WebUSB ──────────────────────────────────────────────────
  window.bcPrint = async function() {
    const printBtn = document.getElementById('bc-print-btn');

    if (_bcFormatHasZones()) {
      await _bcPrintZoneLabels(printBtn);
      return;
    }

    if (_bcGetLayoutType() === 'compact') {
      const compactItems = _bcSelectedCompactItems();
      if (!compactItems.length) {
        if (typeof cosmosToastWarn === 'function') cosmosToastWarn('No labels to print. Go back and select products first.');
        else alert('No labels to print. Go back and select products first.');
        return;
      }
      const expanded = [];
      compactItems.forEach(function (item) {
        for (let c = 0; c < item.copies; c++) expanded.push(item);
      });

      const multiCol = _bcIsCompactMultiColumn();
      const cols = _bcCompactColumnsPerRow();
      const batches = [];
      if (multiCol) {
        for (let i = 0; i < expanded.length; i += cols) batches.push(expanded.slice(i, i + cols));
      }

      if (!_bcUsbDevice) {
        if (multiCol) await _bcPrintFallbackCompactMulti(batches);
        else await _bcPrintFallbackCompact(expanded);
        return;
      }

      if (printBtn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(printBtn);
      try {
        const endpointNumber = await _bcFindUsbBulkEndpoint();
        if (endpointNumber === null) throw new Error('No bulk-out endpoint found on printer.');
        _bcMaybeUsbOrientationHint();
        const data = _bcFormatHasZones()
          ? _bcGenerateTSPL2FromZones(multiCol ? batches : expanded, { multiCol: multiCol })
          : (multiCol ? _bcGenerateTSPL2CompactRows(batches) : _bcGenerateTSPL2Compact(expanded));
        await _bcUsbDevice.transferOut(endpointNumber, data);
        _bcPersistCalibrationNow(_bcUsbDevice);
        if (printBtn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(printBtn);
        else if (printBtn) cosmosBtnDone(printBtn);
        if (typeof cosmosToastSuccess === 'function') {
          cosmosToastSuccess('Sent ' + expanded.length + ' label' + (expanded.length !== 1 ? 's' : '') + ' to printer.');
        }
      } catch (err) {
        if (printBtn && typeof cosmosBtnDone === 'function') cosmosBtnDone(printBtn);
        _bcUpdatePrinterStatus('error', err.message);
        if (typeof cosmosToastError === 'function') cosmosToastError(err.message + ' — falling back to browser print…');
        else alert('Print failed: ' + err.message + '\n\nFalling back to browser print…');
        if (multiCol) await _bcPrintFallbackCompactMulti(batches);
        else await _bcPrintFallbackCompact(expanded);
      }
      return;
    }

    if (_bcGetLayoutType() === 'strip') {
      const stripItems = _bcSelectedStripItems();
      if (!stripItems.length) {
        if (typeof cosmosToastWarn === 'function') cosmosToastWarn('No labels to print. Go back and select products first.');
        else alert('No labels to print. Go back and select products first.');
        return;
      }
      const expanded = [];
      stripItems.forEach(function (item) {
        for (let c = 0; c < item.copies; c++) expanded.push(item);
      });

      if (!_bcUsbDevice) {
        await _bcPrintFallbackStrip(expanded);
        return;
      }

      if (printBtn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(printBtn);
      try {
        let endpointNumber = null;
        for (const iface of _bcUsbDevice.configuration.interfaces) {
          for (const alt of iface.alternates) {
            for (const ep of alt.endpoints) {
              if (ep.direction === 'out' && ep.type === 'bulk') {
                endpointNumber = ep.endpointNumber;
                break;
              }
            }
            if (endpointNumber !== null) break;
          }
          if (endpointNumber !== null) break;
        }
        if (endpointNumber === null) throw new Error('No bulk-out endpoint found on printer.');
        _bcMaybeUsbOrientationHint();
        const data = _bcFormatHasZones()
          ? _bcGenerateTSPL2FromZones(expanded, { multiCol: false })
          : _bcGenerateTSPL2Strip(expanded);
        await _bcUsbDevice.transferOut(endpointNumber, data);
        _bcPersistCalibrationNow(_bcUsbDevice);
        if (printBtn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(printBtn);
        else if (printBtn) cosmosBtnDone(printBtn);
        if (typeof cosmosToastSuccess === 'function') {
          cosmosToastSuccess(`Sent ${expanded.length} strip label${expanded.length !== 1 ? 's' : ''} to printer.`);
        }
      } catch (err) {
        if (printBtn && typeof cosmosBtnDone === 'function') cosmosBtnDone(printBtn);
        _bcUpdatePrinterStatus('error', err.message);
        if (typeof cosmosToastError === 'function') cosmosToastError(err.message + ' — falling back to browser print…');
        else alert(`Print failed: ${err.message}\n\nFalling back to browser print…`);
        await _bcPrintFallbackStrip(expanded);
      }
      return;
    }

    const items    = _bcSelectedItems();
    const type = 'QR';

    if (!items.length) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('No labels to print. Go back and select products first.');
      else alert('No labels to print. Go back and select products first.');
      return;
    }

    // Expand by copies — each entry is {code: pid, label: sku_code}
    const expanded = [];
    items.forEach(({ code, label, copies }) => { for (let c = 0; c < copies; c++) expanded.push({ code, label }); });

    const { cols } = _bcReadLabelGeometryMm();

    // Batch into roll rows of `cols`
    const batches = [];
    for (let i = 0; i < expanded.length; i += cols) batches.push(expanded.slice(i, i + cols));

    if (!_bcUsbDevice) {
      // Fallback: generate printable HTML window if no USB device
      await _bcPrintFallback(batches, type);
      return;
    }

    if (printBtn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(printBtn);

    try {
      // Find bulk-out endpoint
      let endpointNumber = null;
      for (const iface of _bcUsbDevice.configuration.interfaces) {
        for (const alt of iface.alternates) {
          for (const ep of alt.endpoints) {
            if (ep.direction === 'out' && ep.type === 'bulk') {
              endpointNumber = ep.endpointNumber;
              break;
            }
          }
          if (endpointNumber !== null) break;
        }
        if (endpointNumber !== null) break;
      }

      if (endpointNumber === null) throw new Error('No bulk-out endpoint found on printer.');

      _bcMaybeUsbOrientationHint();
      const data = _bcGenerateTSPL2(batches, type);
      await _bcUsbDevice.transferOut(endpointNumber, data);
      _bcPersistCalibrationNow(_bcUsbDevice);

      if (printBtn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(printBtn);
      else if (printBtn) cosmosBtnDone(printBtn);
      if (typeof cosmosToastSuccess === 'function') {
        cosmosToastSuccess(`Sent ${expanded.length} label${expanded.length !== 1 ? 's' : ''} to printer.`);
      }
    } catch (err) {
      if (printBtn && typeof cosmosBtnDone === 'function') cosmosBtnDone(printBtn);
      _bcUpdatePrinterStatus('error', err.message);
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message + ' — falling back to browser print…');
      else alert(`Print failed: ${err.message}\n\nFalling back to browser print…`);
      await _bcPrintFallback(batches, type);
    }
  };

  // ── Browser-print fallback (generates printable HTML) ─────────────────
  async function _bcPrintFallbackCompactMulti(batches) {
    const lay = _bcReadCompactLayoutMm();
    const page = _bcReadCompactMultiPageMm();
    const cols = _bcCompactColumnsPerRow();
    const { qrVisualSizeMm } = _bcReadQrConfig();
    const { textFontPt } = _bcReadTextConfig();
    const fontPt = _bcCompactFontPt();
    const railPt = fontPt;
    const bottomPt = fontPt;

    try {
      await loadBcQrLib();
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Failed to load QR library for print.');
      else alert(err.message || 'Failed to load QR library for print.');
      return;
    }

    const printDataUrls = new Map();
    const flat = [];
    batches.forEach(function (row) { row.forEach(function (item) { if (item) flat.push(item); }); });
    await Promise.all(flat.map(async function (item) {
      const key = item.code;
      const url = await _bcQrDataUrl(item.code).catch(function () { return ''; });
      printDataUrls.set(key, url);
    }));

    let rows = '';
    batches.forEach(function (row) {
      rows += '<div class="bc-print-row" style="padding-left:' + page.padLeft + 'mm;gap:' + page.colGap + 'mm">';
      for (let col = 0; col < cols; col++) {
        const item = row[col];
        if (!item) {
          rows += '<div class="bc-label-cell" style="width:' + lay.labelW + 'mm;height:' + lay.labelH + 'mm"></div>';
          continue;
        }
        const dataUrl = printDataUrls.get(item.code) || '';
        rows += _bcCompactCellMarkup(item, lay, qrVisualSizeMm, 0, railPt, bottomPt, {
          dataUrl: dataUrl,
          theme: 'print',
          borderCss: '',
          cardBg: '',
          railBg: 'background:#f5f5f5'
        });
      }
      rows += '</div>';
    });

    const pageCss =
      '@page{size:' + page.pageW + 'mm ' + page.pageH + 'mm;margin:0}' +
      'html,body{margin:0;padding:0;width:' + page.pageW + 'mm;font-family:Arial,sans-serif}' +
      '.bc-print-row{width:' + page.pageW + 'mm;height:' + page.pageH + 'mm;display:flex;flex-wrap:nowrap;align-items:flex-start;' +
      'box-sizing:border-box;page-break-after:always;overflow:hidden}' +
      '.bc-print-row:last-child{page-break-after:auto}' +
      '.bc-label-cell{display:flex;flex-direction:column;box-sizing:border-box;flex-shrink:0}' +
      '.mono{font-family:Consolas,monospace}' +
      '@media print{.bc-label-cell{border:none!important}}';

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Pop-up blocked. Please allow pop-ups and try again.');
      else alert('Pop-up blocked. Please allow pop-ups and try again.');
      return;
    }
    win.document.write('<!DOCTYPE html><html><head><title>15×15 roll — ' + page.pageW + '×' + page.pageH + ' mm per row</title>' +
      '<style>' + pageCss + '</style></head>' +
      '<body>' + rows + '<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>');
    win.document.close();
  }

  async function _bcPrintFallbackCompact(labels) {
    const lay = _bcReadCompactLayoutMm();
    const dotsPerMm = _bcReadDotsPerMm();
    const { qrVisualSizeMm } = _bcReadQrConfig();
    const { textFontPt } = _bcReadTextConfig();
    const qrPreviewPx = _bcClamp(Math.round(qrVisualSizeMm * dotsPerMm), 40, 400);
    const fontPt = _bcCompactFontPt();
    const railPt = fontPt;
    const bottomPt = fontPt;

    try {
      await loadBcQrLib();
    } catch (err) {
      alert(err.message || 'Failed to load QR library for print.');
      return;
    }

    const printDataUrls = new Map();
    await Promise.all(labels.map(async function (item) {
      const key = item.code;
      const url = await _bcQrDataUrl(item.code).catch(function () { return ''; });
      printDataUrls.set(key, url);
    }));

    let rows = '';
    labels.forEach(function (item) {
      const dataUrl = printDataUrls.get(item.code) || '';
      rows += _bcCompactCellMarkup(item, lay, qrVisualSizeMm, 0, railPt, bottomPt, {
        dataUrl: dataUrl,
        theme: 'print',
        borderCss: 'border:1px solid #ccc',
        cardBg: '',
        railBg: 'background:#f5f5f5',
        outerExtra: ';margin-bottom:2mm;page-break-inside:avoid'
      });
    });

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Pop-up blocked. Please allow pop-ups and try again.'); return; }
    win.document.write('<!DOCTYPE html><html><head><title>Compact QR 15×15 labels</title>' +
      '<style>@page{size:auto;margin:8mm}body{font-family:Arial,sans-serif;margin:0;padding:8mm}.mono{font-family:Consolas,monospace}</style></head>' +
      '<body>' + rows + '<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>');
    win.document.close();
  }

  async function _bcPrintFallbackStrip(strips) {
    const lay = _bcReadStripLayoutMm();
    const dotsPerMm = _bcReadDotsPerMm();
    const { qrVisualSizeMm } = _bcReadQrConfig();
    const { textFontPt } = _bcReadTextConfig();
    const qrPreviewPx = _bcClamp(Math.round(qrVisualSizeMm * dotsPerMm), 40, 400);
    const brandPt = Math.max(textFontPt + 0.5, textFontPt * 1.12);

    try {
      await loadBcQrLib();
    } catch (err) {
      alert(err.message || 'Failed to load QR library for print.');
      return;
    }

    const printDataUrls = new Map();
    await Promise.all(strips.map(async function (item) {
      const key = item.code;
      const url = await _bcQrDataUrl(item.code).catch(function () { return ''; });
      printDataUrls.set(key, url);
    }));

    let rows = '';
    strips.forEach(function (item) {
      const dataUrl = printDataUrls.get(item.code) || '';
      rows += `<div class="strip" style="width:${lay.totalW}mm;height:${lay.labelH}mm;display:flex;margin-bottom:2mm;border:1px solid #ccc;box-sizing:border-box;page-break-inside:avoid">
        <div style="width:${lay.z1}mm;display:flex;align-items:center;gap:1mm;padding:0 1mm;box-sizing:border-box;border-right:1px dashed #ccc">
          <img src="${dataUrl}" style="width:${qrVisualSizeMm}mm;height:${qrVisualSizeMm}mm;flex-shrink:0" alt="">
          <span class="mono" style="font-size:${textFontPt}pt;font-weight:600">${_bcEsc(item.unitText)}</span>
        </div>
        <div style="width:${lay.z2}mm;display:flex;flex-direction:column;justify-content:center;text-align:center;padding:0 1.5mm;box-sizing:border-box;overflow:hidden">
          <div style="font-size:${brandPt}pt;font-weight:700;line-height:1.05">${_bcEsc(item.brand)}</div>
          <div style="font-size:${textFontPt}pt;line-height:1.05;margin-top:0.3mm">${_bcEsc(item.model)}</div>
          <div style="font-size:${textFontPt}pt;line-height:1.05;margin-top:0.3mm">${_bcEsc(item.mrp)}</div>
        </div>
        <div style="width:${lay.tail}mm;opacity:0.2;background:#eee"></div>
      </div>`;
    });

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Pop-up blocked. Please allow pop-ups and try again.'); return; }
    win.document.write(`<!DOCTYPE html><html><head><title>Eyewear strip labels</title>
<style>@page{size:auto;margin:8mm}body{font-family:Arial,sans-serif;margin:0;padding:8mm}.mono{font-family:Consolas,monospace}</style></head>
<body>${rows}<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>`);
    win.document.close();
  }

  async function _bcPrintFallback(batches, labelType) {
    const pad = _bcReadMarginsMm();
    const gp = _bcReadGapMm();
    const { labelW, labelH, cols } = _bcReadLabelGeometryMm();
    const dotsPerMm = _bcReadDotsPerMm();
    const { qrVisualSizeMm, qrTopRatio } = _bcReadQrConfig();
    const { textTopRatio, textFontPt } = _bcReadTextConfig();

    const contentH = Math.max(0, labelH - pad.top - pad.bottom);
    const qrTopMm = pad.top + qrTopRatio * contentH;
    const textTopMm = pad.top + textTopRatio * contentH;
    const qrPreviewPx = _bcClamp(Math.round(qrVisualSizeMm * dotsPerMm), 40, 400);

    const isQR = labelType === 'QR';
    const printDataUrls = new Map();
    if (isQR) {
      try {
        await loadBcQrLib();
      } catch (err) {
        alert(err.message || 'Failed to load QR library for print.');
        return;
      }
      const allItems = batches.flat().filter(Boolean);
      await Promise.all(allItems.map(async (item) => {
        const key = item.code;
        const url = await _bcQrDataUrl(item.code).catch(() => '');
        printDataUrls.set(key, url);
      }));
    }

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Pop-up blocked. Please allow pop-ups and try again.'); return; }

    // Treat top/bottom as internal offsets (handled via absolute positioning inside each cell).
    // Left/right still acts as sheet padding.
    const sheetPad = `0mm ${pad.right}mm 0mm ${pad.left}mm`;
    const tableSpacing = `${gp.colGap}mm ${gp.rowGap}mm`;

    const totalLabels = batches.reduce((s, r) => s + r.filter(Boolean).length, 0);

    let labelRows = '';
    batches.forEach((row) => {
      const cells = [];
      for (let col = 0; col < cols; col++) {
        const item = row[col];
        if (!item || !item.code) { cells.push('<td class="empty"></td>'); continue; }
        if (isQR) {
          const dataUrl = printDataUrls.get(item.code) || '';
          cells.push(`<td class="label-cell"><img src="${dataUrl}" class="qr-img"><div class="bc-txt">${_bcEsc(item.label)}</div></td>`);
        } else {
          const ac = String(item.code || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
          cells.push(`<td class="label-cell"><svg data-code="${ac}" class="bc-svg"></svg><div class="bc-txt">${_bcEsc(item.label)}</div></td>`);
        }
      }
      labelRows += `<tr>${cells.join('')}</tr>`;
    });

    const libScript = isQR ? '' : `<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>`;
    const initScript = isQR ? '' : `
<script>
  window.addEventListener('load', function() {
    document.querySelectorAll('.bc-svg').forEach(function(svg) {
      var code = svg.getAttribute('data-code');
      if (!code || !window.JsBarcode) return;
      try { JsBarcode(svg, code, { format:'CODE128', width:0.8, height:26, displayValue:false, margin:0 }); }
      catch(e) { svg.innerHTML = '<text x="2" y="14" font-size="6" fill="red">ERR</text>'; }
    });
  });
<\/script>`;

    win.document.write(`<!DOCTYPE html>
<html><head><title>QR Labels — Print</title>
${libScript}
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  @page { margin: 0; }
  html { margin:0; padding:0; }
  body { font-family:'Courier New',monospace; background:#fff; }
  .controls { padding:10px 16px; display:flex; gap:10px; align-items:center; border-bottom:1px solid #ddd; background:#f8f8f8; }
  .controls button { padding:6px 16px; border:1px solid #888; border-radius:4px; cursor:pointer; background:#fff; font-size:13px; }
  .controls button.primary { background:#2563eb; color:#fff; border-color:#2563eb; }
  @media print { .controls { display:none; } }
  .label-sheet { padding:${sheetPad}; }
  table { border-collapse:separate; border-spacing:${tableSpacing}; }
  td.label-cell {
    width:${labelW}mm; height:${labelH}mm;
    border:0.3pt solid #bbb; border-radius:1mm;
    text-align:center; padding:0; overflow:hidden;
    position:relative; box-sizing:border-box;
  }
  td.empty { width:${labelW}mm; height:${labelH}mm; }
  .qr-img  {
    position:absolute;
    left:50%; transform:translateX(-50%); top:${qrTopMm}mm;
    width:${qrVisualSizeMm}mm; height:${qrVisualSizeMm}mm;
    display:block; margin:0;
  }
  .bc-svg  {
    position:absolute;
    left:50%; transform:translateX(-50%); top:${qrTopMm}mm;
    display:block; margin:0;
    max-width:${labelW}mm;
  }
  .bc-txt  {
    position:absolute;
    left:0; right:0; top:${textTopMm}mm;
    font-size:${textFontPt}pt;
    font-weight:700;
    font-family:Arial, sans-serif;
    margin:0; padding:0;
    line-height:1.1;
    color:#333; text-align:center;
    white-space:normal;
    word-break:break-word;
    overflow-wrap:anywhere;
    max-height:2.2em;
    overflow:hidden;
  }
</style>
</head><body>
<div class="controls">
  <span style="font-size:13px;font-weight:600">🏷️ ${isQR ? 'QR Code' : 'Barcode'} Labels — ${totalLabels} labels · ${batches.length} row(s)</span>
<span style="font-size:12px;color:#666">${labelW}mm × ${labelH}mm · ${cols}UP</span>
  <button class="primary" onclick="window.print()">🖨️ Print</button>
  <button onclick="window.close()">Close</button>
</div>
<div class="label-sheet">
<table>${labelRows}</table>
</div>
${initScript}
</body></html>`);
    win.document.close();
  }

  // ── Shared Goods Transfer / Goods Request dispatch helpers ───────────────
  window.transferNormalizeScanPayload = function transferNormalizeScanPayload(raw) {
    let s = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) {
      try {
        const u = new URL(s);
        const qSku = u.searchParams.get('sku') || u.searchParams.get('code');
        if (qSku) return qSku.trim();
        const path = u.pathname.replace(/\/+$/, '');
        const parts = path.split('/').filter(Boolean);
        const last = parts.length ? parts[parts.length - 1] : '';
        if (last) return decodeURIComponent(last);
      } catch (_) { /* ignore */ }
    }
    return s;
  };

  window.transferSkuRequiresUnit = function transferSkuRequiresUnit(sku) {
    return sku && (sku.requires_unit_barcode === true || sku.requires_unit_barcode === 1);
  };

  window.transferRenderUnitChips = function transferRenderUnitChips(units, skuId, removeHandlerName) {
    if (!units || !units.length) {
      return '<span style="font-size:11px;color:var(--text3)">No units scanned</span>';
    }
    return units.map(function (u) {
      return '<div style="display:inline-flex;align-items:center;gap:4px;margin:2px 6px 2px 0;padding:2px 8px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;font-size:11px">' +
        '<span class="mono">' + String(u.unit_barcode || u.unit_id).replace(/&/g, '&amp;') + '</span>' +
        '<button type="button" class="st-remove-btn" style="padding:1px 5px;font-size:10px" onclick="event.stopPropagation();' + removeHandlerName + '(' + skuId + ',' + u.unit_id + ')" title="Remove unit">✕</button>' +
        '</div>';
    }).join('');
  };

  window.transferLookupSku = async function transferLookupSku(code) {
    const key = window.transferNormalizeScanPayload(code);
    if (!key) return null;
    return apiGet('/api/stock-transfers/lookup?q=' + encodeURIComponent(key));
  };

  let _transferHtml5QrLoader = null;
  window.loadHtml5QrLibTransfer = function loadHtml5QrLibTransfer() {
    if (window.Html5Qrcode) return Promise.resolve();
    if (_transferHtml5QrLoader) return _transferHtml5QrLoader;
    _transferHtml5QrLoader = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
      script.integrity = 'sha384-c9d8RFSL+u3exBOJ4Yp3HUJXS4znl9f+z66d1y54ig+ea249SpqR+w1wyvXz/lk+';
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error('Failed to load QR scanner library')); };
      document.head.appendChild(script);
    }).finally(function () {
      _transferHtml5QrLoader = null;
    });
    return _transferHtml5QrLoader;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STOCK TRANSFER MODULE
  // Mobile-first, QR-scan-or-search driven HQ → Store stock transfer.
  // Lives inside DOMContentLoaded so apiGet / apiPost / token are in scope.
  // ─────────────────────────────────────────────────────────────────────────
  {
    let _cart        = [];
    let _scanner     = null;
    let _scanRunning = false;
    let _searchTimer = null;
    let _stLastDocId = null;

    // ── Toast feedback ────────────────────────────────────────────────────────
    function stToast(msg, color) {
      const el = document.getElementById('st-toast');
      if (!el) return;
      el.textContent = msg;
      el.style.background = color || '#111';
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 2800);
    }

    function stEsc(s) {
      return String(s || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function stFmtDate(v) {
      if (!v) return '—';
      const d = new Date(v);
      if (isNaN(d)) return String(v);
      return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
    }

    // ── Init (each visit to Goods Transfer — refresh destinations + history) ──
    window.stInit = async function stInit() {
      await stLoadStores();
      window.stLoadHistory();
      stRenderCart();
    };

    // ── Load stores dropdown ──────────────────────────────────────────────────
    async function stLoadStores() {
      const sel = document.getElementById('st-store-sel');
      if (!sel) return;
      sel.innerHTML = '<option value="">Loading stores…</option>';
      try {
        const raw = await apiGetFirst([
          '/api/stock-transfers/destination-stores',
          '/api/foundry/destination-stores'
        ]);
        const rows = Array.isArray(raw) ? raw : [];
        const seen = new Set();
        const list = [];
        for (const s of rows) {
          if (!s || typeof s !== 'object') continue;
          const sid = Number(s.store_id);
          if (!Number.isFinite(sid) || sid < 1) continue;
          if (seen.has(sid)) continue;
          const status = String(s.status || '').trim().toUpperCase();
          if (status !== 'ACTIVE') continue;
          seen.add(sid);
          list.push(s);
        }
        list.sort((a, b) =>
          String(a.store_name || '').localeCompare(String(b.store_name || ''), undefined, { sensitivity: 'base' })
        );

        sel.innerHTML = '';
        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = '— Select destination store —';
        ph.disabled = true;
        ph.selected = true;
        sel.appendChild(ph);

        for (const s of list) {
          const o = document.createElement('option');
          o.value = String(s.store_id);
          const name = String(s.store_name || '').trim() || 'Store';
          const code = String(s.store_code || '').trim() || '—';
          o.textContent = `${name} (${code})`;
          sel.appendChild(o);
        }

        if (!list.length) {
          stToast(
            'No destination stores available. Add an active retail store (non–warehouse hub format) in Command Unit.',
            '#e53e3e'
          );
        }
      } catch (e) {
        sel.innerHTML = '';
        const errOpt = document.createElement('option');
        errOpt.value = '';
        errOpt.textContent = '— Could not load stores —';
        sel.appendChild(errOpt);
        stToast('Could not load stores: ' + (e && e.message ? e.message : 'error'), '#e53e3e');
      }
    }

    // ── Cart management ───────────────────────────────────────────────────────
    function stPrimaryWarehouseQty(sku) {
      return Math.max(0, Number(sku && (sku.warehouse_qty ?? sku.stock_qty)) || 0);
    }

    function stSkuRequiresUnitBarcode(sku) {
      return window.transferSkuRequiresUnit(sku);
    }

    function stCartUnitIds() {
      const ids = [];
      _cart.forEach((r) => {
        (r.units || []).forEach((u) => { if (u.unit_id) ids.push(Number(u.unit_id)); });
      });
      return ids;
    }

    function stCartHasInsufficientStock() {
      return _cart.some((r) => {
        const wh = Number(r.warehouse_qty) || 0;
        if (stSkuRequiresUnitBarcode(r)) {
          const n = (r.units || []).length;
          return n > wh || n < 1;
        }
        return r.qty > wh;
      });
    }

    function stAddToCart(sku) {
      const whQty = stPrimaryWarehouseQty(sku);
      if (whQty <= 0) {
        if (typeof cosmosToastError === 'function') {
          cosmosToastError('No stock at ' + primaryWarehouseLabel() + ' for this SKU.');
        } else {
          stToast('No stock at primary warehouse for this SKU', '#e53e3e');
        }
        return;
      }
      const needsUnit = stSkuRequiresUnitBarcode(sku);
      const unitId = sku.unit_id != null ? Number(sku.unit_id) : null;

      if (needsUnit) {
        if (!unitId) {
          const msg = 'Scan the 7-digit unit barcode for each piece (product type requires unit tracking).';
          if (typeof cosmosToastError === 'function') cosmosToastError(msg);
          else stToast(msg, '#e53e3e');
          return;
        }
        if (stCartUnitIds().includes(unitId)) {
          const dupMsg = 'Unit ' + (sku.unit_barcode || unitId) + ' is already in the cart.';
          if (typeof cosmosToastWarn === 'function') cosmosToastWarn(dupMsg);
          else stToast(dupMsg, '#e53e3e');
          return;
        }
        let row = _cart.find((r) => r.sku_id === sku.sku_id);
        if (!row) {
          row = {
            sku_id: sku.sku_id,
            sku_code: sku.sku_code,
            product_name: sku.product_name,
            brand_name: sku.brand_name || '—',
            colour_name: sku.colour_name || '—',
            warehouse_qty: whQty,
            requires_unit_barcode: true,
            units: [],
            qty: 0
          };
          _cart.push(row);
        }
        if ((row.units || []).length >= row.warehouse_qty) {
          stToast('Max warehouse stock reached', '#e53e3e');
          return;
        }
        row.units = row.units || [];
        row.units.push({
          unit_id: unitId,
          unit_barcode: sku.unit_barcode || '',
          unit_no: sku.unit_no
        });
        row.qty = row.units.length;
        stToast('Added unit ' + (sku.unit_barcode || unitId) + ' · ' + sku.sku_code, '#16a34a');
      } else {
        const existing = _cart.find((r) => r.sku_id === sku.sku_id);
        if (existing) {
          if (existing.qty < existing.warehouse_qty) {
            existing.qty += 1;
            stToast(`+1 · ${sku.sku_code}`, '#1A5FA8');
          } else {
            stToast('Max warehouse stock reached', '#e53e3e');
            return;
          }
        } else {
          _cart.push({
            sku_id: sku.sku_id,
            sku_code: sku.sku_code,
            product_name: sku.product_name,
            brand_name: sku.brand_name || '—',
            colour_name: sku.colour_name || '—',
            warehouse_qty: whQty,
            requires_unit_barcode: false,
            units: [],
            qty: 1
          });
          stToast(`Added · ${sku.sku_code}`, '#16a34a');
        }
      }
      stRenderCart();
    }

    window.stChangeQty = function stChangeQty(skuId, delta) {
      const item = _cart.find((r) => r.sku_id === skuId);
      if (!item || stSkuRequiresUnitBarcode(item)) return;
      const next = item.qty + delta;
      if (next <= 0) {
        _cart = _cart.filter((r) => r.sku_id !== skuId);
      } else if (next > item.warehouse_qty) {
        stToast('Cannot exceed warehouse stock', '#e53e3e');
        return;
      } else {
        item.qty = next;
      }
      stRenderCart();
    };

    window.stRemoveUnitFromCart = function stRemoveUnitFromCart(skuId, unitId) {
      const item = _cart.find((r) => r.sku_id === skuId);
      if (!item || !item.units) return;
      item.units = item.units.filter((u) => Number(u.unit_id) !== Number(unitId));
      item.qty = item.units.length;
      if (!item.qty) _cart = _cart.filter((r) => r.sku_id !== skuId);
      stRenderCart();
    };

    window.stRemoveFromCart = function stRemoveFromCart(skuId) {
      _cart = _cart.filter((r) => r.sku_id !== skuId);
      stRenderCart();
    };

    window.stClearCart = function stClearCart() {
      _cart = [];
      stRenderCart();
    };

    window.openGoodsTransferDispatchBucket = function openGoodsTransferDispatchBucket() {
      if (typeof window.openBucket !== 'function') {
        if (typeof cosmosToastError === 'function') cosmosToastError('Scan bucket is not loaded.');
        return;
      }
      if (typeof window.stStopCamera === 'function') window.stStopCamera();
      window.openBucket({
        mode: 'TRANSFER',
        sessionId: 'st-cart',
        label: 'Goods Transfer',
        expected: [],
        onSubmit: function (result) {
          (result.scanned || []).forEach(function (s) {
            stAddToCart({
              sku_id: s.sku_id,
              sku_code: s.sku_code,
              product_name: s.product_name || '',
              brand_name: s.brand_name || '',
              colour_name: s.colour_name || '',
              unit_id: s.unit_id,
              unit_barcode: s.unit_barcode,
              unit_no: s.unit_no,
              warehouse_qty: s.warehouse_qty,
              requires_unit_barcode: true
            });
          });
        }
      });
    };

    function stRenderCart() {
      const body    = document.getElementById('st-cart-body');
      const countEl = document.getElementById('st-cart-count');
      const submitR = document.getElementById('st-submit-row');
      const clearB  = document.getElementById('st-clear-cart-btn');
      if (!body) return;
      const total = _cart.reduce((s, r) => s + r.qty, 0);
      if (countEl) countEl.textContent = _cart.length + ' item' + (_cart.length !== 1 ? 's' : '') + ' · ' + total + ' units';
      if (submitR) submitR.style.display = _cart.length ? '' : 'none';
      if (clearB)  clearB.style.display  = _cart.length ? '' : 'none';
      const submitBtn = document.querySelector('#st-submit-row button');
      if (submitBtn) submitBtn.disabled = _cart.length > 0 && stCartHasInsufficientStock();
      if (_cart.length === 0) {
        body.innerHTML = `<div class="st-empty-cart"><div style="font-size:36px;margin-bottom:8px">🛒</div><div>No items added yet — scan or search SKUs to start</div></div>`;
        return;
      }
      body.innerHTML = _cart.map((r) => {
        const unitMode = stSkuRequiresUnitBarcode(r);
        const unitList = (r.units || []).map((u) =>
          '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2);margin-top:4px">' +
          '<span class="mono">' + stEsc(u.unit_barcode || String(u.unit_id)) + '</span>' +
          '<button type="button" class="st-remove-btn" style="padding:2px 6px;font-size:10px" onclick="stRemoveUnitFromCart(' + r.sku_id + ',' + u.unit_id + ')" title="Remove unit">✕</button>' +
          '</div>'
        ).join('');
        const qtyControls = unitMode
          ? '<span class="st-qty-val">' + r.qty + ' unit' + (r.qty !== 1 ? 's' : '') + '</span>'
          : '<div class="st-cart-qty">' +
            '<button class="st-qty-btn" onclick="stChangeQty(' + r.sku_id + ', -1)">−</button>' +
            '<span class="st-qty-val">' + r.qty + '</span>' +
            '<button class="st-qty-btn" onclick="stChangeQty(' + r.sku_id + ', 1)">+</button>' +
            '</div>';
        return `
        <div class="st-cart-row">
          <div style="flex:1;min-width:0">
            <div class="mono" style="font-size:12px;font-weight:700;color:var(--acc2)">${stEsc(r.sku_code)}</div>
            <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${stEsc(r.product_name)}</div>
            <div style="font-size:11.5px;color:var(--text3)">${stEsc(r.brand_name)} · ${stEsc(r.colour_name)}</div>
            <div style="font-size:11px;color:var(--text3)">${primaryWarehouseLabelHtml()} stock: <strong>${r.warehouse_qty}</strong></div>
            ${unitList}
          </div>
          ${qtyControls}
          <button class="st-remove-btn" onclick="stRemoveFromCart(${r.sku_id})" title="Remove line">✕</button>
        </div>`;
      }).join('');
    }

    // ── Camera scanner ────────────────────────────────────────────────────────
    window.stToggleCamera = async function stToggleCamera() {
      const container = document.getElementById('st-scan-container');
      if (!container) return;
      if (_scanRunning) { window.stStopCamera(); return; }
      container.style.display = '';
      const overlay = document.getElementById('st-scan-overlay');
      if (overlay) overlay.style.display = 'none';
      if (!window.Html5Qrcode) {
        try {
          await loadHtml5QrLib();
        } catch (err) {
          stToast('QR scanner library failed to load', '#e53e3e');
          return;
        }
      }
      _scanner = new Html5Qrcode('st-reader');
      _scanRunning = true;
      document.getElementById('st-cam-btn').textContent = '⏹ Stop Camera';
      Html5Qrcode.getCameras()
        .then((devices) => {
          const cam = devices.find((d) => /back|rear|environment/i.test(d.label)) || devices[devices.length - 1];
          const camId = cam ? cam.id : { facingMode: 'environment' };
          return _scanner.start(
            camId,
            { fps: 10, qrbox: { width: 220, height: 220 } },
            (decodedText) => stOnScanSuccess(decodedText),
            () => {}
          );
        })
        .catch((err) => {
          stToast('Camera error: ' + err, '#e53e3e');
          window.stStopCamera();
        });
    };

    window.stStopCamera = function stStopCamera() {
      if (_scanner && _scanRunning) {
        _scanner.stop().catch(() => {}).finally(() => {
          _scanner = null;
          _scanRunning = false;
          const btn = document.getElementById('st-cam-btn');
          if (btn) btn.textContent = '📷 Scan QR';
          const container = document.getElementById('st-scan-container');
          if (container) container.style.display = 'none';
          const overlay = document.getElementById('st-scan-overlay');
          if (overlay) overlay.style.display = '';
        });
      } else {
        _scanRunning = false;
        const container = document.getElementById('st-scan-container');
        if (container) container.style.display = 'none';
      }
    };

    let _lastScan = '';
    let _lastScanTs = 0;
    async function stOnScanSuccess(code) {
      const now = Date.now();
      if (code === _lastScan && now - _lastScanTs < 2000) return;
      _lastScan = code;
      _lastScanTs = now;
      await stLookupAndAdd(code.trim());
    }

    // ── Manual / wedge-scanner search ─────────────────────────────────────────
    window.stSearchDebounce = function stSearchDebounce() {
      clearTimeout(_searchTimer);
      _searchTimer = setTimeout(stDoSearch, 350);
    };

    window.stSearchKeydown = function stSearchKeydown(e) {
      if (e.key === 'Enter') {
        clearTimeout(_searchTimer);
        const q = (document.getElementById('st-search-input').value || '').trim();
        if (q) stLookupAndAdd(q);
      }
    };

    async function stDoSearch() {
      const q = (document.getElementById('st-search-input').value || '').trim();
      const resultsEl = document.getElementById('st-search-results');
      if (!resultsEl) return;
      if (!q) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; return; }
      try {
        const rows = await apiGet(`/api/stock-transfers/available?q=${encodeURIComponent(q)}`);
        if (!rows || !rows.length) {
          resultsEl.style.display = '';
          resultsEl.innerHTML = `<div style="padding:12px 14px;color:var(--text3);font-size:13px">No SKUs found for "${stEsc(q)}"</div>`;
          return;
        }
        resultsEl.style.display = '';
        resultsEl.innerHTML = rows.slice(0, 10).map((r) => `
          <div onclick='stPickSearchResult(${JSON.stringify(r).replace(/'/g,'&#39;')})'
               style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px"
               onmouseenter="this.style.background='var(--bg2)'" onmouseleave="this.style.background=''">
            <div style="flex:1;min-width:0">
              <div class="mono" style="font-size:12px;font-weight:700;color:var(--acc2)">${stEsc(r.sku_code)}</div>
              <div style="font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${stEsc(r.product_name)}</div>
              <div style="font-size:11px;color:var(--text3)">${stEsc(r.brand_name || '')} · ${stEsc(r.colour_name || '')}</div>
            </div>
            <span style="font-size:13px;font-weight:700;color:#16a34a;white-space:nowrap">${r.warehouse_qty} avail.</span>
            <button class="btn xs primary" style="white-space:nowrap">+ Add</button>
          </div>`).join('');
      } catch (err) {
        resultsEl.style.display = '';
        resultsEl.innerHTML = `<div style="padding:12px 14px;color:var(--red);font-size:13px">Search error: ${stEsc(err.message)}</div>`;
      }
    }

    window.stPickSearchResult = function stPickSearchResult(sku) {
      stAddToCart(sku);
      const resultsEl = document.getElementById('st-search-results');
      const inp = document.getElementById('st-search-input');
      if (resultsEl) { resultsEl.innerHTML = ''; resultsEl.style.display = 'none'; }
      if (inp) inp.value = '';
    };

    // ── Lookup by code (scan / Enter) ─────────────────────────────────────────
    async function stLookupAndAdd(code) {
      const key = window.transferNormalizeScanPayload(code);
      if (!key) return;
      try {
        const sku = await window.transferLookupSku(code);
        if (sku) stAddToCart(sku);
      } catch (err) {
        stToast('Not found: ' + key, '#e53e3e');
      }
    }

    // ── Printable dispatch slip (same window pattern as barcode labels) ───────
    function stPrintDispatchSlip(doc) {
      if (!doc) return;
      const lines = doc.lines || [];
      const lineRows = lines.map((l) => `
        <tr>
          <td class="mono">${stEsc(l.sku_code)}</td>
          <td>${stEsc(l.product_name || '')}</td>
          <td>${stEsc(l.brand_name || '—')}</td>
          <td>${stEsc(l.colour_name || '—')}</td>
          <td class="tc">${l.qty_sent != null ? Number(l.qty_sent) : '—'}</td>
        </tr>`).join('');
      const win = window.open('', '_blank');
      if (!win) {
        stToast('Allow pop-ups to print the dispatch slip', '#e53e3e');
        return;
      }
      const dispatched = stFmtDate(doc.dispatched_at || doc.created_at);
      const docType = doc.doc_type === 'REQUEST' ? 'Via request' : 'Direct';
      const title = 'Goods transfer — dispatch slip';
      win.document.write(`<!DOCTYPE html>
<html><head><title>${title}</title>
<style>
  * { box-sizing:border-box; margin:0; }
  body { font-family:system-ui,Segoe UI,sans-serif; background:#fff; color:#111; }
  .controls { padding:10px 16px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; border-bottom:1px solid #ddd; background:#f5f5f5; }
  .controls button { padding:8px 18px; border:1px solid #888; border-radius:6px; cursor:pointer; font-size:14px; background:#fff; }
  .controls .primary { background:#2563eb; color:#fff; border-color:#2563eb; }
  @media print { .controls { display:none !important; } body { padding:0; } }
  .slip { padding:20px 24px; max-width:800px; margin:0 auto; }
  h1 { font-size:18px; margin-bottom:4px; letter-spacing:0.02em; }
  .sub { font-size:13px; color:#444; margin-bottom:16px; }
  .grid { display:grid; grid-template-columns:140px 1fr; gap:6px 12px; font-size:13px; margin-bottom:16px; }
  .grid dt { color:#666; font-weight:600; }
  .grid dd { margin:0; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th, td { border:1px solid #ccc; padding:8px 10px; text-align:left; }
  th { background:#f0f0f0; font-weight:600; }
  td.tc, th.tc { text-align:center; }
  .mono { font-family:Consolas,'Courier New',monospace; font-size:12px; }
  .notes { margin-top:14px; padding:10px; background:#fafafa; border:1px solid #e5e5e5; border-radius:4px; font-size:12px; white-space:pre-wrap; }
</style></head><body>
<div class="controls">
  <span style="font-size:14px;font-weight:600">${title}</span>
  <button type="button" class="primary" onclick="window.print()">Print</button>
  <button type="button" onclick="window.close()">Close</button>
</div>
<div class="slip">
  <h1>Eyewoot — Goods transfer (dispatch)</h1>
  <p class="sub">Carry this slip with the shipment. Destination store confirms in StorePilot — Incoming Goods.</p>
  <dl class="grid">
    <dt>Document #</dt><dd>${stEsc(String(doc.doc_id))}</dd>
    <dt>Type</dt><dd>${stEsc(docType)}</dd>
    <dt>Status</dt><dd>${stEsc(doc.status || '—')}</dd>
    <dt>Destination</dt><dd>${stEsc(doc.store_name || '—')} (${stEsc(doc.store_code || '')})</dd>
    <dt>Dispatched</dt><dd>${stEsc(dispatched)}</dd>
    <dt>Dispatched by</dt><dd>${stEsc(doc.dispatched_by_name || '—')}</dd>
  </dl>
  ${doc.notes ? `<div class="notes"><strong>Notes</strong><br>${stEsc(doc.notes)}</div>` : ''}
  <table>
    <thead><tr><th>SKU</th><th>Product</th><th>Brand</th><th>Colour</th><th class="tc">Qty</th></tr></thead>
    <tbody>${lineRows || '<tr><td colspan="5" style="text-align:center;color:#666">No lines</td></tr>'}</tbody>
  </table>
</div>
</body></html>`);
      win.document.close();
    }

    window.stReprintLastTransferSlip = async function stReprintLastTransferSlip() {
      if (!_stLastDocId) {
        stToast('No transfer slip in this session yet', '#e53e3e');
        return;
      }
      try {
        const doc = await apiGet('/api/stock-transfer-docs/' + _stLastDocId);
        stPrintDispatchSlip(doc);
      } catch (err) {
        stToast('Could not load slip: ' + err.message, '#e53e3e');
      }
    };

    window.stPrintStockTransferDoc = async function stPrintStockTransferDoc(docId) {
      const id = Number(docId);
      if (!Number.isFinite(id) || id < 1) return;
      try {
        const doc = await apiGet('/api/stock-transfer-docs/' + id);
        stPrintDispatchSlip(doc);
      } catch (err) {
        stToast('Could not load slip: ' + err.message, '#e53e3e');
      }
    };

    // ── Submit transfer ────────────────────────────────────────────────────────
    window.stSubmitTransfer = async function stSubmitTransfer() {
      const storeId = document.getElementById('st-store-sel').value;
      const notes   = (document.getElementById('st-notes').value || '').trim();
      if (!storeId) { stToast('Please select a destination store', '#e53e3e'); return; }
      if (!_cart.length) { stToast('Cart is empty', '#e53e3e'); return; }
      if (stCartHasInsufficientStock()) {
        if (typeof cosmosToastError === 'function') {
          cosmosToastError('Cart quantity exceeds stock at ' + primaryWarehouseLabel() + '.');
        } else {
          stToast('Cart exceeds primary warehouse stock', '#e53e3e');
        }
        return;
      }
      const btn = document.querySelector('#st-submit-row button');
      if (btn) { btn.disabled = true; btn.textContent = '⏳ Transferring…'; }
      try {
        const resp = await apiPost('/api/stock-transfer-docs', {
          to_store_id: Number(storeId),
          lines: _cart.map((r) => {
            const line = { sku_id: r.sku_id, qty: r.qty };
            if (stSkuRequiresUnitBarcode(r) && r.units && r.units.length) {
              line.unit_ids = r.units.map((u) => u.unit_id);
            }
            return line;
          }),
          notes: notes || null
        });
        const storeName = document.getElementById('st-store-sel').selectedOptions[0]?.text || 'store';
        const docId     = resp && resp.doc_id;
        _stLastDocId    = docId || null;
        const printLast = document.getElementById('st-print-last-btn');
        if (printLast) printLast.style.display = docId ? '' : 'none';
        stToast(`✓ Transfer Doc #${docId} dispatched to ${storeName} — awaiting store acceptance`, '#16a34a');
        _cart = [];
        stRenderCart();
        document.getElementById('st-notes').value = '';
        window.stLoadHistory();
        try {
          if (docId) {
            const doc = await apiGet('/api/stock-transfer-docs/' + docId);
            stPrintDispatchSlip(doc);
          }
        } catch (_) {
          /* slip is optional; dispatch already succeeded */
        }
      } catch (err) {
        stToast('Transfer failed: ' + err.message, '#e53e3e');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🚚 Dispatch to Store'; }
      }
    };

    // ── Dispatch documents (challans) ───────────────────────────────────────────
    // Old flow used /api/stock-transfers/history (stock_movements after STOCKED only).
    // Direct dispatch creates stock_transfer_docs in DISPATCHED state first — list those here.
    function stDocStatusBadgeClass(status) {
      const s = String(status || '').toUpperCase();
      if (s === 'DISPATCHED') return 'b-orange';
      if (s === 'ACCEPTED') return 'b-blue';
      if (s === 'STOCKED') return 'b-green';
      return 'b-gray';
    }

    window.stOpenDispatchDoc = function stOpenDispatchDoc(docId) {
      if (typeof window.expandMlDoc === 'function') {
        window.expandMlDoc(docId);
        return;
      }
      if (typeof expandMlDoc === 'function') expandMlDoc(docId);
    };

    window.stLoadHistory = async function stLoadHistory() {
      const tbody = document.getElementById('st-history-tbody');
      if (!tbody) return;
      if (typeof window.cosmosSkeletonTable === 'function') {
        window.cosmosSkeletonTable('st-history-tbody', 5, 6);
      } else {
        tbody.innerHTML = '<tr><td colspan="5" class="tc td2 p12">…</td></tr>';
      }
      try {
        const rows = await apiGet('/api/stock-transfer-docs?top_n=50');
        if (!rows || !rows.length) {
          tbody.innerHTML = `<tr><td colspan="5" class="tc td2 p12">No dispatch documents yet — dispatch a cart above to create a challan.</td></tr>`;
          return;
        }
        tbody.innerHTML = rows.map((d) => {
          const dest = [d.store_name, d.store_code].filter(Boolean).join(' · ') || '—';
          const pcs = Number(d.total_qty_sent);
          const docId = Number(d.doc_id);
          return `<tr class="tr-link" onclick="stOpenDispatchDoc(${docId})">
          <td class="mono fw6" style="color:var(--acc2)">${stEsc(String(d.doc_id))}</td>
          <td class="xs td2" style="white-space:nowrap">${stFmtDate(d.dispatched_at || d.created_at)}</td>
          <td style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${stEsc(dest)}">${stEsc(dest)}</td>
          <td><span class="b ${stDocStatusBadgeClass(d.status)}">${stEsc(d.status || '—')}</span></td>
          <td class="tc fw6">${Number.isFinite(pcs) ? pcs : '—'}</td>
        </tr>`;
        }).join('');
      } catch (err) {
        if (typeof window.cosmosToastError === 'function') {
          window.cosmosToastError(err.message || 'Could not load dispatch documents');
        }
        tbody.innerHTML = `<tr><td colspan="5" class="tc td2 p12" style="color:var(--red)">${stEsc(err.message)}</td></tr>`;
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSFER REQUESTS  (PRD §8.3 — store-to-HQ lifecycle)
  // ═══════════════════════════════════════════════════════════════════════════

  const TR_STATUS_BADGE = {
    SUBMITTED:            'b-gold',
    APPROVED:             'b-blue',
    PARTIALLY_DISPATCHED: 'b-teal',
    DISPATCHED:           'b-orange',
    PARTIALLY_RECEIVED:   'b-teal',
    RECEIVED:             'b-green',
    REJECTED:             'b-red'
  };

  function ftrStatusLabel(status) {
    const map = {
      SUBMITTED: 'Pending',
      APPROVED: 'Approved',
      PARTIALLY_DISPATCHED: 'Partially Dispatched',
      DISPATCHED: 'Dispatched',
      PARTIALLY_RECEIVED: 'Partially stocked at store',
      RECEIVED: 'Stocked at Store',
      REJECTED: 'Rejected'
    };
    return map[status] || status || '—';
  }

  function ftrRequestQtySummary(req) {
    const lines = req.lines || [];
    let totalRequested = 0;
    let totalCap = 0;
    let totalDisp = 0;
    let totalRecv = 0;
    lines.forEach(function (l) {
      totalRequested += Math.max(0, Number(l.requested_qty) || 0);
      totalCap += ftrApprovedCap(l);
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

  /** Shown above the line table only when totals are not already visible per row (remainders). */
  function ftrQtySummaryHtml(summary) {
    if (!summary || summary.skuCount < 1) return '';
    const parts = [];
    if (summary.remainingToShip > 0) {
      parts.push('<strong>' + summary.remainingToShip + '</strong> remaining to ship');
    }
    if (summary.remainingToStock > 0) {
      parts.push('<strong>' + summary.remainingToStock + '</strong> remaining to stock');
    }
    if (!parts.length) return '';
    return '<div class="hint cosmos-detail-qty-bar" style="margin-bottom:12px;font-size:13px">' + parts.join(' · ') + '</div>';
  }

  function ftrChallanQtyTotal(shipments) {
    let n = 0;
    (shipments || []).forEach(function (d) {
      n += Math.max(0, Number(d.total_qty_sent) || 0);
    });
    return n;
  }

  async function ftrFetchShipmentDocDetails(shipments) {
    const docs = [];
    for (let i = 0; i < (shipments || []).length; i++) {
      const s = shipments[i];
      if (!s || !s.doc_id) continue;
      try {
        const res = await apiGet('/api/stock-transfer-docs/' + s.doc_id);
        const doc = res.data || res;
        if (doc) docs.push(doc);
      } catch (_) { /* skip */ }
    }
    return docs;
  }

  function ftrBuildShipmentSkuMismatchBanner(req, docDetails) {
    const lines = req.lines || [];
    if (!lines.length || !docDetails.length) return '';

    const reqBySku = {};
    lines.forEach(function (l) {
      reqBySku[l.sku_id] = {
        sku_code: l.sku_code || String(l.sku_id),
        cap: ftrApprovedCap(l),
        disp: Math.max(0, Number(l.dispatched_qty) || 0)
      };
    });

    const docBySku = {};
    docDetails.forEach(function (doc) {
      (doc.lines || []).forEach(function (l) {
        const sid = l.sku_id;
        if (sid == null) return;
        if (!docBySku[sid]) docBySku[sid] = { sku_code: l.sku_code || String(sid), qty: 0 };
        docBySku[sid].qty += Math.max(0, Number(l.qty_sent) || 0);
      });
    });

    const onChallanNotRequest = [];
    Object.keys(docBySku).forEach(function (sid) {
      if (!reqBySku[sid]) {
        onChallanNotRequest.push(docBySku[sid].sku_code + ' (' + docBySku[sid].qty + ')');
      }
    });

    const stillToShip = [];
    lines.forEach(function (l) {
      const cap = ftrApprovedCap(l);
      const disp = Math.max(0, Number(l.dispatched_qty) || 0);
      const rem = cap - disp;
      if (rem > 0) {
        stillToShip.push(trEsc(l.sku_code || l.sku_id) + ' (' + rem + ' pc' + (rem !== 1 ? 's' : '') + ')');
      }
    });

    let challanTotal = 0;
    Object.keys(docBySku).forEach(function (sid) {
      challanTotal += docBySku[sid].qty;
    });
    const requestDisp = lines.reduce(function (s, l) {
      return s + Math.max(0, Number(l.dispatched_qty) || 0);
    }, 0);

    if (challanTotal === requestDisp && !onChallanNotRequest.length) return '';

    let msg = '<strong>Challan vs request:</strong> Transfer documents show <strong>' + challanTotal +
      '</strong> pcs sent in total; this request counts <strong>' + requestDisp +
      '</strong> pcs toward approved lines (by matching SKU).';
    if (onChallanNotRequest.length) {
      msg += ' On challan but not on this request: <span class="mono">' + onChallanNotRequest.join(', ') + '</span>.';
    }
    if (stillToShip.length) {
      msg += ' Still to ship on request: <span class="mono">' + stillToShip.join(', ') + '</span>.';
    }
    msg += ' Open each doc below and confirm SKUs match what the store ordered.';

    return '<div class="hint" style="margin-bottom:12px;background:var(--goldL);border-color:var(--gold);font-size:13px">' + msg + '</div>';
  }

  async function ftrRefreshShipmentQtyInsight(requestId, req) {
    const el = document.getElementById('ftr-shipment-qty-insight');
    if (!el || !req) return;
    try {
      const shipments = await apiGet('/api/transfer-requests/' + requestId + '/shipments?top_n=50') || [];
      if (!shipments.length) {
        el.innerHTML = '';
        return;
      }
      const challanTotal = ftrChallanQtyTotal(shipments);
      const qtySummary = ftrRequestQtySummary(req);
      let html = '';
      if (challanTotal > 0 && challanTotal !== qtySummary.totalDisp) {
        html += '<div class="hint" style="margin-bottom:10px;font-size:13px">' +
          '<strong>Total on challans:</strong> ' + challanTotal + ' pcs sent · ' +
          '<strong>Counted on request lines:</strong> ' + qtySummary.totalDisp + ' pcs' +
          (qtySummary.remainingToShip > 0 ? ' · <strong>' + qtySummary.remainingToShip + '</strong> still to ship' : '') +
          '</div>';
      }
      const docDetails = await ftrFetchShipmentDocDetails(shipments);
      html += ftrBuildShipmentSkuMismatchBanner(req, docDetails);
      el.innerHTML = html;
    } catch (_) {
      el.innerHTML = '';
    }
  }

  function ftrComputeRemainderLines(lines) {
    const out = [];
    (lines || []).forEach(function (l) {
      const cap = ftrApprovedCap(l);
      const progressed = Math.max(
        Math.max(0, Number(l.dispatched_qty) || 0),
        Math.max(0, Number(l.received_qty) || 0)
      );
      const rem = cap - progressed;
      if (rem > 0) out.push({ sku_id: l.sku_id, qty: rem });
    });
    return out;
  }

  function trEsc(s) {
    return String(s == null ? '—' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  let _trView = 'need_attention';
  let _trStoreFilter = '';
  let _ftrStoreFilterReady = false;
  let _ftrViewsReady = false;
  let _ftrHistoryDefaultDays = 90;
  let _ftrHistoryStoreFilter = '';
  let _ftrHistoryStoresCache = null;
  let _trExpanded  = null;
  let _ftrCtCart = [];
  let _ftrCtSearchTimer = null;

  const FTR_DOC_STATUS_BADGE = {
    DISPATCHED: 'b-orange',
    ACCEPTED: 'b-blue',
    STOCKED: 'b-green'
  };

  function ftrDocStatusLabel(status) {
    const map = { DISPATCHED: 'Dispatched', ACCEPTED: 'At store', STOCKED: 'Stocked at store' };
    return map[status] || status || '—';
  }

  window.ftrOpenListRow = function ftrOpenListRow(r) {
    if (!r) return;
    if (ftrIsHqDocRow(r)) {
      if (typeof window.expandMlDoc === 'function') window.expandMlDoc(r.doc_id);
      return;
    }
    if (r.request_id) expandTrRequest(r.request_id);
  };

  function ftrIsHqDocRow(r) {
    return String(r.record_kind || '').toUpperCase() === 'HQ_DOC' || (r.doc_id && !r.request_id);
  }

  function ftrListRowBadgeHtml(r) {
    if (ftrIsHqDocRow(r)) {
      return '<span class="b b-purple">HQ Initiated</span> <span class="b ' + (FTR_DOC_STATUS_BADGE[r.status] || 'b-gray') + '">' + trEsc(ftrDocStatusLabel(r.status)) + '</span>';
    }
    return '<span class="b ' + (TR_STATUS_BADGE[r.status] || 'b-gray') + '">' + trEsc(ftrStatusLabel(r.status)) + '</span>';
  }

  function ftrCtWhQty(sku) {
    return Math.max(0, Number(sku && (sku.warehouse_qty != null ? sku.warehouse_qty : sku.stock_qty)) || 0);
  }

  function ftrCtCartUnitIds() {
    const ids = [];
    _ftrCtCart.forEach(function (r) {
      (r.units || []).forEach(function (u) { if (u.unit_id) ids.push(Number(u.unit_id)); });
    });
    return ids;
  }

  function ftrCtSkuRequiresUnit(sku) {
    return typeof window.transferSkuRequiresUnit === 'function' && window.transferSkuRequiresUnit(sku);
  }

  function ftrCtCartHasInsufficientStock() {
    return _ftrCtCart.some(function (r) {
      const wh = Number(r.warehouse_qty) || 0;
      if (ftrCtSkuRequiresUnit(r)) {
        const n = (r.units || []).length;
        return n > wh || n < 1;
      }
      return r.qty > wh;
    });
  }

  function ftrCtAddSku(sku) {
    const whQty = ftrCtWhQty(sku);
    if (whQty < 1) {
      if (typeof cosmosToastError === 'function') cosmosToastError('No warehouse stock for this SKU.');
      return;
    }
    const needsUnit = ftrCtSkuRequiresUnit(sku);
    const unitId = sku.unit_id != null ? Number(sku.unit_id) : null;
    if (needsUnit) {
      if (!unitId) {
        if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Scan the 7-digit unit barcode for this SKU.');
        return;
      }
      if (ftrCtCartUnitIds().includes(unitId)) {
        if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Unit already in cart.');
        return;
      }
      let row = _ftrCtCart.find(function (x) { return x.sku_id === sku.sku_id; });
      if (!row) {
        row = {
          sku_id: sku.sku_id,
          sku_code: sku.sku_code,
          product_name: sku.product_name,
          brand_name: sku.brand_name || '',
          colour_name: sku.colour_name || '',
          warehouse_qty: whQty,
          units: [],
          qty: 0
        };
        _ftrCtCart.push(row);
      }
      if ((row.units || []).length >= row.warehouse_qty) {
        if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Max warehouse stock reached.');
        return;
      }
      row.units.push({ unit_id: unitId, unit_barcode: sku.unit_barcode || '', unit_no: sku.unit_no });
      row.qty = row.units.length;
    } else {
      let row = _ftrCtCart.find(function (x) { return x.sku_id === sku.sku_id; });
      if (row) {
        if (row.qty >= row.warehouse_qty) {
          if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Max warehouse stock reached.');
          return;
        }
        row.qty += 1;
      } else {
        _ftrCtCart.push({
          sku_id: sku.sku_id,
          sku_code: sku.sku_code,
          product_name: sku.product_name,
          brand_name: sku.brand_name || '',
          colour_name: sku.colour_name || '',
          warehouse_qty: whQty,
          qty: 1,
          units: []
        });
      }
    }
    ftrCtRenderCart();
  }

  async function ftrCtLoadStores() {
    const sel = document.getElementById('ftr-ct-store-sel');
    if (!sel) return;
    sel.innerHTML = '<option value="">Loading stores…</option>';
    try {
      const raw = await apiGetFirst(['/api/stock-transfers/destination-stores', '/api/foundry/destination-stores']);
      const rows = Array.isArray(raw) ? raw : [];
      sel.innerHTML = '';
      const ph = document.createElement('option');
      ph.value = '';
      ph.textContent = '— Select destination store —';
      ph.disabled = true;
      ph.selected = true;
      sel.appendChild(ph);
      rows.filter(function (s) { return s && String(s.status || '').toUpperCase() === 'ACTIVE'; }).forEach(function (st) {
        const o = document.createElement('option');
        o.value = String(st.store_id);
        o.textContent = (st.store_name || 'Store') + ' (' + (st.store_code || '—') + ')';
        sel.appendChild(o);
      });
    } catch (err) {
      sel.innerHTML = '<option value="">Could not load stores</option>';
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    }
  }

  function ftrCtRenderCart() {
    const body = document.getElementById('ftr-ct-cart-body');
    const countEl = document.getElementById('ftr-ct-cart-count');
    const submitBtn = document.getElementById('ftr-ct-submit-btn');
    const total = _ftrCtCart.reduce(function (sum, r) { return sum + (Number(r.qty) || 0); }, 0);
    if (countEl) {
      countEl.textContent = _ftrCtCart.length + ' item' + (_ftrCtCart.length !== 1 ? 's' : '') +
        (total ? ' · ' + total + ' units' : '');
    }
    if (submitBtn) submitBtn.disabled = _ftrCtCart.length > 0 && ftrCtCartHasInsufficientStock();
    if (!body) return;
    if (!_ftrCtCart.length) {
      body.innerHTML = '<div class="empty-state" style="padding:28px 20px"><div class="empty-ic">🛒</div><div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">Cart is empty</div><div style="font-size:13px;color:var(--text2)">Add items from search.</div></div>';
      return;
    }
    body.innerHTML = _ftrCtCart.map(function (r) {
      const unitMode = typeof window.transferSkuRequiresUnit === 'function' && window.transferSkuRequiresUnit(r);
      const unitList = (r.units || []).map(function (u) {
        return '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2);margin-top:4px"><span class="mono">' + trEsc(u.unit_barcode || String(u.unit_id)) + '</span><button type="button" class="btn xs" onclick="ftrCtRemoveUnit(' + r.sku_id + ',' + u.unit_id + ')">✕</button></div>';
      }).join('');
      const qtyControls = unitMode
        ? '<span class="b b-blue">' + (r.units || []).length + ' unit(s)</span>'
        : '<div style="display:flex;align-items:center;gap:6px"><button type="button" class="btn xs" onclick="ftrCtChangeQty(' + r.sku_id + ',-1)">−</button><span class="mono" style="min-width:24px;text-align:center">' + r.qty + '</span><button type="button" class="btn xs" onclick="ftrCtChangeQty(' + r.sku_id + ',1)">+</button></div>';
      return '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><div style="flex:1;min-width:0"><div class="mono" style="font-size:12px;font-weight:600;color:var(--acc2)">' + trEsc(r.sku_code) + '</div><div style="font-size:12px;color:var(--text2)">' + trEsc(r.product_name || '') + '</div>' + unitList + '</div>' + qtyControls + '<button type="button" class="btn xs" onclick="ftrCtRemoveSku(' + r.sku_id + ')">Remove</button></div>';
    }).join('');
  }

  window.ftrCtChangeQty = function (skuId, delta) {
    const item = _ftrCtCart.find(function (r) { return r.sku_id === skuId; });
    if (!item || ftrCtSkuRequiresUnit(item)) return;
    const next = item.qty + delta;
    if (next <= 0) {
      _ftrCtCart = _ftrCtCart.filter(function (r) { return r.sku_id !== skuId; });
    } else if (next > item.warehouse_qty) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Cannot exceed warehouse stock.');
      return;
    } else {
      item.qty = next;
    }
    ftrCtRenderCart();
  };

  window.ftrCtRemoveUnit = function (skuId, unitId) {
    const item = _ftrCtCart.find(function (r) { return r.sku_id === skuId; });
    if (!item || !item.units) return;
    item.units = item.units.filter(function (u) { return Number(u.unit_id) !== Number(unitId); });
    item.qty = item.units.length;
    if (!item.qty) _ftrCtCart = _ftrCtCart.filter(function (r) { return r.sku_id !== skuId; });
    ftrCtRenderCart();
  };

  window.ftrCtRemoveSku = function (skuId) {
    _ftrCtCart = _ftrCtCart.filter(function (r) { return r.sku_id !== skuId; });
    ftrCtRenderCart();
  };

  window.ftrCtClearCart = function () {
    _ftrCtCart = [];
    ftrCtRenderCart();
  };

  window.ftrCtSearchDebounce = function () {
    clearTimeout(_ftrCtSearchTimer);
    _ftrCtSearchTimer = setTimeout(ftrCtDoSearch, 350);
  };

  async function ftrCtDoSearch() {
    const inp = document.getElementById('ftr-ct-search');
    const results = document.getElementById('ftr-ct-results');
    const spin = document.getElementById('ftr-ct-spin');
    const q = inp ? String(inp.value || '').trim() : '';
    if (!results) return;
    if (!q) {
      results.innerHTML = '';
      return;
    }
    if (spin) spin.style.display = '';
    try {
      const rows = await apiGet('/api/stock-transfers/available?q=' + encodeURIComponent(q));
      const list = Array.isArray(rows) ? rows : (rows.data || []);
      if (!list.length) {
        results.innerHTML = '<div style="padding:16px;color:var(--text2);font-size:13px">No SKUs found for "' + trEsc(q) + '"</div>';
        return;
      }
      results.innerHTML = list.slice(0, 12).map(function (r) {
        const wh = ftrCtWhQty(r);
        const payload = JSON.stringify(r).replace(/'/g, '&#39;');
        return '<div class="avail-row tr-link" style="cursor:pointer;padding:10px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px" onclick="ftrCtPickSku(' + payload + ')"><div style="flex:1;min-width:0"><div class="mono" style="font-size:12px;font-weight:600;color:var(--acc2)">' + trEsc(r.sku_code) + '</div><div style="font-size:12px;color:var(--text2)">' + trEsc(r.product_name || '') + '</div></div><span class="b b-green">' + wh + ' avail.</span></div>';
      }).join('');
    } catch (err) {
      results.innerHTML = '<div style="padding:12px;color:var(--red)">' + trEsc(err.message) + '</div>';
    } finally {
      if (spin) spin.style.display = 'none';
    }
  }

  window.ftrCtPickSku = function (sku) {
    ftrCtAddSku(sku || {});
    const inp = document.getElementById('ftr-ct-search');
    const results = document.getElementById('ftr-ct-results');
    if (inp) inp.value = '';
    if (results) {
      results.innerHTML = '';
    }
  };

  let _ftrCtDismissGuardUntil = 0;

  window.ftrCreateTransferBackdropClick = function (e) {
    window.cosmosSheetBackdropClick(e, window.closeFtrCreateTransferModal, {
      dismissGuardUntil: _ftrCtDismissGuardUntil
    });
  };

  window.openFtrCreateTransferModal = async function () {
    const overlay = document.getElementById('overlay-ftr-create-transfer');
    if (!overlay) return;
    if (typeof window.cosmosEnsureApiKey === 'function') {
      window.cosmosEnsureApiKey().catch(function () {});
    }
    _ftrCtCart = [];
    ftrCtRenderCart();
    const notes = document.getElementById('ftr-ct-notes');
    const search = document.getElementById('ftr-ct-search');
    if (notes) notes.value = '';
    if (search) search.value = '';
    const results = document.getElementById('ftr-ct-results');
    if (results) {
      results.innerHTML = '';
    }
    overlay.style.display = 'flex';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    await ftrCtLoadStores();
    if (search && !search._ftrBackdropGuard) {
      search._ftrBackdropGuard = true;
      search.addEventListener('blur', function () {
        _ftrCtDismissGuardUntil = Date.now() + 400;
      });
    }
    if (!window.matchMedia('(max-width: 768px)').matches) {
      setTimeout(function () { if (search) search.focus(); }, 120);
    }
  };

  window.closeFtrCreateTransferModal = function () {
    const overlay = document.getElementById('overlay-ftr-create-transfer');
    if (overlay) {
      overlay.classList.remove('open');
      setTimeout(function () { overlay.style.display = 'none'; }, 200);
    }
    document.body.style.overflow = '';
  };

  window.submitFtrCreateTransfer = async function () {
    const storeSel = document.getElementById('ftr-ct-store-sel');
    const btn = document.getElementById('ftr-ct-submit-btn');
    const storeId = storeSel ? Number(storeSel.value) : 0;
    if (!storeId) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Select a destination store.');
      return;
    }
    if (!_ftrCtCart.length) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Add at least one SKU to the cart.');
      return;
    }
    if (ftrCtCartHasInsufficientStock()) {
      if (typeof cosmosToastError === 'function') cosmosToastError('Cart quantity exceeds warehouse stock.');
      return;
    }
    const notes = ((document.getElementById('ftr-ct-notes') || {}).value || '').trim() || null;
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      const lines = _ftrCtCart.map(function (r) {
        const line = { sku_id: r.sku_id, qty: Math.max(1, Number(r.qty) || 1) };
        if (ftrCtSkuRequiresUnit(r) && r.units && r.units.length) {
          line.unit_ids = r.units.map(function (u) { return u.unit_id; });
        }
        return line;
      });
      const resp = await apiPost('/api/stock-transfer-docs', { to_store_id: storeId, lines: lines, notes: notes });
      const docId = resp && (resp.doc_id != null ? resp.doc_id : (resp.data && resp.data.doc_id));
      if (typeof cosmosToastSuccess === 'function') {
        cosmosToastSuccess(docId ? 'Transfer #' + docId + ' dispatched (HQ Initiated).' : 'Transfer dispatched.');
      }
      window.closeFtrCreateTransferModal();
      if (typeof window.setTrView === 'function') window.setTrView('fulfilled');
      else if (typeof window.loadTransferRequests === 'function') window.loadTransferRequests();
      if (docId && typeof window.expandMlDoc === 'function') window.expandMlDoc(docId);
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    } finally {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
    }
  };

  /** Matches backend shouldScopeTransferRequestsToUserStore — store staff never see HQ store filter. */
  function ftrShouldScopeToUserStore() {
    if (user && String(user.role || '') === 'super_admin') return false;
    if (userPermissions.includes('foundry.transfers.edit')) return false;
    const us = user && user.store_id != null ? Number(user.store_id) : null;
    if (!us) return false;
    return userPermissions.includes('storepilot.transfers.view');
  }

  function ftrCanFilterByStore() {
    return !ftrShouldScopeToUserStore();
  }

  function ftrSyncStoreChipActive() {
    const chips = document.getElementById('ftr-store-chips');
    if (!chips) return;
    chips.querySelectorAll('[data-ftr-store-chip]').forEach(function (b) {
      const id = b.getAttribute('data-store-id') || '';
      const active = id === (_trStoreFilter || '');
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  window.setFtrStoreFilter = function setFtrStoreFilter(storeId) {
    _trStoreFilter = storeId ? String(storeId) : '';
    ftrSyncStoreChipActive();
    if (typeof window.loadTransferRequests === 'function') window.loadTransferRequests();
  };

  function ftrStoreChipLabel(store) {
    if (!store || typeof store !== 'object') return '';
    const code = String(store.store_code || '').trim();
    if (code) return code;
    const sid = Number(store.store_id);
    if (Number.isFinite(sid) && sid > 0) return 'Store #' + sid;
    return '';
  }

  async function ftrFetchDestinationStoresList() {
    const raw = await apiGetFirst([
      '/api/stock-transfers/destination-stores',
      '/api/foundry/destination-stores'
    ]);
    const rows = Array.isArray(raw) ? raw : [];
    const seen = new Set();
    const list = [];
    rows.forEach(function (s) {
      if (!s || typeof s !== 'object') return;
      const sid = Number(s.store_id);
      if (!Number.isFinite(sid) || sid < 1 || seen.has(sid)) return;
      const status = String(s.status || '').trim().toUpperCase();
      if (status && status !== 'ACTIVE') return;
      seen.add(sid);
      list.push(s);
    });
    list.sort(function (a, b) {
      return String(a.store_code || a.store_name || '').localeCompare(
        String(b.store_code || b.store_name || ''),
        undefined,
        { sensitivity: 'base' }
      );
    });
    return list;
  }

  async function ftrInitStoreFilter() {
    const row = document.getElementById('ftr-store-filter-row');
    const chips = document.getElementById('ftr-store-chips');
    if (!row || !chips) return;
    if (!ftrCanFilterByStore()) {
      row.hidden = true;
      row.style.display = '';
      _trStoreFilter = '';
      return;
    }
    row.hidden = false;
    row.style.display = '';
    if (_ftrStoreFilterReady) {
      ftrSyncStoreChipActive();
      return;
    }
    const prev = _trStoreFilter;
    chips.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'btn sm';
    allBtn.textContent = 'All stores';
    allBtn.setAttribute('data-ftr-store-chip', '1');
    allBtn.setAttribute('data-store-id', '');
    allBtn.onclick = function () { window.setFtrStoreFilter(''); };
    chips.appendChild(allBtn);
    try {
      const list = await ftrFetchDestinationStoresList();
      list.forEach(function (s) {
        const sid = String(s.store_id);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn sm';
        btn.textContent = ftrStoreChipLabel(s) || ('Store #' + s.store_id);
        const titleParts = [s.store_name, s.store_code].map(function (v) { return String(v || '').trim(); }).filter(Boolean);
        if (titleParts.length) btn.title = titleParts.join(' · ');
        btn.setAttribute('aria-label', 'Filter by store ' + (ftrStoreChipLabel(s) || sid));
        btn.setAttribute('data-ftr-store-chip', '1');
        btn.setAttribute('data-store-id', sid);
        btn.onclick = function () { window.setFtrStoreFilter(sid); };
        chips.appendChild(btn);
      });
      _ftrStoreFilterReady = true;
      ftrSyncStoreChipActive();
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Could not load stores.');
    }
  }

  let _ftrDispatchSearchResults = [];
  let _ftrDispatchCart = null;
  let _trRejectPendingId = null;
  let _ftrScanner = null;
  let _ftrScanRunning = false;
  let _ftrLastScan = '';
  let _ftrLastScanTs = 0;

  function ftrApprovedCap(line) {
    if (line.approved_qty != null && Number(line.approved_qty) > 0) return Number(line.approved_qty);
    return Math.max(0, Number(line.requested_qty) || 0);
  }

  function ftrInitDispatchCart(req) {
    _ftrDispatchCart = {
      requestId: req.request_id,
      lines: (req.lines || []).map(function (l) {
        const cap = ftrApprovedCap(l);
        const already = Math.max(0, Number(l.dispatched_qty) || 0);
        const remaining = Math.max(0, cap - already);
        return {
          line_id: l.line_id,
          sku_id: l.sku_id,
          sku_code: l.sku_code,
          description: l.product_name || '',
          brand_name: l.brand_name || '',
          requested_qty: l.requested_qty,
          approved_cap: cap,
          already_dispatched: already,
          remaining_cap: remaining,
          requires_unit_barcode: window.transferSkuRequiresUnit(l),
          warehouse_qty: Math.max(0, Number(l.warehouse_qty) || 0),
          units: [],
          qty: 0,
          omitted: remaining < 1
        };
      }),
      extras: []
    };
  }

  function ftrAllCartUnitIds() {
    const ids = [];
    if (!_ftrDispatchCart) return ids;
    _ftrDispatchCart.lines.forEach(function (r) {
      (r.units || []).forEach(function (u) { if (u.unit_id) ids.push(Number(u.unit_id)); });
    });
    _ftrDispatchCart.extras.forEach(function (r) {
      (r.units || []).forEach(function (u) { if (u.unit_id) ids.push(Number(u.unit_id)); });
    });
    return ids;
  }

  function ftrFindRequestLineBySkuId(skuId) {
    if (!_ftrDispatchCart) return null;
    return _ftrDispatchCart.lines.find(function (r) {
      return !r.omitted && Number(r.sku_id) === Number(skuId);
    }) || null;
  }

  function ftrFindExtraBySkuId(skuId) {
    if (!_ftrDispatchCart) return null;
    return _ftrDispatchCart.extras.find(function (r) { return Number(r.sku_id) === Number(skuId); }) || null;
  }

  function ftrCreateExtraRow(sku) {
    return {
      sku_id: sku.sku_id,
      sku_code: sku.sku_code,
      description: sku.product_name || '',
      brand_name: sku.brand_name || '',
      requires_unit_barcode: window.transferSkuRequiresUnit(sku),
      warehouse_qty: Math.max(0, Number(sku.warehouse_qty) || 0),
      units: [],
      qty: 0
    };
  }

  function ftrShowShipmentSyncBanner(requestId) {
    let banner = document.getElementById('ftr-shipment-sync-banner');
    if (!banner) {
      const section = document.getElementById('ftr-shipments-section');
      if (!section) return;
      banner = document.createElement('div');
      banner.id = 'ftr-shipment-sync-banner';
      banner.className = 'hint';
      banner.style.marginBottom = '12px';
      banner.style.background = 'var(--goldL)';
      banner.style.borderColor = 'rgba(217,119,6,0.35)';
      section.parentNode.insertBefore(banner, section);
    }
    banner.style.display = 'block';
    banner.innerHTML =
      '<strong>Shipments on file:</strong> Transfer document(s) exist for this request but shipped or stocked quantities on the request are out of sync. ' +
      '<button type="button" class="btn sm" style="margin-left:8px" onclick="ftrReconcileRequest(' + requestId + ')">Sync from documents</button>';
    const confirmBtn = document.getElementById('ftr-dispatch-confirm-btn');
    if (confirmBtn) confirmBtn.style.display = 'none';
  }

  function ftrHideShipmentSyncBanner() {
    const banner = document.getElementById('ftr-shipment-sync-banner');
    if (banner) banner.style.display = 'none';
    const confirmBtn = document.getElementById('ftr-dispatch-confirm-btn');
    if (confirmBtn) confirmBtn.style.display = '';
  }

  window.ftrReconcileRequest = async function ftrReconcileRequest(requestId) {
    try {
      await apiPost('/api/transfer-requests/' + requestId + '/reconcile', {});
      if (typeof cosmosToastSuccess === 'function') {
        cosmosToastSuccess('Request synced from shipment documents.');
      }
      ftrHideShipmentSyncBanner();
      expandTrRequest(requestId);
      if (typeof window.loadTransferRequests === 'function') window.loadTransferRequests();
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    }
  };

  window.ftrLoadRequestShipments = async function ftrLoadRequestShipments(requestId, opts) {
    const options = opts || {};
    const wrap = document.getElementById('ftr-shipments-wrap');
    if (!wrap) return [];
    try {
      const list = await apiGet('/api/transfer-requests/' + requestId + '/shipments?top_n=50') || [];
      if (!list.length) {
        wrap.innerHTML = '<span style="color:var(--text3)">No transfer documents yet.</span>';
        ftrHideShipmentSyncBanner();
        return [];
      }
      wrap.innerHTML = '<ul style="margin:0;padding-left:18px">' + list.map(function (d) {
        const qtySent = Math.max(0, Number(d.total_qty_sent) || 0);
        const qtyPart = qtySent > 0 ? ' · <strong>' + qtySent + '</strong> pcs sent' : '';
        return '<li class="tr-link" style="margin-bottom:6px;cursor:pointer" onclick="expandMlDoc(' + d.doc_id + ')">Doc <span class="mono">#' + d.doc_id + '</span> · ' +
          fmtDate(d.dispatched_at || d.created_at) + ' · ' + trEsc(d.status || '') +
          ' · ' + (d.line_count || 0) + ' line(s)' + qtyPart + '</li>';
      }).join('') + '</ul>';
      if (options.qtySummary && options.qtySummary.totalDisp === 0) {
        ftrShowShipmentSyncBanner(requestId);
      } else {
        ftrHideShipmentSyncBanner();
      }
      return list;
    } catch (err) {
      wrap.innerHTML = '<span style="color:var(--red)">' + trEsc(err.message) + '</span>';
      return [];
    }
  };

  window.ftrRenderDispatchTable = function ftrRenderDispatchTable() {
    const linesTb = document.getElementById('ftr-dispatch-lines-tbody');
    const extraTb = document.getElementById('ftr-dispatch-extra-tbody');
    if (!linesTb || !_ftrDispatchCart) return;

    linesTb.innerHTML = _ftrDispatchCart.lines.filter(function (r) { return !r.omitted; }).map(function (r) {
      const scanned = (r.units || []).length;
      const rem = r.remaining_cap != null ? r.remaining_cap : r.approved_cap;
      const qtyCell = '<span class="b ' + (scanned > 0 && scanned <= rem ? 'b-green' : 'b-gray') + '">' + scanned + ' / ' + rem + '</span>';
      return '<tr class="ftr-dispatch-req-row" data-line-id="' + r.line_id + '">' +
        '<td class="mono xs">' + trEsc(r.sku_code) + '<span class="b b-blue" style="font-size:10px;margin-left:6px">Unit scan</span></td>' +
        '<td>' + trEsc(r.description) + '</td>' +
        '<td>' + trEsc(r.brand_name) + '</td>' +
        '<td style="text-align:right"><span class="b b-gray">' + r.requested_qty + '</span></td>' +
        '<td style="text-align:right"><span class="b b-blue">' + r.approved_cap + '</span>' +
        (r.already_dispatched > 0 ? ' <span style="font-size:10px;color:var(--text3)">(' + r.already_dispatched + ' sent)</span>' : '') + '</td>' +
        '<td style="text-align:right">' + qtyCell + '</td>' +
        '<td style="min-width:120px">' + window.transferRenderUnitChips(r.units, r.sku_id, 'ftrRemoveUnitFromLine') + '</td>' +
        '<td><button type="button" class="btn sm" onclick="event.stopPropagation();ftrOmitLine(' + r.line_id + ')">Remove</button></td></tr>';
    }).join('');

    if (extraTb) {
      extraTb.innerHTML = _ftrDispatchCart.extras.map(function (r) {
        const scanned = (r.units || []).length;
        const qtyCell = '<span class="b ' + (scanned > 0 ? 'b-green' : 'b-gray') + '">' + scanned + ' scanned</span>';
        return '<tr class="ftr-dispatch-extra-row" data-sku-id="' + r.sku_id + '">' +
          '<td class="mono xs">' + trEsc(r.sku_code) + '</td>' +
          '<td colspan="2">' + trEsc(r.description) + ' <span style="font-size:10px;color:var(--text3)">(added)</span></td>' +
          '<td style="text-align:center;color:var(--text3)">—</td>' +
          '<td style="text-align:center;color:var(--text3)">—</td>' +
          '<td style="text-align:right">' + qtyCell + '</td>' +
          '<td style="min-width:120px">' + window.transferRenderUnitChips(r.units, r.sku_id, 'ftrRemoveUnitFromExtra') + '</td>' +
          '<td><button type="button" class="btn sm" onclick="event.stopPropagation();ftrRemoveExtra(' + r.sku_id + ')">Remove</button></td></tr>';
      }).join('');
    }
  };

  window.ftrOmitLine = function (lineId) {
    const row = _ftrDispatchCart && _ftrDispatchCart.lines.find(function (r) { return r.line_id === lineId; });
    if (!row) return;
    row.omitted = true;
    row.qty = 0;
    row.units = [];
    ftrRenderDispatchTable();
  };

  window.ftrRemoveExtra = function (skuId) {
    if (!_ftrDispatchCart) return;
    _ftrDispatchCart.extras = _ftrDispatchCart.extras.filter(function (r) { return Number(r.sku_id) !== Number(skuId); });
    ftrRenderDispatchTable();
  };

  window.ftrRemoveUnitFromLine = function (skuId, unitId) {
    const row = ftrFindRequestLineBySkuId(skuId);
    if (!row || !row.units) return;
    row.units = row.units.filter(function (u) { return Number(u.unit_id) !== Number(unitId); });
    row.qty = row.units.length;
    ftrRenderDispatchTable();
  };

  window.ftrRemoveUnitFromExtra = function (skuId, unitId) {
    const row = ftrFindExtraBySkuId(skuId);
    if (!row || !row.units) return;
    row.units = row.units.filter(function (u) { return Number(u.unit_id) !== Number(unitId); });
    row.qty = row.units.length;
    if (!row.qty) ftrRemoveExtra(skuId);
    else ftrRenderDispatchTable();
  };

  function ftrAddUnitToRow(row, sku) {
    const unitId = sku.unit_id != null ? Number(sku.unit_id) : null;
    if (!unitId) return false;
    const used = ftrAllCartUnitIds();
    if (used.includes(unitId)) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Unit ' + (sku.unit_barcode || unitId) + ' is already in this dispatch.');
      return false;
    }
    row.units = row.units || [];
    const shipCap = row.remaining_cap != null ? row.remaining_cap : row.approved_cap;
    if (shipCap > 0 && row.units.length >= shipCap) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Cannot exceed remaining quantity for this shipment (' + shipCap + ').');
      return false;
    }
    if (row.warehouse_qty > 0 && row.units.length >= row.warehouse_qty) {
      if (typeof cosmosToastError === 'function') cosmosToastError('No more units at warehouse for this SKU.');
      return false;
    }
    row.units.push({
      unit_id: unitId,
      unit_barcode: sku.unit_barcode || '',
      unit_no: sku.unit_no
    });
    row.qty = row.units.length;
    return true;
  }

  window.ftrDispatchLookupAndAdd = async function (code) {
    if (!_ftrDispatchCart) return;
    const key = window.transferNormalizeScanPayload(code);
    if (!key) return;
    try {
      const sku = await window.transferLookupSku(code);
      if (!sku) return;
      const unitId = sku.unit_id != null ? Number(sku.unit_id) : null;

      if (!unitId) {
        if (typeof cosmosToastError === 'function') {
          cosmosToastError('Scan the 7-digit unit barcode on each piece — manual quantity is not allowed.');
        }
        return;
      }

      let row = ftrFindRequestLineBySkuId(sku.sku_id);
      if (row) {
        if (ftrAddUnitToRow(row, sku)) {
          if (typeof cosmosToastSuccess === 'function') {
            cosmosToastSuccess('Added unit ' + (sku.unit_barcode || unitId) + ' · ' + sku.sku_code);
          }
          ftrRenderDispatchTable();
        }
        return;
      }

      let extra = ftrFindExtraBySkuId(sku.sku_id);
      if (!extra) {
        extra = ftrCreateExtraRow(sku);
        _ftrDispatchCart.extras.push(extra);
      }
      if (ftrAddUnitToRow(extra, sku)) {
        if (typeof cosmosToastSuccess === 'function') {
          cosmosToastSuccess('Added unit ' + (sku.unit_barcode || unitId) + ' · ' + sku.sku_code);
        }
        ftrRenderDispatchTable();
      }
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || ('Not found: ' + key));
    }
  };

  window.ftrDispatchSearchKeydown = function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = (document.getElementById('ftr-dispatch-search') || {}).value || '';
      const trimmed = String(q).trim();
      if (trimmed) ftrDispatchLookupAndAdd(trimmed);
    }
  };

  window._ftrApplyBucketResult = function _ftrApplyBucketResult(result) {
    if (!_ftrDispatchCart || !result || !Array.isArray(result.scanned)) return;
    result.scanned.forEach(function (s) {
      const sku = {
        sku_id: s.sku_id,
        sku_code: s.sku_code,
        product_name: s.product_name || s.description || '',
        brand_name: s.brand_name || '',
        unit_id: s.unit_id,
        unit_barcode: s.unit_barcode,
        warehouse_qty: s.warehouse_qty != null ? Number(s.warehouse_qty) : 0
      };
      let row = ftrFindRequestLineBySkuId(sku.sku_id);
      if (row) {
        ftrAddUnitToRow(row, sku);
      } else {
        let extra = ftrFindExtraBySkuId(sku.sku_id);
        if (!extra) {
          extra = ftrCreateExtraRow(sku);
          if (sku.warehouse_qty > 0) extra.warehouse_qty = sku.warehouse_qty;
          _ftrDispatchCart.extras.push(extra);
        }
        ftrAddUnitToRow(extra, sku);
      }
    });
    ftrRenderDispatchTable();
  };

  window.openGoodsRequestDispatchBucket = function openGoodsRequestDispatchBucket(requestId) {
    if (!_ftrDispatchCart) {
      if (typeof cosmosToastError === 'function') cosmosToastError('Dispatch cart not loaded.');
      return;
    }
    if (typeof window.openBucket !== 'function') {
      if (typeof cosmosToastError === 'function') cosmosToastError('Scan bucket is not loaded.');
      return;
    }
    if (typeof ftrStopCamera === 'function') ftrStopCamera();
    window.openBucket({
      mode: 'TRANSFER',
      sessionId: requestId,
      label: 'Request #' + requestId,
      expected: [],
      onSubmit: function (result) {
        window._ftrApplyBucketResult(result);
      }
    });
  };

  window.ftrToggleCamera = async function ftrToggleCamera() {
    const container = document.getElementById('ftr-scan-container');
    if (!container) return;
    if (_ftrScanRunning) {
      ftrStopCamera();
      return;
    }
    container.style.display = '';
    const overlay = document.getElementById('ftr-scan-overlay');
    if (overlay) overlay.style.display = 'none';
    try {
      await window.loadHtml5QrLibTransfer();
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'QR scanner failed to load');
      return;
    }
    _ftrScanner = new Html5Qrcode('ftr-reader');
    _ftrScanRunning = true;
    const camBtn = document.getElementById('ftr-cam-btn');
    if (camBtn) camBtn.textContent = '⏹ Stop QR scan';
    Html5Qrcode.getCameras()
      .then(function (devices) {
        const cam = devices.find(function (d) { return /back|rear|environment/i.test(d.label); }) || devices[devices.length - 1];
        const camId = cam ? cam.id : { facingMode: 'environment' };
        return _ftrScanner.start(
          camId,
          { fps: 10, qrbox: { width: 220, height: 220 } },
          function (decodedText) { ftrOnScanSuccess(decodedText); },
          function () {}
        );
      })
      .catch(function (err) {
        if (typeof cosmosToastError === 'function') cosmosToastError('Camera error: ' + (err.message || err));
        ftrStopCamera();
      });
  };

  window.ftrStopCamera = function ftrStopCamera() {
    if (_ftrScanner && _ftrScanRunning) {
      _ftrScanner.stop().catch(function () {}).finally(function () {
        _ftrScanner = null;
        _ftrScanRunning = false;
        const btn = document.getElementById('ftr-cam-btn');
        if (btn) btn.textContent = '📷 Scan QR';
        const container = document.getElementById('ftr-scan-container');
        if (container) container.style.display = 'none';
        const overlay = document.getElementById('ftr-scan-overlay');
        if (overlay) overlay.style.display = '';
      });
    } else {
      _ftrScanRunning = false;
      const container = document.getElementById('ftr-scan-container');
      if (container) container.style.display = 'none';
    }
  };

  async function ftrOnScanSuccess(code) {
    const now = Date.now();
    if (code === _ftrLastScan && now - _ftrLastScanTs < 1500) return;
    _ftrLastScan = code;
    _ftrLastScanTs = now;
    await ftrDispatchLookupAndAdd(code.trim());
  }

  function ftrRequestCardActionLabel(status) {
    if (status === 'SUBMITTED') return 'Review';
    if (status === 'APPROVED' || status === 'PARTIALLY_DISPATCHED') return 'Dispatch';
    return 'Open';
  }

  function ftrRequestCardListQty(r) {
    const cap = Math.max(0, Number(r.total_approved_cap) || Number(r.total_requested_qty) || 0);
    const recv = Math.max(0, Number(r.total_received_qty) || 0);
    const disp = Math.max(0, Number(r.total_dispatched_qty) || 0);
    return { cap: cap, recv: recv, disp: disp, remainingToStock: Math.max(0, cap - recv), remainingToShip: Math.max(0, cap - disp) };
  }

  function ftrRequestCardProgressHtml(r) {
    const q = ftrRequestCardListQty(r);
    if (q.cap < 1) return '';
    if (r.status === 'PARTIALLY_RECEIVED' || (q.recv > 0 && q.remainingToStock > 0)) {
      return (
        '<div class="ftr-request-card__progress">' +
        '<strong>' + q.recv + '</strong> of <strong>' + q.cap + '</strong> stocked' +
        ' · <span class="ftr-request-card__progress-rem">' + q.remainingToStock + ' remaining to receive</span>' +
        '</div>'
      );
    }
    if (r.status === 'PARTIALLY_DISPATCHED' && q.remainingToShip > 0) {
      return (
        '<div class="ftr-request-card__progress">' +
        '<strong>' + q.disp + '</strong> of <strong>' + q.cap + '</strong> shipped' +
        ' · <span class="ftr-request-card__progress-rem">' + q.remainingToShip + ' remaining to ship</span>' +
        '</div>'
      );
    }
    return '';
  }

  function ftrSyncTrViewTabActive() {
    const tabs = document.querySelector('#page-transfer-requests .ftr-status-tabs');
    const activeKey = _trView || 'need_attention';
    if (tabs && window.cosmosFilterTabs) {
      window.cosmosFilterTabs.sync(tabs, activeKey, { attr: 'data-ftr-view' });
      return;
    }
    document.querySelectorAll('#page-transfer-requests .ftr-status-tabs [data-ftr-view]').forEach(function (b) {
      const key = b.getAttribute('data-ftr-view') || '';
      const active = key === activeKey;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  async function ftrInitViewTabs() {
    const container = document.getElementById('ftr-status-filters');
    if (!container) return;
    if (_ftrViewsReady) {
      ftrSyncTrViewTabActive();
      return;
    }
    let views = [
      { key: 'need_attention', label: 'Need Attention' },
      { key: 'partial', label: 'Partial' },
      { key: 'fulfilled', label: 'Fulfilled' }
    ];
    try {
      const meta = await apiGet('/api/meta/transfer-request-list-views');
      if (meta && Array.isArray(meta.views) && meta.views.length) views = meta.views;
      if (meta && meta.default_view) _trView = String(meta.default_view);
      if (meta && meta.history_default_days) _ftrHistoryDefaultDays = Number(meta.history_default_days) || 90;
    } catch (e) { /* fallback views */ }
    container.innerHTML = '';
    views.forEach(function (v) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn sm';
      btn.textContent = v.label || v.key;
      btn.setAttribute('data-ftr-view', v.key);
      btn.setAttribute('aria-pressed', 'false');
      btn.onclick = function () { window.setTrView(v.key); };
      container.appendChild(btn);
    });
    _ftrViewsReady = true;
    ftrSyncTrViewTabActive();
  }

  window.setTrView = function setTrView(viewKey) {
    _trView = viewKey ? String(viewKey) : 'need_attention';
    ftrSyncTrViewTabActive();
    if (typeof window.loadTransferRequests === 'function') window.loadTransferRequests();
  };

  function ftrIstDateAddDays(isoDate, deltaDays) {
    const parts = String(isoDate || '').split('-').map(Number);
    if (parts.length < 3 || !parts.every(function (n) { return Number.isFinite(n); })) return isoDate;
    const anchor = new Date(
      parts[0] + '-' + String(parts[1]).padStart(2, '0') + '-' + String(parts[2]).padStart(2, '0') + 'T12:00:00+05:30'
    );
    anchor.setDate(anchor.getDate() + deltaDays);
    return anchor.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }

  function ftrParseIsoYmdToIstDate(isoYmd) {
    const parts = String(isoYmd || '').split('-').map(Number);
    if (parts.length !== 3 || !parts.every(function (n) { return Number.isFinite(n); })) return null;
    return new Date(
      parts[0] + '-' + String(parts[1]).padStart(2, '0') + '-' + String(parts[2]).padStart(2, '0') + 'T12:00:00+05:30'
    );
  }

  function ftrIsoYmdFromDate(d) {
    if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }

  function ftrSyncHistoryDateHidden(inputId, isoYmd) {
    const el = document.getElementById(inputId);
    if (!el) return '';
    let hidden = document.getElementById(inputId + '_iso');
    if (!hidden) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.dataset.fp = '1';
      hidden.id = inputId + '_iso';
      (el.parentElement || el).appendChild(hidden);
    }
    hidden.value = isoYmd || '';
    return hidden.value;
  }

  function ftrEmptyStateHtml() {
    const storeHint = _trStoreFilter && ftrCanFilterByStore() ? ' for the selected store' : '';
    let headline = 'No goods requests' + storeHint;
    let sub = 'Try another tab';
    if (_trView === 'need_attention') {
      headline = 'No requests need attention' + storeHint;
      sub = 'Try another store or open History for older requests.';
    } else if (_trView === 'partial') {
      headline = 'No partially shipped requests' + storeHint;
      sub = 'Nothing is waiting for more dispatch from HQ.';
    } else if (_trView === 'fulfilled') {
      headline = 'No fulfilled transfers' + storeHint;
      sub = 'Shows the last 10 dispatched or stocked requests and HQ-initiated transfers. Older ones are in History.';
    }
    if (ftrCanFilterByStore() && !_trStoreFilter) {
      sub = sub.replace('Try another store or ', 'Try ');
    }
    return (
      '<div class="empty" style="padding:32px 16px">' +
      '<div class="empty-ic">📋</div>' +
      '<div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">' + headline + '</div>' +
      '<div style="font-size:13px;color:var(--text2);margin-bottom:16px">' + sub + '</div>' +
      '<button type="button" class="btn sm" onclick="openFtrHistoryModal()">Open History</button>' +
      '</div>'
    );
  }

  function ftrRenderRequestCard(r, showStoreName) {
    if (ftrIsHqDocRow(r)) {
      const linePart = (r.line_count || 0) + ' line' + ((r.line_count || 0) !== 1 ? 's' : '');
      const storeBlock = showStoreName
        ? '<div class="ftr-request-card__store">' + trEsc(r.store_code || r.store_name || r.store_id) + '</div>'
        : '';
      return (
        '<article class="ftr-request-card tr-link" role="button" tabindex="0" aria-label="Open transfer doc #' + r.doc_id + '"' +
        ' onclick="expandMlDoc(' + r.doc_id + ')"' +
        ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();expandMlDoc(' + r.doc_id + ')}">' +
        '<div class="ftr-request-card__head">' +
        '<span class="ftr-request-card__id">Doc #' + r.doc_id + '</span>' +
        ftrListRowBadgeHtml(r) +
        '</div>' +
        storeBlock +
        '<div class="ftr-request-card__meta">' + trEsc(fmtDate(r.dispatched_at || r.created_at)) + ' · ' + linePart + '</div>' +
        '<div class="ftr-request-card__foot">' +
        '<span>' + trEsc(r.dispatched_by_name || r.dispatched_by_fullname || '') + '</span>' +
        '<span class="ftr-request-card__action">View transfer ›</span>' +
        '</div>' +
        '</article>'
      );
    }
    const skuPart = (r.line_count || 0) + ' SKU' + ((r.line_count || 0) !== 1 ? 's' : '');
    const qtyPart = r.total_requested_qty != null ? ' · ' + r.total_requested_qty + ' pcs requested' : '';
    const progressBlock = ftrRequestCardProgressHtml(r);
    const storeBlock = showStoreName
      ? '<div class="ftr-request-card__store">' + trEsc(r.store_code || r.store_name || r.store_id) + '</div>'
      : '';
    return (
      '<article class="ftr-request-card" role="button" tabindex="0" aria-label="Open request #' + r.request_id + '"' +
      ' onclick="expandTrRequest(' + r.request_id + ')"' +
      ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();expandTrRequest(' + r.request_id + ')}">' +
      '<div class="ftr-request-card__head">' +
      '<span class="ftr-request-card__id">#' + r.request_id + '</span>' +
      '<span class="b ' + (TR_STATUS_BADGE[r.status] || 'b-gray') + '">' + trEsc(ftrStatusLabel(r.status)) + '</span>' +
      '</div>' +
      storeBlock +
      '<div class="ftr-request-card__meta">' + trEsc(fmtDate(r.created_at)) + ' · ' + skuPart + qtyPart + '</div>' +
      progressBlock +
      '<div class="ftr-request-card__foot">' +
      '<span>' + trEsc(r.requested_by_fullname || r.requested_by_name || '') + '</span>' +
      '<span class="ftr-request-card__action">' + trEsc(ftrRequestCardActionLabel(r.status)) + ' ›</span>' +
      '</div>' +
      '</article>'
    );
  }

  function ftrFormatHistoryScoreDays(n) {
    if (n == null || n === '') return '—';
    const num = Number(n);
    if (!Number.isFinite(num) || num < 0) return '—';
    return String(num);
  }

  function ftrHistoryScoreFromRow(r, key) {
    if (!r) return null;
    if (r[key] != null && r[key] !== '') return r[key];
    const camel = key.replace(/_([a-z])/g, function (_m, c) { return c.toUpperCase(); });
    if (r[camel] != null && r[camel] !== '') return r[camel];
    return null;
  }

  function ftrBuildHistoryRequestRows(rows, showStoreOnCard) {
    return rows.map(function (r) {
      const storeSuffix = showStoreOnCard
        ? ' · ' + trEsc(r.store_code || r.store_name || '')
        : '';
      const primary = '#' + r.request_id + storeSuffix;
      const requested = trEsc(fmtDate(r.created_at));
      const shipped = r.dispatched_at ? trEsc(fmtDate(r.dispatched_at)) : '—';
      const hq = ftrFormatHistoryScoreDays(ftrHistoryScoreFromRow(r, 'hq_score_days'));
      const fulfillment = ftrFormatHistoryScoreDays(ftrHistoryScoreFromRow(r, 'fulfillment_score_days'));
      const datesLine = 'Requested ' + requested + ' · Shipped ' + shipped;
      const scoresLine =
        '<span class="ftr-history-row__score" title="Total calendar days from request to shipped (IST)">HQ ' +
        '<span class="ftr-history-row__score-num">' + trEsc(hq) + '</span></span>' +
        ' · ' +
        '<span class="ftr-history-row__score" title="Total calendar days from request to stocked at store (IST)">Fulfillment ' +
        '<span class="ftr-history-row__score-num">' + trEsc(fulfillment) + '</span></span>';
      const onClick = 'expandTrRequest(' + r.request_id + ')';
      return (
        '<div class="cosmos-record-row tr-link ftr-history-row" role="button" tabindex="0"' +
        ' onclick="' + onClick + '"' +
        ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();' + onClick + '}"' +
        ' aria-label="Open request ' + r.request_id + '">' +
        '<div class="cosmos-record-row__main">' +
        '<div class="cosmos-record-row__primary">' + primary + '</div>' +
        '<div class="ftr-history-row__meta">' +
        '<div class="ftr-history-row__dates">' + datesLine + '</div>' +
        '<div class="ftr-history-row__scores">' + scoresLine + '</div>' +
        '</div>' +
        '</div>' +
        '<div class="cosmos-record-row__badge">' +
        '<span class="b ' + (TR_STATUS_BADGE[r.status] || 'b-gray') + '">' + trEsc(ftrStatusLabel(r.status)) + '</span>' +
        '</div>' +
        '</div>'
      );
    }).join('');
  }

  function ftrBuildMobileRequestRows(rows, showStoreOnCard) {
    return rows.map(function (r) {
      if (ftrIsHqDocRow(r)) {
        const linePart = (r.line_count || 0) + ' line' + ((r.line_count || 0) !== 1 ? 's' : '');
        const secondary = trEsc(fmtDate(r.dispatched_at || r.created_at)) + ' · ' + linePart +
          (showStoreOnCard ? ' · ' + trEsc(r.store_code || r.store_name || '') : '');
        if (window.cosmosRecordRow) {
          return window.cosmosRecordRow.html({
            primary: 'Doc #' + r.doc_id,
            secondary: secondary,
            badgeHtml: ftrListRowBadgeHtml(r),
            onClick: 'expandMlDoc(' + r.doc_id + ')',
            ariaLabel: 'Open transfer ' + r.doc_id
          });
        }
        return ftrRenderRequestCard(r, showStoreOnCard);
      }
      const skuPart = (r.line_count || 0) + ' SKU' + ((r.line_count || 0) !== 1 ? 's' : '');
      const qtyPart = r.total_requested_qty != null ? ' · ' + r.total_requested_qty + ' pcs requested' : '';
      const cap = Math.max(0, Number(r.total_approved_cap) || Number(r.total_requested_qty) || 0);
      const recv = Math.max(0, Number(r.total_received_qty) || 0);
      const rem = Math.max(0, cap - recv);
      let progress = '';
      if (r.status === 'PARTIALLY_RECEIVED' || (recv > 0 && rem > 0)) {
        progress = '<strong>' + recv + '</strong> of <strong>' + cap + '</strong> stocked · <span class="cosmos-record-row__progress-rem">' + rem + ' remaining to receive</span>';
      }
      const secondary = trEsc(fmtDate(r.created_at)) + ' · ' + skuPart + qtyPart +
        (showStoreOnCard ? ' · ' + trEsc(r.store_code || r.store_name || '') : '');
      if (window.cosmosRecordRow) {
        return window.cosmosRecordRow.html({
          primary: '#' + r.request_id,
          secondary: secondary,
          progressHtml: progress,
          badgeHtml: '<span class="b ' + (TR_STATUS_BADGE[r.status] || 'b-gray') + '">' + trEsc(ftrStatusLabel(r.status)) + '</span>',
          onClick: 'expandTrRequest(' + r.request_id + ')',
          ariaLabel: 'Open request ' + r.request_id
        });
      }
      return ftrRenderRequestCard(r, showStoreOnCard);
    }).join('');
  }

  function ftrRenderRequestCards(rows, opts) {
    const o = opts || {};
    const showStoreOnCard = o.showStoreOnCard != null
      ? o.showStoreOnCard
      : (ftrCanFilterByStore() && !_trStoreFilter);
    /* History modal is narrow on all viewports — one list style only (avoids duplicate desktop+mobile rows). */
    if (o.context === 'history') {
      const historyHtml = ftrBuildHistoryRequestRows(rows, showStoreOnCard);
      return '<div class="ftr-history-list cosmos-record-list">' + historyHtml + '</div>';
    }
    const mobileHtml = ftrBuildMobileRequestRows(rows, showStoreOnCard);
    const desktopCards = rows.map(function (r) {
      return ftrRenderRequestCard(r, showStoreOnCard);
    }).join('');
    return (
      '<div class="ftr-request-cards ftr-request-cards--desktop">' + desktopCards + '</div>' +
      '<div id="ftr-request-list-mobile" class="ftr-request-list-mobile cosmos-record-list">' + mobileHtml + '</div>'
    );
  }

  window.loadTransferRequests = async function () {
    ftrSyncTrViewTabActive();
    const wrap  = document.getElementById('ftr-cards-wrap');
    const errEl = document.getElementById('ftr-err');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (wrap) {
      wrap.innerHTML = '<div id="ftr-cards-skeleton" style="padding:8px 0"></div>';
      if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('ftr-cards-skeleton', 6);
    }

    try {
      const topN = (_trView === 'fulfilled') ? 10 : 100;
      const qs = new URLSearchParams({ top_n: String(topN), view: _trView || 'need_attention' });
      if (_trStoreFilter && ftrCanFilterByStore()) qs.set('store_id', _trStoreFilter);
      const rows = await apiGet('/api/transfer-requests?' + qs.toString());

      const pending = rows.filter((r) => r.status === 'SUBMITTED').length;
      const badge   = document.getElementById('tr-nav-badge');
      if (badge) {
        badge.textContent = pending || '';
        badge.style.display = pending ? '' : 'none';
      }

      if (!wrap) return;
      if (!rows.length) {
        wrap.innerHTML = ftrEmptyStateHtml();
        return;
      }

      wrap.innerHTML = ftrRenderRequestCards(rows);
    } catch (err) {
      if (errEl) { errEl.textContent = 'Failed to load: ' + err.message; errEl.style.display = 'block'; }
      if (wrap) wrap.innerHTML = '';
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    }
  };

  function ftrHistoryEmptyHtml() {
    return (
      '<div class="empty" style="padding:24px 12px">' +
      '<div class="empty-ic">📋</div>' +
      '<div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">No completed requests found</div>' +
      '<div style="font-size:13px;color:var(--text2)">History shows stocked-at-store and rejected requests only. Try a wider date range or different filters.</div>' +
      '</div>'
    );
  }

  function ftrHistoryIsoFromInput(inputId) {
    const hidden = document.getElementById(inputId + '_iso');
    if (hidden && /^\d{4}-\d{2}-\d{2}$/.test(String(hidden.value || '').trim())) {
      return String(hidden.value).trim();
    }
    const el = document.getElementById(inputId);
    if (el && el.type === 'date') {
      const v = String(el.value || '').trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
    }
    if (el && el._flatpickr && el._flatpickr.selectedDates && el._flatpickr.selectedDates[0]) {
      return ftrIsoYmdFromDate(el._flatpickr.selectedDates[0]);
    }
    if (!el || !el.value) return '';
    const parts = String(el.value).trim().split('/');
    if (parts.length !== 3) return '';
    return parts[2] + '-' + String(parts[1]).padStart(2, '0') + '-' + String(parts[0]).padStart(2, '0');
  }

  /** Use OS date sheet on phones/tablets; Flatpickr on desktop/wide + mouse. */
  function ftrHistoryPreferNativeDatePicker() {
    if (typeof window.matchMedia !== 'function') return false;
    try {
      if (window.matchMedia('(max-width: 768px)').matches) return true;
      if (
        window.matchMedia('(pointer: coarse)').matches
        && window.matchMedia('(max-width: 1024px)').matches
      ) return true;
    } catch (_e) {
      /* ignore */
    }
    return false;
  }

  let _ftrHistoryDateUIMode = '';

  function _ftrOnNativeHistoryDateInput(ev) {
    const el = ev.target;
    if (!el || !el.id) return;
    const v = String(el.value || '').trim();
    ftrSyncHistoryDateHidden(el.id, /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  }

  function ftrUnbindHistoryDateInputGuards(el) {
    if (!el || el.dataset.ftrDateGuard !== '1') return;
    el.removeEventListener('mousedown', ftrStopHistoryDateEvent, true);
    el.removeEventListener('click', ftrStopHistoryDateEvent, true);
    el.removeEventListener('touchstart', ftrStopHistoryDateEvent, true);
    delete el.dataset.ftrDateGuard;
  }

  function ftrDetachNativeHistoryDateListeners() {
    ['ftr-history-date-from', 'ftr-history-date-to'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el || !el._ftrNativeHistoryDateListener) return;
      const handler = el._ftrNativeHistoryDateListener;
      el.removeEventListener('change', handler);
      el.removeEventListener('input', handler);
      el._ftrNativeHistoryDateListener = null;
    });
  }

  function ftrDestroyHistoryDateUI() {
    ftrDetachNativeHistoryDateListeners();
    ['ftr-history-date-from', 'ftr-history-date-to'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      ftrUnbindHistoryDateInputGuards(el);
      if (el._flatpickr) {
        try { el._flatpickr.destroy(); } catch (_e) { /* ignore */ }
      }
      delete el.dataset.ftrHistoryFp;
      el.classList.remove('ftr-history-date-native', 'flatpickr-input');
      el.type = 'text';
      el.setAttribute('readonly', 'readonly');
      el.placeholder = 'dd/MM/yyyy';
      el.removeAttribute('inputmode');
      el.style.fontSize = '';
    });
  }

  function ftrSetupNativeHistoryDateInputs() {
    ftrDetachNativeHistoryDateListeners();
    ['ftr-history-date-from', 'ftr-history-date-to'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      ftrUnbindHistoryDateInputGuards(el);
      if (el._flatpickr) {
        try { el._flatpickr.destroy(); } catch (_e) { /* ignore */ }
      }
      delete el.dataset.ftrHistoryFp;
      el.classList.remove('flatpickr-input');
      el.classList.add('ftr-history-datepicker', 'ftr-history-date-native');

      el.type = 'date';
      el.removeAttribute('readonly');
      el.readOnly = false;
      el.placeholder = '';
      el.setAttribute('autocomplete', 'off');
      el.setAttribute('inputmode', 'none');
      /* 16px+ avoids unwanted zoom on focus (iOS) */
      el.style.fontSize = '16px';

      el._ftrNativeHistoryDateListener = _ftrOnNativeHistoryDateInput;
      el.addEventListener('change', el._ftrNativeHistoryDateListener);
      el.addEventListener('input', el._ftrNativeHistoryDateListener);
    });
  }

  function ftrCloseAllHistoryDatePickers() {
    ['ftr-history-date-from', 'ftr-history-date-to'].forEach(function (id) {
      const other = document.getElementById(id);
      if (other && other._flatpickr) other._flatpickr.close();
    });
  }

  function ftrCloseOtherHistoryDatePicker(activeEl) {
    ['ftr-history-date-from', 'ftr-history-date-to'].forEach(function (id) {
      if (activeEl && activeEl.id === id) return;
      const other = document.getElementById(id);
      if (other && other._flatpickr) other._flatpickr.close();
    });
  }

  function ftrHistoryDatePickerAppendTo() {
    return document.querySelector('#overlay-ftr-history .sp-ftr-history-body')
      || document.getElementById('overlay-ftr-history')
      || document.body;
  }

  function ftrStopHistoryDateEvent(e) {
    e.stopPropagation();
  }

  function ftrBindHistoryDateInputGuards(el) {
    if (!el || el.dataset.ftrDateGuard === '1') return;
    el.dataset.ftrDateGuard = '1';
    ['mousedown', 'click', 'touchstart'].forEach(function (ev) {
      const opts = ev === 'touchstart' ? { capture: true, passive: true } : true;
      el.addEventListener(ev, ftrStopHistoryDateEvent, opts);
    });
  }

  function ftrGuardHistoryCalendarEl(cal) {
    if (!cal || cal.dataset.ftrCalGuard === '1') return;
    cal.dataset.ftrCalGuard = '1';
    ['mousedown', 'click', 'touchstart'].forEach(function (ev) {
      const opts = ev === 'touchstart' ? { capture: true, passive: true } : true;
      cal.addEventListener(ev, ftrStopHistoryDateEvent, opts);
    });
  }

  function ftrAlignHistoryFlatpickr(fp) {
    const cal = fp && fp.calendarContainer;
    const modal = document.querySelector('#overlay-ftr-history .modal.modal--ftr-history');
    if (!cal || !modal) return;
    const pad = 14;
    const mr = modal.getBoundingClientRect();
    const maxW = Math.max(240, Math.min(280, mr.width - pad * 2));
    cal.style.width = maxW + 'px';
    cal.style.maxWidth = maxW + 'px';
    cal.querySelectorAll('.dayContainer').forEach(function (dc) {
      dc.style.width = maxW + 'px';
      dc.style.minWidth = '0';
      dc.style.maxWidth = maxW + 'px';
    });
  }

  function ftrHistoryForceStaticMonthHeader(fp) {
    const wrap = fp && fp.calendarContainer
      ? fp.calendarContainer.querySelector('.flatpickr-current-month')
      : null;
    if (!wrap) return;
    const sel = wrap.querySelector('select.flatpickr-monthDropdown-months');
    if (!sel) return;
    const monthIdx = sel.selectedIndex >= 0 ? sel.selectedIndex : (fp.currentMonth || 0);
    const longhand = (fp.l10n && fp.l10n.months && fp.l10n.months.longhand) || [];
    const label = longhand[monthIdx] || (sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text) || '';
    const span = document.createElement('span');
    span.className = 'cur-month';
    span.textContent = label;
    sel.replaceWith(span);
  }

  function ftrEnsureHistoryDatePicker(el) {
    if (!el || typeof flatpickr === 'undefined') return;
    if (el.type === 'date' || el.classList.contains('ftr-history-date-native')) return;
    if (el._flatpickr && el.dataset.ftrHistoryFp === '1') {
      ftrBindHistoryDateInputGuards(el);
      return;
    }
    if (el._flatpickr) {
      try { el._flatpickr.destroy(); } catch (e) { /* ignore */ }
    }
    el.parentElement.querySelectorAll('input[type=hidden][data-fp]').forEach(function (h) {
      if (h.id === el.id + '_iso') h.remove();
    });
    ftrBindHistoryDateInputGuards(el);
    flatpickr(el, {
      dateFormat: 'd/m/Y',
      allowInput: false,
      disableMobile: true,
      closeOnSelect: true,
      clickOpens: true,
      shorthandCurrentMonth: false,
      monthSelectorType: 'static',
      position: 'below',
      locale: { firstDayOfWeek: 1 },
      appendTo: ftrHistoryDatePickerAppendTo(),
      onReady: function (selectedDates, _dateStr, fp) {
        el.dataset.ftrHistoryFp = '1';
        if (fp.calendarContainer) {
          fp.calendarContainer.classList.add('ftr-history-flatpickr');
          ftrGuardHistoryCalendarEl(fp.calendarContainer);
        }
        ftrHistoryForceStaticMonthHeader(fp);
        if (selectedDates[0]) {
          ftrSyncHistoryDateHidden(el.id, ftrIsoYmdFromDate(selectedDates[0]));
        }
      },
      onOpen: function (_selectedDates, _dateStr, fp) {
        ftrCloseOtherHistoryDatePicker(el);
        ftrHistoryForceStaticMonthHeader(fp);
        if (fp.calendarContainer) ftrGuardHistoryCalendarEl(fp.calendarContainer);
        ftrAlignHistoryFlatpickr(fp);
      },
      onMonthChange: function (_selectedDates, _dateStr, fp) {
        ftrHistoryForceStaticMonthHeader(fp);
        ftrAlignHistoryFlatpickr(fp);
      },
      onYearChange: function (_selectedDates, _dateStr, fp) {
        ftrAlignHistoryFlatpickr(fp);
      },
      onChange: function (selectedDates) {
        ftrSyncHistoryDateHidden(el.id, selectedDates[0] ? ftrIsoYmdFromDate(selectedDates[0]) : '');
      }
    });
  }

  function ftrBindHistoryOverlayInteractionGuards() {
    const overlay = document.getElementById('overlay-ftr-history');
    if (!overlay || overlay.dataset.ftrInteractionGuard === '1') return;
    overlay.dataset.ftrInteractionGuard = '1';
    overlay.addEventListener('mousedown', function (e) {
      if (
        e.target.closest('.ftr-history-flatpickr')
        || e.target.closest('.ftr-history-datepicker')
        || e.target.closest('input[type="date"].ftr-history-date-native')
        || e.target.closest('.flatpickr-calendar')
      ) {
        e.stopPropagation();
      }
    }, true);
    overlay.addEventListener('click', function (e) {
      if (e.target !== overlay) return;
      closeFtrHistoryModal();
    });
  }

  function ftrEnsureHistoryDatePickers() {
    ftrBindHistoryOverlayInteractionGuards();
    const prefersNative = ftrHistoryPreferNativeDatePicker();
    const skipFlatpickr = prefersNative || typeof flatpickr === 'undefined';
    const mode = skipFlatpickr ? 'native' : 'flatpickr';
    if (_ftrHistoryDateUIMode !== mode) {
      ftrDestroyHistoryDateUI();
      _ftrHistoryDateUIMode = mode;
    }

    if (skipFlatpickr) {
      ftrSetupNativeHistoryDateInputs();
      return;
    }

    ['ftr-history-date-from', 'ftr-history-date-to'].forEach(function (id) {
      ftrEnsureHistoryDatePicker(document.getElementById(id));
    });
  }

  function ftrSetHistoryDatePickerValue(inputId, isoYmd) {
    const el = document.getElementById(inputId);
    if (!el || !isoYmd) return;
    if (el.type === 'date') {
      el.value = isoYmd;
      ftrSyncHistoryDateHidden(inputId, isoYmd);
      return;
    }
    const istDate = ftrParseIsoYmdToIstDate(isoYmd);
    if (el._flatpickr && istDate) {
      el._flatpickr.setDate(istDate, true);
      ftrSyncHistoryDateHidden(inputId, isoYmd);
      return;
    }
    ftrSyncHistoryDateHidden(inputId, isoYmd);
    if (istDate) {
      const [y, m, d] = isoYmd.split('-');
      el.value = String(d).padStart(2, '0') + '/' + String(m).padStart(2, '0') + '/' + y;
    }
  }

  function ftrSyncHistoryStoreChipActive() {
    const chips = document.getElementById('ftr-history-store-chips');
    if (!chips) return;
    chips.querySelectorAll('[data-ftr-history-store-chip]').forEach(function (b) {
      const id = b.getAttribute('data-store-id') || '';
      const active = id === (_ftrHistoryStoreFilter || '');
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  async function ftrEnsureHistoryStores() {
    if (_ftrHistoryStoresCache) return _ftrHistoryStoresCache;
    const raw = await apiGetFirst([
      '/api/stock-transfers/destination-stores',
      '/api/foundry/destination-stores'
    ]);
    const rows = Array.isArray(raw) ? raw : [];
    const seen = new Set();
    const list = [];
    rows.forEach(function (s) {
      if (!s || typeof s !== 'object') return;
      const sid = Number(s.store_id);
      if (!Number.isFinite(sid) || sid < 1 || seen.has(sid)) return;
      const status = String(s.status || '').trim().toUpperCase();
      if (status && status !== 'ACTIVE') return;
      seen.add(sid);
      list.push(s);
    });
    list.sort(function (a, b) {
      return String(a.store_code || a.store_name || '').localeCompare(
        String(b.store_code || b.store_name || ''),
        undefined,
        { sensitivity: 'base' }
      );
    });
    _ftrHistoryStoresCache = list;
    return list;
  }

  async function ftrInitHistoryStoreChips() {
    const row = document.getElementById('ftr-history-store-row');
    const chips = document.getElementById('ftr-history-store-chips');
    if (!row || !chips) return;
    if (!ftrCanFilterByStore()) {
      row.hidden = true;
      _ftrHistoryStoreFilter = '';
      return;
    }
    row.hidden = false;
    chips.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'btn sm';
    allBtn.textContent = 'All stores';
    allBtn.setAttribute('data-ftr-history-store-chip', '1');
    allBtn.setAttribute('data-store-id', '');
    allBtn.onclick = function () {
      _ftrHistoryStoreFilter = '';
      ftrSyncHistoryStoreChipActive();
    };
    chips.appendChild(allBtn);
    try {
      const list = await ftrEnsureHistoryStores();
      list.forEach(function (s) {
        const sid = String(s.store_id);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn sm';
        btn.textContent = ftrStoreChipLabel(s) || ('Store #' + s.store_id);
        const titleParts = [s.store_name, s.store_code].map(function (v) { return String(v || '').trim(); }).filter(Boolean);
        if (titleParts.length) btn.title = titleParts.join(' · ');
        btn.setAttribute('data-ftr-history-store-chip', '1');
        btn.setAttribute('data-store-id', sid);
        btn.onclick = function () {
          _ftrHistoryStoreFilter = sid;
          ftrSyncHistoryStoreChipActive();
        };
        chips.appendChild(btn);
      });
      ftrSyncHistoryStoreChipActive();
    } catch (e) {
      if (typeof cosmosToastError === 'function') cosmosToastError(e.message || 'Could not load stores');
    }
  }

  function ftrSetHistoryDefaultDates() {
    const today = typeof istToday === 'function' ? istToday() : '';
    if (!today) return;
    const fromIso = ftrIstDateAddDays(today, -(_ftrHistoryDefaultDays - 1));
    ftrSetHistoryDatePickerValue('ftr-history-date-to', today);
    ftrSetHistoryDatePickerValue('ftr-history-date-from', fromIso);
  }

  window.openFtrHistoryModal = async function openFtrHistoryModal() {
    const overlay = document.getElementById('overlay-ftr-history');
    if (!overlay) return;
    const errEl = document.getElementById('ftr-history-err');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    const results = document.getElementById('ftr-history-results');
    if (results) results.innerHTML = '';
    ['ftr-history-request-id', 'ftr-history-sku', 'ftr-history-unit'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    ftrEnsureHistoryDatePickers();
    ftrSetHistoryDefaultDates();
    _ftrHistoryStoreFilter = _trStoreFilter || '';
    await ftrInitHistoryStoreChips();
    if (typeof openM === 'function') openM('overlay-ftr-history');
    else overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  window.closeFtrHistoryModal = function closeFtrHistoryModal() {
    ftrCloseAllHistoryDatePickers();
    const overlay = document.getElementById('overlay-ftr-history');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  window.searchFtrHistory = async function searchFtrHistory() {
    const btn = document.getElementById('ftr-history-search-btn');
    const errEl = document.getElementById('ftr-history-err');
    const results = document.getElementById('ftr-history-results');
    const fromEl = document.getElementById('ftr-history-date-from');
    const toEl = document.getElementById('ftr-history-date-to');
    const reqEl = document.getElementById('ftr-history-request-id');
    const skuEl = document.getElementById('ftr-history-sku');
    const unitEl = document.getElementById('ftr-history-unit');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    [fromEl, toEl, reqEl, skuEl, unitEl].forEach(function (el) {
      if (el && typeof cosmosFieldClear === 'function') cosmosFieldClear(el);
    });

    const requestIdRaw = reqEl ? String(reqEl.value || '').trim() : '';
    const skuQ = skuEl ? String(skuEl.value || '').trim() : '';
    const unitQ = unitEl ? String(unitEl.value || '').trim() : '';
    let dateFrom = ftrHistoryIsoFromInput('ftr-history-date-from');
    let dateTo = ftrHistoryIsoFromInput('ftr-history-date-to');
    const hasRequestId = requestIdRaw && /^\d+$/.test(requestIdRaw);

    if (requestIdRaw && !hasRequestId) {
      if (reqEl && typeof cosmosFieldError === 'function') cosmosFieldError(reqEl, 'Enter a valid request ID');
      return;
    }
    const hasOptionalLookup = hasRequestId || !!skuQ || !!unitQ;
    let searchDateFrom = dateFrom;
    let searchDateTo = dateTo;
    if (!hasOptionalLookup && (!searchDateFrom || !searchDateTo)) {
      searchDateTo = typeof istToday === 'function' ? istToday() : searchDateTo;
      searchDateFrom = searchDateTo ? ftrIstDateAddDays(searchDateTo, -(_ftrHistoryDefaultDays - 1)) : searchDateFrom;
      ftrSetHistoryDatePickerValue('ftr-history-date-to', searchDateTo);
      ftrSetHistoryDatePickerValue('ftr-history-date-from', searchDateFrom);
    }
    if (!hasOptionalLookup && (!searchDateFrom || !searchDateTo)) {
      if (!searchDateFrom && fromEl && typeof cosmosFieldError === 'function') {
        cosmosFieldError(fromEl, 'Select From date');
      }
      if (!searchDateTo && toEl && typeof cosmosFieldError === 'function') {
        cosmosFieldError(toEl, 'Select To date');
      }
      return;
    }
    if (searchDateFrom && searchDateTo && searchDateFrom > searchDateTo) {
      if (fromEl && typeof cosmosFieldError === 'function') cosmosFieldError(fromEl, 'From date must be before To');
      if (toEl && typeof cosmosFieldError === 'function') cosmosFieldError(toEl, ' ');
      return;
    }

    const qs = new URLSearchParams({ top_n: '200' });
    if (hasRequestId) qs.set('request_id', requestIdRaw);
    if (searchDateFrom) qs.set('date_from', searchDateFrom);
    if (searchDateTo) qs.set('date_to', searchDateTo);
    if (skuQ) qs.set('sku_q', skuQ);
    if (unitQ) qs.set('unit_barcode', unitQ);
    if (_ftrHistoryStoreFilter && ftrCanFilterByStore()) qs.set('store_id', _ftrHistoryStoreFilter);

    if (results) {
      results.innerHTML = '<div id="ftr-history-skeleton" style="padding:8px 0"></div>';
      if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('ftr-history-skeleton', 5);
    }
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);

    try {
      const rows = await apiGet('/api/transfer-requests/history?' + qs.toString());
      if (!results) return;
      if (!rows.length) {
        results.innerHTML = ftrHistoryEmptyHtml();
        if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
        return;
      }
      results.innerHTML = ftrRenderRequestCards(rows, {
        context: 'history',
        showStoreOnCard: ftrCanFilterByStore() && !_ftrHistoryStoreFilter
      });
      if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn);
    } catch (err) {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
      if (errEl) {
        errEl.textContent = err.message || 'Search failed';
        errEl.style.display = 'block';
      }
      if (results) results.innerHTML = '';
    }
  };

  function ftrRenderDetailToolbar(req, canApprove, canDispatch, canSuperRejectApproved) {
    const actionsEl = document.getElementById('ftr-detail-actions');
    const metaEl = document.getElementById('ftr-detail-meta');
    if (!actionsEl) return;
    if (metaEl) {
      metaEl.innerHTML = '<span class="b ' + (TR_STATUS_BADGE[req.status] || 'b-gray') + '">' + trEsc(ftrStatusLabel(req.status)) + '</span>' +
        '<span>' + trEsc(req.store_name || req.store_id) + '</span>' +
        '<span>' + fmtDate(req.created_at) + '</span>';
    }
    let html = '';
    if (canApprove) {
      html += '<button type="button" class="btn sm primary" id="ftr-approve-btn" onclick="trApproveFromDetail(' + req.request_id + ')">Approve</button>';
      html += '<button type="button" class="btn sm" style="color:var(--red);border-color:var(--red)" id="ftr-reject-btn" onclick="trReject(' + req.request_id + ', this)">Reject</button>';
    } else if (canSuperRejectApproved) {
      html += '<button type="button" class="btn sm" style="color:var(--red);border-color:var(--red)" id="ftr-reject-btn" onclick="trReject(' + req.request_id + ', this)">Reject after approval…</button>';
    }
    if (canDispatch) {
      html += '<button type="button" class="btn sm primary" onclick="event.stopPropagation();openGoodsRequestDispatchBucket(' + req.request_id + ')">Open bucket</button>';
      html += '<button type="button" class="btn sm primary" id="ftr-dispatch-confirm-btn" onclick="trDispatchConfirm(' + req.request_id + ')">Confirm shipment</button>';
    }
    actionsEl.innerHTML = html;
  }

  window.expandTrRequest = async function (requestId) {
    const card  = document.getElementById('ftr-detail-card');
    const body  = document.getElementById('ftr-detail-body');
    const title = document.getElementById('ftr-detail-title');
    const msgEl = document.getElementById('ftr-detail-msg');
    if (!card) return;

    const overlayEl = document.getElementById('fy-sidebar-overlay');
    const sidebarEl = document.querySelector('.sidebar');
    const isSidebarOpen = !!(sidebarEl && sidebarEl.classList.contains('open'));
    const isOverlayOpen = !!(overlayEl && overlayEl.classList.contains('open'));
    const isBodyLocked = document.body.style.overflow === 'hidden';
    if (isSidebarOpen || isOverlayOpen || isBodyLocked) closeSidebar();

    if (typeof window.cosmosOpenExtendedDetail === 'function') {
      window.cosmosOpenExtendedDetail('ftr-detail-card', 'ftr-detail-backdrop');
    }
    if (msgEl) { msgEl.textContent = ''; msgEl.style.color = ''; }
    const actionsEl = document.getElementById('ftr-detail-actions');
    if (actionsEl) actionsEl.innerHTML = '';

    if (title) title.textContent = 'Request #' + requestId;
    if (body) {
      body.innerHTML = '<div id="ftr-detail-skeleton" style="padding:16px"></div>';
      if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('ftr-detail-skeleton', 5);
      else body.innerHTML = '<div style="padding:16px;color:var(--text3)">Loading…</div>';
    }

    try {
      let req  = await apiGet(`/api/transfer-requests/${requestId}`);
      const qtyPre = ftrRequestQtySummary(req);
      const needsDocSync = (req.lines || []).some(function (l) {
        return Number(l.dispatched_qty) > 0 && (l.received_qty == null || l.received_qty === undefined);
      });
      const needsStatusReconcile =
        (req.status === 'RECEIVED' || req.status === 'PARTIALLY_RECEIVED') &&
        qtyPre.totalRecv === 0 &&
        qtyPre.totalDisp === 0;
      if (
        needsStatusReconcile
        || req.status === 'PARTIALLY_DISPATCHED'
        || req.status === 'DISPATCHED'
        || (needsDocSync && (req.status === 'DISPATCHED' || req.status === 'PARTIALLY_DISPATCHED' || req.status === 'RECEIVED'))
      ) {
        try {
          const synced = await apiPost('/api/transfer-requests/' + requestId + '/reconcile', {});
          if (synced) {
            if (Array.isArray(synced.lines)) req.lines = synced.lines;
            if (synced.status) req.status = synced.status;
          }
        } catch (_syncErr) { /* keep unsynced view if SP not deployed yet */ }
      }
      _trExpanded = req;
      if (title) {
        title.textContent = 'Request #' + requestId + (req.store_name ? ' — ' + req.store_name : '');
      }

      const canApprove  = req.status === 'SUBMITTED';
      const canDispatch = req.status === 'APPROVED' || req.status === 'PARTIALLY_DISPATCHED';
      const qtySummary = ftrRequestQtySummary(req);
      const canSuperRejectApproved = !!(
        user && String(user.role || '') === 'super_admin'
        && req.status === 'APPROVED'
        && qtySummary.totalDisp === 0
      );
      ftrRenderDetailToolbar(req, canApprove, canDispatch, canSuperRejectApproved);
      const qtySummaryBlock = ftrQtySummaryHtml(qtySummary);

      const inpStyle = 'width:64px;padding:4px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:12px;text-align:center;outline:none';

      const linesHtmlReadonly = (req.lines || []).map((l) => `
        <tr>
          <td class="mono xs">${trEsc(l.sku_code)}</td>
          <td>${trEsc(l.product_name || l.description || '')}</td>
          <td>${trEsc(l.brand_name  || '')}</td>
          <td style="text-align:right"><span class="b b-gray">${l.requested_qty}</span></td>
          <td style="text-align:right">${l.approved_qty   != null ? `<span class="b b-blue">${l.approved_qty}</span>`    : '<span style="color:var(--text3)">—</span>'}</td>
          <td style="text-align:right">${l.dispatched_qty != null ? `<span class="b b-orange">${l.dispatched_qty}</span>` : '<span style="color:var(--text3)">—</span>'}</td>
          <td style="text-align:right">${l.received_qty   != null ? `<span class="b b-green">${l.received_qty}</span>`   : '<span style="color:var(--text3)">—</span>'}</td>
        </tr>`).join('');

      const linesHtmlApprove = (req.lines || []).map((l) => `
        <tr>
          <td class="mono xs">${trEsc(l.sku_code)}</td>
          <td>${trEsc(l.product_name || l.description || '')}</td>
          <td>${trEsc(l.brand_name  || '')}</td>
          <td style="text-align:right"><span class="b b-gray">${l.requested_qty}</span></td>
          <td style="text-align:right">${l.approved_qty   != null ? `<span class="b b-blue">${l.approved_qty}</span>`    : '<span style="color:var(--text3)">—</span>'}</td>
          <td style="text-align:right">${l.dispatched_qty != null ? `<span class="b b-orange">${l.dispatched_qty}</span>` : '<span style="color:var(--text3)">—</span>'}</td>
          <td style="text-align:right">${l.received_qty   != null ? `<span class="b b-green">${l.received_qty}</span>`   : '<span style="color:var(--text3)">—</span>'}</td>
          <td>
            <input type="number" class="ftr-approve-qty" data-line-id="${l.line_id}"
              value="${l.requested_qty}" min="0" max="${l.requested_qty}"
              style="${inpStyle}"
              onclick="event.stopPropagation()">
          </td>
        </tr>`).join('');

      if (canDispatch) ftrInitDispatchCart(req);

      let tableBlock;
      if (canApprove) {
        tableBlock = `
          <div class="tw mb4">
            <table>
              <thead>
                <tr>
                  <th>SKU</th><th>Description</th><th>Brand</th>
                  <th style="text-align:right">Requested</th>
                  <th style="text-align:right">Approved</th>
                  <th style="text-align:right">Dispatched</th>
                  <th style="text-align:right">Stocked at Store</th>
                  <th style="min-width:80px">Set approved qty</th>
                </tr>
              </thead>
              <tbody>${linesHtmlApprove}</tbody>
            </table>
          </div>`;
      } else if (canDispatch) {
        const partialBanner = qtySummary.remainingToShip > 0 && qtySummary.totalDisp > 0
          ? `<div class="hint" style="margin-bottom:12px;background:var(--tealL);border-color:var(--teal)">
              <strong>Partial dispatch:</strong> ${qtySummary.totalDisp} of ${qtySummary.totalCap} pcs counted on approved request lines.
              Scan up to <strong>${qtySummary.remainingToShip}</strong> more (matching SKU on each line).
              Challan totals may differ if a shipment used a different SKU — see insight below.
            </div>`
          : '';
        tableBlock = `
          ${partialBanner}
          <div id="ftr-shipment-qty-insight"></div>
          <div class="hint" style="margin-bottom:14px">
            <strong>Goods Transfer shipment:</strong> Scan each <strong>7-digit unit barcode</strong> (camera or wedge). This shipment only — count follows scans (no manual qty).
          </div>
          <p style="margin:0 0 14px;font-size:12px;color:var(--text3)">Scan units with <strong>Open bucket</strong> in the toolbar (${primaryWarehouseLabelHtml()}), then <strong>Confirm shipment</strong>.</p>
          <div class="tw mb3">
            <table>
              <thead>
                <tr>
                  <th>SKU</th><th>Description</th><th>Brand</th>
                  <th style="text-align:right">Requested</th>
                  <th style="text-align:right">Approved</th>
                  <th style="text-align:right">This shipment</th>
                  <th>Unit codes</th><th></th>
                </tr>
              </thead>
              <tbody id="ftr-dispatch-lines-tbody"></tbody>
              <tbody id="ftr-dispatch-extra-tbody"></tbody>
            </table>
          </div>
          <div id="ftr-shipments-section" style="margin-bottom:14px">
            <div style="font-weight:600;font-size:13px;margin-bottom:8px">Previous shipments</div>
            <div id="ftr-shipments-wrap" style="font-size:13px;color:var(--text2)">Loading shipments…</div>
          </div>`;
      } else {
        tableBlock = `
          <div id="ftr-shipment-qty-insight"></div>
          <div class="tw mb4">
            <table>
              <thead>
                <tr>
                  <th>SKU</th><th>Description</th><th>Brand</th>
                  <th style="text-align:right">Requested</th>
                  <th style="text-align:right">Approved</th>
                  <th style="text-align:right">Dispatched</th>
                  <th style="text-align:right">Stocked at Store</th>
                </tr>
              </thead>
              <tbody>${linesHtmlReadonly}</tbody>
            </table>
          </div>`;
      }

      body.innerHTML = `
        <div style="padding:16px 20px">
          <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
            <span class="b ${TR_STATUS_BADGE[req.status] || 'b-gray'}">${trEsc(ftrStatusLabel(req.status))}</span>
            <span class="xs" style="color:var(--text2)">Store: <strong>${trEsc(req.store_name || req.store_id)}</strong></span>
            <span class="xs" style="color:var(--text2)">By: <strong>${trEsc(req.requested_by_fullname || req.requested_by_name)}</strong></span>
            <span class="xs" style="color:var(--text2)">Submitted: ${fmtDate(req.created_at)}</span>
            ${req.notes ? `<span class="xs" style="color:var(--text2)">Notes: <em>${trEsc(req.notes)}</em></span>` : ''}
            ${req.review_notes ? `<span class="xs" style="color:var(--text2)">Review note: <em>${trEsc(req.review_notes)}</em></span>` : ''}
          </div>

          ${qtySummaryBlock}

          ${tableBlock}

          ${(canApprove || canSuperRejectApproved) ? `
            <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-top:14px">
              ${canApprove ? `
              <div style="flex:1;min-width:200px">
                <label style="font-size:11.5px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block;text-transform:uppercase;letter-spacing:.5px">Review note (optional)</label>
                <input type="text" id="ftr-review-note" placeholder="Note to store manager…"
                  style="width:100%;padding:7px 11px;border:1.5px solid var(--border);border-radius:7px;font-size:13px;outline:none"
                  onclick="event.stopPropagation()">
              </div>` : ''}
              <div style="flex:1;min-width:200px">
                <label style="font-size:11.5px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block;text-transform:uppercase;letter-spacing:.5px">${canSuperRejectApproved && !canApprove ? 'Admin reject reason' : 'Reject reason'}</label>
                <input type="text" id="ftr-reject-note" placeholder="${canSuperRejectApproved && !canApprove ? 'Reason (required)' : 'Required to reject…'}"
                  style="width:100%;padding:7px 11px;border:1.5px solid var(--border);border-radius:7px;font-size:13px;outline:none"
                  onclick="event.stopPropagation()">
              </div>
            </div>
          ` : ''}
          ${canDispatch ? `
            <div style="margin-top:14px">
              <label style="font-size:11.5px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block;text-transform:uppercase;letter-spacing:.5px">Note on transfer document (optional)</label>
              <input type="text" id="ftr-dispatch-note" placeholder="Shown on Goods Transfer…"
                style="width:100%;max-width:400px;padding:7px 11px;border:1.5px solid var(--border);border-radius:7px;font-size:13px;outline:none"
                onclick="event.stopPropagation()">
            </div>
          ` : ''}
          ${(function () {
            const rem = ftrComputeRemainderLines(req.lines);
            if (!rem.length) return '';
            const remPcs = rem.reduce(function (s, x) { return s + x.qty; }, 0);
            return '<div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
              '<button type="button" class="btn sm primary" onclick="ftrCreateRemainderRequest(' + req.request_id + ', this)">Create remainder request (' + remPcs + ' pc' + (remPcs !== 1 ? 's' : '') + ')</button>' +
              '<span style="font-size:12px;color:var(--text2)">Or ship balance via Goods Transfer (direct doc).</span></div>';
          })()}
        </div>`;
      if (canDispatch) {
        ftrRenderDispatchTable();
        ftrLoadRequestShipments(req.request_id, { qtySummary: qtySummary });
        void ftrRefreshShipmentQtyInsight(req.request_id, req);
      } else if (req.status === 'DISPATCHED' || req.status === 'PARTIALLY_DISPATCHED' || req.status === 'PARTIALLY_RECEIVED') {
        const shipBlock = document.createElement('div');
        shipBlock.style.padding = '0 20px 16px';
        shipBlock.innerHTML = '<div style="font-weight:600;font-size:13px;margin-bottom:8px">Shipments</div><div id="ftr-shipments-wrap">Loading…</div>';
        body.appendChild(shipBlock);
        ftrLoadRequestShipments(req.request_id);
        void ftrRefreshShipmentQtyInsight(req.request_id, req);
      }
    } catch (err) {
      if (body) body.innerHTML = `<div style="padding:16px;color:var(--red)">Error: ${trEsc(err.message)}</div>`;
    }
  };

  window.ftrCreateRemainderRequest = async function (requestId, btn) {
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      const result = await apiPost('/api/transfer-requests/' + requestId + '/remainder', {});
      const newId = result.data && result.data.request_id;
      if (typeof cosmosToastSuccess === 'function') {
        cosmosToastSuccess(newId ? 'Remainder request #' + newId + ' created.' : 'Remainder request created.');
      }
      if (typeof window.loadTransferRequests === 'function') window.loadTransferRequests();
      if (newId) expandTrRequest(newId);
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    } finally {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
    }
  };

  window.closeTrDetail = function () {
    if (typeof ftrStopCamera === 'function') ftrStopCamera();
    if (typeof window.cosmosCloseExtendedDetail === 'function') {
      window.cosmosCloseExtendedDetail('ftr-detail-card', 'ftr-detail-backdrop');
    }
    _trExpanded = null;
    _ftrDispatchCart = null;

    const overlayEl = document.getElementById('fy-sidebar-overlay');
    const sidebarEl = document.querySelector('.sidebar');
    const isSidebarOpen = !!(sidebarEl && sidebarEl.classList.contains('open'));
    const isOverlayOpen = !!(overlayEl && overlayEl.classList.contains('open'));
    const isBodyLocked = document.body.style.overflow === 'hidden';
    if (isSidebarOpen || isOverlayOpen || isBodyLocked) closeSidebar();
  };

  window.trQuickApprove = async function (requestId, btn) {
    if (btn && !btn.dataset.confirmed) {
      btn.dataset.confirmed = '1';
      btn.textContent = 'Confirm approve?';
      if (typeof cosmosToastInfo === 'function') cosmosToastInfo('Click again to approve with requested quantities.');
      setTimeout(function () {
        if (btn) {
          delete btn.dataset.confirmed;
          btn.textContent = '✓ Approve';
        }
      }, 4000);
      return;
    }
    if (btn) {
      delete btn.dataset.confirmed;
      btn.textContent = '✓ Approve';
      if (typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    }
    try {
      await apiPut(`/api/transfer-requests/${requestId}/status`, { status: 'APPROVED' });
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Request #' + requestId + ' approved.');
      if (typeof window.loadTransferRequests === 'function') window.loadTransferRequests();
      closeTrDetail();
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    } finally {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
    }
  };

  // Approve from the detail panel (with per-line qty editing)
  window.trApproveFromDetail = async function (requestId) {
    const lines = [];
    document.querySelectorAll('.ftr-approve-qty').forEach((inp) => {
      lines.push({ line_id: Number(inp.dataset.lineId), approved_qty: Math.max(0, Number(inp.value) || 0) });
    });
    const note  = (document.getElementById('ftr-review-note') || {}).value || null;
    const msgEl = document.getElementById('ftr-detail-msg');
    const btn = document.getElementById('ftr-approve-btn');
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      await apiPut(`/api/transfer-requests/${requestId}/status`, { status: 'APPROVED', lines, notes: note || null });
      if (msgEl) { msgEl.style.color = 'var(--green)'; msgEl.textContent = 'Approved.'; }
      if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn);
      setTimeout(function () {
        if (typeof window.loadTransferRequests === 'function') window.loadTransferRequests();
        closeTrDetail();
      }, 900);
    } catch (err) {
      if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Error: ' + err.message; }
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
    }
  };

  window.trReject = async function (requestId, btn) {
    if (_trRejectPendingId !== requestId) {
      _trRejectPendingId = requestId;
      expandTrRequest(requestId);
      if (typeof cosmosToastInfo === 'function') {
        cosmosToastInfo('Enter a reject reason below, then click Reject again.');
      }
      const noteInp = document.getElementById('ftr-reject-note');
      if (noteInp) noteInp.focus();
      return;
    }
    const note = ((document.getElementById('ftr-reject-note') || {}).value || '').trim();
    if (!note) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Enter a reason for the store manager.');
      return;
    }
    _trRejectPendingId = null;
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      await apiPut(`/api/transfer-requests/${requestId}/status`, { status: 'REJECTED', notes: note });
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Request #' + requestId + ' rejected.');
      if (typeof window.loadTransferRequests === 'function') window.loadTransferRequests();
      closeTrDetail();
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    } finally {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
    }
  };

  window.ftrDispatchSearch = async function () {
    const inp   = document.getElementById('ftr-dispatch-search');
    const resEl = document.getElementById('ftr-dispatch-search-results');
    const q     = (inp && inp.value || '').trim();
    _ftrDispatchSearchResults = [];
    if (!resEl) return;
    if (!q) { resEl.style.display = 'none'; resEl.innerHTML = ''; return; }
    try {
      const rows = await apiGet(`/api/stock-transfers/available?q=${encodeURIComponent(q)}`);
      _ftrDispatchSearchResults = rows || [];
      if (!rows || !rows.length) {
        resEl.style.display = '';
        resEl.innerHTML = `<div style="padding:12px 14px;color:var(--text3);font-size:13px">No SKUs found for "${trEsc(q)}"</div>`;
        return;
      }
      resEl.style.display = '';
      resEl.innerHTML = rows.slice(0, 12).map((r, i) => `
        <div onclick="ftrPickDispatchSku(${i})"
             style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px"
             onmouseenter="this.style.background='var(--hover)'" onmouseleave="this.style.background=''">
          <div style="flex:1;min-width:0">
            <div class="mono" style="font-size:12px;font-weight:700;color:var(--acc2)">${trEsc(r.sku_code)}</div>
            <div style="font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${trEsc(r.product_name || '')}</div>
            <div style="font-size:11px;color:var(--text3)">${trEsc(r.brand_name || '')} · ${trEsc(r.colour_name || '')}</div>
          </div>
          <span style="font-size:13px;font-weight:700;color:#16a34a;white-space:nowrap">${Number(r.warehouse_qty) || 0} WH</span>
          <button type="button" class="btn xs primary" style="white-space:nowrap">+ Add</button>
        </div>`).join('');
    } catch (err) {
      resEl.style.display = '';
      resEl.innerHTML = `<div style="padding:12px 14px;color:var(--red);font-size:13px">${trEsc(err.message)}</div>`;
    }
  };

  window.ftrPickDispatchSku = function (index) {
    if (typeof cosmosToastInfo === 'function') {
      cosmosToastInfo('Use Scan QR or type a 7-digit unit code — catalogue pick does not add qty.');
    }
  };

  window.ftrAfterDispatchNav = function () {
    const navEl = getFoundryNavEl('transfer-requests');
    if (typeof nav === 'function') nav('transfer-requests', navEl || null);
    if (typeof window.loadTransferRequests === 'function') window.loadTransferRequests();
    closeTrDetail();
  };

  window.trDispatchConfirm = async function (requestId) {
    const msgEl = document.getElementById('ftr-detail-msg');
    const btn   = document.getElementById('ftr-dispatch-confirm-btn');
    if (msgEl) { msgEl.textContent = ''; msgEl.style.color = ''; }
    if (!_ftrDispatchCart) {
      if (typeof cosmosToastError === 'function') cosmosToastError('Dispatch cart not loaded. Close and reopen the request.');
      return;
    }

    const lines = [];
    let dispatchValid = true;
    _ftrDispatchCart.lines.forEach(function (r) {
      if (r.omitted || r.qty < 1) return;
      const unitIds = (r.units || []).map(function (u) { return u.unit_id; });
      if (!unitIds.length || unitIds.length !== r.qty) {
        dispatchValid = false;
        if (typeof cosmosToastError === 'function') {
          const need = r.remaining_cap != null ? r.remaining_cap : r.approved_cap;
          cosmosToastError('Request line ' + r.sku_code + ': scan unit barcode(s) for this shipment — need ' + need + ', have ' + unitIds.length + '.');
        }
        return;
      }
      lines.push({
        line_id: r.line_id,
        dispatched_qty: r.qty,
        unit_ids: unitIds
      });
    });

    const extra_lines = [];
    _ftrDispatchCart.extras.forEach(function (r) {
      if (r.qty < 1) return;
      const unitIds = (r.units || []).map(function (u) { return u.unit_id; });
      if (!unitIds.length || unitIds.length !== r.qty) {
        dispatchValid = false;
        if (typeof cosmosToastError === 'function') {
          cosmosToastError('Extra SKU ' + r.sku_code + ': each piece needs a scanned unit barcode.');
        }
        return;
      }
      extra_lines.push({ sku_id: r.sku_id, qty: r.qty, unit_ids: unitIds });
    });
    if (!dispatchValid) return;

    const hasReqLine = lines.some(function (l) { return l.dispatched_qty > 0; });
    if (!hasReqLine && !extra_lines.length) {
      const m = 'Scan at least one unit barcode on a request line or extra SKU.';
      if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = m; }
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn(m);
      return;
    }

    const used = ftrAllCartUnitIds();
    const dup = used.find(function (id, i) { return used.indexOf(id) !== i; });
    if (dup) {
      if (typeof cosmosToastError === 'function') cosmosToastError('Duplicate unit in dispatch cart.');
      return;
    }

    const notes = ((document.getElementById('ftr-dispatch-note') || {}).value || '').trim() || null;
    const payload = { status: 'DISPATCHED', lines, notes };
    if (extra_lines.length) payload.extra_lines = extra_lines;

    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      const data  = await apiPut(`/api/transfer-requests/${requestId}/status`, payload);
      const docId = data.doc_id;
      const newStatus = data.status || 'DISPATCHED';
      const fullyDone = data.fully_dispatched === true;
      _ftrDispatchCart = null;
      if (typeof window.loadTransferRequests === 'function') window.loadTransferRequests();
      if (typeof cosmosToastSuccess === 'function') {
        cosmosToastSuccess(fullyDone
          ? 'Shipment #' + docId + ' — request fully dispatched.'
          : 'Shipment #' + docId + ' created. Dispatch remainder when ready.');
      }
      expandTrRequest(requestId);
    } catch (err) {
      if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = err.message; }
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    } finally {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
    }
  };

  /** @deprecated Use expandTrRequest — opens dispatch preview */
  window.trDispatch = function (requestId) {
    expandTrRequest(requestId);
  };

  // Auto-load pending count for nav badge on startup
  (async () => {
    try {
      const rows   = await apiGet('/api/transfer-requests?status=SUBMITTED&top_n=50');
      const badge  = document.getElementById('tr-nav-badge');
      if (badge && rows.length) { badge.textContent = rows.length; badge.style.display = ''; }
    } catch (_) {}
  })();

  // ─────────────────────────────────────────────────────────────────────────
  // MOVEMENT LIST  (Store Connect › Movement List)
  // ─────────────────────────────────────────────────────────────────────────
  function mlStatusBadge(status) {
    const s = String(status || '').toUpperCase();
    const cls = FTR_DOC_STATUS_BADGE[s] || 'b-gray';
    return '<span class="b ' + cls + '">' + trEsc(ftrDocStatusLabel(s)) + '</span> ';
  }

  window.closeMlDetail = function () {
    if (window.cosmosDetailPanel && typeof window.cosmosDetailPanel.close === 'function') {
      window.cosmosDetailPanel.close('ml-detail', 'ml-detail-backdrop');
    } else if (typeof window.cosmosCloseExtendedDetail === 'function') {
      window.cosmosCloseExtendedDetail('ml-detail', 'ml-detail-backdrop');
    }
  };

  window.expandMlDoc = async function (docId) {
    const titleEl = document.getElementById('ml-detail-title');
    const bodyEl  = document.getElementById('ml-detail-body');
    const metaEl  = document.getElementById('ml-detail-meta');
    const actionsEl = document.getElementById('ml-detail-actions');
    if (!bodyEl) return;

    if (window.cosmosDetailPanel) window.cosmosDetailPanel.prepareOpen('ml-detail', 'ml-detail-backdrop');
    if (titleEl) titleEl.textContent = 'Transfer Document #' + docId;
    if (metaEl) metaEl.innerHTML = '';
    if (actionsEl) actionsEl.innerHTML = '';
    if (window.cosmosDetailPanel) window.cosmosDetailPanel.skeletonBody(bodyEl, 4);

    try {
      const res = await apiGet('/api/stock-transfer-docs/' + docId);
      const doc = res.data || res;
      if (titleEl) titleEl.textContent = 'Transfer #' + doc.doc_id + (doc.store_name ? ' — ' + doc.store_name : '');
      const fmtDt = dt => dt ? fmtDateTime(dt) : '—';
      if (metaEl) metaEl.innerHTML = mlStatusBadge(doc.status) + '<span>' + trEsc(fmtDt(doc.dispatched_at)) + '</span>';
      if (actionsEl && doc.source_request_id) {
        actionsEl.innerHTML = '<button type="button" class="btn sm primary" onclick="closeMlDetail();expandTrRequest(' + doc.source_request_id + ')">View request #' + doc.source_request_id + '</button>';
      }
      const lines = (doc.lines || []).map(function (l) {
        const sent = Number(l.qty_sent) || 0;
        const recv = l.qty_received != null ? Number(l.qty_received) : null;
        const rem = recv != null ? Math.max(0, sent - recv) : null;
        const recvCell = recv != null
          ? '<span class="b ' + (rem > 0 ? 'b-gold' : 'b-green') + '">' + recv + (rem > 0 ? ' (' + rem + ' left)' : '') + '</span>'
          : '—';
        return '<tr><td class="mono">' + trEsc(l.sku_code || l.sku_id) + '</td><td>' + trEsc([l.product_name, l.colour_name].filter(Boolean).join(' · ')) + '</td><td style="text-align:right">' + sent + '</td><td style="text-align:right">' + recvCell + '</td></tr>';
      }).join('');
      const chips = window.cosmosDetailChips ? window.cosmosDetailChips.html([
        { label: 'Type', value: doc.doc_type === 'DIRECT' ? 'Goods Transfer' : 'From Request' },
        { label: 'Request #', value: doc.source_request_id ? String(doc.source_request_id) : '—' },
        { label: 'To store', value: doc.store_name || ('Store #' + doc.to_store_id) },
        { label: 'Dispatched', value: fmtDt(doc.dispatched_at) }
      ]) : '';
      const tableBlock = window.cosmosDetailLinesTable
        ? window.cosmosDetailLinesTable.wrap('<thead><tr><th>SKU</th><th>Description</th><th style="text-align:right">Sent</th><th style="text-align:right">Stocked</th></tr></thead><tbody>' + lines + '</tbody>')
        : '<table><tbody>' + lines + '</tbody></table>';
      bodyEl.innerHTML = '<div style="padding:16px 20px">' + chips +
        (doc.notes ? '<div style="margin-bottom:14px;font-size:13px;color:var(--text2)">' + trEsc(doc.notes) + '</div>' : '') +
        '<div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text2)">Line items</div>' + tableBlock + '</div>';
    } catch (e) {
      bodyEl.innerHTML = '<div style="padding:16px;color:var(--red)">' + trEsc(e.message) + '</div>';
    }
  };

  function bindDelegatedTableActions() {
    const handler = (event) => {
      const actionEl = event.target.closest('[data-action]');
      if (!actionEl) return;
      const action = actionEl.dataset.action;
      const id = Number(actionEl.dataset.id);
      if (!action) return;

      if (action === 'open-bill-verify' && id) {
        openBillVerifyPage(id);
        return;
      }
      if (action === 'revert-to-purchase' && id) {
        window.runRevertPurchaseToDraft(id, actionEl);
        return;
      }
      if (action === 'resume-draft' && id) {
        resumeDraftPurchaseForEdit(id);
        return;
      }
      if (action === 'submit-draft' && id) {
        if (typeof window.openSubmitChallanModal === 'function') {
          window.openSubmitChallanModal(id, actionEl);
        }
        return;
      }
      if (action === 'open-branding' && id) {
        openBrandingPage(id);
        return;
      }
      if (action === 'open-digitisation' && id) {
        openDigitisationPage(id);
        return;
      }
      if (action === 'open-purchase-view' && id) {
        openPurchaseView(id);
        return;
      }
      if (action === 'toggle-branding-history' && id) {
        toggleBrandingHistoryDetail(id);
      }
    };

    ['purchases-tbody', 'bv-list-tbody', 'branding-list-tbody', 'digi-list-tbody'].forEach((id) => {
      const tableBody = document.getElementById(id);
      if (!tableBody || tableBody.dataset.delegateBound === '1') return;
      tableBody.dataset.delegateBound = '1';
      tableBody.addEventListener('click', handler);
    });
  }

  // ── LAB ORDERS ────────────────────────────────────────────────────────────
  let _labOrdersTimer = null;
  let _fyLabStatusFilter = 'SENT_TO_LAB';
  let _fyLabStoreFilter = '';
  let _fyLabStoreFilterReady = false;

  function fySyncLabStoreChipActive() {
    const chips = document.getElementById('fy-lab-store-chips');
    if (!chips) return;
    chips.querySelectorAll('[data-fy-lab-store-chip]').forEach(function (b) {
      const id = b.getAttribute('data-store-id') || '';
      const active = id === (_fyLabStoreFilter || '');
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  async function fyInitLabStoreFilter() {
    const row = document.getElementById('fy-lab-store-filter-row');
    const chips = document.getElementById('fy-lab-store-chips');
    if (!row || !chips) return;
    if (!ftrCanFilterByStore()) {
      row.hidden = true;
      row.style.display = '';
      _fyLabStoreFilter = '';
      return;
    }
    row.hidden = false;
    row.style.display = '';
    if (_fyLabStoreFilterReady) {
      fySyncLabStoreChipActive();
      return;
    }
    chips.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'btn sm';
    allBtn.textContent = 'All stores';
    allBtn.setAttribute('data-fy-lab-store-chip', '1');
    allBtn.setAttribute('data-store-id', '');
    allBtn.setAttribute('aria-pressed', _fyLabStoreFilter ? 'false' : 'true');
    if (!_fyLabStoreFilter) allBtn.classList.add('active');
    allBtn.onclick = function () { window.setFyLabStoreFilter(''); };
    chips.appendChild(allBtn);
    try {
      const list = await ftrFetchDestinationStoresList();
      list.forEach(function (s) {
        const sid = String(s.store_id);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn sm';
        btn.textContent = ftrStoreChipLabel(s) || ('Store #' + s.store_id);
        const titleParts = [s.store_name, s.store_code].map(function (v) { return String(v || '').trim(); }).filter(Boolean);
        if (titleParts.length) btn.title = titleParts.join(' · ');
        btn.setAttribute('aria-label', 'Filter by store ' + (ftrStoreChipLabel(s) || sid));
        btn.setAttribute('data-fy-lab-store-chip', '1');
        btn.setAttribute('data-store-id', sid);
        btn.onclick = function () { window.setFyLabStoreFilter(sid); };
        chips.appendChild(btn);
      });
      _fyLabStoreFilterReady = true;
      fySyncLabStoreChipActive();
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Could not load stores.');
    }
  }

  window.setFyLabStoreFilter = function setFyLabStoreFilter(storeId) {
    _fyLabStoreFilter = storeId ? String(storeId) : '';
    fySyncLabStoreChipActive();
    if (typeof window.loadLabOrders === 'function') window.loadLabOrders();
  };

  const FY_LAB_STATUS_LABELS = {
    ORDER_PLACED:                 'Order Placed',
    ADVANCE_PAID:                 'Accepted',
    SENT_TO_LAB:                  'Sent To Lab',
    FRAME_PENDING_LENS_BACKORDER: 'Frame Pending + Lens Backorder',
    FRAME_RECEIVED_LENS_BACKORDER:'Frame Received + Lens Backordered',
    FRAME_AND_LENS_RECEIVED:      'Frame + Lens Received',
    LAB_FITTING:                  'Fitting & Edging',
    QC_FAIL_LAB:                  'QC Fail',
    QC_PASS:                      'QC Pass',
    DISPATCHED_TO_STORE:          'Dispatched To Store',
    RECEIVED_AT_STORE:            'Received At Store',
    STORE_QC_PASS:                'Store QC Pass',
    STORE_QC_PARTIAL:             'QC Partial (Minor Defect)',
    QC_FAIL_STORE:                'Store QC Failed',
    READY_FOR_DELIVERY:           'Ready For Delivery',
    DELIVERED:                    'Delivered',
    BALANCE_COLLECTED:            'Balance Collected',
    INVOICED:                     'Invoiced'
  };

  /** Matches Lab Orders tabs (friendly label; DB value may differ, e.g. Sent To Lab). */
  const FY_LAB_QUEUE_TAB_LABEL = {
    SENT_TO_LAB: 'Need Attention',
    LAB_FITTING: 'Lab',
    QC_PASS: 'QC',
    DISPATCHED_7D: 'Last 7 Days',
    QC_BY_STORE: 'QC at Store (Fail/Partial)'
  };

  /** Default tab — HQ dispatch recorded in the last 7 days (IST). */
  const FY_LAB_DISPATCH_7D_LOG_STATUS = 'DISPATCHED_TO_STORE';
  const FY_LAB_DISPATCH_7D_DAYS = 7;

  /** Store-end QC issues — shown on the QC By Store tab, grouped by store. */
  const FY_LAB_QC_BY_STORE_STATUSES = ['QC_FAIL_STORE', 'STORE_QC_PARTIAL'];

  // Store-side early chain (POS): ORDER_PLACED → Accepted (DB key ADVANCE_PAID) → SENT_TO_LAB.
  const FY_LAB_NEXT_STATUSES = {
    FRAME_PENDING_LENS_BACKORDER: ['FRAME_RECEIVED_LENS_BACKORDER'],
    FRAME_RECEIVED_LENS_BACKORDER:['FRAME_AND_LENS_RECEIVED'],
    FRAME_AND_LENS_RECEIVED:      ['LAB_FITTING'],
    // QC Fail is selectable but auto-reverts server-side — order never leaves At Lab
    LAB_FITTING:                  ['QC_PASS', 'QC_FAIL_LAB'],
    QC_PASS:                      ['DISPATCHED_TO_STORE'],
    QC_FAIL_STORE:                ['SENT_TO_LAB'],
    STORE_QC_PARTIAL:             ['READY_FOR_DELIVERY']
  };

  function fyCanBypassSiblingGuard() {
    if (user && String(user.role || '') === 'super_admin') return true;
    const pl = userPermissions.map((x) => String(x).toLowerCase());
    return (
      pl.indexOf('foundry.lab.bypass_order_sibling') >= 0
      || pl.indexOf('command_unit.lab.bypass_order_sibling') >= 0
      || pl.indexOf('storepilot.lab.bypass_order_sibling') >= 0
      || pl.indexOf('pos.lab.bypass_order_sibling') >= 0
    );
  }

  function fyJobsFromOrderRow(order) {
    var ls = Array.isArray(order.lab_sub_orders) ? order.lab_sub_orders : [];
    if (ls.length) return ls.map(function(s) {
      return {
        sub_order_id: s.sub_order_id,
        lab_workflow_status: s.lab_workflow_status,
        lab_received_confirmed: s.lab_received_confirmed === true,
        lab_backorder_confirmed: s.lab_backorder_confirmed === true,
        sub_order_label: s.sub_order_label || order.order_no || ''
      };
    });
    var sid = Number(order.sub_order_id) || 0;
    if (!sid) return [];
    return [{
      sub_order_id: sid,
      lab_workflow_status: order.lab_workflow_status,
      lab_received_confirmed: order.lab_received_confirmed === true,
      lab_backorder_confirmed: order.lab_backorder_confirmed === true,
      sub_order_label: order.order_no || ('#' + sid)
    }];
  }

  function fyEscapeAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/'/g, '&#39;');
  }

  function fyEscapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function fyLabelLabStatus(raw) {
    const k = String(raw || '').toUpperCase().trim()
    return FY_LAB_STATUS_LABELS[k] || (k ? k.replace(/_/g, ' ') : '')
  }

  function fyLabFilterTitle(statusKey) {
    const k = String(statusKey || '').toUpperCase()
    if (!k) return 'Need Attention'
    return FY_LAB_QUEUE_TAB_LABEL[k] || fyLabelLabStatus(k)
  }

  function fyLabIsDispatched7dTab() {
    return String(_fyLabStatusFilter || '').toUpperCase() === 'DISPATCHED_7D'
  }

  function fyLabIsQcByStoreTab() {
    return String(_fyLabStatusFilter || '').toUpperCase() === 'QC_BY_STORE'
  }

  function fyLabQcByStoreStatusSet() {
    return new Set(FY_LAB_QC_BY_STORE_STATUSES.map(function (s) { return String(s).toUpperCase() }))
  }

  function fyJobsForLabView(order) {
    var jobs = fyJobsFromOrderRow(order)
    if (!fyLabIsQcByStoreTab()) return jobs
    var allowed = fyLabQcByStoreStatusSet()
    return jobs.filter(function (j) {
      return allowed.has(String(j.lab_workflow_status || '').toUpperCase())
    })
  }

  function fyGroupLabOrdersByStore(rows) {
    var groups = new Map()
    rows.forEach(function (r) {
      var sid = r.store_id != null ? String(r.store_id) : '0'
      var label = String(r.store_name || 'Unknown store').trim() || 'Unknown store'
      if (!groups.has(sid)) groups.set(sid, { store_id: sid, store_name: label, rows: [] })
      groups.get(sid).rows.push(r)
    })
    return Array.from(groups.values()).sort(function (a, b) {
      return a.store_name.localeCompare(b.store_name, undefined, { sensitivity: 'base' })
    })
  }

  function fyLabStatusBadgeHtml(statusFinal, qcByStoreTab) {
    var isFail = String(statusFinal || '').toLowerCase().indexOf('fail') >= 0
    var cls = qcByStoreTab && isFail ? 'b b-red' : (qcByStoreTab ? 'b b-gold' : 'b b-blue')
    return '<span class="' + cls + '" style="font-size:11px">' + fyEscapeHtml(statusFinal) + '</span>'
  }

  function fyRenderLabOrderTableRow(r, qcByStoreTab) {
    var jobs = fyJobsForLabView(r)
    var statusShown = jobs.map(function (j) {
      return fyLabelLabStatus(j.lab_workflow_status)
    }).filter(Boolean).join(' · ')
    var statusFinal = statusShown || fyLabelLabStatus(r.lab_workflow_status)
    var rowForAction = qcByStoreTab && jobs.length
      ? Object.assign({}, r, { lab_sub_orders: jobs })
      : r
    return (
      '<tr>' +
      '<td class="mono xs">' +
      '<div>' + fyEscapeHtml(r.order_no || '') + '</div>' +
      '<button type="button" onclick="window.cosmosTimelineOpen(' + r.order_id + ',\'' + fyEscapeAttr(r.order_no || '') + '\')" style="background:none;border:none;color:var(--acc2);font-size:11px;cursor:pointer;padding:0;margin-top:2px;text-decoration:underline">📋 Timeline</button>' +
      '</td>' +
      '<td>' + fyEscapeHtml(r.customer_name || 'Walk-in') +
      (r.customer_phone ? '<div style="font-size:11px;color:var(--text3)">' + fyEscapeHtml(r.customer_phone) + '</div>' : '') +
      (r.membership_plan_name ? '<div style="margin-top:3px"><span style="font-size:10px;font-weight:700;background:var(--accL);color:var(--acc2);padding:1px 6px;border-radius:20px;letter-spacing:0.01em">' + fyEscapeHtml(r.membership_plan_name) + '</span></div>' : '') +
      '</td>' +
      '<td>' + fyEscapeHtml(r.store_name || '') + '</td>' +
      '<td>' + fyLabStatusBadgeHtml(statusFinal, qcByStoreTab) + '</td>' +
      '<td style="font-size:12px;color:var(--text3)">' + (typeof fmtDateTime === 'function' ? fmtDateTime(r.created_at) : fyEscapeHtml(r.created_at || '')) + '</td>' +
      '<td>' + buildFyLabStatusAction(rowForAction) + '</td>' +
      '</tr>'
    )
  }

  function fyLabEmptyHintForFilter(statusKey) {
    const k = String(statusKey || '').toUpperCase()
    const hints = {
      DISPATCHED_7D:
        'Lab bills HQ dispatched to store in the last 7 days (IST). Includes jobs that may have moved on to At Store or delivery.',
      SENT_TO_LAB:
        'Jobs that need attention at lab intake (system status Sent To Lab). Rows appear after the store marks the bill Sent To Lab in Store OS.',
      LAB_FITTING: 'Jobs land here once both lab intake checkpoints are done and edging has started.',
      QC_PASS:
        'Nothing is currently at QC. Open Lab if work is still in fitting and edging, or Last 7 Days to see recent HQ dispatches.',
      QC_BY_STORE:
        'Store QC Failed and QC Partial jobs appear here after receipt at store. Orders are grouped by store.'
    }
    return hints[k] || 'Widen this filter by choosing another tab or clear the search.'
  }

  /** Clear search + All tab — used from Lab Orders empty-state actions */
  window.fyLabClearSearchAndShowAll = function () {
    const s = document.getElementById('lab-orders-search')
    const t = document.getElementById('fy-lab-tab-pending')
    if (s) s.value = ''
    window.setFyLabStoreFilter('')
    setFyLabFilter('SENT_TO_LAB', t)
  }

  function buildFyLabActionForSingleJob(order, job) {
    var oid = order.order_id;
    var subId = Number(job.sub_order_id) || 0;
    var curr = String(job.lab_workflow_status || '');
    var plainLabel = String(job.sub_order_label || '').slice(0, 80);
    var idSuf = oid + '_' + subId;

    if (curr === 'SENT_TO_LAB') {
      if (!subId) return '';
      var rc = job.lab_received_confirmed === true;
      var bc = job.lab_backorder_confirmed === true;
      var row = '<div class="fy-lab-intake-row">' +
        '<div class="fy-lab-intake-btns">';
      if (rc) {
        row += '<span class="fy-lab-done-badge">Received at Lab — done</span>';
      } else {
        row += '<button type="button" class="btn sm" id="btn-fy-intake-rcv-' + idSuf +
          '" onclick="markFyLabIntake(' + oid + ',' + subId + ',\'received_at_lab\')">Mark Received at Lab</button>';
      }
      if (bc) {
        row += '<span class="fy-lab-done-badge">Backorder Created — done</span>';
      } else {
        row += '<button type="button" class="btn sm" id="btn-fy-intake-bo-' + idSuf +
          '" onclick="markFyLabIntake(' + oid + ',' + subId + ',\'backorder_created\')">Mark Backorder Created</button>';
      }
      row += '</div>';
      if (rc && bc) {
        row += '<button type="button" class="btn primary" id="btn-fy-fitting-edging-' +
          idSuf + '" onclick="advanceFyLabFittingEdging(' + oid + ', ' + subId + ')">Fitting/Edging</button>';
      } else {
        row += '<span class="fy-lab-action-hint">Complete both checkpoints to advance.</span>';
      }
      row += '</div>';
      return row;
    }

    var options = FY_LAB_NEXT_STATUSES[curr] || [];
    if (!options.length) return '<span class="fy-lab-action-hint">No action</span>';
    var opts = options.map(function(s) {
      return '<option value="' + fyEscapeAttr(s) + '">' + fyLabelLabStatus(s) + '</option>';
    }).join('');
    var qcHint = '';
    if (curr === 'LAB_FITTING') {
      qcHint =
        '<div class="fy-lab-action-hint"><strong>QC Pass</strong> moves toward dispatch once pair rules allow. <strong>QC Fail</strong> stays in this queue for rework.</div>';
    }
    var bypassRow = '';
    if (curr === 'QC_PASS' && fyCanBypassSiblingGuard()) {
      bypassRow =
        '<div class="fy-lab-bypass-row">' +
        '<button type="button" class="btn sm" style="border-color:var(--gold);color:var(--text1)" ' +
        'id="btn-fy-lab-bypass-' + idSuf + '" onclick="updateFyLabOrderDispatchWithBypass(' + oid +
        ', ' + subId + ')">Dispatch anyway (pair guard bypass)</button>' +
        '<span class="fy-lab-action-hint">Requires audit permission; timeline will record the bypass.</span></div>';
    }
    return (
      '<div class="fy-lab-action-stack">' +
      '<div class="fy-lab-status-row">' +
      '<select class="fy-lab-status-select" id="fy-lab-next-' + idSuf + '" aria-label="Next lab stage for ' + fyEscapeAttr(plainLabel) +
      '">' +
      opts + '</select>' +
      '<button type="button" class="btn sm" id="btn-fy-lab-next-' + idSuf + '" onclick="updateFyLabOrderStatus(' + oid +
      ', ' + subId + ')">Update</button></div>' +
      qcHint +
      bypassRow +
      '</div>'
    );
  }

  function buildFyLabStatusAction(order) {
    var jobs = fyJobsFromOrderRow(order);
    if (!jobs.length) {
      return '<span class="fy-lab-action-hint" style="color:var(--gold)">No LAB line — reopen order.</span>';
    }
    var parts = [];
    var i;
    for (i = 0; i < jobs.length; i += 1) {
      parts.push(
        '<div class="fy-lab-job-block">' +
        '<div class="fy-lab-job-label">' +
        fyEscapeHtml(jobs[i].sub_order_label) + '</div>' +
        buildFyLabActionForSingleJob(order, jobs[i]) +
        '</div>'
      );
    }
    return '<div class="fy-lab-action-stack">' + parts.join('') + '</div>';
  }

  window.setFyLabFilter = function(status, tabEl) {
    _fyLabStatusFilter = status || '';
    document.querySelectorAll('#page-lab-orders .tab').forEach((el) => el.classList.remove('active'));
    if (tabEl) tabEl.classList.add('active');
    window.loadLabOrders();
  };

  window.debounceLabOrders = function() {
    clearTimeout(_labOrdersTimer);
    _labOrdersTimer = setTimeout(() => { window.loadLabOrders && window.loadLabOrders(); }, 300);
  };

  function fyBuildLabOrderMobileCard(r) {
    var qcByStoreTab = fyLabIsQcByStoreTab()
    var jobs = fyJobsForLabView(r)
    var statusShown = jobs.map(function (j) {
      return fyLabelLabStatus(j.lab_workflow_status)
    }).filter(Boolean).join(' · ')
    var statusFinal = statusShown || fyLabelLabStatus(r.lab_workflow_status)
    var created = typeof fmtDateTime === 'function' ? fmtDateTime(r.created_at) : (r.created_at || '')
    var orderNo = fyEscapeHtml(r.order_no || '')
    var rowForAction = qcByStoreTab && jobs.length
      ? Object.assign({}, r, { lab_sub_orders: jobs })
      : r
    var badgeHtml = fyLabStatusBadgeHtml(statusFinal, qcByStoreTab)
    return (
      '<article class="fy-lab-card">' +
      '<header class="fy-lab-card__head">' +
      '<div class="fy-lab-card__order mono">' + orderNo + '</div>' +
      badgeHtml +
      '</header>' +
      '<div class="fy-lab-card__customer">' + fyEscapeHtml(r.customer_name || 'Walk-in') +
      (r.membership_plan_name ? ' <span style="font-size:10px;font-weight:700;background:var(--accL);color:var(--acc2);padding:1px 6px;border-radius:20px;vertical-align:middle">' + fyEscapeHtml(r.membership_plan_name) + '</span>' : '') +
      '</div>' +
      (r.customer_phone ? '<div class="fy-lab-card__phone">' + fyEscapeHtml(r.customer_phone) + '</div>' : '') +
      '<div class="fy-lab-card__store">' + fyEscapeHtml(r.store_name || '') + '</div>' +
      '<div class="fy-lab-card__meta">' +
      '<span>' + fyEscapeHtml(created) + '</span>' +
      '<button type="button" class="fy-lab-card__timeline" onclick="window.cosmosTimelineOpen(' + r.order_id + ',\'' + fyEscapeAttr(r.order_no || '') + '\')">Timeline</button>' +
      '</div>' +
      '<div class="fy-lab-card__actions fy-lab-card__actions-row">' + buildFyLabStatusAction(rowForAction) + '</div>' +
      '</article>'
    )
  }

  function fyRenderLabOrdersGroupedHtml(rows, qcByStoreTab) {
    var groups = fyGroupLabOrdersByStore(rows)
    var tableParts = []
    var mobileParts = []
    groups.forEach(function (g) {
      var count = g.rows.length
      tableParts.push(
        '<tr class="fy-lab-store-group">' +
        '<td colspan="6">' +
        '<div class="fy-lab-store-group-head">' +
        '<span class="fy-lab-store-group-name">' + fyEscapeHtml(g.store_name) + '</span>' +
        '<span class="fy-lab-store-group-count">' + count + ' order' + (count === 1 ? '' : 's') + '</span>' +
        '</div></td></tr>'
      )
      mobileParts.push(
        '<div class="fy-lab-store-group-head fy-lab-store-group-head--mobile">' +
        '<span class="fy-lab-store-group-name">' + fyEscapeHtml(g.store_name) + '</span>' +
        '<span class="fy-lab-store-group-count">' + count + ' order' + (count === 1 ? '' : 's') + '</span>' +
        '</div>'
      )
      g.rows.forEach(function (r) {
        tableParts.push(fyRenderLabOrderTableRow(r, qcByStoreTab))
        mobileParts.push(fyBuildLabOrderMobileCard(r))
      })
    })
    return { tableHtml: tableParts.join(''), mobileHtml: mobileParts.join('') }
  }

  function fyRenderLabOrdersEmpty(q, filterTitle, hint, hasSearch) {
    const atLabBtn =
      '<button type="button" class="btn sm primary" onclick="document.getElementById(\'fy-lab-tab-at-lab\')&&setFyLabFilter(\'LAB_FITTING\',document.getElementById(\'fy-lab-tab-at-lab\'))">Show Lab</button>'
    const last7dBtn =
      '<button type="button" class="btn sm" onclick="document.getElementById(\'fy-lab-tab-dispatch-7d\')&&setFyLabFilter(\'DISPATCHED_7D\',document.getElementById(\'fy-lab-tab-dispatch-7d\'))">Last 7 Days</button>'
    const extraQueues =
      String(_fyLabStatusFilter || '').toUpperCase() === 'QC_PASS'
        ? '<div style="margin-top:12px;display:flex;flex-wrap:wrap;justify-content:center;gap:10px">' + atLabBtn + last7dBtn + '</div>'
        : ''
    const searchLine = hasSearch
      ? '<div style="margin-top:8px;font-size:12px;color:var(--gold)">Active search filters the list (' + fyEscapeHtml(q) + ').</div>'
      : ''
    const primaryEmptyBtn =
      '<button type="button" class="btn sm primary" onclick="fyLabClearSearchAndShowAll()">' +
      (hasSearch ? 'Clear search &amp; show need attention' : 'Show need attention') +
      '</button>'
    const emptyInner =
      '<div class="empty" style="padding:32px 24px;text-align:center;max-width:520px;margin:0 auto">' +
      '<div class="empty-ic" style="font-weight:700;font-size:26px;line-height:1;color:var(--acc2)" aria-hidden="true">◇</div>' +
      '<div style="font-size:15px;font-weight:600;color:var(--text1);margin:12px 0 8px">' + fyEscapeHtml(hasSearch ? 'No matches for this query' : 'No lab orders in this view') + '</div>' +
      '<div style="font-size:13px;color:var(--text2);line-height:1.5">' + fyEscapeHtml(hint) + '</div>' +
      '<div style="font-size:12px;color:var(--text3);margin-top:8px">' + fyEscapeHtml('Tab: ' + filterTitle + (hasSearch ? ' · search on' : '')) + '</div>' +
      searchLine +
      '<div style="margin-top:18px;display:flex;flex-wrap:wrap;justify-content:center;gap:10px">' +
      primaryEmptyBtn +
      '<button type="button" class="btn sm" onclick="window.loadLabOrders && window.loadLabOrders()">Refresh</button>' +
      '</div>' +
      extraQueues +
      '</div>'

    const tbody = document.getElementById('lab-orders-tbody')
    const mobile = document.getElementById('fy-lab-orders-mobile')
    if (tbody) tbody.innerHTML = '<tr><td colspan="6">' + emptyInner + '</td></tr>'
    if (mobile) mobile.innerHTML = '<div class="fy-lab-empty">' + emptyInner + '</div>'
  }

  window.loadLabOrders = async function() {
    const tbody = document.getElementById('lab-orders-tbody');
    const mobile = document.getElementById('fy-lab-orders-mobile');
    if (!tbody && !mobile) return;
    if (typeof window.cosmosSkeletonTable === 'function' && tbody) window.cosmosSkeletonTable('lab-orders-tbody', 6);
    if (typeof window.cosmosSkeletonRows === 'function' && mobile) window.cosmosSkeletonRows('fy-lab-orders-mobile', 4);

    const searchEl = document.getElementById('lab-orders-search');
    const q = (searchEl && searchEl.value ? searchEl.value.trim() : '');
    try {
      const qs = new URLSearchParams();
      qs.set('kind', 'LAB');
      qs.set('scope', 'all');
      qs.set('limit', '120');
      if (q) qs.set('search', q);
      var qcByStoreTab = fyLabIsQcByStoreTab();
      var dispatch7dTab = fyLabIsDispatched7dTab();
      if (qcByStoreTab) {
        qs.set('include_lab_status', FY_LAB_QC_BY_STORE_STATUSES.join(','));
      } else if (dispatch7dTab) {
        qs.set('lab_logged_status', FY_LAB_DISPATCH_7D_LOG_STATUS);
        qs.set('lab_logged_since_days', String(FY_LAB_DISPATCH_7D_DAYS));
      } else if (_fyLabStatusFilter) {
        qs.set('lab_status', _fyLabStatusFilter);
      }
      if (_fyLabStoreFilter && ftrCanFilterByStore()) qs.set('store_id', _fyLabStoreFilter);
      const rows = await apiGet(`/api/orders?${qs.toString()}`);
      if (!rows || !rows.length) {
        const hasFilters = Boolean(q || (_fyLabStoreFilter && ftrCanFilterByStore()));
        fyRenderLabOrdersEmpty(q, fyLabFilterTitle(_fyLabStatusFilter), fyLabEmptyHintForFilter(_fyLabStatusFilter), hasFilters);
        return;
      }
      if (qcByStoreTab) {
        var grouped = fyRenderLabOrdersGroupedHtml(rows, true);
        if (tbody) tbody.innerHTML = grouped.tableHtml;
        if (mobile) mobile.innerHTML = grouped.mobileHtml;
      } else {
        if (tbody) {
          tbody.innerHTML = rows.map(function (r) {
            return fyRenderLabOrderTableRow(r, false);
          }).join('');
        }
        if (mobile) mobile.innerHTML = rows.map(function (r) { return fyBuildLabOrderMobileCard(r); }).join('');
      }
    } catch (e) {
      const msg = e && e.message ? e.message : 'Could not load orders.';
      if (typeof window.cosmosToastError === 'function') window.cosmosToastError(msg);
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="color:var(--red);padding:16px">Could not load orders.</td></tr>`;
      if (mobile) mobile.innerHTML = '<div class="fy-lab-empty" style="color:var(--red)">Could not load orders.</div>';
    }
  };

  window.markFyLabIntake = async function(orderId, subOrderId, field) {
    if (!orderId || !subOrderId || !field) return;
    var idSuf = orderId + '_' + subOrderId;
    const btnId =
      field === 'received_at_lab'
        ? `btn-fy-intake-rcv-${idSuf}`
        : `btn-fy-intake-bo-${idSuf}`;
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (typeof window.cosmosBtnLoading === 'function') window.cosmosBtnLoading(btn);
    const payload =
      field === 'received_at_lab'
        ? { sub_order_id: Number(subOrderId), received_at_lab: true }
        : { sub_order_id: Number(subOrderId), backorder_created: true };
    try {
      await apiPost(`/api/orders/${orderId}/lab-intake`, payload);
      if (typeof window.cosmosBtnSuccess === 'function') window.cosmosBtnSuccess(btn);
      if (typeof window.cosmosToastSuccess === 'function') window.cosmosToastSuccess('Checkpoint saved.');
      window.loadLabOrders();
    } catch (e) {
      if (typeof window.cosmosBtnDone === 'function') window.cosmosBtnDone(btn);
      if (typeof window.cosmosToastError === 'function') window.cosmosToastError(e.message);
    }
  };

  window.advanceFyLabFittingEdging = async function(orderId, subOrderId) {
    if (!orderId || !subOrderId) return;
    var idSuf = orderId + '_' + subOrderId;
    const btn = document.getElementById(`btn-fy-fitting-edging-${idSuf}`);
    if (!btn) return;
    if (typeof window.cosmosBtnLoading === 'function') window.cosmosBtnLoading(btn);
    try {
      await apiPost(`/api/orders/${orderId}/lab-status`, {
        sub_order_id: Number(subOrderId),
        to_status: 'LAB_FITTING'
      });
      if (typeof window.cosmosBtnSuccess === 'function') window.cosmosBtnSuccess(btn);
      if (typeof window.cosmosToastSuccess === 'function') window.cosmosToastSuccess('Moved to Fitting/Edging');
      window.loadLabOrders();
    } catch (err) {
      if (typeof window.cosmosBtnDone === 'function') window.cosmosBtnDone(btn);
      if (typeof window.cosmosToastError === 'function') window.cosmosToastError(err.message);
    }
  };

  window.updateFyLabOrderStatus = async function(orderId, subOrderId) {
    var idSuf = orderId + '_' + subOrderId;
    const sel = document.getElementById(`fy-lab-next-${idSuf}`);
    const btn = document.getElementById(`btn-fy-lab-next-${idSuf}`);
    if (!sel || !sel.value || !subOrderId) return;
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      await apiPost(`/api/orders/${orderId}/lab-status`, {
        sub_order_id: Number(subOrderId),
        to_status: sel.value
      });
      if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn);
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Lab status updated');
      window.loadLabOrders();
    } catch (err) {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    }
  };

  window.updateFyLabOrderDispatchWithBypass = async function(orderId, subOrderId) {
    var idSuf = orderId + '_' + subOrderId;
    var btn = document.getElementById('btn-fy-lab-bypass-' + idSuf);
    if (!orderId || !subOrderId) return;
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      await apiPost(`/api/orders/${orderId}/lab-status`, {
        sub_order_id: Number(subOrderId),
        to_status: 'DISPATCHED_TO_STORE',
        bypass_order_sibling_guard: true,
        bypass_reason: 'Foundry HQ authorised pair-guard bypass'
      });
      if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn);
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Dispatched with documented bypass.');
      window.loadLabOrders();
    } catch (err) {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────────────────
  (function bindSubmitChallanModalFields() {
    const numEl = document.getElementById('submit-challan-number');
    const dateEl = document.getElementById('submit-challan-date-input');
    if (numEl && typeof cosmosFieldClear === 'function') {
      numEl.addEventListener('input', () => cosmosFieldClear(numEl));
    }
    if (dateEl && typeof cosmosFieldClear === 'function') {
      dateEl.addEventListener('change', () => cosmosFieldClear(dateEl));
    }
  })();

  bindDelegatedTableActions();
  loadFormData();
  loadDashboard();
  loadPurchases();
  // Deep link / hard refresh: route loaders are assigned later in this file — apply after all are on window.
  applyFoundryRouteFromPath();
});
