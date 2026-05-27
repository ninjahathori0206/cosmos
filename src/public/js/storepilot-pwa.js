/* Store Pilot PWA — install prompt, iOS coach mark, offline hints, standalone class */
(function storepilotPwaBootstrap() {
  var LS_INSTALL_DISMISS = 'sp_pwa_install_dismissed';
  var LS_IOS_HINT = 'sp_pwa_ios_hint_seen';
  var DISMISS_DAYS = 7;

  var deferredPrompt = null;

  function isStandalone() {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator.standalone === true) return true;
    return false;
  }

  function isIosSafari() {
    var ua = window.navigator.userAgent || '';
    var isIos = /iphone|ipad|ipod/i.test(ua);
    var isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    return isIos && isSafari;
  }

  function installDismissedRecently() {
    try {
      var raw = localStorage.getItem(LS_INSTALL_DISMISS);
      if (!raw) return false;
      var ts = Number(raw);
      if (!ts || isNaN(ts)) return false;
      return Date.now() - ts < DISMISS_DAYS * 86400000;
    } catch (_) {
      return false;
    }
  }

  function markInstallDismissed() {
    try {
      localStorage.setItem(LS_INSTALL_DISMISS, String(Date.now()));
    } catch (_) { /* ignore */ }
  }

  function applyStandaloneClass() {
    if (!isStandalone()) return;
    document.body.classList.add('sp-pwa-standalone');
  }

  function hideBanner() {
    var el = document.getElementById('sp-pwa-install-banner');
    if (el) el.hidden = true;
  }

  function hideIosHint() {
    var el = document.getElementById('sp-pwa-ios-hint');
    if (el) el.hidden = true;
  }

  function showInstallBanner() {
    if (isStandalone() || installDismissedRecently() || !deferredPrompt) return;
    var el = document.getElementById('sp-pwa-install-banner');
    if (el) el.hidden = false;
  }

  function showIosHint() {
    if (isStandalone() || !isIosSafari()) return;
    try {
      if (localStorage.getItem(LS_IOS_HINT)) return;
    } catch (_) { return; }
    var el = document.getElementById('sp-pwa-ios-hint');
    if (el) el.hidden = false;
  }

  window.spPwaDismissInstall = function () {
    markInstallDismissed();
    hideBanner();
  };

  window.spPwaInstall = async function () {
    if (!deferredPrompt) {
      if (typeof window.cosmosToastInfo === 'function') {
        window.cosmosToastInfo('Use your browser menu to install this app.');
      }
      return;
    }
    var btn = document.getElementById('sp-pwa-install-btn');
    if (btn && typeof window.cosmosBtnLoading === 'function') window.cosmosBtnLoading(btn);
    try {
      deferredPrompt.prompt();
      var choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      hideBanner();
      if (choice && choice.outcome === 'accepted' && typeof window.cosmosToastSuccess === 'function') {
        window.cosmosToastSuccess('Store Pilot installed');
      }
    } catch (_) {
      if (typeof window.cosmosToastError === 'function') {
        window.cosmosToastError('Install was cancelled or is not available.');
      }
    } finally {
      if (btn && typeof window.cosmosBtnDone === 'function') window.cosmosBtnDone(btn);
    }
  };

  window.spPwaDismissIosHint = function () {
    try {
      localStorage.setItem(LS_IOS_HINT, '1');
    } catch (_) { /* ignore */ }
    hideIosHint();
  };

  function updateLoginOfflineMsg() {
    var el = document.getElementById('sp-pwa-offline-msg');
    if (!el) return;
    el.hidden = navigator.onLine !== false;
  }

  function bindNetworkToasts() {
    var wasOnline = navigator.onLine;
    window.addEventListener('online', function () {
      wasOnline = true;
      updateLoginOfflineMsg();
      if (typeof window.cosmosToastInfo === 'function') {
        window.cosmosToastInfo('Back online');
      }
    });
    window.addEventListener('offline', function () {
      if (!wasOnline) return;
      wasOnline = false;
      updateLoginOfflineMsg();
      if (typeof window.cosmosToastWarn === 'function') {
        window.cosmosToastWarn('You are offline. Some actions need a connection.');
      }
    });
  }

  function registerServiceWorker() {
    if (typeof window.cosmosPwaUpdateInit !== 'function') return;
    void window.cosmosPwaUpdateInit({
      prefix: 'sp',
      appLabel: 'Store Pilot',
      swUrl: '/storepilot-sw.js',
      scope: '/',
      versionHint: 'storepilot-v6-pwa-update'
    });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  document.addEventListener('DOMContentLoaded', function () {
    applyStandaloneClass();
    registerServiceWorker();
    bindNetworkToasts();
    updateLoginOfflineMsg();
    if (!isStandalone()) {
      showInstallBanner();
      showIosHint();
    }
  });
})();
