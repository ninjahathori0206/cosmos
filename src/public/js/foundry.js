const FOUNDRY_API_KEY = 'CHANGE_ME_API_KEY';

document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('cosmos_token');
  const userRaw = sessionStorage.getItem('cosmos_user');

  if (!token || !userRaw) {
    window.location.href = '/login.html';
    return;
  }

  const user = JSON.parse(userRaw);
  const userInfo = document.getElementById('foundry-user');
  if (userInfo) {
    const label = document.createElement('span');
    label.textContent = `${user.full_name} · ${user.role}`;
    userInfo.insertBefore(label, userInfo.firstChild);
  }

  const logoutBtn = document.getElementById('foundry-logout-btn');
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
        'X-API-Key': FOUNDRY_API_KEY,
        Authorization: `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Request failed');
    }
    return data.data;
  }

  async function apiPost(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': FOUNDRY_API_KEY,
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Request failed');
    }
    return data.data;
  }

  async function loadSuppliers() {
    const tbody = document.querySelector('#suppliers-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      const suppliers = await apiGet('/api/suppliers');
      suppliers.forEach((s) => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          `<td>${s.vendor_name}</td>` +
          `<td>${s.vendor_code}</td>` +
          `<td>${s.city || ''}</td>` +
          `<td>${s.vendor_status === 'active' ? '<span class="tag tag-green">Active</span>' : s.vendor_status}</td>`;
        tbody.appendChild(tr);
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4">Error loading suppliers: ${err.message}</td></tr>`;
    }
  }

  async function loadPurchases() {
    const tbody = document.querySelector('#purchases-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      const purchases = await apiGet('/api/purchases');
      purchases.forEach((p) => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          `<td>${p.purchase_id}</td>` +
          `<td>${p.ew_collection || ''} · ${p.style_model || ''}</td>` +
          `<td>${p.quantity}</td>` +
          `<td>${p.purchase_rate}</td>` +
          `<td>${p.expected_bill_amt}</td>` +
          `<td><span class="tag tag-blue">${p.bill_status}</span></td>`;
        tbody.appendChild(tr);
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6">Error loading purchases: ${err.message}</td></tr>`;
    }
  }

  const form = document.getElementById('purchase-form');
  const errorEl = document.getElementById('pf-error');
  const btn = document.getElementById('pf-submit');

  if (form) {
    const today = (() => { const [d,m,y] = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).split('/'); return `${y}-${m}-${d}`; })();
    const dateInput = document.getElementById('pf-date');
    if (dateInput) dateInput.value = today;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';
      btn.disabled = true;

      try {
        const body = {
          product_master_id: Number(document.getElementById('pf-product').value),
          purchase_date: document.getElementById('pf-date').value,
          purchase_rate: Number(document.getElementById('pf-rate').value),
          quantity: Number(document.getElementById('pf-qty').value),
          transport_cost: Number(document.getElementById('pf-transport').value || 0),
          gst_pct: Number(document.getElementById('pf-gst').value),
          po_reference: document.getElementById('pf-po').value || null,
          notes: document.getElementById('pf-notes').value || null,
          store_id: 1,
          colours: [
            {
              colour_name: document.getElementById('pf-colour1-name').value || 'Colour 1',
              colour_code: document.getElementById('pf-colour1-code').value || 'C1',
              quantity: Number(document.getElementById('pf-colour1-qty').value || 0)
            },
            {
              colour_name: document.getElementById('pf-colour2-name').value || 'Colour 2',
              colour_code: document.getElementById('pf-colour2-code').value || 'C2',
              quantity: Number(document.getElementById('pf-colour2-qty').value || 0)
            }
          ]
        };

        const created = await apiPost('/api/purchases', body);
        errorEl.textContent = `Saved purchase #${created.purchase_id} · Expected bill ₹${created.expected_bill_amt}`;
        await loadPurchases();
      } catch (err) {
        errorEl.textContent = err.message || 'Failed to save purchase';
      } finally {
        btn.disabled = false;
      }
    });
  }

  loadSuppliers();
  loadPurchases();
});

