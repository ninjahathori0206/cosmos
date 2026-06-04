/**
 * Store Pilot — GatePass visitors queue (Phase 3)
 */
(function () {
  'use strict';

  var _spGpPollTimer = null;
  var _spGpActiveVisitor = null;
  var _spGpPurposeOptions = null;
  var _spGpCxCheckinInstance = null;
  var _spGpCxInvoiceInstance = null;
  var _spGpFabOpen = false;

  function spGpHasPerm(key) {
    try {
      var u = JSON.parse(sessionStorage.getItem('cosmos_user') || '{}');
      if (String(u.role || '').toLowerCase() === 'super_admin') return true;
    } catch (_e) { /* ignore */ }
    if (typeof hasAnyPermission !== 'function') return false;
    return hasAnyPermission([key]);
  }

  function spGpStoreId() {
    return typeof _storeId !== 'undefined' && _storeId != null ? Number(_storeId) : null;
  }

  function spGpApiGet(path) {
    return apiGet(path).then(function (body) {
      if (!body || body.success === false) throw new Error((body && body.message) || 'Request failed');
      return body.data;
    });
  }

  function spGpApiPost(path, payload) {
    return apiPost(path, payload).then(function (body) {
      if (!body || body.success === false) throw new Error((body && body.message) || 'Request failed');
      return body.data;
    });
  }

  function spGpApiPatch(path, payload) {
    return apiFetch('PATCH', path, payload).then(function (body) {
      if (!body || body.success === false) throw new Error((body && body.message) || 'Request failed');
      return body.data;
    });
  }

  function spGpInitials(name) {
    var parts = String(name || '').trim().split(/\s+/);
    if (!parts[0]) return '?';
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function spGpBuildBubble(v, isExited) {
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
      '<div class="sp-gp-contact-avatar ' + avatarCls + '">' + escHtml(spGpInitials(v.name)) + '</div>'
      + '<div class="sp-gp-contact-name">' + escHtml(firstName) + '</div>'
      + '<div class="sp-gp-contact-status">' + escHtml(statusLabel) + '</div>';
    item.addEventListener('click', function () {
      spGpFabClose();
      spGpOpenActionsSheet(v);
    });
    return item;
  }

  function spGpRenderContacts(inStore, exited) {
    var container = document.getElementById('sp-gp-contacts-container');
    if (!container) return;
    container.innerHTML = '';

    if (inStore.length) {
      var lbl1 = document.createElement('div');
      lbl1.className = 'sp-gp-section-label';
      lbl1.textContent = 'In store';
      container.appendChild(lbl1);

      var row1 = document.createElement('div');
      row1.className = 'sp-gp-contacts-row';
      // ALL active visitors — scroll reveals remainder
      inStore.forEach(function (v) { row1.appendChild(spGpBuildBubble(v, false)); });
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
      exited.slice(0, 3).forEach(function (v) { row2.appendChild(spGpBuildBubble(v, true)); });
      container.appendChild(row2);
    }

    if (!inStore.length && !exited.length) {
      var empty = document.createElement('div');
      empty.style.cssText = 'font-size:13px;color:var(--text2);padding:8px 0;text-align:center';
      empty.textContent = 'No visitors today.';
      container.appendChild(empty);
    }
  }

  function spGpFabOpen() {
    var panel = document.getElementById('sp-gp-fab-panel');
    var fab = document.getElementById('sp-gp-fab');
    if (!panel) return;
    panel.hidden = false;
    _spGpFabOpen = true;
    if (fab) fab.setAttribute('aria-expanded', 'true');
    setTimeout(function () {
      document.addEventListener('click', _spGpOutsideClick, { capture: true, once: true });
      document.addEventListener('keydown', _spGpEscKey);
    }, 10);
  }

  function spGpFabClose() {
    var panel = document.getElementById('sp-gp-fab-panel');
    var fab = document.getElementById('sp-gp-fab');
    if (!panel) return;
    panel.hidden = true;
    _spGpFabOpen = false;
    if (fab) fab.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', _spGpOutsideClick, { capture: true });
    document.removeEventListener('keydown', _spGpEscKey);
  }

  function _spGpOutsideClick(e) {
    var root = document.getElementById('sp-gp-fab-root');
    if (root && !root.contains(e.target)) spGpFabClose();
  }

  function _spGpEscKey(e) {
    if (e.key === 'Escape') spGpFabClose();
  }

  function spGpFabToggle() {
    if (_spGpFabOpen) { spGpFabClose(); } else { spGpFabOpen(); }
  }

  function spGpNormalizePhone(raw) {
    if (window.cosmosCxSearch && window.cosmosCxSearch.normalizeDigits) {
      return window.cosmosCxSearch.normalizeDigits(raw);
    }
    var d = String(raw || '').replace(/\D/g, '');
    if (d.length === 12 && d.indexOf('91') === 0) return d.slice(2);
    if (d.length >= 10) return d.slice(-10);
    return d;
  }

  function spGpCanSearchCx() {
    return spGpHasPerm('pos.customers.view');
  }

  function spGpSetLinkedCxContext(ctx) {
    window._spGpCxContext = ctx
      ? {
          customer_id: ctx.customer_id || null,
          phone: ctx.phone || null,
          name: ctx.name || null,
          visitor_id: ctx.visitor_id || null,
          customer_data: ctx.customer_data || null
        }
      : null;
  }

  function spGpPurposeLabel(key) {
    if (!_spGpPurposeOptions || !key) return key || '';
    for (var i = 0; i < _spGpPurposeOptions.length; i++) {
      if (_spGpPurposeOptions[i].key === key) return _spGpPurposeOptions[i].label;
    }
    return key;
  }

  function spGpFillPurposeSelect(sel) {
    if (!sel) return;
    sel.innerHTML = '<option value="">— Optional —</option>';
    (_spGpPurposeOptions || []).forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.key;
      opt.textContent = p.label;
      sel.appendChild(opt);
    });
  }

  function spGpStatusBadge(status) {
    var s = String(status || '').toLowerCase();
    var cls = 'sp-gp-badge sp-gp-badge--gray';
    var label = s;
    if (s === 'waiting') { cls = 'sp-gp-badge sp-gp-badge--amber'; label = 'Waiting'; }
    if (s === 'in_service') { cls = 'sp-gp-badge sp-gp-badge--blue'; label = 'In service'; }
    if (s === 'completed') { cls = 'sp-gp-badge sp-gp-badge--green'; label = 'Completed'; }
    if (s === 'no_show') { cls = 'sp-gp-badge sp-gp-badge--red'; label = 'No show'; }
    if (s === 'expired') { cls = 'sp-gp-badge sp-gp-badge--gray'; label = 'Expired'; }
    return '<span class="' + cls + '">' + escHtml(label) + '</span>';
  }

  function spGpRenderVisitorsTable(rows) {
    var tbody = document.getElementById('sp-visitors-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!rows || !rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="7"><div class="empty" style="padding:24px;text-align:center">'
        + '<div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:16px">No visitors in queue</div>'
        + (spGpHasPerm('gatepass.checkin')
          ? '<button type="button" class="btn primary" onclick="spGpOpenCheckInModal()">+ Check In</button>'
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
      tr.innerHTML =
        '<td><div style="font-weight:600">' + escHtml(v.name) + '</div>'
        + '<div style="font-size:12px;color:var(--text3)"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:' + dot + ';margin-right:4px"></span>'
        + escHtml(v.phone || '') + '</div></td>'
        + '<td>' + escHtml(spGpPurposeLabel(v.purpose)) + '</td>'
        + '<td' + waitCls + '>⏱ ' + wm + 'm</td>'
        + '<td>' + escHtml(v.assigned_staff_name || '—') + '</td>'
        + '<td>' + spGpStatusBadge(v.status) + '</td>'
        + '<td style="font-size:12px;color:var(--text3)">' + escHtml(typeof fmtDateTime === 'function' ? fmtDateTime(v.checkin_at) : String(v.checkin_at || '')) + '</td>'
        + '<td><button type="button" class="btn sm" data-sp-gp-act="' + v.visitor_id + '">Actions</button></td>';
      tr.querySelector('[data-sp-gp-act]').addEventListener('click', function (e) {
        e.stopPropagation();
        spGpOpenActionsSheet(v);
      });
      tr.addEventListener('click', function () { spGpOpenActionsSheet(v); });
      tbody.appendChild(tr);
    });
  }

  async function spGpLoadVisitorsPage() {
    if (!spGpHasPerm('gatepass.view')) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Visitor queue permission required (gatepass.view).');
      return;
    }
    var storeId = spGpStoreId();
    if (!storeId) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Store context required for visitor queue.');
      return;
    }
    if (!_spGpPurposeOptions) {
      try {
        _spGpPurposeOptions = await spGpApiGet('/api/meta/gatepass-purposes');
      } catch (_e) {
        _spGpPurposeOptions = [];
      }
    }
    var filterEl = document.getElementById('sp-visitors-filter');
    var q = filterEl ? filterEl.value.trim() : '';
    var statusEl = document.getElementById('sp-visitors-status-filter');
    var statusFilter = statusEl ? statusEl.value : '';
    var tbody = document.getElementById('sp-visitors-tbody');
    if (tbody && typeof cosmosSkeletonTable === 'function') cosmosSkeletonTable('sp-visitors-tbody', 7, 6);
    try {
      var path = '/api/gatepass/queue/' + encodeURIComponent(storeId);
      if (statusFilter) path += '?status=' + encodeURIComponent(statusFilter);
      var rows = await spGpApiGet(path);
      if (q) {
        var ql = q.toLowerCase();
        rows = (rows || []).filter(function (v) {
          return String(v.name || '').toLowerCase().indexOf(ql) >= 0
            || String(v.phone || '').indexOf(ql) >= 0;
        });
      }
      spGpRenderVisitorsTable(rows);
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="td-muted">Failed to load queue.</td></tr>';
    }
  }

  function spGpOpenCheckInModal(prefillPhone, prefillName) {
    if (!spGpHasPerm('gatepass.checkin')) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Check-in permission required.');
      return;
    }
    var overlay = document.getElementById('overlay-sp-gatepass-checkin');
    if (!overlay) return;
    var phoneEl = document.getElementById('sp-gatepass-checkin-phone');
    var nameEl = document.getElementById('sp-gatepass-checkin-name');
    var notesEl = document.getElementById('sp-gatepass-checkin-notes');
    var purposeEl = document.getElementById('sp-gatepass-checkin-purpose');
    spGpFillPurposeSelect(purposeEl);
    if (phoneEl) {
      phoneEl.value = prefillPhone || '';
      if (typeof cosmosFieldClear === 'function') cosmosFieldClear(phoneEl);
    }
    if (nameEl) {
      nameEl.value = prefillName || '';
      if (typeof cosmosFieldClear === 'function') cosmosFieldClear(nameEl);
    }
    if (notesEl) notesEl.value = '';
    var bubble = document.getElementById('sp-ci-bubble-results');
    if (bubble) {
      bubble.innerHTML = '';
      bubble.hidden = true;
    }
    overlay.style.display = 'flex';
    overlay.classList.add('open');
    if (window.cosmosLockAppBodyScroll) window.cosmosLockAppBodyScroll();
  }

  function spGpCloseCheckInModal() {
    var overlay = document.getElementById('overlay-sp-gatepass-checkin');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.style.display = 'none';
    if (window.cosmosLockAppBodyScroll) window.cosmosLockAppBodyScroll();
  }

  async function spGpSubmitCheckIn(btn) {
    var phoneEl = document.getElementById('sp-gatepass-checkin-phone');
    var nameEl = document.getElementById('sp-gatepass-checkin-name');
    var purposeEl = document.getElementById('sp-gatepass-checkin-purpose');
    var notesEl = document.getElementById('sp-gatepass-checkin-notes');
    var name = nameEl ? nameEl.value.trim() : '';
    var phone = phoneEl ? String(phoneEl.value || '').replace(/\D/g, '').slice(-10) : '';
    if (phone.length !== 10) {
      if (phoneEl && typeof cosmosFieldError === 'function') cosmosFieldError(phoneEl, 'Enter a valid 10-digit mobile');
      return;
    }
    if (!name) {
      if (nameEl && typeof cosmosFieldError === 'function') cosmosFieldError(nameEl, 'Required');
      return;
    }
    var storeId = spGpStoreId();
    if (!storeId) return;
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      await spGpApiPost('/api/gatepass/checkin', {
        name: name,
        phone: phone,
        store_id: storeId,
        channel: 'staff_tablet',
        purpose: purposeEl && purposeEl.value ? purposeEl.value : null,
        notes: notesEl && notesEl.value ? notesEl.value.trim() : null
      });
      if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn);
      spGpCloseCheckInModal();
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Visitor checked in');
      void spGpLoadVisitorsPage();
      void spGpRefreshWidget();
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

  function spGpOpenActionsSheet(visitor) {
    _spGpActiveVisitor = visitor;
    var overlay = document.getElementById('overlay-sp-gatepass-actions');
    if (!overlay) return;
    var sum = document.getElementById('sp-gatepass-actions-summary');
    if (sum) {
      sum.innerHTML =
        '<div style="font-weight:600;font-size:15px;margin-bottom:4px">' + escHtml(visitor.name) + '</div>'
        + '<div style="font-size:13px;color:var(--text2)">' + escHtml(visitor.phone || '') + '</div>'
        + '<div style="margin-top:8px">' + spGpStatusBadge(visitor.status) + '</div>';
    }
    var addRxBtn = document.getElementById('sp-gatepass-action-add-rx');
    var assignBtn = document.getElementById('sp-gatepass-action-assign');
    var inSvc = document.getElementById('sp-gatepass-action-inservice');
    var closeBtn = document.getElementById('sp-gatepass-action-close');
    if (addRxBtn) addRxBtn.hidden = !spGpHasPerm('gatepass.action');
    if (assignBtn) assignBtn.hidden = !spGpHasPerm('gatepass.action');
    if (inSvc) inSvc.hidden = !spGpHasPerm('gatepass.action') || visitor.status !== 'waiting';
    if (closeBtn) {
      closeBtn.hidden = !spGpHasPerm('gatepass.action');
      closeBtn.textContent = visitor.status === 'in_service' ? 'Complete visit' : 'Close (no show)';
    }
    overlay.style.display = 'flex';
    overlay.classList.add('open');
    if (window.cosmosLockAppBodyScroll) window.cosmosLockAppBodyScroll();
  }

  function spGpCloseActionsSheet() {
    var overlay = document.getElementById('overlay-sp-gatepass-actions');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.style.display = 'none';
    _spGpActiveVisitor = null;
    if (window.cosmosLockAppBodyScroll) window.cosmosLockAppBodyScroll();
  }

  async function spGpPatchStatus(status) {
    if (!_spGpActiveVisitor || !spGpHasPerm('gatepass.action')) return;
    try {
      await spGpApiPatch('/api/gatepass/visitor/' + _spGpActiveVisitor.visitor_id + '/status', { status: status });
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Visitor updated');
      spGpCloseActionsSheet();
      void spGpLoadVisitorsPage();
      void spGpRefreshWidget();
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    }
  }

  async function spGpAssignToMe() {
    if (!_spGpActiveVisitor || !spGpHasPerm('gatepass.action')) return;
    try {
      var u = JSON.parse(sessionStorage.getItem('cosmos_user') || '{}');
      var uid = u.user_id != null ? Number(u.user_id) : null;
      if (!uid) throw new Error('User id missing — sign in again.');
      await spGpApiPatch('/api/gatepass/visitor/' + _spGpActiveVisitor.visitor_id + '/assign', {
        assigned_user_id: uid
      });
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Assigned to you');
      spGpCloseActionsSheet();
      void spGpLoadVisitorsPage();
      void spGpRefreshWidget();
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    }
  }

  function spGpCreateCxSearchInstance(inputEl, prevInstance, handlers, bubbleResultsEl) {
    if (typeof window.cosmosCxSearch === 'undefined') return null;
    var storeId = spGpStoreId();
    if (!inputEl || !storeId) return null;
    if (prevInstance && typeof prevInstance.destroy === 'function') {
      prevInstance.destroy();
    }
    return window.cosmosCxSearch.init({
      inputEl: inputEl,
      storeId: storeId,
      bubbleResultsEl: bubbleResultsEl || null,
      checkinNewOnly: handlers.checkinNewOnly === true,
      apiGet: function (path) { return spGpApiGet(path); },
      apiPatch: function (path, payload) { return spGpApiPatch(path, payload); },
      canSearchCx: function () { return spGpCanSearchCx(); },
      onSelect: handlers.onSelect,
      onCheckInNew: handlers.onCheckInNew,
      onCreateCx: handlers.onCreateCx
    });
  }

  function spGpFillCheckInFromCtx(ctx) {
    var phoneEl = document.getElementById('sp-gatepass-checkin-phone');
    var nameEl = document.getElementById('sp-gatepass-checkin-name');
    var phone = spGpNormalizePhone(ctx.phone);
    if (phoneEl) {
      phoneEl.value = phone;
      if (typeof cosmosFieldClear === 'function') cosmosFieldClear(phoneEl);
    }
    if (nameEl) {
      var nm = (ctx.customer_data && (ctx.customer_data.full_name || ctx.customer_data.display_name)) || ctx.name || '';
      if (nm) {
        nameEl.value = String(nm).trim();
        if (typeof cosmosFieldClear === 'function') cosmosFieldClear(nameEl);
      }
    }
  }

  async function spGpCheckInFromCxCtx(ctx) {
    if (!spGpHasPerm('gatepass.checkin')) {
      if (typeof cosmosToastWarn === 'function') {
        cosmosToastWarn('Check-in permission required to add to visitor queue.');
      }
      return;
    }
    var storeId = spGpStoreId();
    if (!storeId) return;
    var name = (ctx.customer_data && (ctx.customer_data.full_name || ctx.customer_data.display_name)) || ctx.name || '';
    var phone = spGpNormalizePhone(ctx.phone);
    if (phone.length !== 10) return;
    try {
      var data = await spGpApiPost('/api/gatepass/checkin', {
        name: String(name).trim() || 'Visitor',
        phone: phone,
        store_id: storeId,
        channel: 'staff_tablet',
        purpose: null,
        notes: null
      });
      if (data && data.already_checked_in) {
        if (typeof cosmosToastInfo === 'function') cosmosToastInfo('Visitor already in queue.');
      } else if (typeof cosmosToastSuccess === 'function') {
        cosmosToastSuccess('Visitor checked in');
      }
      var visitor = data && data.visitor ? data.visitor : data;
      if (visitor && visitor.visitor_id && visitor.status === 'waiting' && spGpHasPerm('gatepass.action')) {
        try {
          await spGpApiPatch('/api/gatepass/visitor/' + visitor.visitor_id + '/status', { status: 'in_service' });
        } catch (_e) { /* non-blocking */ }
      }
      spGpCloseCheckInModal();
      void spGpLoadVisitorsPage();
      void spGpRefreshWidget();
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    }
  }

  function spGpHandleCxSelect(ctx, surface) {
    surface = surface || 'checkin';
    spGpSetLinkedCxContext(ctx);

    if (ctx.source === 'cx' || (ctx.has_customer && ctx.customer_data)) {
      if (surface === 'invoice') {
        var invEl = document.getElementById('sp-invoice-search');
        var q = spGpNormalizePhone(ctx.phone) || String(ctx.name || '').trim();
        if (invEl) invEl.value = q;
        if (typeof window.loadSpInvoices === 'function') void window.loadSpInvoices(q);
        if (typeof cosmosToastInfo === 'function') {
          cosmosToastInfo('Showing invoices for ' + (ctx.name || q));
        }
        return;
      }
      if (surface === 'checkin') {
        spGpFillCheckInFromCtx(ctx);
        void spGpCheckInFromCxCtx(ctx);
        return;
      }
    }

    if (ctx.visitor_id) {
      var visitor = {
        visitor_id: ctx.visitor_id,
        name: ctx.name,
        phone: ctx.phone,
        customer_id: ctx.customer_id,
        has_customer: ctx.has_customer,
        purpose: ctx.purpose,
        status: ctx.status
      };
      if (surface === 'invoice') {
        var invQ = spGpNormalizePhone(ctx.phone);
        var invInput = document.getElementById('sp-invoice-search');
        if (invInput && invQ) {
          invInput.value = invQ;
          if (typeof window.loadSpInvoices === 'function') void window.loadSpInvoices(invQ);
        }
        if (typeof cosmosToastInfo === 'function') cosmosToastInfo('Showing invoices for ' + ctx.name);
      }
      if (surface === 'checkin') {
        spGpFillCheckInFromCtx(ctx);
      } else {
        spGpOpenActionsSheet(visitor);
      }
      return;
    }

    spGpFillCheckInFromCtx(ctx);
  }

  function spGpInitCxSearch() {
    if (typeof window.cosmosCxSearch === 'undefined') return;

    var checkinPhone = document.getElementById('sp-gatepass-checkin-phone');
    var bubbleResults = document.getElementById('sp-ci-bubble-results');
    _spGpCxCheckinInstance = spGpCreateCxSearchInstance(checkinPhone, _spGpCxCheckinInstance, {
      checkinNewOnly: true,
      onSelect: function () { /* check-in form only — no picking existing visitors */ },
      onCheckInNew: null,
      onCreateCx: null
    }, bubbleResults);

    var invInput = document.getElementById('sp-invoice-search');
    if (invInput && !invInput._spGpInvInputBound) {
      invInput._spGpInvInputBound = true;
      invInput.addEventListener('input', function () {
        if (typeof window.onSpInvoiceSearch === 'function') {
          window.onSpInvoiceSearch(invInput.value);
        }
      });
    }
    _spGpCxInvoiceInstance = spGpCreateCxSearchInstance(invInput, _spGpCxInvoiceInstance, {
      onSelect: function (ctx) { spGpHandleCxSelect(ctx, 'invoice'); },
      onCheckInNew: function (phone) {
        if (invInput) invInput.value = spGpNormalizePhone(phone);
        if (typeof window.loadSpInvoices === 'function') void window.loadSpInvoices(phone);
        spGpOpenCheckInModal(phone, '');
      },
      onCreateCx: function (phone) {
        if (invInput) invInput.value = spGpNormalizePhone(phone);
        if (typeof window.loadSpInvoices === 'function') void window.loadSpInvoices(phone);
        if (typeof cosmosToastInfo === 'function') {
          cosmosToastInfo('No Cx profile — search invoices by phone or check in as visitor.');
        }
        spGpOpenCheckInModal(phone, '');
      }
    });
  }

  async function spGpRefreshWidget() {
    if (!spGpHasPerm('gatepass.view')) return;
    var root = document.getElementById('sp-gp-fab-root');
    var badge = document.getElementById('sp-gp-fab-badge');
    if (!root) return;
    var storeId = spGpStoreId();
    if (!storeId) {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    try {
      var data = await spGpApiGet('/api/gatepass/search?storeId=' + encodeURIComponent(storeId) + '&phone=');
      var inStore = Array.isArray(data.inStore) ? data.inStore : [];
      var exited = Array.isArray(data.exited) ? data.exited : [];
      var n = inStore.length;
      if (badge) {
        badge.textContent = String(n);
        badge.hidden = n === 0;
      }
      // Only re-render contacts if panel is open (avoid flash while hidden)
      if (_spGpFabOpen) {
        spGpRenderContacts(inStore, exited);
      } else {
        // Store for next open
        root._spLastInStore = inStore;
        root._spLastExited = exited;
      }
    } catch (_e) {
      /* silent poll failure */
    }
  }

  function spGpStartPoll() {
    spGpStopPoll();
    void spGpRefreshWidget();
    _spGpPollTimer = window.setInterval(function () {
      if (document.getElementById('page-visitors') && document.getElementById('page-visitors').classList.contains('active')) {
        void spGpLoadVisitorsPage();
      }
      void spGpRefreshWidget();
    }, 30000);
  }

  function spGpStopPoll() {
    if (_spGpPollTimer) {
      clearInterval(_spGpPollTimer);
      _spGpPollTimer = null;
    }
  }

  function spGpBindUi() {
    var checkinBtn = document.getElementById('sp-visitors-checkin-btn');
    if (checkinBtn) checkinBtn.addEventListener('click', function () { spGpOpenCheckInModal(); });
    var refreshBtn = document.getElementById('sp-visitors-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', function () { void spGpLoadVisitorsPage(); });
    var filterEl = document.getElementById('sp-visitors-filter');
    if (filterEl) {
      filterEl.addEventListener('input', function () {
        clearTimeout(filterEl._spGpDebounce);
        filterEl._spGpDebounce = setTimeout(function () { void spGpLoadVisitorsPage(); }, 200);
      });
    }
    var statusFilter = document.getElementById('sp-visitors-status-filter');
    if (statusFilter) statusFilter.addEventListener('change', function () { void spGpLoadVisitorsPage(); });

    var submit = document.getElementById('sp-gatepass-checkin-submit');
    if (submit) submit.addEventListener('click', function () { void spGpSubmitCheckIn(submit); });
    var cancelClose = document.getElementById('sp-gatepass-checkin-cancel');
    if (cancelClose) cancelClose.addEventListener('click', spGpCloseCheckInModal);
    var cancelBtn = document.getElementById('sp-gatepass-checkin-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', spGpCloseCheckInModal);
    var bd = document.getElementById('sp-gatepass-checkin-backdrop');
    if (bd) bd.addEventListener('click', spGpCloseCheckInModal);

    var actDismiss = document.getElementById('sp-gatepass-actions-dismiss');
    if (actDismiss) actDismiss.addEventListener('click', spGpCloseActionsSheet);
    var actBd = document.getElementById('sp-gatepass-actions-backdrop');
    if (actBd) actBd.addEventListener('click', spGpCloseActionsSheet);
    var addRx = document.getElementById('sp-gatepass-action-add-rx');
    if (addRx && !addRx.dataset.spGpRxBound) {
      addRx.dataset.spGpRxBound = '1';
      addRx.addEventListener('click', function () {
        if (!_spGpActiveVisitor || typeof window.openRxModal !== 'function') return;
        var snap = {
          source: 'gatepass',
          visitorId: _spGpActiveVisitor.visitor_id,
          customerId: _spGpActiveVisitor.customer_id || null,
          visitorName: _spGpActiveVisitor.name || '',
          visitorPhone: _spGpActiveVisitor.phone || '',
          customerName: _spGpActiveVisitor.cx_display_name || ''
        };
        spGpCloseActionsSheet();
        window.openRxModal(snap);
        window._rxModalOnSaved = function () {
          void spGpLoadVisitorsPage();
          void spGpRefreshWidget();
        };
      });
    }
    var assign = document.getElementById('sp-gatepass-action-assign');
    if (assign) assign.addEventListener('click', function () { void spGpAssignToMe(); });
    var inSvc = document.getElementById('sp-gatepass-action-inservice');
    if (inSvc) inSvc.addEventListener('click', function () { void spGpPatchStatus('in_service'); });
    var closeV = document.getElementById('sp-gatepass-action-close');
    if (closeV) {
      closeV.addEventListener('click', function () {
        var st = _spGpActiveVisitor && _spGpActiveVisitor.status;
        void spGpPatchStatus(st === 'in_service' ? 'completed' : 'no_show');
      });
    }

    // ── FAB wiring ─────────────────────────────────────────────────────────
    var fab = document.getElementById('sp-gp-fab');
    if (fab) fab.addEventListener('click', function () {
      if (!_spGpFabOpen) {
        // Load fresh data before opening
        var root = document.getElementById('sp-gp-fab-root');
        var inStore = (root && root._spLastInStore) || [];
        var exited = (root && root._spLastExited) || [];
        spGpRenderContacts(inStore, exited);
      }
      spGpFabToggle();
    });
    var fabClose = document.getElementById('sp-gp-fab-close');
    if (fabClose) fabClose.addEventListener('click', spGpFabClose);

    var fabCheckin = document.getElementById('sp-gp-fab-checkin');
    if (fabCheckin) fabCheckin.addEventListener('click', function () {
      spGpFabClose();
      spGpOpenCheckInModal();
    });
  }

  function spGpSyncNav() {
    var navItem = document.querySelector('[data-storepilot-menu="visitors"]');
    if (navItem) navItem.style.display = spGpHasPerm('gatepass.view') ? '' : 'none';
    var fabRoot = document.getElementById('sp-gp-fab-root');
    if (fabRoot) fabRoot.hidden = !spGpHasPerm('gatepass.view');
    var checkinNav = document.getElementById('sp-gp-fab-checkin');
    if (checkinNav) checkinNav.hidden = !spGpHasPerm('gatepass.checkin');
  }

  window.spLoadVisitorsPage = spGpLoadVisitorsPage;
  window.spGpOpenCheckInModal = spGpOpenCheckInModal;
  window.spGpFabClose = spGpFabClose;
  window.spGpRefreshWidget = function () { return spGpRefreshWidget(); };
  window.spGpInitGatepass = function () {
    spGpBindUi();
    spGpSyncNav();
    spGpInitCxSearch();
    var pageCheckin = document.getElementById('sp-visitors-checkin-btn');
    if (pageCheckin) pageCheckin.hidden = !spGpHasPerm('gatepass.checkin');
    if (spGpHasPerm('gatepass.view')) spGpStartPoll();
  };

  window.spGpGetLinkedCxContext = function () {
    return window._spGpCxContext || null;
  };
})();
