/**
 * Sidebar footer module switcher (active module name + horizontal strip + hover flyout).
 * Requires window.COSMOS_MODULES_CATALOG from cosmos-modules-catalog.js.
 */
(function cosmosModuleSwitchBootstrap() {
  function moduleAllowed(user, key) {
    if (!key) return false;
    var mods = user && user.modules;
    var hasMap = mods && typeof mods === 'object' && Object.keys(mods).length > 0;
    if (!hasMap) return true;
    return mods[key] !== false;
  }

  function detectModuleFromPath() {
    var p = String(window.location.pathname || '');
    if (p.indexOf('/foundry') === 0) return 'foundry';
    if (p.indexOf('/finance') === 0) return 'finance';
    if (p.indexOf('/storepilot') === 0) return 'storepilot';
    if (p.indexOf('/storeos') === 0 || p.indexOf('/pos') === 0) return 'pos';
    if (p.indexOf('/command-unit') === 0) return 'command_unit';
    if (p.indexOf('/cx') === 0) return 'cx';
    return '';
  }

  function findModuleByKey(key) {
    var catalog = window.COSMOS_MODULES_CATALOG;
    if (!catalog || !key) return null;
    for (var i = 0; i < catalog.length; i++) {
      if (catalog[i].key === key) return catalog[i];
    }
    return null;
  }

  function navigateToModule(href) {
    if (!href) return;
    window.location.href = href;
  }

  function closeAllModuleSwitchers(except) {
    document.querySelectorAll('.cosmos-module-switch.is-open').forEach(function (el) {
      if (except && el === except) return;
      el.classList.remove('is-open');
    });
  }

  function bindMobileToggle(root) {
    if (root._cosmosModuleBound) return;
    root._cosmosModuleBound = true;
    var stripWrap = root.querySelector('.cosmos-module-strip-wrap');
    if (!stripWrap) return;
    stripWrap.addEventListener('click', function (e) {
      if (window.matchMedia('(hover: hover)').matches) return;
      if (e.target.closest('.cosmos-module-flyout a')) return;
      e.preventDefault();
      e.stopPropagation();
      var wasOpen = root.classList.contains('is-open');
      closeAllModuleSwitchers();
      if (!wasOpen) root.classList.add('is-open');
    });
  }

  function buildActiveModuleRow(mod) {
    var row = document.createElement('div');
    row.className = 'cosmos-module-active';
    row.setAttribute('aria-label', 'Current module: ' + mod.label);

    var cap = document.createElement('span');
    cap.className = 'cosmos-module-active-cap';
    cap.textContent = 'Active';

    var lbl = document.createElement('span');
    lbl.className = 'cosmos-module-active-lbl';
    lbl.textContent = mod.label;

    row.appendChild(cap);
    row.appendChild(lbl);
    return row;
  }

  function buildModuleSwitcher(user, currentKey, visible) {
    if (!visible || visible.length < 2) return null;

    var root = document.createElement('div');
    root.className = 'cosmos-module-switch';
    root.setAttribute('role', 'navigation');
    root.setAttribute('aria-label', 'Switch module');

    var flyout = document.createElement('div');
    flyout.className = 'cosmos-module-flyout';
    flyout.setAttribute('role', 'menu');

    var stripWrap = document.createElement('div');
    stripWrap.className = 'cosmos-module-strip-wrap';

    var strip = document.createElement('div');
    strip.className = 'cosmos-module-strip';
    strip.setAttribute('role', 'menubar');

    visible.forEach(function (mod) {
      var isActive = mod.key === currentKey;
      var flyItem = document.createElement('a');
      flyItem.className = 'cosmos-module-flyout-item' + (isActive ? ' is-active' : '');
      flyItem.setAttribute('role', 'menuitem');
      flyItem.href = mod.href;
      flyItem.setAttribute('data-cosmos-module', mod.key);
      if (isActive) flyItem.setAttribute('aria-current', 'page');
      flyItem.textContent = mod.shortLabel;
      flyItem.addEventListener('click', function (e) {
        e.preventDefault();
        navigateToModule(mod.href);
      });
      flyout.appendChild(flyItem);

      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'cosmos-module-chip' + (isActive ? ' is-active' : '');
      chip.setAttribute('data-cosmos-module', mod.key);
      chip.setAttribute('aria-label', mod.label);
      chip.title = mod.label;
      if (isActive) chip.setAttribute('aria-current', 'page');
      chip.innerHTML = '<span class="cosmos-module-chip-ic" aria-hidden="true">' + mod.icon + '</span>';
      if (!isActive) {
        chip.addEventListener('click', function () {
          navigateToModule(mod.href);
        });
      } else {
        chip.disabled = true;
      }
      strip.appendChild(chip);
    });

    stripWrap.appendChild(strip);
    root.appendChild(flyout);
    root.appendChild(stripWrap);
    bindMobileToggle(root);
    return root;
  }

  window.initCosmosModuleSwitchFooter = function initCosmosModuleSwitchFooter(user, options) {
    options = options || {};
    var mount = document.getElementById('cosmos-module-switch-footer');
    if (!mount) return;

    var catalog = window.COSMOS_MODULES_CATALOG;
    if (!catalog || !catalog.length) {
      mount.setAttribute('hidden', 'hidden');
      mount.style.display = 'none';
      return;
    }

    var currentKey = options.currentModule || mount.getAttribute('data-current-module') || detectModuleFromPath();
    var currentMod = findModuleByKey(currentKey);
    var visible = catalog.filter(function (m) {
      return moduleAllowed(user, m.key);
    });

    mount.innerHTML = '';
    mount.removeAttribute('hidden');

    var wrap = document.createElement('div');
    wrap.className = 'cosmos-sidebar-footer-modules';

    if (currentMod) {
      wrap.appendChild(buildActiveModuleRow(currentMod));
    }

    var switcher = buildModuleSwitcher(user, currentKey, visible);
    if (switcher) wrap.appendChild(switcher);

    if (!currentMod && !switcher) {
      mount.setAttribute('hidden', 'hidden');
      mount.style.display = 'none';
      return;
    }

    mount.appendChild(wrap);
    mount.style.display = '';
  };

  /** @deprecated Use initCosmosModuleSwitchFooter — removes legacy nav wrap if present. */
  window.applyCosmosModuleSwitchNav = function applyCosmosModuleSwitchNav(wrapId, user) {
    var wrap = document.getElementById(wrapId);
    if (wrap) wrap.style.display = 'none';
    window.initCosmosModuleSwitchFooter(user);
  };

  if (!window._cosmosModuleSwitchDocBound) {
    window._cosmosModuleSwitchDocBound = true;
    document.addEventListener('click', function (e) {
      if (e.target.closest('.cosmos-module-switch')) return;
      closeAllModuleSwitchers();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAllModuleSwitchers();
    });
  }
})();
