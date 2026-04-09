const API_KEY = 'CHANGE_ME_API_KEY';

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
  window._currentHeaderId = null;

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

  // ── Existing Product Search ───────────────────────────────────────────────
  const _searchTimers = {};

  window.setPurchaseItemMode = function(idx, mode) {
    const searchPanel    = document.getElementById(`item-search-panel-${idx}`);
    const sourceFields   = document.getElementById(`item-source-fields-${idx}`);
    const newBtn         = document.getElementById(`item-mode-new-btn-${idx}`);
    const searchBtn      = document.getElementById(`item-mode-search-btn-${idx}`);
    const selectedBanner = document.getElementById(`item-selected-banner-${idx}`);

    if (mode === 'search') {
      if (searchPanel)  searchPanel.style.display  = 'block';
      if (sourceFields) sourceFields.style.display = 'none';
      if (newBtn)    { newBtn.style.background = ''; newBtn.style.color = ''; newBtn.style.borderColor = ''; }
      if (searchBtn) { searchBtn.style.background = 'var(--acc2)'; searchBtn.style.color = '#fff'; searchBtn.style.borderColor = 'var(--acc2)'; }
      // Keep selected banner visible when switching to search mode
      if (!document.getElementById(`item-selected-pm-${idx}`)?.value) {
        if (selectedBanner) selectedBanner.style.display = 'none';
      }
      setTimeout(() => { const q = document.getElementById(`item-search-q-${idx}`); if (q) q.focus(); }, 50);
    } else {
      if (searchPanel)  searchPanel.style.display  = 'none';
      if (sourceFields) sourceFields.style.display = 'block';
      if (searchBtn) { searchBtn.style.background = ''; searchBtn.style.color = ''; searchBtn.style.borderColor = ''; }
      if (newBtn)    { newBtn.style.background = 'var(--acc2)'; newBtn.style.color = '#fff'; newBtn.style.borderColor = 'var(--acc2)'; }
    }
  };

  window.onPurchaseItemSearch = function(idx) {
    clearTimeout(_searchTimers[idx]);
    const q = val(`item-search-q-${idx}`);
    const resultsEl = document.getElementById(`item-search-results-${idx}`);
    const spinner   = document.getElementById(`item-search-spinner-${idx}`);

    if (!q || q.length < 2) {
      if (resultsEl) resultsEl.style.display = 'none';
      return;
    }

    if (spinner) spinner.style.display = 'inline';
    _searchTimers[idx] = setTimeout(async () => {
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
    const el = document.getElementById(`item-search-results-${idx}`);
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

    // Hide search results
    const resultsEl = document.getElementById(`item-search-results-${idx}`);
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

    // Reset to "new product" mode
    setPurchaseItemMode(idx, 'new');

    // Clear search input
    const qEl = document.getElementById(`item-search-q-${idx}`);
    if (qEl) qEl.value = '';
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
    try {
      const data = await apiGet('/api/purchases/dashboard-stats');
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
    } catch (err) { console.error('loadDashboard:', err); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NEW PURCHASE FORM (multi-item)
  // ─────────────────────────────────────────────────────────────────────────
  function initNewPurchaseForm() {
    _itemCount = 0;
    const container = document.getElementById('purchase-items-container');
    if (container) container.innerHTML = '';
    const today = istToday();
    // Set today as default in flatpickr if not already set
    const fpEl = document.getElementById('bill-purchase-date-input');
    if (fpEl && !fpEl.value && fpEl._flatpickr) fpEl._flatpickr.setDate(new Date(), true);
    addPurchaseItem();
  }

  window.addPurchaseItem = function() {
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
        ${_itemCount > 1 ? `<button type="button" class="btn sm" style="margin-left:auto;color:var(--red)" onclick="removePurchaseItem(${idx})">✕ Remove</button>` : ''}
      </div>
      <div class="cb">
        <input type="hidden" id="item-selected-pm-${idx}">

        <!-- Mode toggle -->
        <div style="display:flex;gap:8px;margin-bottom:14px;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;align-items:center">
          <span style="font-size:12px;color:var(--text3);margin-right:4px">Product entry mode:</span>
          <button type="button" id="item-mode-new-btn-${idx}" class="btn sm" style="background:var(--acc2);color:#fff;border-color:var(--acc2)" onclick="setPurchaseItemMode(${idx},'new')">✚ New Product</button>
          <button type="button" id="item-mode-search-btn-${idx}" class="btn sm" onclick="setPurchaseItemMode(${idx},'search')">🔍 Search Existing</button>
        </div>

        <!-- Search panel (hidden by default) -->
        <div id="item-search-panel-${idx}" style="display:none;margin-bottom:14px">
          <div style="position:relative">
            <input id="item-search-q-${idx}" placeholder="Search by brand, model, manufacturer…" style="width:100%;padding-right:32px"
              oninput="onPurchaseItemSearch(${idx})" autocomplete="off">
            <span id="item-search-spinner-${idx}" style="display:none;position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--text3)">…</span>
          </div>
          <div id="item-search-results-${idx}" style="display:none;border:1px solid var(--border);border-radius:8px;margin-top:4px;max-height:280px;overflow-y:auto;background:var(--card)"></div>
        </div>

        <!-- Selected product banner -->
        <div id="item-selected-banner-${idx}" style="display:none;background:#e8f5e9;border:1px solid #66bb6a;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12.5px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <span style="font-weight:700;color:#2e7d32">✓ Existing Product Selected</span>
              <span style="margin-left:8px;background:#c8e6c9;color:#1b5e20;padding:1px 7px;border-radius:10px;font-size:11px;font-weight:600" id="item-selected-badge-${idx}">Restock Candidate</span>
              <div id="item-selected-desc-${idx}" style="margin-top:5px;color:var(--text2);line-height:1.5"></div>
            </div>
            <button type="button" class="btn xs" style="color:var(--red);flex-shrink:0;margin-left:12px" onclick="clearExistingProductSelection(${idx})">✕ Clear</button>
          </div>
        </div>

        <!-- Source fields (shown by default) -->
        <div id="item-source-fields-${idx}">
          <div class="fg3 mb3">
            <div class="fgrp">
              <label>Product Type <span class="req">*</span></label>
              <select id="item-product-type-${idx}">${ptOpts}</select>
              <div class="fhint">Same list as Foundry Settings → Product Types (active values).</div>
            </div>
            <div class="fgrp">
              <label>Manufacturer <span class="req">*</span></label>
              <input id="item-maker-name-${idx}" list="item-maker-list-${idx}" placeholder="e.g. Gandhi" oninput="onMakerInputChange(${idx})">
              <datalist id="item-maker-list-${idx}">
                ${(_allMakers || []).map((m) => `<option value="${String(m.maker_name || '').replace(/"/g, '&quot;')}"></option>`).join('')}
              </datalist>
              <input type="hidden" id="item-maker-${idx}">
              <div class="fhint">Source brands are filtered by manufacturer.</div>
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
            <div class="fgrp">
              <label>Source Model Number <span class="req">*</span></label>
              <input id="item-source-model-${idx}" list="item-source-model-list-${idx}" placeholder="e.g. VR-01" onfocus="onSourceModelInputChange(${idx})" oninput="onSourceModelInputChange(${idx})">
              <datalist id="item-source-model-list-${idx}"></datalist>
            </div>
          </div>

          <div id="item-repeat-banner-${idx}" style="display:none;background:var(--goldL);border:1px solid var(--gold);border-radius:8px;padding:8px 12px;font-size:12.5px;margin-bottom:12px">
            🔁 This product exists. Details will be pre-filled.
          </div>
        </div>

        <div class="fg3 mb3" style="border-top:1px solid var(--border);padding-top:12px">
          <div class="fgrp">
            <label>Purchase Rate (₹) <span class="req">*</span></label>
            <input type="number" id="item-rate-${idx}" placeholder="Per unit rate" oninput="calcItemBill(${idx})">
          </div>
          <div class="fgrp">
            <label>Quantity <span class="req">*</span></label>
            <input type="number" id="item-qty-${idx}" placeholder="Total units" oninput="calcItemBill(${idx});validateColourQty(${idx})">
          </div>
          <div class="fgrp">
            <label>GST % <span class="req">*</span></label>
            <input type="number" id="item-gst-${idx}" placeholder="e.g. 12 for 12%" step="0.01" min="0" max="100" oninput="calcItemBill(${idx})">
          </div>
        </div>

        <!-- Branding toggle -->
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
          <input type="checkbox" id="item-branding-${idx}" style="width:16px;height:16px;cursor:pointer;accent-color:var(--acc2)">
          <div>
            <label for="item-branding-${idx}" style="font-size:13px;font-weight:600;cursor:pointer">Branding Required</label>
            <div style="font-size:11.5px;color:var(--text3);margin-top:1px">Check if this item needs to be re-branded under an Eyewoot home brand. Leave unchecked to use Source Brand directly.</div>
          </div>
        </div>

        <!-- Item bill summary -->
        <div style="background:var(--bg);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px" id="item-bill-summary-${idx}">
          <div class="flex ic" style="justify-content:space-between"><span class="td2">Base Value</span><span class="mono" id="item-base-${idx}">₹0</span></div>
          <div class="flex ic" style="justify-content:space-between"><span class="td2">GST Amount</span><span class="mono" id="item-gst-amt-${idx}">₹0</span></div>
          <div class="flex ic fw6" style="justify-content:space-between;margin-top:4px;border-top:1px solid var(--border);padding-top:4px"><span>Item Total</span><span class="mono" id="item-total-${idx}">₹0</span></div>
        </div>

        <!-- Colour Variants -->
        <div style="border-top:1px solid var(--border);padding-top:12px">
          <div class="section-lbl mb2">Colour Variants</div>
          <div id="colours-container-${idx}"></div>
          <div id="colour-qty-warn-${idx}" style="display:none;color:var(--red);font-size:12px;margin:4px 0 8px"></div>
          <button type="button" class="btn sm mt1" onclick="addColourToItem(${idx})">+ Add Colour</button>
        </div>
      </div>`;
    container.appendChild(card);
    addColourToItem(idx);

    const hint = document.getElementById('items-count-hint');
    if (hint) hint.textContent = _itemCount === 1 ? '1 item' : `${_itemCount} items`;
  };

  window.removePurchaseItem = function(idx) {
    const card = document.getElementById(`item-card-${idx}`);
    if (card) card.remove();
    recalcGrandTotal();
    const remaining = document.querySelectorAll('.purchase-item-card').length;
    const hint = document.getElementById('items-count-hint');
    if (hint) hint.textContent = remaining === 1 ? '1 item' : `${remaining} items`;
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

    // Add a new blank item card
    window.addPurchaseItem();
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
    // Scroll the new card into view
    const newCard = document.getElementById(`item-card-${newIdx}`);
    if (newCard) newCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
              <div><div class="xs td2">Bill Reference</div><div class="fw6 mono">${h.bill_ref || '—'}</div></div>
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
        <div><div class="xs td2">Bill Reference</div><div class="fw6 mono">${h.bill_ref || '—'}</div></div>
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
        <div><div class="xs td2">Bill Ref</div><div class="mono xs">${h.bill_ref || h.bill_number || '—'}</div></div>
        <div><div class="xs td2">Purchase Date</div><div class="fw6">${fmtDate(h.purchase_date)}</div></div>`;

      // Build all-items colour table
      let allItemsHtml = '';
      const isPendingDispatch = h.pipeline_status === 'PENDING_BRANDING';
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

        allItemsHtml += `
          <div style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">
            <div class="fw6 mb1">${it.ew_collection || ''} · ${it.style_model || ''} <span class="xs td2">(${it.quantity} units)</span></div>
            ${brandRowHtml}
            <table style="width:100%;font-size:13px">
              <thead><tr>
                <th style="padding:6px 8px;font-size:11px;text-transform:uppercase">Colour</th>
                <th style="padding:6px 8px;font-size:11px;text-transform:uppercase">Code</th>
                <th style="padding:6px 8px;font-size:11px;text-transform:uppercase;text-align:center">Quantity</th>
              </tr></thead>
              <tbody>
                ${(it.colours || []).map((c) => `<tr>
                  <td style="padding:7px 8px">${c.colour_name}</td>
                  <td class="mono xs" style="padding:7px 8px">${c.colour_code}</td>
                  <td style="padding:7px 8px;text-align:center">${c.quantity}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`;
      });
      document.getElementById('branding-items-area').innerHTML = allItemsHtml || '<div class="empty">No items</div>';
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
    const btn = document.getElementById('branding-receive-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Confirming…'; }
    try {
      await apiPut(`/api/purchases/${headerId}/branding-receive`, {});
      openDigitisationPage(headerId);
    } catch (err) { alert(err.message); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Confirm Receipt → Digitisation'; } }
  };

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
          <div>Bill Ref: ${h.bill_ref || h.bill_number || '—'}</div>
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
      if (summaryBar) {
        summaryBar.innerHTML = `
          <div><div class="xs td2">Purchase</div><div class="fw6">#${h.header_id}</div></div>
          <div><div class="xs td2">Supplier</div><div class="fw6">${h.supplier_name || '—'}</div></div>
          <div><div class="xs td2">Items</div><div class="fw6">${items.length}</div></div>
          <div><div class="xs td2">SKUs Generated</div><div class="fw6" style="color:${doneColours===totalColours?'var(--green)':'var(--gold)'}">${doneColours} / ${totalColours}</div></div>`;
      }

      // Progress label
      const progLabel = document.getElementById('digi-progress-label');
      if (progLabel) progLabel.textContent = `${doneColours} / ${totalColours} SKUs generated`;

      // Sub-step
      const pstepSub = document.getElementById('digi-pstep-sub');
      if (pstepSub) pstepSub.textContent = `${doneColours} of ${totalColours} SKUs done`;

      // Build item sections with colour tabs
      if (!container) return;
      container.innerHTML = '';

      items.forEach((item, itemIdx) => {
        const colours = item.colours || [];
        const section = document.createElement('div');
        section.className = 'card mb4';
        section.id = `digi-item-section-${item.item_id}`;

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
          const currentColourImg = colourImgUrl
            ? `<div style="width:100%;max-width:200px;height:150px;border-radius:8px;border:1px solid var(--border);overflow:hidden;background:#f7f9fc;margin-bottom:8px">
                 <img src="${colourImgUrl}" alt="${col.colour_name}"
                   style="width:100%;height:100%;object-fit:contain;padding:4px"
                   onerror="this.parentElement.innerHTML='<div style=\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:24px\'>📷</div>'">
               </div>`
            : `<div style="width:100%;max-width:200px;height:100px;border:2px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:8px;color:var(--text3);font-size:28px;background:#fafafa">📷
               <div class="xs td2" style="font-size:11px;margin-top:4px">No photo yet</div></div>`;
          const currentColourVid = colourVidUrl
            ? `<div style="width:100%;border-radius:8px;overflow:hidden;margin-bottom:8px">
                 <video src="${colourVidUrl}" controls style="width:100%;max-height:140px;display:block;border-radius:8px;border:1px solid var(--border)"></video>
               </div>`
            : `<div style="width:100%;max-width:200px;height:80px;border:2px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:8px;color:var(--text3);font-size:24px;background:#fafafa">🎬
               <div class="xs td2" style="font-size:11px;margin-top:4px">No video yet</div></div>`;

          tabsHtml += `<div class="tab${colIdx === 0 ? ' active' : ''}" onclick="switchDigiTab(this, '${tabId}')">
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
                <div class="card">
                  <div class="ch"><div class="ct">Product Info</div></div>
                  <div class="cb">
                    <div class="fg2">
                      <div><div class="xs td2">EW Collection</div><div class="fw6">${item.ew_collection || '—'}</div></div>
                      <div><div class="xs td2">Style</div><div class="fw6">${item.style_model || '—'}</div></div>
                      <div><div class="xs td2">Brand</div><div class="fw6">${item.brand_name || item.source_brand || '—'}</div></div>
                      <div><div class="xs td2">Quantity</div><div class="fw6">${item.quantity} units</div></div>
                    </div>
                  </div>
                </div>
                <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px">
                  <div class="section-lbl mb3">${col.colour_name} — Media</div>

                  <!-- Photo -->
                  <div class="xs fw6 mb1" style="color:var(--text2)">Photo</div>
                  <div id="${imgId}-current">${currentColourImg}</div>
                  <div id="${imgId}-preview" style="display:none;margin-bottom:8px"></div>
                  <label style="display:inline-block;cursor:pointer" title="Choose photo for ${col.colour_name}">
                    <input type="file" id="${imgId}-file" accept="image/jpeg,image/png,image/webp,image/gif"
                      style="display:none" onchange="handleColourImagePreview('${imgId}')">
                    <span class="btn sm" style="pointer-events:none">📷 Choose Photo</span>
                  </label>
                  <div class="xs td2 mt1 mb2">JPG, PNG, WebP · Max 5 MB</div>
                  <div id="${imgId}-msg" style="display:none;font-size:12px;margin-bottom:6px"></div>
                  <button class="btn sm" onclick="handleSaveColourMedia(${headerId},${col.colour_id},'${imgId}','image')">💾 Save Photo</button>

                  <hr style="border:none;border-top:1px solid var(--border);margin:12px 0">

                  <!-- Video -->
                  <div class="xs fw6 mb1" style="color:var(--text2)">Product Video</div>
                  <div id="${imgId}-vid-current">${currentColourVid}</div>
                  <div id="${imgId}-vid-preview" style="display:none;margin-bottom:8px"></div>
                  <label style="display:inline-block;cursor:pointer" title="Choose video for ${col.colour_name}">
                    <input type="file" id="${imgId}-vid-file" accept="video/mp4,video/quicktime,video/webm,video/avi,video/x-matroska"
                      style="display:none" onchange="handleColourVideoPreview('${imgId}')">
                    <span class="btn sm" style="pointer-events:none">🎬 Choose Video</span>
                  </label>
                  <div class="xs td2 mt1 mb2">MP4, MOV, WebM · Max 100 MB</div>
                  <div id="${imgId}-vid-msg" style="display:none;font-size:12px;margin-bottom:6px"></div>
                  <button class="btn sm" onclick="handleSaveColourMedia(${headerId},${col.colour_id},'${imgId}','video')">💾 Save Video</button>
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
            <span class="xs td2">${item.quantity} units · ${colours.length} colour${colours.length !== 1 ? 's' : ''}</span>
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

  // Preview handler for per-colour image selection
  window.handleColourImagePreview = function(imgId) {
    const fileEl    = document.getElementById(`${imgId}-file`);
    const previewEl = document.getElementById(`${imgId}-preview`);
    const msgEl     = document.getElementById(`${imgId}-msg`);
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
        previewEl.innerHTML = `<img src="${e.target.result}"
          style="max-width:140px;max-height:110px;border-radius:8px;border:1px solid var(--border);object-fit:cover;display:block;margin-bottom:4px">
          <div class="xs td2" style="color:var(--gold)">⬆ Ready — click Save Photo</div>`;
        previewEl.style.display = '';
      }
      if (msgEl) msgEl.style.display = 'none';
    };
    reader.readAsDataURL(file);
  };

  // Preview handler for per-colour video selection
  window.handleColourVideoPreview = function(imgId) {
    const fileEl    = document.getElementById(`${imgId}-vid-file`);
    const previewEl = document.getElementById(`${imgId}-vid-preview`);
    const msgEl     = document.getElementById(`${imgId}-vid-msg`);
    if (!fileEl || !fileEl.files[0]) return;
    const file = fileEl.files[0];
    if (file.size > 100 * 1024 * 1024) {
      if (msgEl) { msgEl.textContent = '⚠️ File exceeds 100 MB limit.'; msgEl.style.color = 'var(--red)'; msgEl.style.display = ''; }
      fileEl.value = '';
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    if (previewEl) {
      previewEl.innerHTML = `<video src="${objectUrl}" controls
        style="max-width:100%;max-height:120px;border-radius:8px;border:1px solid var(--border);display:block;margin-bottom:4px"></video>
        <div class="xs td2" style="color:var(--gold)">⬆ Ready — click Save Video</div>`;
      previewEl.style.display = '';
    }
    if (msgEl) msgEl.style.display = 'none';
  };

  // Unified upload + persist for photo OR video per colour variant
  window.handleSaveColourMedia = async function(headerId, colourId, imgId, mediaType) {
    const isVideo   = mediaType === 'video';
    const fileKey   = isVideo ? `${imgId}-vid-file`    : `${imgId}-file`;
    const msgKey    = isVideo ? `${imgId}-vid-msg`      : `${imgId}-msg`;
    const prevKey   = isVideo ? `${imgId}-vid-preview`  : `${imgId}-preview`;
    const currKey   = isVideo ? `${imgId}-vid-current`  : `${imgId}-current`;
    const uploadEp  = isVideo ? '/api/uploads/product-video' : '/api/uploads/product-image';
    const fieldName = isVideo ? 'video' : 'image';
    const btnLabel  = isVideo ? '💾 Save Video' : '💾 Save Photo';
    const sizeLabel = isVideo ? '100 MB' : '5 MB';

    const fileEl = document.getElementById(fileKey);
    const msgEl  = document.getElementById(msgKey);
    const btn    = document.querySelector(`button[onclick*="handleSaveColourMedia(${headerId},${colourId},'${imgId}','${mediaType}')"]`);

    if (!fileEl || !fileEl.files[0]) {
      if (msgEl) { msgEl.textContent = `⚠️ Please choose a ${mediaType} first.`; msgEl.style.color = 'var(--gold)'; msgEl.style.display = ''; }
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

      // 3. Refresh the displayed media slot
      const currentEl = document.getElementById(currKey);
      if (currentEl) {
        currentEl.innerHTML = isVideo
          ? `<div style="width:100%;border-radius:8px;overflow:hidden;margin-bottom:8px">
               <video src="${mediaUrl}" controls style="width:100%;max-height:140px;display:block;border-radius:8px;border:1px solid var(--border)"></video>
             </div>`
          : `<div style="width:100%;max-width:200px;height:150px;border-radius:8px;border:1px solid var(--border);overflow:hidden;background:#f7f9fc;margin-bottom:8px">
               <img src="${mediaUrl}" style="width:100%;height:100%;object-fit:contain;padding:4px">
             </div>`;
      }
      const previewEl = document.getElementById(prevKey);
      if (previewEl) previewEl.style.display = 'none';
      fileEl.value = '';

      if (msgEl) { msgEl.textContent = `✅ ${isVideo ? 'Video' : 'Photo'} saved!`; msgEl.style.color = 'var(--green)'; msgEl.style.display = ''; }
      setTimeout(() => { if (msgEl) msgEl.style.display = 'none'; }, 3000);
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

  async function loadBrandingList() {
    showBrandingList();
    const tb = document.getElementById('branding-list-tbody');
    if (tb) tb.innerHTML = '<tr><td colspan="8" class="tc td2 p12">Loading…</td></tr>';
    try {
      const all = await apiGet('/api/purchases');
      const rows = all.filter((r) => ['PENDING_BRANDING','BRANDING_DISPATCHED'].includes(r.pipeline_status));
      const cnt = document.getElementById('branding-list-count');
      if (cnt) cnt.textContent = rows.length + ' pending';
      // Update sidebar badge
      const brandBadge = document.getElementById('branding-nav-badge');
      if (brandBadge) { brandBadge.textContent = rows.length; brandBadge.style.display = rows.length > 0 ? '' : 'none'; }
      if (!rows.length) {
        if (tb) tb.innerHTML = '<tr><td colspan="8" class="tc td2 p12">No bills pending branding</td></tr>';
        return;
      }
      if (tb) tb.innerHTML = rows.map((r) => `<tr>
        <td class="mono xs fw6">#${r.header_id}</td>
        <td class="fw6">${r.supplier_name || '—'}</td>
        <td class="mono xs td2">${r.bill_ref || r.bill_number || '—'}</td>
        <td class="tc">${r.item_count || 0}</td>
        <td class="tc">${r.total_qty || 0}</td>
        <td>${stageBadge(r.pipeline_status)}</td>
        <td class="xs td2">${fmtDate(r.created_at)}</td>
        <td><button class="btn xs primary" onclick="openBrandingPage(${r.header_id})">View / Manage</button></td>
      </tr>`).join('');
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
      const stockBadge = r.total_stock > 0
        ? `<span style="background:var(--greenL);color:var(--green);padding:1px 6px;border-radius:10px;font-size:10.5px;font-weight:600;margin-left:6px">${r.total_stock} in stock</span>`
        : `<span style="background:var(--redL);color:var(--red);padding:1px 6px;border-radius:10px;font-size:10.5px;font-weight:600;margin-left:6px">Out of stock</span>`;
      const whBadge = r.warehouse_qty > 0
        ? `<span style="background:var(--accL);color:var(--acc);padding:1px 6px;border-radius:10px;font-size:10.5px;margin-left:4px">${r.warehouse_qty} WH</span>`
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
          <div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:28px;font-weight:800;color:var(--acc)">${sku.total_stock}</div>
          <div class="xs td2">units across all locations</div>
        </div>`;
    }

    // Location rows
    const locsEl = document.getElementById('sv-locations-list');
    if (locsEl) {
      if (!locs.length) {
        locsEl.innerHTML = '<div style="padding:16px;color:var(--text3);font-size:13px;text-align:center">No stock in any location</div>';
      } else {
        const maxQty = Math.max(...locs.map((l) => l.qty), 1);
        const pct = (q) => Math.round((q / maxQty) * 100);
        const locIcon = (t) => t === 'WAREHOUSE' ? '🏭' : t === 'STORE' || t === 'AT_STORE' ? '🏪' : t === 'IN_TRANSIT' ? '🚚' : '📦';
        const locBadge = (t) => {
          if (t === 'WAREHOUSE') return `<span class="b b-green xs">Warehouse</span>`;
          if (t === 'STORE' || t === 'AT_STORE') return `<span class="b b-gray xs">At Store</span>`;
          if (t === 'IN_TRANSIT') return `<span class="b b-orange xs">In Transit</span>`;
          return `<span class="b b-teal xs">${t}</span>`;
        };

        const barPct = pct(locs.reduce((s,l) => s + l.qty, 0) > 0 ? locs[0].qty : 0);
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
                <div class="loc-units">${l.qty}</div>
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
      const wqty = sku.warehouse_qty != null ? Number(sku.warehouse_qty) : locs.filter(l => l.location_type === 'WAREHOUSE').reduce((s, l) => s + l.qty, 0);
      const sqty = sku.store_qty    != null ? Number(sku.store_qty)    : locs.filter(l => l.location_type === 'STORE' || l.location_type === 'AT_STORE').reduce((s, l) => s + l.qty, 0);
      const tqty = sku.store_qty    != null ? (wqty + sqty)            : sku.total_stock;

      const warehouseRow = `
        <div class="flex ic" style="justify-content:space-between;padding:4px 0">
          <span class="xs td2" style="display:flex;align-items:center;gap:4px">🏭 <span>HQ Warehouse</span></span>
          <span class="mono fw6" style="color:${wqty > 0 ? 'var(--green)' : 'var(--text3)'}">${wqty}</span>
        </div>`;
      const storeRow = `
        <div class="flex ic" style="justify-content:space-between;padding:4px 0">
          <span class="xs td2" style="display:flex;align-items:center;gap:4px">🏪 <span>At Stores</span></span>
          <span class="mono fw6">${sqty}</span>
        </div>`;

      accEl.innerHTML = warehouseRow + storeRow + `
        <hr class="sep" style="margin:4px 0">
        <div class="flex ic" style="justify-content:space-between"><span class="sm-txt fw6">Total</span><span class="mono fw6" style="color:var(--acc)">${tqty}</span></div>
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
  // BARCODE PRINT (TSC P210 · TSPL2 · 6UP · 15mm × 15mm)
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

  // Render the visual preview of labels in the modal
  window.bcRenderPreview = function() {
    const previewEl = document.getElementById('bc-preview-rows');
    const summaryEl = document.getElementById('bc-summary');
    if (!previewEl) return;

    const mm = _bcReadMarginsMm();
    const gp = _bcReadGapMm();
    previewEl.style.padding = `${mm.top}mm ${mm.right}mm ${mm.bottom}mm ${mm.left}mm`;
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

    // Group into rows of 6
    const rows = [];
    for (let i = 0; i < expanded.length; i += 6) rows.push(expanded.slice(i, i + 6));

    // Build HTML — QR encodes pid (code), text below shows sku_code (label)
    const rowGapCss = `${gp.rowGap}mm`;
    const colGapCss = `${gp.colGap}mm`;
    let inner = '';
    rows.forEach((row) => {
      inner += `<div class="bc-label-row" style="display:flex;flex-wrap:nowrap;gap:${colGapCss};align-items:flex-start">`;
      for (let col = 0; col < 6; col++) {
        const item = row[col];
        if (!item) { inner += '<div class="bc-empty-cell"></div>'; continue; }

        if (type === 'QR') {
          inner += `<div class="bc-label-cell" style="height:72px">
            <img src="${_bcQRSrc(item.code, 56)}" style="width:52px;height:52px;display:block;margin:0 auto"
                 onerror="this.outerHTML='<div style=\\'width:52px;height:52px;background:#fef2f2;display:flex;align-items:center;justify-content:center;font-size:6px;color:#ef4444\\'>QR ERR</div>'">
            <div class="bc-label-code">${_bcEsc(item.label)}</div>
          </div>`;
        } else {
          const uid = `bc-svg-${Math.random().toString(36).slice(2)}`;
          inner += `<div class="bc-label-cell"><svg id="${uid}" data-code="${_bcEsc(item.code)}" xmlns="http://www.w3.org/2000/svg"></svg><div class="bc-label-code">${_bcEsc(item.label)}</div></div>`;
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
      summaryEl.textContent = `${totalLabels} label${totalLabels !== 1 ? 's' : ''} · ${totalRows} row${totalRows !== 1 ? 's' : ''} of 6 · ${items.length} unique SKU${items.length !== 1 ? 's' : ''}`;
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
  // Spec: 110mm wide · 15mm×15mm · 6UP · 8 dots/mm
  // X positions (dots): 32, 168, 304, 440, 576, 712
  const BC_X_POSITIONS = [32, 168, 304, 440, 576, 712]; // 6 columns
  const BC_MM_TO_DOT   = 8;
  const BC_LABEL_H_DOT = 15 * BC_MM_TO_DOT; // 120 dots

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
    const rowRaw = parseFloat(elRow?.value ?? '2');
    const colRaw = parseFloat(elCol?.value ?? '0');
    const rowGap = Math.max(0, Math.min(10, Number.isFinite(rowRaw) ? rowRaw : 2));
    const colGap = Math.max(0, Math.min(5, Number.isFinite(colRaw) ? colRaw : 0));
    return { rowGap, colGap };
  }

  function _bcMarginsToDots() {
    const m = _bcReadMarginsMm();
    return {
      top: Math.round(m.top * BC_MM_TO_DOT),
      bottom: Math.round(m.bottom * BC_MM_TO_DOT),
      left: Math.round(m.left * BC_MM_TO_DOT),
      right: Math.round(m.right * BC_MM_TO_DOT),
    };
  }

  function _bcTsplQuote(s) {
    return String(s == null ? '' : s).replace(/"/g, "'");
  }

  function _bcGenerateTSPL2(labelBatches, labelType) {
    /*
      labelBatches: array of rows, each row = array of up to 6 {code, label} objects
        code  = PID (unique purchase identifier, encoded in QR for scanning)
        label = SKU (stable product identifier, printed as text below QR for search)
      Returns: Uint8Array of TSPL2 command bytes
    */
    const d = _bcMarginsToDots();
    const { rowGap, colGap } = _bcReadGapMm();
    const colGapDots = Math.round(colGap * BC_MM_TO_DOT);
    const maxXDots = Math.round(106 * BC_MM_TO_DOT);
    let cmds = '';

    labelBatches.forEach((row) => {
      cmds += 'SIZE 108 mm, 15 mm\r\n';
      cmds += `GAP ${rowGap} mm, 0 mm\r\n`;
      cmds += 'DIRECTION 0\r\n';
      cmds += 'CLS\r\n';

      row.forEach((item, col) => {
        if (!item) return;
        let x = BC_X_POSITIONS[col] + d.left - d.right + col * colGapDots;
        x = Math.min(x, maxXDots);
        const yQr = Math.max(2, 5 + d.top - d.bottom);
        const yTx = Math.max(12, 90 + d.top - d.bottom);
        const code = _bcTsplQuote(item.code);
        const label = _bcTsplQuote(item.label);

        if (labelType === 'QR') {
          cmds += `QRCODE ${x},${yQr},L,3,A,0,"${code}"\r\n`;
          cmds += `TEXT ${x},${yTx},"1",0,1,1,"${label}"\r\n`;
        } else {
          cmds += `BARCODE ${x},${yQr},"128",60,1,0,2,2,"${code}"\r\n`;
          cmds += `TEXT ${x},${yTx},"1",0,1,1,"${label}"\r\n`;
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

    // Batch into rows of 6
    const batches = [];
    for (let i = 0; i < expanded.length; i += 6) batches.push(expanded.slice(i, i + 6));

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
    const sheetPad = `${pad.top}mm ${pad.right}mm ${pad.bottom}mm ${pad.left}mm`;
    const tableSpacing = `${gp.colGap}mm ${gp.rowGap}mm`;

    const isQR = labelType === 'QR';
    const totalLabels = batches.reduce((s, r) => s + r.filter(Boolean).length, 0);
    // Use absolute URL so the print window (different origin) can reach our server
    const origin = window.location.origin;

    let labelRows = '';
    batches.forEach((row) => {
      const cells = [];
      for (let col = 0; col < 6; col++) {
        const item = row[col];
        if (!item || !item.code) { cells.push('<td class="empty"></td>'); continue; }
        if (isQR) {
          // QR encodes pid (code); SKU (label) shown as human-readable text below
          const src = `${origin}/api/qr?data=${encodeURIComponent(item.code)}&size=120`;
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
  body { font-family:'Courier New',monospace; background:#fff; }
  .controls { padding:10px 16px; display:flex; gap:10px; align-items:center; border-bottom:1px solid #ddd; background:#f8f8f8; }
  .controls button { padding:6px 16px; border:1px solid #888; border-radius:4px; cursor:pointer; background:#fff; font-size:13px; }
  .controls button.primary { background:#2563eb; color:#fff; border-color:#2563eb; }
  @media print { .controls { display:none; } }
  .label-sheet { padding:${sheetPad}; }
  table { border-collapse:separate; border-spacing:${tableSpacing}; }
  td.label-cell {
    width:15mm; height:18mm; border:0.3pt solid #bbb; border-radius:1mm;
    text-align:center; vertical-align:middle; padding:1mm; overflow:hidden;
  }
  td.empty { width:15mm; height:18mm; }
  .qr-img  { width:12mm; height:12mm; display:block; margin:0 auto; }
  .bc-svg  { width:13mm; height:7mm; display:block; margin:0 auto; }
  .bc-txt  { font-size:3.5pt; margin-top:0.5mm; word-break:break-all; line-height:1.3; color:#333; text-align:center; }
</style>
</head><body>
<div class="controls">
  <span style="font-size:13px;font-weight:600">🏷️ ${isQR ? 'QR Code' : 'Barcode'} Labels — ${totalLabels} labels · ${batches.length} row(s)</span>
  <span style="font-size:12px;color:#666">15mm × 15mm · 6UP</span>
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
    let _scanRunning = false;
    let _searchTimer = null;
    let _stInited    = false;

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

    // ── Init (called once on first nav) ───────────────────────────────────────
    window.stInit = async function stInit() {
      if (_stInited) { window.stLoadHistory(); return; }
      _stInited = true;
      await stLoadStores();
      window.stLoadHistory();
      stRenderCart();
    };

    // ── Load stores dropdown ──────────────────────────────────────────────────
    async function stLoadStores() {
      try {
        const stores = await apiGet('/api/stores');
        const sel = document.getElementById('st-store-sel');
        if (!sel) return;
        (stores || [])
          .filter((s) => s.status === 'ACTIVE')
          .forEach((s) => {
            const o = document.createElement('option');
            o.value = s.store_id;
            o.textContent = `${s.store_name} (${s.store_code})`;
            sel.appendChild(o);
          });
      } catch (_) {}
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
    window.stToggleCamera = function stToggleCamera() {
      const container = document.getElementById('st-scan-container');
      if (!container) return;
      if (_scanRunning) { window.stStopCamera(); return; }
      container.style.display = '';
      const overlay = document.getElementById('st-scan-overlay');
      if (overlay) overlay.style.display = 'none';
      if (!window.Html5Qrcode) {
        stToast('QR scanner library not loaded', '#e53e3e');
        return;
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
      try {
        const sku = await apiGet(`/api/stock-transfers/lookup?q=${encodeURIComponent(code)}`);
        if (sku) stAddToCart(sku);
      } catch (err) {
        stToast('Not found: ' + code, '#e53e3e');
      }
    }

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
        const docId     = resp?.data?.doc_id;
        stToast(`✓ Transfer Doc #${docId} dispatched to ${storeName} — awaiting store acceptance`, '#16a34a');
        _cart = [];
        stRenderCart();
        document.getElementById('st-notes').value = '';
        window.stLoadHistory();
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
    if (title) title.textContent = `Request #${requestId}`;
    if (body)  body.innerHTML = '<div style="padding:16px;color:var(--text3)">Loading…</div>';
    card.style.display = '';
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });

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

  window.setMlFilter = function (status, btn) {
    _mlFilter = status;
    document.querySelectorAll('#page-movement-list .btn.sm[id^="ml-tab-"]').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    loadMovementList();
  };

  window.closeMlDetail = function () {
    const d = document.getElementById('ml-detail');
    if (d) d.style.display = 'none';
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
      if (!docs.length) {
        wrap.innerHTML = '<div class="empty-state"><div class="ei">📋</div><div class="et">No transfer documents found</div><div class="es">Dispatch a Goods Transfer to see records here.</div></div>';
        return;
      }
      const statusBadge = s => {
        const map = { DISPATCHED:'<span class="badge blue">Dispatched</span>', ACCEPTED:'<span class="badge gold">Accepted</span>', STOCKED:'<span class="badge green">Stocked</span>' };
        return map[s] || `<span class="badge">${s}</span>`;
      };
      wrap.innerHTML = docs.map(d => `
        <div class="list-row" onclick="expandMlDoc(${d.doc_id})" style="cursor:pointer">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;margin-bottom:2px">Doc #${d.doc_id} — ${d.doc_type === 'DIRECT' ? '📦 Goods Transfer' : '📬 From Request #' + d.source_request_id}</div>
            <div style="font-size:12px;color:var(--text3)">→ ${d.store_name || 'Store #' + d.to_store_id} &nbsp;·&nbsp; ${fmtDateTime(d.dispatched_at)}</div>
          </div>
          <div>${statusBadge(d.status)}</div>
        </div>`).join('');
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
    panEl.style.display = '';
    titleEl.textContent = `Transfer Document #${docId}`;
    bodyEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3)">Loading…</div>';
    panEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    try {
      const doc = await apiGet(`/api/stock-transfer-docs/${docId}`);
      const fmtDt = dt => dt ? fmtDateTime(dt) : '—';
      const statusBadge = s => {
        const map = { DISPATCHED:'<span class="badge blue">Dispatched</span>', ACCEPTED:'<span class="badge gold">Accepted</span>', STOCKED:'<span class="badge green">Stocked</span>' };
        return map[s] || `<span class="badge">${s}</span>`;
      };
      const lines = (doc.lines || []).map(l => `
        <tr>
          <td>${l.sku_code || l.sku_id}</td>
          <td>${[l.product_name, l.colour_name].filter(Boolean).join(' · ')}</td>
          <td style="text-align:center">${l.qty_sent}</td>
          <td style="text-align:center">${l.qty_received != null ? l.qty_received : '—'}</td>
        </tr>`).join('');
      bodyEl.innerHTML = `
        <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:16px">
          <div><span style="color:var(--text3);font-size:12px">Type</span><br>${doc.doc_type === 'DIRECT' ? 'Goods Transfer (Direct)' : 'From Request #' + doc.source_request_id}</div>
          <div><span style="color:var(--text3);font-size:12px">Status</span><br>${statusBadge(doc.status)}</div>
          <div><span style="color:var(--text3);font-size:12px">To Store</span><br>${doc.store_name || 'Store #' + doc.to_store_id}</div>
          <div><span style="color:var(--text3);font-size:12px">Dispatched</span><br>${fmtDt(doc.dispatched_at)}</div>
          ${doc.accepted_at ? `<div><span style="color:var(--text3);font-size:12px">Accepted</span><br>${fmtDt(doc.accepted_at)}</div>` : ''}
          ${doc.stocked_at  ? `<div><span style="color:var(--text3);font-size:12px">Stocked</span><br>${fmtDt(doc.stocked_at)}</div>` : ''}
        </div>
        ${doc.notes ? `<div style="margin-bottom:14px;color:var(--text2);font-size:13px">📝 ${doc.notes}</div>` : ''}
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:6px 8px;color:var(--text3)">SKU</th>
            <th style="text-align:left;padding:6px 8px;color:var(--text3)">Description</th>
            <th style="text-align:center;padding:6px 8px;color:var(--text3)">Sent</th>
            <th style="text-align:center;padding:6px 8px;color:var(--text3)">Received</th>
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
