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
