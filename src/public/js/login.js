const API_KEY = 'CHANGE_ME_API_KEY';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('error');
  const btn = document.getElementById('login-btn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    btn.disabled = true;

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Login failed');
      }

      sessionStorage.setItem('cosmos_token', data.data.token);
      sessionStorage.setItem('cosmos_user', JSON.stringify(data.data.user));
      window.location.href = '/command-unit.html';
    } catch (err) {
      errorEl.textContent = err.message || 'Login failed';
    } finally {
      btn.disabled = false;
    }
  });
});

