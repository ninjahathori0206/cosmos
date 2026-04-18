const API_KEY = (typeof window !== 'undefined' && window.__COSMOS_API_KEY__) || ''

// ── Mobile sidebar toggle ──────────────────────────────────────────────────────
function openSidebar() {
  document.querySelector('.sidebar').classList.add('open');
  document.getElementById('fy-sidebar-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('fy-sidebar-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', () => {
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

  const user = JSON.parse(userRaw);

  const mods = user.modules;
  const hasMap = mods && typeof mods === 'object' && Object.keys(mods).length > 0;
  if (hasMap && mods.foundry === false) {
    if (mods.command_unit !== false) window.location.href = '/command-unit.html';
    else if (mods.finance !== false) window.location.href = '/finance.html';
    else if (mods.storepilot !== false) window.location.href = '/storepilot.html';
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

  if (typeof window.applyCosmosModuleSwitchNav === 'function') {
    window.applyCosmosModuleSwitchNav('fd-switch-module-wrap', user);
  }

  // ── Foundry sidebar permission gating ─────────────────────────────────────
  // Hide nav items the current user lacks permission for, then collapse any
  // nav-group heading that has no visible items beneath it.
  (function applyFoundryPermissionNav() {
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    // super_admin (empty permissions array with role super_admin) sees everything
    if (user.role === 'super_admin') return;

    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;

    document.querySelectorAll('[data-foundry-permission]').forEach((el) => {
      const required = el.getAttribute('data-foundry-permission');
      if (required && !perms.includes(required)) {
        el.style.display = 'none';
      }
    });

    // Hide nav-group headings whose subsequent permission-gated items are all hidden
    nav.querySelectorAll('.nav-group[data-foundry-nav-group]').forEach((group) => {
      // Collect all nav-items between this group and the next sibling group (or end)
      const items = [];
      let sibling = group.nextElementSibling;
      while (sibling && !sibling.classList.contains('nav-group') && sibling.id !== 'fd-switch-module-wrap') {
        if (sibling.classList.contains('nav-item') && sibling.hasAttribute('data-foundry-permission')) {
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
    return Object.assign({ 'X-API-Key': API_KEY, Authorization: `Bearer ${token}` }, extra || {});
  }

  function _buildApiError(data, status) {
    let msg = (data && data.message) ? data.message : `HTTP ${status}`;
    if (data && Array.isArray(data.errors) && data.errors.length) msg += ' — ' + data.errors.join('; ');
    // Surface raw SQL/server error detail when present
    if (data && data.error) msg += ' | Detail: ' + data.error;
    return new Error(msg);
  }

  async function apiGet(path) {
    const res = await fetch(path, { headers: authHeaders() });
    let data; try { data = await res.json(); } catch(_) { throw new Error(`HTTP ${res.status}: unparseable response`); }
    if (!res.ok || !data.success) throw _buildApiError(data, res.status);
    return data.data;
  }

  async function apiPost(path, body) {
    const res = await fetch(path, { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
    let data; try { data = await res.json(); } catch(_) { throw new Error(`HTTP ${res.status}: unparseable response`); }
    if (!res.ok || !data.success) throw _buildApiError(data, res.status);
    return data.data;
  }

  async function apiPut(path, body) {
    const res = await fetch(path, { method: 'PUT', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
    let data; try { data = await res.json(); } catch(_) { throw new Error(`HTTP ${res.status}: unparseable response`); }
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

  // dd/MM/yyyy (IST)
  function fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return String(d);
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' });
  }

  // dd/MM/yyyy HH:mm:ss (IST)
  function fmtDateTime(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return String(d);
    return dt.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
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
      PENDING_BILL_VERIFICATION: ['b-gold',  'Pending Bill Verification'],
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
  window._brandingReceiptDraftByHeader = {};
  window._currentHeaderId = null;
  window._purchaseActiveItemIdx = 1;
  window._purchaseLineModes = {};
  window.getPurchaseActiveIdx = function() {
    return window._purchaseActiveItemIdx || 1;
  };

  // ── Lookup / initial data ─────────────────────────────────────────────────
  async function loadFormData() {
    // Use allSettled so one failing endpoint (e.g. branding-agents) does not block suppliers.
    // Use GET /api/suppliers?status=active (full list) — search?q= uses sp_Supplier_Search TOP 20 only.
    showErr('new-purchase-error', '');
    const [supR, makersR, lookupsR, brandsR, ptR, agentsR] = await Promise.allSettled([
      apiGet('/api/suppliers?status=active'),
      apiGet('/api/maker-master'),
      apiGet('/api/foundry-lookups'),
      apiGet('/api/home-brands'),
      apiGet('/api/foundry-lookups?type=product_type'),
      apiGet('/api/branding-agents')
    ]);

    if (supR.status === 'fulfilled') {
      _allSuppliers = supR.value || [];
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

    const productTypeRows = ptR.status === 'fulfilled' ? (ptR.value || []) : [];
    if (ptR.status === 'rejected') console.error('loadFormData: product_type lookups', ptR.reason);
    _lookups.product_type = (productTypeRows || []).map((row) => ({
      key: row.lookup_key,
      label: row.lookup_label,
      id: row.lookup_id
    }));

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
        ? `<span style="color:var(--text3);font-size:11px;margin-left:4px">· last ${new Date(r.last_purchase_date).toLocaleDateString('en-GB', { month:'short', year:'numeric', timeZone: 'Asia/Kolkata' })}</span>`
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
  async function loadDashboard() {
    const lowStockTbody = document.getElementById('dash-low-stock');
    const lowStockCount = document.getElementById('dash-low-stock-count');
    if (lowStockTbody) {
      lowStockTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:18px;color:var(--text3)">Loading...</td></tr>';
    }
    if (lowStockCount) {
      lowStockCount.className = 'b b-gray';
      lowStockCount.textContent = 'Loading…';
    }
    try {
      const [data, availableStock] = await Promise.all([
        apiGet('/api/purchases/dashboard-stats'),
        apiGet('/api/stock-transfers/available').catch(() => [])
      ]);
      const p = data.purchases || {};
      const setV = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v != null ? v : '0'; };
      setV('dash-active', p.active_purchases);
      setV('dash-pending-bill', p.pending_bill);
      setV('dash-branding', p.in_branding);
      setV('dash-digitisation', p.in_digitisation);
      setV('dash-warehouse', p.warehouse_ready);
      setV('dash-discrepancy', p.bill_discrepancy);
      setV('dash-skus', (data.skus || {}).total_skus);
      setV('dash-stock', (data.stock || {}).warehouse_stock);
      setV('dash-suppliers', (data.suppliers || {}).active_suppliers);

      if (lowStockTbody && lowStockCount) {
        const safe = (v) => String(v == null ? '' : v)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
        const rows = Array.isArray(availableStock) ? availableStock : [];
        const lowRows = rows
          .filter((r) => Number(r.available_qty ?? r.warehouse_qty ?? r.qty ?? 0) <= 5)
          .sort((a, b) => Number(a.available_qty ?? a.warehouse_qty ?? a.qty ?? 0) - Number(b.available_qty ?? b.warehouse_qty ?? b.qty ?? 0))
          .slice(0, 8);

        lowStockCount.className = lowRows.length ? 'b b-red' : 'b b-gray';
        lowStockCount.textContent = lowRows.length ? `${lowRows.length} SKUs` : 'No alerts';

        if (!lowRows.length) {
          lowStockTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:18px;color:var(--text3)">No low stock alerts.</td></tr>';
        } else {
          lowStockTbody.innerHTML = lowRows.map((r) => {
            const qty = Number(r.available_qty ?? r.warehouse_qty ?? r.qty ?? 0);
            const threshold = Number(r.threshold_qty ?? r.min_qty ?? 5);
            const qtyColor = qty <= 2 ? 'var(--red)' : 'var(--gold)';
            return `<tr>
              <td class="mono xs">${safe(r.sku_code || r.sku || '—')}</td>
              <td>${safe(r.product_name || r.display_name || r.model_name || '—')}</td>
              <td class="fw6" style="color:${qtyColor}">${qty}</td>
              <td class="td2">${threshold}</td>
            </tr>`;
          }).join('');
        }
      }
    } catch (err) { console.error('loadDashboard:', err); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NEW PURCHASE FORM (multi-item)
  // ─────────────────────────────────────────────────────────────────────────
  function initNewPurchaseForm() {
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
            <div class="item-line-rate-gst-brand-dup">
              <div class="fg3 mb3">
                <div class="fgrp">
                  <label>Purchase Rate (₹) <span class="req">*</span></label>
                  <input type="number" id="item-rate-${idx}" placeholder="Per unit rate" oninput="calcItemBill(${idx})">
                </div>
                <div class="fgrp">
                  <label>GST % <span class="req">*</span></label>
                  <input type="number" id="item-gst-${idx}" placeholder="e.g. 12 for 12%" step="0.01" min="0" max="100" oninput="calcItemBill(${idx})">
                </div>
              </div>
              <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
                <input type="checkbox" id="item-branding-${idx}" style="width:16px;height:16px;cursor:pointer;accent-color:var(--acc2)">
                <label for="item-branding-${idx}" style="font-size:13px;font-weight:600;cursor:pointer">Branding Required</label>
              </div>
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
              <input type="number" id="item-qty-${idx}" placeholder="Total units" oninput="calcItemBill(${idx});validateColourQty(${idx})">
            </div>
            <div class="item-totals-cluster">
              <div class="item-mini-amts">
                <div class="item-money-row"><span class="td2">Base value</span><span class="mono" id="item-base-${idx}">₹0</span></div>
                <div class="item-money-row"><span class="td2">GST amount</span><span class="mono" id="item-gst-amt-${idx}">₹0</span></div>
              </div>
              <div class="item-total-cell">
                <div class="item-total-lbl">Item total</div>
                <span class="mono" id="item-total-${idx}">₹0</span>
              </div>
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

  // ── Save Purchase ─────────────────────────────────────────────────────────
  window.handleSavePurchase = async function() {
    showErr('new-purchase-error', '');
    const supplierId = val('bill-supplier-select');
    const billRef    = val('bill-ref-input');
    const purchDate  = (typeof getFpIso === 'function' ? getFpIso('bill-purchase-date-input') : null) || val('bill-purchase-date-input');
    const transport  = parseFloat(val('bill-transport-input')) || 0;
    const poRef      = val('bill-po-ref-input');
    const notes      = val('bill-notes-input');

    if (!supplierId)  return showErr('new-purchase-error', 'Please select a Supplier.');
    if (!purchDate)   return showErr('new-purchase-error', 'Please enter a Purchase Date.');

    const itemCards = document.querySelectorAll('.purchase-item-card');
    if (!itemCards.length) return showErr('new-purchase-error', 'Add at least one item.');

    const itemsPayload = [];
    for (const card of itemCards) {
      const i = card.dataset.idx;
      const sourceBrand = val(`item-source-brand-${i}`);
      const sourceColl = val(`item-source-coll-${i}`) || null;
      const sourceModel = val(`item-source-model-${i}`);
      const rate       = parseFloat(val(`item-rate-${i}`));
      const qty        = parseInt(val(`item-qty-${i}`));
      const gstPct     = parseFloat(val(`item-gst-${i}`));
      const makerMasterId = val(`item-maker-${i}`) || null;
      const category = val(`item-product-type-${i}`);
      const brandingRequired = document.getElementById(`item-branding-${i}`)?.checked ?? false;

      if (!makerMasterId) {
        return showErr('new-purchase-error', `Item #${i}: Select Manufacturer from the list (type name and pick a match).`);
      }
      if (!sourceBrand) return showErr('new-purchase-error', `Item #${i}: Enter Source Brand.`);
      if (!sourceModel) return showErr('new-purchase-error', `Item #${i}: Enter Source Model Number.`);
      if (!category) return showErr('new-purchase-error', `Item #${i}: Select Product Type.`);
      if (!rate || rate <= 0)  return showErr('new-purchase-error', `Item #${i}: Enter a valid Rate.`);
      if (!qty  || qty  <= 0)  return showErr('new-purchase-error', `Item #${i}: Enter a valid Quantity.`);
      if (gstPct == null || isNaN(gstPct) || gstPct < 0) return showErr('new-purchase-error', `Item #${i}: Enter GST% (e.g. 12 for 12%).`);
      if (!validateColourQty(i)) return showErr('new-purchase-error', `Item #${i}: Colour quantities must match item total.`);

      // Collect colours
      const colours = [];
      const colourRows = card.querySelectorAll(`[id^="clr-qty-${i}-"]`);
      colourRows.forEach((cqEl) => {
        const cidx = cqEl.id.split('-').pop();
        const cName = val(`clr-name-${i}-${cidx}`);
        const cCode = val(`clr-code-${i}-${cidx}`);
        const cQty  = parseInt(cqEl.value) || 0;
        if (cName && cQty > 0) colours.push({ colour_name: cName, colour_code: cCode || cName.replace(/\s+/g,'').toUpperCase().slice(0,8), quantity: cQty });
      });
      // If no colour variants were filled in, insert a generic "Standard" variant
      // so that SKU generation is always possible in the digitisation stage.
      if (colours.length === 0) {
        colours.push({ colour_name: 'Standard', colour_code: 'STD', quantity: qty });
      }
      // Use explicitly selected product (from search picker) or resolve via repeat-check / create
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
        // Keep legacy fields populated to remain compatible with existing reports.
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
        purchase_rate:     rate,
        quantity:          qty,
        gst_pct:           gstPct / 100,   // convert % to fraction for DB (12 → 0.12)
        colours
      });
    }

    const btn = document.getElementById('save-purchase-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try {
      const result = await apiPost('/api/purchases', {
        supplier_id: Number(supplierId),
        source_type: null,
        bill_ref: billRef || null,
        purchase_date: purchDate,
        transport_cost: transport,
        po_reference: poRef || null,
        notes: notes || null,
        items: itemsPayload
      });
      const headerId = result.header && result.header.header_id;
      window._currentHeaderId = headerId;
      // Reset form
      document.getElementById('purchase-items-container').innerHTML = '';
      _itemCount = 0;
      _colourCounters = {};
      document.getElementById('bill-supplier-select').value   = '';
      document.getElementById('bill-ref-input').value          = '';
      document.getElementById('bill-transport-input').value    = '';
      const pdEl = document.getElementById('bill-purchase-date-input');
      if (pdEl && pdEl._flatpickr) pdEl._flatpickr.clear(); else if (pdEl) pdEl.value = '';
      // Navigate to bill verify — openBillVerifyPage handles nav internally
      openBillVerifyPage(headerId);
    } catch (err) {
      showErr('new-purchase-error', err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Save All Items → Bill Verification'; }
    }
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
        if (r.pipeline_status === 'PENDING_BILL_VERIFICATION')
          actions.push(`<button class="btn xs primary" onclick="openBillVerifyPage(${r.header_id})">Verify Bill</button>`);
        else if (['PENDING_BRANDING','BRANDING_DISPATCHED'].includes(r.pipeline_status))
          actions.push(`<button class="btn xs primary" onclick="openBrandingPage(${r.header_id})">Branding</button>`);
        else if (r.pipeline_status === 'PENDING_DIGITISATION')
          actions.push(`<button class="btn xs primary" onclick="openDigitisationPage(${r.header_id})">Digitise</button>`);
        else if (r.pipeline_status === 'WAREHOUSE_READY')
          actions.push(`<button class="btn xs" onclick="openPurchaseView(${r.header_id})">View</button>`);

        return `<tr>
          <td class="mono xs">#${r.header_id}</td>
          <td class="fw6">${r.supplier_name || '—'}</td>
          <td class="mono xs td2">${r.bill_ref || r.bill_number || '—'}</td>
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
      const skus  = skuData || [];
      window._pvCurrentSkus = skus;

      const titleEl = document.getElementById('pv-title');
      const subEl   = document.getElementById('pv-subtitle');
      if (titleEl) titleEl.textContent = `Purchase #${h.header_id} — ${h.supplier_name || ''}`;
      if (subEl)   subEl.innerHTML     = `${stageBadge(h.pipeline_status)} &nbsp;·&nbsp; ${items.length} item${items.length !== 1 ? 's' : ''} · ${fmtDate(h.purchase_date)}`;

      // Populate each stage panel
      _pvRenderStage1(h, items);
      _pvRenderStage2(h, items);
      _pvRenderStage3(h);
      _pvRenderStage4(items, skus);
      _pvRenderStage5(h, skus);

      if (loadEl) loadEl.style.display = 'none';

      // Mark completed stages (done class) + the active/current stage
      const stageNum = { PENDING_BILL_VERIFICATION: 1, PENDING_BRANDING: 2,
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
              <div><div class="xs td2">Invoice No.</div><div class="fw6 mono">${h.bill_ref || '—'}</div></div>
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
                ${h.branding_instructions ? `<div><div class="xs td2">Instructions</div><div class="fw6">${h.branding_instructions}</div></div>` : ''}`}
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // Stage 4 — Digitisation
  function _pvRenderStage4(items, skus) {
    const el = document.getElementById('pv-stage-4');
    if (!el) return;
    const rows = skus.map((sk) => `<tr>
      <td class="mono xs fw6">${sk.sku_code}</td>
      <td class="mono xs">${sk.barcode}</td>
      <td>${sk.ew_collection || ''} · ${sk.style_model || ''}</td>
      <td>${sk.colour_name || '—'}</td>
      <td class="mono xs">${inrD(sk.sale_price)}</td>
      <td class="tc">${sk.quantity}</td>
      <td><span class="b b-green xs">${sk.status}</span></td>
    </tr>`).join('');
    const printBtn4 = skus.length
      ? `<button type="button" class="btn btn-sm" onclick="openBarcodeModal(window._pvCurrentSkus)" style="font-size:12px;padding:5px 12px;white-space:nowrap">🏷️ Print Barcodes</button>`
      : '';
    el.innerHTML = `<div class="card">
      <div class="ch" style="gap:12px">
        <div class="ct" style="min-width:0">Generated SKUs</div>
        <div class="flex ic g2" style="flex-shrink:0;margin-left:auto">
          <span class="b b-teal xs">${skus.length} SKUs</span>
          ${printBtn4}
        </div>
      </div>
      <div class="cb">
        <div class="tw"><table>
          <thead><tr><th>SKU Code</th><th>Barcode</th><th>Product</th><th>Colour</th><th>Sale Price</th><th>Qty</th><th>Status</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="7" class="tc td2">No SKUs generated</td></tr>'}</tbody>
        </table></div>
      </div>
    </div>`;
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
      <td class="mono xs fw6">${sk.sku_code}</td>
      <td>${sk.ew_collection || ''} · ${sk.style_model || ''}</td>
      <td>${sk.colour_name || '—'}</td>
      <td class="mono xs">${inrD(sk.sale_price)}</td>
      <td class="tc fw6">${sk.quantity}</td>
      <td class="mono xs">${inrD(Number(sk.sale_price || 0) * Number(sk.quantity || 0))}</td>
    </tr>`).join('');

    el.innerHTML = `<div class="main-side">
      <div class="col-stack">
        <div class="card">
          <div class="ch" style="gap:12px">
            <div class="ct" style="min-width:0">Warehouse Stock Added</div>
            <div class="flex ic g2" style="flex-shrink:0;margin-left:auto">
              <button type="button" class="btn btn-sm" onclick="openBarcodeModal(window._pvCurrentSkus)" style="font-size:12px;padding:5px 12px;white-space:nowrap">🏷️ Print Barcodes</button>
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
              <thead><tr><th>SKU Code</th><th>Product</th><th>Colour</th><th>Sale Price</th><th>Qty</th><th>Value</th></tr></thead>
              <tbody>${tableRows || '<tr><td colspan="6" class="tc td2">No SKUs</td></tr>'}</tbody>
            </table></div>
          </div>
        </div>
      </div>
    </div>`;
  }

  window.openBillVerifyPage = async function openBillVerifyPage(headerId) {
    window._currentHeaderId = headerId;
    nav('bill-verify', document.querySelector('.nav-item[onclick*="bill-verify"]'), true);
    showBvDetail();
    showErr('bill-verify-error', '');
    // Restore form and button visibility (in case previously hidden by openPurchaseView)
    const formCard = document.getElementById('bill-entry-form-card');
    if (formCard) formCard.style.display = '';
    const verifyBtn = document.getElementById('verify-bill-btn');
    if (verifyBtn) verifyBtn.style.display = '';
    try {
      const data = await apiGet(`/api/purchases/${headerId}`);
      const h = data.header;
      const items = data.items || [];

      // If purchase is beyond bill verification stage, use the full purchase history view
      if (h.pipeline_status !== 'PENDING_BILL_VERIFICATION') {
        return window.openPurchaseView(headerId);
      }

      // Update title/badge
      document.getElementById('bv-title').textContent = `Purchase #${h.header_id} — ${h.supplier_name || ''}`;
      const badge = document.getElementById('bv-status-badge');
      badge.className = 'b b-gold';
      badge.textContent = 'Pending Bill Verification';

      document.getElementById('bv-meta').innerHTML = `
        <div><div class="xs td2">Supplier</div><div class="fw6">${h.supplier_name || '—'}</div></div>
        <div><div class="xs td2">Invoice No.</div><div class="fw6 mono">${h.bill_ref || '—'}</div></div>
        <div><div class="xs td2">Purchase Date</div><div class="fw6">${fmtDate(h.purchase_date)}</div></div>`;

      // Items table
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

      // Expected breakdown
      const itemsSubtotal = items.reduce((s, it) => s + Number(it.base_value), 0);
      const totalGst      = items.reduce((s, it) => s + Number(it.gst_amt), 0);
      const transport     = Number(h.transport_cost) || 0;
      const expected      = Number(h.expected_bill_amt) || (itemsSubtotal + totalGst + transport);

      document.getElementById('bv-subtotal').textContent   = inrD(itemsSubtotal);
      document.getElementById('bv-transport').textContent  = inrD(transport);
      document.getElementById('bv-gst').textContent        = inrD(totalGst);
      document.getElementById('bv-expected').textContent   = inrD(expected);

      // Pre-fill date
      const todayStr = istToday();
      const billDateEl = document.getElementById('bill-date-input');
      if (billDateEl && !billDateEl.value && billDateEl._flatpickr) billDateEl._flatpickr.setDate(new Date(), true);

    } catch (err) { showErr('bill-verify-error', err.message); }
  }

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
        <div><div class="xs td2">Invoice No.</div><div class="mono xs">${h.bill_ref || h.bill_number || '—'}</div></div>
        <div><div class="xs td2">Purchase Date</div><div class="fw6">${fmtDate(h.purchase_date)}</div></div>`;

      // Build all-items colour table
      let allItemsHtml = '';
      const isPendingDispatch = h.pipeline_status === 'PENDING_BRANDING';
      const totalItemQty = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
      const totalColourRows = items.reduce((s, it) => s + ((it.colours || []).length), 0);
      const brandingRequiredCount = items.filter((it) => !!it.branding_required).length;
      items.forEach((it) => {
        const needsBranding = it.branding_required;
        // Brand selector — shown for items needing branding in PENDING_BRANDING state;
        // read-only display when already dispatched/received.
        let brandRowHtml = '';
        const collDefault = (it.ew_collection || it.source_collection || '').replace(/"/g, '&quot;');
        if (needsBranding) {
          if (isPendingDispatch) {
            const brandOpts = (_homeBrands || []).map((b) =>
              `<option value="${b.brand_id}" ${Number(b.brand_id) === Number(it.home_brand_id) ? 'selected' : ''}>${b.brand_name}</option>`
            ).join('');
            const srcCollHint = it.source_collection || '—';
            brandRowHtml = `
              <div class="fgrp mt2" style="margin-bottom:10px">
                <label style="font-size:12px;font-weight:600">Brand Name <span class="req">*</span></label>
                <div class="xs td2" style="margin-top:2px;margin-bottom:2px">Source brand: <span class="fw6">${it.source_brand || '—'}</span></div>
                <select id="brand-sel-${it.item_id}" data-item-id="${it.item_id}" style="margin-top:4px">
                  <option value="">— Select Brand —</option>
                  ${brandOpts}
                </select>
              </div>
              <div class="fgrp mt2" style="margin-bottom:10px">
                <label style="font-size:12px;font-weight:600">Collection Name <span class="req">*</span></label>
                <div class="xs td2" style="margin-top:2px;margin-bottom:2px">Source collection: <span class="fw6">${srcCollHint}</span></div>
                <input type="text" id="coll-inp-${it.item_id}" data-item-id="${it.item_id}" placeholder="Eyewoot / home collection name" value="${collDefault}" style="margin-top:4px;width:100%;max-width:420px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px">
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
    document.querySelectorAll('[id^="brand-sel-"]').forEach((sel) => {
      const itemId = Number(sel.dataset.itemId);
      const collInp = document.getElementById(`coll-inp-${itemId}`);
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
      wrap.innerHTML = `<div class="b b-green">All quantities matched. Confirm Receipt is enabled.</div>`;
      return;
    }
    const itemList = itemMismatches.slice(0, 6).map((m) => `<li>Item ${_mcEsc(m.label || m.item_id)}: expected ${m.expected_qty}, received ${m.received_qty}</li>`).join('');
    const colourList = colourMismatches.slice(0, 6).map((m) => `<li>${_mcEsc(m.item_label || ('Item #' + m.item_id))} · ${_mcEsc(m.colour_label)}: expected ${m.expected_qty}, received ${m.received_qty}</li>`).join('');
    wrap.innerHTML = `
      <div class="b b-red">Mismatches found: ${total} (Items: ${itemMismatches.length}, Colours: ${colourMismatches.length})</div>
      <div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><div class="xs td2" style="margin-bottom:4px">Item-level mismatches</div><ul style="margin:0;padding-left:16px">${itemList || '<li class="td2">None</li>'}</ul></div>
        <div><div class="xs td2" style="margin-bottom:4px">Colour-level mismatches</div><ul style="margin:0;padding-left:16px">${colourList || '<li class="td2">None</li>'}</ul></div>
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
      host.style.cssText = 'margin-top:12px;padding-top:10px;border-top:1px solid var(--border)';
      receiptCard.appendChild(host);
    }

    const itemRows = Object.entries(draft.items).map(([k, it]) => `
      <tr>
        <td style="padding:6px 8px">${_mcEsc(it.label)}</td>
        <td class="tc" style="padding:6px 8px">${Number(it.expected_qty || 0)}</td>
        <td style="padding:6px 8px"><input type="number" min="0" step="1" value="${Number(it.received_qty || 0)}" oninput="handleBrandingReceiptQtyInput(${headerId}, 'item', '${k}', this.value)" style="width:110px;padding:6px 8px;border:1px solid var(--border);border-radius:6px"></td>
      </tr>`).join('');

    const colourRows = Object.entries(draft.colours).map(([k, c]) => `
      <tr>
        <td style="padding:6px 8px">${_mcEsc(c.item_label)}</td>
        <td style="padding:6px 8px">${_mcEsc(c.colour_label)}</td>
        <td class="tc" style="padding:6px 8px">${Number(c.expected_qty || 0)}</td>
        <td style="padding:6px 8px"><input type="number" min="0" step="1" value="${Number(c.received_qty || 0)}" oninput="handleBrandingReceiptQtyInput(${headerId}, 'colour', '${k}', this.value)" style="width:110px;padding:6px 8px;border:1px solid var(--border);border-radius:6px"></td>
      </tr>`).join('');

    host.innerHTML = `
      <div class="fw6" style="margin-bottom:8px">Receipt Quantity Verification</div>
      <div class="xs td2" style="margin-bottom:8px">Confirm Receipt is blocked until item-wise and colour-wise received quantities match expected quantities.</div>
      <div id="branding-receipt-verify-summary" style="margin-bottom:10px"></div>
      <div style="display:grid;grid-template-columns:1fr;gap:10px">
        <div class="tw">
          <table>
            <thead><tr><th>Item</th><th class="tc">Expected Qty</th><th>Received Qty</th></tr></thead>
            <tbody>${itemRows || '<tr><td colspan="3" class="tc td2 p12">No items</td></tr>'}</tbody>
          </table>
        </div>
        <div class="tw">
          <table>
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
          <div>Invoice No.: ${h.bill_ref || h.bill_number || '—'}</div>
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
          const isDone = !!existingSku;
          const tabId  = `digi-panel-${item.item_id}-${col.colour_id}`;
          const imgId  = `clr-img-${item.item_id}-${col.colour_id}`;

          // Colour-level media — prefer SKU level, fall back to colour record
          const colourImgUrl = (existingSku && existingSku.image_url) || col.image_url || null;
          const colourVidUrl = (existingSku && existingSku.video_url) || col.video_url || null;
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
            ${col.colour_name} ${isDone ? '<span class="b b-green xs">Done</span>' : '<span class="b b-gold xs">Pending</span>'}
          </div>`;

          panelsHtml += `<div id="${tabId}" ${colIdx !== 0 ? 'style="display:none"' : ''}>
            <div class="two-col mt2">
              <div class="col-stack">
                <div class="card">
                  <div class="ch"><div class="ct">SKU Details</div></div>
                  <div class="cb">
                    ${isDone ? `
                      <div class="alert alert-blue" style="margin-bottom:0"><span>✅</span>
                        <div>SKU Generated: <strong class="mono">${existingSku.sku_code}</strong><br>
                        Barcode: <span class="mono">${existingSku.barcode}</span><br>
                        Sale Price: ${inrD(existingSku.sale_price)}</div>
                      </div>` : `
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
                    <div class="digi-upload-tile" onclick="document.getElementById('${imgId}-file').click()">
                      Click to upload<br>or drag and drop
                    </div>
                    <div>
                      <div id="${imgId}-current" class="digi-media-strip">${currentMedia}</div>
                      <div id="${imgId}-preview" class="digi-media-strip" style="display:none"></div>
                      <div class="digi-media-actions">
                        <button type="button" class="btn sm" onclick="document.getElementById('${imgId}-file').click()">Replace</button>
                        <button type="button" class="btn sm" onclick="clearColourMediaSelection('${imgId}')">Remove</button>
                      </div>
                    </div>
                  </div>
                  <input type="file" id="${imgId}-file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,video/avi,video/x-matroska"
                    style="display:none" onchange="handleColourMediaPreview('${imgId}')">
                  <div class="xs td2 mt1 mb2">Upload one file (Photo max 5 MB or Video max 100 MB)</div>
                  <div id="${imgId}-msg" style="display:none;font-size:12px;margin-bottom:6px"></div>
                  <button id="${imgId}-save-btn" class="btn sm" onclick="handleSaveColourMedia(${headerId},${col.colour_id},'${imgId}')">💾 Save Media</button>
                </div>
              </div>
            </div>
          </div>`;
        });

        // Product details section (per item — text specs only; photos are per colour tab above)
        const pdId = `pd-${item.item_id}`;
        const productDetailsHtml = `
          <div style="border-top:1.5px solid var(--border);padding-top:16px;margin-top:8px">
            <div class="section-lbl mb3">Product Details for Catalogue
              <span class="xs td2" style="font-weight:400;margin-left:8px">(shared specs — saved to product master)</span>
            </div>
            <div class="fg3 mb3">
              <div class="fgrp" style="grid-column:1/-1">
                <label>Product Description</label>
                <textarea id="${pdId}-desc" rows="2" placeholder="e.g. Premium metal frame eyeglasses with spring hinges and UV400 lenses">${item.description || ''}</textarea>
              </div>
              <div class="fgrp">
                <label>Frame Material</label>
                <input id="${pdId}-material" placeholder="e.g. Stainless Steel, Titanium, Acetate" value="${item.frame_material || ''}">
              </div>
              <div class="fgrp">
                <label>Frame Width (mm)</label>
                <input type="number" id="${pdId}-width" placeholder="e.g. 135" step="0.1" value="${item.frame_width || ''}">
              </div>
              <div class="fgrp">
                <label>Lens Height (mm)</label>
                <input type="number" id="${pdId}-height" placeholder="e.g. 42" step="0.1" value="${item.lens_height || ''}">
              </div>
              <div class="fgrp">
                <label>Temple Length (mm)</label>
                <input type="number" id="${pdId}-temple" placeholder="e.g. 145" step="0.1" value="${item.temple_length || ''}">
              </div>
            </div>
            <div id="${pdId}-msg" style="display:none;font-size:12.5px;margin-bottom:8px"></div>
            <button class="btn sm mt2" onclick="handleSaveProductDetails(${item.item_id}, ${item.product_master_id}, '${pdId}')">💾 Save Product Specs</button>
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
    if (!priceEl) return;
    const price = parseFloat(priceEl.value);
    if (!price || price <= 0) return alert('Enter a valid Sale Price.');
    try {
      await apiPost(`/api/purchases/${headerId}/generate-sku`, {
        item_id: itemId, item_colour_id: colourId, sale_price: price
      });
      await openDigitisationPage(headerId);
    } catch (err) { alert(err.message); }
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

  window.handleSaveProductDetails = async function(itemId, productMasterId, pdId) {
    const getV  = (sfx) => { const el = document.getElementById(`${pdId}-${sfx}`); return el ? el.value.trim() || null : null; };
    const toN   = (sfx) => { const v = parseFloat(document.getElementById(`${pdId}-${sfx}`)?.value); return isNaN(v) ? null : v; };
    const msgEl = document.getElementById(`${pdId}-msg`);
    const btn   = document.querySelector(`button[onclick*="handleSaveProductDetails(${itemId}"]`);
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      // Save product spec details (no image — images are per colour tab)
      await apiPut(`/api/products/${productMasterId}/details`, {
        description:    getV('desc'),
        frame_material: getV('material'),
        frame_width:    toN('width'),
        lens_height:    toN('height'),
        temple_length:  toN('temple')
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
      openBarcodeModal(skus, { defaultType: 'QR' });
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
      if (tb) tb.innerHTML = rows.map((r) => `<tr>
        <td class="mono xs fw6">#${r.header_id}</td>
        <td class="fw6">${r.supplier_name || '—'}</td>
        <td class="mono xs td2">${r.bill_ref || r.bill_number || '—'}</td>
        <td class="tc">${r.item_count || 0}</td>
        <td class="tc">${r.total_qty || 0}</td>
        <td class="mono xs">${inrD(r.expected_bill_amt)}</td>
        <td class="xs td2">${fmtDate(r.created_at)}</td>
        <td><button class="btn xs primary" onclick="openBillVerifyPage(${r.header_id})">Verify Bill</button></td>
      </tr>`).join('');
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
    const missingBrand = brandingItems.filter((it) => !(it.brand_name || '').trim()).length;
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
          ? `<button class="btn xs primary" onclick="openBrandingPage(${r.header_id})">View / Manage</button>`
          : (history
            ? `<button class="btn xs primary" onclick="toggleBrandingHistoryDetail(${r.header_id}); return false;">View Details</button>`
            : `<button class="btn xs" onclick="openPurchaseView(${r.header_id})">View</button>`);
        const rowClick = history ? ` onclick="toggleBrandingHistoryDetail(${r.header_id})"` : '';
        const rowStyle = history ? ' style="cursor:pointer"' : '';
        const detailRow = history ? `
          <tr id="branding-hist-row-${r.header_id}" style="display:none;background:#f8fbff">
            <td colspan="8" id="branding-hist-cell-${r.header_id}" class="p0"></td>
          </tr>` : '';
        return `<tr${rowClick}${rowStyle}>
          <td class="mono xs fw6">#${r.header_id}</td>
          <td class="fw6">${r.supplier_name || '—'}</td>
          <td class="mono xs td2">${r.bill_ref || r.bill_number || '—'}</td>
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
        <td class="mono xs td2">${r.bill_ref || r.bill_number || '—'}</td>
        <td class="tc">${r.item_count || 0}</td>
        <td class="tc">${r.total_qty || 0}</td>
        <td class="xs td2">${fmtDate(r.created_at)}</td>
        <td><button class="btn xs primary" onclick="openDigitisationPage(${r.header_id})">Digitise</button></td>
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

  window.openMasterProductDetail = function(productId) {
    const r = _mcRowById[productId];
    if (!r) return;
    const titleEl = document.getElementById('mc-detail-title');
    const idEl = document.getElementById('mc-detail-id');
    const bodyEl = document.getElementById('mc-detail-body');
    if (titleEl) titleEl.textContent = r.brand_name || 'Product';
    if (idEl) idEl.textContent = r.product_id ? `product_id ${r.product_id}` : '';
    if (!bodyEl) return;

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
        return `<div>Lowest (purchase rate): <span class="mono fw6">${_mcInr(lo)}</span></div>
          <div style="margin-top:6px">Highest (purchase rate): <span class="mono fw6">${_mcInr(hi)}</span></div>`;
      }
      const v = _mcInr(lo != null ? lo : hi);
      return `<div><span class="mono fw6">${v}</span></div>`;
    })();

    const mrpBlock = (() => {
      const lo = r.mrp_min;
      const hi = r.mrp_max;
      if (lo == null && hi == null) {
        return '<span class="td2">No SKUs / MRP (sale price) yet</span>';
      }
      if (lo != null && hi != null && Number(lo) === Number(hi)) {
        return `<span class="mono fw6">${_mcInr(lo)}</span> <span class="xs td2">(from SKU sale prices)</span>`;
      }
      return `<div>Lowest MRP: <span class="mono fw6">${_mcInr(lo)}</span></div>
        <div style="margin-top:6px">Highest MRP: <span class="mono fw6">${_mcInr(hi)}</span></div>
        <div class="xs td2" style="margin-top:6px">MIN/MAX of SKU sale_price for this model.</div>`;
    })();

    bodyEl.innerHTML = [
      _mcDetailKV('Brand', _mcEsc(r.brand_name || '—')),
      _mcDetailKV('EW collection', _mcEsc(r.ew_collection || '—')),
      _mcDetailKV('Style', styleBlock),
      _mcDetailKV('Manufacturer', _mcEsc(r.manufacturer_name || '—')),
      _mcDetailKV('Source brand', _mcEsc(r.source_brand || '—')),
      _mcDetailKV('Source collection', _mcEsc(r.source_collection || '—')),
      _mcDetailKV('Purchase (lowest & highest rate)', purchaseBlock),
      _mcDetailKV('MRP', mrpBlock)
    ].join('');
    if (typeof openM === 'function') openM('modal-master-product');
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

    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="tc td2 p12">Loading…</td></tr>';

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

    if (grid)  grid.innerHTML  = '<div class="empty"><div class="empty-ic">⏳</div><div>Loading…</div></div>';
    if (tbody) tbody.innerHTML = '<tr><td colspan="10" class="tc td2 p12">Loading…</td></tr>';

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
              <button class="btn primary sku-view-btn" id="skupg-${pid}-view-btn"
                onclick="openSkuDetail(${first.sku_id})">View Details</button>
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
              <td><button class="btn sm" onclick="openSkuDetail(${c.sku_id})">View</button></td>
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
      const cls = sku.stock_qty > 10 ? 'b-green' : sku.stock_qty > 0 ? 'b-gold' : 'b-red';
      stockEl.className = `b ${cls} xs`;
      stockEl.textContent = `${sku.stock_qty} units`;
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
            <div><div class="label-sm td2">Barcode</div><div class="mono xs">${r.barcode || '—'}</div></div>
          </div>
          <hr style="border:none;border-top:1px solid #eee;margin:8px 0">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
            <div><div class="label-sm td2">Sale Price</div><div class="mono fw6" style="color:var(--primary)">${inrD(r.sale_price)}</div></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
            <div><div class="label-sm td2">Warehouse Stock</div><div class="fw6" style="font-size:16px;color:${r.stock_qty > 0 ? 'var(--green)' : 'var(--red)'}">${r.stock_qty} units</div></div>
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
          <span class="xs td2" style="display:flex;align-items:center;gap:4px">🏭 <span>HQ Warehouse</span></span>
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

  // ─────────────────────────────────────────────────────────────────────────
  // NAV PAGE CHANGE EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  const origNav = window.nav;
  window.nav = function(id, el, skipList) {
    if (typeof origNav === 'function') origNav(id, el);
    if (id === 'dashboard')    loadDashboard();
    if (id === 'purchases')    loadPurchases();
    if (id === 'new-purchase') {
      void (async () => {
        await loadFormData();
        initNewPurchaseForm();
      })();
    }
    if (id === 'sku-catalogue')    loadSkuCatalogue();
    if (id === 'master-catalogue') loadMasterCatalogue();
    if (id === 'stock-view')       loadStockView();
    if (id === 'stock-transfer')   stInit();
    if (id === 'transfer-requests') loadTransferRequests();
    if (id === 'movement-list')     loadMovementList();
    // Only load the list when navigating from sidebar (not when opening a detail directly)
    if (!skipList) {
      if (id === 'bill-verify')  loadBillVerifyList();
      if (id === 'branding')     loadBrandingList();
      if (id === 'digitisation') loadDigitisationList();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // BARCODE PRINT (TSC P210 · TSPL2 · roll/label geometry is parameterized)
  // ─────────────────────────────────────────────────────────────────────────

  let _bcSkus = [];        // current set of SKUs in the modal
  let _bcUsbDevice = null; // connected WebUSB device

  // TSC P210 USB vendor/product IDs (TSC Auto ID)
  const TSC_VENDOR_ID = 0x0EB8;

  function _bcEsc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** PID (or barcode when pid omitted) for QR; never use SKU alone when barcode carries PID. */
  function _bcQrPayload(sk) {
    const sku = sk.sku_code || '';
    const p = sk.pid != null && String(sk.pid).trim() !== '' ? String(sk.pid) : '';
    const b = sk.barcode != null && String(sk.barcode).trim() !== '' ? String(sk.barcode) : '';
    if (p) return p;
    if (b && b !== sku) return b;
    return sku;
  }

  window.openBarcodeModal = function(skus, opts) {
    opts = opts || {};
    if (!skus || !skus.length) { alert('No SKUs available to print.'); return; }
    _bcSkus = skus;
    _bcUsbDevice = null;
    _bcUpdatePrinterStatus(null);

    // Build SKU list rows — each row has its own qty input defaulting to unit quantity
    const listEl = document.getElementById('bc-sku-list');
    if (listEl) {
      listEl.innerHTML = skus.map((sk, i) => {
        const sku = sk.sku_code || '—';
        const qrVal = _bcQrPayload(sk);
        const legacy = !sk.pid && sk.barcode === sk.sku_code && sk.sku_code;
        const qrLine = qrVal !== sku
          ? `<div class="bc-sku-qr mono" style="font-size:9px;color:var(--text2);margin-top:2px">QR: ${_bcEsc(qrVal)}</div>`
          : '';
        const legacyLine = legacy
          ? `<div style="font-size:9px;color:var(--gold);margin-top:2px">Legacy row: QR may match SKU only.</div>`
          : '';
        return `
        <div class="bc-sku-row">
          <input type="checkbox" id="bc-chk-${i}" checked onchange="bcRenderPreview()">
          <div style="flex:1;min-width:0">
            <div class="bc-sku-code">${_bcEsc(sku)}</div>
            ${qrLine}${legacyLine}
            <div class="bc-sku-info">${_bcEsc(sk.ew_collection || '')} · ${_bcEsc(sk.colour_name || '')}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0">
            <span style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em">Qty</span>
            <input type="number" id="bc-qty-${i}" min="1" max="9999" value="${sk.quantity || 1}"
              style="width:52px;text-align:center;font-size:12px;padding:3px 4px"
              oninput="bcRenderPreview()">
            <span style="font-size:9px;color:var(--text2)">${sk.quantity || 0} stk</span>
          </div>
        </div>`;
      }).join('');
    }

    // Reset controls
    const copiesEl = document.getElementById('bc-copies');
    if (copiesEl) copiesEl.value = '';
    const typeEl = document.getElementById('bc-type');
    if (typeEl) typeEl.value = opts.defaultType || 'QR';
    const lockEl = document.getElementById('bc-lock-preset');
    // TSPL preset controls are hidden in the QR modal; keep lock off by default
    // so it doesn't disable margins/gaps while editing.
    if (lockEl && typeof lockEl.checked === 'boolean') lockEl.checked = false;
    if (typeof window.bcHandlePresetLockChange === 'function') window.bcHandlePresetLockChange();

    openM('modal-barcode-print');
    setTimeout(bcRenderPreview, 100); // wait for modal to render
  };

  // Select / deselect all checkboxes
  window.bcSelectAll = function(state) {
    _bcSkus.forEach((_, i) => {
      const chk = document.getElementById(`bc-chk-${i}`);
      if (chk) chk.checked = state;
    });
    bcRenderPreview();
  };

  // "Set All" — apply the global copies input to every visible row
  window.bcApplyGlobalQty = function() {
    const globalVal = parseInt(document.getElementById('bc-copies')?.value || '0', 10);
    if (!globalVal || globalVal < 1) return;
    _bcSkus.forEach((_, i) => {
      const qtyEl = document.getElementById(`bc-qty-${i}`);
      if (qtyEl) qtyEl.value = globalVal;
    });
    bcRenderPreview();
  };

  // "Reset to stock qty" — restore each row's qty to its unit quantity
  window.bcResetQty = function() {
    _bcSkus.forEach((sk, i) => {
      const qtyEl = document.getElementById(`bc-qty-${i}`);
      if (qtyEl) qtyEl.value = sk.quantity || 1;
    });
    bcRenderPreview();
  };

  function _bcSetInputValue(id, value) {
    const el = document.getElementById(id)
    if (!el) return
    el.value = String(value)
  }

  function _bcSetInputDisabled(id, disabled) {
    const el = document.getElementById(id)
    if (!el) return
    el.disabled = !!disabled
  }

  window.bcApply7030Preset = function() {
    // 15mm label with 70% QR block + 30% text block.
    _bcSetInputValue('bc-qr-cell-size', 3)
    _bcSetInputValue('bc-qr-visual-size-mm', 10.5)
    _bcSetInputValue('bc-qr-top-ratio', 0)
    _bcSetInputValue('bc-text-top-ratio', 0.70)
    _bcSetInputValue('bc-text-font-pt', 5)
    _bcSetInputValue('bc-text-x-mul', 2)
    _bcSetInputValue('bc-text-y-mul', 2)
    _bcSetInputValue('bc-text-font-id', 2)
    _bcSetInputValue('bc-label-width', 15)
    _bcSetInputValue('bc-label-height', 15)
    _bcSetInputValue('bc-labels-per-row', 6)
    _bcSetInputValue('bc-margin-left', 2)
    _bcSetInputValue('bc-margin-right', 2)
    _bcSetInputValue('bc-gap-col', 3)
    _bcSetInputValue('bc-gap-row', 3)
    bcRenderPreview()
  }

  window.bcHandlePresetLockChange = function() {
    const lock = document.getElementById('bc-lock-preset')?.checked === true
    const lockIds = [
      'bc-label-width',
      'bc-label-height',
      'bc-labels-per-row',
      'bc-margin-left',
      'bc-margin-right',
      'bc-gap-col',
      'bc-gap-row',
      'bc-qr-cell-size',
      'bc-qr-visual-size-mm',
      'bc-qr-top-ratio',
      'bc-text-top-ratio',
      'bc-text-x-mul',
      'bc-text-y-mul',
      'bc-text-font-id'
    ]

    lockIds.forEach((id) => _bcSetInputDisabled(id, lock))
  }

  // Build list of {code (pid for QR), label (sku_code for text), copies}
  function _bcSelectedItems() {
    const items = [];
    _bcSkus.forEach((sk, i) => {
      const chk = document.getElementById(`bc-chk-${i}`);
      if (!chk || !chk.checked) return;
      const copies = Math.max(1, parseInt(document.getElementById(`bc-qty-${i}`)?.value || '1', 10));
      const code = _bcQrPayload(sk);
      const label = sk.sku_code || '';
      items.push({ code, label, copies });
    });
    return items;
  }

  // Build a server-side QR image URL (always works — no client library needed)
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

  // Render the visual preview of labels in the modal
  window.bcRenderPreview = function() {
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
    const type  = document.getElementById('bc-type')?.value || 'QR';

    if (!items.length) {
      previewEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2);font-size:13px">No SKUs selected</div>';
      if (summaryEl) summaryEl.textContent = '';
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

        if (type === 'QR') {
          const errFontPt = Math.max(4, Math.round(textFontPt * 0.7))
          inner += `<div class="bc-label-cell" style="position:relative;width:${labelW}mm;height:${labelH}mm;padding:0;box-sizing:border-box">
            <img
              src="${_bcQRSrc(item.code, qrPreviewPx)}"
              style="position:absolute;left:50%;transform:translateX(-50%);top:${qrTopMm}mm;width:${qrVisualSizeMm}mm;height:${qrVisualSizeMm}mm;display:block"
              onerror="this.outerHTML='<div style=\\'width:${qrVisualSizeMm}mm;height:${qrVisualSizeMm}mm;background:#fef2f2;display:flex;align-items:center;justify-content:center;font-size:${errFontPt}pt;color:#ef4444\\'>QR ERR</div>'"
            >
            <div class="bc-label-code" style="position:absolute;left:0;right:0;top:${textTopMm}mm;font-size:${textFontPt}pt;font-weight:700;margin-top:0;padding:0;line-height:1.1;white-space:normal;word-break:break-word;overflow-wrap:anywhere;max-height:2.2em;overflow:hidden">${_bcEsc(item.label)}</div>
          </div>`;
        } else {
          const uid = `bc-svg-${Math.random().toString(36).slice(2)}`;
          inner += `<div class="bc-label-cell" style="position:relative;width:${labelW}mm;height:${labelH}mm;padding:0;box-sizing:border-box">
            <svg id="${uid}" data-code="${_bcEsc(item.code)}" xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:50%;transform:translateX(-50%);top:${qrTopMm}mm"></svg>
            <div class="bc-label-code" style="position:absolute;left:0;right:0;top:${textTopMm}mm;font-size:${textFontPt}pt;font-weight:700;margin-top:0;padding:0;line-height:1.1;white-space:normal;word-break:break-word;overflow-wrap:anywhere;max-height:2.2em;overflow:hidden">${_bcEsc(item.label)}</div>
          </div>`;
        }
      }
      inner += '</div>';
    });
    previewEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:${rowGapCss}">${inner}</div>`;

    // Render Code128 barcodes after DOM is updated
    if (type === 'CODE128' && typeof JsBarcode !== 'undefined') {
      previewEl.querySelectorAll('svg[data-code]').forEach((svgEl) => {
        const code = svgEl.getAttribute('data-code');
        if (!code) return;
        try {
          JsBarcode(svgEl, code, { format:'CODE128', width:1, height:36, displayValue:false, margin:0 });
          svgEl.style.cssText = 'max-width:64px;height:36px;display:block;margin:0 auto';
        } catch (e) {
          svgEl.innerHTML = `<text x="2" y="20" font-size="7" fill="red">ERR</text>`;
        }
      });
    }

    const totalLabels = expanded.length;
    const totalRows   = rows.length;
    if (summaryEl) {
      summaryEl.textContent = `${totalLabels} label${totalLabels !== 1 ? 's' : ''} · ${totalRows} row${totalRows !== 1 ? 's' : ''} of ${cols} · ${items.length} unique SKU${items.length !== 1 ? 's' : ''}`;
    }
  };

  // ── WebUSB: Connect to TSC P210 ────────────────────────────────────────
  window.bcConnectPrinter = async function() {
    if (!navigator.usb) {
      alert('WebUSB is not supported in this browser.\nPlease use Google Chrome or Microsoft Edge.');
      return;
    }
    try {
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
      null:        ['#ccc',  'Printer not connected'],
      connecting:  ['#f59e0b','Connecting…'],
      connected:   ['#10b981', `Connected: ${msg}`],
      error:       ['#ef4444', `Error: ${msg}`],
    };
    const [color, label] = map[state] || map[null];
    dot.style.background = color;
    text.textContent = label;
  }

  // ── TSPL2 Command Generator ────────────────────────────────────────────
  function _bcReadMarginsMm() {
    const clip = (v) => Math.max(0, Math.min(20, v));
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
    const rowRaw = parseFloat(elRow?.value ?? '3');
    const colRaw = parseFloat(elCol?.value ?? '3');
    const rowGap = Math.max(0, Math.min(10, Number.isFinite(rowRaw) ? rowRaw : 2));
    const colGap = Math.max(0, Math.min(5, Number.isFinite(colRaw) ? colRaw : 0));
    return { rowGap, colGap };
  }

  function _bcMarginsToDots(dotsPerMm) {
    const m = _bcReadMarginsMm();
    return {
      top: Math.round(m.top * dotsPerMm),
      bottom: Math.round(m.bottom * dotsPerMm),
      left: Math.round(m.left * dotsPerMm),
      right: Math.round(m.right * dotsPerMm),
    };
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
    const d = _bcMarginsToDots(dotsPerMm);
    const { rowGap, colGap } = _bcReadGapMm();

    const mmToDot = (mm) => Math.round(mm * dotsPerMm);
    const sheetWidthMm = marginsMm.left + (cols * labelW) + ((cols - 1) * colGap) + marginsMm.right;
    const maxXDots = mmToDot(sheetWidthMm);

    const { qrCellSize, qrVisualSizeMm, qrTopRatio } = _bcReadQrConfig();
    const { textTopRatio, textXMul, textYMul, textFontId } = _bcReadTextConfig();

    const contentH = Math.max(0, labelH - marginsMm.top - marginsMm.bottom);
    const qrTopMm = marginsMm.top + qrTopRatio * contentH;
    const textTopMm = marginsMm.top + textTopRatio * contentH;

    const qrTopDots = mmToDot(qrTopMm);
    const textTopDots = mmToDot(textTopMm);
    const textLineGapDots = Math.max(8, Math.round(2.2 * dotsPerMm * Math.max(1, textYMul)));

    const qrLeftInsetDots = mmToDot(qrLeftInsetMm);
    let cmds = '';

    labelBatches.forEach((row) => {
      cmds += `SIZE ${sheetWidthMm} mm, ${labelH} mm\r\n`;
      cmds += `GAP ${rowGap} mm, 0 mm\r\n`;
      cmds += 'DIRECTION 0\r\n';
      cmds += 'CLS\r\n';

      row.forEach((item, col) => {
        if (!item) return;

        const cellLeftXmm = marginsMm.left + (col * (labelW + colGap));
        let x = mmToDot(cellLeftXmm) + qrLeftInsetDots;
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

  // ── Print via WebUSB ──────────────────────────────────────────────────
  window.bcPrint = async function() {
    const items    = _bcSelectedItems();
    const type     = document.getElementById('bc-type')?.value || 'QR';
    const printBtn = document.getElementById('bc-print-btn');

    if (!items.length) { alert('Please select at least one SKU to print.'); return; }

    // Expand by copies — each entry is {code: pid, label: sku_code}
    const expanded = [];
    items.forEach(({ code, label, copies }) => { for (let c = 0; c < copies; c++) expanded.push({ code, label }); });

    const { cols } = _bcReadLabelGeometryMm();

    // Batch into roll rows of `cols`
    const batches = [];
    for (let i = 0; i < expanded.length; i += cols) batches.push(expanded.slice(i, i + cols));

    if (!_bcUsbDevice) {
      // Fallback: generate printable HTML window if no USB device
      _bcPrintFallback(batches, type);
      return;
    }

    try {
      if (printBtn) { printBtn.disabled = true; printBtn.textContent = '⏳ Sending to printer…'; }

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

      const data = _bcGenerateTSPL2(batches, type);
      await _bcUsbDevice.transferOut(endpointNumber, data);

      if (printBtn) { printBtn.disabled = false; printBtn.textContent = '🖨️ Print Labels'; }
      alert(`✅ Sent ${expanded.length} label${expanded.length !== 1 ? 's' : ''} to printer successfully.`);
    } catch (err) {
      if (printBtn) { printBtn.disabled = false; printBtn.textContent = '🖨️ Print Labels'; }
      _bcUpdatePrinterStatus('error', err.message);
      alert(`Print failed: ${err.message}\n\nFalling back to browser print…`);
      _bcPrintFallback(batches, type);
    }
  };

  // ── Browser-print fallback (generates printable HTML) ─────────────────
  function _bcPrintFallback(batches, labelType) {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Pop-up blocked. Please allow pop-ups and try again.'); return; }

    const pad = _bcReadMarginsMm();
    const gp = _bcReadGapMm();
    const { labelW, labelH, cols } = _bcReadLabelGeometryMm();
    const dotsPerMm = _bcReadDotsPerMm();
    const { qrVisualSizeMm, qrTopRatio } = _bcReadQrConfig();
    const { textTopRatio, textFontPt } = _bcReadTextConfig();

    const contentH = Math.max(0, labelH - pad.top - pad.bottom);
    const qrTopMm = pad.top + qrTopRatio * contentH;
    const textTopMm = pad.top + textTopRatio * contentH;
    const qrLeftInsetMm = Math.max(0, (labelW - qrVisualSizeMm) / 2);
    const qrPreviewPx = _bcClamp(Math.round(qrVisualSizeMm * dotsPerMm), 40, 400);

    // Treat top/bottom as internal offsets (handled via absolute positioning inside each cell).
    // Left/right still acts as sheet padding.
    const sheetPad = `0mm ${pad.right}mm 0mm ${pad.left}mm`;
    const tableSpacing = `${gp.colGap}mm ${gp.rowGap}mm`;

    const isQR = labelType === 'QR';
    const totalLabels = batches.reduce((s, r) => s + r.filter(Boolean).length, 0);
    // Use absolute URL so the print window (different origin) can reach our server
    const origin = window.location.origin;

    let labelRows = '';
    batches.forEach((row) => {
      const cells = [];
      for (let col = 0; col < cols; col++) {
        const item = row[col];
        if (!item || !item.code) { cells.push('<td class="empty"></td>'); continue; }
        if (isQR) {
          // QR encodes pid (code); SKU (label) shown as human-readable text below
          const src = `${origin}/api/qr?data=${encodeURIComponent(item.code)}&size=${qrPreviewPx}`;
          cells.push(`<td class="label-cell"><img src="${src}" class="qr-img"><div class="bc-txt">${_bcEsc(item.label)}</div></td>`);
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

  // ─────────────────────────────────────────────────────────────────────────
  // STOCK TRANSFER MODULE
  // Mobile-first, QR-scan-or-search driven HQ → Store stock transfer.
  // Lives inside DOMContentLoaded so apiGet / apiPost / token are in scope.
  // ─────────────────────────────────────────────────────────────────────────
  {
    let _cart        = [];
    let _scanner     = null;
    /** True only after Html5Qrcode.start() has resolved — never call stop() before this. */
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
          const stype = String(s.store_type || '').trim().toUpperCase();
          if (stype === 'HQ') continue;
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
            'No destination stores available. Ensure at least one active non-HQ store exists in Command Unit.',
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
    function stAddToCart(sku) {
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
          sku_id:        sku.sku_id,
          sku_code:      sku.sku_code,
          product_name:  sku.product_name,
          brand_name:    sku.brand_name  || '—',
          colour_name:   sku.colour_name || '—',
          warehouse_qty: Number(sku.warehouse_qty) || 0,
          qty:           1
        });
        stToast(`Added · ${sku.sku_code}`, '#16a34a');
      }
      stRenderCart();
    }

    window.stChangeQty = function stChangeQty(skuId, delta) {
      const item = _cart.find((r) => r.sku_id === skuId);
      if (!item) return;
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

    window.stRemoveFromCart = function stRemoveFromCart(skuId) {
      _cart = _cart.filter((r) => r.sku_id !== skuId);
      stRenderCart();
    };

    window.stClearCart = function stClearCart() {
      _cart = [];
      stRenderCart();
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
      if (_cart.length === 0) {
        body.innerHTML = `<div class="st-empty-cart"><div style="font-size:36px;margin-bottom:8px">🛒</div><div>No items added yet — scan or search SKUs to start</div></div>`;
        return;
      }
      body.innerHTML = _cart.map((r) => `
        <div class="st-cart-row">
          <div style="flex:1;min-width:0">
            <div class="mono" style="font-size:12px;font-weight:700;color:var(--acc2)">${stEsc(r.sku_code)}</div>
            <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${stEsc(r.product_name)}</div>
            <div style="font-size:11.5px;color:var(--text3)">${stEsc(r.brand_name)} · ${stEsc(r.colour_name)}</div>
            <div style="font-size:11px;color:var(--text3)">HQ stock: <strong>${r.warehouse_qty}</strong></div>
          </div>
          <div class="st-cart-qty">
            <button class="st-qty-btn" onclick="stChangeQty(${r.sku_id}, -1)">−</button>
            <span class="st-qty-val">${r.qty}</span>
            <button class="st-qty-btn" onclick="stChangeQty(${r.sku_id}, 1)">+</button>
          </div>
          <button class="st-remove-btn" onclick="stRemoveFromCart(${r.sku_id})" title="Remove">✕</button>
        </div>`).join('');
    }

    // ── Camera scanner ────────────────────────────────────────────────────────
    function stResetCameraUi() {
      const btn = document.getElementById('st-cam-btn');
      if (btn) btn.textContent = '📷 Scan QR';
      const container = document.getElementById('st-scan-container');
      if (container) container.style.display = 'none';
      const overlay = document.getElementById('st-scan-overlay');
      if (overlay) overlay.style.display = '';
    }

    window.stToggleCamera = function stToggleCamera() {
      const container = document.getElementById('st-scan-container');
      if (!container) return;
      if (_scanRunning || _scanner) {
        window.stStopCamera();
        return;
      }
      container.style.display = '';
      const overlay = document.getElementById('st-scan-overlay');
      if (overlay) overlay.style.display = 'none';
      if (!window.Html5Qrcode) {
        stToast('QR scanner library not loaded', '#e53e3e');
        return;
      }
      const btn = document.getElementById('st-cam-btn');
      if (btn) btn.textContent = '⏳ Starting…';
      const reader = new Html5Qrcode('st-reader');
      _scanner = reader;
      _scanRunning = false;
      Html5Qrcode.getCameras()
        .then((devices) => {
          if (_scanner !== reader) return Promise.resolve();
          const cam = devices.find((d) => /back|rear|environment/i.test(d.label)) || devices[devices.length - 1];
          const camId = cam ? cam.id : { facingMode: 'environment' };
          return reader.start(
            camId,
            { fps: 10, qrbox: { width: 220, height: 220 } },
            (decodedText) => stOnScanSuccess(decodedText),
            () => {}
          );
        })
        .then(() => {
          if (_scanner !== reader) return;
          _scanRunning = true;
          if (btn) btn.textContent = '⏹ Stop Camera';
        })
        .catch((err) => {
          stToast('Camera error: ' + (err && err.message ? err.message : err), '#e53e3e');
          window.stStopCamera();
        });
    };

    window.stStopCamera = function stStopCamera() {
      const snap = _scanner;
      _scanner = null;
      _scanRunning = false;
      stResetCameraUi();
      if (!snap) return;
      const afterStop = () => {
        try {
          if (typeof snap.clear === 'function') snap.clear();
        } catch (_) { /* ignore */ }
      };
      Promise.resolve(snap.stop())
        .catch((e) => {
          const m = String((e && e.message) || e || '');
          if (!/not running|not paused|Cannot stop/i.test(m)) console.warn('[st QR] stop:', e);
        })
        .finally(afterStop);
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
    /** QR / wedge scan: trim; if payload is a URL, use ?sku= / ?code= or last path segment for lookup. */
    function stNormalizeScanPayload(raw) {
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
    }

    async function stLookupAndAdd(code) {
      const key = stNormalizeScanPayload(code);
      if (!key) return;
      try {
        const sku = await apiGet(`/api/stock-transfers/lookup?q=${encodeURIComponent(key)}`);
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

    // ── Submit transfer ────────────────────────────────────────────────────────
    window.stSubmitTransfer = async function stSubmitTransfer() {
      const storeId = document.getElementById('st-store-sel').value;
      const notes   = (document.getElementById('st-notes').value || '').trim();
      if (!storeId) { stToast('Please select a destination store', '#e53e3e'); return; }
      if (!_cart.length) { stToast('Cart is empty', '#e53e3e'); return; }
      const btn = document.querySelector('#st-submit-row button');
      if (btn) { btn.disabled = true; btn.textContent = '⏳ Transferring…'; }
      try {
        const resp = await apiPost('/api/stock-transfer-docs', {
          to_store_id: Number(storeId),
          lines: _cart.map((r) => ({ sku_id: r.sku_id, qty: r.qty })),
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

    // ── History ────────────────────────────────────────────────────────────────
    window.stLoadHistory = async function stLoadHistory() {
      const tbody = document.getElementById('st-history-tbody');
      if (!tbody) return;
      tbody.innerHTML = `<tr><td colspan="8" class="tc td2 p12">Loading…</td></tr>`;
      try {
        const rows = await apiGet('/api/stock-transfers/history?top_n=50');
        if (!rows || !rows.length) {
          tbody.innerHTML = `<tr><td colspan="8" class="tc td2 p12">No transfers yet</td></tr>`;
          return;
        }
        tbody.innerHTML = rows.map((r) => `<tr>
          <td class="xs td2" style="white-space:nowrap">${stFmtDate(r.created_at)}</td>
          <td class="mono xs fw6">${stEsc(r.sku_code)}</td>
          <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${stEsc(r.product_name)}</td>
          <td>${stEsc(r.brand_name || '—')}</td>
          <td>${stEsc(r.colour_name || '—')}</td>
          <td class="tc fw6" style="color:var(--acc2)">${r.qty}</td>
          <td style="white-space:nowrap">${stEsc(r.to_store_name || '—')}</td>
          <td class="xs td2">${stEsc(r.transferred_by || '—')}</td>
        </tr>`).join('');
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="tc td2 p12" style="color:var(--red)">${stEsc(err.message)}</td></tr>`;
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSFER REQUESTS  (PRD §8.3 — store-to-HQ lifecycle)
  // ═══════════════════════════════════════════════════════════════════════════

  const TR_STATUS_BADGE = {
    SUBMITTED:  'b-gold',
    APPROVED:   'b-blue',
    DISPATCHED: 'b-orange',
    RECEIVED:   'b-green',
    REJECTED:   'b-red'
  };

  function trEsc(s) {
    return String(s == null ? '—' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  let _trFilter    = '';
  let _trExpanded  = null;
  let _ftrDispatchSearchResults = [];

  window.setTrFilter = function (status, btn) {
    _trFilter = status;
    document.querySelectorAll('#page-transfer-requests .btn.sm[id^="ftr-tab-"]').forEach((b) => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    loadTransferRequests();
  };

  window.loadTransferRequests = async function () {
    const wrap  = document.getElementById('ftr-list-wrap');
    const errEl = document.getElementById('ftr-err');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (wrap)  wrap.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)">Loading…</div>';

    try {
      const qs = new URLSearchParams({ top_n: 100 });
      if (_trFilter) qs.set('status', _trFilter);
      const rows = await apiGet('/api/transfer-requests?' + qs.toString());

      // Update nav badge with pending count
      const pending = rows.filter((r) => r.status === 'SUBMITTED').length;
      const badge   = document.getElementById('tr-nav-badge');
      if (badge) {
        badge.textContent = pending || '';
        badge.style.display = pending ? '' : 'none';
      }

      if (!rows.length) {
        wrap.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)">No transfer requests</div>';
        return;
      }

      wrap.innerHTML = `
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Store</th><th>Requested by</th>
                <th>Date</th><th>Items</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((r) => `
                <tr style="cursor:pointer" onclick="expandTrRequest(${r.request_id})">
                  <td class="mono fw6" style="color:var(--acc)">#${r.request_id}</td>
                  <td>${trEsc(r.store_name || r.store_id)}</td>
                  <td>${trEsc(r.requested_by_fullname || r.requested_by_name)}</td>
                  <td class="xs">${fmtDate(r.created_at)}</td>
                  <td><span class="b b-gray">${r.line_count} SKU${r.line_count !== 1 ? 's' : ''}</span></td>
                  <td><span class="b ${TR_STATUS_BADGE[r.status] || 'b-gray'}">${r.status}</span></td>
                  <td>
                    ${r.status === 'SUBMITTED' ? `
                      <button class="btn sm primary" onclick="event.stopPropagation();trQuickApprove(${r.request_id})">✓ Approve</button>
                      <button class="btn sm" style="color:var(--red);border-color:var(--red);margin-left:4px" onclick="event.stopPropagation();trReject(${r.request_id})">✕ Reject</button>
                    ` : ''}
                    ${r.status === 'APPROVED' ? `
                      <button class="btn sm primary" onclick="event.stopPropagation();expandTrRequest(${r.request_id})">🚚 Preview &amp; Dispatch</button>
                    ` : ''}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (err) {
      if (errEl) { errEl.textContent = 'Failed to load: ' + err.message; errEl.style.display = 'block'; }
      if (wrap)  wrap.innerHTML = '';
    }
  };

  window.expandTrRequest = async function (requestId) {
    const card  = document.getElementById('ftr-detail-card');
    const body  = document.getElementById('ftr-detail-body');
    const title = document.getElementById('ftr-detail-title');
    if (!card) return;

    // If the mobile sidebar overlay is left open, it can hide the topbar/hamburger.
    // Also, Chrome mobile can behave badly with sticky headers when we auto-scroll.
    const overlayEl = document.getElementById('fy-sidebar-overlay')
    const sidebarEl = document.querySelector('.sidebar')
    const isSidebarOpen = !!(sidebarEl && sidebarEl.classList.contains('open'))
    const isOverlayOpen = !!(overlayEl && overlayEl.classList.contains('open'))
    const isBodyLocked = document.body.style.overflow === 'hidden'
    if (isSidebarOpen || isOverlayOpen || isBodyLocked) closeSidebar()

    if (title) title.textContent = `Request #${requestId}`;
    if (body)  body.innerHTML = '<div style="padding:16px;color:var(--text3)">Loading…</div>';
    card.style.display = '';
    const ua = navigator.userAgent || ''
    const isChromeLike = (/Chrome\//i.test(ua) || /CriOS\//i.test(ua)) && !(/Edg\//i.test(ua) || /OPR\//i.test(ua))
    if (!isChromeLike) card.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      const req  = await apiGet(`/api/transfer-requests/${requestId}`);
      _trExpanded = req;

      const canApprove  = req.status === 'SUBMITTED';
      const canDispatch = req.status === 'APPROVED';

      const inpStyle = 'width:64px;padding:4px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:12px;text-align:center;outline:none';

      const linesHtmlReadonly = (req.lines || []).map((l) => `
        <tr>
          <td class="mono xs">${trEsc(l.sku_code)}</td>
          <td>${trEsc(l.description || '')}</td>
          <td>${trEsc(l.brand_name  || '')}</td>
          <td style="text-align:right"><span class="b b-gray">${l.requested_qty}</span></td>
          <td style="text-align:right">${l.approved_qty   != null ? `<span class="b b-blue">${l.approved_qty}</span>`    : '<span style="color:var(--text3)">—</span>'}</td>
          <td style="text-align:right">${l.dispatched_qty != null ? `<span class="b b-orange">${l.dispatched_qty}</span>` : '<span style="color:var(--text3)">—</span>'}</td>
          <td style="text-align:right">${l.received_qty   != null ? `<span class="b b-green">${l.received_qty}</span>`   : '<span style="color:var(--text3)">—</span>'}</td>
        </tr>`).join('');

      const linesHtmlApprove = (req.lines || []).map((l) => `
        <tr>
          <td class="mono xs">${trEsc(l.sku_code)}</td>
          <td>${trEsc(l.description || '')}</td>
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

      const linesHtmlDispatch = (req.lines || []).map((l) => {
        const defDisp = (l.approved_qty != null && l.approved_qty > 0) ? l.approved_qty : l.requested_qty;
        return `
        <tr class="ftr-dispatch-req-row" data-line-id="${l.line_id}">
          <td class="mono xs">${trEsc(l.sku_code)}</td>
          <td>${trEsc(l.description || '')}</td>
          <td>${trEsc(l.brand_name  || '')}</td>
          <td style="text-align:right"><span class="b b-gray">${l.requested_qty}</span></td>
          <td style="text-align:right">${l.approved_qty != null ? `<span class="b b-blue">${l.approved_qty}</span>` : '<span style="color:var(--text3)">—</span>'}</td>
          <td style="text-align:right">
            <input type="number" class="ftr-dispatch-qty" min="0" value="${defDisp}" style="${inpStyle}" onclick="event.stopPropagation()">
          </td>
          <td>
            <button type="button" class="btn sm" onclick="event.stopPropagation();this.closest('tr').remove()">Remove</button>
          </td>
        </tr>`;
      }).join('');

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
                  <th style="text-align:right">Received</th>
                  <th style="min-width:80px">Set approved qty</th>
                </tr>
              </thead>
              <tbody>${linesHtmlApprove}</tbody>
            </table>
          </div>`;
      } else if (canDispatch) {
        tableBlock = `
          <div class="hint" style="margin-bottom:14px">
            <strong>Goods Transfer preview:</strong> Adjust dispatch quantities, remove lines, or add warehouse SKUs. Confirming creates a transfer document (warehouse decremented now; store accepts then verifies under Incoming Goods).
          </div>
          <div class="tw mb3">
            <table>
              <thead>
                <tr>
                  <th>SKU</th><th>Description</th><th>Brand</th>
                  <th style="text-align:right">Requested</th>
                  <th style="text-align:right">Approved</th>
                  <th style="text-align:right">Dispatch qty</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>${linesHtmlDispatch}</tbody>
              <tbody id="ftr-dispatch-extra-tbody"></tbody>
            </table>
          </div>
          <div style="margin-bottom:16px;padding:14px;background:var(--bg2);border-radius:8px;border:1px solid var(--border)">
            <div style="font-weight:600;margin-bottom:8px;font-size:13px">Add item from HQ Warehouse</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <input type="text" id="ftr-dispatch-search" placeholder="SKU code or keyword…"
                style="flex:1;min-width:180px;max-width:320px;padding:7px 11px;border:1.5px solid var(--border);border-radius:7px;font-size:13px;outline:none"
                onclick="event.stopPropagation()" onkeydown="if(event.key==='Enter'){event.preventDefault();ftrDispatchSearch();}">
              <button type="button" class="btn sm" onclick="event.stopPropagation();ftrDispatchSearch()">Search</button>
            </div>
            <div id="ftr-dispatch-search-results" style="display:none;margin-top:10px;border:1px solid var(--border);border-radius:6px;max-height:220px;overflow:auto;background:var(--bg)"></div>
          </div>`;
      } else {
        tableBlock = `
          <div class="tw mb4">
            <table>
              <thead>
                <tr>
                  <th>SKU</th><th>Description</th><th>Brand</th>
                  <th style="text-align:right">Requested</th>
                  <th style="text-align:right">Approved</th>
                  <th style="text-align:right">Dispatched</th>
                  <th style="text-align:right">Received</th>
                </tr>
              </thead>
              <tbody>${linesHtmlReadonly}</tbody>
            </table>
          </div>`;
      }

      body.innerHTML = `
        <div style="padding:16px 20px">
          <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
            <span class="b ${TR_STATUS_BADGE[req.status] || 'b-gray'}">${req.status}</span>
            <span class="xs" style="color:var(--text2)">Store: <strong>${trEsc(req.store_name || req.store_id)}</strong></span>
            <span class="xs" style="color:var(--text2)">By: <strong>${trEsc(req.requested_by_fullname || req.requested_by_name)}</strong></span>
            <span class="xs" style="color:var(--text2)">Submitted: ${fmtDate(req.created_at)}</span>
            ${req.notes ? `<span class="xs" style="color:var(--text2)">Notes: <em>${trEsc(req.notes)}</em></span>` : ''}
            ${req.review_notes ? `<span class="xs" style="color:var(--text2)">Review note: <em>${trEsc(req.review_notes)}</em></span>` : ''}
          </div>

          ${tableBlock}

          ${canApprove ? `
            <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
              <div>
                <label style="font-size:11.5px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block;text-transform:uppercase;letter-spacing:.5px">Review note (optional)</label>
                <input type="text" id="ftr-review-note" placeholder="Note to store manager…"
                  style="width:260px;padding:7px 11px;border:1.5px solid var(--border);border-radius:7px;font-size:13px;outline:none"
                  onclick="event.stopPropagation()">
              </div>
              <button class="btn primary" onclick="trApproveFromDetail(${req.request_id})">✓ Approve request</button>
              <button class="btn sm" style="color:var(--red);border-color:var(--red)" onclick="trReject(${req.request_id})">✕ Reject</button>
              <span id="ftr-detail-msg" style="font-size:12px;min-height:16px"></span>
            </div>
          ` : ''}
          ${canDispatch ? `
            <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-start">
              <div>
                <label style="font-size:11.5px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block;text-transform:uppercase;letter-spacing:.5px">Note on transfer document (optional)</label>
                <input type="text" id="ftr-dispatch-note" placeholder="Shown on Goods Transfer…"
                  style="width:min(100%,400px);padding:7px 11px;border:1.5px solid var(--border);border-radius:7px;font-size:13px;outline:none"
                  onclick="event.stopPropagation()">
              </div>
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                <button type="button" class="btn primary" id="ftr-dispatch-confirm-btn" onclick="trDispatchConfirm(${req.request_id})">✓ Confirm dispatch (create Goods Transfer)</button>
                <span id="ftr-detail-msg" style="font-size:12px;min-height:16px"></span>
              </div>
            </div>
          ` : ''}
        </div>`;
    } catch (err) {
      if (body) body.innerHTML = `<div style="padding:16px;color:var(--red)">Error: ${trEsc(err.message)}</div>`;
    }
  };

  window.closeTrDetail = function () {
    const card = document.getElementById('ftr-detail-card');
    if (card) card.style.display = 'none';
    _trExpanded = null;

    // Clear any accidental sidebar overlay/body lock state.
    const overlayEl = document.getElementById('fy-sidebar-overlay')
    const sidebarEl = document.querySelector('.sidebar')
    const isSidebarOpen = !!(sidebarEl && sidebarEl.classList.contains('open'))
    const isOverlayOpen = !!(overlayEl && overlayEl.classList.contains('open'))
    const isBodyLocked = document.body.style.overflow === 'hidden'
    if (isSidebarOpen || isOverlayOpen || isBodyLocked) closeSidebar()
  };

  // Quick approve from the list row (no qty adjustment)
  window.trQuickApprove = async function (requestId) {
    if (!confirm(`Approve transfer request #${requestId} with the requested quantities?`)) return;
    try {
      await apiPut(`/api/transfer-requests/${requestId}/status`, { status: 'APPROVED' });
      loadTransferRequests();
      closeTrDetail();
    } catch (err) { alert('Error: ' + err.message); }
  };

  // Approve from the detail panel (with per-line qty editing)
  window.trApproveFromDetail = async function (requestId) {
    const lines = [];
    document.querySelectorAll('.ftr-approve-qty').forEach((inp) => {
      lines.push({ line_id: Number(inp.dataset.lineId), approved_qty: Math.max(0, Number(inp.value) || 0) });
    });
    const note  = (document.getElementById('ftr-review-note') || {}).value || null;
    const msgEl = document.getElementById('ftr-detail-msg');
    try {
      await apiPut(`/api/transfer-requests/${requestId}/status`, { status: 'APPROVED', lines, notes: note || null });
      if (msgEl) { msgEl.style.color = 'var(--green)'; msgEl.textContent = '✓ Approved.'; }
      setTimeout(() => { loadTransferRequests(); closeTrDetail(); }, 900);
    } catch (err) {
      if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Error: ' + err.message; }
    }
  };

  window.trReject = async function (requestId) {
    const note = prompt(`Reason for rejecting request #${requestId} (shown to store manager):`);
    if (note === null) return; // cancelled
    try {
      await apiPut(`/api/transfer-requests/${requestId}/status`, { status: 'REJECTED', notes: note || null });
      loadTransferRequests();
      closeTrDetail();
    } catch (err) { alert('Error: ' + err.message); }
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
    const r = _ftrDispatchSearchResults[index];
    if (!r || !r.sku_id) return;
    const tbody = document.getElementById('ftr-dispatch-extra-tbody');
    const resEl = document.getElementById('ftr-dispatch-search-results');
    const inpS  = document.getElementById('ftr-dispatch-search');
    if (resEl) { resEl.innerHTML = ''; resEl.style.display = 'none'; }
    if (inpS) inpS.value = '';
    if (!tbody) return;
    const wh = Math.max(0, Number(r.warehouse_qty) || 0);
    const existing = tbody.querySelector(`tr.ftr-dispatch-extra-row[data-sku-id="${r.sku_id}"]`);
    if (existing) {
      const qInp = existing.querySelector('.ftr-dispatch-extra-qty');
      if (qInp) {
        const cap = wh || 999999;
        const n   = Math.min(cap, Math.max(1, Number(qInp.value) + 1));
        qInp.value = n;
      }
      return;
    }
    const tr = document.createElement('tr');
    tr.className = 'ftr-dispatch-extra-row';
    tr.dataset.skuId = String(r.sku_id);
    const cap = wh || 999999;
    tr.innerHTML = `
      <td class="mono xs">${trEsc(r.sku_code)}</td>
      <td colspan="2" style="font-size:12.5px">${trEsc(r.product_name || '')} · ${trEsc(r.colour_name || '')} <span style="font-size:10px;color:var(--text3)">(added)</span></td>
      <td style="text-align:center;color:var(--text3)">—</td>
      <td style="text-align:center;color:var(--text3)">—</td>
      <td style="text-align:right">
        <input type="number" class="ftr-dispatch-extra-qty" min="1" max="${cap}" value="1" style="width:64px;padding:4px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:12px;text-align:center;outline:none" onclick="event.stopPropagation()">
      </td>
      <td><button type="button" class="btn sm" onclick="event.stopPropagation();this.closest('tr').remove()">Remove</button></td>`;
    tbody.appendChild(tr);
  };

  window.ftrAfterDispatchNav = function () {
    const navEl = document.querySelector('.sidebar-nav .nav-item[onclick*="movement-list"]');
    if (typeof nav === 'function') nav('movement-list', navEl || null);
    if (typeof loadMovementList === 'function') loadMovementList();
    closeTrDetail();
  };

  window.trDispatchConfirm = async function (requestId) {
    const msgEl = document.getElementById('ftr-detail-msg');
    const btn   = document.getElementById('ftr-dispatch-confirm-btn');
    if (msgEl) { msgEl.textContent = ''; msgEl.style.color = ''; }

    const lines = [];
    document.querySelectorAll('#ftr-detail-body .ftr-dispatch-req-row').forEach((tr) => {
      const lid = tr.dataset.lineId;
      const inp = tr.querySelector('.ftr-dispatch-qty');
      const q   = Math.max(0, Number(inp && inp.value) || 0);
      lines.push({ line_id: Number(lid), dispatched_qty: q });
    });

    const extra_lines = [];
    document.querySelectorAll('#ftr-detail-body .ftr-dispatch-extra-row').forEach((tr) => {
      const skuId = Number(tr.dataset.skuId);
      const inp   = tr.querySelector('.ftr-dispatch-extra-qty');
      const q     = Math.max(0, Number(inp && inp.value) || 0);
      if (q > 0 && skuId) extra_lines.push({ sku_id: skuId, qty: q });
    });

    const hasReqLine = lines.some((l) => l.dispatched_qty > 0);
    if (!hasReqLine && !extra_lines.length) {
      if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Set a dispatch quantity on at least one request line, or add an item from warehouse.'; }
      return;
    }

    const notes = ((document.getElementById('ftr-dispatch-note') || {}).value || '').trim() || null;
    const payload = { status: 'DISPATCHED', lines, notes };
    if (extra_lines.length) payload.extra_lines = extra_lines;

    if (btn) { btn.disabled = true; btn.textContent = 'Dispatching…'; }
    try {
      const data  = await apiPut(`/api/transfer-requests/${requestId}/status`, payload);
      const docId = data.doc_id;
      loadTransferRequests();
      const body = document.getElementById('ftr-detail-body');
      if (body) {
        body.innerHTML = `
          <div style="padding:20px 22px">
            <div style="color:var(--green);font-weight:700;font-size:15px;margin-bottom:10px">Goods Transfer created</div>
            <p style="margin:0 0 8px;font-size:13px;color:var(--text2)">Transfer document <strong class="mono">#${docId != null ? docId : '—'}</strong> is <strong>Dispatched</strong>. HQ Warehouse stock has been decremented.</p>
            <p style="margin:0 0 16px;font-size:13px;color:var(--text2)">The store will see it under <strong>Incoming Goods</strong>, then <strong>Accept</strong> and <strong>Verify &amp; Stock</strong> to credit store balance.</p>
            <button type="button" class="btn primary" onclick="ftrAfterDispatchNav()">Open Movement List</button>
          </div>`;
      }
    } catch (err) {
      if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = err.message; }
      if (btn) { btn.disabled = false; btn.textContent = '✓ Confirm dispatch (create Goods Transfer)'; }
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
  let _mlFilter = '';
  let _mlSearch = '';
  let _mlDocsCache = [];

  window.setMlFilter = function (status, btn) {
    _mlFilter = status;
    document.querySelectorAll('#page-movement-list .btn.sm[id^="ml-tab-"]').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    loadMovementList();
  };

  function mlStatusBadge(s) {
    const map = { DISPATCHED:'<span class="badge blue">Dispatched</span>', ACCEPTED:'<span class="badge gold">Accepted</span>', STOCKED:'<span class="badge green">Stocked</span>' };
    return map[s] || `<span class="badge">${s}</span>`;
  }

  function filterMovementDocs(docs, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => {
      const hay = [
        d.doc_id,
        d.doc_type,
        d.source_request_id,
        d.store_name,
        d.to_store_id,
        d.status
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  function renderMovementList(docs) {
    const wrap = document.getElementById('ml-list');
    if (!wrap) return;

    const filtered = filterMovementDocs(docs, _mlSearch);
    const toolbarHtml = `
      <div class="ml-toolbar">
        <input id="ml-search" class="ml-search" placeholder="Search doc id, store, type, status..." value="${trEsc(_mlSearch)}">
        <div class="ml-count">${filtered.length} document${filtered.length !== 1 ? 's' : ''}</div>
      </div>`;

    if (!docs.length) {
      wrap.innerHTML = `${toolbarHtml}<div class="empty-state"><div class="ei">📋</div><div class="et">No transfer documents found</div><div class="es">Dispatch a Goods Transfer to see records here.</div></div>`;
    } else if (!filtered.length) {
      wrap.innerHTML = `${toolbarHtml}<div class="empty-state"><div class="ei">🔎</div><div class="et">No matching movement documents</div><div class="es">Try a different search term.</div></div>`;
    } else {
      wrap.innerHTML = `${toolbarHtml}<div class="ml-rows" id="ml-rows">
        ${filtered.map(d => `
          <div class="ml-row-dense" onclick="expandMlDoc(${d.doc_id})">
            <div style="flex:1;min-width:0">
              <div class="ml-pri">Doc #${d.doc_id} — ${d.doc_type === 'DIRECT' ? 'Goods Transfer' : 'From Request #' + d.source_request_id}</div>
              <div class="ml-sec">To ${trEsc(d.store_name || 'Store #' + d.to_store_id)} · ${fmtDateTime(d.dispatched_at)}</div>
            </div>
            <div>${mlStatusBadge(d.status)}</div>
          </div>`).join('')}
      </div>`;
    }

    const searchEl = document.getElementById('ml-search');
    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        _mlSearch = e.target.value || '';
        renderMovementList(_mlDocsCache);
      });
    }
  }

  window.closeMlDetail = function () {
    const d = document.getElementById('ml-detail');
    if (d) d.style.display = 'none';

    // On mobile, the hamburger is controlled by the off-canvas sidebar overlay.
    // If it's still open when Doc Details closes, it can hide the topbar/hamburger.
    const overlayEl = document.getElementById('fy-sidebar-overlay')
    const sidebarEl = document.querySelector('.sidebar')
    const isSidebarOpen = !!(sidebarEl && sidebarEl.classList.contains('open'))
    const isOverlayOpen = !!(overlayEl && overlayEl.classList.contains('open'))
    const isBodyLocked = document.body.style.overflow === 'hidden'
    if (isSidebarOpen || isOverlayOpen || isBodyLocked) closeSidebar()
  };

  window.loadMovementList = async function () {
    const wrap  = document.getElementById('ml-list');
    const errEl = document.getElementById('ml-err');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (wrap)  wrap.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)">Loading…</div>';
    closeMlDetail();
    try {
      const qs   = _mlFilter ? `?status=${_mlFilter}` : '';
      const docs = await apiGet('/api/stock-transfer-docs' + qs);
      _mlDocsCache = docs || [];
      renderMovementList(_mlDocsCache);
    } catch (e) {
      if (errEl) { errEl.textContent = 'Failed to load: ' + e.message; errEl.style.display = ''; }
      if (wrap)  wrap.innerHTML = '';
    }
  };

  window.expandMlDoc = async function (docId) {
    const titleEl = document.getElementById('ml-detail-title');
    const bodyEl  = document.getElementById('ml-detail-body');
    const panEl   = document.getElementById('ml-detail');
    if (!panEl) return;

    // Ensure the off-canvas sidebar isn't covering the header/hamburger.
    const overlayEl = document.getElementById('fy-sidebar-overlay')
    const sidebarEl = document.querySelector('.sidebar')
    const isSidebarOpen = !!(sidebarEl && sidebarEl.classList.contains('open'))
    const isOverlayOpen = !!(overlayEl && overlayEl.classList.contains('open'))
    const isBodyLocked = document.body.style.overflow === 'hidden'
    if (isSidebarOpen || isOverlayOpen || isBodyLocked) closeSidebar()

    panEl.style.display = '';
    titleEl.textContent = `Transfer Document #${docId}`;
    bodyEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3)">Loading…</div>';
    // Chrome/mobile has an issue where `position: sticky` headers can "disappear"
    // when `scrollIntoView()` runs inside an overflow scrolling container.
    // Safari works fine, so skip auto-scroll for Chrome and let the user scroll naturally.
    const ua = navigator.userAgent || ''
    const isChromeLike = (/Chrome\//i.test(ua) || /CriOS\//i.test(ua)) && !(/Edg\//i.test(ua) || /OPR\//i.test(ua))
    if (!isChromeLike) panEl.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    try {
      const doc = await apiGet(`/api/stock-transfer-docs/${docId}`);
      const fmtDt = dt => dt ? fmtDateTime(dt) : '—';
      const lines = (doc.lines || []).map(l => `
        <tr>
          <td>${l.sku_code || l.sku_id}</td>
          <td>${[l.product_name, l.colour_name].filter(Boolean).join(' · ')}</td>
          <td style="text-align:center">${l.qty_sent}</td>
          <td style="text-align:center">${l.qty_received != null ? l.qty_received : '—'}</td>
        </tr>`).join('');
      bodyEl.innerHTML = `
        <div class="ml-meta-grid">
          <div class="ml-meta-card"><div class="ml-meta-k">Type</div><div class="ml-meta-v">${doc.doc_type === 'DIRECT' ? 'Goods Transfer (Direct)' : 'From Request #' + doc.source_request_id}</div></div>
          <div class="ml-meta-card"><div class="ml-meta-k">Status</div><div class="ml-meta-v">${mlStatusBadge(doc.status)}</div></div>
          <div class="ml-meta-card"><div class="ml-meta-k">To Store</div><div class="ml-meta-v">${doc.store_name || 'Store #' + doc.to_store_id}</div></div>
          <div class="ml-meta-card"><div class="ml-meta-k">Dispatched</div><div class="ml-meta-v">${fmtDt(doc.dispatched_at)}</div></div>
          ${doc.accepted_at ? `<div class="ml-meta-card"><div class="ml-meta-k">Accepted</div><div class="ml-meta-v">${fmtDt(doc.accepted_at)}</div></div>` : ''}
          ${doc.stocked_at  ? `<div class="ml-meta-card"><div class="ml-meta-k">Stocked</div><div class="ml-meta-v">${fmtDt(doc.stocked_at)}</div></div>` : ''}
        </div>
        ${doc.notes ? `<div style="margin-bottom:14px;color:var(--text2);font-size:13px">📝 ${doc.notes}</div>` : ''}
        <table class="ml-lines-table" style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr>
            <th style="text-align:left">SKU</th>
            <th style="text-align:left">Description</th>
            <th style="text-align:center">Sent</th>
            <th style="text-align:center">Received</th>
          </tr></thead>
          <tbody>${lines}</tbody>
        </table>`;
    } catch (e) {
      bodyEl.innerHTML = `<div class="err-msg">Failed to load document: ${e.message}</div>`;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────────────────
  loadFormData();
  loadDashboard();
  loadPurchases();
});
