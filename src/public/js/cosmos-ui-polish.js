(function cosmosUiPolishBootstrap() {

  window.cosmosSkeletonTable = function(tbodyId, cols, rows) {
    var tbody = document.getElementById(tbodyId)
    if (!tbody) return
    var safeCols = Number(cols) > 0 ? Number(cols) : 1
    var safeRows = Number(rows) > 0 ? Number(rows) : 6
    var rowHtml = ''
    for (var r = 0; r < safeRows; r++) {
      var cells = ''
      for (var c = 0; c < safeCols; c++) cells += '<td><span class="skel skel-text"></span></td>'
      rowHtml += '<tr>' + cells + '</tr>'
    }
    tbody.innerHTML = rowHtml
  }

  window.cosmosSkeletonCards = function(containerId, count) {
    var wrap = document.getElementById(containerId)
    if (!wrap) return
    var safeCount = Number(count) > 0 ? Number(count) : 4
    var html = ''
    for (var i = 0; i < safeCount; i++) {
      html += '' +
        '<div class="card">' +
        '<span class="skel skel-title"></span>' +
        '<span class="skel skel-stat"></span>' +
        '<span class="skel skel-text-sm"></span>' +
        '</div>'
    }
    wrap.innerHTML = html
  }

  window.cosmosSkeletonRows = function(containerId, count) {
    var wrap = document.getElementById(containerId)
    if (!wrap) return
    var safeCount = Number(count) > 0 ? Number(count) : 4
    var html = ''
    for (var i = 0; i < safeCount; i++) html += '<span class="skel skel-row"></span>'
    wrap.innerHTML = html
  }

  window.cosmosBtnLoading = function(btn) {
    if (!btn) return
    if (btn._originalText === undefined) btn._originalText = btn.innerHTML
    btn.classList.add('btn-loading')
    btn.disabled = true
  }

  window.cosmosBtnDone = function(btn) {
    if (!btn) return
    btn.classList.remove('btn-loading', 'btn-success')
    if (btn._originalText !== undefined) btn.innerHTML = btn._originalText
    btn.disabled = false
  }

  window.cosmosBtnSuccess = function(btn) {
    if (!btn) return
    window.cosmosBtnDone(btn)
    btn.classList.add('btn-success')
    setTimeout(function() { btn.classList.remove('btn-success') }, 700)
  }

  function ensureToastContainer() {
    var existing = document.getElementById('cosmos-toast-container')
    if (existing) return existing
    var container = document.createElement('div')
    container.id = 'cosmos-toast-container'
    document.body.appendChild(container)
    return container
  }

  function removeToastNode(node) {
    if (!node || !node.parentElement) return
    node.style.animation = 'cosmosToastOut 0.18s ease-out both'
    setTimeout(function() {
      if (node && node.parentElement) node.parentElement.removeChild(node)
    }, 180)
  }

  window.cosmosToast = function(message, type, durationMs) {
    var toastType = type || 'info'
    var resolvedDuration = durationMs
    if (resolvedDuration == null) {
      if (toastType === 'error') resolvedDuration = 0
      else if (toastType === 'warn') resolvedDuration = 5000
      else if (toastType === 'success') resolvedDuration = 3500
      else resolvedDuration = 3000
    }
    var container = ensureToastContainer()
    var toast = document.createElement('div')
    toast.className = 'cosmos-toast toast-' + toastType

    var msg = document.createElement('span')
    msg.textContent = message == null ? '' : String(message)

    var closeBtn = document.createElement('button')
    closeBtn.className = 'cosmos-toast-close'
    closeBtn.type = 'button'
    closeBtn.setAttribute('aria-label', 'Dismiss notification')
    closeBtn.innerHTML = '&times;'
    closeBtn.addEventListener('click', function() { removeToastNode(toast) })

    var row = document.createElement('div')
    row.style.display = 'flex'
    row.style.alignItems = 'flex-start'
    row.style.justifyContent = 'space-between'
    row.style.gap = '8px'
    row.appendChild(msg)
    row.appendChild(closeBtn)

    toast.appendChild(row)

    var bar = document.createElement('div')
    bar.className = 'cosmos-toast-bar'
    bar.style.width = '100%'
    toast.appendChild(bar)
    container.appendChild(toast)

    if (resolvedDuration > 0) {
      requestAnimationFrame(function() {
        bar.style.transitionDuration = resolvedDuration + 'ms'
        bar.style.width = '0%'
      })
      setTimeout(function() { removeToastNode(toast) }, resolvedDuration)
    }
    return toast
  }

  window.cosmosToastSuccess = function(msg) { return window.cosmosToast(msg, 'success', 3500) }
  window.cosmosToastError = function(msg) { return window.cosmosToast(msg, 'error', 0) }
  window.cosmosToastWarn = function(msg) { return window.cosmosToast(msg, 'warn', 5000) }
  window.cosmosToastInfo = function(msg) { return window.cosmosToast(msg, 'info', 3000) }

  window.cosmosFieldError = function(inputEl, message) {
    if (!inputEl) return
    inputEl.classList.add('field-error')
    inputEl.classList.remove('field-ok')
    var host = inputEl.parentElement || inputEl
    var existing = host.querySelector('.field-error-msg')
    if (existing) existing.remove()
    var msg = document.createElement('span')
    msg.className = 'field-error-msg'
    msg.textContent = message || 'Invalid value'
    inputEl.insertAdjacentElement('afterend', msg)
  }

  window.cosmosFieldClear = function(inputEl) {
    if (!inputEl) return
    inputEl.classList.remove('field-error', 'field-ok')
    var host = inputEl.parentElement || inputEl
    var msg = host.querySelector('.field-error-msg')
    if (msg) msg.remove()
  }

  window.cosmosFieldOk = function(inputEl) {
    if (!inputEl) return
    inputEl.classList.remove('field-error')
    inputEl.classList.add('field-ok')
    var host = inputEl.parentElement || inputEl
    var msg = host.querySelector('.field-error-msg')
    if (msg) msg.remove()
  }

  window.cosmosCountUp = function(el, targetValue, durationMs) {
    if (!el || targetValue == null || Number.isNaN(Number(targetValue))) return
    var d = Number(durationMs) > 0 ? Number(durationMs) : 600
    var start = performance.now()
    var from = 0
    var to = Number(targetValue)
    var isCurrency = el.dataset && el.dataset.format === 'currency'
    var decimalPlaces = 0
    var valueStr = String(targetValue)
    if (valueStr.indexOf('.') >= 0) decimalPlaces = Math.min(2, valueStr.split('.')[1].length)

    function formatNumber(v) {
      if (isCurrency) return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces })
      return v.toLocaleString('en-IN', { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces })
    }

    function tick(now) {
      var elapsed = now - start
      var progress = Math.min(elapsed / d, 1)
      var eased = 1 - Math.pow(1 - progress, 3)
      var raw = from + (to - from) * eased
      var current = decimalPlaces > 0 ? Number(raw.toFixed(decimalPlaces)) : Math.round(raw)
      el.textContent = formatNumber(current)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  window.cosmosApplyPolish = function(rootNode) {
    var root = rootNode && rootNode.querySelectorAll ? rootNode : document
    var rows = root.querySelectorAll('tbody tr[onclick]')
    for (var i = 0; i < rows.length; i++) rows[i].classList.add('tr-link')
  }

  if (!window._cosmosPolishObserver && typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var mutation = mutations[i]
        if (mutation.addedNodes && mutation.addedNodes.length) {
          for (var j = 0; j < mutation.addedNodes.length; j++) {
            var node = mutation.addedNodes[j]
            if (node && node.nodeType === 1) window.cosmosApplyPolish(node)
          }
        }
      }
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })
    window._cosmosPolishObserver = observer
  }

  if (!window.cosmosShowError) {
    window.cosmosShowError = function(err) {
      var msg = err && err.message ? err.message : String(err || 'Something went wrong')
      if (window.cosmosToastError) window.cosmosToastError(msg)
      else window.alert(msg)
    }
  }

  if (!window._cosmosNativeAlert && typeof window.alert === 'function') {
    window._cosmosNativeAlert = window.alert.bind(window)
    window.alert = function(message) {
      if (window.cosmosToastError) {
        window.cosmosToastError(message == null ? '' : String(message))
        return
      }
      window._cosmosNativeAlert(message)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      window.cosmosApplyPolish(document)
    })
  } else {
    window.cosmosApplyPolish(document)
  }
})()

// ═══════════════════════════════════════════════════════════════════════════
// Order Timeline — shared modal (works in Foundry, StorePilot, POS)
// ═══════════════════════════════════════════════════════════════════════════
;(function () {
  // Full canonical workflow — used to render the progress track
  var TIMELINE_STEPS = [
    { key: 'ORDER_PLACED',         label: 'Placed' },
    { key: 'ADVANCE_PAID',         label: 'Accepted' },
    { key: 'SENT_TO_LAB',          label: 'Sent to Lab' },
    { key: 'LAB_FITTING',          label: 'Fitting & Edging' },
    { key: 'QC_PASS',              label: 'QC Pass' },
    { key: 'QC_FAIL_LAB',          label: 'QC Fail' },
    { key: 'DISPATCHED_TO_STORE',  label: 'Dispatched' },
    { key: 'RECEIVED_AT_STORE',    label: 'At Store' },
    { key: 'STORE_QC_PASS',        label: 'Store QC' },
    { key: 'READY_FOR_DELIVERY',   label: 'Ready' },
    { key: 'DELIVERED',            label: 'Delivered' },
    { key: 'BALANCE_COLLECTED',    label: 'Paid' },
    { key: 'INVOICED',             label: 'Invoiced' }
  ]

  var FAIL_STATUSES = new Set(['QC_FAIL_LAB', 'QC_FAIL_STORE', 'STORE_QC_PARTIAL'])

  function fmtIST(raw) {
    if (!raw) return '—'
    try {
      return new Date(raw).toLocaleString('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false
      })
    } catch (e) { return String(raw) }
  }

  function statusLabel(key) {
    for (var i = 0; i < TIMELINE_STEPS.length; i++) {
      if (TIMELINE_STEPS[i].key === key) return TIMELINE_STEPS[i].label
    }
    return String(key || '').replace(/_/g, ' ')
  }

  function injectOverlay() {
    if (document.getElementById('cosmos-timeline-overlay')) return
    var el = document.createElement('div')
    el.id = 'cosmos-timeline-overlay'
    el.className = 'cosmos-timeline-modal-overlay'
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-modal', 'true')
    el.setAttribute('aria-labelledby', 'cosmos-tl-modal-title')
    el.innerHTML = [
      '<div class="cosmos-timeline-modal">',
      '  <div class="cosmos-timeline-modal-header">',
      '    <div class="cosmos-timeline-modal-title" id="cosmos-tl-modal-title">Order Timeline</div>',
      '    <button class="cosmos-timeline-modal-close" onclick="window.cosmosTimelineClose()" aria-label="Close">&times;</button>',
      '  </div>',
      '  <div class="cosmos-timeline-modal-body" id="cosmos-tl-modal-body">',
      '    <div style="text-align:center;padding:24px;color:var(--text3)">Loading…</div>',
      '  </div>',
      '</div>'
    ].join('')
    el.addEventListener('click', function (e) {
      if (e.target === el) window.cosmosTimelineClose()
    })
    document.body.appendChild(el)
  }

  window.cosmosTimelineClose = function () {
    var ol = document.getElementById('cosmos-timeline-overlay')
    if (ol) ol.classList.remove('open')
  }

  window.cosmosTimelineOpen = async function (orderId, orderNo) {
    injectOverlay()
    var overlay = document.getElementById('cosmos-timeline-overlay')
    var body    = document.getElementById('cosmos-tl-modal-body')
    var title   = document.getElementById('cosmos-tl-modal-title')
    if (!overlay || !body) return
    if (title) title.textContent = 'Timeline — ' + (orderNo || ('#' + orderId))
    body.innerHTML = '<div style="text-align:center;padding:28px;color:var(--text3)">Loading…</div>'
    overlay.classList.add('open')

    try {
      // Use page-specific apiGet if available, else fetch directly
      var data
      var token = (sessionStorage.getItem('cosmos_token') || localStorage.getItem('cosmos_token') || '')
      var headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = 'Bearer ' + token
      // Attach X-API-Key from whichever global the host page set (API_KEY / SP_API_KEY)
      var apiKey = (typeof API_KEY !== 'undefined' && API_KEY ? API_KEY : '')
                 || (typeof SP_API_KEY !== 'undefined' && SP_API_KEY ? SP_API_KEY : '')
      if (apiKey) headers['X-API-Key'] = apiKey
      var r = await fetch('/api/orders/' + orderId + '/timeline', { headers: headers })
      if (!r.ok) { var errJson = await r.json(); throw new Error(errJson.message || 'Request failed') }
      var json = await r.json()
      data = json && json.data ? json.data : []

      if (!data.length) {
        body.innerHTML = '<div style="text-align:center;padding:28px;color:var(--text3)">No timeline events recorded yet.</div>'
        return
      }

      // Determine which steps are done / current from the log
      var doneKeys = new Set()
      data.forEach(function (e) { if (e.to_status) doneKeys.add(e.to_status) })
      var lastStatus = data[data.length - 1].to_status

      // Build progress track
      var trackHTML = '<div class="cosmos-timeline-track">'
      // Only show steps that are relevant (done or after last done in canonical list)
      var lastDoneIdx = -1
      for (var i = 0; i < TIMELINE_STEPS.length; i++) {
        if (doneKeys.has(TIMELINE_STEPS[i].key)) lastDoneIdx = i
      }
      var showSteps = TIMELINE_STEPS.slice(0, Math.min(lastDoneIdx + 3, TIMELINE_STEPS.length))
      showSteps.forEach(function (step) {
        var isDone    = doneKeys.has(step.key) && step.key !== lastStatus
        var isCurrent = step.key === lastStatus
        var isFail    = isCurrent && FAIL_STATUSES.has(step.key)
        var cls = isFail ? 'fail' : isCurrent ? 'current' : isDone ? 'done' : ''
        var dotContent = isDone ? '✓' : (isCurrent ? '●' : '')
        trackHTML += '<div class="cosmos-tl-step ' + cls + '">'
        trackHTML += '<div class="cosmos-tl-dot">' + dotContent + '</div>'
        trackHTML += '<div class="cosmos-tl-label">' + step.label + '</div>'
        trackHTML += '</div>'
      })
      trackHTML += '</div>'

      // Build log entries (newest first toggle? No — keep chronological for analysis)
      var logHTML = '<div class="cosmos-timeline-log">'
      data.forEach(function (entry) {
        var isFail = FAIL_STATUSES.has(entry.to_status)
        var dotCls = isFail ? 'fail' : ''
        var arrow  = entry.from_status
          ? statusLabel(entry.from_status) + ' → ' + statusLabel(entry.to_status)
          : statusLabel(entry.to_status)
        var actor  = entry.actor_name
          ? (entry.actor_name + (entry.actor_role ? ' (' + entry.actor_role + ')' : ''))
          : 'System'
        logHTML += '<div class="cosmos-tl-entry">'
        logHTML += '<div class="cosmos-tl-entry-dot ' + dotCls + '"></div>'
        logHTML += '<div class="cosmos-tl-entry-body">'
        logHTML += '<div class="cosmos-tl-entry-title">' + arrow + '</div>'
        logHTML += '<div class="cosmos-tl-entry-meta">' + fmtIST(entry.created_at) + ' &nbsp;·&nbsp; ' + actor + '</div>'
        if (entry.note) {
          logHTML += '<div class="cosmos-tl-entry-note">' + entry.note + '</div>'
        }
        logHTML += '</div></div>'
      })
      logHTML += '</div>'

      body.innerHTML = trackHTML + logHTML
    } catch (err) {
      body.innerHTML = '<div style="color:var(--red,#dc2626);padding:16px">' + (err.message || 'Failed to load timeline.') + '</div>'
    }
  }

  /** Mirrors server isRbacStrictEmptyPermissions — default true until bootstrap runs. */
  window.cosmosRbacStrictEmptyPerms = function () {
    if (typeof window.__COSMOS_RBAC_STRICT_EMPTY_PERMS === 'boolean') {
      return window.__COSMOS_RBAC_STRICT_EMPTY_PERMS
    }
    try {
      var s = sessionStorage.getItem('cosmos_rbac_strict_empty_perms')
      if (s === '1') return true
      if (s === '0') return false
    } catch (_) {}
    return true
  }

  window.cosmosLoadRbacBootstrap = async function () {
    if (window.__COSMOS_RBAC_BOOTSTRAP_LOADED) return
    try {
      var res = await fetch('/config/bootstrap.json')
      var j = await res.json()
      var data = j && j.data ? j.data : {}
      var strict = !!data.rbacStrictEmptyPermissions
      window.__COSMOS_RBAC_STRICT_EMPTY_PERMS = strict
      try {
        sessionStorage.setItem('cosmos_rbac_strict_empty_perms', strict ? '1' : '0')
      } catch (_) {}
    } catch (_) {
      window.__COSMOS_RBAC_STRICT_EMPTY_PERMS = true
      try {
        sessionStorage.setItem('cosmos_rbac_strict_empty_perms', '1')
      } catch (_) {}
    }
    window.__COSMOS_RBAC_BOOTSTRAP_LOADED = true
  }

  /**
   * Value for X-API-Key — always aligned with /config/bootstrap.json (server API_KEY),
   * then mirrored to sessionStorage. Session alone is not trusted so keys stay valid after .env changes.
   */
  window.cosmosEnsureApiKey = async function cosmosEnsureApiKey() {
    try {
      var res = await fetch('/config/bootstrap.json', { cache: 'no-store' })
      var text = await res.text()
      var data
      try {
        data = JSON.parse(text)
      } catch (_) {
        throw new Error('Configuration response was not JSON.')
      }
      if (!res.ok || !data.success) {
        throw new Error((data && data.message) || 'Could not load app configuration.')
      }
      var key = data.data && data.data.apiKey ? String(data.data.apiKey).trim() : ''
      if (!key) {
        throw new Error('API_KEY is not set on the server. Add API_KEY to .env (see .env.example).')
      }
      try {
        sessionStorage.setItem('cosmos_api_key', key)
      } catch (_) {}
      return key
    } catch (err) {
      try {
        var k = sessionStorage.getItem('cosmos_api_key')
        if (k && String(k).trim()) return String(k).trim()
      } catch (_) {}
      throw err
    }
  }
})()
