/* Cosmos PWA — in-app update popup (shared across Store Pilot, Store OS, Eyewoot Go) */
(function cosmosPwaUpdateModule() {
  'use strict'

  var CHECK_INTERVAL_MS = 30 * 60 * 1000

  function ssKey(prefix) {
    return String(prefix || 'pwa') + '_update_dismissed'
  }

  function overlayId(prefix) {
    return String(prefix || 'pwa') + '-pwa-update-overlay'
  }

  function ensureOverlay(opts) {
    var prefix = opts.prefix || 'pwa'
    var appLabel = opts.appLabel || 'this app'
    var id = overlayId(prefix)
    var existing = document.getElementById(id)
    if (existing) return existing

    var wrap = document.createElement('div')
    wrap.id = id
    wrap.className = 'overlay cosmos-pwa-update-overlay'
    wrap.hidden = true
    wrap.setAttribute('role', 'dialog')
    wrap.setAttribute('aria-modal', 'true')
    wrap.setAttribute('aria-labelledby', prefix + '-pwa-update-title')

    wrap.innerHTML =
      '<div class="modal cosmos-pwa-update-modal">' +
        '<div class="mb cosmos-pwa-update-body">' +
          '<div class="cosmos-pwa-update-icon" aria-hidden="true">' +
            '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>' +
            '</svg>' +
          '</div>' +
          '<h2 class="cosmos-pwa-update-title" id="' + prefix + '-pwa-update-title">Update available</h2>' +
          '<p class="cosmos-pwa-update-sub" id="' + prefix + '-pwa-update-sub">' +
            'A new version of ' + appLabel + ' is ready. Tap Update to refresh and stay in the app.' +
          '</p>' +
          '<p class="cosmos-pwa-update-version" id="' + prefix + '-pwa-update-version" hidden></p>' +
        '</div>' +
        '<div class="cosmos-modal-actions cosmos-pwa-update-actions">' +
          '<button type="button" class="btn" data-pwa-update-later>Later</button>' +
          '<button type="button" class="btn primary" data-pwa-update-apply>Update</button>' +
        '</div>' +
      '</div>'

    document.body.appendChild(wrap)

    var laterBtn = wrap.querySelector('[data-pwa-update-later]')
    var applyBtn = wrap.querySelector('[data-pwa-update-apply]')

    if (laterBtn) {
      laterBtn.addEventListener('click', function () {
        try {
          sessionStorage.setItem(ssKey(prefix), '1')
        } catch (_e) { /* ignore */ }
        hideOverlay(wrap)
      })
    }

    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        applyPendingUpdate(opts, applyBtn)
      })
    }

    wrap.addEventListener('click', function (e) {
      if (e.target === wrap) {
        try {
          sessionStorage.setItem(ssKey(prefix), '1')
        } catch (_err) { /* ignore */ }
        hideOverlay(wrap)
      }
    })

    return wrap
  }

  function hideOverlay(el) {
    if (!el) return
    el.classList.remove('open')
    el.hidden = true
    document.body.classList.remove('cosmos-pwa-update-open')
  }

  function showOverlay(opts, versionLabel) {
    var prefix = opts.prefix || 'pwa'
    if (isDismissed(prefix)) return

    var el = ensureOverlay(opts)
    var verEl = document.getElementById(prefix + '-pwa-update-version')
    if (verEl) {
      if (versionLabel) {
        verEl.textContent = versionLabel
        verEl.hidden = false
      } else {
        verEl.textContent = ''
        verEl.hidden = true
      }
    }

    el.hidden = false
    el.classList.add('open')
    document.body.classList.add('cosmos-pwa-update-open')

    var applyBtn = el.querySelector('[data-pwa-update-apply]')
    if (applyBtn) applyBtn.focus()
  }

  function isDismissed(prefix) {
    try {
      return sessionStorage.getItem(ssKey(prefix)) === '1'
    } catch (_e) {
      return false
    }
  }

  function clearDismiss(prefix) {
    try {
      sessionStorage.removeItem(ssKey(prefix))
    } catch (_e) { /* ignore */ }
  }

  function applyPendingUpdate(opts, btn) {
    var reg = opts.registration
    if (!reg || !reg.waiting) {
      hideOverlay(document.getElementById(overlayId(opts.prefix)))
      window.location.reload()
      return
    }

    if (btn && typeof window.cosmosBtnLoading === 'function') {
      window.cosmosBtnLoading(btn)
    } else if (btn) {
      btn.disabled = true
    }

    reg.waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  function resolveVersionLabel(opts, worker, done) {
    fetch(opts.swUrl, { cache: 'no-store' })
      .then(function (res) { return res.text(); })
      .then(function (text) {
        var m = text.match(/var CACHE_NAME = ['"]([^'"]+)['"]/)
        done(m ? m[1] : (opts.versionHint || extractVersionFromWorker(worker) || ''))
      })
      .catch(function () {
        done(opts.versionHint || extractVersionFromWorker(worker) || '')
      })
  }

  function promptUpdate(opts, worker) {
    resolveVersionLabel(opts, worker, function (label) {
      showOverlay(opts, label)
    })
  }

  function extractVersionFromWorker(worker) {
    if (!worker || !worker.scriptURL) return ''
    var url = String(worker.scriptURL)
    var m = url.match(/[?&]v=([^&]+)/)
    return m ? decodeURIComponent(m[1]) : ''
  }

  function attachWaitingListener(opts, worker) {
    if (!worker) return
    worker.addEventListener('statechange', function () {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        promptUpdate(opts, worker)
      }
    })
  }

  function handleRegistration(opts, reg) {
    opts.registration = reg

    if (reg.waiting && navigator.serviceWorker.controller) {
      promptUpdate(opts, reg.waiting)
    }

    reg.addEventListener('updatefound', function () {
      clearDismiss(opts.prefix)
      var installing = reg.installing
      if (!installing) return
      attachWaitingListener(opts, installing)
    })

    if (typeof reg.update === 'function') {
      reg.update().catch(function () { /* offline */ })
    }
  }

  function scheduleUpdateChecks(opts) {
    if (typeof window.addEventListener === 'function') {
      window.addEventListener('focus', function () {
        var reg = opts.registration
        if (reg && typeof reg.update === 'function') {
          reg.update().catch(function () { /* ignore */ })
        }
      })
    }

    window.setInterval(function () {
      var reg = opts.registration
      if (reg && typeof reg.update === 'function') {
        reg.update().catch(function () { /* ignore */ })
      }
    }, opts.checkIntervalMs || CHECK_INTERVAL_MS)
  }

  /**
   * @param {object} opts
   * @param {string} opts.prefix - e.g. sp, sos, go
   * @param {string} opts.appLabel - display name
   * @param {string} opts.swUrl - service worker script URL
   * @param {string} [opts.scope] - registration scope
   * @param {string} [opts.versionHint] - optional label shown in modal
   * @param {number} [opts.checkIntervalMs]
   */
  window.cosmosPwaUpdateInit = function cosmosPwaUpdateInit(opts) {
    if (!opts || !opts.swUrl) return Promise.resolve(null)
    if (!('serviceWorker' in navigator)) return Promise.resolve(null)

    var config = {
      prefix: String(opts.prefix || 'pwa'),
      appLabel: String(opts.appLabel || 'this app'),
      swUrl: String(opts.swUrl),
      scope: opts.scope != null ? String(opts.scope) : undefined,
      versionHint: opts.versionHint ? String(opts.versionHint) : '',
      checkIntervalMs: opts.checkIntervalMs || CHECK_INTERVAL_MS,
      registration: null
    }

    ensureOverlay(config)

    var reloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloaded) return
      reloaded = true
      window.location.reload()
    })

    var regOpts = { scope: config.scope }
    if (!config.scope) delete regOpts.scope

    return navigator.serviceWorker.register(config.swUrl, regOpts)
      .then(function (reg) {
        handleRegistration(config, reg)
        scheduleUpdateChecks(config)
        return reg
      })
      .catch(function (err) {
        console.warn('[Cosmos PWA update] Registration failed:', err)
        return null
      })
  }
})()
