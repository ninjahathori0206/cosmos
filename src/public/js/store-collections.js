/* Store Collection Book — shared by StorePilot + Finance */

(function () {
  'use strict';

  const SC_LEDGER_PAGE = 150;
  const SC_EXPORT_LIMIT = 500;

  let _scMode = 'storepilot';
  let _scStoreId = null;
  let _scStoreName = '';
  let _scStoreCode = '';
  let _scSummary = null;
  let _scProviders = [];
  let _scPermissions = [];
  let _scLedgerKey = '';
  let _scDatePreset = 'all';
  let _scLedgerOffset = 0;
  let _scLedgerRows = [];
  let _scVoidTransferId = null;

  function scGetToken() {
    return sessionStorage.getItem('cosmos_token') || '';
  }

  async function scApiFetch(method, path, body) {
    let apiKey = '';
    try {
      apiKey = typeof window.cosmosEnsureApiKey === 'function'
        ? await window.cosmosEnsureApiKey()
        : '';
    } catch (e) {
      throw new Error(e.message || 'Invalid or missing API key');
    }
    if (!apiKey) throw new Error('Invalid or missing API key');
    const res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        Authorization: 'Bearer ' + scGetToken()
      },
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

  const scApiGet = (p) => scApiFetch('GET', p);
  const scApiPost = (p, b) => scApiFetch('POST', p, b);
  const scApiPut = (p, b) => scApiFetch('PUT', p, b);

  function scEsc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function scFmtRs(v) {
    const n = Number(v) || 0;
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function scIstToday() {
    return typeof window.cosmosIstToday === 'function' ? window.cosmosIstToday() : '';
  }

  function scFmtDate(v) {
    if (!v) return '—';
    if (typeof window.cosmosFmtDate === 'function') return window.cosmosFmtDate(v);
    try {
      return new Date(v).toLocaleDateString('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (_) {
      return String(v);
    }
  }

  function scFmtIsoDateIst(d) {
    if (!d) return '';
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
    if (typeof window.cosmosIstDateYmd === 'function') return window.cosmosIstDateYmd(d);
    return '';
  }

  function scIsSuperAdmin() {
    try {
      const u = JSON.parse(sessionStorage.getItem('cosmos_user') || '{}');
      return String(u.role || '').toLowerCase() === 'super_admin';
    } catch (_) {
      return false;
    }
  }

  function scHasPerm(key) {
    if (scIsSuperAdmin()) return true;
    return _scPermissions.includes(String(key).toLowerCase());
  }

  function scHasAnyPerm(keys) {
    if (scIsSuperAdmin()) return true;
    return (keys || []).some((k) => scHasPerm(k));
  }

  function scCanSettle() {
    return scHasAnyPerm(['storepilot.collections.settle', 'finance.collections.settle']);
  }

  function scStoreQuery() {
    return _scStoreId ? ('?store_id=' + encodeURIComponent(_scStoreId)) : '';
  }

  function scLedgerLabel(key) {
    const map = {
      store_cash: 'Store Cash',
      payment_machine: 'Payment Machine',
      store_bank: 'Store Bank',
      membership_store_cash: 'Membership Cash',
      membership_payment_machine: 'Membership Machine',
      membership_store_bank: 'Membership Bank'
    };
    return map[key] || key;
  }

  function scRowTypeLabel(row) {
    if (row.row_type === 'collection') return 'Collection';
    if (row.row_type === 'membership_collection') return 'Membership';
    if (row.row_type === 'cash_deposit') return 'Cash deposit';
    if (row.row_type === 'machine_settlement') return 'Machine settlement';
    if (row.row_type === 'bank_credit') return 'Bank credit';
    return row.row_type;
  }

  function scMethodLabel(sub) {
    const m = String(sub || '').toUpperCase();
    if (m === 'UPI') return 'UPI';
    if (m === 'CARD') return 'Card';
    if (m === 'CASH') return 'Cash';
    if (m === 'MACHINE') return 'Machine';
    return sub || '—';
  }

  function scGetDateRange() {
    const today = scIstToday();
    if (_scDatePreset === 'all') return { from: null, to: null };
    if (_scDatePreset === 'today') return { from: today, to: today };
    if (_scDatePreset === '7d') {
      const istStr = typeof window.cosmosIstToday === 'function' ? window.cosmosIstToday() : '';
      const [y, m, d] = istStr.split('-').map(Number);
      const anchor = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00+05:30`);
      const weekStart = new Date(anchor.getTime() - 6 * 864e5);
      const from = typeof window.cosmosIstDateYmd === 'function' ? window.cosmosIstDateYmd(weekStart) : '';
      return { from, to: today };
    }
    if (_scDatePreset === 'month') {
      const istStr = typeof window.cosmosIstToday === 'function' ? window.cosmosIstToday() : '';
      const [y, m] = istStr.split('-');
      return { from: `${y}-${m}-01`, to: today };
    }
    const fromEl = document.getElementById('sc-date-from');
    const toEl = document.getElementById('sc-date-to');
    const from = fromEl && fromEl.value ? fromEl.value : null;
    const to = toEl && toEl.value ? toEl.value : null;
    return { from, to };
  }

  function scSyncDateFilterUi() {
    const presetEl = document.getElementById('sc-date-preset');
    const fromEl = document.getElementById('sc-date-from');
    const toEl = document.getElementById('sc-date-to');
    if (presetEl) presetEl.value = _scDatePreset;
    const showCustom = _scDatePreset === 'custom';
    if (fromEl) {
      fromEl.hidden = !showCustom;
      if (showCustom && !fromEl.value) fromEl.value = scIstToday();
    }
    if (toEl) {
      toEl.hidden = !showCustom;
      if (showCustom && !toEl.value) toEl.value = scIstToday();
    }
  }

  function scSyncLedgerTabUi() {
    document.querySelectorAll('.sc-ledger-tab').forEach((btn) => {
      const key = btn.getAttribute('data-sc-ledger') || '';
      btn.classList.toggle('active', key === _scLedgerKey);
    });
  }

  function scResetLedgerFilters() {
    _scLedgerKey = '';
    _scDatePreset = 'all';
    _scLedgerOffset = 0;
    _scLedgerRows = [];
    scSyncLedgerTabUi();
    scSyncDateFilterUi();
  }

  function scBuildLedgerQuery(opts) {
    const o = opts || {};
    const range = scGetDateRange();
    const params = new URLSearchParams();
    if (_scStoreId) params.set('store_id', String(_scStoreId));
    if (_scLedgerKey) params.set('ledger_key', _scLedgerKey);
    if (range.from) params.set('from_date', range.from);
    if (range.to) params.set('to_date', range.to);
    params.set('offset', String(o.offset != null ? o.offset : _scLedgerOffset));
    params.set('limit', String(o.limit != null ? o.limit : SC_LEDGER_PAGE));
    return '?' + params.toString();
  }

  function scUpdateLoadMoreBtn(fetchedCount) {
    const btn = document.getElementById('sc-btn-load-more');
    if (!btn) return;
    const show = fetchedCount >= SC_LEDGER_PAGE && _scLedgerRows.length >= SC_LEDGER_PAGE;
    btn.hidden = !show;
  }

  function scCanVoidRow(row) {
    if (!scCanSettle()) return false;
    return row.row_type === 'cash_deposit' || row.row_type === 'machine_settlement';
  }

  function scRowNetAmount(row) {
    if (row.net_amount != null && row.net_amount !== '') return Number(row.net_amount);
    return Number(row.amount) || 0;
  }

  function scRenderLedgerRows(rows) {
    const tbody = document.getElementById('sc-ledger-tbody');
    if (!tbody) return;
    const colSpan = 8;
    if (!rows || !rows.length) {
      const hasFilters = _scLedgerKey || _scDatePreset !== 'all';
      const sub = hasFilters
        ? 'Try a wider date range or another ledger tab.'
        : 'Collections from POS and handover will appear here automatically.';
      tbody.innerHTML = '<tr><td colspan="' + colSpan + '"><div class="empty"><div class="empty-ic">💰</div><div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">No entries found</div><div style="font-size:13px;color:var(--text2)">' + scEsc(sub) + '</div></div></td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((r) => {
      const amt = r.direction === 'out' ? ('−' + scFmtRs(r.amount)) : ('+' + scFmtRs(r.amount));
      const amtClass = r.direction === 'out' ? 'sc-amt-out' : 'sc-amt-in';
      const ref = r.order_no || r.bank_ref || r.external_ref || '—';
      const charges = r.charges_amount != null && Number(r.charges_amount) > 0 ? scFmtRs(r.charges_amount) : '—';
      let actions = '';
      if (scCanVoidRow(r)) {
        actions = '<button type="button" class="btn sm sc-void-btn" data-sc-void-id="' + Number(r.source_id) + '" data-sc-void-type="' + scEsc(String(r.row_type)) + '" data-sc-void-amount="' + Number(r.amount) + '">Void</button>';
      }
      return '<tr class="' + (r.order_id ? 'tr-link' : '') + '">' +
        '<td>' + scFmtDate(r.entry_date) + '</td>' +
        '<td>' + scEsc(scRowTypeLabel(r)) + '</td>' +
        '<td>' + scEsc(scLedgerLabel(r.ledger_key)) + '</td>' +
        '<td>' + scEsc(scMethodLabel(r.sub_method)) + '</td>' +
        '<td class="text-right ' + amtClass + '">' + amt + '</td>' +
        '<td>' + scEsc(ref) + '</td>' +
        '<td class="text-right">' + charges + '</td>' +
        '<td class="text-right">' + actions + '</td>' +
        '</tr>';
    }).join('');
  }

  async function scLoadLedger(opts) {
    if (!_scStoreId) return;
    const append = opts && opts.append;
    const limit = (opts && opts.limit) || SC_LEDGER_PAGE;
    if (!append) {
      _scLedgerOffset = 0;
      _scLedgerRows = [];
      if (typeof cosmosSkeletonTable === 'function') cosmosSkeletonTable('sc-ledger-tbody', 8);
    }
    const q = scBuildLedgerQuery({ offset: _scLedgerOffset, limit });
    const ledRes = await scApiGet('/api/collections/ledger' + q);
    const batch = ledRes.data || [];
    if (append) {
      _scLedgerRows = _scLedgerRows.concat(batch);
    } else {
      _scLedgerRows = batch;
    }
    scRenderLedgerRows(_scLedgerRows);
    scUpdateLoadMoreBtn(batch.length);
  }

  function scApplyLedgerTab(key, btnEl) {
    _scLedgerKey = key || '';
    document.querySelectorAll('.sc-ledger-tab').forEach((b) => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    scLoadLedger().catch((e) => {
      if (typeof cosmosToastError === 'function') cosmosToastError(e.message);
    });
  }

  function scOnDatePresetChange() {
    const el = document.getElementById('sc-date-preset');
    _scDatePreset = el ? el.value : 'all';
    scSyncDateFilterUi();
    scLoadLedger().catch((e) => {
      if (typeof cosmosToastError === 'function') cosmosToastError(e.message);
    });
  }

  function scOnCustomDateChange() {
    if (_scDatePreset !== 'custom') return;
    scLoadLedger().catch((e) => {
      if (typeof cosmosToastError === 'function') cosmosToastError(e.message);
    });
  }

  function scLoadMoreLedger() {
    _scLedgerOffset += SC_LEDGER_PAGE;
    scLoadLedger({ append: true }).catch((e) => {
      _scLedgerOffset -= SC_LEDGER_PAGE;
      if (typeof cosmosToastError === 'function') cosmosToastError(e.message);
    });
  }

  function scCsvEscapeCell(val) {
    if (val == null || val === undefined) return '';
    const s = String(val);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function scDownloadCsv(filename, headers, rows) {
    if (typeof window.cosmosDownloadCsv === 'function') {
      window.cosmosDownloadCsv(filename, headers, rows);
      return;
    }
    if (!headers || !headers.length) return;
    const lineList = [headers.map(scCsvEscapeCell).join(',')];
    const dataRows = rows || [];
    for (let i = 0; i < dataRows.length; i++) {
      lineList.push(dataRows[i].map(scCsvEscapeCell).join(','));
    }
    const blob = new Blob(['\uFEFF' + lineList.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'export.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      a.remove();
    }, 2000);
  }

  function scLedgerRowToCsvArray(r) {
    const dir = r.direction === 'out' ? 'Out' : 'In';
    const amt = Number(r.amount) || 0;
    const charges = r.charges_amount != null && Number(r.charges_amount) > 0 ? Number(r.charges_amount).toFixed(2) : '';
    const net = scRowNetAmount(r);
    const ref = r.order_no || r.external_ref || '';
    const bankRef = r.bank_ref || '';
    return [
      scFmtIsoDateIst(r.entry_date),
      scRowTypeLabel(r),
      scLedgerLabel(r.ledger_key),
      scMethodLabel(r.sub_method),
      dir,
      amt.toFixed(2),
      charges,
      net.toFixed(2),
      ref,
      bankRef
    ];
  }

  async function scExportLedgerCsv() {
    if (!_scStoreId) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Open a store to export its ledger.');
      return;
    }
    const btn = document.getElementById('sc-btn-export-csv');
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      const q = scBuildLedgerQuery({ offset: 0, limit: SC_EXPORT_LIMIT });
      const ledRes = await scApiGet('/api/collections/ledger' + q);
      const rows = ledRes.data || [];
      if (!rows.length) {
        if (typeof cosmosToastWarn === 'function') cosmosToastWarn('No ledger rows to export for the current filters.');
        return;
      }
      const headers = ['Date', 'Type', 'Ledger', 'Method', 'Direction', 'Amount', 'Charges', 'Net', 'Reference', 'Bank ref'];
      const data = rows.map((r) => scLedgerRowToCsvArray(r));
      const slug = _scStoreCode || ('store-' + _scStoreId);
      const day = scIstToday();
      scDownloadCsv('collection-ledger-' + slug + '-' + day + '.csv', headers, data);
      if (typeof cosmosToastSuccess === 'function') {
        cosmosToastSuccess('Exported ' + rows.length + ' row(s) to CSV.');
      }
    } catch (e) {
      if (typeof cosmosToastError === 'function') cosmosToastError(e.message);
    } finally {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
    }
  }

  function scOpenVoidModal(transferId, rowType, amount) {
    _scVoidTransferId = transferId;
    const desc = document.getElementById('sc-void-desc');
    const typeLabel = rowType === 'machine_settlement' ? 'machine settlement' : 'cash deposit';
    if (desc) {
      desc.textContent = 'Void this ' + typeLabel + ' of ' + scFmtRs(amount) + '? Balances will be restored.';
    }
    const reason = document.getElementById('sc-void-reason');
    if (reason) reason.value = '';
    const err = document.getElementById('sc-void-error');
    if (err) err.style.display = 'none';
    document.getElementById('overlay-sc-void-transfer').classList.add('open');
  }

  window.scCloseVoidModal = function () {
    _scVoidTransferId = null;
    document.getElementById('overlay-sc-void-transfer').classList.remove('open');
  };

  window.scSubmitVoidTransfer = async function () {
    if (!_scVoidTransferId) return;
    const btn = document.getElementById('sc-void-submit');
    const errEl = document.getElementById('sc-void-error');
    if (typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      await scApiPut('/api/collections/transfers/' + _scVoidTransferId + '/void', {
        void_reason: (document.getElementById('sc-void-reason').value || '').trim() || null
      });
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Transfer voided.');
      scCloseVoidModal();
      await scLoadStoreDetail();
    } catch (e) {
      if (errEl) {
        errEl.textContent = e.message;
        errEl.style.display = 'block';
      }
      if (typeof cosmosToastError === 'function') cosmosToastError(e.message);
    } finally {
      if (typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
    }
  };

  async function scLoadMeta() {
    const res = await scApiGet('/api/meta/payment-machine-providers');
    _scProviders = (res.data && res.data.providers) || [];
  }

  function scHydratePermissions() {
    try {
      const u = JSON.parse(sessionStorage.getItem('cosmos_user') || '{}');
      _scPermissions = Array.isArray(u.permissions) ? u.permissions.map((p) => String(p).toLowerCase()) : [];
      if (_scMode === 'storepilot' && u.store_id) _scStoreId = Number(u.store_id);
    } catch (_) {
      _scPermissions = [];
    }
  }

  function scRenderSummaryCards(summary) {
    const el = document.getElementById('sc-summary-cards');
    if (!el || !summary) return;
    const machineLabel = summary.payment_machine && summary.payment_machine.provider_label
      ? summary.payment_machine.provider_label
      : 'Not configured';
    el.innerHTML = `
      <div class="sc-ledger-card" style="--sc-accent:var(--acc)">
        <div class="sc-ledger-label">Store Cash</div>
        <div class="sc-ledger-value">${scFmtRs(summary.store_cash_balance)}</div>
        <div class="sc-ledger-sub">Today collected ${scFmtRs(summary.collected_today_cash)}</div>
      </div>
      <div class="sc-ledger-card" style="--sc-accent:var(--gold)">
        <div class="sc-ledger-label">Payment Machine</div>
        <div class="sc-ledger-value">${scFmtRs(summary.machine_total_pending)}</div>
        <div class="sc-ledger-sub">${scEsc(machineLabel)} · UPI ${scFmtRs(summary.machine_upi_pending)} · Card ${scFmtRs(summary.machine_card_pending)}</div>
      </div>
      <div class="sc-ledger-card" style="--sc-accent:var(--green)">
        <div class="sc-ledger-label">Store Bank</div>
        <div class="sc-ledger-value">${scFmtRs(summary.store_bank_balance)}</div>
        <div class="sc-ledger-sub">${summary.bank_account ? scEsc(summary.bank_account.bank_name) + ' ···' + scEsc(String(summary.bank_account.account_no || '').slice(-4)) : 'Bank account not set'}</div>
      </div>
      <div class="sc-ledger-card" style="--sc-accent:var(--teal)">
        <div class="sc-ledger-label">Membership Cash</div>
        <div class="sc-ledger-value">${scFmtRs(summary.membership_store_cash_balance)}</div>
        <div class="sc-ledger-sub">Today ${scFmtRs(summary.membership_collected_today_cash)}</div>
      </div>
      <div class="sc-ledger-card" style="--sc-accent:var(--orange)">
        <div class="sc-ledger-label">Membership Machine</div>
        <div class="sc-ledger-value">${scFmtRs(summary.membership_machine_total_pending)}</div>
        <div class="sc-ledger-sub">UPI ${scFmtRs(summary.membership_machine_upi_pending)} · Card ${scFmtRs(summary.membership_machine_card_pending)}</div>
      </div>`;
  }

  function scRenderActions() {
    const el = document.getElementById('sc-actions');
    if (!el) return;
    const onStoreDetail = !!_scStoreId;
    const canDeposit = scHasAnyPerm(['storepilot.collections.deposit', 'finance.collections.deposit']);
    const canSettle = scCanSettle();
    const canManage = scHasAnyPerm(['finance.collections.bank_accounts.manage', 'finance.collections.machine.manage']);
    let html = '';
    if (onStoreDetail && canDeposit) {
      html += '<button type="button" class="btn primary sm" id="sc-btn-cash-deposit" onclick="scOpenCashDepositModal()">Record cash deposit</button>';
    }
    if (onStoreDetail && canSettle) {
      html += '<button type="button" class="btn sm" id="sc-btn-machine-settle" onclick="scOpenMachineSettlementModal()">Record machine settlement</button>';
    }
    if (_scMode === 'finance' && onStoreDetail && canManage) {
      html += '<button type="button" class="btn sm" onclick="scOpenTreasurySetupModal()">Store setup</button>';
    }
    if (_scMode === 'finance' && onStoreDetail) {
      html += '<button type="button" class="btn sm" onclick="scBackToStoresList()">← All stores</button>';
    }
    if (!html && _scMode === 'finance' && onStoreDetail && !canManage) {
      html = '<div class="sc-actions-hint">Need bank or machine setup? Ask admin to grant <strong>Collection Book — Manage store bank accounts</strong> and re-login.</div>';
    }
    el.innerHTML = html;
    el.style.display = html ? '' : 'none';
  }

  async function scLoadStoreDetail() {
    if (!_scStoreId) return;
    if (typeof cosmosSkeletonCards === 'function') cosmosSkeletonCards('sc-summary-cards', 5);
    const sumRes = await scApiGet('/api/collections/summary' + scStoreQuery());
    _scSummary = sumRes.data;
    if (_scSummary && _scSummary.store_code) _scStoreCode = _scSummary.store_code;
    scRenderSummaryCards(_scSummary);
    scRenderActions();
    await scLoadLedger();
    const titleEl = document.getElementById('sc-store-title');
    if (titleEl && _scMode === 'finance') {
      titleEl.textContent = _scStoreName
        ? (_scStoreName + ' — Collection Book')
        : ('Store #' + _scStoreId);
    }
  }

  function scRenderStoresTable(rows) {
    const wrap = document.getElementById('sc-stores-wrap');
    if (!wrap) return;
    if (!rows || !rows.length) {
      wrap.innerHTML = '<div class="empty"><div class="empty-ic">🏪</div><div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">No stores found</div></div>';
      return;
    }
    wrap.innerHTML = `<div class="cb" style="padding:0"><div class="tw"><table><thead><tr>
      <th>Store</th><th>Machine</th><th class="text-right">Store Cash</th><th class="text-right">Machine pending</th><th class="text-right">Store Bank</th><th></th>
    </tr></thead><tbody>${rows.map((r) => `<tr class="tr-link" data-sc-store-id="${r.store_id}" data-sc-store-name="${scEsc(r.store_name)}" data-sc-store-code="${scEsc(r.store_code || '')}">
      <td><div style="font-weight:600">${scEsc(r.store_name)}</div><div class="xs td3">${scEsc(r.store_code)}</div></td>
      <td>${scEsc(r.machine_provider_label || '—')}</td>
      <td class="text-right">${scFmtRs(r.store_cash_balance)}</td>
      <td class="text-right">${scFmtRs(r.machine_total_pending)}<div class="xs td3">UPI ${scFmtRs(r.machine_upi_pending)} · Card ${scFmtRs(r.machine_card_pending)}</div></td>
      <td class="text-right">${scFmtRs(r.store_bank_balance)}</td>
      <td><span class="xs" style="color:var(--acc)">View →</span></td>
    </tr>`).join('')}</tbody></table></div></div>`;
    wrap.querySelectorAll('tr[data-sc-store-id]').forEach((tr) => {
      tr.addEventListener('click', () => {
        scOpenStore(
          Number(tr.getAttribute('data-sc-store-id')),
          tr.getAttribute('data-sc-store-name'),
          tr.getAttribute('data-sc-store-code') || ''
        );
      });
    });
  }

  async function scLoadFinanceRollup() {
    const storesPanel = document.getElementById('sc-stores-panel');
    const detailPanel = document.getElementById('sc-detail-panel');
    if (_scStoreId) {
      if (storesPanel) storesPanel.style.display = 'none';
      if (detailPanel) detailPanel.style.display = '';
      await scLoadStoreDetail();
      return;
    }
    if (storesPanel) storesPanel.style.display = '';
    if (detailPanel) detailPanel.style.display = 'none';
    const titleEl = document.getElementById('sc-store-title');
    if (titleEl) titleEl.textContent = 'All stores — Store Cash, Payment Machine, and Store Bank ledgers.';
    if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('sc-stores-wrap', 8);
    const res = await scApiGet('/api/collections/stores-summary');
    scRenderStoresTable(res.data || []);
    scRenderActions();
  }

  window.scOpenStore = function (storeId, storeName, storeCode) {
    _scStoreId = Number(storeId);
    _scStoreName = storeName || '';
    _scStoreCode = storeCode || '';
    scResetLedgerFilters();
    const titleEl = document.getElementById('sc-store-title');
    if (titleEl) titleEl.textContent = _scStoreName ? (_scStoreName + ' — Collection Book') : ('Store #' + storeId);
    scLoadFinanceRollup();
  };

  window.scBackToStoresList = function () {
    _scStoreId = null;
    _scStoreName = '';
    _scStoreCode = '';
    const titleEl = document.getElementById('sc-store-title');
    if (titleEl) titleEl.textContent = '';
    scLoadFinanceRollup();
  };

  window.scOpenCashDepositModal = function () {
    if (!_scSummary || !_scSummary.bank_account) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Configure a store bank account before recording deposits.');
      return;
    }
    document.getElementById('sc-cd-amount').value = '';
    document.getElementById('sc-cd-ref').value = '';
    document.getElementById('sc-cd-date').value = scIstToday();
    document.getElementById('sc-cd-notes').value = '';
    document.getElementById('sc-cd-error').style.display = 'none';
    let hint = document.getElementById('sc-cd-balance-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'sc-cd-balance-hint';
      hint.className = 'xs td3';
      hint.style.marginBottom = '10px';
      const amountGrp = document.getElementById('sc-cd-amount');
      if (amountGrp && amountGrp.parentElement) {
        amountGrp.parentElement.insertBefore(hint, amountGrp.nextSibling);
      }
    }
    const avail = Number(_scSummary.store_cash_balance) || 0;
    hint.textContent = 'Available Store Cash: ' + scFmtRs(avail);
    document.getElementById('overlay-sc-cash-deposit').classList.add('open');
  };

  window.scCloseCashDepositModal = function () {
    document.getElementById('overlay-sc-cash-deposit').classList.remove('open');
  };

  window.scSubmitCashDeposit = async function () {
    const btn = document.getElementById('sc-cd-submit');
    const amountEl = document.getElementById('sc-cd-amount');
    const refEl = document.getElementById('sc-cd-ref');
    const dateEl = document.getElementById('sc-cd-date');
    const errEl = document.getElementById('sc-cd-error');
    const amount = Number(amountEl.value);
    if (!amount || amount <= 0) {
      if (typeof cosmosFieldError === 'function') cosmosFieldError(amountEl, 'Enter a valid amount');
      return;
    }
    const availCash = _scSummary ? Number(_scSummary.store_cash_balance) || 0 : 0;
    if (amount > availCash + 0.02) {
      if (typeof cosmosFieldError === 'function') {
        cosmosFieldError(amountEl, 'Amount exceeds Store Cash balance (' + scFmtRs(availCash) + ')');
      }
      return;
    }
    if (typeof cosmosFieldClear === 'function') cosmosFieldClear(amountEl);
    if (!dateEl.value) {
      if (typeof cosmosFieldError === 'function') cosmosFieldError(dateEl, 'Deposit date required');
      return;
    }
    if (typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      await scApiPost('/api/collections/cash-deposit', {
        store_id: _scStoreId || undefined,
        gross_amount: amount,
        bank_ref: refEl.value.trim() || null,
        transfer_date: dateEl.value,
        notes: document.getElementById('sc-cd-notes').value.trim() || null
      });
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Cash deposit recorded.');
      scCloseCashDepositModal();
      if (_scMode === 'finance') await scLoadFinanceRollup();
      else await scLoadStoreDetail();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.style.display = 'block';
      if (typeof cosmosToastError === 'function') cosmosToastError(e.message);
    } finally {
      if (typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
    }
  };

  window.scOpenMachineSettlementModal = function () {
    if (!_scSummary || !_scSummary.bank_account) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Configure a store bank account before recording settlements.');
      return;
    }
    const today = scIstToday();
    const from = _scSummary.unsettled_machine_from || today;
    const to = _scSummary.unsettled_machine_to || today;
    document.getElementById('sc-ms-from').value = from;
    document.getElementById('sc-ms-to').value = to;
    document.getElementById('sc-ms-gross').value = '';
    document.getElementById('sc-ms-charges').value = '';
    document.getElementById('sc-ms-net').value = '';
    document.getElementById('sc-ms-ref').value = '';
    document.getElementById('sc-ms-date').value = today;
    document.getElementById('sc-ms-breakdown').textContent = '';
    document.getElementById('sc-ms-error').style.display = 'none';
    const modalTitle = document.getElementById('sc-ms-modal-title');
    if (modalTitle) {
      modalTitle.textContent = _scStoreName
        ? ('Record machine settlement — ' + _scStoreName)
        : 'Record machine settlement';
    }
    document.getElementById('overlay-sc-machine-settlement').classList.add('open');
    scRefreshMachineSuggest();
  };

  window.scCloseMachineSettlementModal = function () {
    document.getElementById('overlay-sc-machine-settlement').classList.remove('open');
  };

  function scRecalcNet() {
    const gross = Number(document.getElementById('sc-ms-gross').value) || 0;
    const charges = Number(document.getElementById('sc-ms-charges').value) || 0;
    document.getElementById('sc-ms-net').value = Math.max(0, gross - charges).toFixed(2);
  }

  window.scRefreshMachineSuggest = async function () {
    const from = document.getElementById('sc-ms-from').value;
    const to = document.getElementById('sc-ms-to').value;
    if (!from || !to) return;
    try {
      const q = scStoreQuery();
      const sep = q ? '&' : '?';
      const res = await scApiGet('/api/collections/suggest-machine-gross' + q + sep + 'period_from=' + encodeURIComponent(from) + '&period_to=' + encodeURIComponent(to));
      const d = res.data || {};
      document.getElementById('sc-ms-gross').value = (d.total_gross || 0).toFixed(2);
      document.getElementById('sc-ms-breakdown').textContent =
        'Unsettled in this period — UPI ' + scFmtRs(d.upi_gross) + ' · Card ' + scFmtRs(d.card_gross)
        + ' · Total ' + scFmtRs(d.total_gross);
      scRecalcNet();
    } catch (e) {
      if (typeof cosmosToastError === 'function') cosmosToastError(e.message);
    }
  };

  window.scSubmitMachineSettlement = async function () {
    const btn = document.getElementById('sc-ms-submit');
    const gross = Number(document.getElementById('sc-ms-gross').value);
    const charges = Number(document.getElementById('sc-ms-charges').value) || 0;
    const net = Number(document.getElementById('sc-ms-net').value);
    const errEl = document.getElementById('sc-ms-error');
    if (!gross || gross <= 0) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Enter settlement gross amount.');
      return;
    }
    if (typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      await scApiPost('/api/collections/machine-settlement', {
        store_id: _scStoreId || undefined,
        period_from: document.getElementById('sc-ms-from').value,
        period_to: document.getElementById('sc-ms-to').value,
        gross_amount: gross,
        charges_amount: charges,
        net_amount: net,
        bank_ref: document.getElementById('sc-ms-ref').value.trim() || null,
        transfer_date: document.getElementById('sc-ms-date').value,
        notes: document.getElementById('sc-ms-notes').value.trim() || null
      });
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Machine settlement recorded.');
      scCloseMachineSettlementModal();
      if (_scMode === 'finance') await scLoadFinanceRollup();
      else await scLoadStoreDetail();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.style.display = 'block';
      if (typeof cosmosToastError === 'function') cosmosToastError(e.message);
    } finally {
      if (typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
    }
  };

  window.scOpenTreasurySetupModal = function () {
    if (!_scStoreId) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Open a store first.');
      return;
    }
    const bank = (_scSummary && _scSummary.bank_account) || {};
    const machine = (_scSummary && _scSummary.payment_machine) || {};
    document.getElementById('sc-setup-bank-name').value = bank.bank_name || '';
    document.getElementById('sc-setup-account-no').value = bank.account_no || '';
    document.getElementById('sc-setup-ifsc').value = bank.ifsc || '';
    document.getElementById('sc-setup-holder').value = bank.account_holder || '';
    const provSel = document.getElementById('sc-setup-provider');
    provSel.innerHTML = _scProviders.map((p) =>
      `<option value="${scEsc(p.key)}" ${machine.provider_key === p.key ? 'selected' : ''}>${scEsc(p.label)}</option>`
    ).join('');
    document.getElementById('sc-setup-merchant').value = machine.merchant_id || '';
    document.getElementById('sc-setup-terminal').value = machine.terminal_label || '';
    document.getElementById('sc-setup-error').style.display = 'none';
    document.getElementById('overlay-sc-treasury-setup').classList.add('open');
  };

  window.scCloseTreasurySetupModal = function () {
    document.getElementById('overlay-sc-treasury-setup').classList.remove('open');
  };

  window.scSubmitTreasurySetup = async function () {
    const btn = document.getElementById('sc-setup-submit');
    const errEl = document.getElementById('sc-setup-error');
    if (typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      await scApiPost('/api/collections/bank-account', {
        store_id: _scStoreId,
        bank_name: document.getElementById('sc-setup-bank-name').value.trim(),
        account_no: document.getElementById('sc-setup-account-no').value.trim(),
        ifsc: document.getElementById('sc-setup-ifsc').value.trim() || null,
        account_holder: document.getElementById('sc-setup-holder').value.trim() || null,
        bank_account_id: (_scSummary && _scSummary.bank_account && _scSummary.bank_account.bank_account_id) || null
      });
      await scApiPost('/api/collections/payment-machine', {
        store_id: _scStoreId,
        provider_key: document.getElementById('sc-setup-provider').value,
        merchant_id: document.getElementById('sc-setup-merchant').value.trim() || null,
        terminal_label: document.getElementById('sc-setup-terminal').value.trim() || null
      });
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Store treasury setup saved.');
      scCloseTreasurySetupModal();
      await scLoadStoreDetail();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.style.display = 'block';
      if (typeof cosmosToastError === 'function') cosmosToastError(e.message);
    } finally {
      if (typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
    }
  };

  window.loadStoreCollections = async function (mode) {
    _scMode = mode === 'finance' ? 'finance' : 'storepilot';
    scBootstrapLedgerUi();
    if (typeof window.cosmosRefreshSession === 'function') {
      try { await window.cosmosRefreshSession(); } catch (_) {}
    }
    scHydratePermissions();
    try {
      await scLoadMeta();
      if (_scMode === 'finance') {
        if (!_scStoreId) _scStoreId = null;
        await scLoadFinanceRollup();
      } else {
        if (!_scStoreId) {
          const wrap = document.getElementById('sc-detail-panel');
          if (wrap) {
            wrap.innerHTML = '<div class="card"><div class="cb"><div style="font-weight:600;color:var(--text1);margin-bottom:6px">No store assigned</div><div style="color:var(--text2)">Your account needs a store assignment to view the Collection Book.</div></div></div>';
          }
          return;
        }
        const storesPanel = document.getElementById('sc-stores-panel');
        const detailPanel = document.getElementById('sc-detail-panel');
        if (storesPanel) storesPanel.style.display = 'none';
        if (detailPanel) detailPanel.style.display = '';
        scResetLedgerFilters();
        await scLoadStoreDetail();
      }
    } catch (e) {
      if (typeof cosmosToastError === 'function') cosmosToastError(e.message || 'Failed to load Collection Book.');
    }
  };

  function scInitLedgerUi() {
    const page = document.getElementById('page-collections');
    if (!page || page.getAttribute('data-sc-ui-init') === '1') return;
    page.setAttribute('data-sc-ui-init', '1');

    page.querySelectorAll('.sc-ledger-tab').forEach((btn) => {
      btn.addEventListener('click', function () {
        scApplyLedgerTab(btn.getAttribute('data-sc-ledger') || '', btn);
      });
    });

    const preset = document.getElementById('sc-date-preset');
    if (preset) preset.addEventListener('change', scOnDatePresetChange);

    const fromEl = document.getElementById('sc-date-from');
    const toEl = document.getElementById('sc-date-to');
    if (fromEl) fromEl.addEventListener('change', scOnCustomDateChange);
    if (toEl) toEl.addEventListener('change', scOnCustomDateChange);

    const exportBtn = document.getElementById('sc-btn-export-csv');
    if (exportBtn) exportBtn.addEventListener('click', function () { scExportLedgerCsv(); });

    const loadMoreBtn = document.getElementById('sc-btn-load-more');
    if (loadMoreBtn) loadMoreBtn.addEventListener('click', scLoadMoreLedger);

    const tbody = document.getElementById('sc-ledger-tbody');
    if (tbody && tbody.getAttribute('data-sc-delegate') !== '1') {
      tbody.setAttribute('data-sc-delegate', '1');
      tbody.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-sc-void-id]');
        if (!btn) return;
        scOpenVoidModal(
          Number(btn.getAttribute('data-sc-void-id')),
          btn.getAttribute('data-sc-void-type'),
          Number(btn.getAttribute('data-sc-void-amount'))
        );
      });
    }
  }

  function scBootstrapLedgerUi() {
    scInitLedgerUi();
  }

  window.scSetLedgerTab = scApplyLedgerTab;
  window.scOnDatePresetChange = scOnDatePresetChange;
  window.scOnCustomDateChange = scOnCustomDateChange;
  window.scLoadMoreLedger = scLoadMoreLedger;
  window.scExportLedgerCsv = scExportLedgerCsv;
  window.scOpenVoidModal = scOpenVoidModal;

  document.addEventListener('input', function (e) {
    if (e.target && (e.target.id === 'sc-ms-charges' || e.target.id === 'sc-ms-gross')) scRecalcNet();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scBootstrapLedgerUi);
  } else {
    scBootstrapLedgerUi();
  }
})();
