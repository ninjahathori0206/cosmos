/* ═══════════════════════════════════════════════════════════════
   EYEWOOT GO — Customer PWA
   Vanilla JS · No framework · Mobile-first
═══════════════════════════════════════════════════════════════ */

var GO = (function () {

  /* ── Constants ─────────────────────────────────────────────── */
  var TOKEN_KEY    = 'ewgo_token';
  var API_BASE     = '/api/customer';
  var screenHistory = [];
  var meCache      = null;

  /* ══════════════════════════════════════════════════════════════
     AUTH
  ══════════════════════════════════════════════════════════════ */
  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }

  async function goApi(method, path, body, isFormData) {
    var token = getToken();
    var headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (!isFormData) headers['Content-Type'] = 'application/json';

    var opts = { method: method, headers: headers };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);

    var res = await fetch(API_BASE + path, opts);
    if (res.status === 401) {
      clearToken();
      showScreen('login');
      throw new Error('Session expired. Please sign in again.');
    }
    var json = await res.json();
    if (!json.success) throw new Error(json.message || 'Something went wrong.');
    return json;
  }

  /* ══════════════════════════════════════════════════════════════
     TOAST
  ══════════════════════════════════════════════════════════════ */
  function goToast(msg, type) {
    var wrap = document.getElementById('go-toast-wrap');
    var t = document.createElement('div');
    t.className = 'go-toast' + (type ? ' ' + type : '');
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(function () {
      t.style.animation = 'goToastOut .2s ease forwards';
      setTimeout(function () { wrap.removeChild(t); }, 200);
    }, type === 'error' ? 5000 : 3000);
  }

  /* ══════════════════════════════════════════════════════════════
     SCREEN ROUTER
  ══════════════════════════════════════════════════════════════ */
  function showScreen(name) {
    var current = document.querySelector('.screen.active');
    if (current) {
      var curId = current.id.replace('screen-', '');
      if (curId !== name) screenHistory.push(curId);
    }
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    var next = document.getElementById('screen-' + name);
    if (next) {
      next.classList.add('active');
      var body = next.querySelector('.screen-body');
      if (body) body.scrollTop = 0;
    }
    updateClockForScreen(name);
    loadScreen(name);
  }

  window.showScreen = showScreen;

  window.navBack = function () {
    var prev = screenHistory.pop();
    if (prev) showScreen(prev);
    else showScreen('home');
  };

  function loadScreen(name) {
    switch (name) {
      case 'home':        loadHome();        break;
      case 'membership':  loadMembership();  break;
      case 'power':       loadPower();       break;
      case 'orders':      loadOrders();      break;
      case 'eyetests':    loadEyeTests();    break;
      case 'offers':      loadOffers();      break;
      case 'loyalty':     loadLoyalty();     break;
      case 'profile':     loadProfile();     break;
    }
  }

  /* ── Clock ── */
  function updateClockForScreen(name) {
    var preAuthScreens = ['login', 'setup-password'];
    if (preAuthScreens.includes(name)) return;
    var now = new Date();
    var timeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
    var el = document.getElementById('home-time');
    if (el) el.textContent = timeStr;
  }

  /* ── IST helpers ── */
  function fmtDate(v) {
    if (!v) return '—';
    return new Date(v).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
  }
  function fmtDateTime(v) {
    if (!v) return '—';
    return new Date(v).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  }
  function fmtMoney(v) { return '₹' + Number(v || 0).toLocaleString('en-IN'); }
  function daysLeft(d) {
    if (!d) return 0;
    return Math.max(0, Math.round((new Date(d) - new Date()) / 864e5));
  }
  function initials(name) {
    return (name || '').split(' ').slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
  }
  function greeting() {
    var h = Number(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }));
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  /* ── Bottom Nav HTML ── */
  function navHtml(active) {
    var tabs = [
      { id: 'home',    label: 'Home',     icon: '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
      { id: 'orders',  label: 'Orders',   icon: '<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/>' },
      { id: 'offers',  label: 'Offers',   icon: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>' },
      { id: 'power',   label: 'My Power', icon: '<circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>' },
      { id: 'profile', label: 'Profile',  icon: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>' }
    ];
    return tabs.map(function (t) {
      return '<button class="nav-item' + (active === t.id ? ' active' : '') + '" onclick="showScreen(\'' + t.id + '\')">'
        + '<div class="nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + t.icon + '</svg></div>'
        + '<div class="nav-lbl">' + t.label + '</div>'
        + '</button>';
    }).join('');
  }

  /* ── Skeleton helpers ── */
  function skelLines(n, wrap) {
    var h = '';
    for (var i = 0; i < n; i++) h += '<div class="skel skel-line' + (i % 3 === 2 ? ' short' : i % 3 === 1 ? ' med' : '') + '"></div>';
    return wrap ? '<div style="padding:16px">' + h + '</div>' : h;
  }
  function skelCards(n) {
    var h = '<div style="padding:0 16px">';
    for (var i = 0; i < n; i++) h += '<div class="skel skel-card"></div>';
    return h + '</div>';
  }

  /* ── Status pill helper ── */
  function statusPill(label) {
    var cls = {
      'Ready for Pickup': 'pill-blue',
      'Delivered':        'pill-green',
      'Order Placed':     'pill-gray',
      'Being Prepared':   'pill-gold',
      'Arriving at Store': 'pill-gold',
      'Cancelled':        'pill-red'
    }[label] || 'pill-gray';
    return '<span class="pill ' + cls + '" style="font-size:10px">' + label + '</span>';
  }

  /* ══════════════════════════════════════════════════════════════
     AUTH SCREENS
  ══════════════════════════════════════════════════════════════ */
  window.loginSubmit = async function () {
    var phone    = document.getElementById('login-phone').value.trim();
    var password = document.getElementById('login-password').value;
    var errEl    = document.getElementById('login-error');
    var btn      = document.getElementById('login-btn');

    errEl.classList.remove('visible');
    if (!phone || !password) { errEl.textContent = 'Please enter your phone and password.'; errEl.classList.add('visible'); return; }

    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      var res = await fetch('/api/customer/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      var json = await res.json();
      if (!json.success) {
        errEl.textContent = json.message;
        errEl.classList.add('visible');
        if (json.needsSetup) { document.getElementById('setup-phone').value = phone; setTimeout(function () { showScreen('setup-password'); }, 1200); }
        return;
      }
      setToken(json.token);
      meCache = null;
      screenHistory = [];
      showScreen('home');
    } catch (e) {
      errEl.textContent = 'Network error. Please try again.';
      errEl.classList.add('visible');
    } finally {
      btn.disabled = false; btn.textContent = 'Sign In';
    }
  };

  window.setupPasswordSubmit = async function () {
    var phone    = document.getElementById('setup-phone').value.trim();
    var password = document.getElementById('setup-password').value;
    var errEl    = document.getElementById('setup-error');
    var btn      = document.getElementById('setup-btn');

    errEl.classList.remove('visible');
    if (!phone || !password) { errEl.textContent = 'Please fill both fields.'; errEl.classList.add('visible'); return; }
    if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.classList.add('visible'); return; }

    btn.disabled = true; btn.textContent = 'Creating account…';
    try {
      var res = await fetch('/api/customer/auth/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      var json = await res.json();
      if (!json.success) { errEl.textContent = json.message; errEl.classList.add('visible'); return; }
      setToken(json.token);
      meCache = null;
      screenHistory = [];
      goToast('Account created! Welcome to Eyewoot Go 👋', 'success');
      showScreen('home');
    } catch (e) {
      errEl.textContent = 'Network error. Please try again.';
      errEl.classList.add('visible');
    } finally {
      btn.disabled = false; btn.textContent = 'Create Account';
    }
  };

  window.logoutUser = function () {
    clearToken();
    meCache = null;
    screenHistory = [];
    showScreen('login');
  };

  /* ══════════════════════════════════════════════════════════════
     SCREEN LOADERS
  ══════════════════════════════════════════════════════════════ */

  /* ── HOME ── */
  async function loadHome() {
    var body = document.getElementById('home-body');
    var nav  = document.getElementById('home-nav');
    nav.innerHTML = navHtml('home');
    body.innerHTML = '<div class="skel skel-hero"></div><div class="skel skel-float" style="margin-top:-16px"></div>' + skelLines(3, true) + skelCards(2);

    try {
      var res = await goApi('GET', '/me');
      meCache = res.data;
      var d = res.data;
      var mem = d.membership;
      var hasPlus = !!mem;
      var expiryDays = mem ? daysLeft(mem.expires_at) : 0;

      var recentOrderHtml = '';
      try {
        var oRes = await goApi('GET', '/orders');
        var orders = oRes.data;
        var readyCount = orders.filter(function (o) { return o.status_label === 'Ready for Pickup'; }).length;
        if (orders.length) {
          var o = orders[0];
          recentOrderHtml = '<div class="section-label">Recent Order</div>'
            + '<div class="card anim anim-4" style="cursor:pointer" onclick="openOrderDetail(' + o.order_id + ')">'
            + '<div class="card-pad" style="display:flex;align-items:center;gap:12px">'
            + '<div class="order-thumb">🕶️</div>'
            + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:14px;font-weight:500;color:var(--text)">' + (o.first_item || o.order_no) + '</div>'
            + '<div style="font-size:12px;color:var(--text3);margin-top:2px">' + o.store_name + ' · ' + o.order_no + '</div>'
            + '</div>'
            + '<div style="text-align:right;flex-shrink:0">'
            + '<div style="font-size:14px;font-weight:600;color:var(--text)">' + fmtMoney(o.total_amount) + '</div>'
            + '<div style="margin-top:4px">' + statusPill(o.status_label) + '</div>'
            + '</div></div></div>';
        }

        body.innerHTML =
          '<div class="hero">'
          + '<div class="hero-top"><div>'
          + '<div class="hero-greeting">' + greeting() + '</div>'
          + '<div class="hero-name">' + d.full_name + '</div>'
          + '</div><div class="hero-avatar" onclick="showScreen(\'profile\')">' + initials(d.full_name) + '</div></div>'
          + (hasPlus
              ? '<div class="mem-strip" onclick="showScreen(\'membership\')">'
                + '<div><div class="mem-badge">✦ Eyewoot Plus</div>'
                + '<div class="mem-status">Active Plan</div>'
                + '<div class="mem-expiry-text">Expires ' + fmtDate(mem.expires_at) + ' · ' + expiryDays + ' days left</div></div>'
                + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>'
                + '</div>'
              : '<div class="mem-strip" onclick="showScreen(\'membership\')">'
                + '<div><div class="mem-badge">Eyewoot Plus</div>'
                + '<div class="mem-status">Not subscribed</div>'
                + '<div class="mem-expiry-text">Ask your store to activate Plus</div></div>'
                + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>'
                + '</div>')
          + '</div>'
          + '<div class="loyalty-float anim" onclick="showScreen(\'loyalty\')">'
          + '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">'
          + '<div><div class="lc-label">Loyalty Points</div>'
          + '<div class="lc-points">' + Number(d.loyalty.balance).toLocaleString('en-IN') + '</div>'
          + '<div class="lc-sub">≈ ' + fmtMoney(d.loyalty.balance / 10) + ' value · redeemable at billing</div></div>'
          + '<div><div class="pill pill-gold">' + d.loyalty.tier + '</div></div>'
          + '</div>'
          + '<div class="prog-track"><div class="prog-fill" style="width:57%"></div></div>'
          + '</div>'
          + '<div class="section-label">Quick Actions</div>'
          + '<div class="qa-grid">'
          + '<div class="qa-item anim anim-1" onclick="showScreen(\'orders\')">'
          + '<div class="qa-emoji">📦</div><div class="qa-title">My Orders</div>'
          + '<div class="qa-sub' + (readyCount ? ' c-blue' : '') + '">' + (readyCount ? readyCount + ' ready for pickup' : 'View all orders') + '</div></div>'
          + '<div class="qa-item anim anim-2" onclick="showScreen(\'power\')">'
          + '<div class="qa-emoji">👁️</div><div class="qa-title">My Power</div><div class="qa-sub">Tap to view prescription</div></div>'
          + '<div class="qa-item anim anim-3" onclick="showScreen(\'offers\')">'
          + '<div class="qa-emoji">🎁</div><div class="qa-title">My Offers</div><div class="qa-sub c-plus">Tap to see active offers</div></div>'
          + '<div class="qa-item anim anim-4" onclick="showScreen(\'eyetests\')">'
          + '<div class="qa-emoji">🔬</div><div class="qa-title">Eye Tests</div><div class="qa-sub">View your test history</div></div>'
          + '</div>'
          + recentOrderHtml;
      } catch (e) {
        body.innerHTML += '<div style="padding:16px;color:var(--red);font-size:13px">' + e.message + '</div>';
      }
    } catch (e) {
      body.innerHTML = '<div style="padding:32px 16px;text-align:center;color:var(--red)">' + e.message + '</div>';
    }
  }

  /* ── MEMBERSHIP ── */
  async function loadMembership() {
    var body = document.getElementById('membership-body');
    var nav  = document.getElementById('membership-nav');
    nav.innerHTML = navHtml('');
    body.innerHTML = '<div style="padding:16px">' + skelCards(3) + '</div>';

    try {
      var res = await goApi('GET', '/membership');
      var { membership: mem, benefits, dependents } = res.data;

      if (!mem) {
        body.innerHTML = '<div class="no-membership"><div class="nm-emoji">⭐</div>'
          + '<h3>No active membership</h3>'
          + '<p>Visit your nearest Eyewoot store to subscribe to Eyewoot Plus and unlock exclusive benefits.</p></div>';
        return;
      }

      var expiryDays = daysLeft(mem.expires_at);
      var depSlots   = mem.max_dependents - dependents.length;

      var benefitsHtml = benefits.map(function (b) {
        return '<div class="row-item"><div class="row-icon" style="background:var(--plus-bg)">' + b.icon_emoji + '</div>'
          + '<div><div class="row-title">' + b.title + '</div><div class="row-sub">' + b.description + '</div></div>'
          + '<div class="row-right"><span class="pill pill-green" style="font-size:10px">Active</span></div></div>';
      }).join('<div class="divider" style="margin:0"></div>');

      var depsHtml = dependents.map(function (d) {
        return '<div class="row-item"><div class="dep-avatar">' + initials(d.full_name) + '</div>'
          + '<div><div class="row-title">' + d.full_name + '</div><div class="row-sub">+91 ' + d.phone + '</div></div>'
          + '<div class="row-right"><span class="pill pill-plus" style="font-size:10px">Plus</span></div></div>';
      }).join('<div class="divider" style="margin:0"></div>');

      var addDepHtml = '';
      if (depSlots > 0) {
        addDepHtml = '<div class="divider" style="margin:0"></div>'
          + '<div class="row-item" onclick="openModal(\'overlay-add-dep\')" style="opacity:.7">'
          + '<div style="width:40px;height:40px;border-radius:11px;border:1.5px dashed var(--border2);display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--text3);flex-shrink:0">+</div>'
          + '<div><div class="row-title" style="color:var(--text3)">Add family member</div><div class="row-sub">' + depSlots + ' slot' + (depSlots > 1 ? 's' : '') + ' remaining</div></div></div>';
      }

      body.innerHTML =
        '<div class="mem-hero anim"><div class="mem-hero-tag">✦ ' + mem.plan_name + '</div>'
        + '<div class="mem-hero-title">Active Plan</div>'
        + '<div class="mem-hero-purchased">Purchased ' + fmtDate(mem.purchased_at) + ' · ' + fmtMoney(mem.price_paid) + '/year</div>'
        + '<div class="mem-hero-stats">'
        + '<div class="mem-stat"><div class="mem-stat-label">Expires</div><div class="mem-stat-val">' + fmtDate(mem.expires_at) + '</div></div>'
        + '<div class="mem-stat-divider"></div>'
        + '<div class="mem-stat"><div class="mem-stat-label">Days left</div><div class="mem-stat-val">' + expiryDays + '</div></div>'
        + '</div></div>'
        + '<div class="section-label">Your Benefits</div>'
        + '<div class="card anim anim-1">' + benefitsHtml + '</div>'
        + '<div class="section-label">Family Members <span style="color:var(--text2);font-weight:400;text-transform:none;letter-spacing:0;font-size:12px">(' + dependents.length + ' of ' + mem.max_dependents + ')</span></div>'
        + '<div class="card anim anim-2">' + (depsHtml || '') + addDepHtml + '</div>'
        + '<div style="padding:4px 16px 16px"><button class="btn-secondary">Renew at Store</button></div>';
    } catch (e) {
      body.innerHTML = '<div style="padding:32px 16px;text-align:center;color:var(--red)">' + e.message + '</div>';
    }
  }

  /* ── MY POWER ── */
  async function loadPower() {
    var body = document.getElementById('power-body');
    var nav  = document.getElementById('power-nav');
    nav.innerHTML = navHtml('power');
    body.innerHTML = skelCards(3);

    try {
      var res = await goApi('GET', '/eye-tests');
      var tests = res.data;

      var addBtn = '<div style="padding:0 16px 8px">'
        + '<button class="btn-primary" onclick="openModal(\'overlay-add-rx\')" style="font-size:14px">+ Add My Prescription</button></div>';

      if (!tests.length) {
        body.innerHTML = addBtn + '<div class="no-membership" style="margin-top:12px">'
          + '<div class="nm-emoji">👁️</div>'
          + '<h3>No prescriptions yet</h3>'
          + '<p>Your eye prescriptions will appear here once entered by your optometrist or added by you.</p></div>';
        return;
      }

      var latest = tests[0];

      function rxBlock(side, t) {
        var sph  = t[side + '_sph'],  cyl  = t[side + '_cyl'],
            axis = t[side + '_axis'], add  = t[side + '_add'], va = t[side + '_va'];
        return '<div class="rx-block"><div class="rx-eye-label">' + (side === 're' ? 'Right Eye (RE)' : 'Left Eye (LE)') + '</div>'
          + (sph  != null ? '<div class="rx-line"><span class="rx-k">SPH</span><span class="rx-v">' + sph  + '</span></div>' : '')
          + (cyl  != null ? '<div class="rx-line"><span class="rx-k">CYL</span><span class="rx-v">' + cyl  + '</span></div>' : '')
          + (axis != null ? '<div class="rx-line"><span class="rx-k">AXIS</span><span class="rx-v">' + axis + '°</span></div>' : '')
          + (add  != null ? '<div class="rx-line"><span class="rx-k">ADD</span><span class="rx-v">' + add  + '</span></div>' : '')
          + (va   ? '<div class="rx-line"><span class="rx-k">VA</span><span class="rx-v">' + va   + '</span></div>' : '')
          + '</div>';
      }

      var histHtml = tests.slice(1).map(function (t) {
        var reSph = t.re_sph != null ? 'RE ' + t.re_sph : '';
        var leSph = t.le_sph != null ? 'LE ' + t.le_sph : '';
        return '<div class="hist-row">'
          + '<div style="width:52px;flex-shrink:0"><div style="font-size:13px;font-weight:500;color:var(--text)">' + fmtDate(t.tested_at).split(' ')[1] + ' ' + new Date(t.tested_at).getFullYear().toString().slice(2) + '</div></div>'
          + '<div style="flex:1"><div style="font-size:12px;color:var(--text2);font-family:\'DM Mono\',monospace">' + [reSph, leSph].filter(Boolean).join(' / ') + '</div>'
          + (t.store_name ? '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + t.store_name + '</div>' : '')
          + '</div></div>';
      }).join('');

      body.innerHTML = addBtn
        + '<div class="section-label">Current Prescription <span style="color:var(--green);font-size:10px;font-weight:500;text-transform:none;letter-spacing:0">' + (latest.source === 'STAFF' ? '✓ Verified by store' : '● Self-entered') + '</span></div>'
        + '<div style="padding:0 16px;display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px" class="anim">'
        + rxBlock('re', latest) + rxBlock('le', latest)
        + '</div>'
        + (latest.pd || latest.lens_type
          ? '<div style="padding:0 16px;display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px" class="anim anim-1">'
            + (latest.pd ? '<div class="rx-block" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:14px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px">PD</div><div style="font-size:24px;font-weight:700;color:var(--text);font-family:\'DM Mono\',monospace;margin-top:4px">' + latest.pd + 'mm</div></div>' : '<div></div>')
            + (latest.lens_type ? '<div class="rx-block" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:14px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px">Lens</div><div style="font-size:16px;font-weight:600;color:var(--text);margin-top:4px">' + latest.lens_type + '</div></div>' : '<div></div>')
            + '</div>'
          : '')
        + '<div class="section-label">Power History</div>'
        + (histHtml ? '<div class="card anim anim-3">' + histHtml + '</div>' : '<div style="padding:0 16px;font-size:13px;color:var(--text3)">No older records.</div>');
    } catch (e) {
      body.innerHTML = '<div style="padding:32px 16px;text-align:center;color:var(--red)">' + e.message + '</div>';
    }
  }

  /* ── ORDERS ── */
  async function loadOrders() {
    var body = document.getElementById('orders-body');
    var nav  = document.getElementById('orders-nav');
    nav.innerHTML = navHtml('orders');
    body.innerHTML = skelCards(4);

    try {
      var res = await goApi('GET', '/orders');
      var orders = res.data;
      var ready  = orders.filter(function (o) { return o.status_label === 'Ready for Pickup'; });

      var readyBanner = ready.map(function (o) {
        return '<div class="pickup-banner anim" onclick="openOrderDetail(' + o.order_id + ')">'
          + '<div class="pb-tag">● Ready for Pickup</div>'
          + '<div class="pb-title">' + (o.first_item || 'Order') + '</div>'
          + '<div class="pb-sub">' + o.order_no + ' · ' + o.store_name + '</div>'
          + '<div class="pb-since"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Available since ' + fmtDate(o.created_at) + '</div>'
          + '</div>';
      }).join('');

      if (!orders.length) {
        body.innerHTML = '<div class="no-membership"><div class="nm-emoji">📦</div>'
          + '<h3>No orders yet</h3><p>Your orders from Eyewoot stores will appear here.</p></div>';
        return;
      }

      var listHtml = orders.map(function (o) {
        return '<div class="hist-row" onclick="openOrderDetail(' + o.order_id + ')">'
          + '<div class="order-thumb">🕶️</div>'
          + '<div style="flex:1"><div style="font-size:13px;font-weight:500;color:var(--text)">' + (o.first_item || 'Order') + '</div>'
          + '<div style="font-size:12px;color:var(--text3);margin-top:2px">' + o.order_no + ' · ' + o.order_kind + '</div></div>'
          + '<div style="text-align:right;flex-shrink:0">' + statusPill(o.status_label)
          + '<div style="font-size:13px;font-weight:500;color:var(--text);margin-top:4px">' + fmtMoney(o.total_amount) + '</div></div>'
          + '</div>';
      }).join('');

      body.innerHTML = readyBanner
        + '<div class="section-label">All Orders</div>'
        + '<div class="card anim anim-1">' + listHtml + '</div>';
    } catch (e) {
      body.innerHTML = '<div style="padding:32px 16px;text-align:center;color:var(--red)">' + e.message + '</div>';
    }
  }

  window.openOrderDetail = async function (orderId) {
    screenHistory.push('orders');
    showScreen('order-detail');
    var body = document.getElementById('order-detail-body');
    body.innerHTML = skelCards(3);

    try {
      var res = await goApi('GET', '/orders/' + orderId);
      var o = res.data;
      document.getElementById('order-detail-title').textContent = o.order_no;
      document.getElementById('order-detail-badge').innerHTML = statusPill(o.status_label);
      document.getElementById('order-detail-nav').innerHTML = navHtml('orders');

      var itemsHtml = o.items.map(function (i) {
        return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">'
          + '<div style="font-size:13px;color:var(--text)">' + i.line_key + (i.qty > 1 ? ' ×' + i.qty : '') + '</div>'
          + '<div style="font-size:13px;font-weight:500;color:var(--text)">' + fmtMoney(i.line_total) + '</div>'
          + '</div>';
      }).join('');

      var tlHtml = o.timeline.map(function (t, idx) {
        var isLast  = idx === o.timeline.length - 1;
        var dotColor = isLast ? 'var(--plus)' : 'var(--green)';
        var lineColor = isLast ? 'var(--bg4)' : 'var(--green)';
        return '<div class="timeline-row">'
          + '<div class="tl-line-wrap"><div class="tl-dot" style="background:' + dotColor + '"></div>'
          + (!isLast ? '<div class="tl-line" style="background:' + lineColor + '"></div>' : '')
          + '</div>'
          + '<div><div style="font-size:13px;font-weight:500;color:' + (isLast ? 'var(--plus)' : 'var(--text)') + '">' + t.status_label + '</div>'
          + '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + fmtDateTime(t.at) + (t.note ? ' · ' + t.note : '') + '</div>'
          + '</div></div>';
      }).join('');

      body.innerHTML =
        '<div class="card" style="margin-top:16px"><div class="card-pad">'
        + '<div style="font-family:\'Syne\',sans-serif;font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px">' + (o.items[0] && o.items[0].line_key || 'Order') + '</div>'
        + '<div style="font-size:13px;color:var(--text3)">' + o.order_kind + ' · ' + o.store_name + '</div>'
        + '<div style="font-size:18px;font-weight:700;color:var(--text);margin-top:8px">' + fmtMoney(o.total_amount) + '</div>'
        + '</div>'
        + '<div class="divider" style="margin:0"></div>'
        + '<div class="card-pad" style="display:flex;flex-direction:column;gap:9px">'
        + '<div style="display:flex;justify-content:space-between"><span style="font-size:12px;color:var(--text3)">Ordered</span><span style="font-size:12px;color:var(--text)">' + fmtDate(o.created_at) + '</span></div>'
        + '<div style="display:flex;justify-content:space-between"><span style="font-size:12px;color:var(--text3)">Store</span><span style="font-size:12px;color:var(--text)">' + o.store_name + '</span></div>'
        + (o.points_earned ? '<div style="display:flex;justify-content:space-between"><span style="font-size:12px;color:var(--text3)">Points earned</span><span style="font-size:12px;color:var(--gold);font-weight:500">+' + o.points_earned + ' pts</span></div>' : '')
        + '</div></div>'
        + (itemsHtml ? '<div class="section-label">Items</div><div class="card"><div class="card-pad">' + itemsHtml + '</div></div>' : '')
        + '<div class="section-label">Order Status</div>'
        + '<div class="card"><div class="card-pad">' + (tlHtml || '<div style="color:var(--text3);font-size:13px">No status updates yet.</div>') + '</div></div>';
    } catch (e) {
      body.innerHTML = '<div style="padding:32px 16px;text-align:center;color:var(--red)">' + e.message + '</div>';
    }
  };

  /* ── EYE TESTS ── */
  async function loadEyeTests() {
    var body = document.getElementById('eyetests-body');
    var nav  = document.getElementById('eyetests-nav');
    nav.innerHTML = navHtml('power');
    body.innerHTML = skelCards(3);

    try {
      var meRes  = await goApi('GET', '/me');
      var rxRes  = await goApi('GET', '/eye-tests');
      var hasMem = !!meRes.data.membership;
      var tests  = rxRes.data;

      var freeBanner = hasMem
        ? '<div style="background:var(--plus-bg);border:1px solid var(--plus-border);margin:16px;border-radius:var(--r-md);padding:14px 16px;display:flex;align-items:center;justify-content:space-between" class="anim">'
          + '<div><div style="font-size:11px;color:var(--plus);font-weight:600;text-transform:uppercase;letter-spacing:.8px">✦ Plus Benefit</div>'
          + '<div style="font-size:15px;font-weight:600;color:var(--text);margin-top:4px">1 free eye test available</div>'
          + '<div style="font-size:12px;color:var(--text3);margin-top:2px">Visit any Eyewoot store</div></div></div>'
        : '';

      var addBtn = '<div style="padding:8px 16px 0">'
        + '<button class="btn-primary" onclick="openModal(\'overlay-add-rx\')" style="font-size:14px">+ Add My Prescription</button></div>';

      if (!tests.length) {
        body.innerHTML = freeBanner + addBtn
          + '<div class="no-membership" style="margin-top:12px"><div class="nm-emoji">🔬</div>'
          + '<h3>No eye test records</h3><p>Your eye test history will appear here.</p></div>';
        return;
      }

      var listHtml = tests.map(function (t) {
        var d = new Date(t.tested_at);
        var reSph = t.re_sph != null ? t.re_sph : '—';
        var leSph = t.le_sph != null ? t.le_sph : '—';
        return '<div class="hist-row">'
          + '<div style="width:46px;flex-shrink:0;text-align:center">'
          + '<div class="test-date-day">' + d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit' }) + '</div>'
          + '<div class="test-date-mon">' + d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', year: '2-digit' }) + '</div>'
          + '</div>'
          + '<div style="flex:1">'
          + '<div style="font-size:13px;font-weight:500;color:var(--text)">' + (t.source === 'STAFF' ? 'Store Examination' : 'Self-entered') + '</div>'
          + (t.store_name ? '<div style="font-size:12px;color:var(--text3);margin-top:2px">' + (t.tested_by_name ? t.tested_by_name + ' · ' : '') + t.store_name + '</div>' : '')
          + '<div style="display:flex;gap:6px;margin-top:7px"><span class="rx-tag">RE ' + reSph + '</span><span class="rx-tag">LE ' + leSph + '</span></div>'
          + '</div></div>';
      }).join('');

      body.innerHTML = freeBanner + addBtn
        + '<div class="section-label">Visit History</div>'
        + '<div class="card anim anim-1">' + listHtml + '</div>';
    } catch (e) {
      body.innerHTML = '<div style="padding:32px 16px;text-align:center;color:var(--red)">' + e.message + '</div>';
    }
  }

  /* ── OFFERS ── */
  async function loadOffers() {
    var body = document.getElementById('offers-body');
    var nav  = document.getElementById('offers-nav');
    nav.innerHTML = navHtml('offers');
    body.innerHTML = skelCards(3);

    try {
      var res = await goApi('GET', '/offers');
      var offers = res.data;
      document.getElementById('offers-count').textContent = offers.length + ' active';

      if (!offers.length) {
        body.innerHTML = '<div class="no-membership"><div class="nm-emoji">🎁</div>'
          + '<h3>No offers right now</h3><p>Check back soon — exclusive deals for Eyewoot members come here.</p></div>';
        return;
      }

      var plusOffers  = offers.filter(function (o) { return o.is_plus_only; });
      var openOffers  = offers.filter(function (o) { return !o.is_plus_only; });

      function offerCard(o, idx) {
        var isPlus = o.is_plus_only;
        return '<div class="offer-card' + (isPlus ? ' plus-offer' : '') + ' anim anim-' + (idx + 1) + '">'
          + '<div class="offer-icon-box" style="background:var(--plus-bg)">' + o.icon_emoji + '</div>'
          + '<div style="flex:1">'
          + (isPlus ? '<div style="margin-bottom:5px"><span class="pill pill-plus" style="font-size:10px">✦ Plus</span></div>' : '')
          + '<div style="font-size:14px;font-weight:600;color:var(--text)">' + o.title + '</div>'
          + '<div style="font-size:12px;color:var(--text3);margin-top:2px">' + o.description + '</div>'
          + '<div style="font-size:11px;color:var(--text3);margin-top:5px">Expires ' + fmtDate(o.valid_to) + '</div>'
          + '</div></div>';
      }

      body.innerHTML =
        (plusOffers.length  ? '<div class="section-label">Plus Member Offers</div><div style="padding:0 16px">' + plusOffers.map(offerCard).join('') + '</div>' : '')
        + (openOffers.length ? '<div class="section-label">Open Offers</div><div style="padding:0 16px 16px">' + openOffers.map(offerCard).join('') + '</div>' : '');
    } catch (e) {
      body.innerHTML = '<div style="padding:32px 16px;text-align:center;color:var(--red)">' + e.message + '</div>';
    }
  }

  /* ── LOYALTY ── */
  async function loadLoyalty() {
    var body = document.getElementById('loyalty-body');
    var nav  = document.getElementById('loyalty-nav');
    nav.innerHTML = navHtml('');
    body.innerHTML = skelCards(3);

    try {
      var res = await goApi('GET', '/loyalty');
      var d = res.data;

      var prog = d.tiers.find(function (t) { return t.tier_name === d.tier; });
      var progPct = 0;
      if (prog && prog.max_points > 0) {
        progPct = Math.min(100, Math.round(((d.balance - prog.min_points) / (prog.max_points - prog.min_points)) * 100));
      } else if (prog && prog.max_points === -1) {
        progPct = 100;
      }

      var ledgerHtml = d.ledger.map(function (row) {
        var isEarn = row.points_delta > 0;
        return '<div class="hist-row">'
          + '<div class="ledger-icon ' + (isEarn ? 'ledger-earn' : 'ledger-redeem') + '" style="color:var(' + (isEarn ? '--green' : '--red') + ');font-size:14px">' + (isEarn ? '＋' : '－') + '</div>'
          + '<div style="flex:1">'
          + '<div style="font-size:13px;font-weight:500;color:var(--text)">' + row.reason + (row.order_no ? ' · ' + row.order_no : '') + '</div>'
          + '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + fmtDate(row.created_at) + '</div>'
          + '</div>'
          + '<span style="font-size:15px;font-weight:700;color:var(' + (isEarn ? '--green' : '--red') + ')">' + (isEarn ? '+' : '') + row.points_delta + '</span>'
          + '</div>';
      }).join('');

      body.innerHTML =
        '<div class="gold-hero anim">'
        + '<div style="font-size:11px;color:rgba(255,255,255,.75);text-transform:uppercase;letter-spacing:1px;font-weight:500;position:relative;z-index:1">Available Balance</div>'
        + '<div style="font-family:\'DM Mono\',monospace;font-size:42px;font-weight:700;margin-top:6px;line-height:1;position:relative;z-index:1">' + Number(d.balance).toLocaleString('en-IN') + '</div>'
        + '<div style="font-size:14px;color:rgba(255,255,255,.8);margin-top:4px;position:relative;z-index:1">≈ ' + fmtMoney(d.balance / 10) + ' redeemable value</div>'
        + '<div style="margin-top:16px;display:flex;gap:16px;position:relative;z-index:1">'
        + '<div><div style="font-size:10px;color:rgba(255,255,255,.65)">Tier</div><div style="font-size:15px;font-weight:600;margin-top:2px">' + d.tier + '</div></div>'
        + (d.next_tier ? '<div style="width:1px;background:rgba(255,255,255,.25)"></div><div><div style="font-size:10px;color:rgba(255,255,255,.65)">To ' + d.next_tier + '</div><div style="font-size:15px;font-weight:600;margin-top:2px">' + Number(d.pts_to_next).toLocaleString('en-IN') + ' pts</div></div>' : '')
        + '</div>'
        + '<div style="margin-top:14px;height:6px;background:rgba(255,255,255,.25);border-radius:3px;overflow:hidden;position:relative;z-index:1">'
        + '<div style="height:100%;width:' + progPct + '%;background:rgba(255,255,255,.85);border-radius:3px"></div></div>'
        + '</div>'
        + '<div class="section-label">Recent Activity</div>'
        + (ledgerHtml ? '<div class="card anim anim-1">' + ledgerHtml + '</div>' : '<div style="padding:0 16px;font-size:13px;color:var(--text3)">No transactions yet.</div>');
    } catch (e) {
      body.innerHTML = '<div style="padding:32px 16px;text-align:center;color:var(--red)">' + e.message + '</div>';
    }
  }

  /* ── PROFILE ── */
  async function loadProfile() {
    var body = document.getElementById('profile-body');
    var nav  = document.getElementById('profile-nav');
    nav.innerHTML = navHtml('profile');
    body.innerHTML = '<div style="padding:16px">' + skelLines(5, true) + '</div>';

    try {
      var d = meCache || (await goApi('GET', '/me')).data;
      if (!meCache) meCache = d;

      var phone = (d.home_store && d.home_store.phone) || null;
      var waNum = phone ? phone.replace(/\D/g, '') : null;

      var lifeprefs = d.lifestyle_prefs || {};

      body.innerHTML =
        '<div style="display:flex;flex-direction:column;align-items:center;padding:24px 20px 16px" class="anim">'
        + '<div class="profile-avatar-lg">' + initials(d.full_name) + '</div>'
        + '<div style="font-family:\'Syne\',sans-serif;font-size:22px;font-weight:700;color:var(--text);margin-top:14px">' + d.full_name + '</div>'
        + '<div style="font-size:13px;color:var(--text3);margin-top:4px">CX-' + String(d.customer_id).padStart(5, '0') + ' · Member since ' + fmtDate(d.member_since).split(' ').slice(1).join(' ') + '</div>'
        + '<div style="display:flex;gap:8px;margin-top:10px">'
        + (d.membership ? '<span class="pill pill-plus">✦ Plus Member</span>' : '')
        + '<span class="pill pill-gold">' + d.loyalty.tier + ' tier</span>'
        + '</div></div>'
        + '<div class="card anim anim-1">'
        + '<div class="row-item"><div class="row-icon" style="background:var(--bg3)">📱</div><div><div class="row-title">Phone</div><div class="row-sub">' + d.phone + '</div></div></div>'
        + (d.email ? '<div class="divider" style="margin:0"></div><div class="row-item"><div class="row-icon" style="background:var(--bg3)">✉️</div><div><div class="row-title">Email</div><div class="row-sub">' + d.email + '</div></div></div>' : '')
        + (d.dob ? '<div class="divider" style="margin:0"></div><div class="row-item"><div class="row-icon" style="background:var(--bg3)">🎂</div><div><div class="row-title">Date of birth</div><div class="row-sub">' + fmtDate(d.dob) + '</div></div></div>' : '')
        + (d.home_store ? '<div class="divider" style="margin:0"></div><div class="row-item"><div class="row-icon" style="background:var(--bg3)">🏪</div><div><div class="row-title">Home store</div><div class="row-sub">' + d.home_store.name + '</div></div></div>' : '')
        + '</div>'
        + (lifeprefs.screen_hrs || lifeprefs.frame_pref || lifeprefs.budget_min
          ? '<div class="section-label">Lifestyle Preferences</div>'
            + '<div class="card anim anim-2">'
            + (lifeprefs.screen_hrs ? '<div class="row-item"><div class="row-icon" style="background:var(--bg3)">💻</div><div><div class="row-title">Screen time</div><div class="row-sub">' + lifeprefs.screen_hrs + ' hrs/day</div></div></div><div class="divider" style="margin:0"></div>' : '')
            + (lifeprefs.frame_pref ? '<div class="row-item"><div class="row-icon" style="background:var(--bg3)">🕶️</div><div><div class="row-title">Frame preference</div><div class="row-sub">' + lifeprefs.frame_pref + '</div></div></div><div class="divider" style="margin:0"></div>' : '')
            + (lifeprefs.budget_min ? '<div class="row-item"><div class="row-icon" style="background:var(--bg3)">💰</div><div><div class="row-title">Budget range</div><div class="row-sub">' + fmtMoney(lifeprefs.budget_min) + ' – ' + fmtMoney(lifeprefs.budget_max) + '</div></div></div>' : '')
            + '</div>'
          : '')
        + (phone
          ? '<div class="support-btns">'
            + (waNum ? '<a class="support-btn whatsapp" href="https://wa.me/' + waNum + '" target="_blank">💬 WhatsApp Store</a>' : '')
            + '<a class="support-btn call" href="tel:' + phone + '">📞 Call Store</a>'
            + '</div>'
          : '')
        + '<div style="padding:4px 16px 20px">'
        + '<button class="btn-secondary" style="color:var(--red);border-color:#F0C0C0" onclick="logoutUser()">Sign Out</button></div>';
    } catch (e) {
      body.innerHTML = '<div style="padding:32px 16px;text-align:center;color:var(--red)">' + e.message + '</div>';
    }
  }

  /* ══════════════════════════════════════════════════════════════
     MODALS
  ══════════════════════════════════════════════════════════════ */
  window.openModal  = function (id) { document.getElementById(id).classList.add('open'); };
  window.closeModal = function (id) { document.getElementById(id).classList.remove('open'); };

  /* ── Add Dependent ── */
  window.addDependent = async function () {
    var phone = document.getElementById('dep-phone').value.trim();
    var rel   = document.getElementById('dep-relationship').value.trim();
    var errEl = document.getElementById('dep-error');
    var btn   = document.getElementById('dep-btn');

    errEl.classList.remove('visible');
    if (!phone || !rel) { errEl.textContent = 'Please fill all fields.'; errEl.classList.add('visible'); return; }

    btn.disabled = true; btn.textContent = 'Adding…';
    try {
      var res = await goApi('POST', '/membership/add-dependent', { phone, relationship: rel });
      var linkBox = document.getElementById('invite-link-box');
      document.getElementById('invite-link-url').textContent = res.invite_link;
      linkBox.classList.add('visible');
      btn.textContent = '✓ Added';
      goToast('Family member added!', 'success');
      meCache = null;
    } catch (e) {
      errEl.textContent = e.message; errEl.classList.add('visible');
      btn.disabled = false; btn.textContent = 'Add Member';
    }
  };

  window.copyInviteLink = function () {
    var url = document.getElementById('invite-link-url').textContent;
    navigator.clipboard.writeText(url).then(function () { goToast('Link copied!'); });
  };

  /* ── Prescription Mode ── */
  window.setRxMode = function (mode, btn) {
    document.querySelectorAll('.rx-mode-tab').forEach(function (t) { t.classList.remove('active'); });
    btn.classList.add('active');
    document.querySelectorAll('.rx-form-panel').forEach(function (p) { p.classList.remove('active'); });
    document.getElementById('rx-panel-' + (mode === 'simple' ? 'simple' : mode === 'photo' ? 'photo' : 'full')).classList.add('active');
  };

  window.previewRxPhoto = function (input) {
    if (!input.files || !input.files[0]) return;
    var preview = document.getElementById('rx-photo-preview');
    preview.src = URL.createObjectURL(input.files[0]);
    preview.style.display = 'block';
  };

  window.submitRx = async function (mode) {
    var errId = 'rx-' + (mode === 'photo' ? 'photo' : mode === 'simple' ? 'simple' : 'full') + '-error';
    var errEl = document.getElementById(errId);
    if (errEl) errEl.classList.remove('visible');

    try {
      if (mode === 'photo') {
        var file = document.getElementById('rx-photo-file').files[0];
        if (!file) { if (errEl) { errEl.textContent = 'Please select a photo.'; errEl.classList.add('visible'); } return; }
        var fd = new FormData();
        fd.append('rx_photo', file);
        var btn = document.getElementById('rx-photo-btn');
        btn.disabled = true; btn.textContent = 'Uploading…';
        var res = await goApi('POST', '/eye-tests/photo', fd, true);
        btn.disabled = false; btn.textContent = 'Upload Prescription';
        closeModal('overlay-add-rx');
        goToast('Prescription photo uploaded!', 'success');
        loadEyeTests();
        return;
      }

      var body = {};
      if (mode === 'full') {
        body = {
          re_sph: document.getElementById('rx-re-sph').value || null,
          re_cyl: document.getElementById('rx-re-cyl').value || null,
          re_axis: document.getElementById('rx-re-axis').value || null,
          re_add: document.getElementById('rx-re-add').value || null,
          le_sph: document.getElementById('rx-le-sph').value || null,
          le_cyl: document.getElementById('rx-le-cyl').value || null,
          le_axis: document.getElementById('rx-le-axis').value || null,
          le_add: document.getElementById('rx-le-add').value || null,
          pd: document.getElementById('rx-full-pd').value || null,
          lens_type: document.getElementById('rx-full-lens').value || null
        };
      } else {
        body = {
          re_sph: document.getElementById('rx-s-re-sph').value || null,
          re_cyl: document.getElementById('rx-s-re-cyl').value || null,
          le_sph: document.getElementById('rx-s-le-sph').value || null,
          le_cyl: document.getElementById('rx-s-le-cyl').value || null,
          pd: document.getElementById('rx-s-pd').value || null
        };
      }

      if (!body.re_sph && !body.le_sph) {
        if (errEl) { errEl.textContent = 'Please enter at least one eye\'s SPH value.'; errEl.classList.add('visible'); }
        return;
      }

      await goApi('POST', '/eye-tests', body);
      closeModal('overlay-add-rx');
      goToast('Prescription saved!', 'success');
      loadPower();
      loadEyeTests();
    } catch (e) {
      if (errEl) { errEl.textContent = e.message; errEl.classList.add('visible'); }
      else goToast(e.message, 'error');
    }
  };

  /* ══════════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════════ */
  function init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/go-sw.js').catch(function () {});
    }
    var token = getToken();
    if (token) {
      showScreen('home');
    } else {
      showScreen('login');
    }
  }

  return { init: init };
})();

document.addEventListener('DOMContentLoaded', function () { GO.init(); });
