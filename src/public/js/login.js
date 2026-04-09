const API_KEY = 'CHANGE_ME_API_KEY';

const LS_USER = 'cosmos_login_username';
const LS_PASS = 'cosmos_login_password';

/**
 * Only pre-fill from our "Remember me" localStorage — no default admin/password.
 * Browsers may still autofill from their own password store; we use autocomplete="off"
 * and readonly-until-focus in HTML to reduce that.
 */
function applySavedOrDefaults() {
  const userEl = document.getElementById('username');
  const passEl = document.getElementById('password');
  const rememberEl = document.getElementById('login-remember-me');
  if (!userEl || !passEl) return;

  const savedU = localStorage.getItem(LS_USER);
  const savedP = localStorage.getItem(LS_PASS);

  if (savedU != null && savedU !== '') {
    userEl.value = savedU;
    userEl.removeAttribute('readonly');
  } else {
    userEl.value = '';
  }

  if (savedP != null && savedP !== '') {
    passEl.value = savedP;
    if (rememberEl) rememberEl.checked = true;
    passEl.removeAttribute('readonly');
  } else {
    passEl.value = '';
  }
}

/** Lets user type without double-click; also helps avoid autofill until interaction. */
function attachReadonlyUnlock() {
  ['username', 'password'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const unlock = () => {
      if (el.hasAttribute('readonly')) el.removeAttribute('readonly');
    };
    el.addEventListener('focus', unlock, { once: true });
    el.addEventListener('pointerdown', unlock, { once: true });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applySavedOrDefaults();
  attachReadonlyUnlock();

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
    const remember = document.getElementById('login-remember-me')?.checked;

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

      if (remember) {
        localStorage.setItem(LS_USER, username);
        localStorage.setItem(LS_PASS, password);
      } else {
        localStorage.removeItem(LS_USER);
        localStorage.removeItem(LS_PASS);
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
