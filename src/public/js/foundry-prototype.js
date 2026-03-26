const API_KEY = 'CHANGE_ME_API_KEY';

document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('cosmos_token');
  const userRaw = sessionStorage.getItem('cosmos_user');

  if (!token || !userRaw) { window.location.href = '/'; return; }

  const user = JSON.parse(userRaw);
  const nameEl = document.getElementById('foundry-user-name');
  const roleEl = document.getElementById('foundry-user-role');
  const avEl   = document.getElementById('foundry-user-av');
  if (nameEl) nameEl.textContent = user.full_name || user.username || 'User';
  if (roleEl) roleEl.textContent = user.role || 'Procurement';
  if (avEl && user.full_name) {
    avEl.textContent = user.full_name.split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  }

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

  // dd/MM/yyyy
  function fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  // dd/MM/yyyy HH:mm:ss
  function fmtDateTime(d) {
    if (!d) return '—';
    const dt = new Date(d);
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    const HH = String(dt.getHours()).padStart(2, '0');
    const min = String(dt.getMinutes()).padStart(2, '0');
    const ss  = String(dt.getSeconds()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${HH}:${min}:${ss}`;
  }

  const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

  function showErr(containerId, msg) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
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
  let _allSuppliers = [];
  let _allMakers    = [];
  let _lookups      = {};
  let _homeBrands   = [];
  let _itemCount    = 0;
  window._currentHeaderId = null;

  // ── Lookup / initial data ─────────────────────────────────────────────────
  async function loadFormData() {
    try {
      const [suppliers, makers, lookupArr, brands] = await Promise.all([
        apiGet('/api/suppliers/search?q='),
        apiGet('/api/maker-master'),
        apiGet('/api/foundry-lookups'),          // flat array of all lookup values
        apiGet('/api/home-brands')
      ]);
      _allSuppliers = suppliers;
      _allMakers    = makers;
      _homeBrands   = brands;

      // Group flat lookup array into { lookup_type: [{key, label}, ...] }
      _lookups = {};
      (lookupArr || []).forEach((row) => {
        const t = row.lookup_type;
        if (!_lookups[t]) _lookups[t] = [];
        _lookups[t].push({ key: row.lookup_key, label: row.lookup_label, id: row.lookup_id });
      });

      populateAllSupplierSelects();
      populateMakerSelects();
      populateSourceTypeSelect();
    } catch (err) { console.error('loadFormData:', err); }
  }

  // Populate the Bill Header source_type dropdown from lookup data
  function populateSourceTypeSelect() {
    const sel = document.getElementById('bill-source-type-select');
    if (!sel) return;
    const cur = sel.value;
    let html = '<option value="">— Select Source Type —</option>';
    (_lookups.source_type || []).forEach((st) => {
      html += `<option value="${st.key}">${st.label}</option>`;
    });
    sel.innerHTML = html;
    if (cur) sel.value = cur;
  }

  function buildSupplierOptions(placeholder) {
    let html = `<option value="">${placeholder || '— Select Supplier —'}</option>`;
    (_allSuppliers || []).forEach((s) => {
      html += `<option value="${s.supplier_id}">${s.vendor_name}${s.vendor_code ? ' (' + s.vendor_code + ')' : ''}</option>`;
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

  // ── Supplier auto-code ────────────────────────────────────────────────────
  let _autoCodeTimer = null;
  window.autoFillVendorCode = function(name) {
    if (!name || name.length < 2) return;
    clearTimeout(_autoCodeTimer);
    _autoCodeTimer = setTimeout(async () => {
      try {
        const res = await apiGet(`/api/suppliers/auto-code?name=${encodeURIComponent(name)}`);
        const el = document.getElementById('sup-vendor-code');
        if (el && !el.dataset.manuallySet) el.value = res.vendor_code || '';
      } catch (_) {}
    }, 500);
  };

  window.refreshVendorCode = async function() {
    const name = val('sup-vendor-name');
    if (!name) return;
    try {
      const res = await apiGet(`/api/suppliers/auto-code?name=${encodeURIComponent(name)}`);
      const el = document.getElementById('sup-vendor-code');
      if (el) el.value = res.vendor_code || '';
    } catch (_) {}
  };

  // Mark code as manually set when user types in it
  const vcEl = document.getElementById('sup-vendor-code');
  if (vcEl) vcEl.addEventListener('input', () => { vcEl.dataset.manuallySet = vcEl.value ? '1' : ''; });

  // Maps supplier label values (stored as comma-separated) to lookup keys
  function supplierSourceTypesToKeys(supplierTypesStr) {
    if (!supplierTypesStr) return [];
    // Build label→key map from loaded lookups
    const labelMap = {};
    (_lookups.source_type || []).forEach((st) => {
      labelMap[st.label.toLowerCase()] = st.key;
      labelMap[st.key.toLowerCase()]   = st.key;   // also match if key already stored
    });
    return supplierTypesStr.split(',').map((s) => s.trim()).map((s) => labelMap[s.toLowerCase()] || null).filter(Boolean);
  }

  window.onBillSupplierChange = function(sel) {
    const supplierHint   = document.getElementById('bill-supplier-hint');
    const sourceTypeSel  = document.getElementById('bill-source-type-select');
    const sourceTypeHint = document.getElementById('bill-source-type-hint');

    const s = (_allSuppliers || []).find((x) => String(x.supplier_id) === String(sel.value));

    if (s) {
      // Show supplier location hint
      if (supplierHint) {
        supplierHint.textContent = [s.city, s.state].filter(Boolean).join(', ') + (s.contact_phone ? ' · ' + s.contact_phone : '');
        supplierHint.style.display = 'block';
      }

      // Auto-fill source type from supplier's stored source_types_supplied
      if (s.source_types_supplied && sourceTypeSel) {
        const keys = supplierSourceTypesToKeys(s.source_types_supplied);
        if (keys.length === 1) {
          // Single source type — auto-select it
          sourceTypeSel.value = keys[0];
          if (sourceTypeHint) sourceTypeHint.style.display = 'block';
        } else if (keys.length > 1) {
          // Multiple source types — filter the dropdown to only show matching ones
          Array.from(sourceTypeSel.options).forEach((opt) => {
            if (opt.value === '') return;                       // keep placeholder
            opt.hidden = !keys.includes(opt.value);
          });
          // Auto-select first match
          sourceTypeSel.value = keys[0];
          if (sourceTypeHint) {
            sourceTypeHint.textContent = `⚡ ${keys.length} source types available for this supplier`;
            sourceTypeHint.style.display = 'block';
          }
        } else {
          // No match — show all options
          Array.from(sourceTypeSel.options).forEach((opt) => { opt.hidden = false; });
          if (sourceTypeHint) sourceTypeHint.style.display = 'none';
        }
      } else if (sourceTypeSel) {
        // Supplier has no source types set — show all
        Array.from(sourceTypeSel.options).forEach((opt) => { opt.hidden = false; });
        if (sourceTypeHint) sourceTypeHint.style.display = 'none';
      }
    } else {
      if (supplierHint)   supplierHint.style.display   = 'none';
      if (sourceTypeHint) sourceTypeHint.style.display = 'none';
      // Reset source type dropdown to show all
      if (sourceTypeSel) {
        Array.from(sourceTypeSel.options).forEach((opt) => { opt.hidden = false; });
        sourceTypeSel.value = '';
      }
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
    const today = new Date().toISOString().split('T')[0];
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

    // Build home brand options
    let hbOpts = '<option value="">— Select Brand —</option>';
    (_homeBrands || []).forEach((b) => { hbOpts += `<option value="${b.brand_id}">${b.brand_name}</option>`; });

    // Build product type options from lookups (or fallback)
    let ptOpts = '<option value="">— Type —</option>';
    const ptLookups = _lookups.product_type || [];
    if (ptLookups.length) {
      ptLookups.forEach((pt) => { ptOpts += `<option value="${pt.key}">${pt.label}</option>`; });
    } else {
      ['FRAMES|Eyeglasses/Frames','SUNGLASSES|Sunglasses','READERS|Readers','SPORTS|Sports'].forEach((x) => {
        const [v, l] = x.split('|');
        ptOpts += `<option value="${v}">${l}</option>`;
      });
    }

    const card = document.createElement('div');
    card.className = 'card mb4 purchase-item-card';
    card.id = `item-card-${idx}`;
    card.dataset.idx = idx;
    card.innerHTML = `
      <div class="ch">
        <div class="ct">Item #${idx}</div>
        ${_itemCount > 1 ? `<button type="button" class="btn sm" style="margin-left:auto;color:var(--red)" onclick="removePurchaseItem(${idx})">✕ Remove</button>` : ''}
      </div>
      <div class="cb">
        <div class="fg3 mb3">
          <div class="fgrp" id="item-homebrand-grp-${idx}">
            <label>Home Brand (public)</label>
            <select id="item-home-brand-${idx}">${hbOpts}</select>
            <div class="fhint">Required when Source Type is Home Brand</div>
          </div>
          <div class="fgrp">
            <label>Source Brand</label>
            <input id="item-source-brand-${idx}" placeholder="Original manufacturer brand (optional)">
          </div>
          <div class="fgrp">
            <label>Maker (Manufacturer)</label>
            <select id="item-maker-${idx}" class="maker-select">
              ${buildMakerOptions('— No Maker —')}
            </select>
          </div>
          <div class="fgrp">
            <label>Source Collection</label>
            <input id="item-source-coll-${idx}" placeholder="Supplier's collection name (optional)">
          </div>
          <div class="fgrp">
            <label>EW Collection <span class="req">*</span></label>
            <input id="item-ew-coll-${idx}" placeholder="e.g. Botanica">
          </div>
          <div class="fgrp">
            <label>Style / Model <span class="req">*</span></label>
            <input id="item-style-${idx}" placeholder="e.g. VR-01">
          </div>
          <div class="fgrp">
            <label>Product Type</label>
            <select id="item-product-type-${idx}">
              ${ptOpts}
            </select>
          </div>
        </div>

        <div id="item-repeat-banner-${idx}" style="display:none;background:var(--goldL);border:1px solid var(--gold);border-radius:8px;padding:8px 12px;font-size:12.5px;margin-bottom:12px">
          🔁 This product exists. Details will be pre-filled.
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
          <div class="fgrp">
            <label>Branding Required</label>
            <select id="item-branding-${idx}">
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </div>
          <div class="fgrp">
            <label>PO Reference</label>
            <input id="item-po-${idx}" placeholder="Optional item-level PO">
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
          <div class="section-lbl mb2">Colour Variants <span class="req">*</span></div>
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

  window.duplicatePurchaseItem = function() {
    const cards = document.querySelectorAll('.purchase-item-card');
    if (!cards.length) { alert('Add an item first before duplicating.'); return; }
    // Source is the last card
    const srcCard = cards[cards.length - 1];
    const srcIdx  = parseInt(srcCard.dataset.idx, 10);

    // Add a new blank item card
    window.addPurchaseItem();
    const newIdx = _itemCount;

    // Copy simple text/number/select fields
    const textFields = ['home-brand','source-brand','source-coll','ew-coll','style','product-type','rate','qty','gst','branding','po'];
    textFields.forEach((f) => {
      const srcEl = document.getElementById(`item-${f}-${srcIdx}`);
      const dstEl = document.getElementById(`item-${f}-${newIdx}`);
      if (srcEl && dstEl) dstEl.value = srcEl.value;
    });

    // Copy maker select
    const srcMaker = document.getElementById(`item-maker-${srcIdx}`);
    const dstMaker = document.getElementById(`item-maker-${newIdx}`);
    if (srcMaker && dstMaker) dstMaker.value = srcMaker.value;

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
    const rows = document.querySelectorAll(`[id^="clr-qty-${idx}-"]`);
    let sum = 0;
    rows.forEach((r) => { sum += Number(r.value) || 0; });
    const warn = document.getElementById(`colour-qty-warn-${idx}`);
    if (!warn) return true;
    if (sum > totalQty) {
      warn.textContent = `Colour qty total (${sum}) exceeds item qty (${totalQty})`;
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

  // Source type is now at bill header level — this handler is kept for any legacy calls
  window.onSourceTypeChange = function() {};

  // ── Save Purchase ─────────────────────────────────────────────────────────
  window.handleSavePurchase = async function() {
    showErr('new-purchase-error', '');
    const supplierId = val('bill-supplier-select');
    const sourceType = val('bill-source-type-select');   // source_type is at header level
    const billRef    = val('bill-ref-input');
    const purchDate  = (typeof getFpIso === 'function' ? getFpIso('bill-purchase-date-input') : null) || val('bill-purchase-date-input');
    const transport  = parseFloat(val('bill-transport-input')) || 0;
    const poRef      = val('bill-po-ref-input');
    const notes      = val('bill-notes-input');

    if (!supplierId)  return showErr('new-purchase-error', 'Please select a Supplier.');
    if (!sourceType)  return showErr('new-purchase-error', 'Please select a Source Type.');
    if (!purchDate)   return showErr('new-purchase-error', 'Please enter a Purchase Date.');

    const itemCards = document.querySelectorAll('.purchase-item-card');
    if (!itemCards.length) return showErr('new-purchase-error', 'Add at least one item.');

    const itemsPayload = [];
    for (const card of itemCards) {
      const i = card.dataset.idx;
      const ewColl     = val(`item-ew-coll-${i}`);
      const style      = val(`item-style-${i}`);
      const rate       = parseFloat(val(`item-rate-${i}`));
      const qty        = parseInt(val(`item-qty-${i}`));
      const gstPct     = parseFloat(val(`item-gst-${i}`));
      const makerId    = val(`item-maker-${i}`) || null;
      const brandingReq = val(`item-branding-${i}`) === '1';

      if (!ewColl)     return showErr('new-purchase-error', `Item #${i}: Enter EW Collection.`);
      if (!style)      return showErr('new-purchase-error', `Item #${i}: Enter Style/Model.`);
      if (!rate || rate <= 0)  return showErr('new-purchase-error', `Item #${i}: Enter a valid Rate.`);
      if (!qty  || qty  <= 0)  return showErr('new-purchase-error', `Item #${i}: Enter a valid Quantity.`);
      if (gstPct == null || isNaN(gstPct) || gstPct < 0) return showErr('new-purchase-error', `Item #${i}: Enter GST% (e.g. 12 for 12%).`);
      if (!validateColourQty(i)) return showErr('new-purchase-error', `Item #${i}: Colour quantities exceed item total.`);

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
      if (!colours.length) return showErr('new-purchase-error', `Item #${i}: Add at least one colour variant with quantity.`);

      // Get or create product master
      const homeBrandId  = val(`item-home-brand-${i}`) || null;
      const sourceBrand  = val(`item-source-brand-${i}`) || null;
      const sourceColl   = val(`item-source-coll-${i}`) || null;

      // Check for existing product
      let productMasterId;
      try {
        const chk = await apiGet(`/api/products/check-repeat?ew_collection=${encodeURIComponent(ewColl)}&style_model=${encodeURIComponent(style)}`);
        productMasterId = chk && chk.product_id;
      } catch (_) { productMasterId = null; }

      if (!productMasterId) {
        const productType = val(`item-product-type-${i}`) || 'FRAMES';
        try {
          const pm = await apiPost('/api/products', {
            source_type: sourceType,
            home_brand_id: homeBrandId ? Number(homeBrandId) : null,
            source_brand: sourceBrand,
            source_collection: sourceColl,
            ew_collection: ewColl,
            style_model: style,
            product_type: productType,
            branding_required: brandingReq,
            maker_id: makerId ? Number(makerId) : null
          });
          productMasterId = pm && pm.product_id;
        } catch (err) { return showErr('new-purchase-error', `Item #${i}: Could not save product — ${err.message}`); }
      }

      if (!productMasterId) return showErr('new-purchase-error', `Item #${i}: Failed to resolve product master.`);

      itemsPayload.push({
        product_master_id: productMasterId,
        maker_master_id:   makerId ? Number(makerId) : null,
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
        source_type: sourceType || null,
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
      document.getElementById('bill-source-type-select').value = '';
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
    const stLabel = (() => {
      if (!h.source_type) return '—';
      const found = (_lookups.source_type || []).find((x) => x.key === h.source_type);
      return found ? found.label : h.source_type;
    })();
    const rows = items.map((it) => `<tr>
      <td class="fw6">${it.ew_collection || ''} · ${it.style_model || ''}</td>
      <td>${it.brand_name || it.source_brand || '—'}</td>
      <td class="tc">${it.quantity}</td>
      <td class="mono xs">${inrD(it.purchase_rate)}</td>
      <td class="tc mono xs">${(Number(it.gst_pct) * 100).toFixed(1)}%</td>
      <td class="mono xs">${inrD(it.item_total)}</td>
    </tr>`).join('');
    el.innerHTML = `<div class="main-side">
      <div class="col-stack">
        <div class="card">
          <div class="ch"><div class="ct">Purchase Registration Details</div></div>
          <div class="cb">
            <div class="fg3 mb4">
              <div><div class="xs td2">Supplier</div><div class="fw6">${h.supplier_name || '—'}</div></div>
              <div><div class="xs td2">Source Type</div><div class="fw6">${stLabel}</div></div>
              <div><div class="xs td2">Bill Reference</div><div class="fw6 mono">${h.bill_ref || '—'}</div></div>
              <div><div class="xs td2">Purchase Date</div><div class="fw6">${fmtDate(h.purchase_date)}</div></div>
              <div><div class="xs td2">Registered</div><div class="fw6">${fmtDateTime(h.created_at)}</div></div>
            </div>
            <div class="section-lbl mb2">Items Purchased</div>
            <div class="tw"><table>
              <thead><tr><th>Product</th><th>Brand</th><th>Qty</th><th>Rate</th><th>GST%</th><th>Item Total</th></tr></thead>
              <tbody>${rows || '<tr><td colspan="6" class="tc td2">No items</td></tr>'}</tbody>
            </table></div>
          </div>
        </div>
      </div>
      <div class="col-stack">
        <div class="card">
          <div class="ch"><div class="ct">Bill Summary</div></div>
          <div class="cb" style="display:flex;flex-direction:column;gap:8px">
            <div class="flex ic" style="justify-content:space-between"><span class="sm-txt td2">Transport</span><span class="mono xs">${inrD(h.transport_cost)}</span></div>
            <hr class="sep" style="margin:4px 0">
            <div class="flex ic" style="justify-content:space-between"><span class="fw6">Expected Total</span><span class="mono fw6" style="color:var(--acc)">${inrD(h.expected_bill_amt)}</span></div>
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
    const diff = verified ? (Number(h.actual_bill_amt) - Number(h.expected_bill_amt)) : 0;
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
              <div><div class="xs td2">Actual Bill Amount</div><div class="fw6 mono" style="color:var(--acc)">${inrD(h.actual_bill_amt)}</div></div>
              <div><div class="xs td2">Expected Amount</div><div class="fw6 mono">${inrD(h.expected_bill_amt)}</div></div>
            </div>
            ${verified ? `<div class="alert ${Math.abs(diff) <= 50 ? 'alert-green' : 'alert-gold'} mt2">
              <span>${Math.abs(diff) <= 50 ? '✅' : '⚠️'}</span>
              <div>Variance: <strong>${diff > 0 ? '+' : ''}${inrD(diff)}</strong> · ${Math.abs(diff) <= 50 ? 'Within threshold' : 'Flagged for review'}</div>
            </div>` : ''}
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
    el.innerHTML = `<div class="card">
      <div class="ch"><div class="ct">Generated SKUs</div><span class="b b-teal xs">${skus.length} SKUs</span></div>
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

    // Store skus on window for barcode modal
    window._pvCurrentSkus = skus;

    el.innerHTML = `<div class="main-side">
      <div class="col-stack">
        <div class="card">
          <div class="ch">
            <div class="ct">Warehouse Stock Added</div>
            <div class="flex ic g2">
              <button class="btn btn-sm" onclick="openBarcodeModal(window._pvCurrentSkus)" style="font-size:12px;padding:5px 12px">🏷️ Print Barcodes</button>
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

      // Meta row
      // Resolve source_type label for display
      const stLabel = (() => {
        if (!h.source_type) return '—';
        const found = (_lookups.source_type || []).find((x) => x.key === h.source_type);
        return found ? found.label : h.source_type;
      })();

      document.getElementById('bv-meta').innerHTML = `
        <div><div class="xs td2">Supplier</div><div class="fw6">${h.supplier_name || '—'}</div></div>
        <div><div class="xs td2">Source Type</div><div class="fw6">${stLabel}</div></div>
        <div><div class="xs td2">Bill Reference</div><div class="fw6 mono">${h.bill_ref || '—'}</div></div>
        <div><div class="xs td2">Purchase Date</div><div class="fw6">${fmtDate(h.purchase_date)}</div></div>`;

      // Items table
      let itemRows = '';
      items.forEach((it) => {
        itemRows += `<tr>
          <td class="fw6">${it.ew_collection || ''} · ${it.style_model || ''}</td>
          <td>${it.brand_name || it.source_brand || '—'}</td>
          <td><span class="b b-gray xs">${it.source_type || '—'}</span></td>
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
      const todayStr = new Date().toISOString().split('T')[0];
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
      items.forEach((it) => {
        allItemsHtml += `
          <div style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">
            <div class="fw6 mb2">${it.ew_collection || ''} · ${it.style_model || ''} <span class="xs td2">(${it.quantity} units)</span></div>
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

      // Show/hide dispatch vs receipt panel
      const dispatchBtn = document.getElementById('branding-dispatch-btn');
      const receiptCard = document.getElementById('branding-receipt-card');
      const bypassCard  = document.getElementById('branding-bypass-card');
      if (h.pipeline_status === 'PENDING_BRANDING') {
        if (dispatchBtn) dispatchBtn.style.display = '';
        if (receiptCard) receiptCard.style.display = 'none';
        if (bypassCard)  bypassCard.style.display  = 'none';
      } else if (h.pipeline_status === 'BRANDING_DISPATCHED') {
        if (dispatchBtn) dispatchBtn.style.display = 'none';
        if (receiptCard) receiptCard.style.display = '';
        if (bypassCard)  bypassCard.style.display  = 'none';
        const dispDate = document.getElementById('branding-dispatched-date');
        if (dispDate) dispDate.textContent = fmtDateTime(h.dispatched_at);
      }

    } catch (err) { console.error('openBrandingPage:', err); }
  }

  window.handleBrandingDispatch = async function() {
    const headerId = window._currentHeaderId;
    if (!headerId) return;
    const instructions = val('branding-instructions-input');
    const btn = document.getElementById('branding-dispatch-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Dispatching…'; }
    try {
      await apiPut(`/api/purchases/${headerId}/branding-dispatch`, { branding_instructions: instructions || null });
      await openBrandingPage(headerId);
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

    const today = new Date().toLocaleDateString('en-GB');

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
                      <div><div class="xs td2">Rate</div><div class="fw6 mono">${inrD(item.purchase_rate)}</div></div>
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
      alert('All SKUs are now LIVE and stock has been updated!');
      loadPurchases();
      nav('purchases', document.querySelector('.nav-item[onclick*="nav(\'purchases\'"]'));
    } catch (err) { alert(err.message); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Publish All to Warehouse ✓'; } }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SUPPLIERS
  // ─────────────────────────────────────────────────────────────────────────
  async function loadSuppliers() {
    const q  = val('suppliers-search');
    const tb = document.getElementById('suppliers-tbody');
    if (!tb) return;
    tb.innerHTML = '<tr><td colspan="7" class="tc td2 p12">Loading…</td></tr>';
    try {
      const rows = await apiGet(`/api/suppliers/search?q=${encodeURIComponent(q)}`);
      if (!rows.length) { tb.innerHTML = '<tr><td colspan="7" class="tc td2 p12">No suppliers found</td></tr>'; return; }
      tb.innerHTML = rows.map((s) => `<tr>
        <td class="fw6">${s.vendor_name}</td>
        <td class="mono xs">${s.vendor_code || '—'}</td>
        <td class="td2">${s.city || '—'}${s.state ? ', ' + s.state : ''}</td>
        <td class="mono xs td2">${s.gstin || '—'}</td>
        <td class="xs td2">${s.source_types_supplied || '—'}</td>
        <td><span class="b ${s.vendor_status === 'active' ? 'b-green' : 'b-gray'} xs">${s.vendor_status || 'active'}</span></td>
        <td class="tc"><button class="btn xs" onclick="openEditSupplier(${s.supplier_id})">✎</button></td>
      </tr>`).join('');
    } catch (err) { tb.innerHTML = `<tr><td colspan="7" class="tc td2 p12" style="color:var(--red)">${err.message}</td></tr>`; }
  }

  window.openNewSupplierModal = function() {
    document.getElementById('supplier-editing-id').value = '';
    document.getElementById('supplier-modal-title').textContent = 'Add Supplier';
    document.getElementById('save-supplier-btn').textContent = 'Add Supplier';
    document.getElementById('supplier-modal-error').style.display = 'none';
    ['sup-vendor-name','sup-vendor-code','sup-city','sup-state','sup-gstin','sup-contact-person','sup-contact-phone'].forEach((id) => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('sup-vendor-code').dataset.manuallySet = '';
    document.getElementById('modal-new-supplier').style.display = 'flex';
  };

  window.openEditSupplier = async function(id) {
    try {
      const s = await apiGet(`/api/suppliers/${id}`);
      document.getElementById('supplier-editing-id').value = id;
      document.getElementById('supplier-modal-title').textContent = 'Edit Supplier';
      document.getElementById('save-supplier-btn').textContent = 'Save Changes';
      document.getElementById('sup-vendor-name').value  = s.vendor_name || '';
      document.getElementById('sup-vendor-code').value  = s.vendor_code || '';
      document.getElementById('sup-city').value         = s.city || '';
      document.getElementById('sup-state').value        = s.state || '';
      document.getElementById('sup-gstin').value        = s.gstin || '';
      document.getElementById('sup-contact-person').value = s.contact_person || '';
      document.getElementById('sup-contact-phone').value  = s.contact_phone || '';
      document.getElementById('supplier-modal-error').style.display = 'none';
      document.getElementById('modal-new-supplier').style.display = 'flex';
    } catch (err) { alert(err.message); }
  };

  window.handleSaveSupplier = async function() {
    const editingId = val('supplier-editing-id');
    const payload = {
      vendor_name: val('sup-vendor-name'),
      vendor_code: val('sup-vendor-code') || null,
      city: val('sup-city') || null,
      state: val('sup-state') || null,
      gstin: val('sup-gstin') || null,
      contact_person: val('sup-contact-person') || null,
      contact_phone: val('sup-contact-phone') || null
    };
    if (!payload.vendor_name) return showErr('supplier-modal-error', 'Vendor Name is required.');
    try {
      if (editingId) {
        await apiPut(`/api/suppliers/${editingId}`, { vendor_name: payload.vendor_name, ...payload });
      } else {
        await apiPost('/api/suppliers', payload);
      }
      document.getElementById('modal-new-supplier').style.display = 'none';
      await loadSuppliers();
      // Refresh supplier lists in forms
      _allSuppliers = await apiGet('/api/suppliers/search?q=');
      populateAllSupplierSelects();
    } catch (err) { showErr('supplier-modal-error', err.message); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MAKER MASTER
  // ─────────────────────────────────────────────────────────────────────────
  async function loadMakers() {
    const q  = val('makers-search') || '';
    const tb = document.getElementById('makers-tbody');
    if (!tb) return;
    tb.innerHTML = '<tr><td colspan="6" class="tc td2 p12">Loading…</td></tr>';
    try {
      const rows = await apiGet('/api/maker-master');
      const filtered = q ? rows.filter((m) => m.maker_name.toLowerCase().includes(q.toLowerCase()) || (m.maker_code || '').toLowerCase().includes(q.toLowerCase())) : rows;
      if (!filtered.length) { tb.innerHTML = '<tr><td colspan="6" class="tc td2 p12">No makers found</td></tr>'; return; }
      tb.innerHTML = filtered.map((m) => `<tr>
        <td class="fw6">${m.maker_name}</td>
        <td class="mono xs">${m.maker_code}</td>
        <td class="td2">${m.country || '—'}</td>
        <td class="td2 xs">${m.description || '—'}</td>
        <td><span class="b ${m.is_active ? 'b-green' : 'b-gray'} xs">${m.is_active ? 'Active' : 'Inactive'}</span></td>
        <td class="tc">
          <button class="btn xs" onclick="openEditMaker(${m.maker_id})">✎</button>
          <button class="btn xs" style="margin-left:4px;color:${m.is_active?'var(--red)':'var(--green)'}" onclick="toggleMakerStatus(${m.maker_id},${m.is_active?0:1})">${m.is_active?'Deactivate':'Activate'}</button>
        </td>
      </tr>`).join('');
    } catch (err) { tb.innerHTML = `<tr><td colspan="6" class="tc td2 p12" style="color:var(--red)">${err.message}</td></tr>`; }
  }

  window.openNewMakerModal = function() {
    document.getElementById('maker-editing-id').value = '';
    document.getElementById('maker-modal-title').textContent = 'Add Maker';
    document.getElementById('save-maker-btn').textContent = 'Add Maker';
    document.getElementById('maker-modal-error').style.display = 'none';
    ['maker-name','maker-code','maker-country','maker-description'].forEach((id) => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('modal-maker').style.display = 'flex';
  };

  window.openEditMaker = async function(id) {
    try {
      const m = await apiGet(`/api/maker-master/${id}`);
      document.getElementById('maker-editing-id').value = id;
      document.getElementById('maker-modal-title').textContent = 'Edit Maker';
      document.getElementById('save-maker-btn').textContent = 'Save Changes';
      document.getElementById('maker-name').value        = m.maker_name || '';
      document.getElementById('maker-code').value        = m.maker_code || '';
      document.getElementById('maker-country').value     = m.country || '';
      document.getElementById('maker-description').value = m.description || '';
      document.getElementById('maker-modal-error').style.display = 'none';
      document.getElementById('modal-maker').style.display = 'flex';
    } catch (err) { alert(err.message); }
  };

  window.handleSaveMaker = async function() {
    const editingId = val('maker-editing-id');
    const payload = {
      maker_name: val('maker-name'),
      maker_code: val('maker-code'),
      country:    val('maker-country') || null,
      description: val('maker-description') || null
    };
    if (!payload.maker_name) return showErr('maker-modal-error', 'Maker Name is required.');
    if (!payload.maker_code) return showErr('maker-modal-error', 'Maker Code is required.');
    try {
      if (editingId) {
        await apiPut(`/api/maker-master/${editingId}`, payload);
      } else {
        await apiPost('/api/maker-master', payload);
      }
      document.getElementById('modal-maker').style.display = 'none';
      _allMakers = await apiGet('/api/maker-master');
      populateMakerSelects();
      loadMakers();
    } catch (err) { showErr('maker-modal-error', err.message); }
  };

  window.toggleMakerStatus = async function(id, newStatus) {
    try {
      await apiPut(`/api/maker-master/${id}`, { is_active: !!newStatus });
      _allMakers = await apiGet('/api/maker-master');
      populateMakerSelects();
      loadMakers();
    } catch (err) { alert(err.message); }
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
  // MODAL CLOSE HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  window.closeM = function(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; };

  // Close overlay on backdrop click
  document.querySelectorAll('.overlay').forEach((ov) => {
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.style.display = 'none'; });
  });

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
            <td colspan="11">
              📦 <strong>${name}</strong>&emsp;
              <span>${g.brand_name || ''}</span>
              ${specs ? `<span class="xs td2"> · ${specs}</span>` : ''}
              <span class="b b-gray xs" style="margin-left:8px">${g.pm_product_type || ''}</span>
              <span class="xs td2" style="margin-left:8px">${g.colours.length} variant${g.colours.length !== 1 ? 's' : ''}</span>
            </td>
          </tr>`;
          const colRows = g.colours.map((c) => {
            const margin = c.cost_price && c.sale_price
              ? (((c.sale_price - c.cost_price) / c.sale_price) * 100).toFixed(1) + '%' : '—';
            const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${swatchBg(c.colour_name,c.colour_code)};margin-right:5px;vertical-align:middle;border:1px solid rgba(0,0,0,.15)"></span>`;
            return `<tr class="tbl-colour-row">
              <td class="mono xs fw6">${c.sku_code}</td>
              <td>${dot}${c.colour_name || '—'} ${c.colour_code ? `<span class="xs td2">(${c.colour_code})</span>` : ''}</td>
              <td class="td2">${g.brand_name || '—'}</td>
              <td><span class="b b-gray xs">${g.pm_product_type || '—'}</span></td>
              <td class="mono xs">${inrD(c.cost_price)}</td>
              <td class="mono xs">${inrD(c.sale_price)}</td>
              <td class="fw6" style="color:var(--green)">${margin}</td>
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
      if (tbody) tbody.innerHTML = `<tr><td colspan="11" class="tc td2" style="color:var(--red)">${err.message}</td></tr>`;
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
    const margin = r.cost_price && r.sale_price
      ? (((r.sale_price - r.cost_price) / r.sale_price) * 100).toFixed(1) + '%' : '—';

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
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
            <div><div class="label-sm td2">Cost</div><div class="mono fw6">${inrD(r.cost_price)}</div></div>
            <div><div class="label-sm td2">Sale Price</div><div class="mono fw6" style="color:var(--primary)">${inrD(r.sale_price)}</div></div>
            <div><div class="label-sm td2">Margin</div><div class="fw6" style="color:var(--green)">${margin}</div></div>
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
  // NAV PAGE CHANGE EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  const origNav = window.nav;
  window.nav = function(id, el, skipList) {
    if (typeof origNav === 'function') origNav(id, el);
    if (id === 'dashboard')    loadDashboard();
    if (id === 'purchases')    loadPurchases();
    if (id === 'new-purchase') { loadFormData(); initNewPurchaseForm(); }
    if (id === 'suppliers')    loadSuppliers();
    if (id === 'maker-master') loadMakers();
    if (id === 'sku-catalogue') loadSkuCatalogue();
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

  window.openBarcodeModal = function(skus) {
    if (!skus || !skus.length) { alert('No SKUs available to print.'); return; }
    _bcSkus = skus;
    _bcUsbDevice = null;
    _bcUpdatePrinterStatus(null);

    // Build SKU list rows — each row has its own qty input defaulting to unit quantity
    const listEl = document.getElementById('bc-sku-list');
    if (listEl) {
      listEl.innerHTML = skus.map((sk, i) => `
        <div class="bc-sku-row">
          <input type="checkbox" id="bc-chk-${i}" checked onchange="bcRenderPreview()">
          <div style="flex:1;min-width:0">
            <div class="bc-sku-code">${sk.sku_code || '—'}</div>
            <div class="bc-sku-info">${sk.ew_collection || ''} · ${sk.colour_name || ''}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0">
            <span style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em">Qty</span>
            <input type="number" id="bc-qty-${i}" min="1" max="9999" value="${sk.quantity || 1}"
              style="width:52px;text-align:center;font-size:12px;padding:3px 4px"
              oninput="bcRenderPreview()">
            <span style="font-size:9px;color:var(--text2)">${sk.quantity || 0} stk</span>
          </div>
        </div>`).join('');
    }

    // Reset controls
    const copiesEl = document.getElementById('bc-copies');
    if (copiesEl) copiesEl.value = '';
    const typeEl = document.getElementById('bc-type');
    if (typeEl) typeEl.value = 'QR';

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

  // Build list of {sku_code, copies} reading per-row qty inputs
  function _bcSelectedItems() {
    const items = [];
    _bcSkus.forEach((sk, i) => {
      const chk = document.getElementById(`bc-chk-${i}`);
      if (!chk || !chk.checked) return;
      const copies = Math.max(1, parseInt(document.getElementById(`bc-qty-${i}`)?.value || '1', 10));
      items.push({ code: sk.sku_code, copies });
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

    const items = _bcSelectedItems();
    const type  = document.getElementById('bc-type')?.value || 'QR';

    if (!items.length) {
      previewEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2);font-size:13px">No SKUs selected</div>';
      if (summaryEl) summaryEl.textContent = '';
      return;
    }

    // Expand by copies
    const expanded = [];
    items.forEach(({ code, copies }) => { for (let c = 0; c < copies; c++) expanded.push(code); });

    // Group into rows of 6
    const rows = [];
    for (let i = 0; i < expanded.length; i += 6) rows.push(expanded.slice(i, i + 6));

    // Build HTML — QR images served directly from /api/qr
    let html = '';
    rows.forEach((row) => {
      html += '<div class="bc-label-row">';
      for (let col = 0; col < 6; col++) {
        const code = row[col];
        if (!code) { html += '<div class="bc-empty-cell"></div>'; continue; }

        if (type === 'QR') {
          html += `<div class="bc-label-cell" style="height:72px">
            <img src="${_bcQRSrc(code, 56)}" style="width:52px;height:52px;display:block;margin:0 auto"
                 onerror="this.outerHTML='<div style=\\'width:52px;height:52px;background:#fef2f2;display:flex;align-items:center;justify-content:center;font-size:6px;color:#ef4444\\'>QR ERR</div>'">
            <div class="bc-label-code">${code}</div>
          </div>`;
        } else {
          const uid = `bc-svg-${Math.random().toString(36).slice(2)}`;
          html += `<div class="bc-label-cell"><svg id="${uid}" data-code="${code}" xmlns="http://www.w3.org/2000/svg"></svg><div class="bc-label-code">${code}</div></div>`;
        }
      }
      html += '</div>';
    });
    previewEl.innerHTML = html;

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

  function _bcGenerateTSPL2(labelBatches, labelType) {
    /*
      labelBatches: array of rows, each row = array of up to 6 sku_code strings
      Returns: Uint8Array of TSPL2 command bytes
    */
    let cmds = '';

    labelBatches.forEach((row) => {
      cmds += 'SIZE 110 mm, 15 mm\r\n';
      cmds += 'GAP 2 mm, 0 mm\r\n';
      cmds += 'DIRECTION 0\r\n';
      cmds += 'CLS\r\n';

      row.forEach((code, col) => {
        if (!code) return;
        const x = BC_X_POSITIONS[col];
        const y = 5; // 5 dots top margin inside label

        if (labelType === 'QR') {
          // QR code: QRCODE x, y, ECC level, cell width, mode, rotation, "data"
          cmds += `QRCODE ${x},${y},L,3,A,0,"${code}"\r\n`;
        } else {
          // CODE128: BARCODE x, y, type, height, readable, rotation, narrow, wide, "data"
          // height = 60 dots (~7.5mm), readable=1 (human readable below), narrow=2, wide=2
          cmds += `BARCODE ${x},${y},"128",60,1,0,2,2,"${code}"\r\n`;
        }
      });

      cmds += 'PRINT 1, 1\r\n';
    });

    return new TextEncoder().encode(cmds);
  }

  // ── Print via WebUSB ──────────────────────────────────────────────────
  window.bcPrint = async function() {
    const items    = _bcSelectedItems();
    const type     = document.getElementById('bc-type')?.value || 'CODE128';
    const printBtn = document.getElementById('bc-print-btn');

    if (!items.length) { alert('Please select at least one SKU to print.'); return; }

    // Expand by copies
    const expanded = [];
    items.forEach(({ code, copies }) => { for (let c = 0; c < copies; c++) expanded.push(code); });

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

    const isQR = labelType === 'QR';
    const totalLabels = batches.reduce((s, r) => s + r.filter(Boolean).length, 0);
    // Use absolute URL so the print window (different origin) can reach our server
    const origin = window.location.origin;

    let labelRows = '';
    batches.forEach((row) => {
      const cells = [];
      for (let col = 0; col < 6; col++) {
        const code = row[col] || '';
        if (!code) { cells.push('<td class="empty"></td>'); continue; }
        if (isQR) {
          const src = `${origin}/api/qr?data=${encodeURIComponent(code)}&size=120`;
          cells.push(`<td class="label-cell"><img src="${src}" class="qr-img"><div class="bc-txt">${code}</div></td>`);
        } else {
          cells.push(`<td class="label-cell"><svg data-code="${code}" class="bc-svg"></svg><div class="bc-txt">${code}</div></td>`);
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
  .label-sheet { padding:6mm; }
  table { border-collapse:separate; border-spacing:2mm; }
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
  // INIT
  // ─────────────────────────────────────────────────────────────────────────
  loadFormData();
  loadDashboard();
  loadPurchases();
});
