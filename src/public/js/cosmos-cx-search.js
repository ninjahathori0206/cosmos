/**
 * cosmos-cx-search — visitor queue dropdown for customer phone inputs.
 * window.cosmosCxSearch.init({ inputEl, storeId, apiGet, onSelect, ... })
 */
(function () {
  'use strict';

  var purposeMetaCache = null;
  var debounceTimers = {};

  function normalizeDigits(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (d.length === 12 && d.indexOf('91') === 0) return d.slice(2);
    if (d.length >= 10) return d.slice(-10);
    return d;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function highlightPhone(phone, fragment) {
    var p = String(phone || '');
    var f = normalizeDigits(fragment);
    if (!f) return escapeHtml(p);
    var idx = p.indexOf(f);
    if (idx < 0) return escapeHtml(p);
    return escapeHtml(p.slice(0, idx))
      + '<span class="cosmos-cx-search-highlight">' + escapeHtml(p.slice(idx, idx + f.length)) + '</span>'
      + escapeHtml(p.slice(idx + f.length));
  }

  function formatTimeAgo(iso) {
    if (!iso) return '';
    var t = new Date(iso).getTime();
    if (!t) return '';
    var mins = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (mins < 60) return mins + ' min ago';
    var hrs = Math.round(mins / 60);
    return hrs + 'h ago';
  }

  function badgeClass(variant) {
    var v = String(variant || 'gray');
    return 'cosmos-cx-search-badge cosmos-cx-search-badge--' + v;
  }

  function getPurposeLabel(key) {
    if (!purposeMetaCache || !key) return '';
    for (var i = 0; i < purposeMetaCache.length; i++) {
      if (purposeMetaCache[i].key === key) return purposeMetaCache[i].label;
    }
    return key;
  }

  function getPurposeVariant(key) {
    if (!purposeMetaCache || !key) return 'gray';
    for (var i = 0; i < purposeMetaCache.length; i++) {
      if (purposeMetaCache[i].key === key) return purposeMetaCache[i].badgeVariant || 'gray';
    }
    return 'gray';
  }

  function showSkeleton(dropdown) {
    dropdown.innerHTML = '';
    dropdown.hidden = false;
    for (var i = 0; i < 3; i++) {
      var sk = document.createElement('div');
      sk.className = 'cosmos-cx-search-skeleton';
      sk.innerHTML = '<div class="cosmos-cx-search-skeleton-bar" style="width:70%"></div><div class="cosmos-cx-search-skeleton-bar" style="width:45%"></div>';
      dropdown.appendChild(sk);
    }
  }

  function buildRow(visitor, fragment, isExited) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cosmos-cx-search-row tr-link';
    btn.setAttribute('role', 'option');
    var linked = visitor.has_customer || visitor.customer_id;
    var dotClass = linked ? 'cosmos-cx-search-dot--linked' : 'cosmos-cx-search-dot--unlinked';
    var purposeKey = visitor.purpose || '';
    var badge = purposeKey
      ? '<span class="' + badgeClass(getPurposeVariant(purposeKey)) + '">' + escapeHtml(getPurposeLabel(purposeKey)) + '</span>'
      : '';
    var right = '';
    if (isExited) {
      right = formatTimeAgo(visitor.checkout_at);
    } else {
      var wm = visitor.wait_minutes != null ? Number(visitor.wait_minutes) : 0;
      var warn = wm > 20 ? ' cosmos-cx-search-row-col-right--warn' : '';
      right = '<span class="cosmos-cx-search-row-col-right' + warn + '">⏱ ' + wm + 'm</span>';
    }
    btn.innerHTML =
      '<span class="cosmos-cx-search-row-col-left">'
      + '<div class="cosmos-cx-search-row-name">' + escapeHtml(visitor.name) + '</div>'
      + '<div class="cosmos-cx-search-row-phone"><span class="cosmos-cx-search-dot ' + dotClass + '" aria-hidden="true"></span>'
      + highlightPhone(visitor.phone, fragment) + '</div></span>'
      + '<span class="cosmos-cx-search-row-col-mid">' + badge + '</span>'
      + '<span class="cosmos-cx-search-row-col-right">' + escapeHtml(String(right).replace(/<[^>]+>/g, function () { return right; })) + '</span>';
    if (!isExited) {
      var wm2 = visitor.wait_minutes != null ? Number(visitor.wait_minutes) : 0;
      var warn2 = wm2 > 20 ? ' cosmos-cx-search-row-col-right--warn' : '';
      btn.querySelector('.cosmos-cx-search-row-col-right').className = 'cosmos-cx-search-row-col-right' + warn2;
      btn.querySelector('.cosmos-cx-search-row-col-right').textContent = '⏱ ' + wm2 + 'm';
    } else {
      btn.querySelector('.cosmos-cx-search-row-col-right').textContent = formatTimeAgo(visitor.checkout_at);
    }
    btn._visitor = visitor;
    return btn;
  }

  function renderDropdown(dropdown, inStore, exited, fragment, inst) {
    dropdown.innerHTML = '';
    dropdown.hidden = false;
    dropdown.setAttribute('role', 'listbox');

    var sec1 = document.createElement('div');
    sec1.className = 'cosmos-cx-search-section-label';
    sec1.textContent = 'In store now';
    dropdown.appendChild(sec1);

    if (!inStore.length) {
      var empty1 = document.createElement('div');
      empty1.className = 'cosmos-cx-search-empty';
      empty1.textContent = 'No visitors in store';
      dropdown.appendChild(empty1);
    } else {
      inStore.forEach(function (v) {
        var row = buildRow(v, fragment, false);
        row.addEventListener('click', function () {
          inst.handleSelect(v);
        });
        dropdown.appendChild(row);
      });
    }

    var sec2 = document.createElement('div');
    sec2.className = 'cosmos-cx-search-section-label';
    sec2.textContent = 'Last exited (24h)';
    dropdown.appendChild(sec2);

    if (!exited.length) {
      var empty2 = document.createElement('div');
      empty2.className = 'cosmos-cx-search-empty';
      empty2.textContent = 'No recent exits';
      dropdown.appendChild(empty2);
    } else {
      exited.forEach(function (v) {
        var row = buildRow(v, fragment, true);
        row.addEventListener('click', function () {
          inst.handleSelect(v);
        });
        dropdown.appendChild(row);
      });
    }

    var digits = normalizeDigits(fragment);
    var all = inStore.concat(exited);
    var matched = digits.length >= 10 && !all.some(function (v) {
      return normalizeDigits(v.phone) === digits;
    });
    if (matched) {
      var wrap = document.createElement('div');
      wrap.className = 'cosmos-cx-search-new-row';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cosmos-cx-search-row';
      btn.setAttribute('role', 'option');
      btn.innerHTML = '<span class="cosmos-cx-search-row-col-left"><div class="cosmos-cx-search-row-name">Check in as new visitor</div>'
        + '<div class="cosmos-cx-search-row-phone">' + escapeHtml(digits) + '</div></span>';
      btn.addEventListener('click', function () {
        dropdown.hidden = true;
        if (typeof inst.onCheckInNew === 'function') {
          inst.onCheckInNew(digits);
        }
      });
      wrap.appendChild(btn);
      dropdown.appendChild(wrap);
    }
  }

  function loadPurposes(apiGet) {
    if (purposeMetaCache) return Promise.resolve(purposeMetaCache);
    return apiGet('/api/meta/gatepass-purposes').then(function (data) {
      purposeMetaCache = Array.isArray(data) ? data : (data && data.data) || [];
      return purposeMetaCache;
    }).catch(function () {
      purposeMetaCache = [];
      return purposeMetaCache;
    });
  }

  function createInstance(opts) {
    var inputEl = opts.inputEl;
    if (!inputEl || !inputEl.parentNode) return null;

    var wrap = inputEl.closest('.cosmos-cx-search-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'cosmos-cx-search-wrap';
      inputEl.parentNode.insertBefore(wrap, inputEl);
      wrap.appendChild(inputEl);
    }

    var dropdown = wrap.querySelector('.cosmos-cx-search-dropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'cosmos-cx-search-dropdown';
      dropdown.hidden = true;
      wrap.appendChild(dropdown);
    }

    var inst = {
      inputEl: inputEl,
      dropdown: dropdown,
      storeId: opts.storeId,
      apiGet: opts.apiGet,
      apiPatch: opts.apiPatch,
      onSelect: opts.onSelect,
      onCheckInNew: opts.onCheckInNew,
      debounceMs: opts.debounceMs || 150,
      _timer: null,
      destroy: function () {
        if (inst._timer) clearTimeout(inst._timer);
        document.removeEventListener('click', inst._docClick);
        document.removeEventListener('keydown', inst._keydown);
      },
      close: function () {
        dropdown.hidden = true;
        inputEl.setAttribute('aria-expanded', 'false');
      },
      fetchAndRender: function () {
        var fragment = normalizeDigits(inputEl.value);
        showSkeleton(dropdown);
        var url = '/api/gatepass/search?storeId=' + encodeURIComponent(inst.storeId)
          + '&phone=' + encodeURIComponent(fragment);
        return loadPurposes(inst.apiGet).then(function () {
          return inst.apiGet(url);
        }).then(function (payload) {
          var data = payload && payload.data ? payload.data : payload;
          renderDropdown(dropdown, data.inStore || [], data.exited || [], fragment, inst);
          inputEl.setAttribute('aria-expanded', 'true');
        }).catch(function (err) {
          inst.close();
          if (typeof window.cosmosToastError === 'function') {
            window.cosmosToastError(err && err.message ? err.message : 'Search failed');
          }
        });
      },
      resolveCentralCx: function (ctx) {
        if (!inst.apiGet) return Promise.resolve(ctx);
        var digits = normalizeDigits(ctx.phone);
        if (digits.length < 10) return Promise.resolve(ctx);
        return inst.apiGet('/api/pos/customer-search?q=' + encodeURIComponent(digits)).then(function (rows) {
          var list = Array.isArray(rows) ? rows : (rows && rows.data) || [];
          var hit = null;
          for (var i = 0; i < list.length; i++) {
            if (normalizeDigits(list[i].phone) === digits) {
              hit = list[i];
              break;
            }
          }
          if (!hit && list.length) hit = list[0];
          if (hit) {
            ctx.customer_data = hit;
            ctx.customer_id = hit.customer_id;
            ctx.has_customer = true;
          }
          return ctx;
        }).catch(function () { return ctx; });
      },
      handleSelect: function (visitor) {
        inst.close();
        var ctx = {
          visitor_id: visitor.visitor_id,
          name: visitor.name,
          phone: visitor.phone,
          customer_id: visitor.customer_id || null,
          has_customer: !!(visitor.has_customer || visitor.customer_id),
          purpose: visitor.purpose || null,
          status: visitor.status,
          customer_data: null
        };
        var chain = inst.resolveCentralCx(ctx);
        if (visitor.status === 'waiting' && inst.apiPatch) {
          chain = chain.then(function () {
            return inst.apiPatch('/api/gatepass/visitor/' + visitor.visitor_id + '/status', { status: 'in_service' });
          }).catch(function () { /* non-blocking */ });
        }
        chain.then(function () {
          if (typeof inst.onSelect === 'function') inst.onSelect(ctx);
        });
      },
      _docClick: function (e) {
        if (!wrap.contains(e.target)) inst.close();
      },
      _keydown: function (e) {
        if (e.key === 'Escape') inst.close();
      }
    };

    inputEl.setAttribute('aria-autocomplete', 'list');
    inputEl.setAttribute('aria-expanded', 'false');

    inputEl.addEventListener('focus', function () {
      void inst.fetchAndRender();
    });
    inputEl.addEventListener('input', function () {
      if (inst._timer) clearTimeout(inst._timer);
      inst._timer = setTimeout(function () {
        void inst.fetchAndRender();
      }, inst.debounceMs);
    });

    document.addEventListener('click', inst._docClick);
    document.addEventListener('keydown', inst._keydown);

    return inst;
  }

  window.cosmosCxSearch = {
    init: function (opts) {
      return createInstance(opts || {});
    },
    normalizeDigits: normalizeDigits
  };
})();
