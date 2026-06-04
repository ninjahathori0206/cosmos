/**
 * CX module — GatePass visitors queue
 * Adapted from storepilot-gatepass.js; uses cxApiFetch via cxGpApi* wrappers.
 */
(function () {
  'use strict';

  var _cxGpPollTimer   = null;
  var _cxGpActiveVisitor = null;
  var _cxGpPurposeOptions = null;
  var _cxGpCxCheckinInstance = null;
  var _cxGpFabOpen    = false;

  /* ── helpers ──────────────────────────────────────────────────────────── */

  function cxGpHasPerm(key) {
    try {
      var u = JSON.parse(sessionStorage.getItem('cosmos_user') || '{}');
      if (String(u.role || '').toLowerCase() === 'super_admin') return true;
    } catch (_e) { /* ignore */ }
    if (typeof hasAnyPermission === 'function') return hasAnyPermission([key]);
    if (typeof window.cosmosCxAllows === 'function') return window.cosmosCxAllows([key]);
    return false;
  }

  function cxGpStoreId() {
    try {
      var sel = document.getElementById('cx-gp-store-sel');
      if (sel && sel.value) return Number(sel.value);
      var u = JSON.parse(sessionStorage.getItem('cosmos_user') || '{}');
      if (u.store_id != null) return Number(u.store_id);
    } catch (_e) { /* ignore */ }
    return null;
  }

  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function cxGpApi(method, path, body) {
    if (typeof cxApiFetch === 'function') {
      return cxApiFetch(method, path, body).then(function (r) {
        return r && r.data !== undefined ? r.data : r;
      });
    }
    // Fallback: use cosmos-ui-polish apiFetch if available
    if (method === 'GET' && typeof apiGet === 'function') {
      return apiGet(path).then(function (r) {
        if (!r || r.success === false) throw new Error((r && r.message) || 'Request failed');
        return r.data;
      });
    }
    return Promise.reject(new Error('No API function available'));
  }

  function cxGpApiGet(path)          { return cxGpApi('GET', path); }
  function cxGpApiPost(path, body)   { return cxGpApi('POST', path, body); }
  function cxGpApiPatch(path, body)  { return cxGpApi('PATCH', path, body); }

  /* ── initials / avatar helpers ───────────────────────────────────────── */

  function cxGpInitials(name) {
    var p = String(name || '').trim().split(/\s+/);
    if (!p[0]) return '?';
    return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase();
  }

  /* ── FAB bubble contacts ─────────────────────────────────────────────── */

  function cxGpBuildBubble(v, isExited) {
    var item = document.createElement('button');
    item.type = 'button';
    item.className = 'sp-gp-contact-item' + (isExited ? ' sp-gp-contact-item--exited' : '');
    item.setAttribute('role', 'listitem');
    var avatarCls = isExited
      ? 'sp-gp-contact-avatar--exited'
      : (v.status === 'in_service' ? 'sp-gp-contact-avatar--inservice' : 'sp-gp-contact-avatar--waiting');
    var statusLabel = isExited ? 'Exited' : (v.status === 'in_service' ? 'In service' : 'Waiting');
    var firstName = String(v.name || '').split(' ')[0].slice(0, 8);
    item.innerHTML =
      '<div class="sp-gp-contact-avatar ' + avatarCls + '">' + escHtml(cxGpInitials(v.name)) + '</div>'
      + '<div class="sp-gp-contact-name">' + escHtml(firstName) + '</div>'
      + '<div class="sp-gp-contact-status">' + escHtml(statusLabel) + '</div>';
    item.addEventListener('click', function () {
      cxGpFabClose();
      cxGpOpenActionsSheet(v);
    });
    return item;
  }

  function cxGpRenderContacts(inStore, exited) {
    var container = document.getElementById('cx-gp-contacts-container');
    if (!container) return;
    container.innerHTML = '';
    if (inStore.length) {
      var lbl1 = document.createElement('div');
      lbl1.className = 'sp-gp-section-label';
      lbl1.textContent = 'In store';
      container.appendChild(lbl1);
      var row1 = document.createElement('div');
      row1.className = 'sp-gp-contacts-row';
      inStore.forEach(function (v) { row1.appendChild(cxGpBuildBubble(v, false)); });
      container.appendChild(row1);
    }
    if (exited.length) {
      var lbl2 = document.createElement('div');
      lbl2.className = 'sp-gp-section-label';
      lbl2.style.marginTop = inStore.length ? '14px' : '0';
      lbl2.textContent = 'Exited · 24 h';
      container.appendChild(lbl2);
      var row2 = document.createElement('div');
      row2.className = 'sp-gp-contacts-row';
      exited.slice(0, 3).forEach(function (v) { row2.appendChild(cxGpBuildBubble(v, true)); });
      container.appendChild(row2);
    }
    if (!inStore.length && !exited.length) {
      var empty = document.createElement('div');
      empty.style.cssText = 'font-size:13px;color:var(--text2);padding:8px 0;text-align:center';
      empty.textContent = 'No visitors today.';
      container.appendChild(empty);
    }
  }

  /* ── FAB open / close ────────────────────────────────────────────────── */

  function cxGpFabOpen() {
    var panel = document.getElementById('cx-gp-fab-panel');
    var fab   = document.getElementById('cx-gp-fab');
    if (!panel) return;
    panel.hidden = false;
    _cxGpFabOpen = true;
    if (fab) fab.setAttribute('aria-expanded', 'true');
    setTimeout(function () {
      document.addEventListener('click', _cxGpOutsideClick, { capture: true, once: true });
      document.addEventListener('keydown', _cxGpEscKey);
    }, 10);
  }

  function cxGpFabClose() {
    var panel = document.getElementById('cx-gp-fab-panel');
    var fab   = document.getElementById('cx-gp-fab');
    if (!panel) return;
    panel.hidden = true;
    _cxGpFabOpen = false;
    if (fab) fab.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', _cxGpOutsideClick, { capture: true });
    document.removeEventListener('keydown', _cxGpEscKey);
  }

  function _cxGpOutsideClick(e) {
    var root = document.getElementById('cx-gp-fab-root');
    if (root && !root.contains(e.target)) cxGpFabClose();
  }

  function _cxGpEscKey(e) {
    if (e.key === 'Escape') cxGpFabClose();
  }

  function cxGpFabToggle() {
    if (_cxGpFabOpen) { cxGpFabClose(); } else { cxGpFabOpen(); }
  }

  /* ── phone / CX helpers ──────────────────────────────────────────────── */

  function cxGpNormalizePhone(raw) {
    if (window.cosmosCxSearch && window.cosmosCxSearch.normalizeDigits) {
      return window.cosmosCxSearch.normalizeDigits(raw);
    }
    var d = String(raw || '').replace(/\D/g, '');
    if (d.length === 12 && d.indexOf('91') === 0) return d.slice(2);
    if (d.length >= 10) return d.slice(-10);
    return d;
  }

  function cxGpCanSearchCx() {
    return cxGpHasPerm('pos.customers.view') || cxGpHasPerm('cx.customers.view');
  }

  /* ── purpose helpers ─────────────────────────────────────────────────── */

  function cxGpPurposeLabel(key) {
    if (!_cxGpPurposeOptions || !key) return key || '';
    for (var i = 0; i < _cxGpPurposeOptions.length; i++) {
      if (_cxGpPurposeOptions[i].key === key) return _cxGpPurposeOptions[i].label;
    }
    return key;
  }

  function cxGpFillPurposeSelect(sel) {
    if (!sel) return;
    sel.innerHTML = '<option value="">— Optional —</option>';
    (_cxGpPurposeOptions || []).forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.key;
      opt.textContent = p.label;
      sel.appendChild(opt);
    });
  }

  /* ── status badge ────────────────────────────────────────────────────── */

  function cxGpStatusBadge(status) {
    var s = String(status || '').toLowerCase();
    var cls = 'sp-gp-badge sp-gp-badge--gray';
    var label = s;
    if (s === 'waiting')    { cls = 'sp-gp-badge sp-gp-badge--amber'; label = 'Waiting'; }
    if (s === 'in_service') { cls = 'sp-gp-badge sp-gp-badge--blue';  label = 'In service'; }
    if (s === 'completed')  { cls = 'sp-gp-badge sp-gp-badge--green'; label = 'Completed'; }
    if (s === 'no_show')    { cls = 'sp-gp-badge sp-gp-badge--red';   label = 'No show'; }
    if (s === 'expired')    { cls = 'sp-gp-badge sp-gp-badge--gray';  label = 'Expired'; }
    return '<span class="' + cls + '">' + escHtml(label) + '</span>';
  }

  /* ── visitors table ──────────────────────────────────────────────────── */

  function cxGpRenderVisitorsTable(rows) {
    var tbody = document.getElementById('cx-gp-visitors-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!rows || !rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="7"><div class="empty" style="padding:24px;text-align:center">'
        + '<div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">No visitors in queue</div>'
        + '<div style="font-size:13px;color:var(--text2);margin-bottom:16px">Check in a walk-in to start the queue.</div>'
        + (cxGpHasPerm('gatepass.checkin')
          ? '<button type="button" class="btn primary" onclick="cxGpOpenCheckInModal()">+ Check In</button>'
          : '')
        + '</div></td></tr>';
      return;
    }
    rows.forEach(function (v) {
      var tr = document.createElement('tr');
      tr.className = 'tr-link';
      var linked = v.has_customer || v.customer_id;
      var dot = linked ? 'var(--green)' : 'var(--gold)';
      var wm = v.wait_minutes != null ? Number(v.wait_minutes) : 0;
      var waitCls = wm > 20 ? ' style="color:var(--orange)"' : '';
      var fmtTime = typeof cosmosFmtDateTime === 'function' ? cosmosFmtDateTime(v.checkin_at) : String(v.checkin_at || '');
      tr.innerHTML =
        '<td><div style="font-weight:600">' + escHtml(v.name) + '</div>'
        + '<div style="font-size:12px;color:var(--text3)"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:' + dot + ';margin-right:4px"></span>'
        + escHtml(v.phone || '') + '</div></td>'
        + '<td>' + escHtml(cxGpPurposeLabel(v.purpose)) + '</td>'
        + '<td' + waitCls + '>⏱ ' + wm + 'm</td>'
        + '<td>' + escHtml(v.assigned_staff_name || '—') + '</td>'
        + '<td>' + cxGpStatusBadge(v.status) + '</td>'
        + '<td style="font-size:12px;color:var(--text3)">' + escHtml(fmtTime) + '</td>'
        + '<td><button type="button" class="btn sm" data-cx-gp-act="' + v.visitor_id + '">Actions</button></td>';
      tr.querySelector('[data-cx-gp-act]').addEventListener('click', function (e) {
        e.stopPropagation();
        cxGpOpenActionsSheet(v);
      });
      tr.addEventListener('click', function () { cxGpOpenActionsSheet(v); });
      tbody.appendChild(tr);
    });
  }

  /* ── store selector ──────────────────────────────────────────────────── */

  async function cxGpPopulateStoreSel() {
    var storeId = null;
    try {
      var u = JSON.parse(sessionStorage.getItem('cosmos_user') || '{}');
      storeId = u.store_id != null ? Number(u.store_id) : null;
    } catch (_e) { /* ignore */ }

    var wrap = document.getElementById('cx-gp-store-sel-wrap');
    if (!wrap) return;

    if (storeId) {
      // Single-store staff — hide selector, set hidden input
      wrap.hidden = true;
      var sel = document.getElementById('cx-gp-store-sel');
      if (sel) {
        // Create option if empty
        if (!sel.options.length) {
          var opt = document.createElement('option');
          opt.value = String(storeId);
          sel.appendChild(opt);
        }
        sel.value = String(storeId);
      }
      return;
    }

    // Multi-store / admin: load stores list
    try {
      var stores = await cxGpApiGet('/api/stores');
      var sel2 = document.getElementById('cx-gp-store-sel');
      if (!sel2) return;
      sel2.innerHTML = '<option value="">— Select store —</option>';
      (Array.isArray(stores) ? stores : (stores && stores.data) || []).forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = String(s.store_id);
        opt.textContent = s.store_name || s.name || ('Store ' + s.store_id);
        sel2.appendChild(opt);
      });
      wrap.hidden = false;
      sel2.addEventListener('change', function () {
        if (sel2.value) void cxGpLoadVisitorsPage();
      });
    } catch (_e) {
      wrap.hidden = true;
    }
  }

  /* ── visitors page load ──────────────────────────────────────────────── */

  async function cxGpLoadVisitorsPage() {
    if (!cxGpHasPerm('gatepass.view')) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Visitor queue permission required (gatepass.view).');
      return;
    }
    var storeId = cxGpStoreId();
    if (!storeId) {
      var tbody0 = document.getElementById('cx-gp-visitors-tbody');
      if (tbody0) {
        tbody0.innerHTML = '<tr><td colspan="7" class="td-muted" style="text-align:center;padding:20px">Select a store to view the queue.</td></tr>';
      }
      return;
    }
    if (!_cxGpPurposeOptions) {
      try { _cxGpPurposeOptions = await cxGpApiGet('/api/meta/gatepass-purposes'); }
      catch (_e) { _cxGpPurposeOptions = []; }
    }
    var filterEl  = document.getElementById('cx-gp-visitors-filter');
    var q         = filterEl ? filterEl.value.trim() : '';
    var statusEl  = document.getElementById('cx-gp-visitors-status-filter');
    var statusFilter = statusEl ? statusEl.value : '';
    if (typeof cosmosSkeletonTable === 'function') cosmosSkeletonTable('cx-gp-visitors-tbody', 7, 6);
    try {
      var path = '/api/gatepass/queue/' + encodeURIComponent(storeId);
      if (statusFilter) path += '?status=' + encodeURIComponent(statusFilter);
      var rows = await cxGpApiGet(path);
      if (q) {
        var ql = q.toLowerCase();
        rows = (rows || []).filter(function (v) {
          return String(v.name || '').toLowerCase().indexOf(ql) >= 0
            || String(v.phone || '').indexOf(ql) >= 0;
        });
      }
      cxGpRenderVisitorsTable(rows);
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
      var tbody = document.getElementById('cx-gp-visitors-tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="td-muted">Failed to load queue.</td></tr>';
    }
  }

  /* ── check-in modal ──────────────────────────────────────────────────── */

  function cxGpOpenCheckInModal(prefillPhone, prefillName) {
    if (!cxGpHasPerm('gatepass.checkin')) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Check-in permission required.');
      return;
    }
    var overlay = document.getElementById('overlay-cx-gatepass-checkin');
    if (!overlay) return;
    var phoneEl   = document.getElementById('cx-gatepass-checkin-phone');
    var nameEl    = document.getElementById('cx-gatepass-checkin-name');
    var notesEl   = document.getElementById('cx-gatepass-checkin-notes');
    var purposeEl = document.getElementById('cx-gatepass-checkin-purpose');
    cxGpFillPurposeSelect(purposeEl);
    if (phoneEl) { phoneEl.value = prefillPhone || ''; if (typeof cosmosFieldClear === 'function') cosmosFieldClear(phoneEl); }
    if (nameEl)  { nameEl.value  = prefillName  || ''; if (typeof cosmosFieldClear === 'function') cosmosFieldClear(nameEl); }
    if (notesEl) notesEl.value = '';
    var bubble = document.getElementById('cx-ci-bubble-results');
    if (bubble) { bubble.innerHTML = ''; bubble.hidden = true; }
    overlay.style.display = 'flex';
    overlay.classList.add('open');
  }

  function cxGpCloseCheckInModal() {
    var overlay = document.getElementById('overlay-cx-gatepass-checkin');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.style.display = 'none';
  }

  async function cxGpSubmitCheckIn(btn) {
    var phoneEl   = document.getElementById('cx-gatepass-checkin-phone');
    var nameEl    = document.getElementById('cx-gatepass-checkin-name');
    var purposeEl = document.getElementById('cx-gatepass-checkin-purpose');
    var notesEl   = document.getElementById('cx-gatepass-checkin-notes');
    var name  = nameEl  ? nameEl.value.trim() : '';
    var phone = phoneEl ? String(phoneEl.value || '').replace(/\D/g, '').slice(-10) : '';
    if (phone.length !== 10) {
      if (phoneEl && typeof cosmosFieldError === 'function') cosmosFieldError(phoneEl, 'Enter a valid 10-digit mobile');
      return;
    }
    if (!name) {
      if (nameEl && typeof cosmosFieldError === 'function') cosmosFieldError(nameEl, 'Required');
      return;
    }
    var storeId = cxGpStoreId();
    if (!storeId) { if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Select a store first.'); return; }
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      await cxGpApiPost('/api/gatepass/checkin', {
        name: name,
        phone: phone,
        store_id: storeId,
        channel: 'staff_cx',
        purpose: purposeEl && purposeEl.value ? purposeEl.value : null,
        notes: notesEl && notesEl.value ? notesEl.value.trim() : null
      });
      if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn);
      cxGpCloseCheckInModal();
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Visitor checked in');
      void cxGpLoadVisitorsPage();
      void cxGpRefreshWidget();
    } catch (err) {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
      var msg = err && err.message ? err.message : 'Check-in failed';
      if (/already in the visitor queue/i.test(msg) && phoneEl && typeof cosmosFieldError === 'function') {
        cosmosFieldError(phoneEl, msg);
        if (typeof cosmosToastWarn === 'function') cosmosToastWarn(msg);
      } else if (typeof cosmosToastError === 'function') {
        cosmosToastError(msg);
      }
    }
  }

  /* ── actions sheet ───────────────────────────────────────────────────── */

  function cxGpOpenActionsSheet(visitor) {
    _cxGpActiveVisitor = visitor;
    var overlay = document.getElementById('overlay-cx-gatepass-actions');
    if (!overlay) return;
    var sum = document.getElementById('cx-gatepass-actions-summary');
    if (sum) {
      sum.innerHTML =
        '<div style="font-weight:600;font-size:15px;margin-bottom:4px">' + escHtml(visitor.name) + '</div>'
        + '<div style="font-size:13px;color:var(--text2)">' + escHtml(visitor.phone || '') + '</div>'
        + '<div style="margin-top:8px">' + cxGpStatusBadge(visitor.status) + '</div>';
    }
    var inSvc   = document.getElementById('cx-gatepass-action-inservice');
    var closeBtn = document.getElementById('cx-gatepass-action-close');
    var assignBtn = document.getElementById('cx-gatepass-action-assign');
    var addRxBtn  = document.getElementById('cx-gatepass-action-add-rx');
    if (addRxBtn)  addRxBtn.hidden  = !cxGpHasPerm('gatepass.action');
    if (assignBtn) assignBtn.hidden = !cxGpHasPerm('gatepass.action');
    if (inSvc)     inSvc.hidden     = !cxGpHasPerm('gatepass.action') || visitor.status !== 'waiting';
    if (closeBtn) {
      closeBtn.hidden = !cxGpHasPerm('gatepass.action');
      closeBtn.textContent = visitor.status === 'in_service' ? 'Complete visit' : 'Close (no show)';
    }
    overlay.style.display = 'flex';
    overlay.classList.add('open');
  }

  function cxGpCloseActionsSheet() {
    var overlay = document.getElementById('overlay-cx-gatepass-actions');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.style.display = 'none';
    _cxGpActiveVisitor = null;
  }

  async function cxGpPatchStatus(status) {
    if (!_cxGpActiveVisitor || !cxGpHasPerm('gatepass.action')) return;
    try {
      await cxGpApiPatch('/api/gatepass/visitor/' + _cxGpActiveVisitor.visitor_id + '/status', { status: status });
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Visitor updated');
      cxGpCloseActionsSheet();
      void cxGpLoadVisitorsPage();
      void cxGpRefreshWidget();
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    }
  }

  async function cxGpAssignToMe() {
    if (!_cxGpActiveVisitor || !cxGpHasPerm('gatepass.action')) return;
    try {
      var u = JSON.parse(sessionStorage.getItem('cosmos_user') || '{}');
      var uid = u.user_id != null ? Number(u.user_id) : null;
      if (!uid) throw new Error('User id missing — sign in again.');
      await cxGpApiPatch('/api/gatepass/visitor/' + _cxGpActiveVisitor.visitor_id + '/assign', { assigned_user_id: uid });
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Assigned to you');
      cxGpCloseActionsSheet();
      void cxGpLoadVisitorsPage();
      void cxGpRefreshWidget();
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    }
  }

  /* ── cosmos-cx-search instance ───────────────────────────────────────── */

  function cxGpCreateCxSearchInstance(inputEl, prevInstance, handlers, bubbleResultsEl) {
    if (typeof window.cosmosCxSearch === 'undefined') return null;
    var storeId = cxGpStoreId();
    if (!inputEl || !storeId) return null;
    if (prevInstance && typeof prevInstance.destroy === 'function') prevInstance.destroy();
    return window.cosmosCxSearch.init({
      inputEl: inputEl,
      storeId: storeId,
      bubbleResultsEl: bubbleResultsEl || null,
      apiGet: function (path) { return cxGpApiGet(path); },
      apiPatch: function (path, body) { return cxGpApiPatch(path, body); },
      canSearchCx: function () { return cxGpCanSearchCx(); },
      onSelect: handlers.onSelect,
      onCheckInNew: handlers.onCheckInNew,
      onCreateCx: handlers.onCreateCx
    });
  }

  function cxGpFillCheckInFromCtx(ctx) {
    var phoneEl = document.getElementById('cx-gatepass-checkin-phone');
    var nameEl  = document.getElementById('cx-gatepass-checkin-name');
    var phone = cxGpNormalizePhone(ctx.phone);
    if (phoneEl) { phoneEl.value = phone; if (typeof cosmosFieldClear === 'function') cosmosFieldClear(phoneEl); }
    if (nameEl) {
      var nm = (ctx.customer_data && (ctx.customer_data.full_name || ctx.customer_data.display_name)) || ctx.name || '';
      if (nm) { nameEl.value = String(nm).trim(); if (typeof cosmosFieldClear === 'function') cosmosFieldClear(nameEl); }
    }
  }

  async function cxGpCheckInFromCxCtx(ctx) {
    if (!cxGpHasPerm('gatepass.checkin')) return;
    var storeId = cxGpStoreId();
    if (!storeId) return;
    var name  = (ctx.customer_data && (ctx.customer_data.full_name || ctx.customer_data.display_name)) || ctx.name || '';
    var phone = cxGpNormalizePhone(ctx.phone);
    if (phone.length !== 10) return;
    try {
      var data = await cxGpApiPost('/api/gatepass/checkin', {
        name: String(name).trim() || 'Visitor',
        phone: phone,
        store_id: storeId,
        channel: 'staff_cx',
        purpose: null,
        notes: null
      });
      if (data && data.already_checked_in) {
        if (typeof cosmosToastInfo === 'function') cosmosToastInfo('Visitor already in queue.');
      } else if (typeof cosmosToastSuccess === 'function') {
        cosmosToastSuccess('Visitor checked in');
      }
      cxGpCloseCheckInModal();
      void cxGpLoadVisitorsPage();
      void cxGpRefreshWidget();
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    }
  }

  function cxGpHandleCxSelect(ctx) {
    if (ctx.source === 'cx' || (ctx.has_customer && ctx.customer_data)) {
      cxGpFillCheckInFromCtx(ctx);
      void cxGpCheckInFromCxCtx(ctx);
      return;
    }
    if (ctx.visitor_id) {
      cxGpFillCheckInFromCtx(ctx);
      return;
    }
    cxGpFillCheckInFromCtx(ctx);
  }

  function cxGpInitCxSearch() {
    if (typeof window.cosmosCxSearch === 'undefined') return;
    var checkinPhone  = document.getElementById('cx-gatepass-checkin-phone');
    var bubbleResults = document.getElementById('cx-ci-bubble-results');
    _cxGpCxCheckinInstance = cxGpCreateCxSearchInstance(checkinPhone, _cxGpCxCheckinInstance, {
      onSelect: function (ctx) { cxGpHandleCxSelect(ctx); },
      onCheckInNew: function (phone) { cxGpOpenCheckInModal(phone, ''); },
      onCreateCx: function (phone) { cxGpOpenCheckInModal(phone, ''); }
    }, bubbleResults);
  }

  /* ── FAB widget refresh ──────────────────────────────────────────────── */

  async function cxGpRefreshWidget() {
    if (!cxGpHasPerm('gatepass.view')) return;
    var root  = document.getElementById('cx-gp-fab-root');
    var badge = document.getElementById('cx-gp-fab-badge');
    if (!root) return;
    var storeId = cxGpStoreId();
    if (!storeId) { root.hidden = true; return; }
    root.hidden = false;
    try {
      var data = await cxGpApiGet('/api/gatepass/search?storeId=' + encodeURIComponent(storeId) + '&phone=');
      var inStore = Array.isArray(data.inStore) ? data.inStore : [];
      var exited  = Array.isArray(data.exited)  ? data.exited  : [];
      var n = inStore.length;
      if (badge) { badge.textContent = String(n); badge.hidden = n === 0; }
      if (_cxGpFabOpen) {
        cxGpRenderContacts(inStore, exited);
      } else {
        root._cxLastInStore = inStore;
        root._cxLastExited  = exited;
      }
    } catch (_e) { /* silent poll failure */ }
  }

  /* ── polling ─────────────────────────────────────────────────────────── */

  function cxGpStartPoll() {
    cxGpStopPoll();
    void cxGpRefreshWidget();
    _cxGpPollTimer = window.setInterval(function () {
      var gp = document.getElementById('page-visitors');
      if (gp && gp.classList.contains('active')) void cxGpLoadVisitorsPage();
      void cxGpRefreshWidget();
    }, 30000);
  }

  function cxGpStopPoll() {
    if (_cxGpPollTimer) { clearInterval(_cxGpPollTimer); _cxGpPollTimer = null; }
  }

  /* ── bind UI ─────────────────────────────────────────────────────────── */

  function cxGpBindUi() {
    var checkinBtn  = document.getElementById('cx-gp-visitors-checkin-btn');
    if (checkinBtn) checkinBtn.addEventListener('click', function () { cxGpOpenCheckInModal(); });

    var refreshBtn  = document.getElementById('cx-gp-visitors-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', function () { void cxGpLoadVisitorsPage(); });

    var filterEl = document.getElementById('cx-gp-visitors-filter');
    if (filterEl) {
      filterEl.addEventListener('input', function () {
        clearTimeout(filterEl._cxGpDebounce);
        filterEl._cxGpDebounce = setTimeout(function () { void cxGpLoadVisitorsPage(); }, 200);
      });
    }
    var statusFilter = document.getElementById('cx-gp-visitors-status-filter');
    if (statusFilter) statusFilter.addEventListener('change', function () { void cxGpLoadVisitorsPage(); });

    // check-in modal buttons
    var submit     = document.getElementById('cx-gatepass-checkin-submit');
    var cancelClose = document.getElementById('cx-gatepass-checkin-cancel');
    var cancelBtn  = document.getElementById('cx-gatepass-checkin-cancel-btn');
    var bd         = document.getElementById('cx-gatepass-checkin-backdrop');
    if (submit)      submit.addEventListener('click', function () { void cxGpSubmitCheckIn(submit); });
    if (cancelClose) cancelClose.addEventListener('click', cxGpCloseCheckInModal);
    if (cancelBtn)   cancelBtn.addEventListener('click', cxGpCloseCheckInModal);
    if (bd)          bd.addEventListener('click', cxGpCloseCheckInModal);

    // actions sheet buttons
    var actDismiss = document.getElementById('cx-gatepass-actions-dismiss');
    var actBd      = document.getElementById('cx-gatepass-actions-backdrop');
    var addRx      = document.getElementById('cx-gatepass-action-add-rx');
    var assign     = document.getElementById('cx-gatepass-action-assign');
    var inSvc      = document.getElementById('cx-gatepass-action-inservice');
    var closeV     = document.getElementById('cx-gatepass-action-close');
    if (actDismiss) actDismiss.addEventListener('click', cxGpCloseActionsSheet);
    if (actBd)      actBd.addEventListener('click', cxGpCloseActionsSheet);
    if (addRx && !addRx.dataset.cxGpRxBound) {
      addRx.dataset.cxGpRxBound = '1';
      addRx.addEventListener('click', function () {
        if (!_cxGpActiveVisitor || typeof window.openRxModal !== 'function') return;
        var snap = {
          source: 'gatepass',
          visitorId: _cxGpActiveVisitor.visitor_id,
          customerId: _cxGpActiveVisitor.customer_id || null,
          visitorName: _cxGpActiveVisitor.name || '',
          visitorPhone: _cxGpActiveVisitor.phone || '',
          customerName:
            _cxGpActiveVisitor.cx_display_name ||
            _cxGpActiveVisitor.display_name ||
            _cxGpActiveVisitor.full_name ||
            ''
        };
        cxGpCloseActionsSheet();
        window.openRxModal(snap);
        window._rxModalOnSaved = function () {
          void cxGpLoadVisitorsPage();
          void cxGpRefreshWidget();
        };
      });
    }
    if (assign)  assign.addEventListener('click', function () { void cxGpAssignToMe(); });
    if (inSvc)   inSvc.addEventListener('click', function () { void cxGpPatchStatus('in_service'); });
    if (closeV) {
      closeV.addEventListener('click', function () {
        var st = _cxGpActiveVisitor && _cxGpActiveVisitor.status;
        void cxGpPatchStatus(st === 'in_service' ? 'completed' : 'no_show');
      });
    }

    // FAB wiring
    if (typeof window.cosmosGpFabBindVerticalDrag === 'function') {
      window.cosmosGpFabBindVerticalDrag({
        rootId: 'cx-gp-fab-root',
        handleId: 'cx-gp-fab',
        storageKey: 'cx_gp_fab_bottom_px'
      })
    }
    var fab = document.getElementById('cx-gp-fab');
    if (fab) fab.addEventListener('click', function () {
      if (!_cxGpFabOpen) {
        var root = document.getElementById('cx-gp-fab-root');
        var inStore = (root && root._cxLastInStore) || [];
        var exited  = (root && root._cxLastExited)  || [];
        cxGpRenderContacts(inStore, exited);
      }
      cxGpFabToggle();
    });
    var fabClose = document.getElementById('cx-gp-fab-close');
    if (fabClose) fabClose.addEventListener('click', cxGpFabClose);

    var fabCheckin = document.getElementById('cx-gp-fab-checkin');
    if (fabCheckin) fabCheckin.addEventListener('click', function () {
      cxGpFabClose();
      cxGpOpenCheckInModal();
    });
  }

  function cxGpSyncNav() {
    var navItem  = document.querySelector('[data-cx-page="visitors"]');
    if (navItem) navItem.style.display = cxGpHasPerm('gatepass.view') ? '' : 'none';
    var fabRoot  = document.getElementById('cx-gp-fab-root');
    if (fabRoot) fabRoot.hidden = !cxGpHasPerm('gatepass.view');
    var checkinNav = document.getElementById('cx-gp-fab-checkin');
    if (checkinNav) checkinNav.hidden = !cxGpHasPerm('gatepass.checkin');
    var checkinBtn = document.getElementById('cx-gp-visitors-checkin-btn');
    if (checkinBtn) checkinBtn.hidden = !cxGpHasPerm('gatepass.checkin');
  }

  /* ── public API ──────────────────────────────────────────────────────── */

  window.cxGpLoadVisitorsPage  = cxGpLoadVisitorsPage;
  window.cxGpOpenCheckInModal  = cxGpOpenCheckInModal;
  window.cxGpFabClose          = cxGpFabClose;
  window.cxGpRefreshWidget     = function () { return cxGpRefreshWidget(); };

  window.cxGpInit = function () {
    cxGpBindUi();
    cxGpSyncNav();
    void cxGpPopulateStoreSel().then(function () {
      cxGpInitCxSearch();
      if (cxGpHasPerm('gatepass.view')) cxGpStartPoll();
    });
  };
})();
