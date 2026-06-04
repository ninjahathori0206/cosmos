/* Cosmos Hub — unified app launcher
   Reads JWT modules map → renders only accessible app tiles.
   No API calls after login. Pure JWT-driven UI. */

(function () {
  'use strict';

  var resolvedApiKey = '';

  async function fetchBootstrap() {
    var res = await fetch('/config/bootstrap.json', { cache: 'no-store' });
    var text = await res.text();
    var data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      throw new Error('Server returned a non-JSON response. Is the API running on this host and port?');
    }
    if (!res.ok || !data.success) {
      throw new Error((data && data.message) || 'Could not load app configuration');
    }
    var key = data.data && data.data.apiKey;
    if (!key) {
      throw new Error('API_KEY is not set on the server. Add API_KEY to your .env file (see .env.example).');
    }
    resolvedApiKey = String(key).trim();
    try {
      sessionStorage.setItem('cosmos_api_key', resolvedApiKey);
    } catch (_) {}
    return resolvedApiKey;
  }

  async function ensureApiKey() {
    if (resolvedApiKey) return resolvedApiKey;
    try {
      var cached = sessionStorage.getItem('cosmos_api_key');
      if (cached && String(cached).trim()) {
        resolvedApiKey = String(cached).trim();
        return resolvedApiKey;
      }
    } catch (_) {}
    return fetchBootstrap();
  }

  // ── App catalogue ─────────────────────────────────────────────────────────
  // moduleKey must match normModuleKey() in authorize.js (lowercase, no special chars)
  var APP_CATALOGUE = [
    {
      moduleKey: 'storepilot',
      label: 'StorePilot',
      description: 'Showroom floor, appointments, walk-ins',
      icon: '🏬',
      url: '/storepilot/dashboard',
      accent: '#6366f1'
    },
    {
      moduleKey: 'pos',
      label: 'Store OS',
      description: 'Sales, billing, prescriptions, POS',
      icon: '🧾',
      url: '/storeos/login',
      accent: '#0ea5e9'
    },
    {
      moduleKey: 'foundry',
      label: 'Foundry',
      description: 'Inventory, procurement, lab orders',
      icon: '🔩',
      url: '/foundry/dashboard',
      accent: '#f59e0b'
    },
    {
      moduleKey: 'finance',
      label: 'Finance',
      description: 'Accounts, payments, outstanding',
      icon: '💰',
      url: '/finance/dashboard',
      accent: '#10b981'
    },
    {
      moduleKey: 'cx',
      label: 'CX',
      description: 'Customer analytics, membership, loyalty',
      icon: '📊',
      url: '/cx/dashboard',
      accent: '#8b5cf6'
    },
    {
      moduleKey: 'army',
      label: 'Army',
      description: 'HR, attendance, leaves, payroll',
      icon: '🪖',
      url: '/army/hr/dashboard',
      accent: '#ef4444'
    },
    {
      moduleKey: 'command_unit',
      label: 'Command Unit',
      description: 'Admin, roles, stores, settings',
      icon: '⚙️',
      url: '/command-unit/dashboard',
      accent: '#64748b'
    }
  ];

  // ── Helpers ───────────────────────────────────────────────────────────────

  function normKey(k) {
    return String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function (s) {
      s.classList.remove('active');
    });
    var el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  function setError(msg) {
    var el = document.getElementById('login-error');
    if (el) el.textContent = msg || '';
  }

  function setLoginLoading(loading) {
    var btn = document.getElementById('login-btn');
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Signing in…' : 'Sign In';
  }

  function greeting(name) {
    var h = new Date().getHours();
    var salutation = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return salutation + ', ' + (name ? name.split(' ')[0] : 'there') + '.';
  }

  // ── Module access check ───────────────────────────────────────────────────
  // Mirrors authorize.js legacyModuleAllowAll + hasModuleAccess, client-side.

  function isSuperAdmin(user) {
    return String(user.role || '').toLowerCase() === 'super_admin';
  }

  function legacyAllowAll(modules) {
    if (modules == null || typeof modules !== 'object') return true;
    return Object.keys(modules).length === 0;
  }

  function hasModuleAccess(modules, moduleKey) {
    var mk = normKey(moduleKey);
    if (legacyAllowAll(modules)) return true;
    if (modules[mk] === true) return true;
    return Object.keys(modules).some(function (k) {
      return normKey(k) === mk && modules[k] === true;
    });
  }

  function getAccessibleApps(user) {
    if (isSuperAdmin(user) || legacyAllowAll(user.modules)) {
      return APP_CATALOGUE;
    }
    return APP_CATALOGUE.filter(function (app) {
      return hasModuleAccess(user.modules, app.moduleKey);
    });
  }

  // ── Render hub grid ───────────────────────────────────────────────────────

  function renderHub(user) {
    var nameEl = document.getElementById('hub-user-name');
    var roleEl = document.getElementById('hub-user-role');
    var greetEl = document.getElementById('hub-greeting');
    var grid = document.getElementById('hub-grid');

    if (nameEl) nameEl.textContent = user.full_name || user.username || '';
    if (roleEl) roleEl.textContent = user.role_display || user.role || '';
    if (greetEl) greetEl.textContent = greeting(user.full_name);

    var apps = getAccessibleApps(user);

    if (!apps.length) {
      grid.innerHTML = '<div class="hub-empty">No modules assigned to your account.<br>Contact your administrator.</div>';
      return;
    }

    grid.innerHTML = apps.map(function (app) {
      return [
        '<a class="app-tile" href="' + app.url + '" style="--tile-accent:' + app.accent + '">',
        '  <div class="app-tile-icon">' + app.icon + '</div>',
        '  <div class="app-tile-label">' + app.label + '</div>',
        '  <div class="app-tile-desc">' + app.description + '</div>',
        '</a>'
      ].join('');
    }).join('');
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async function doLogin() {
    setError('');
    var username = (document.getElementById('login-username').value || '').trim();
    var password = (document.getElementById('login-password').value || '');

    if (!username || !password) {
      setError('Enter username and password.');
      return;
    }

    setLoginLoading(true);

    try {
      var apiKey;
      try {
        apiKey = await ensureApiKey();
      } catch (bootErr) {
        setError(bootErr.message || 'Configuration load failed.');
        return;
      }

      var res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({ username: username, password: password })
      });
      var data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Invalid credentials.');
        return;
      }

      sessionStorage.setItem('cosmos_token', data.data.token);
      sessionStorage.setItem('cosmos_user', JSON.stringify(data.data.user));
      if (apiKey) {
        try {
          sessionStorage.setItem('cosmos_api_key', apiKey);
        } catch (_) {}
      }

      renderHub(data.data.user);
      showScreen('screen-hub');

    } catch (err) {
      setError('Network error. Try again.');
    } finally {
      setLoginLoading(false);
    }
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  function boot() {
    // Already logged in?
    var token = sessionStorage.getItem('cosmos_token');
    var userRaw = sessionStorage.getItem('cosmos_user');

    if (token && userRaw) {
      try {
        var user = JSON.parse(userRaw);
        renderHub(user);
        showScreen('screen-hub');
      } catch (_) {
        sessionStorage.clear();
        showScreen('screen-login');
      }
    } else {
      showScreen('screen-login');
    }

    fetchBootstrap().catch(function (err) {
      if (!document.getElementById('screen-login').classList.contains('active')) return;
      setError(err.message || 'Could not reach the server configuration endpoint.');
    });

    // Login button
    var loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', doLogin);
    }

    // Enter key on password field
    var pwField = document.getElementById('login-password');
    if (pwField) {
      pwField.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doLogin();
      });
    }

    // Sign out
    var signoutBtn = document.getElementById('hub-signout-btn');
    if (signoutBtn) {
      signoutBtn.addEventListener('click', function () {
        sessionStorage.removeItem('cosmos_token');
        sessionStorage.removeItem('cosmos_user');
        showScreen('screen-login');
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
      });
    }
  }

  document.addEventListener('DOMContentLoaded', boot);

})();
