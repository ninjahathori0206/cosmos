/**
 * Hide sidebar links the logged-in user cannot access (uses user.modules from login).
 * @param {string} wrapId - Element containing .nav-group label + [data-cosmos-module] items only.
 * @param {object} user - Parsed cosmos_user from sessionStorage
 */
window.applyCosmosModuleSwitchNav = function (wrapId, user) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  const mods = user && user.modules;
  const hasMap = mods && typeof mods === 'object' && Object.keys(mods).length > 0;
  function allowed(key) {
    if (!key) return false;
    if (!hasMap) return true;
    return mods[key] !== false;
  }
  wrap.querySelectorAll('[data-cosmos-module]').forEach((el) => {
    const key = el.getAttribute('data-cosmos-module');
    el.style.display = allowed(key) ? '' : 'none';
  });
  const visible = [...wrap.querySelectorAll('[data-cosmos-module]')].filter((el) => el.style.display !== 'none');
  wrap.style.display = visible.length > 0 ? '' : 'none';
};
