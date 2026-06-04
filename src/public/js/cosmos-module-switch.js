/**
 * Sidebar footer — "Switch module" link to Cosmos Hub (/hub).
 * Shown only when the user has access to 2+ modules.
 * Requires window.COSMOS_MODULES_CATALOG from cosmos-modules-catalog.js.
 */
(function cosmosModuleSwitchBootstrap() {
  var HUB_URL = '/hub';

  function moduleAllowed(user, key) {
    if (!key) return false;
    var mods = user && user.modules;
    var hasMap = mods && typeof mods === 'object' && Object.keys(mods).length > 0;
    if (!hasMap) return true;
    return mods[key] !== false;
  }

  function countVisibleModules(user) {
    var catalog = window.COSMOS_MODULES_CATALOG;
    if (!catalog || !catalog.length) return 0;
    var n = 0;
    for (var i = 0; i < catalog.length; i++) {
      if (moduleAllowed(user, catalog[i].key)) n += 1;
    }
    return n;
  }

  function buildHubSwitchLink() {
    var link = document.createElement('a');
    link.href = HUB_URL;
    link.className = 'cosmos-module-hub-link';
    link.textContent = 'Switch module';
    link.setAttribute('aria-label', 'Switch module — open Cosmos Hub');
    return link;
  }

  window.initCosmosModuleSwitchFooter = function initCosmosModuleSwitchFooter(user) {
    var mount = document.getElementById('cosmos-module-switch-footer');
    if (!mount) return;

    mount.innerHTML = '';

    if (countVisibleModules(user) < 2) {
      mount.setAttribute('hidden', 'hidden');
      mount.style.display = 'none';
      return;
    }

    mount.removeAttribute('hidden');
    mount.style.display = '';
    mount.appendChild(buildHubSwitchLink());
  };

  /** @deprecated Legacy nav wrap — hide if present, then init footer link. */
  window.applyCosmosModuleSwitchNav = function applyCosmosModuleSwitchNav(wrapId, user) {
    var wrap = document.getElementById(wrapId);
    if (wrap) wrap.style.display = 'none';
    window.initCosmosModuleSwitchFooter(user);
  };
})();
