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

      const u = data.data.user;
      const mods = u.modules;
      const hasMap = mods && typeof mods === 'object' && Object.keys(mods).length > 0;

      /** First app this deployment serves; missing key = allowed (legacy). Explicit false = deny. */
      const LANDING = [
        ['command_unit', '/command-unit.html'],
        ['foundry', '/foundry.html'],
        ['finance', '/finance.html'],
        ['storepilot', '/storepilot.html']
      ];

      function pickLanding() {
        if (!hasMap) return '/command-unit.html';
        for (const [key, path] of LANDING) {
          if (mods[key] !== false) return path;
        }
        return null;
      }

      const dest = pickLanding();
      if (!dest) {
        throw new Error(
          'No web module is enabled for your account (Command Unit, Foundry, Finance, StorePilot are all off). ' +
            'Ask an administrator to turn on at least one module for your role in Roles → Module access, then try again.'
        );
      }

      sessionStorage.setItem('cosmos_token', data.data.token);
      sessionStorage.setItem('cosmos_user', JSON.stringify(data.data.user));
      window.location.href = dest;
    } catch (err) {
      errorEl.textContent = err.message || 'Login failed';
    } finally {
      btn.disabled = false;
    }
  });
});

