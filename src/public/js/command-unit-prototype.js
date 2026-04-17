const API_KEY = 'CHANGE_ME_API_KEY';

function fmtIstDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
}

function fmtIstTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
}

document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('cosmos_token');
  const userRaw = sessionStorage.getItem('cosmos_user');

  if (!token || !userRaw) {
    window.location.href = '/';
    return;
  }

  const user = JSON.parse(userRaw);

  /** When login returned a non-empty modules map, enforce it (missing key = allowed for backward compatibility). */
  function cosmosModuleAllowed(modKey) {
    const mods = user.modules;
    if (!mods || typeof mods !== 'object' || Object.keys(mods).length === 0) return true;
    return mods[modKey] !== false;
  }

  if (!cosmosModuleAllowed('command_unit')) {
    if (cosmosModuleAllowed('foundry')) window.location.href = '/foundry.html';
    else if (cosmosModuleAllowed('finance')) window.location.href = '/finance.html';
    else if (cosmosModuleAllowed('storepilot')) window.location.href = '/storepilot.html';
    else {
      sessionStorage.removeItem('cosmos_token');
      sessionStorage.removeItem('cosmos_user');
      window.location.href = '/';
    }
    return;
  }

  document.querySelectorAll('[data-cosmos-module]').forEach((el) => {
    const key = el.getAttribute('data-cosmos-module');
    if (!key) return;
    el.style.display = cosmosModuleAllowed(key) ? '' : 'none';
  });

  const sidebarUser = document.querySelector('.sidebar-user .user-info');
  const sidebarAvatar = document.querySelector('.sidebar-user .user-avatar');
  if (sidebarUser) {
    const nameEl = sidebarUser.querySelector('.user-name');
    const roleEl = sidebarUser.querySelector('.user-role');
    if (nameEl) nameEl.textContent = user.full_name || user.username || 'User';
    if (roleEl) roleEl.textContent = user.role || roleEl.textContent;
  }
  if (sidebarAvatar && user.full_name) {
    sidebarAvatar.textContent = user.full_name.split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  }

  // ─── HTTP helpers ──────────────────────────────────────────────────────────

  function authHeaders(extra) {
    return Object.assign({ 'X-API-Key': API_KEY, Authorization: `Bearer ${token}` }, extra || {});
  }

  async function apiGet(path) {
    const res = await fetch(path, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok || !data.success) {
      const details = Array.isArray(data.errors) ? ` — ${data.errors.join('; ')}` : '';
      throw new Error((data.message || 'Request failed') + details);
    }
    return data.data;
  }

  async function apiPost(path, body) {
    const res = await fetch(path, { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok || !data.success) {
      const details = Array.isArray(data.errors) ? ` — ${data.errors.join('; ')}` : '';
      throw new Error((data.message || 'Request failed') + details);
    }
    return data.data;
  }

  async function apiPut(path, body) {
    const res = await fetch(path, { method: 'PUT', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok || !data.success) {
      const details = Array.isArray(data.errors) ? ` — ${data.errors.join('; ')}` : '';
      throw new Error((data.message || 'Request failed') + details);
    }
    return data.data;
  }

  async function apiDelete(path) {
    const res = await fetch(path, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (!res.ok || !data.success) {
      const details = Array.isArray(data.errors) ? ` — ${data.errors.join('; ')}` : '';
      throw new Error((data.message || 'Request failed') + details);
    }
    return data.data;
  }

  function showError(elId, msg) {
    const el = document.getElementById(elId);
    if (el) el.textContent = msg || '';
  }

  function setBtn(btnId, disabled) {
    const btn = document.getElementById(btnId);
    if (btn) btn.disabled = disabled;
  }

  function bindPasswordToggle(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    if (!input || !toggle) return;
    toggle.addEventListener('click', () => {
      const showPlain = input.type === 'password';
      input.type = showPlain ? 'text' : 'password';
      toggle.textContent = showPlain ? 'Hide' : 'Show';
      toggle.setAttribute('aria-label', showPlain ? 'Hide password' : 'Show password');
    });
  }

  function resetPasswordField(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    if (!input || !toggle) return;
    input.type = 'password';
    toggle.textContent = 'Show';
    toggle.setAttribute('aria-label', 'Show password');
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function valStoreId(selectId) {
    const el = document.getElementById(selectId);
    if (!el || !el.value) return null;
    const n = Number(el.value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  /** Fill role dropdowns from cachedRoles (after /api/roles load). */
  function refreshRoleDropdowns() {
    const roles = (cachedRoles || []).slice().sort((a, b) => a.display_name.localeCompare(b.display_name));
    const buildOpts = (sel, keepValue) => {
      if (!sel) return;
      const prev = keepValue !== undefined ? keepValue : sel.value;
      const firstOpt = sel.options[0];
      sel.innerHTML = '';
      if (firstOpt) sel.appendChild(firstOpt);
      roles.forEach((r) => {
        const opt = document.createElement('option');
        opt.value = r.role_key;
        opt.textContent = `${r.display_name} (${r.role_key})`;
        sel.appendChild(opt);
      });
      if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
    };
    buildOpts(document.getElementById('new-user-role'));
    buildOpts(document.getElementById('edit-user-role'));
  }

  /** Fill store dropdowns from cachedStores (after /api/stores load). */
  function refreshStoreDropdowns() {
    const stores = (cachedStores || []).filter((s) => resolveStatus(s) === 'ACTIVE').sort((a, b) =>
      String(a.store_name || '').localeCompare(String(b.store_name || ''))
    );
    const buildOptions = (sel, keepValue) => {
      if (!sel) return;
      const prev = keepValue !== undefined ? keepValue : sel.value;
      const firstOpt = sel.options[0];
      sel.innerHTML = '';
      if (firstOpt) sel.appendChild(firstOpt);
      stores.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = String(s.store_id);
        opt.textContent = `${s.store_name || 'Store'} (${s.store_code || s.store_id})`;
        sel.appendChild(opt);
      });
      if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
    };
    buildOptions(document.getElementById('new-user-store'));
    buildOptions(document.getElementById('edit-user-store'));
    const modStore = document.getElementById('module-store-select');
    if (modStore) {
      const prev = modStore.value;
      modStore.innerHTML = '<option value="">— Select a store —</option>';
      stores.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = String(s.store_id);
        opt.textContent = `${s.store_name || 'Store'} (${s.store_code || s.store_id})`;
        modStore.appendChild(opt);
      });
      if (prev && [...modStore.options].some((o) => o.value === prev)) modStore.value = prev;
    }
  }

  function escHtml(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function escAttr(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  }

  // Display a rate without trailing zeros: 5.00 → "5", 2.50 → "2.5", 18.00 → "18"
  function fmtRate(n) {
    const v = parseFloat(n);
    if (isNaN(v)) return '0';
    return String(parseFloat(v.toFixed(4)));
  }

  // ─── Status / format helpers ───────────────────────────────────────────────

  function resolveStatus(s) { return s.status || (s.is_active ? 'ACTIVE' : 'INACTIVE'); }

  function mapDropdownStatusToCode(text) {
    if (text === 'Coming Soon') return 'COMING_SOON';
    if (text === 'Inactive') return 'INACTIVE';
    return 'ACTIVE';
  }

  function mapStatusCodeToDropdown(status) {
    if (status === 'COMING_SOON') return 'Coming Soon';
    if (status === 'INACTIVE') return 'Inactive';
    return 'Active';
  }

  function mapFormatToStoreType(format) {
    if (format === 'Eyewoot-Owned') return 'Owned';
    if (format === 'Franchise') return 'Franchise';
    if (format === 'Kiosk / Pop-up') return 'Kiosk';
    if (format === 'Online / D2C') return 'Online';
    return format;
  }

  function mapStoreTypeToFormat(storeType) {
    if (storeType === 'Owned') return 'Eyewoot-Owned';
    if (storeType === 'Franchise') return 'Franchise';
    if (storeType === 'Kiosk') return 'Kiosk / Pop-up';
    if (storeType === 'Online') return 'Online / D2C';
    return storeType || 'Eyewoot-Owned';
  }

  function statusBadge(code, text) {
    const cls = code === 'ACTIVE' ? 'badge-green' : code === 'COMING_SOON' ? 'badge-gold' : 'badge-gray';
    return `<span class="badge ${cls}">${text || mapStatusCodeToDropdown(code)}</span>`;
  }

  // ─── STORES ───────────────────────────────────────────────────────────────

  let cachedStores = [];

  async function loadStores() {
    const table = document.querySelector('#page-stores table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      const stores = await apiGet('/api/stores');
      cachedStores = stores;

      const total = stores.length;
      const active = stores.filter((s) => resolveStatus(s) === 'ACTIVE').length;
      const comingSoon = stores.filter((s) => resolveStatus(s) === 'COMING_SOON').length;
      const inactive = stores.filter((s) => resolveStatus(s) === 'INACTIVE').length;

      const statsCards = document.querySelectorAll('#page-stores .stats-grid .stat-card');
      if (statsCards[0]) statsCards[0].querySelector('.stat-value').textContent = String(active);
      if (statsCards[1]) statsCards[1].querySelector('.stat-value').textContent = String(comingSoon);
      if (statsCards[2]) statsCards[2].querySelector('.stat-value').textContent = String(inactive);
      if (statsCards[3]) statsCards[3].querySelector('.stat-value').textContent = String(total);

      const subtitle = document.querySelector('#page-stores .page-subtitle');
      if (subtitle) subtitle.textContent = `${active} active · ${comingSoon} coming soon · ${inactive} inactive`;

      // Module page user selector is populated by loadUsers()

      renderStoreRows();
      bindStoreFilters();
      refreshStoreDropdowns();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="td-muted">Error: ${err.message}</td></tr>`;
    }
  }

  function renderStoreRows() {
    const table = document.querySelector('#page-stores table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('store-search')?.value || '').toLowerCase().trim();
    const formatFilter = document.getElementById('store-filter-format')?.value || '';
    const statusFilter = document.getElementById('store-filter-status')?.value || '';

    const filtered = cachedStores.filter((s) => {
      const statusCode = resolveStatus(s);
      if (statusFilter && statusCode !== statusFilter) return false;
      if (formatFilter && (s.store_type || '') !== formatFilter) return false;
      if (searchTerm) {
        const haystack = [s.store_name, s.store_code, s.city, s.state, s.gstin, s.address]
          .filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(searchTerm)) return false;
      }
      return true;
    });

    tbody.innerHTML = '';
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="td-muted" style="text-align:center;padding:24px">No stores match your search.</td></tr>`;
      return;
    }

    filtered.forEach((s) => {
      const statusCode = resolveStatus(s);
      const tr = document.createElement('tr');
      tr.dataset.storeId = s.store_id;
      tr.innerHTML = `
        <td><div class="fw-600">${s.store_name}</div><div class="td-muted">${s.address || ''}</div></td>
        <td class="font-mono text-xs">${s.store_code}</td>
        <td><span class="badge badge-purple">${s.store_type || 'Store'}</span></td>
        <td>${s.city || ''}${s.city && s.state ? ', ' : ''}${s.state || ''}</td>
        <td class="font-mono text-xs">${s.gstin || ''}</td>
        <td><span class="badge badge-green">All</span></td>
        <td>${statusBadge(statusCode)}</td>
        <td><button class="topbar-btn store-edit-btn" style="padding:5px 10px;font-size:12px">Edit</button></td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.store-edit-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.target.closest('tr').dataset.storeId);
        openEditStoreModal(id);
      });
    });
  }

  function bindStoreFilters() {
    const searchEl = document.getElementById('store-search');
    const formatEl = document.getElementById('store-filter-format');
    const statusEl = document.getElementById('store-filter-status');
    if (searchEl) searchEl.addEventListener('input', renderStoreRows);
    if (formatEl) formatEl.addEventListener('change', renderStoreRows);
    if (statusEl) statusEl.addEventListener('change', renderStoreRows);
  }

  async function handleCreateStore() {
    showError('new-store-error', '');
    setBtn('new-store-save-btn', true);
    try {
      const body = {
        store_name: val('new-store-name'),
        store_code: val('new-store-code'),
        store_type: mapFormatToStoreType(val('new-store-format')),
        gstin: val('new-store-gstin') || null,
        address: val('new-store-address') || null,
        city: val('new-store-city') || null,
        state: val('new-store-state') || null,
        phone: val('new-store-phone') || null,
        status: mapDropdownStatusToCode(val('new-store-status'))
      };
      if (!body.store_name || !body.store_code) throw new Error('Store name and store code are required.');
      await apiPost('/api/stores', body);
      window.closeModal && window.closeModal('modal-new-store');
      document.getElementById('new-store-name').value = '';
      document.getElementById('new-store-code').value = '';
      await loadStores();
      await loadDashboard();
    } catch (err) {
      showError('new-store-error', err.message || 'Failed to create store');
    } finally {
      setBtn('new-store-save-btn', false);
    }
  }

  async function openEditStoreModal(storeId) {
    const s = cachedStores.find((st) => st.store_id === storeId);
    if (!s) return;
    const statusCode = resolveStatus(s);
    const statusText = mapStatusCodeToDropdown(statusCode);

    const title = document.getElementById('edit-store-title');
    const sub = document.getElementById('edit-store-subtitle');
    if (title) title.textContent = s.store_name;
    if (sub) sub.textContent = `${s.store_code} · ${mapStoreTypeToFormat(s.store_type)} · ${statusText}`;

    document.getElementById('edit-store-name').value = s.store_name || '';
    document.getElementById('edit-store-code').value = s.store_code || '';
    document.getElementById('edit-store-format').value = mapStoreTypeToFormat(s.store_type);
    document.getElementById('edit-store-status').value = statusText;
    document.getElementById('edit-store-gstin').value = s.gstin || '';
    document.getElementById('edit-store-state').value = s.state || '';
    document.getElementById('edit-store-city').value = s.city || '';
    document.getElementById('edit-store-phone').value = s.phone || '';
    document.getElementById('edit-store-address').value = s.address || '';
    showError('edit-store-error', '');

    const createdEl = document.getElementById('store-created-at');
    const updatedEl = document.getElementById('store-updated-at');
    const statusEl = document.getElementById('store-status-kpi');
    if (createdEl) createdEl.textContent = s.created_at ? fmtIstDateTime(s.created_at) : '—';
    if (updatedEl) updatedEl.textContent = s.updated_at ? fmtIstDateTime(s.updated_at) : '—';
    if (statusEl) {
      statusEl.textContent = statusText;
      statusEl.style.color = statusCode === 'ACTIVE' ? '#059669' : statusCode === 'COMING_SOON' ? '#D97706' : '#991B1B';
    }

    const modal = document.getElementById('modal-store-detail');
    if (modal) modal.dataset.storeId = String(storeId);
    window.openModal && window.openModal('modal-store-detail');
  }

  async function handleSaveStoreChanges() {
    const modal = document.getElementById('modal-store-detail');
    if (!modal) return;
    const id = Number(modal.dataset.storeId);
    if (!id) return;
    showError('edit-store-error', '');
    setBtn('edit-store-save-btn', true);
    try {
      const body = {
        store_name: val('edit-store-name'),
        store_code: val('edit-store-code'),
        store_type: mapFormatToStoreType(val('edit-store-format')),
        gstin: val('edit-store-gstin') || null,
        address: val('edit-store-address') || null,
        city: val('edit-store-city') || null,
        state: val('edit-store-state') || null,
        phone: val('edit-store-phone') || null,
        status: mapDropdownStatusToCode(val('edit-store-status'))
      };
      if (!body.store_name || !body.store_code) throw new Error('Store name and store code are required.');
      await apiPut(`/api/stores/${id}`, body);
      window.closeModal && window.closeModal('modal-store-detail');
      await loadStores();
      await loadDashboard();
    } catch (err) {
      showError('edit-store-error', err.message || 'Failed to update store');
    } finally {
      setBtn('edit-store-save-btn', false);
    }
  }

  async function handleDeleteStore() {
    const modal = document.getElementById('modal-store-detail');
    if (!modal) return;
    const id = Number(modal.dataset.storeId);
    if (!id || !window.confirm('Deactivate this store?')) return;
    showError('edit-store-error', '');
    try {
      await apiDelete(`/api/stores/${id}`);
      window.closeModal && window.closeModal('modal-store-detail');
      await loadStores();
      await loadDashboard();
    } catch (err) {
      showError('edit-store-error', err.message || 'Failed to deactivate store');
    }
  }

  // ─── USERS ────────────────────────────────────────────────────────────────

  let cachedUsers = [];

  async function loadUsers() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      const users = await apiGet('/api/users');
      cachedUsers = users;
      if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="td-muted">No users found.</td></tr>';
        return;
      }
      users.forEach((u) => {
        const initials = (u.full_name || u.username || '?').split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
        const roleBadge = u.role_key === 'super_admin' ? 'badge-purple' : 'badge-blue';
        const storeLabel = u.store_name
          ? `<span class="td-muted">${escHtml(u.store_name)}</span>`
          : '<span class="badge badge-gray" style="font-size:10px">HQ / Global</span>';
        const tr = document.createElement('tr');
        tr.dataset.userId = u.user_id;
        tr.innerHTML = `
          <td>
            <div class="flex items-center gap-2">
              <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#6C3FC5,#8B5CF6);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">${initials}</div>
              <div><div class="fw-600">${u.full_name}</div><div class="td-muted">${u.username}</div></div>
            </div>
          </td>
          <td style="max-width:160px;font-size:12.5px">${storeLabel}</td>
          <td class="font-mono text-xs">${u.phone || '—'}</td>
          <td class="td-muted">${u.email || '—'}</td>
          <td><span class="badge ${roleBadge}">${u.role_display || u.role_key}</span></td>
          <td class="td-muted">${u.last_login ? fmtIstDateTime(u.last_login) : 'Never'}</td>
          <td>${u.is_active ? '<span class="badge badge-green"><span class="badge-dot"></span>Active</span>' : '<span class="badge badge-gray">Inactive</span>'}</td>
          <td><button class="topbar-btn user-edit-btn" style="padding:5px 10px;font-size:12px">Edit</button></td>
        `;
        tbody.appendChild(tr);
      });

      document.querySelectorAll('.user-edit-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const id = Number(e.target.closest('tr').dataset.userId);
          openEditUserModal(id);
        });
      });

      refreshStoreDropdowns();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="td-muted">Error: ${err.message}</td></tr>`;
    }
  }

  async function handleCreateUser() {
    showError('new-user-error', '');
    setBtn('new-user-save-btn', true);
    try {
      const body = {
        username: val('new-user-username'),
        password: val('new-user-password'),
        full_name: val('new-user-fullname'),
        email: val('new-user-email') || null,
        phone: val('new-user-phone') || null,
        role_key: val('new-user-role'),
        store_id: valStoreId('new-user-store'),
        is_active: val('new-user-status') === '1'
      };
      if (!body.username) throw new Error('Username is required.');
      if (!body.password || body.password.length < 4) throw new Error('Password must be at least 4 characters.');
      if (!body.full_name) throw new Error('Full name is required.');
      await apiPost('/api/users', body);
      window.closeModal && window.closeModal('modal-new-user');
      ['new-user-fullname','new-user-username','new-user-password','new-user-email','new-user-phone'].forEach((id) => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      resetPasswordField('new-user-password', 'new-user-password-toggle');
      await loadUsers();
    } catch (err) {
      showError('new-user-error', err.message || 'Failed to create user');
    } finally {
      setBtn('new-user-save-btn', false);
    }
  }

  function openEditUserModal(userId) {
    const u = cachedUsers.find((x) => x.user_id === userId);
    if (!u) return;
    const title = document.getElementById('edit-user-title');
    if (title) title.textContent = `Edit — ${u.full_name}`;
    document.getElementById('edit-user-fullname').value = u.full_name || '';
    document.getElementById('edit-user-role').value = u.role_key || '';
    document.getElementById('edit-user-phone').value = u.phone || '';
    document.getElementById('edit-user-email').value = u.email || '';
    document.getElementById('edit-user-password').value = '';
    resetPasswordField('edit-user-password', 'edit-user-password-toggle');
    document.getElementById('edit-user-status').value = u.is_active ? '1' : '0';
    const stSel = document.getElementById('edit-user-store');
    if (stSel) {
      refreshStoreDropdowns();
      stSel.value = u.store_id ? String(u.store_id) : '';
    }
    showError('edit-user-error', '');
    const modal = document.getElementById('modal-edit-user');
    if (modal) modal.dataset.userId = String(userId);
    window.openModal && window.openModal('modal-edit-user');
  }

  async function handleSaveUserChanges() {
    const modal = document.getElementById('modal-edit-user');
    if (!modal) return;
    const id = Number(modal.dataset.userId);
    if (!id) return;
    showError('edit-user-error', '');
    setBtn('edit-user-save-btn', true);
    try {
      const body = {
        full_name: val('edit-user-fullname'),
        email: val('edit-user-email') || null,
        phone: val('edit-user-phone') || null,
        role_key: val('edit-user-role'),
        store_id: valStoreId('edit-user-store'),
        is_active: val('edit-user-status') === '1',
        password: val('edit-user-password') || null
      };
      if (!body.full_name) throw new Error('Full name is required.');
      await apiPut(`/api/users/${id}`, body);
      window.closeModal && window.closeModal('modal-edit-user');
      await loadUsers();
    } catch (err) {
      showError('edit-user-error', err.message || 'Failed to update user');
    } finally {
      setBtn('edit-user-save-btn', false);
    }
  }

  async function handleDeactivateUser() {
    const modal = document.getElementById('modal-edit-user');
    if (!modal) return;
    const id = Number(modal.dataset.userId);
    if (!id || !window.confirm('Deactivate this user?')) return;
    showError('edit-user-error', '');
    try {
      await apiDelete(`/api/users/${id}`);
      window.closeModal && window.closeModal('modal-edit-user');
      await loadUsers();
    } catch (err) {
      showError('edit-user-error', err.message || 'Failed to deactivate user');
    }
  }

  // ─── ROLES ────────────────────────────────────────────────────────────────

  let cachedRoles = [];

  // ── Permission definitions displayed in the matrix ──────────────
  const PERMISSION_MATRIX = [
    { group: 'Command Unit', perms: [
      { key: 'command_unit.stores.view',        label: 'Stores — View' },
      { key: 'command_unit.stores.create',      label: 'Stores — Create' },
      { key: 'command_unit.stores.edit',        label: 'Stores — Edit' },
      { key: 'command_unit.users.view',         label: 'Users — View' },
      { key: 'command_unit.users.create',       label: 'Users — Create' },
      { key: 'command_unit.users.edit',         label: 'Users — Edit' },
      { key: 'command_unit.roles.view',         label: 'Roles — View' },
      { key: 'command_unit.roles.create',       label: 'Roles — Create' },
      { key: 'command_unit.roles.edit',         label: 'Roles — Edit / Permissions' },
      { key: 'command_unit.modules.edit',       label: 'Module Access — Edit' },
      { key: 'command_unit.settings.view',      label: 'Settings — View' },
      { key: 'command_unit.settings.edit',      label: 'Settings — Edit' },
      { key: 'command_unit.audit.view',         label: 'Audit Logs — View' },
    ]},
    { group: 'Foundry — Procurement', perms: [
      { key: 'foundry.purchases.view',              label: 'Purchases — View' },
      { key: 'foundry.purchases.create',            label: 'Purchases — Create' },
      { key: 'foundry.purchases.edit',              label: 'Purchases — Edit' },
      { key: 'foundry.bill_verification.view',      label: 'Bill Verify — View' },
      { key: 'foundry.bill_verification.create',    label: 'Bill Verify — Submit' },
      { key: 'foundry.bill_verification.edit',      label: 'Bill Verify — Approve Discrepancy' },
      { key: 'foundry.branding.view',               label: 'Branding — View' },
      { key: 'foundry.branding.create',             label: 'Branding — Dispatch' },
      { key: 'foundry.branding.edit',               label: 'Branding — Receive / Bypass' },
      { key: 'foundry.digitisation.view',           label: 'Digitisation — View' },
      { key: 'foundry.digitisation.create',         label: 'Digitisation — Generate SKU' },
      { key: 'foundry.digitisation.edit',           label: 'Digitisation — Edit Media' },
      { key: 'foundry.warehouse.view',              label: 'Warehouse — View' },
      { key: 'foundry.warehouse.create',            label: 'Warehouse — Approve Ready' },
    ]},
    { group: 'Foundry — Catalogue & Inventory', perms: [
      { key: 'foundry.catalogue.view',              label: 'SKU Catalogue — View' },
      { key: 'foundry.catalogue.edit',              label: 'SKU Catalogue — Edit' },
      { key: 'foundry.stock.view',                  label: 'Stock Transfers — View' },
      { key: 'foundry.stock.create',                label: 'Stock Transfers — Create' },
    ]},
    { group: 'Foundry — Store Connect', perms: [
      { key: 'foundry.transfers.view',              label: 'Transfer Requests — View' },
      { key: 'foundry.transfers.create',            label: 'Transfer Requests — Create' },
      { key: 'foundry.transfers.edit',              label: 'Transfer Requests — Approve / Reject' },
    ]},
    { group: 'Foundry — Intelligence', perms: [
      { key: 'foundry.suppliers.view',              label: 'Suppliers — View' },
      { key: 'foundry.suppliers.create',            label: 'Suppliers — Create' },
      { key: 'foundry.suppliers.edit',              label: 'Suppliers — Edit' },
      { key: 'foundry.makers.view',                 label: 'Makers — View' },
      { key: 'foundry.makers.create',               label: 'Makers — Create' },
      { key: 'foundry.makers.edit',                 label: 'Makers — Edit' },
    ]},
    { group: 'Finance', perms: [
      { key: 'finance.dashboard.view',              label: 'Dashboard — View' },
      { key: 'finance.payments.view',               label: 'Payments — View' },
      { key: 'finance.payments.create',             label: 'Payments — Create' },
      { key: 'finance.payments.edit',               label: 'Payments — Edit / Void' },
      { key: 'finance.reports.view',                label: 'Reports — View' },
    ]},
    { group: 'StorePilot (Showroom)', perms: [
      { key: 'storepilot.dashboard.view',           label: 'Dashboard — View' },
      { key: 'storepilot.catalogue.view',           label: 'Catalogue — View' },
      { key: 'storepilot.floor.view',               label: 'Floor & Displays — View' },
      { key: 'storepilot.floor.create',             label: 'Floor & Displays — Create' },
      { key: 'storepilot.floor.edit',               label: 'Floor & Displays — Edit' },
      { key: 'storepilot.appointments.view',        label: 'Appointments — View' },
      { key: 'storepilot.appointments.create',      label: 'Appointments — Create' },
      { key: 'storepilot.appointments.edit',        label: 'Appointments — Edit' },
      { key: 'storepilot.walkins.view',             label: 'Walk-ins — View' },
      { key: 'storepilot.walkins.create',           label: 'Walk-ins — Create' },
      { key: 'storepilot.walkins.edit',             label: 'Walk-ins — Edit' },
      { key: 'storepilot.handoffs.create',          label: 'POS Handoffs — Create' },
      { key: 'storepilot.reports.view',             label: 'Reports — View' },
      { key: 'storepilot.transfers.view',           label: 'Transfers — View' },
      { key: 'storepilot.transfers.create',         label: 'Transfers — Create' },
      { key: 'storepilot.transfers.edit',           label: 'Transfers — Accept / Stock' },
    ]},
    { group: 'Store OS (POS)', perms: [
      { key: 'store_os.pos.view',                   label: 'POS — View' },
      { key: 'store_os.pos.create',                 label: 'POS — Transact' },
      { key: 'store_os.inventory.view',             label: 'Inventory — View' },
      { key: 'store_os.inventory.create',           label: 'Inventory — Create' },
      { key: 'store_os.inventory.edit',             label: 'Inventory — Edit' },
      { key: 'store_os.reports.view',               label: 'Reports — View' },
      { key: 'store_os.reports.create',             label: 'Reports — Export' },
    ]},
    { group: 'Army (HR & Attendance)', perms: [
      { key: 'army.staff.view',                     label: 'Staff — View' },
      { key: 'army.staff.create',                   label: 'Staff — Create' },
      { key: 'army.staff.edit',                     label: 'Staff — Edit' },
      { key: 'army.attendance.view',                label: 'Attendance — View' },
      { key: 'army.attendance.create',              label: 'Attendance — Create' },
      { key: 'army.attendance.edit',                label: 'Attendance — Edit' },
      { key: 'army.leaves.view',                    label: 'Leaves — View' },
      { key: 'army.leaves.edit',                    label: 'Leaves — Approve / Reject' },
      { key: 'army.payroll.view',                   label: 'Payroll — View' },
      { key: 'army.payroll.create',                 label: 'Payroll — Create' },
      { key: 'army.payroll.edit',                   label: 'Payroll — Edit' },
    ]},
  ];

  async function loadRoles() {
    const tbody = document.getElementById('roles-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      const roles = await apiGet('/api/roles');
      cachedRoles = roles;
      refreshRoleDropdowns();
      if (!roles.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="td-muted">No roles found.</td></tr>';
        return;
      }
      roles.forEach((r) => {
        const tr = document.createElement('tr');
        tr.dataset.roleKey = r.role_key;
        tr.innerHTML = `
          <td><div class="fw-600 font-mono">${escHtml(r.role_key)}</div><div class="td-muted">${escHtml(r.display_name)}</div></td>
          <td><span class="badge badge-green">Active</span></td>
          <td style="display:flex;gap:6px;padding:8px 12px">
            <button class="topbar-btn role-view-btn" style="padding:5px 10px;font-size:12px">View</button>
            <button class="topbar-btn role-edit-btn" style="padding:5px 10px;font-size:12px">Edit</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      document.querySelectorAll('.role-edit-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const key = e.target.closest('tr').dataset.roleKey;
          openEditRoleModal(key);
        });
      });

      document.querySelectorAll('.role-view-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const key = e.target.closest('tr').dataset.roleKey;
          loadRolePermissionsPanel(key);
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="3" class="td-muted">Error: ${err.message}</td></tr>`;
    }
  }

  async function loadRolePermissionsPanel(roleKey) {
    const panel = document.getElementById('role-detail-body');
    const title = document.getElementById('role-detail-title');
    if (!panel || !title) return;

    const role = cachedRoles.find((r) => r.role_key === roleKey);
    if (!role) return;

    title.textContent = `${role.display_name} — Permissions`;
    panel.innerHTML = '<div class="td-muted" style="padding:16px">Loading permissions…</div>';

    // Highlight active row
    document.querySelectorAll('#roles-tbody tr').forEach((tr) => {
      tr.style.background = tr.dataset.roleKey === roleKey ? 'rgba(109,93,230,0.08)' : '';
    });

    try {
      const grantedPerms = await apiGet(`/api/roles/${roleKey}/permissions`);
      const grantedSet = new Set(grantedPerms);

      let html = `
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;align-items:center">
          <div style="display:flex;flex-direction:column;gap:2px">
            <span class="td-muted" style="font-size:11px">Role Key</span>
            <span class="font-mono fw-600">${escHtml(role.role_key)}</span>
          </div>
        </div>
        <div id="perm-save-msg" style="min-height:18px;font-size:12px;margin-bottom:8px"></div>
      `;

      PERMISSION_MATRIX.forEach((group) => {
        html += `<div class="section-divider" style="margin:14px 0 8px">${escHtml(group.group)}</div>`;
        html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 16px">';
        group.perms.forEach((p) => {
          const checked = grantedSet.has(p.key) ? 'checked' : '';
          html += `
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:4px 0">
              <input type="checkbox" class="perm-checkbox" data-perm="${escAttr(p.key)}" ${checked}
                style="width:15px;height:15px;accent-color:var(--accent);cursor:pointer">
              ${escHtml(p.label)}
            </label>`;
        });
        html += '</div>';
      });

      html += `
        <div style="margin-top:20px;display:flex;gap:10px;align-items:center">
          <button class="topbar-btn primary" id="perm-save-btn" style="font-size:13px">Save Permissions</button>
          <button class="topbar-btn" id="perm-grant-all-btn" style="font-size:12px">Grant All</button>
          <button class="topbar-btn" id="perm-revoke-all-btn" style="font-size:12px;border-color:#DC2626;color:#DC2626">Revoke All</button>
        </div>`;

      // ── Module access section ──────────────────────────────────────────────
      html += `
        <div class="section-divider" style="margin:24px 0 12px">Module access for this role</div>
        <div class="td-muted text-xs" style="margin-bottom:12px">
          Toggle which Cosmos modules users with this role may access.
          Store-level policy (in Module Access → Per store) can further narrow access for store-scoped users.
        </div>
        <div id="role-module-err" style="color:#b91c1c;font-size:12px;min-height:14px;margin-bottom:6px"></div>
        <div id="role-module-toggles"></div>
        <div style="margin-top:16px;display:flex;gap:10px;align-items:center">
          <button class="topbar-btn primary" id="role-modules-save-btn" style="font-size:13px">Save Modules</button>
          <span id="role-modules-msg" style="font-size:12px;min-height:16px"></span>
        </div>`;

      panel.innerHTML = html;
      panel.dataset.roleKey = roleKey;

      document.getElementById('perm-save-btn').addEventListener('click', () => saveRolePermissions(roleKey));
      document.getElementById('perm-grant-all-btn').addEventListener('click', () => {
        panel.querySelectorAll('.perm-checkbox').forEach((cb) => { cb.checked = true; });
      });
      document.getElementById('perm-revoke-all-btn').addEventListener('click', () => {
        panel.querySelectorAll('.perm-checkbox').forEach((cb) => { cb.checked = false; });
      });

      // Load module toggles for this role
      await renderRoleModuleToggles(roleKey);
      document.getElementById('role-modules-save-btn').addEventListener('click', () => saveRoleModules(roleKey));
    } catch (err) {
      panel.innerHTML = `<div class="td-muted" style="padding:16px;color:#b91c1c">Error loading permissions: ${escHtml(err.message)}</div>`;
    }
  }

  // State for currently-displayed role module toggles
  let roleModuleState = {};

  async function renderRoleModuleToggles(roleKey) {
    const container = document.getElementById('role-module-toggles');
    if (!container) return;
    roleModuleState = {};
    container.innerHTML = '<div class="td-muted text-xs">Loading modules…</div>';
    try {
      const rows = await apiGet(`/api/role-modules/${roleKey}`);
      rows.forEach((r) => { roleModuleState[r.module_key] = !!r.is_enabled; });

      container.innerHTML = '';

      MODULE_DEFS.forEach((m) => {
        if (!Object.prototype.hasOwnProperty.call(roleModuleState, m.key)) {
          roleModuleState[m.key] = true;
        }
      });

      MODULE_DEFS.forEach((m) => {
        const enabled = !!roleModuleState[m.key];
        const div = document.createElement('div');
        div.className = 'toggle-row';
        div.innerHTML = `
          <div><div class="toggle-label">${m.label}</div><div class="toggle-desc">${m.desc}</div></div>
          <div class="toggle ${enabled ? 'on' : ''}" data-role-module="${m.key}" onclick="toggleRoleModuleLocal(this)"></div>`;
        container.appendChild(div);
      });
    } catch (err) {
      container.innerHTML = `<div class="td-muted text-xs" style="color:#b91c1c">Failed to load modules: ${escHtml(err.message)}</div>`;
    }
  }

  window.toggleRoleModuleLocal = function (el) {
    el.classList.toggle('on');
    roleModuleState[el.dataset.roleModule] = el.classList.contains('on');
  };

  async function saveRoleModules(roleKey) {
    const saveBtn = document.getElementById('role-modules-save-btn');
    const msgEl = document.getElementById('role-modules-msg');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
    if (msgEl) { msgEl.textContent = ''; msgEl.style.color = ''; }
    try {
      for (const m of MODULE_DEFS) {
        const enabled = !!roleModuleState[m.key];
        await apiPut(`/api/role-modules/${roleKey}`, { module_key: m.key, is_enabled: enabled });
      }
      if (msgEl) { msgEl.style.color = 'var(--green,#16a34a)'; msgEl.textContent = '✓ Modules saved.'; }
      setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 3000);
    } catch (err) {
      if (msgEl) { msgEl.style.color = '#b91c1c'; msgEl.textContent = `Error: ${err.message}`; }
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Modules'; }
    }
  }

  async function saveRolePermissions(roleKey) {
    const panel = document.getElementById('role-detail-body');
    const msgEl = document.getElementById('perm-save-msg');
    const saveBtn = document.getElementById('perm-save-btn');
    if (!panel || !msgEl) return;

    const checked = [...panel.querySelectorAll('.perm-checkbox:checked')].map((cb) => cb.dataset.perm);
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
    msgEl.style.color = '';
    msgEl.textContent = '';
    try {
      await apiPut(`/api/roles/${roleKey}/permissions`, { permissions: checked });
      msgEl.style.color = 'var(--green,#16a34a)';
      msgEl.textContent = `✓ ${checked.length} permission(s) saved successfully.`;
    } catch (err) {
      msgEl.style.color = '#b91c1c';
      msgEl.textContent = `Error: ${err.message}`;
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Permissions'; }
    }
  }

  async function handleCreateRole() {
    showError('new-role-error', '');
    setBtn('new-role-save-btn', true);
    try {
      const body = {
        role_key: val('new-role-key').toLowerCase().replace(/\s+/g, '_'),
        display_name: val('new-role-display')
      };
      if (!body.role_key) throw new Error('Role key is required.');
      if (!body.display_name) throw new Error('Display name is required.');
      await apiPost('/api/roles', body);
      window.closeModal && window.closeModal('modal-new-role');
      ['new-role-key','new-role-display'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
      await loadRoles();
    } catch (err) {
      showError('new-role-error', err.message || 'Failed to create role');
    } finally {
      setBtn('new-role-save-btn', false);
    }
  }

  function openEditRoleModal(roleKey) {
    const r = cachedRoles.find((x) => x.role_key === roleKey);
    if (!r) return;
    const title = document.getElementById('edit-role-title');
    if (title) title.textContent = `Edit Role — ${r.display_name}`;
    document.getElementById('edit-role-key').value = r.role_key;
    document.getElementById('edit-role-display').value = r.display_name;
    showError('edit-role-error', '');
    const modal = document.getElementById('modal-edit-role');
    if (modal) modal.dataset.roleKey = r.role_key;
    window.openModal && window.openModal('modal-edit-role');
  }

  async function handleSaveRoleChanges() {
    const modal = document.getElementById('modal-edit-role');
    if (!modal) return;
    const roleKey = modal.dataset.roleKey;
    if (!roleKey) return;
    showError('edit-role-error', '');
    setBtn('edit-role-save-btn', true);
    try {
      const body = {
        display_name: val('edit-role-display')
      };
      if (!body.display_name) throw new Error('Display name is required.');
      await apiPut(`/api/roles/${roleKey}`, body);
      window.closeModal && window.closeModal('modal-edit-role');
      await loadRoles();
    } catch (err) {
      showError('edit-role-error', err.message || 'Failed to update role');
    } finally {
      setBtn('edit-role-save-btn', false);
    }
  }

  async function handleDeleteRole() {
    const modal = document.getElementById('modal-edit-role');
    if (!modal) return;
    const roleKey = modal.dataset.roleKey;
    if (!roleKey || !window.confirm(`Delete role "${roleKey}"? This cannot be undone.`)) return;
    showError('edit-role-error', '');
    try {
      await apiDelete(`/api/roles/${roleKey}`);
      window.closeModal && window.closeModal('modal-edit-role');
      await loadRoles();
    } catch (err) {
      showError('edit-role-error', err.message || 'Failed to delete role');
    }
  }

  // ─── HOME BRANDS ──────────────────────────────────────────────────────────

  let cachedBrands = [];

  async function loadHomeBrands() {
    try {
      const brands = await apiGet('/api/home-brands');
      cachedBrands = brands;
      const container = document.querySelector('#page-homebrands .three-col');
      if (!container) return;
      container.innerHTML = '';

      brands.forEach((b) => {
        const initials = (b.brand_name || '?').charAt(0).toUpperCase();
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.brandId = b.brand_id;
        card.innerHTML = `
          <div style="padding:20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px">
            <div style="width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,#6C3FC5,#8B5CF6);display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;font-weight:700">${initials}</div>
            <div>
              <div class="fw-600" style="font-size:15px">${b.brand_name}</div>
              <div class="td-muted font-mono" style="font-size:11px">${b.brand_code}</div>
            </div>
            <span class="badge ${b.is_active ? 'badge-green' : 'badge-gray'} ml-auto">${b.is_active ? 'Active' : 'Inactive'}</span>
          </div>
          <div class="card-body">
            <div class="td-muted text-sm mb-4">${b.brand_description || '—'}</div>
          </div>
          <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px">
            <button class="topbar-btn brand-edit-btn" style="flex:1;justify-content:center;font-size:12px">Edit</button>
            <button class="topbar-btn brand-deactivate-btn" style="flex:1;justify-content:center;font-size:12px;${b.is_active ? 'border-color:#DC2626;color:#DC2626' : ''}" ${!b.is_active ? 'disabled' : ''}>${b.is_active ? 'Deactivate' : 'Inactive'}</button>
          </div>
        `;
        container.appendChild(card);
      });

      document.querySelectorAll('.brand-edit-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const id = Number(e.target.closest('.card').dataset.brandId);
          openEditBrandModal(id);
        });
      });
      document.querySelectorAll('.brand-deactivate-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const id = Number(e.target.closest('.card').dataset.brandId);
          if (!window.confirm('Deactivate this home brand?')) return;
          try {
            await apiDelete(`/api/home-brands/${id}`);
            await loadHomeBrands();
            await loadDashboard();
          } catch (err) {
            alert('Error: ' + err.message);
          }
        });
      });
    } catch (err) {
      console.error('Error loading home brands', err);
    }
  }

  async function handleCreateBrand() {
    showError('new-brand-error', '');
    setBtn('new-brand-save-btn', true);
    try {
      const brandCode = val('new-brand-code').toUpperCase();
      const body = {
        brand_name: val('new-brand-name'),
        brand_code: brandCode,
        brand_description: val('new-brand-desc') || null
      };
      if (!body.brand_name) throw new Error('Brand name is required.');
      if (!body.brand_code) throw new Error('Brand code is required.');
      await apiPost('/api/home-brands', body);
      window.closeModal && window.closeModal('modal-new-brand');
      ['new-brand-name','new-brand-code','new-brand-desc'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
      await loadHomeBrands();
      await loadDashboard();
    } catch (err) {
      showError('new-brand-error', err.message || 'Failed to create brand');
    } finally {
      setBtn('new-brand-save-btn', false);
    }
  }

  function openEditBrandModal(brandId) {
    const b = cachedBrands.find((x) => x.brand_id === brandId);
    if (!b) return;
    const title = document.getElementById('edit-brand-title');
    if (title) title.textContent = `Edit — ${b.brand_name}`;
    document.getElementById('edit-brand-name').value = b.brand_name || '';
    document.getElementById('edit-brand-code').value = b.brand_code || '';
    document.getElementById('edit-brand-desc').value = b.brand_description || '';
    showError('edit-brand-error', '');
    const modal = document.getElementById('modal-edit-brand');
    if (modal) modal.dataset.brandId = String(brandId);
    window.openModal && window.openModal('modal-edit-brand');
  }

  async function handleSaveBrandChanges() {
    const modal = document.getElementById('modal-edit-brand');
    if (!modal) return;
    const id = Number(modal.dataset.brandId);
    if (!id) return;
    showError('edit-brand-error', '');
    setBtn('edit-brand-save-btn', true);
    try {
      const body = {
        brand_name: val('edit-brand-name'),
        brand_description: val('edit-brand-desc') || null
      };
      if (!body.brand_name) throw new Error('Brand name is required.');
      await apiPut(`/api/home-brands/${id}`, body);
      window.closeModal && window.closeModal('modal-edit-brand');
      await loadHomeBrands();
      await loadDashboard();
    } catch (err) {
      showError('edit-brand-error', err.message || 'Failed to update brand');
    } finally {
      setBtn('edit-brand-save-btn', false);
    }
  }

  async function handleDeactivateBrand() {
    const modal = document.getElementById('modal-edit-brand');
    if (!modal) return;
    const id = Number(modal.dataset.brandId);
    if (!id || !window.confirm('Deactivate this home brand?')) return;
    showError('edit-brand-error', '');
    try {
      await apiDelete(`/api/home-brands/${id}`);
      window.closeModal && window.closeModal('modal-edit-brand');
      await loadHomeBrands();
      await loadDashboard();
    } catch (err) {
      showError('edit-brand-error', err.message || 'Failed to deactivate brand');
    }
  }

  // ─── GST RATES ────────────────────────────────────────────────────────────

  let cachedGstRates = [];
  let editingGstId = null;

  async function loadGstRates() {
    const table = document.querySelector('#tab-gst table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      const rates = await apiGet('/api/settings/gst-rates');
      cachedGstRates = rates;
      rates.forEach((g) => {
        const tr = document.createElement('tr');
        tr.dataset.gstId = g.gst_id;
        tr.innerHTML = `
          <td class="font-mono text-xs">${g.hsn_sac}</td>
          <td>${g.category}</td>
          <td class="fw-600">${fmtRate(g.gst_rate)}%</td>
          <td class="td-muted">${fmtRate(g.cgst_rate)}%</td>
          <td class="td-muted">${fmtRate(g.sgst_rate)}%</td>
          <td class="td-muted text-xs">${g.applied_to || ''}</td>
          <td><button class="topbar-btn gst-edit-btn" style="padding:5px 10px;font-size:12px">Edit</button></td>
        `;
        tbody.appendChild(tr);
      });

      document.querySelectorAll('.gst-edit-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const id = Number(e.target.closest('tr').dataset.gstId);
          openEditGstModal(id);
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="td-muted">Error: ${err.message}</td></tr>`;
    }
  }

  window.openNewGstModal = function () {
    editingGstId = null;
    const title = document.getElementById('edit-gst-title');
    if (title) title.textContent = 'Add GST Rate';
    ['edit-gst-hsn','edit-gst-category','edit-gst-rate','edit-gst-cgst','edit-gst-sgst','edit-gst-applied'].forEach((id) => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const delBtn = document.getElementById('edit-gst-delete-btn');
    if (delBtn) delBtn.style.display = 'none';
    showError('edit-gst-error', '');
    window.openModal && window.openModal('modal-edit-gst');
  };

  function openEditGstModal(gstId) {
    const g = cachedGstRates.find((x) => x.gst_id === gstId);
    if (!g) return;
    editingGstId = gstId;
    const title = document.getElementById('edit-gst-title');
    if (title) title.textContent = `Edit GST — ${g.category}`;
    document.getElementById('edit-gst-hsn').value = g.hsn_sac || '';
    document.getElementById('edit-gst-category').value = g.category || '';
    document.getElementById('edit-gst-rate').value = g.gst_rate || '';
    document.getElementById('edit-gst-cgst').value = g.cgst_rate || '';
    document.getElementById('edit-gst-sgst').value = g.sgst_rate || '';
    document.getElementById('edit-gst-applied').value = g.applied_to || '';
    const delBtn = document.getElementById('edit-gst-delete-btn');
    if (delBtn) delBtn.style.display = '';
    showError('edit-gst-error', '');
    window.openModal && window.openModal('modal-edit-gst');
  }

  async function handleSaveGst() {
    showError('edit-gst-error', '');
    setBtn('edit-gst-save-btn', true);
    try {
      const body = {
        hsn_sac:    val('edit-gst-hsn'),
        category:   val('edit-gst-category'),
        gst_rate:   Number(val('edit-gst-rate')),
        cgst_rate:  Number(val('edit-gst-cgst')),
        sgst_rate:  Number(val('edit-gst-sgst')),
        applied_to: val('edit-gst-applied') || null
      };
      if (!body.hsn_sac) throw new Error('HSN / SAC code is required.');
      if (!body.category) throw new Error('Category is required.');
      if (isNaN(body.gst_rate)) throw new Error('GST rate is required.');
      if (editingGstId) {
        await apiPut(`/api/settings/gst-rates/${editingGstId}`, body);
      } else {
        await apiPost('/api/settings/gst-rates', body);
      }
      window.closeModal && window.closeModal('modal-edit-gst');
      await loadGstRates();
    } catch (err) {
      showError('edit-gst-error', err.message || 'Failed to save GST rate');
    } finally {
      setBtn('edit-gst-save-btn', false);
    }
  }

  async function handleDeleteGst() {
    if (!editingGstId || !window.confirm('Deactivate this GST rate?')) return;
    showError('edit-gst-error', '');
    try {
      await apiDelete(`/api/settings/gst-rates/${editingGstId}`);
      window.closeModal && window.closeModal('modal-edit-gst');
      await loadGstRates();
    } catch (err) {
      showError('edit-gst-error', err.message || 'Failed to deactivate GST rate');
    }
  }

  // ─── MEMBERSHIP TIERS ────────────────────────────────────────────────────

  let cachedTiers = [];

  async function loadMembershipTiers() {
    const container = document.querySelector('#page-membership .three-col');
    if (!container) return;
    container.innerHTML = '';
    try {
      const tiers = await apiGet('/api/settings/membership-tiers');
      cachedTiers = tiers;
      tiers.forEach((t) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.tierId = t.membership_id;
        card.innerHTML = `
          <div style="padding:20px;background:linear-gradient(135deg,#F5F5F5,#E2E8F0);border-bottom:1px solid var(--border)">
            <div style="font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--text2);margin-bottom:6px">${t.tier_name}</div>
            <div style="font-family:'Syne',sans-serif;font-size:24px;font-weight:800">₹${Number(t.annual_fee).toFixed(0)} <span style="font-size:14px;font-weight:400;color:var(--text2)">/year</span></div>
          </div>
          <div class="card-body">
            <div class="td-muted text-sm mb-4">${t.benefits || '—'}</div>
            <div class="flex items-center gap-2 mb-4"><span class="text-xs td-muted">Promoter commission:</span><span class="badge badge-gold">₹${t.promoter_commission ? Number(t.promoter_commission).toFixed(0) : '0'} / sale</span></div>
          </div>
          <div style="padding:12px 20px;border-top:1px solid var(--border)">
            <button class="topbar-btn tier-edit-btn w-full" style="justify-content:center;font-size:12px">Edit</button>
          </div>
        `;
        container.appendChild(card);
      });

      // Placeholder for adding new tier
      const placeholder = document.createElement('div');
      placeholder.className = 'card';
      placeholder.style.cssText = 'border:2px dashed var(--border);background:transparent;display:flex;align-items:center;justify-content:center;min-height:200px;cursor:pointer';
      placeholder.innerHTML = '<div style="text-align:center;color:var(--text3)"><div style="font-size:32px;margin-bottom:8px">+</div><div style="font-size:13.5px;font-weight:500">Add Tier</div></div>';
      placeholder.onclick = () => window.openModal && window.openModal('modal-new-membership');
      container.appendChild(placeholder);

      document.querySelectorAll('.tier-edit-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const id = Number(e.target.closest('.card').dataset.tierId);
          openEditTierModal(id);
        });
      });
    } catch (err) {
      const div = document.createElement('div');
      div.className = 'td-muted text-sm';
      div.textContent = 'Error: ' + err.message;
      container.appendChild(div);
    }
  }

  async function handleCreateTier() {
    showError('new-tier-error', '');
    setBtn('new-tier-save-btn', true);
    try {
      const body = {
        tier_name: val('new-tier-name'),
        annual_fee: Number(val('new-tier-fee')),
        benefits: val('new-tier-benefits') || null,
        loyalty_tier: val('new-tier-loyalty') || null,
        promoter_commission: val('new-tier-commission') ? Number(val('new-tier-commission')) : null
      };
      if (!body.tier_name) throw new Error('Tier name is required.');
      if (isNaN(body.annual_fee)) throw new Error('Annual fee is required.');
      await apiPost('/api/settings/membership-tiers', body);
      window.closeModal && window.closeModal('modal-new-membership');
      ['new-tier-name','new-tier-fee','new-tier-benefits','new-tier-loyalty','new-tier-commission'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
      await loadMembershipTiers();
    } catch (err) {
      showError('new-tier-error', err.message || 'Failed to create tier');
    } finally {
      setBtn('new-tier-save-btn', false);
    }
  }

  function openEditTierModal(tierId) {
    const t = cachedTiers.find((x) => x.membership_id === tierId);
    if (!t) return;
    const title = document.getElementById('edit-tier-title');
    if (title) title.textContent = `Edit — ${t.tier_name}`;
    document.getElementById('edit-tier-name').value = t.tier_name || '';
    document.getElementById('edit-tier-fee').value = t.annual_fee || '';
    document.getElementById('edit-tier-benefits').value = t.benefits || '';
    document.getElementById('edit-tier-loyalty').value = t.loyalty_tier || '';
    document.getElementById('edit-tier-commission').value = t.promoter_commission || '';
    document.getElementById('edit-tier-status').value = t.is_active ? '1' : '0';
    showError('edit-tier-error', '');
    const modal = document.getElementById('modal-edit-membership');
    if (modal) modal.dataset.tierId = String(tierId);
    window.openModal && window.openModal('modal-edit-membership');
  }

  async function handleSaveTierChanges() {
    const modal = document.getElementById('modal-edit-membership');
    if (!modal) return;
    const id = Number(modal.dataset.tierId);
    if (!id) return;
    showError('edit-tier-error', '');
    setBtn('edit-tier-save-btn', true);
    try {
      const body = {
        tier_name: val('edit-tier-name'),
        annual_fee: Number(val('edit-tier-fee')),
        benefits: val('edit-tier-benefits') || null,
        loyalty_tier: val('edit-tier-loyalty') || null,
        promoter_commission: val('edit-tier-commission') ? Number(val('edit-tier-commission')) : null,
        is_active: val('edit-tier-status') === '1'
      };
      if (!body.tier_name) throw new Error('Tier name is required.');
      await apiPut(`/api/settings/membership-tiers/${id}`, body);
      window.closeModal && window.closeModal('modal-edit-membership');
      await loadMembershipTiers();
    } catch (err) {
      showError('edit-tier-error', err.message || 'Failed to update tier');
    } finally {
      setBtn('edit-tier-save-btn', false);
    }
  }

  async function handleDeactivateTier() {
    const modal = document.getElementById('modal-edit-membership');
    if (!modal) return;
    const id = Number(modal.dataset.tierId);
    if (!id || !window.confirm('Deactivate this membership tier?')) return;
    showError('edit-tier-error', '');
    try {
      await apiDelete(`/api/settings/membership-tiers/${id}`);
      window.closeModal && window.closeModal('modal-edit-membership');
      await loadMembershipTiers();
    } catch (err) {
      showError('edit-tier-error', err.message || 'Failed to deactivate tier');
    }
  }

  // ─── LEAVE TYPES ──────────────────────────────────────────────────────────

  let cachedLeaves = [];

  async function loadLeaveTypes() {
    const table = document.querySelector('#page-leavetypes table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      const leaves = await apiGet('/api/settings/leave-types');
      cachedLeaves = leaves;
      leaves.forEach((l) => {
        const tr = document.createElement('tr');
        tr.dataset.leaveId = l.leave_type_id;
        tr.innerHTML = `
          <td class="fw-600">${l.leave_name}</td>
          <td>${l.annual_quota != null ? `${l.annual_quota} days` : '—'}</td>
          <td><span class="badge ${l.max_carry_fwd ? 'badge-green' : 'badge-gray'}">${l.max_carry_fwd ? `Yes — max ${l.max_carry_fwd}` : 'No'}</span></td>
          <td><span class="badge ${l.requires_approval ? 'badge-gold' : 'badge-gray'}">${l.requires_approval ? 'Yes' : 'No'}</span></td>
          <td><span class="badge ${l.affects_score ? 'badge-red' : 'badge-gray'}">${l.affects_score ? 'Yes' : 'No'}</span></td>
          <td><span class="badge ${l.is_paid ? 'badge-green' : 'badge-red'}">${l.is_paid ? 'Paid' : 'Unpaid'}</span></td>
          <td><span class="badge ${l.is_active ? 'badge-green' : 'badge-gray'}">${l.is_active ? 'Active' : 'Inactive'}</span></td>
          <td><button class="topbar-btn leave-edit-btn" style="padding:5px 10px;font-size:12px">Edit</button></td>
        `;
        tbody.appendChild(tr);
      });

      document.querySelectorAll('.leave-edit-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const id = Number(e.target.closest('tr').dataset.leaveId);
          openEditLeaveModal(id);
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="td-muted">Error: ${err.message}</td></tr>`;
    }
  }

  async function handleCreateLeave() {
    showError('new-leave-error', '');
    setBtn('new-leave-save-btn', true);
    try {
      const quotaStr = val('new-leave-quota');
      const carryStr = val('new-leave-carry');
      const body = {
        leave_name:        val('new-leave-name'),
        annual_quota:      quotaStr !== '' ? Number(quotaStr) : null,
        max_carry_fwd:     carryStr !== '' ? Number(carryStr) : null,
        requires_approval: val('new-leave-approval') === '1',
        is_paid:           val('new-leave-paid') === '1',
        affects_score:     val('new-leave-score') === '1'
      };
      if (!body.leave_name) throw new Error('Leave name is required.');
      await apiPost('/api/settings/leave-types', body);
      window.closeModal && window.closeModal('modal-new-leave');
      ['new-leave-name','new-leave-quota','new-leave-carry'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
      await loadLeaveTypes();
    } catch (err) {
      showError('new-leave-error', err.message || 'Failed to create leave type');
    } finally {
      setBtn('new-leave-save-btn', false);
    }
  }

  function openEditLeaveModal(leaveId) {
    const l = cachedLeaves.find((x) => x.leave_type_id === leaveId);
    if (!l) return;
    const title = document.getElementById('edit-leave-title');
    if (title) title.textContent = `Edit — ${l.leave_name}`;
    document.getElementById('edit-leave-name').value = l.leave_name || '';
    document.getElementById('edit-leave-quota').value = l.annual_quota != null ? l.annual_quota : '';
    document.getElementById('edit-leave-carry').value = l.max_carry_fwd != null ? l.max_carry_fwd : '';
    document.getElementById('edit-leave-approval').value = l.requires_approval ? '1' : '0';
    document.getElementById('edit-leave-paid').value = l.is_paid ? '1' : '0';
    document.getElementById('edit-leave-score').value = l.affects_score ? '1' : '0';
    document.getElementById('edit-leave-status').value = l.is_active ? '1' : '0';
    showError('edit-leave-error', '');
    const modal = document.getElementById('modal-edit-leave');
    if (modal) modal.dataset.leaveId = String(leaveId);
    window.openModal && window.openModal('modal-edit-leave');
  }

  async function handleSaveLeaveChanges() {
    const modal = document.getElementById('modal-edit-leave');
    if (!modal) return;
    const id = Number(modal.dataset.leaveId);
    if (!id) return;
    showError('edit-leave-error', '');
    setBtn('edit-leave-save-btn', true);
    try {
      const quotaStr = val('edit-leave-quota');
      const carryStr = val('edit-leave-carry');
      const body = {
        leave_name:        val('edit-leave-name'),
        annual_quota:      quotaStr !== '' ? Number(quotaStr) : null,
        max_carry_fwd:     carryStr !== '' ? Number(carryStr) : null,
        requires_approval: val('edit-leave-approval') === '1',
        is_paid:           val('edit-leave-paid') === '1',
        affects_score:     val('edit-leave-score') === '1',
        is_active:         val('edit-leave-status') === '1'
      };
      if (!body.leave_name) throw new Error('Leave name is required.');
      await apiPut(`/api/settings/leave-types/${id}`, body);
      window.closeModal && window.closeModal('modal-edit-leave');
      await loadLeaveTypes();
    } catch (err) {
      showError('edit-leave-error', err.message || 'Failed to update leave type');
    } finally {
      setBtn('edit-leave-save-btn', false);
    }
  }

  async function handleDeactivateLeave() {
    const modal = document.getElementById('modal-edit-leave');
    if (!modal) return;
    const id = Number(modal.dataset.leaveId);
    if (!id || !window.confirm('Deactivate this leave type?')) return;
    showError('edit-leave-error', '');
    try {
      await apiDelete(`/api/settings/leave-types/${id}`);
      window.closeModal && window.closeModal('modal-edit-leave');
      await loadLeaveTypes();
    } catch (err) {
      showError('edit-leave-error', err.message || 'Failed to deactivate leave type');
    }
  }

  // ─── MODULE ACCESS ────────────────────────────────────────────────────────

  const MODULE_DEFS = [
    { key: 'command_unit', label: '⚙️ Command Unit', desc: 'Web admin — users, roles, module access, settings' },
    { key: 'foundry',   label: '🔩 Foundry',       desc: 'Inventory, procurement, stock management' },
    { key: 'finance',   label: '💰 Finance',        desc: 'Accounts payable, supplier payments, outstanding tracking' },
    { key: 'storepilot',label: '🏬 StorePilot',    desc: 'Showroom ops — floor, appointments, walk-ins (not billing/POS)' },
    { key: 'pos',       label: '🧾 Store OS (POS)', desc: 'Sales, billing, patient records, prescriptions' },
    { key: 'army',      label: '🪖 Army',           desc: 'Employee HR, attendance, performance' },
    { key: 'eyewoot_go',label: '📱 Eyewoot Go',     desc: 'Consumer app — store locator, D2C orders' },
    { key: 'promoter',  label: '🤝 Promoter',       desc: 'Promoter referrals, commissions, catalogue sharing' }
  ];

  // ─── STORE MODULE ACCESS (per location) ───────────────────────────────────

  let storeModuleAccessState = {};

  window.loadStoreModuleAccess = async function () {
    const storeId = document.getElementById('module-store-select')?.value || '';
    const body = document.getElementById('store-module-toggles-body');
    const saveBtn = document.getElementById('save-store-modules-btn');
    if (!storeId) {
      if (body) {
        body.innerHTML = '<div class="empty"><div class="empty-icon">🏪</div><div class="empty-text">Select a store to enable or disable modules for that location</div></div>';
      }
      if (saveBtn) saveBtn.disabled = true;
      return;
    }

    if (body) body.innerHTML = '<div class="td-muted text-sm">Loading...</div>';
    storeModuleAccessState = {};

    try {
      const rows = await apiGet(`/api/store-modules/${storeId}`);
      rows.forEach((r) => { storeModuleAccessState[r.module_key] = !!r.is_enabled; });

      const store = cachedStores.find((s) => String(s.store_id) === String(storeId));
      body.innerHTML = '';

      if (store) {
        body.innerHTML += `
          <div style="padding:12px 0 16px;border-bottom:1px solid var(--border);margin-bottom:16px">
            <div class="fw-600">${escHtml(store.store_name)}</div>
            <div class="td-muted text-xs font-mono">${escHtml(store.store_code || '')} · ${escHtml(store.city || '—')}</div>
          </div>`;
      }

      MODULE_DEFS.forEach((m) => {
        if (!Object.prototype.hasOwnProperty.call(storeModuleAccessState, m.key)) {
          storeModuleAccessState[m.key] = true;
        }
      });

      MODULE_DEFS.forEach((m) => {
        const enabled = !!storeModuleAccessState[m.key];
        const div = document.createElement('div');
        div.className = 'toggle-row';
        div.innerHTML = `
          <div><div class="toggle-label">${m.label}</div><div class="toggle-desc">${m.desc}</div></div>
          <div class="toggle ${enabled ? 'on' : ''}" data-store-module="${m.key}" onclick="toggleStoreModuleLocal(this)"></div>`;
        body.appendChild(div);
      });

      if (saveBtn) saveBtn.disabled = false;
    } catch (err) {
      if (body) body.innerHTML = `<div class="td-muted text-sm">Error: ${err.message}</div>`;
    }
  };

  window.toggleStoreModuleLocal = function (el) {
    el.classList.toggle('on');
    const modKey = el.dataset.storeModule;
    storeModuleAccessState[modKey] = el.classList.contains('on');
  };

  window.saveStoreModuleChanges = async function () {
    const storeId = document.getElementById('module-store-select')?.value || '';
    if (!storeId) return;
    const saveBtn = document.getElementById('save-store-modules-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
    try {
      for (const m of MODULE_DEFS) {
        const enabled = !!storeModuleAccessState[m.key];
        await apiPut(`/api/store-modules/${storeId}`, { module_key: m.key, is_enabled: enabled });
      }
      if (saveBtn) saveBtn.textContent = '✓ Saved';
      setTimeout(() => { if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Store Modules'; } }, 2000);
    } catch (err) {
      alert('Error saving store module access: ' + err.message);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Store Modules'; }
    }
  };

  // ─── AUDIT LOGS ───────────────────────────────────────────────────────────

  async function loadAuditLogs() {
    const table = document.querySelector('#page-audit table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      const logs = await apiGet('/api/audit-logs?top=50');
      if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="td-muted">No audit logs yet.</td></tr>';
        return;
      }
      logs.forEach((a) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="font-mono text-xs" style="white-space:nowrap">${fmtIstTime(a.created_at)}</td>
          <td><span class="badge badge-purple">${a.module}</span></td>
          <td><span class="badge badge-green">${a.action}</span></td>
          <td class="font-mono text-xs">${a.entity_type}</td>
          <td class="text-sm">${a.user_full_name || 'System'}</td>
          <td class="td-muted text-xs">${a.entity_id || ''}</td>
          <td class="td-muted text-xs">${a.new_value || a.old_value || ''}</td>
          <td><button class="topbar-btn" style="padding:4px 8px;font-size:11px">Detail</button></td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="td-muted">Error: ${err.message}</td></tr>`;
    }
  }

  // ─── DASHBOARD ────────────────────────────────────────────────────────────

  function renderDashboardLoadingState() {
    const set = (id, html) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    };
    const attendanceBadge = document.getElementById('cu-dash-attendance-badge');
    const pendingCount = document.getElementById('cu-dash-pending-count');
    if (attendanceBadge) {
      attendanceBadge.className = 'badge badge-gray';
      attendanceBadge.textContent = 'Loading…';
    }
    if (pendingCount) {
      pendingCount.className = 'badge badge-gray';
      pendingCount.textContent = '—';
    }
    set('cu-dash-top-skus', '<tr><td colspan="5" class="td-muted" style="text-align:center;padding:24px">Loading…</td></tr>');
    set('cu-dash-attendance', '<tr><td colspan="6" class="td-muted" style="text-align:center;padding:24px">Loading…</td></tr>');
    set('cu-dash-pending', '<div class="td-muted" style="padding:4px 0">Loading…</div>');
    set('cu-dash-audit', '<div class="td-muted" style="padding:4px 0">Loading…</div>');
  }

  async function loadDashboard() {
    renderDashboardLoadingState();
    try {
      const [stores, brands, suppliers, purchases, logs] = await Promise.all([
        apiGet('/api/stores'),
        apiGet('/api/home-brands'),
        apiGet('/api/suppliers'),
        apiGet('/api/purchases'),
        apiGet('/api/audit-logs?top=4').catch(() => [])
      ]);

      const cards = document.querySelectorAll('#page-dashboard .stats-grid .stat-card');
      if (cards[0]) {
        cards[0].querySelector('.stat-label').textContent = 'Active Stores';
        const activeCount = stores.filter((s) => resolveStatus(s) === 'ACTIVE').length;
        cards[0].querySelector('.stat-value').textContent = String(activeCount);
        cards[0].querySelector('.stat-meta').textContent = `${stores.length} total stores`;
      }
      if (cards[1]) {
        cards[1].querySelector('.stat-label').textContent = 'Home Brands';
        cards[1].querySelector('.stat-value').textContent = String(brands.length);
        cards[1].querySelector('.stat-meta').textContent = 'Private label brands';
      }
      if (cards[2]) {
        cards[2].querySelector('.stat-label').textContent = 'Suppliers';
        cards[2].querySelector('.stat-value').textContent = String(suppliers.length);
        cards[2].querySelector('.stat-meta').textContent = 'Procurement vendors in Foundry';
      }
      if (cards[3]) {
        cards[3].querySelector('.stat-label').textContent = 'Purchases';
        cards[3].querySelector('.stat-value').textContent = String(purchases.length);
        cards[3].querySelector('.stat-meta').textContent = 'Total purchase records';
      }

      const titleEl = document.querySelector('#page-dashboard .page-title');
      if (titleEl) {
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        titleEl.textContent = `${greeting}, ${user.full_name || user.username || 'User'} 👋`;
      }

      const topSkuTbody = document.getElementById('cu-dash-top-skus');
      if (topSkuTbody) {
        const recent = (purchases || []).slice(0, 5);
        if (!recent.length) {
          topSkuTbody.innerHTML = '<tr><td colspan="5" class="td-muted" style="text-align:center;padding:24px">No purchase lines available yet.</td></tr>';
        } else {
          topSkuTbody.innerHTML = recent.map((row) => {
            const qty = Number(row.total_qty || row.qty || 0);
            const rate = Number(row.rate || row.purchase_rate || 0);
            const amount = qty * rate;
            const stage = String(row.stage_label || row.stage_code || row.stage || 'Unknown');
            return `<tr>
              <td class="font-mono text-xs">${escHtml(row.bill_ref || row.purchase_id || '—')}</td>
              <td>${escHtml(row.collection_name || row.brand_name || row.supplier_name || 'Purchase item')}</td>
              <td>${qty}</td>
              <td>${amount > 0 ? `₹${amount.toLocaleString('en-IN')}` : '—'}</td>
              <td><span class="badge badge-gray">${escHtml(stage || 'Unknown')}</span></td>
            </tr>`;
          }).join('');
        }
      }

      const attendanceTbody = document.getElementById('cu-dash-attendance');
      const attendanceBadge = document.getElementById('cu-dash-attendance-badge');
      if (attendanceBadge) {
        attendanceBadge.className = 'badge badge-gray';
        attendanceBadge.textContent = 'Not connected';
      }
      if (attendanceTbody) {
        attendanceTbody.innerHTML = '<tr><td colspan="6" class="td-muted" style="text-align:center;padding:24px">Attendance API is not connected in Command Unit yet.</td></tr>';
      }

      const pendingBody = document.getElementById('cu-dash-pending');
      const pendingCount = document.getElementById('cu-dash-pending-count');
      if (pendingBody) {
        const pending = (purchases || []).filter((p) => String(p.stage_label || p.stage_code || p.stage || '').toUpperCase().includes('DISCREPANCY')).slice(0, 5);
        if (pendingCount) {
          pendingCount.className = pending.length ? 'badge badge-red' : 'badge badge-gray';
          pendingCount.textContent = String(pending.length);
        }
        if (!pending.length) {
          pendingBody.innerHTML = '<div class="td-muted" style="padding:4px 0">No pending approvals.</div>';
        } else {
          pendingBody.innerHTML = pending.map((p) => `
            <div class="pending-item">
              <div class="pending-icon" style="background:#FEE2E2">🧾</div>
              <div class="pending-info">
                <div class="pending-title">Bill discrepancy — ${escHtml(p.bill_ref || `Purchase #${p.purchase_id || '—'}`)}</div>
                <div class="pending-sub">${escHtml(p.supplier_name || 'Supplier')} · ${escHtml(p.stage_code || p.stage || 'Under review')}</div>
              </div>
              <button class="topbar-btn primary" style="padding:5px 10px;font-size:12px" onclick="showPage('audit', document.querySelector('[onclick*=audit]'))">Review</button>
            </div>
          `).join('');
        }
      }

      const auditBody = document.getElementById('cu-dash-audit');
      if (auditBody) {
        if (!Array.isArray(logs) || !logs.length) {
          auditBody.innerHTML = '<div class="td-muted" style="padding:4px 0">No recent audit activity.</div>';
        } else {
          auditBody.innerHTML = logs.slice(0, 4).map((log) => `
            <div class="audit-item">
              <div class="audit-dot"></div>
              <div class="audit-content">
                <div class="audit-action">${escHtml(log.action || 'Activity')}</div>
                <div class="audit-meta">${escHtml(log.module_key || 'Command Unit')} · ${escHtml(log.actor_name || log.actor_user || 'System')}</div>
              </div>
              <div class="audit-time">${escHtml(fmtIstDateTime(log.at || log.created_at))}</div>
            </div>
          `).join('');
        }
      }
    } catch {
      const pendingCount = document.getElementById('cu-dash-pending-count');
      if (pendingCount) {
        pendingCount.className = 'badge badge-gray';
        pendingCount.textContent = '—';
      }
      const titleEl = document.querySelector('#page-dashboard .page-title');
      if (titleEl) titleEl.textContent = 'Dashboard unavailable';
      const setError = (id, col) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = `<tr><td colspan="${col}" class="td-muted" style="text-align:center;padding:24px;color:#b91c1c">Failed to load data.</td></tr>`;
      };
      setError('cu-dash-top-skus', 5);
      setError('cu-dash-attendance', 6);
      const pending = document.getElementById('cu-dash-pending');
      if (pending) pending.innerHTML = '<div class="td-muted" style="padding:4px 0;color:#b91c1c">Failed to load pending approvals.</div>';
      const audit = document.getElementById('cu-dash-audit');
      if (audit) audit.innerHTML = '<div class="td-muted" style="padding:4px 0;color:#b91c1c">Failed to load audit activity.</div>';
    }
  }

  // ─── EVENT BINDINGS ───────────────────────────────────────────────────────

  function bind(id, fn) { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); }

  // Stores
  bind('new-store-save-btn', handleCreateStore);
  bind('edit-store-save-btn', handleSaveStoreChanges);

  // Users
  bind('new-user-save-btn', handleCreateUser);
  bind('edit-user-save-btn', handleSaveUserChanges);
  bind('edit-user-deactivate-btn', handleDeactivateUser);
  bindPasswordToggle('new-user-password', 'new-user-password-toggle');
  bindPasswordToggle('edit-user-password', 'edit-user-password-toggle');

  // Roles
  bind('new-role-save-btn', handleCreateRole);
  bind('edit-role-save-btn', handleSaveRoleChanges);
  bind('edit-role-delete-btn', handleDeleteRole);

  // Home Brands
  bind('new-brand-save-btn', handleCreateBrand);
  bind('edit-brand-save-btn', handleSaveBrandChanges);
  bind('edit-brand-deactivate-btn', handleDeactivateBrand);

  // GST
  bind('edit-gst-save-btn', handleSaveGst);
  bind('edit-gst-delete-btn', handleDeleteGst);

  // Membership Tiers
  bind('new-tier-save-btn', handleCreateTier);
  bind('edit-tier-save-btn', handleSaveTierChanges);
  bind('edit-tier-deactivate-btn', handleDeactivateTier);

  // Leave Types
  bind('new-leave-save-btn', handleCreateLeave);
  bind('edit-leave-save-btn', handleSaveLeaveChanges);
  bind('edit-leave-deactivate-btn', handleDeactivateLeave);

  // ─── FOUNDRY SETTINGS ─────────────────────────────────────────────────────

  const LOOKUP_TYPE_META = {
    source_type:    { label: 'Source Types',     desc: 'How a product is sourced — drives identity rules in New Purchase form.' },
    product_type:   { label: 'Product Types',    desc: 'Category of eyewear product (Frames, Sunglasses, etc.).' },
    bypass_reason:  { label: 'Bypass Reasons',   desc: 'Reasons allowed when skipping the branding stage.' },
    label_placement:{ label: 'Label Placement',  desc: 'Where on the frame the branding label is placed.' },
    frame_material: { label: 'Frame Materials',  desc: 'Material used in the frame construction.' },
    frame_shape:    { label: 'Frame Shapes',     desc: 'Lens/frame silhouette shape for catalogue tagging.' },
    gender:         { label: 'Gender Targeting', desc: 'Primary target demographic for a product.' },
    payment_terms:  { label: 'Payment Terms',    desc: 'Supplier payment terms used in Supplier management.' },
  };

  let _foundryLookupAll = [];
  let _activeLookupType = Object.keys(LOOKUP_TYPE_META)[0];
  let _editingLookupId = null;

  async function loadFoundrySettings() {
    try {
      const data = await apiGet('/api/foundry-lookups');
      _foundryLookupAll = data;
      renderLookupTypeTabs();
      renderLookupTable(_activeLookupType);
    } catch (err) {
      const tbody = document.getElementById('foundry-lookup-tbody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="td-muted">Error: ${escHtml(err.message)}</td></tr>`;
    }
  }

  function renderLookupTypeTabs() {
    const container = document.getElementById('foundry-lookup-tabs');
    if (!container) return;
    container.innerHTML = '';
    Object.entries(LOOKUP_TYPE_META).forEach(([typeKey, meta]) => {
      const count = _foundryLookupAll.filter((v) => v.lookup_type === typeKey && v.is_active).length;
      const btn = document.createElement('button');
      btn.className = `topbar-btn${typeKey === _activeLookupType ? ' primary' : ''}`;
      btn.style.cssText = 'font-size:12px;padding:6px 12px';
      btn.innerHTML = `${escHtml(meta.label)} <span style="opacity:0.7;margin-left:4px">${count}</span>`;
      btn.addEventListener('click', () => {
        _activeLookupType = typeKey;
        renderLookupTypeTabs();
        renderLookupTable(typeKey);
      });
      container.appendChild(btn);
    });
  }

  function renderLookupTable(typeKey) {
    const tbody = document.getElementById('foundry-lookup-tbody');
    const title = document.getElementById('foundry-lookup-type-title');
    const desc = document.getElementById('foundry-lookup-type-desc');
    if (!tbody) return;

    const meta = LOOKUP_TYPE_META[typeKey] || { label: typeKey, desc: '' };
    if (title) title.textContent = meta.label;
    if (desc) desc.textContent = meta.desc;

    const rows = _foundryLookupAll.filter((v) => v.lookup_type === typeKey);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="td-muted" style="text-align:center;padding:20px">No values yet. Click "+ Add Value" to add one.</td></tr>`;
      return;
    }
    tbody.innerHTML = '';
    rows.forEach((v, i) => {
      const tr = document.createElement('tr');
      tr.dataset.lookupId = v.lookup_id;
      tr.style.opacity = v.is_active ? '1' : '0.5';
      tr.innerHTML = `
        <td class="td-muted text-xs">${i + 1}</td>
        <td><code style="background:var(--bg2);padding:2px 6px;border-radius:4px;font-size:11px">${escHtml(v.lookup_key)}</code></td>
        <td class="fw-600">${escHtml(v.lookup_label)}</td>
        <td class="td-muted text-xs">${escHtml(v.description || '—')}</td>
        <td class="td-muted text-xs">${v.display_order}</td>
        <td>${v.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Inactive</span>'}</td>
        <td><button class="topbar-btn lookup-edit-btn" style="padding:5px 10px;font-size:12px">Edit</button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.lookup-edit-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.target.closest('tr').dataset.lookupId);
        openEditLookupModal(id);
      });
    });
  }

  function openNewLookupModal() {
    _editingLookupId = null;
    const title = document.getElementById('foundry-lookup-modal-title');
    if (title) title.textContent = 'Add Lookup Value';
    const meta = LOOKUP_TYPE_META[_activeLookupType];
    const el = (id) => document.getElementById(id);
    el('fl-type').value = `${_activeLookupType}  —  ${meta ? meta.label : ''}`;
    el('fl-type').dataset.typeKey = _activeLookupType;
    el('fl-key').value = '';
    el('fl-key').readOnly = false;
    el('fl-key').style.background = '';
    el('fl-label').value = '';
    el('fl-desc').value = '';
    el('fl-order').value = (_foundryLookupAll.filter((v) => v.lookup_type === _activeLookupType).length + 1).toString();
    el('fl-active').value = '1';
    showError('foundry-lookup-error', '');
    window.openModal && window.openModal('modal-foundry-lookup');
  }

  function openEditLookupModal(lookupId) {
    const v = _foundryLookupAll.find((x) => x.lookup_id === lookupId);
    if (!v) return;
    _editingLookupId = lookupId;
    const title = document.getElementById('foundry-lookup-modal-title');
    if (title) title.textContent = `Edit — ${v.lookup_label}`;
    const meta = LOOKUP_TYPE_META[v.lookup_type];
    const el = (id) => document.getElementById(id);
    el('fl-type').value = `${v.lookup_type}  —  ${meta ? meta.label : ''}`;
    el('fl-type').dataset.typeKey = v.lookup_type;
    el('fl-key').value = v.lookup_key;
    el('fl-key').readOnly = true;
    el('fl-key').style.background = 'var(--bg2)';
    el('fl-label').value = v.lookup_label;
    el('fl-desc').value = v.description || '';
    el('fl-order').value = String(v.display_order ?? 0);
    el('fl-active').value = v.is_active ? '1' : '0';
    showError('foundry-lookup-error', '');
    window.openModal && window.openModal('modal-foundry-lookup');
  }

  async function handleSaveLookupValue() {
    showError('foundry-lookup-error', '');
    setBtn('foundry-lookup-save-btn', true);
    try {
      const typeKey = document.getElementById('fl-type').dataset.typeKey || _activeLookupType;
      const body = {
        lookup_label:  val('fl-label'),
        description:   val('fl-desc') || null,
        display_order: Number(val('fl-order')) || 0,
        is_active:     document.getElementById('fl-active').value === '1'
      };
      if (!body.lookup_label) throw new Error('Label is required.');
      if (_editingLookupId) {
        await apiPut(`/api/foundry-lookups/${_editingLookupId}`, body);
      } else {
        const keyRaw = val('fl-key');
        if (!keyRaw) throw new Error('Key is required.');
        await apiPost('/api/foundry-lookups', {
          lookup_type:   typeKey,
          lookup_key:    keyRaw.toUpperCase().replace(/\s+/g, '_'),
          ...body
        });
      }
      window.closeModal && window.closeModal('modal-foundry-lookup');
      await loadFoundrySettings();
    } catch (err) {
      showError('foundry-lookup-error', err.message || 'Failed to save');
    } finally {
      setBtn('foundry-lookup-save-btn', false);
    }
  }

  bind('foundry-lookup-save-btn', handleSaveLookupValue);
  document.getElementById('foundry-add-value-btn')?.addEventListener('click', openNewLookupModal);

  // ─── FOUNDRY MASTERS: SUPPLIERS ───────────────────────────────────────────

  async function loadCuSuppliers() {
    const q  = (document.getElementById('cu-suppliers-search') || {}).value || '';
    const tb = document.getElementById('cu-suppliers-tbody');
    if (!tb) return;
    tb.innerHTML = '<tr><td colspan="7" class="td-muted" style="text-align:center;padding:24px">Loading…</td></tr>';
    try {
      const rows = await apiGet(`/api/suppliers/search?q=${encodeURIComponent(q)}`);
      if (!rows.length) { tb.innerHTML = '<tr><td colspan="7" class="td-muted" style="text-align:center;padding:24px">No suppliers found</td></tr>'; return; }
      tb.innerHTML = rows.map((s) => `<tr>
        <td class="fw-600">${s.vendor_name}</td>
        <td class="font-mono text-xs">${s.vendor_code || '—'}</td>
        <td class="td-muted">${[s.city, s.state].filter(Boolean).join(', ') || '—'}</td>
        <td class="font-mono text-xs td-muted">${s.gstin || '—'}</td>
        <td class="td-muted">${s.contact_person || '—'}${s.contact_phone ? ' · ' + s.contact_phone : ''}</td>
        <td><span class="badge ${s.vendor_status === 'active' || !s.vendor_status ? 'badge-green' : 'badge-gray'}">${s.vendor_status || 'active'}</span></td>
        <td><button class="topbar-btn" style="padding:4px 10px;font-size:12px" onclick="openCuSupplierEdit(${s.supplier_id})">✎ Edit</button></td>
      </tr>`).join('');
    } catch (err) { tb.innerHTML = `<tr><td colspan="7" class="td-muted" style="text-align:center;padding:24px;color:#b91c1c">${err.message}</td></tr>`; }
  }

  window.openCuSupplierModal = function() {
    document.getElementById('cu-supplier-editing-id').value = '';
    document.getElementById('cu-supplier-modal-title').textContent = 'Add Supplier';
    document.getElementById('cu-save-supplier-btn').textContent = 'Add Supplier';
    document.getElementById('cu-supplier-error').textContent = '';
    ['cu-sup-vendor-name','cu-sup-vendor-code','cu-sup-city','cu-sup-state','cu-sup-gstin','cu-sup-contact-person','cu-sup-contact-phone'].forEach((id) => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    openModal('modal-cu-supplier');
  };

  window.openCuSupplierEdit = async function(id) {
    try {
      const s = await apiGet(`/api/suppliers/${id}`);
      document.getElementById('cu-supplier-editing-id').value = id;
      document.getElementById('cu-supplier-modal-title').textContent = 'Edit Supplier';
      document.getElementById('cu-save-supplier-btn').textContent = 'Save Changes';
      document.getElementById('cu-sup-vendor-name').value      = s.vendor_name     || '';
      document.getElementById('cu-sup-vendor-code').value      = s.vendor_code     || '';
      document.getElementById('cu-sup-city').value             = s.city            || '';
      document.getElementById('cu-sup-state').value            = s.state           || '';
      document.getElementById('cu-sup-gstin').value            = s.gstin           || '';
      document.getElementById('cu-sup-contact-person').value   = s.contact_person  || '';
      document.getElementById('cu-sup-contact-phone').value    = s.contact_phone   || '';
      document.getElementById('cu-supplier-error').textContent = '';
      openModal('modal-cu-supplier');
    } catch (err) { alert(err.message); }
  };

  window.handleSaveCuSupplier = async function() {
    const editingId = document.getElementById('cu-supplier-editing-id').value;
    const errEl = document.getElementById('cu-supplier-error');
    const payload = {
      vendor_name:    (document.getElementById('cu-sup-vendor-name').value || '').trim(),
      vendor_code:    (document.getElementById('cu-sup-vendor-code').value || '').trim() || null,
      city:           (document.getElementById('cu-sup-city').value || '').trim() || null,
      state:          (document.getElementById('cu-sup-state').value || '').trim() || null,
      gstin:          (document.getElementById('cu-sup-gstin').value || '').trim() || null,
      contact_person: (document.getElementById('cu-sup-contact-person').value || '').trim() || null,
      contact_phone:  (document.getElementById('cu-sup-contact-phone').value || '').trim() || null
    };
    if (!payload.vendor_name) { errEl.textContent = 'Vendor Name is required.'; return; }
    try {
      errEl.textContent = '';
      if (editingId) { await apiPut(`/api/suppliers/${editingId}`, payload); }
      else { await apiPost('/api/suppliers', payload); }
      closeModal('modal-cu-supplier');
      loadCuSuppliers();
    } catch (err) { errEl.textContent = err.message; }
  };

  // ─── FOUNDRY MASTERS: MAKER MASTER ────────────────────────────────────────

  async function loadCuMakers() {
    const q  = (document.getElementById('cu-makers-search') || {}).value || '';
    const tb = document.getElementById('cu-makers-tbody');
    if (!tb) return;
    tb.innerHTML = '<tr><td colspan="6" class="td-muted" style="text-align:center;padding:24px">Loading…</td></tr>';
    try {
      const rows = await apiGet('/api/maker-master?all=1');
      const filtered = q ? rows.filter((m) => m.maker_name.toLowerCase().includes(q.toLowerCase()) || (m.maker_code || '').toLowerCase().includes(q.toLowerCase())) : rows;
      if (!filtered.length) { tb.innerHTML = '<tr><td colspan="6" class="td-muted" style="text-align:center;padding:24px">No makers found</td></tr>'; return; }
      tb.innerHTML = filtered.map((m) => `<tr>
        <td class="fw-600">${m.maker_name}</td>
        <td class="font-mono text-xs">${m.maker_code}</td>
        <td class="td-muted">${m.country || '—'}</td>
        <td class="td-muted text-xs">${m.description || '—'}</td>
        <td><span class="badge ${m.is_active ? 'badge-green' : 'badge-gray'}">${m.is_active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <button class="topbar-btn" style="padding:4px 10px;font-size:12px" onclick="openCuMakerEdit(${m.maker_id})">✎ Edit</button>
          <button class="topbar-btn" style="padding:4px 10px;font-size:12px;margin-left:4px;color:${m.is_active ? '#b91c1c' : '#059669'}" onclick="toggleCuMaker(${m.maker_id},${m.is_active ? 0 : 1})">${m.is_active ? 'Deactivate' : 'Activate'}</button>
        </td>
      </tr>`).join('');
    } catch (err) { tb.innerHTML = `<tr><td colspan="6" class="td-muted" style="text-align:center;padding:24px;color:#b91c1c">${err.message}</td></tr>`; }
  }

  window.openCuMakerModal = function() {
    document.getElementById('cu-maker-editing-id').value = '';
    document.getElementById('cu-maker-modal-title').textContent = 'Add Maker';
    document.getElementById('cu-save-maker-btn').textContent = 'Add Maker';
    document.getElementById('cu-maker-error').textContent = '';
    ['cu-maker-name','cu-maker-code','cu-maker-country','cu-maker-description'].forEach((id) => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    openModal('modal-cu-maker');
  };

  window.openCuMakerEdit = async function(id) {
    try {
      const m = await apiGet(`/api/maker-master/${id}`);
      document.getElementById('cu-maker-editing-id').value = id;
      document.getElementById('cu-maker-modal-title').textContent = 'Edit Maker';
      document.getElementById('cu-save-maker-btn').textContent = 'Save Changes';
      document.getElementById('cu-maker-name').value        = m.maker_name   || '';
      document.getElementById('cu-maker-code').value        = m.maker_code   || '';
      document.getElementById('cu-maker-country').value     = m.country      || '';
      document.getElementById('cu-maker-description').value = m.description  || '';
      document.getElementById('cu-maker-error').textContent = '';
      openModal('modal-cu-maker');
    } catch (err) { alert(err.message); }
  };

  window.handleSaveCuMaker = async function() {
    const editingId = document.getElementById('cu-maker-editing-id').value;
    const errEl = document.getElementById('cu-maker-error');
    const payload = {
      maker_name:  (document.getElementById('cu-maker-name').value || '').trim(),
      maker_code:  (document.getElementById('cu-maker-code').value || '').trim(),
      country:     (document.getElementById('cu-maker-country').value || '').trim() || null,
      description: (document.getElementById('cu-maker-description').value || '').trim() || null
    };
    if (!payload.maker_name) { errEl.textContent = 'Maker Name is required.'; return; }
    if (!payload.maker_code) { errEl.textContent = 'Maker Code is required.'; return; }
    try {
      errEl.textContent = '';
      if (editingId) { await apiPut(`/api/maker-master/${editingId}`, payload); }
      else { await apiPost('/api/maker-master', payload); }
      closeModal('modal-cu-maker');
      loadCuMakers();
    } catch (err) { errEl.textContent = err.message; }
  };

  window.toggleCuMaker = async function(id, newStatus) {
    try {
      await apiPut(`/api/maker-master/${id}`, { is_active: !!newStatus });
      loadCuMakers();
    } catch (err) { alert(err.message); }
  };

  // ─── FOUNDRY MASTERS: BRANDING AGENTS ─────────────────────────────────────

  async function loadCuBrandingAgents() {
    const q  = (document.getElementById('cu-branding-agents-search') || {}).value || '';
    const tb = document.getElementById('cu-branding-agents-tbody');
    if (!tb) return;
    tb.innerHTML = '<tr><td colspan="7" class="td-muted" style="text-align:center;padding:24px">Loading…</td></tr>';
    try {
      const rows = await apiGet('/api/branding-agents?all=1');
      const filtered = q ? rows.filter((a) => a.agent_name.toLowerCase().includes(q.toLowerCase()) || (a.agent_code || '').toLowerCase().includes(q.toLowerCase())) : rows;
      if (!filtered.length) { tb.innerHTML = '<tr><td colspan="7" class="td-muted" style="text-align:center;padding:24px">No branding agents found</td></tr>'; return; }
      tb.innerHTML = filtered.map((a) => `<tr>
        <td class="fw-600">${a.agent_name}</td>
        <td class="font-mono text-xs">${a.agent_code}</td>
        <td class="td-muted">${a.city || '—'}</td>
        <td class="td-muted">${a.contact_name || '—'}</td>
        <td class="td-muted text-xs">${a.contact_phone || '—'}</td>
        <td><span class="badge ${a.is_active ? 'badge-green' : 'badge-gray'}">${a.is_active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <button class="topbar-btn" style="padding:4px 10px;font-size:12px" onclick="openCuBrandingAgentEdit(${a.agent_id})">✎ Edit</button>
          <button class="topbar-btn" style="padding:4px 10px;font-size:12px;margin-left:4px;color:${a.is_active ? '#b91c1c' : '#059669'}" onclick="toggleCuBrandingAgent(${a.agent_id},${a.is_active ? 0 : 1})">${a.is_active ? 'Deactivate' : 'Activate'}</button>
        </td>
      </tr>`).join('');
    } catch (err) { tb.innerHTML = `<tr><td colspan="7" class="td-muted" style="text-align:center;padding:24px;color:#b91c1c">${err.message}</td></tr>`; }
  }

  window.openCuBrandingAgentModal = function() {
    document.getElementById('cu-ba-editing-id').value = '';
    document.getElementById('cu-branding-agent-modal-title').textContent = 'Add Branding Agent';
    document.getElementById('cu-save-branding-agent-btn').textContent = 'Add Branding Agent';
    document.getElementById('cu-branding-agent-error').textContent = '';
    ['cu-ba-agent-name','cu-ba-agent-code','cu-ba-city','cu-ba-contact-name','cu-ba-contact-phone'].forEach((id) => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    openModal('modal-cu-branding-agent');
  };

  window.openCuBrandingAgentEdit = async function(id) {
    try {
      const a = await apiGet(`/api/branding-agents/${id}`);
      document.getElementById('cu-ba-editing-id').value = id;
      document.getElementById('cu-branding-agent-modal-title').textContent = 'Edit Branding Agent';
      document.getElementById('cu-save-branding-agent-btn').textContent = 'Save Changes';
      document.getElementById('cu-ba-agent-name').value    = a.agent_name    || '';
      document.getElementById('cu-ba-agent-code').value    = a.agent_code    || '';
      document.getElementById('cu-ba-city').value          = a.city          || '';
      document.getElementById('cu-ba-contact-name').value  = a.contact_name  || '';
      document.getElementById('cu-ba-contact-phone').value = a.contact_phone || '';
      document.getElementById('cu-branding-agent-error').textContent = '';
      openModal('modal-cu-branding-agent');
    } catch (err) { alert(err.message); }
  };

  window.handleSaveCuBrandingAgent = async function() {
    const editingId = document.getElementById('cu-ba-editing-id').value;
    const errEl = document.getElementById('cu-branding-agent-error');
    const payload = {
      agent_name:    (document.getElementById('cu-ba-agent-name').value || '').trim(),
      agent_code:    (document.getElementById('cu-ba-agent-code').value || '').trim(),
      city:          (document.getElementById('cu-ba-city').value || '').trim() || null,
      contact_name:  (document.getElementById('cu-ba-contact-name').value || '').trim() || null,
      contact_phone: (document.getElementById('cu-ba-contact-phone').value || '').trim() || null
    };
    if (!payload.agent_name) { errEl.textContent = 'Agent Name is required.'; return; }
    if (!payload.agent_code) { errEl.textContent = 'Agent Code is required.'; return; }
    try {
      errEl.textContent = '';
      if (editingId) { await apiPut(`/api/branding-agents/${editingId}`, payload); }
      else { await apiPost('/api/branding-agents', payload); }
      closeModal('modal-cu-branding-agent');
      loadCuBrandingAgents();
    } catch (err) { errEl.textContent = err.message; }
  };

  window.toggleCuBrandingAgent = async function(id, newStatus) {
    try {
      await apiPut(`/api/branding-agents/${id}`, { is_active: !!newStatus });
      loadCuBrandingAgents();
    } catch (err) { alert(err.message); }
  };

  // Wire showPage nav triggers for new masters
  const _origShowPage = window.showPage;
  if (typeof _origShowPage === 'function') {
    window.showPage = function(id, el) {
      _origShowPage(id, el);
      if (id === 'cu-suppliers')       loadCuSuppliers();
      if (id === 'cu-maker-master')    loadCuMakers();
      if (id === 'cu-branding-agents') loadCuBrandingAgents();
    };
  }

  // ─── INITIAL LOAD ─────────────────────────────────────────────────────────

  loadStores();
  loadUsers();
  loadRoles();
  loadHomeBrands();
  loadGstRates();
  loadMembershipTiers();
  loadLeaveTypes();
  loadFoundrySettings();
  loadAuditLogs();
  loadDashboard();
});
