const API_KEY = 'CHANGE_ME_API_KEY';

document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('cosmos_token');
  const userRaw = sessionStorage.getItem('cosmos_user');
  if (!token || !userRaw) {
    window.location.href = '/login.html';
    return;
  }

  const user = JSON.parse(userRaw);
  const userInfo = document.getElementById('user-info');
  if (userInfo) {
    const label = document.createElement('span');
    label.textContent = `${user.full_name} · ${user.role}`;
    userInfo.insertBefore(label, userInfo.firstChild);
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('cosmos_token');
      sessionStorage.removeItem('cosmos_user');
      window.location.href = '/';
    });
  }

  async function apiGet(path) {
    const res = await fetch(path, {
      headers: {
        'X-API-Key': API_KEY,
        Authorization: `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Request failed');
    }
    return data.data;
  }

  async function loadStores() {
    const tbody = document.querySelector('#stores-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      const stores = await apiGet('/api/stores');
      stores.forEach((s) => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          `<td>${s.store_name}</td>` +
          `<td>${s.store_code}</td>` +
          `<td>${s.store_type || ''}</td>` +
          `<td>${s.city || ''}</td>` +
          `<td>${s.is_active ? '<span class="tag">Active</span>' : 'Inactive'}</td>`;
        tbody.appendChild(tr);
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5">Error loading stores: ${err.message}</td></tr>`;
    }
  }

  async function loadHomeBrands() {
    const tbody = document.querySelector('#brands-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      const brands = await apiGet('/api/home-brands');
      brands.forEach((b) => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          `<td>${b.brand_name}</td>` +
          `<td>${b.brand_code}</td>` +
          `<td>${b.is_active ? '<span class="tag">Active</span>' : 'Inactive'}</td>`;
        tbody.appendChild(tr);
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="3">Error loading home brands: ${err.message}</td></tr>`;
    }
  }

  loadStores();
  loadHomeBrands();
});

