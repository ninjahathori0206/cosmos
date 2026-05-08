(function initPosApp() {
  'use strict'
  document.addEventListener('DOMContentLoaded', async function onPosDomReady() {

  document.body.classList.add('pos-target-tablet-landscape')

  // ── Session helpers ──────────────────────────────────────────────────────
  /** Mirrors main login.js: tablet/PIN flow never hits /login, so key may be missing until bootstrap. */
  let apiKeyBootstrapPromise = null
  function getApiKey() {
    return sessionStorage.getItem('cosmos_api_key') || ''
  }
  async function ensureCosmosApiKeyFromBootstrap() {
    if (getApiKey()) return
    if (!apiKeyBootstrapPromise) {
      apiKeyBootstrapPromise = (async function fetchBootstrapApiKey() {
        try {
          const res = await fetch('/config/bootstrap.json')
          const body = await res.json()
          const key = body && body.data && body.data.apiKey
          if (key && typeof key === 'string' && key.length) {
            sessionStorage.setItem('cosmos_api_key', key)
          }
        } catch (_e) {
          /* offline or misconfigured — callers surface API errors */
        }
      })()
    }
    await apiKeyBootstrapPromise
  }

  await ensureCosmosApiKeyFromBootstrap()

  const POS_SESSION_KEY = 'pos_session'
  /** SessionStorage flag: show welcome toast once on catalogue after PIN login */
  const POS_CATALOGUE_WELCOME_ONCE = 'pos_catalogue_welcome_once'
  const POS_CART_KEY    = 'pos_cart'
  const POS_TABLET_TOKEN_KEY = 'pos_tablet_token'

  function getPosSession() {
    try { return JSON.parse(sessionStorage.getItem(POS_SESSION_KEY) || 'null') } catch { return null }
  }

  function savePosSession(data) {
    sessionStorage.setItem(POS_SESSION_KEY, JSON.stringify(data))
  }

  function clearPosSession() {
    sessionStorage.removeItem(POS_SESSION_KEY)
  }

  function saveCart() {
    try { localStorage.setItem(POS_CART_KEY, JSON.stringify(obCart)) } catch (_e) { /* storage unavailable */ }
  }

  function loadSavedCart() {
    try {
      const raw = localStorage.getItem(POS_CART_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) obCart = parsed
    } catch (_e) { /* corrupt data — ignore */ }
  }

  function clearCartStorage() {
    try { localStorage.removeItem(POS_CART_KEY) } catch (_e) { /* ignore */ }
  }

  // ── Generic API fetch ────────────────────────────────────────────────────
  async function apiGet(path, token) {
    await ensureCosmosApiKeyFromBootstrap()
    const headers = { 'X-API-Key': getApiKey() }
    if (token) headers['Authorization'] = 'Bearer ' + token
    const res = await fetch(path, { headers })
    const body = await res.json()
    if (!res.ok || !body.success) throw new Error(body.message || 'Request failed')
    return body.data
  }

  async function publicGet(path) {
    await ensureCosmosApiKeyFromBootstrap()
    const headers = {}
    const k = getApiKey()
    if (k) headers['X-API-Key'] = k
    const res = await fetch(path, { headers })
    const body = await res.json()
    if (!res.ok || !body.success) throw new Error(body.message || 'Request failed')
    return body.data
  }

  /** Decode JWT payload (no signature verify) — client-only store_id / exp check for tablet session. */
  function decodeJwtPayloadUnverified(token) {
    try {
      const parts = String(token || '').split('.')
      if (parts.length < 2) return null
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
      const json = atob(b64 + pad)
      return JSON.parse(json)
    } catch (_e) {
      return null
    }
  }

  function getPosTabletToken() {
    return sessionStorage.getItem(POS_TABLET_TOKEN_KEY) || ''
  }

  function isTabletJwtPayloadValid(p) {
    if (!p || p.tablet_session !== true) return false
    const exp = Number(p.exp)
    if (!Number.isFinite(exp) || Date.now() / 1000 > exp - 15) return false
    return true
  }

  /** Valid tablet JWT → bound store id, else null (no token / wrong shape / expired). */
  function getTabletJwtStoreId() {
    const p = decodeJwtPayloadUnverified(getPosTabletToken())
    if (!isTabletJwtPayloadValid(p)) return null
    const sid = Number(p.store_id)
    return Number.isFinite(sid) && sid > 0 ? sid : null
  }

  function isTabletSessionValidForStore(storeId) {
    const jwtSid = getTabletJwtStoreId()
    if (jwtSid == null) return false
    return Number(storeId) === Number(jwtSid)
  }

  function clearPosTabletToken() {
    try {
      sessionStorage.removeItem(POS_TABLET_TOKEN_KEY)
    } catch (_e) { /* ignore */ }
  }

  async function publicPost(path, payload) {
    await ensureCosmosApiKeyFromBootstrap()
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': getApiKey() },
      body: JSON.stringify(payload || {})
    })
    const body = await res.json()
    if (!res.ok || !body.success) throw new Error(body.message || 'Request failed')
    return body
  }

  async function apiPost(path, payload, token) {
    await ensureCosmosApiKeyFromBootstrap()
    const headers = { 'Content-Type': 'application/json', 'X-API-Key': getApiKey() }
    if (token) headers['Authorization'] = 'Bearer ' + token
    const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(payload) })
    const body = await res.json()
    if (!res.ok || !body.success) throw new Error(body.message || 'Request failed')
    return body
  }

  async function apiPut(path, payload, token) {
    await ensureCosmosApiKeyFromBootstrap()
    const headers = { 'Content-Type': 'application/json', 'X-API-Key': getApiKey() }
    if (token) headers['Authorization'] = 'Bearer ' + token
    const res = await fetch(path, { method: 'PUT', headers: headers, body: JSON.stringify(payload || {}) })
    const body = await res.json()
    if (!res.ok || !body.success) throw new Error(body.message || 'Request failed')
    return body
  }

  async function staffPinLogin(pin) {
    await ensureCosmosApiKeyFromBootstrap()
    const tabletTok = getPosTabletToken()
    const res = await fetch('/api/pos/staff-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': getApiKey(),
        'X-Tablet-Token': tabletTok
      },
      body: JSON.stringify({ pin: pin })
    })
    const body = await res.json()
    if (!res.ok || !body.success) throw new Error(body.message || 'Request failed')
    return body
  }

  // ── Sidebar ────────────────────────────────────────────────────────────────
  var posSidebar = null

  function getSidebar() {
    if (!posSidebar) posSidebar = document.getElementById('pos-sidebar')
    return posSidebar
  }

  /** Map screen IDs to the sidebar nav key that should be highlighted. */
  var SCREEN_TO_SB_NAV = {
    'screen-pos-catalogue':     'catalogue',
    'screen-pos-product':       'catalogue',
    'screen-pos-order-builder': 'new-order',
    'screen-pos-customer':      'new-order',
    'screen-pos-lens':          'new-order',
    'screen-pos-payment':       'new-order',
    'screen-pos-confirm':       'new-order',
    'screen-pos-orders':        'orders',
    'screen-pos-set-pin':       'set-pin'
  }

  /** Show/hide the sidebar and set the active nav item. */
  function updateSidebar(screenId) {
    var sb = getSidebar()
    if (!sb) return
    var navKey = SCREEN_TO_SB_NAV[screenId]
    var hasSidebar = Boolean(navKey)
    if (hasSidebar) {
      sb.hidden = false
      document.body.classList.add('pos-has-sidebar')
      sb.querySelectorAll('.pos-sb-item[data-pos-sb-nav]').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-pos-sb-nav') === navKey)
      })
      syncSidebarSession()
    } else {
      sb.hidden = true
      document.body.classList.remove('pos-has-sidebar')
    }
  }

  /** Populate sidebar avatar + staff/store labels from session. */
  function syncSidebarSession() {
    var s = getPosSession()
    var letter = (s && s.name && String(s.name).trim()) ? String(s.name).trim().charAt(0).toUpperCase() : 'T'
    var sbLetter = document.getElementById('pos-sb-avatar-letter')
    var sbName   = document.getElementById('pos-sb-staff-name')
    var sbStore  = document.getElementById('pos-sb-store-label')
    if (sbLetter) sbLetter.textContent = letter
    if (sbName)   sbName.textContent   = (s && s.name)       ? s.name       : ''
    if (sbStore)  sbStore.textContent  = (s && s.store_name) ? s.store_name : ''
  }

  // ── Screen navigation (internal — callers use navigate()) ───────────────
  function showScreen(id) {
    closeAllPosLensOverlays()
    if (id !== 'screen-login-tablet' && id !== 'screen-login-staff') {
      document.documentElement.removeAttribute('data-pos-login-step')
    }
    document.querySelectorAll('.pos-screen').forEach(function (el) { el.classList.remove('active') })
    var target = document.getElementById(id)
    if (target) target.classList.add('active')
    document.body.classList.toggle('pos-store-login-shell', id === 'screen-login-tablet' || id === 'screen-login-staff')
    var lkFlowScreens = {
      'screen-pos-catalogue': true,
      'screen-pos-product': true,
      'screen-pos-order-builder': true,
      'screen-pos-customer': true,
      'screen-pos-lens': true,
      'screen-pos-payment': true,
      'screen-pos-confirm': true
    }
    document.body.classList.toggle('pos-lk-flow', Boolean(lkFlowScreens[id]))
    updateSidebar(id)
    if (lkFlowScreens[id]) syncLkAvatarFromSession()
  }

  function syncLkAvatarFromSession() {
    var s = getPosSession()
    var letter = (s && s.name && String(s.name).trim()) ? String(s.name).trim().charAt(0).toUpperCase() : 'T'
    document.querySelectorAll('.pos-lk-avatar-letter').forEach(function (el) { el.textContent = letter })
  }

  // ── SPA routing ──────────────────────────────────────────────────────────
  const POS_ROUTES = {
    LOGIN:       '/storeos/login',
    LOGIN_STAFF: '/storeos/login/staff',
    DASHBOARD: '/storeos/dashboard',
    CATALOGUE: '/storeos/catalogue',
    /** Product detail — canonical form is /storeos/product/:productId/:skuId */
    PRODUCT:   '/storeos/product',
    CUSTOMER:  '/storeos/customer',
    ORDER:     '/storeos/cart',
    LENS:      '/storeos/lens-config',
    PAYMENT:   '/storeos/payment',
    CONFIRM:   '/storeos/confirm',
    ORDERS:    '/storeos/orders',
    SET_PIN:   '/storeos/set-pin'
  }

  function productRoute(productId, skuId) {
    return '/storeos/product/' + productId + '/' + skuId
  }

  /** Alternate paths → canonical (Pencil / marketing URLs, spelling variants). */
  const POS_PATH_ALIASES = {
    '/pos': POS_ROUTES.LOGIN,
    '/storeos': POS_ROUTES.LOGIN,
    '/pos/login': POS_ROUTES.LOGIN,
    '/pos/login/staff': POS_ROUTES.LOGIN_STAFF,
    '/storeos/login/staff': POS_ROUTES.LOGIN_STAFF,
    '/pos/dashboard': POS_ROUTES.DASHBOARD,
    '/pos/session': POS_ROUTES.CATALOGUE,
    '/storeos/session': POS_ROUTES.CATALOGUE,
    '/storeos/staff-ready': POS_ROUTES.CATALOGUE,
    '/pos/staff-ready': POS_ROUTES.CATALOGUE,
    '/pos/catelogue': POS_ROUTES.CATALOGUE,
    '/pos/catalog': POS_ROUTES.CATALOGUE,
    '/storeos/catelogue': POS_ROUTES.CATALOGUE,
    '/storeos/catalog': POS_ROUTES.CATALOGUE,
    '/storeos/order': POS_ROUTES.ORDER,
    '/pos/set-pin': POS_ROUTES.SET_PIN,
    '/storeos/set-pin': POS_ROUTES.SET_PIN
  }

  function normalizePosPath(rawPath) {
    const p = (rawPath || '').replace(/\/+$/, '') || POS_ROUTES.LOGIN
    return POS_PATH_ALIASES[p] || p
  }

  function navigate(path) {
    history.pushState({}, '', path)
    resolve(path)
  }

  function isSessionValid(session) {
    if (!session || !session.token || !session.logged_in_at) return false
    const eightHoursMs = 8 * 60 * 60 * 1000
    return (Date.now() - new Date(session.logged_in_at).getTime()) < eightHoursMs
  }

  function resolve(pathname) {
    const raw = (pathname != null ? pathname : window.location.pathname).replace(/\/+$/, '') || POS_ROUTES.LOGIN
    const path = normalizePosPath(raw)
    if (path !== raw) {
      history.replaceState({}, '', path)
    }
    const session = getPosSession()
    const valid = isSessionValid(session)

    // Alias dashboard deep links to the live catalogue screen.
    if (path === POS_ROUTES.DASHBOARD) {
      navigate(POS_ROUTES.CATALOGUE)
      return
    }

    if (path === POS_ROUTES.SET_PIN) {
      if (!valid) { navigate(POS_ROUTES.LOGIN); return }
      resetPosSetPinScreen()
      showScreen('screen-pos-set-pin')
      return
    }

    if (path === POS_ROUTES.CATALOGUE) {
      if (!valid) { navigate(POS_ROUTES.LOGIN); return }
      void showCatalogueScreen(session)
      return
    }

    if (path === POS_ROUTES.CUSTOMER) {
      if (!valid) { navigate(POS_ROUTES.LOGIN); return }
      void (async function posCustomerRoute() {
        await showOrderBuilderScreenResume(session)
        if (window.history && window.history.replaceState) {
          history.replaceState({}, '', POS_ROUTES.ORDER)
        }
        openPosCustomerPickerModal()
      })()
      return
    }

    const productPathMatch = path.match(/^\/storeos\/product\/([^/]+)\/([^/]+)$/)
    if (productPathMatch || path === POS_ROUTES.PRODUCT) {
      if (!valid) { navigate(POS_ROUTES.LOGIN); return }
      if (productPathMatch) {
        const pId = Number(productPathMatch[1])
        const sId = Number(productPathMatch[2])
        const already = pendingOrderSelection
        if (already && already.product && already.product.product_id === pId && already.colour && already.colour.sku_id === sId) {
          void showProductPageScreen(session)
        } else {
          void resolveProductByIds(session, pId, sId)
        }
        return
      }
      void showProductPageScreen(session)
      return
    }

    if (path === POS_ROUTES.ORDER) {
      if (!valid) { navigate(POS_ROUTES.LOGIN); return }
      if (pendingResumeOrder) {
        pendingResumeOrder = false
        void (async function posOrderResumeFlag() { await showOrderBuilderScreenResume(session) })()
        return
      }
      if (obCart.length > 0) {
        void (async function posOrderCart() { await showOrderBuilderScreenResume(session) })()
        return
      }
      if (!pendingOrderSelection) {
        void (async function posOrderEmpty() { await showOrderBuilderScreenResume(session) })()
        return
      }
      void (async function posOrderWithSelection() {
        await showOrderBuilderScreen(session, pendingOrderSelection)
      })()
      return
    }

    if (path === POS_ROUTES.LENS) {
      if (!valid) { navigate(POS_ROUTES.LOGIN); return }
      if (lensWizardLineIdx < 0) { navigate(POS_ROUTES.ORDER); return }
      void showLensWizardScreen(session)
      return
    }

    if (path === POS_ROUTES.PAYMENT) {
      if (!valid) { navigate(POS_ROUTES.LOGIN); return }
      if (!lastCreatedOrder) { navigate(POS_ROUTES.ORDER); return }
      void showPaymentScreen(session)
      return
    }

    if (path === POS_ROUTES.CONFIRM) {
      if (!valid) { navigate(POS_ROUTES.LOGIN); return }
      if (!lastPaymentReceipt) { navigate(POS_ROUTES.CATALOGUE); return }
      showConfirmScreen()
      return
    }

    if (path === POS_ROUTES.ORDERS) {
      if (!valid) { navigate(POS_ROUTES.LOGIN); return }
      void showOrderHistoryScreen(session)
      return
    }

    if (path === POS_ROUTES.LOGIN_STAFF) {
      if (valid) { navigate(POS_ROUTES.CATALOGUE); return }
      if (session) clearPosSession()
      if (getTabletJwtStoreId() == null) {
        history.replaceState({}, '', POS_ROUTES.LOGIN)
        resolve(POS_ROUTES.LOGIN)
        return
      }
      showScreen('screen-login-staff')
      resetPin(false)
      tabletPinDigits = []
      pinDigits = []
      resetTabletPin(false)
      loadStores().then(function () {
        syncStaffLoginStoreLine()
      })
      return
    }

    // /pos, /pos/login, or any unrecognised path → login (tablet unlock first)
    // If session is still valid, open catalogue (e.g. tab restore)
    if (valid) { navigate(POS_ROUTES.CATALOGUE); return }
    if (session) clearPosSession()
    showScreen('screen-login-tablet')
    if (getTabletJwtStoreId() != null) {
      history.replaceState({}, '', POS_ROUTES.LOGIN_STAFF)
      resolve(POS_ROUTES.LOGIN_STAFF)
      return
    }
    loadStores()
  }

  window.addEventListener('popstate', () => resolve())

  // ── Format role key for display ──────────────────────────────────────────
  function formatRole(roleKey) {
    return String(roleKey || '')
      .replace(/_/g, ' ')
      .toUpperCase()
  }

  // ── Format time ──────────────────────────────────────────────────────────
  function formatTime(date) {
    return date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LOGIN SCREEN
  // ═══════════════════════════════════════════════════════════════════════

  // ── State ────────────────────────────────────────────────────────────────
  let selectedStoreId   = null
  let selectedStoreName = ''
  let pinDigits         = []
  let tabletPinDigits   = []
  /** Stores list cache for staff-login store label — filled in loadStores. */
  let cachedPosStores   = []
  let posSetPinNew      = []
  let posSetPinConfirm  = []
  let posSetPinPhase    = 'new'
  const PIN_LENGTH      = 4
  let activeCatalogueScope = 'store'
  let selectedProductId = null
  let searchDebounceTimer = null
  let pendingOrderSelection = null
  let pendingResumeOrder = false
  let posSelectedCustomerId = null
  let posCartOffers = []
  /** Staff-selected Eyewoot Go offer for this bill (`null` = no promo discount applied). At most one. */
  let posSelectedOfferId = null
  let posServerDiscountPreview = null
  let posServerDiscountPreviewTimer = null
  let posDiscountPreviewSeq = 0
  /** Selected POS / CX customer row for cart reference (name, phone, id). */
  let posSelectedCustomerSnapshot = null
  let posSettings = { gst_rate: 0.05, lab_advance_pct: 40, composition_scheme: false, prices_gst_inclusive: false }
  let lensCatalogData = null
  let lensWizardLineIdx = -1
  let lensWizardBackRoute = POS_ROUTES.ORDER
  let lensWizard = {
    step: 0,
    subPhase: 'profile',
    brandFilter: 'all',
    powerType: null,
    category: null,
    pkg: null,
    addonIds: [],
    powerMode: null,
    rx: { od: { sph: '', cyl: '', axis: '', plano: false }, os: { sph: '', cyl: '', axis: '', plano: false }, pd: '', doctor: '' }
  }

  var __posLkModalScrollLocks = 0
  function posLkLockModalScroll() {
    __posLkModalScrollLocks++
    if (__posLkModalScrollLocks === 1) document.body.classList.add('pos-lk-modal-scroll-lock')
  }
  function posLkUnlockModalScroll() {
    if (__posLkModalScrollLocks < 1) return
    __posLkModalScrollLocks--
    if (__posLkModalScrollLocks === 0) document.body.classList.remove('pos-lk-modal-scroll-lock')
  }

  /** Coerce wizard step to 0–2 so strict === checks in navigation never silently fail. */
  function syncLensWizardStepNumber() {
    var s = Number(lensWizard.step)
    if (!Number.isFinite(s)) lensWizard.step = 0
    else lensWizard.step = Math.max(0, Math.min(2, Math.floor(s)))
  }

  /** Cart line for lens wizard — prefer lensWizardLineIdx, else first incomplete LAB line. */
  function resolveLensWizardCartLine() {
    var idx = lensWizardLineIdx
    if (Number.isFinite(idx) && idx >= 0 && idx < obCart.length) return obCart[idx]
    var i = obCart.findIndex(function (l) {
      if (!l) return false
      var f = String(l.fulfillment || '').toUpperCase()
      var st = l.lab_status
      return f === 'LAB' && (!st || st === 'incomplete' || st === 'pending_power')
    })
    if (i >= 0) return obCart[i]
    return obCart.length ? obCart[0] : null
  }
  let lastCreatedOrder = null
  let lastPaymentReceipt = null
  let paySessionSnapshot = { stage: 'FULL', amount: 0 }
  let payMinimumAdvanceAmount = 0
  let payMinimumAdvancePct = 0
  let forceBalanceSettlement = false
  /** StoreOS lab handover modal (balance + invoice snapshot). */
  let _posHandoverCtx = null
  let _posHandoverSuccessCtx = null
  let _posHandoverSubmitting = false
  /** Lab handover: cached payload for reopening invoice preview inside the POS shell. */
  let _posHandoverInvoicePreviewLast = null
  let posDeliveryMode = 'STORE'

  // ── Order Builder state ──────────────────────────────────────────────────
  let obCart = []

  // Pencil 02-power-type — five power options shown in the Lens wizard step 0.
  // Each maps to the closest catalogue category by `match` (substring match
  // against the category name). When `match` is null (e.g. Frame Only) the
  // wizard skips lens selection entirely.
  // wizard entries are now fully dynamic from /api/pos/lens-catalog (wizard_entries).
  // POWER_TYPES is removed; findCategoryForPowerType is no longer used for step 0.

  // CSS tone → CSS variable class (no hex in JS per ui-polish rules)
  function lensWizardToneClass(tone) {
    var toneMap = { 0: 'pos-lk-pt-tone0', 1: 'pos-lk-pt-tone1', 2: 'pos-lk-pt-tone2', 3: 'pos-lk-pt-tone3', 4: 'pos-lk-pt-tone4', 5: 'pos-lk-pt-tone5' }
    return toneMap[Number(tone)] || 'pos-lk-pt-tone1'
  }

  /** Strip non-digits; drop leading 91 or trunk 0 — Indian mobiles as 10 digits. */
  function normalizeIndiaMobileDigits(raw) {
    var d = String(raw || '').replace(/\D/g, '')
    if (d.length === 12 && d.slice(0, 2) === '91') d = d.slice(2)
    if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1)
    return d
  }

  /** Validates POS customer-create phone; returns 10-digit mobile or error message. */
  function parsePosCustomerMobileForSave(raw) {
    var d = normalizeIndiaMobileDigits(raw)
    if (d.length !== 10) {
      return { ok: false, phone: '', message: 'Enter a valid 10-digit mobile number.' }
    }
    var first = d.charAt(0)
    if (first < '6' || first > '9') {
      return { ok: false, phone: '', message: 'Indian mobile numbers start with 6, 7, 8, or 9.' }
    }
    return { ok: true, phone: d, message: '' }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]
    })
  }

  function setPosCustomerSelection(customerId, fullName, phone) {
    const id = customerId != null ? Number(customerId) : NaN
    if (!Number.isNaN(id) && id > 0) {
      posSelectedOfferId = null
      posSelectedCustomerId = id
      posSelectedCustomerSnapshot = {
        customer_id: id,
        full_name: String(fullName || '').trim() || ('Customer #' + id),
        phone: phone != null ? String(phone).trim() : ''
      }
      lensWizard.customerName = posSelectedCustomerSnapshot.full_name
      const session = getPosSession()
      if (session && session.token) {
        void loadPosOffersPanel(session, 'pos-cart-coupon-list', null, false)
      }
      renderCartCustomerRef()
      return
    }
    posSelectedCustomerId = null
    posSelectedCustomerSnapshot = null
    lensWizard.customerName = null
    posCartOffers = []
    posSelectedOfferId = null
    const session = getPosSession()
    if (session && session.token) {
      void loadPosOffersPanel(session, 'pos-cart-coupon-list', null, false)
    } else {
      obRecalcTotals()
    }
  }

  function clearPosCustomerSelection() {
    posSelectedCustomerId = null
    posSelectedCustomerSnapshot = null
    lensWizard.customerName = null
    posCartOffers = []
    posSelectedOfferId = null
    const session = getPosSession()
    if (session && session.token) {
      void loadPosOffersPanel(session, 'pos-cart-coupon-list', null, false)
    } else {
      obRecalcTotals()
    }
    renderCartCustomerRef()
  }

  function fmtOfferDateIso(v) {
    if (!v) return '—'
    try {
      return new Date(v).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
    } catch (_e) {
      return '—'
    }
  }

  /** Normalise SQL/driver discount_value (number, string, or rare object shapes) to a finite number. */
  function coerceOfferDiscountRaw(raw) {
    if (raw == null || raw === '') return 0
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0
    if (typeof raw === 'string') {
      var s = raw.trim().replace(/,/g, '')
      var n = parseFloat(s)
      return Number.isFinite(n) ? n : 0
    }
    if (typeof raw === 'object' && raw !== null && 'value' in raw) {
      return coerceOfferDiscountRaw(raw.value)
    }
    var m = Number(raw)
    return Number.isFinite(m) ? m : 0
  }

  /** If Command Unit left discount_value at 0 but put "10%" in the title, recover the percent (max 100). */
  function parsePctFallbackFromTitle(title) {
    var m = String(title || '').match(/(\d+(?:\.\d+)?)\s*%/)
    if (!m) return 0
    var p = parseFloat(m[1])
    if (!Number.isFinite(p) || p < 0) return 0
    return Math.min(100, p)
  }

  function effectiveOfferPct(o) {
    var t = String(o.discount_type || '').trim().toUpperCase()
    if (t !== 'PCT') return 0
    var v = coerceOfferDiscountRaw(o.discount_value)
    if (v > 0) return Math.min(100, v)
    return parsePctFallbackFromTitle(o.title)
  }

  function effectiveOfferFlat(o) {
    var t = String(o.discount_type || '').trim().toUpperCase()
    if (t !== 'FLAT') return 0
    var v = coerceOfferDiscountRaw(o.discount_value)
    if (v > 0) return v
    return 0
  }

  /** Plus-only rows from /cart-offers without customer_id must not reduce walk-in totals. */
  function offerAppliesToCartContext(o) {
    if (!posSelectedCustomerId || posSelectedCustomerId < 1) {
      if (o.is_plus_only) return false
    }
    return true
  }

  function offerDiscountSummary(o) {
    const t = String(o.discount_type || '').trim().toUpperCase()
    if (t === 'PCT') {
      var p = effectiveOfferPct(o)
      return p + '% off'
    }
    if (t === 'FLAT') {
      var f = effectiveOfferFlat(o)
      return '₹' + f.toLocaleString('en-IN', { maximumFractionDigits: 0 }) + ' off'
    }
    if (t === 'FREEBIE') return 'Freebie'
    if (t === 'BOGO_LOWEST_FREE') return 'BOGO · lab eg + frame-only / lab pairs'
    if (t === 'BUY_FRAME_GET_LENS_FREE') return 'Lens value off (with frame)'
    if (t === 'BUY_LENS_GET_FRAME_FREE') return 'Frame value off (with lens)'
    return 'Promo'
  }

  function refreshPosOfferPickVisuals() {
    ;['pos-cart-coupon-list', 'pos-lk-pay-offers-list'].forEach(function (listId) {
      var root = document.getElementById(listId)
      if (!root) return
      root.querySelectorAll('button.pos-lk-offer-pick').forEach(function (btn) {
        var raw = btn.getAttribute('data-offer-id')
        var nid = raw === '' || raw == null ? null : Number(raw)
        var none = posSelectedOfferId == null || !Number.isFinite(Number(posSelectedOfferId)) || Number(posSelectedOfferId) < 1
        var sel = none ? nid == null : Number(posSelectedOfferId) === nid
        btn.classList.toggle('is-selected', sel)
        btn.setAttribute('aria-pressed', sel ? 'true' : 'false')
      })
    })
  }

  function invalidatePosOfferIfNotListed(offersArr) {
    if (posSelectedOfferId == null) return
    var id = Number(posSelectedOfferId)
    var ok = (offersArr || []).some(function (o) {
      return Number(o.offer_id) === id
    })
    if (ok) return
    posSelectedOfferId = null
    posServerDiscountPreview = null
    if (typeof cosmosToastInfo === 'function') {
      cosmosToastInfo('Previous offer no longer applies — choose an offer again if needed.')
    }
  }

  function wirePosOfferPickClicks(listEl, session) {
    if (!listEl || !session || !session.token) return
    listEl.querySelectorAll('button.pos-lk-offer-pick').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var raw = btn.getAttribute('data-offer-id')
        if (raw === '' || raw == null) posSelectedOfferId = null
        else {
          var nid = Number(raw)
          posSelectedOfferId = Number.isFinite(nid) && nid > 0 ? nid : null
        }
        posDiscountPreviewSeq++
        posServerDiscountPreview = null
        obRecalcTotals()
        void runServerDiscountPreview(session).finally(function () {
          refreshPosOfferPickVisuals()
          syncCartAppliedOfferCard()
          if (listEl.id === 'pos-cart-coupon-list') setCartCouponOverlayOpen(false)
        })
      })
    })
  }

  function renderCartCustomerRef() {
    const body = document.getElementById('pos-lk-cart-customer-body')
    if (!body) return
    const snap = posSelectedCustomerSnapshot
    if (snap && posSelectedCustomerId) {
      const phoneRow = snap.phone
        ? '<div class="pos-lk-cart-cust-row">' + escapeHtml(snap.phone) + '</div>'
        : ''
      body.innerHTML =
        '<div class="pos-lk-cart-cust-name">' + escapeHtml(snap.full_name) + '</div>' +
        phoneRow +
        '<div class="pos-lk-cart-cust-meta">Customer ID · ' + escapeHtml(String(snap.customer_id)) + '</div>' +
        '<button type="button" class="pos-lk-text-link" id="pos-cart-remove-customer" style="margin-top:10px;padding:0">Remove customer · walk-in</button>'
      const rm = document.getElementById('pos-cart-remove-customer')
      if (rm) {
        rm.addEventListener('click', function () {
          clearPosCustomerSelection()
          renderCartCustomerRef()
          if (typeof cosmosToastInfo === 'function') {
            cosmosToastInfo('Customer removed. Cart uses walk-in pricing and offers.')
          }
        })
      }
      return
    }
    body.innerHTML =
      '<div class="pos-lk-cart-cust-walkin-title">Walk-in</div>'
  }

  function selectedOfferMeta() {
    if (!posCartOffers || !posCartOffers.length) return null
    const id = Number(posSelectedOfferId || 0)
    if (!Number.isFinite(id) || id < 1) return null
    for (let i = 0; i < posCartOffers.length; i++) {
      if (Number(posCartOffers[i].offer_id) === id) return posCartOffers[i]
    }
    return null
  }

  function syncCartAppliedOfferCard() {
    if (!cardOfferApplied || !offerAppliedTitle || !offerAppliedSub || !btnCartApplyCoupon) return
    const selected = selectedOfferMeta()
    const discountText = obDiscountLine ? String(obDiscountLine.textContent || '').trim() : ''
    if (!selected) {
      btnCartApplyCoupon.hidden = false
      btnCartApplyCoupon.style.display = ''
      cardOfferApplied.hidden = true
      cardOfferApplied.style.display = 'none'
      offerAppliedTitle.textContent = 'Offer applied'
      offerAppliedSub.textContent = 'You are saving ₹0'
      return
    }
    btnCartApplyCoupon.hidden = true
    btnCartApplyCoupon.style.display = 'none'
    cardOfferApplied.hidden = false
    cardOfferApplied.style.display = 'flex'
    const title = String(selected.title || '').trim()
    offerAppliedTitle.textContent = (title || ('Offer #' + String(selected.offer_id))) + ' Applied'
    offerAppliedSub.textContent = (!discountText || discountText === '−₹0')
      ? 'Offer selected for this bill'
      : ('You are saving ' + discountText.replace(/^−/, ''))
  }

  async function loadPosOffersPanel(session, listId, hintId, forPayment) {
    const listEl = document.getElementById(listId)
    if (!listEl) return
    if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows(listId, 4)
    try {
      const q = posSelectedCustomerId ? ('?customer_id=' + encodeURIComponent(String(posSelectedCustomerId))) : ''
      const offers = await apiGet('/api/pos/cart-offers' + q, session.token)
      posCartOffers = Array.isArray(offers) ? offers : []
      invalidatePosOfferIfNotListed(posCartOffers)
      loadCartSkuScopeFacts(session)
      obRecalcTotals()
      if (!Array.isArray(offers) || !offers.length) {
        listEl.innerHTML = '<div class="pos-lk-offers-empty"><div class="pos-lk-offers-empty-title">No active offers</div><div class="pos-lk-offers-empty-sub">Try again after selecting a customer.</div></div>'
        wirePosOfferPickClicks(listEl, session)
        refreshPosOfferPickVisuals()
        syncCartBillBenefitBox()
        syncCartAppliedOfferCard()
        return
      }
      let filteredOffers = offers
      if (!forPayment && cartCouponSearchInput && cartCouponSearchInput.value.trim()) {
        const qf = cartCouponSearchInput.value.trim().toLowerCase()
        filteredOffers = offers.filter(function (o) {
          const title = String(o.title || '').toLowerCase()
          const desc = String(o.description || '').toLowerCase()
          return title.indexOf(qf) !== -1 || desc.indexOf(qf) !== -1
        })
      }
      let html = forPayment
        ? '<button type="button" class="pos-lk-offer-item pos-lk-offer-pick" data-offer-id="" aria-pressed="false" aria-label="Continue without an offer"><span class="pos-lk-offer-ico" aria-hidden="true">○</span><div class="pos-lk-offer-item-body"><div class="pos-lk-offer-item-title">Continue without an offer</div></div></button>'
        : ''
      if (!filteredOffers.length) {
        listEl.innerHTML = '<div class="pos-lk-offers-empty"><div class="pos-lk-offers-empty-title">No matching offers</div><div class="pos-lk-offers-empty-sub">Try another keyword.</div></div>'
        syncCartBillBenefitBox()
        syncCartAppliedOfferCard()
        return
      }
      for (let i = 0; i < filteredOffers.length; i++) {
        const o = filteredOffers[i]
        const plus = o.is_plus_only ? '<span class="pos-lk-offer-badge">Plus</span>' : ''
        const tier = o.eligible_tier ? '<span class="pos-lk-offer-tier">' + escapeHtml(String(o.eligible_tier)) + '+</span>' : ''
        const disc = offerDiscountSummary(o)
        const oid = o.offer_id != null ? Number(o.offer_id) : 0
        if (forPayment) {
          html +=
            '<button type="button" class="pos-lk-offer-item pos-lk-offer-pick" data-offer-id="' + String(oid) + '" aria-pressed="false">' +
            '<span class="pos-lk-offer-ico" aria-hidden="true">' + escapeHtml(o.icon_emoji || '🎁') + '</span>' +
            '<div class="pos-lk-offer-item-body">' +
            '<div class="pos-lk-offer-item-title">' + escapeHtml(o.title || '') + plus + tier + '</div>' +
            '<div class="pos-lk-offer-item-desc">' + escapeHtml(o.description || '') + '</div>' +
            (disc
              ? '<div class="pos-lk-offer-item-disc">' + escapeHtml(disc) + ' · valid till ' + escapeHtml(fmtOfferDateIso(o.valid_to)) + '</div>'
              : '<div class="pos-lk-offer-item-disc">Valid till ' + escapeHtml(fmtOfferDateIso(o.valid_to)) + '</div>') +
            '</div></button>'
        } else {
          html +=
            '<button type="button" class="pos-lk-offer-item pos-lk-offer-pick pos-cart-coupon-item" data-offer-id="' + String(oid) + '" aria-pressed="false">' +
            '<div class="pos-lk-offer-item-body">' +
            '<div class="pos-lk-offer-item-title">' + escapeHtml(o.title || '') + plus + tier + '</div>' +
            '<div class="pos-lk-offer-item-desc">' + escapeHtml(o.description || '') + '</div>' +
            '<div class="pos-lk-offer-item-disc">' + (disc ? escapeHtml(disc) + ' · ' : '') + 'Use this offer</div>' +
            '</div>' +
            '<span class="pos-cart-coupon-apply">Apply Coupon</span>' +
            '</button>'
        }
      }
      listEl.innerHTML = html
      wirePosOfferPickClicks(listEl, session)
      refreshPosOfferPickVisuals()
    } catch (err) {
      posCartOffers = []
      invalidatePosOfferIfNotListed(posCartOffers)
      obRecalcTotals()
      syncCartBillBenefitBox()
      listEl.innerHTML =
        '<div class="pos-lk-offers-load-fail" role="alert">' + escapeHtml(err.message || 'Could not load offers.') + '</div>'
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Could not load offers.')
    }
    syncCartBillBenefitBox()
    syncCartAppliedOfferCard()
  }

  function syncCartBillBenefitBox() {
    const wrap = document.getElementById('pos-lk-bill-benefit')
    const body = document.getElementById('pos-lk-bill-benefit-body')
    if (!wrap || !body) return
    // Offer state is now shown in the dedicated applied-offer card.
    wrap.hidden = false
    body.textContent = ''
    wrap.hidden = true
  }

  async function loadCartOffers(session) {
    await loadPosOffersPanel(session, 'pos-cart-coupon-list', null, false)
  }

  function refreshCartSidebar(session) {
    if (!session || !session.token) return
    renderCartCustomerRef()
    void loadCartOffers(session)
  }

  /** After pick/create in customer picker, close modal and return to cart (same as Continue). */
  function leaveCustomerScreenToCart() {
    closePosCustomerPickerModal()
    const session = getPosSession()
    if (session && session.token) {
      refreshCartSidebar(session)
    }
    navigate(POS_ROUTES.ORDER)
  }

  function setCartCouponOverlayOpen(expanded) {
    if (!overlayCartCoupons) return
    overlayCartCoupons.classList.toggle('open', !!expanded)
    document.body.classList.toggle('pos-lk-modal-scroll-lock', !!expanded)
  }

  function maybeRefreshCartSidebar() {
    const active = document.querySelector('.pos-screen.active')
    if (!active || active.id !== 'screen-pos-order-builder') return
    const session = getPosSession()
    refreshCartSidebar(session)
  }

  // ── Colour code → hex mapping (DB stores short codes, not hex values) ───────
  function colourToHex(colourName, colourCode) {
    const n = String(colourName || '').trim().toLowerCase()
    const c = String(colourCode || '').trim().toLowerCase()
    const map = {
      'black': '#1c1c1e',      'blk': '#1c1c1e',      'matte black': '#1c1c1e',
      'white': '#f8fafc',      'wht': '#f8fafc',
      'silver': '#94a3b8',     'slv': '#94a3b8',
      'gold': '#d97706',       'gld': '#d97706',
      'rose gold': '#f43f5e',  'rsg': '#f43f5e',
      'blue': '#1d4ed8',       'blu': '#1d4ed8',
      'navy': '#1e3a8a',       'nvy': '#1e3a8a',
      'ocean blue': '#1d4ed8',
      'red': '#dc2626',        'red': '#dc2626',
      'green': '#16a34a',      'grn': '#16a34a',
      'brown': '#92400e',      'brn': '#92400e',
      'hazel brown': '#92400e',
      'grey': '#6b7280',       'gry': '#6b7280',
      'gray': '#6b7280',       'gunmetal': '#374151',
      'clear': '#e0f2fe',      'clr': '#e0f2fe',
      'transparent': '#e0f2fe','trn': '#e0f2fe',
      'photochromic': '#374151','pht': '#374151',
      'tortoise': '#78350f',   'tor': '#78350f',
      'cream': '#fef3c7',      'crm': '#fef3c7',
      'orange': '#ea580c',     'org': '#ea580c',
      'yellow': '#ca8a04',     'ylw': '#ca8a04',
      'pink': '#ec4899',       'pnk': '#ec4899',
      'purple': '#7c3aed',     'pur': '#7c3aed',
    }
    return map[n] || map[c] || '#6b7280'
  }

  // ── Live catalogue state ──────────────────────────────────────────────────
  let lastLoadedProducts = []

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const storeSelectorBtn  = document.getElementById('store-selector-btn')
  const storeSelectorName = document.getElementById('store-selector-name')
  const storeDropdown     = document.getElementById('store-dropdown')
  const pinDots           = document.querySelectorAll('#pos-staff-pin-block .pos-pin-dot')
  const pinError          = document.getElementById('pin-error-staff')
  const tabletPinDots     = document.querySelectorAll('#pos-tablet-pin-dots .pos-pin-dot')
  const tabletPinError    = document.getElementById('pos-tablet-pin-error')
  const posTabletIdInput  = document.getElementById('pos-tablet-id-input')
  const btnUnlockTablet   = document.getElementById('btn-unlock-tablet')
  const btnPosSignOutTablet = document.getElementById('btn-pos-sign-out-tablet')
  const numpadTablet      = document.getElementById('pos-numpad-tablet')
  const numpadStaff       = document.getElementById('pos-numpad-staff')
  const btnUnlock         = document.getElementById('btn-unlock-pos')
  const catalogueStaff    = document.getElementById('pos-catalogue-staff')
  const catalogueStore    = document.getElementById('pos-catalogue-store')
  const btnScopeStore     = document.getElementById('btn-scope-store')
  const btnScopeGlobal    = document.getElementById('btn-scope-global')
  const brandSelect       = document.getElementById('pos-catalogue-brand')
  const searchInput       = document.getElementById('pos-search-code')
  const btnSearch         = document.getElementById('btn-pos-search')
  const btnCatalogueScan    = document.getElementById('btn-pos-catalogue-scan')
  const btnHeaderCart     = document.getElementById('btn-pos-header-cart')
  const headerCartCountEl = document.getElementById('pos-header-cart-count')
  const catalogueMeta     = document.getElementById('pos-catalogue-meta')
  const catalogueResults  = document.getElementById('pos-catalogue-results')
    const btnPosCustomer = document.getElementById('btn-pos-customer')
  const btnPdpBack        = document.getElementById('btn-pdp-back')
  const btnPdpSelectLens  = document.getElementById('btn-pdp-select-lenses')
  const pdpProductTitle   = document.getElementById('pos-pdp-product-title')
  const pdpBrand          = document.getElementById('pos-pdp-brand')
  const pdpName           = document.getElementById('pos-pdp-name')
  const pdpPrice          = document.getElementById('pos-pdp-price')
  const pdpStrike         = document.getElementById('pos-pdp-strike')
  const pdpDelivery       = document.getElementById('pos-pdp-delivery')
  const pdpTotal          = document.getElementById('pos-pdp-total')

  // ── Order Builder DOM refs ───────────────────────────────────────────────
  const btnObBack         = document.getElementById('btn-ob-back')
  const btnObAddMore      = document.getElementById('btn-ob-add-more')
  const obKindChip        = document.getElementById('pos-ob-kind-chip')
  const obCart_el         = document.getElementById('pos-ob-cart')
  const obRxSection       = document.getElementById('pos-ob-rx-section')
  const obSubtotal        = document.getElementById('pos-ob-subtotal')
  const obGst             = document.getElementById('pos-ob-gst')
  const obGstLbl          = document.getElementById('pos-ob-gst-lbl')
  const obTotal           = document.getElementById('pos-ob-total')
  const obDiscountLine    = document.getElementById('pos-ob-discount-line')
  const obCartHeadingLine = document.getElementById('pos-lk-cart-heading-line')
  const btnObProceed      = document.getElementById('btn-ob-proceed')
  const btnCartCustomerChange = document.getElementById('btn-cart-customer-change')
  const btnCartCustomerSearch = document.getElementById('btn-cart-customer-search')
  const btnCartApplyCoupon = document.getElementById('btn-cart-apply-coupon')
  const overlayCartCoupons = document.getElementById('overlay-pos-cart-coupons')
  const btnCartCouponBack = document.getElementById('btn-cart-coupon-back')
  const backdropCartCoupon = document.getElementById('pos-cart-coupon-backdrop')
  const cartCouponSearchInput = document.getElementById('cart-coupon-search')
  const btnCartCouponSearch = document.getElementById('btn-cart-coupon-search')
  const cartCouponListEl = document.getElementById('pos-cart-coupon-list')
  const cardOfferApplied = document.getElementById('pos-lk-offer-applied-card')
  const offerAppliedTitle = document.getElementById('pos-lk-offer-applied-title')
  const offerAppliedSub = document.getElementById('pos-lk-offer-applied-sub')
  const btnCartOfferRemove = document.getElementById('btn-cart-offer-remove')
  const obStaffEl         = document.getElementById('pos-ob-staff')
  const obStoreEl         = document.getElementById('pos-ob-store')
  const rxPlanoOd         = document.getElementById('rx-plano-od')
  const rxPlanoOs         = document.getElementById('rx-plano-os')
  const rxPd              = document.getElementById('rx-pd')

  // ── POS config (from API) ────────────────────────────────────────────────
  async function loadPosBootstrap(session) {
    if (!session || !session.token) return
    try {
      if (!window.posConfig || !window.posConfig.__loaded) {
        const cfg = await apiGet('/api/pos/startup-config', session.token)
        window.posConfig = Object.assign({}, cfg, { __loaded: true })
      }
      const st = await apiGet('/api/pos/settings', session.token)
      const defaults = {
        gst_rate: 0.05,
        lab_advance_pct: 40,
        composition_scheme: false,
        prices_gst_inclusive: false
      }
      posSettings = Object.assign(defaults, st || {})
      window.posSettings = posSettings
      window.__posSettingsLoaded = true
      if (obCart && obCart.length > 0) obRecalcTotals()
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
    }
  }

  function getTypeRule(productTypeKey) {
    const cfg = window.posConfig
    if (!cfg || !cfg.productTypeConfig) return null
    let raw = String(productTypeKey || '').trim().toUpperCase()
    if (!raw || raw.includes('EYE') || raw.includes('FRAME') || raw.includes('OPTIC')) {
      raw = 'FRAMES'
    } else if (!cfg.productTypeConfig.find(function (r) { return r.key === raw })) {
      // Fallback for unknown product types: treat as DUAL/FRAMES unless it obviously looks like sunglasses
      if (raw.includes('SUN')) raw = 'SUNGLASSES'
      else if (raw.includes('ACCESSORY')) raw = 'ACCESSORIES'
      else raw = 'FRAMES'
    }
    return cfg.productTypeConfig.find(function (r) { return r.key === raw }) || null
  }

  /** Returns true if this product type can use the lens wizard (policy OPTIONAL or REQUIRED). */
  function lensWizardAllowed(productTypeKey) {
    const rule = getTypeRule(productTypeKey)
    if (!rule) return false
    const policy = String(rule.lens_wizard_policy || 'NEVER')
    return policy === 'OPTIONAL' || policy === 'REQUIRED'
  }

  function defaultFulfillmentForRule(rule) {
    if (!rule) return 'INSTANT'
    if (rule.fulfillment_mode === 'LAB') return 'LAB'
    if (rule.fulfillment_mode === 'INSTANT') return 'INSTANT'
    return 'INSTANT'
  }

  function deriveOrderKind(cart) {
    if (!cart.length) return 'INSTANT'
    let hasLab = false
    let hasIns = false
    for (let i = 0; i < cart.length; i++) {
      if (cart[i].fulfillment === 'LAB') hasLab = true
      if (cart[i].fulfillment === 'INSTANT') hasIns = true
    }
    if (hasLab && hasIns) return 'MIXED'
    if (hasLab) return 'LAB'
    return 'INSTANT'
  }

  function cartLineKey(line) {
    if (line.fulfillment === 'INSTANT') return String(line.sku_id) + ':INSTANT'
    const pkg = line.lens_bundle && line.lens_bundle.package_id
    const ids = (line.lens_bundle && line.lens_bundle.addon_ids) ? line.lens_bundle.addon_ids.slice().sort(function (a, b) { return a - b }) : []
    return String(line.sku_id) + ':LAB:' + (pkg || '0') + ':' + ids.join(',')
  }

  function updateKindChip() {
    if (!obKindChip) return
    const kind = deriveOrderKind(obCart)
    obKindChip.textContent = kind === 'MIXED' ? 'Mixed' : (kind === 'LAB' ? 'Lab' : 'Instant')
    obKindChip.classList.remove('kind-mixed', 'kind-lab')
    if (kind === 'MIXED') obKindChip.classList.add('kind-mixed')
    if (kind === 'LAB') obKindChip.classList.add('kind-lab')
  }

  function computeLineDisplayUnit(line) {
    let u = Number(line.frame_unit_price) || 0
    if (line.fulfillment === 'LAB' && line.lens_bundle && line.lab_status === 'complete') {
      const b = line.lens_bundle
      u += Number(b.package_price) || 0
      const ap = b.addon_prices || []
      for (let i = 0; i < ap.length; i++) u += Number(ap[i]) || 0
    }
    return u
  }

  function syncRxSectionVisibility() {
    const need = obCart.some(function (l) { return l.fulfillment === 'LAB' && l.rx_required })
    const hide = !need
    obRxSection.setAttribute('aria-hidden', hide ? 'true' : 'false')
  }

  function collectRxSnapshot() {
    function eye(axisPrefix, planoElId) {
      const pe = document.getElementById(planoElId)
      return {
        plano: pe ? pe.checked : false,
        sph: document.getElementById('rx-' + axisPrefix + '-sph') ? document.getElementById('rx-' + axisPrefix + '-sph').value : '',
        cyl: document.getElementById('rx-' + axisPrefix + '-cyl') ? document.getElementById('rx-' + axisPrefix + '-cyl').value : '',
        axis: document.getElementById('rx-' + axisPrefix + '-axis') ? document.getElementById('rx-' + axisPrefix + '-axis').value : ''
      }
    }
    return {
      od: eye('r', 'rx-plano-od'),
      os: eye('l', 'rx-plano-os'),
      pd: rxPd ? rxPd.value : '',
      doctor: document.getElementById('rx-doctor') ? document.getElementById('rx-doctor').value : ''
    }
  }

  function rxMeetsRequirement() {
    const s = collectRxSnapshot()
    if (s.od.plano && s.os.plano) return true
    if (s.od.plano || s.os.plano) return true
    const odOk = (s.od.sph && String(s.od.sph).trim()) || (s.od.cyl && String(s.od.cyl).trim())
    const osOk = (s.os.sph && String(s.os.sph).trim()) || (s.os.cyl && String(s.os.cyl).trim())
    return Boolean(odOk || osOk)
  }

  function bindRxPlanoHandlers() {
    function toggleEye(prefix, checked) {
      const sph = document.getElementById('rx-' + prefix + '-sph')
      const cyl = document.getElementById('rx-' + prefix + '-cyl')
      const ax = document.getElementById('rx-' + prefix + '-axis')
      ;[sph, cyl, ax].forEach(function (el) {
        if (!el) return
        el.disabled = checked
        if (checked) el.value = ''
      })
    }
    if (rxPlanoOd) {
      rxPlanoOd.addEventListener('change', function () { toggleEye('r', rxPlanoOd.checked) })
    }
    if (rxPlanoOs) {
      rxPlanoOs.addEventListener('change', function () { toggleEye('l', rxPlanoOs.checked) })
    }
  }

  function renderTabletPinDots() {
    tabletPinDots.forEach(function (dot, i) {
      dot.classList.toggle('filled', i < tabletPinDigits.length)
      dot.classList.remove('error')
    })
  }

  function resetTabletPin(withError) {
    if (withError) {
      tabletPinDots.forEach(function (dot) { dot.classList.add('error') })
      setTimeout(function () {
        tabletPinDigits = []
        renderTabletPinDots()
        clearTabletPinError()
      }, 600)
    } else {
      tabletPinDigits = []
      renderTabletPinDots()
      clearTabletPinError()
    }
  }

  function showTabletPinError(msg) {
    if (tabletPinError) tabletPinError.textContent = msg || ''
  }

  function clearTabletPinError() {
    if (tabletPinError) tabletPinError.textContent = ''
  }

  /** Resolve store display name for a store_id (uses cached list or fetches /api/pos/stores). */
  async function resolveStoreDisplayNameForId(storeId) {
    const sid = Number(storeId)
    if (!Number.isFinite(sid) || sid <= 0) return ''
    let row = cachedPosStores.find(function (s) { return Number(s.store_id) === Number(sid) })
    if (row && row.store_name) return String(row.store_name)
    try {
      const stores = await publicGet('/api/pos/stores')
      cachedPosStores = Array.isArray(stores) ? stores : []
      row = cachedPosStores.find(function (s) { return Number(s.store_id) === Number(sid) })
      return row ? String(row.store_name || '') : ''
    } catch (_e) {
      return ''
    }
  }

  function syncStaffLoginStoreLine() {
    var line = document.getElementById('pos-staff-store-line')
    var jwtSid = getTabletJwtStoreId()
    if (!line) return
    if (jwtSid == null) {
      line.textContent = ''
      return
    }
    var row = cachedPosStores.find(function (s) { return Number(s.store_id) === Number(jwtSid) })
    var name = row ? row.store_name : ''
    if (!name && Number(selectedStoreId) === Number(jwtSid)) name = selectedStoreName
    selectedStoreId = jwtSid
    selectedStoreName = name || selectedStoreName
    line.textContent = name ? name : ('Store #' + jwtSid)
  }

  function resetPosSetPinScreen() {
    posSetPinNew = []
    posSetPinConfirm = []
    posSetPinPhase = 'new'
    var stepEl = document.getElementById('pos-setpin-step-label')
    if (stepEl) stepEl.textContent = 'New PIN (4 digits)'
    var errEl = document.getElementById('pos-setpin-error')
    if (errEl) errEl.textContent = ''
    document.querySelectorAll('#pos-setpin-dots .pos-pin-dot').forEach(function (d) {
      d.classList.remove('filled', 'error')
    })
  }

  function renderPosSetPinDots() {
    var dots = document.querySelectorAll('#pos-setpin-dots .pos-pin-dot')
    var src = posSetPinPhase === 'new' ? posSetPinNew : posSetPinConfirm
    dots.forEach(function (dot, i) {
      dot.classList.toggle('filled', i < src.length)
      dot.classList.remove('error')
    })
  }

  function clearPosSetPinErr() {
    var errEl = document.getElementById('pos-setpin-error')
    if (errEl) errEl.textContent = ''
  }

  function posSetPinAddDigit(digit) {
    var d = String(digit || '').replace(/\D/g, '').slice(-1)
    if (!d) return
    if (posSetPinPhase === 'new') {
      if (posSetPinNew.length >= PIN_LENGTH) return
      posSetPinNew.push(d)
      renderPosSetPinDots()
      clearPosSetPinErr()
      if (posSetPinNew.length === PIN_LENGTH) {
        posSetPinPhase = 'confirm'
        var stepEl = document.getElementById('pos-setpin-step-label')
        if (stepEl) stepEl.textContent = 'Confirm PIN (4 digits)'
        renderPosSetPinDots()
      }
      return
    }
    if (posSetPinConfirm.length >= PIN_LENGTH) return
    posSetPinConfirm.push(d)
    renderPosSetPinDots()
    clearPosSetPinErr()
  }

  function posSetPinRemoveDigit() {
    if (posSetPinConfirm.length) {
      posSetPinConfirm.pop()
    } else if (posSetPinPhase === 'confirm') {
      posSetPinPhase = 'new'
      var stepEl = document.getElementById('pos-setpin-step-label')
      if (stepEl) stepEl.textContent = 'New PIN (4 digits)'
      posSetPinNew = []
    } else if (posSetPinNew.length) {
      posSetPinNew.pop()
    }
    renderPosSetPinDots()
    clearPosSetPinErr()
  }

  async function handlePosSetPinSave() {
    var errEl = document.getElementById('pos-setpin-error')
    var btn = document.getElementById('btn-setpin-save')
    if (posSetPinNew.length !== PIN_LENGTH || posSetPinConfirm.length !== PIN_LENGTH) {
      if (errEl) errEl.textContent = 'Enter and confirm a 4-digit PIN.'
      return
    }
    var a = posSetPinNew.join('')
    var b = posSetPinConfirm.join('')
    if (a !== b) {
      document.querySelectorAll('#pos-setpin-dots .pos-pin-dot').forEach(function (dot) { dot.classList.add('error') })
      if (errEl) errEl.textContent = 'PINs do not match. Start again.'
      posSetPinPhase = 'new'
      posSetPinNew = []
      posSetPinConfirm = []
      var stepEl = document.getElementById('pos-setpin-step-label')
      if (stepEl) stepEl.textContent = 'New PIN (4 digits)'
      setTimeout(function () {
        document.querySelectorAll('#pos-setpin-dots .pos-pin-dot').forEach(function (dot) { dot.classList.remove('error') })
        renderPosSetPinDots()
      }, 450)
      return
    }
    var session = getPosSession()
    if (!session || !session.token) {
      navigate(POS_ROUTES.LOGIN)
      return
    }
    if (typeof cosmosBtnLoading === 'function' && btn) cosmosBtnLoading(btn)
    try {
      await apiPut('/api/pos/set-pin', { pin: a }, session.token)
      if (typeof cosmosBtnSuccess === 'function' && btn) cosmosBtnSuccess(btn)
      else if (typeof cosmosBtnDone === 'function' && btn) cosmosBtnDone(btn)
      if (typeof cosmosToastSuccess === 'function') {
        cosmosToastSuccess('PIN updated. Use this on any Eyewoot store tablet.')
      }
      navigate(POS_ROUTES.CATALOGUE)
    } catch (err) {
      if (typeof cosmosBtnDone === 'function' && btn) cosmosBtnDone(btn)
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
      if (errEl) errEl.textContent = err.message || 'Could not update PIN.'
    }
  }

  // ── Load stores ──────────────────────────────────────────────────────────
  async function loadStores() {
    storeSelectorName.textContent = 'Fetching stores'
    storeSelectorBtn.disabled = true
    try {
      const stores = await publicGet('/api/pos/stores')
      cachedPosStores = Array.isArray(stores) ? stores : []
      renderStoreDropdown(stores)
      if (stores.length === 1) {
        selectStore(stores[0].store_id, stores[0].store_name)
      } else {
        const jwtSid = getTabletJwtStoreId()
        if (jwtSid != null) {
          const row = stores.find(function (s) { return Number(s.store_id) === Number(jwtSid) })
          if (row) {
            selectStore(row.store_id, row.store_name)
            return
          }
        }
        storeSelectorName.textContent = 'Unlock tablet to link store'
        storeSelectorBtn.disabled = false
      }
    } catch (err) {
      storeSelectorName.textContent = 'Could not load stores — tap to retry'
      storeSelectorBtn.disabled = false
      storeSelectorBtn.onclick = loadStores
      if (typeof cosmosToastError === 'function') {
        cosmosToastError('Failed to load stores: ' + err.message)
      }
    }
  }

  function renderStoreDropdown(stores) {
    storeDropdown.innerHTML = ''
    stores.forEach(store => {
      const opt = document.createElement('button')
      opt.className = 'pos-store-option'
      opt.setAttribute('role', 'option')
      opt.setAttribute('tabindex', '0')
      opt.setAttribute('data-store-id', store.store_id)
      opt.setAttribute('data-store-name', store.store_name)
      opt.innerHTML = `
        <span style="font-size:16px">🏪</span>
        <span class="pos-store-option-name">${store.store_name}</span>
      `
      opt.addEventListener('click', () => {
        selectStore(store.store_id, store.store_name)
        closeStoreDropdown()
      })
      opt.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          selectStore(store.store_id, store.store_name)
          closeStoreDropdown()
        }
      })
      storeDropdown.appendChild(opt)
    })
    storeSelectorBtn.disabled = false
  }

  function selectStore(id, name) {
    selectedStoreId   = id
    selectedStoreName = name
    storeSelectorName.textContent = name
    document.querySelectorAll('.pos-store-option').forEach(opt => {
      opt.classList.toggle('selected', Number(opt.dataset.storeId) === id)
    })
    if (!isTabletSessionValidForStore(id)) {
      clearPosTabletToken()
    }
    resetPin(false)
    resetTabletPin(false)
    if (posTabletIdInput) posTabletIdInput.value = ''
  }

  function openStoreDropdown() {
    storeDropdown.classList.add('open')
    storeSelectorBtn.setAttribute('aria-expanded', 'true')
  }

  function closeStoreDropdown() {
    storeDropdown.classList.remove('open')
    storeSelectorBtn.setAttribute('aria-expanded', 'false')
  }

  storeSelectorBtn.addEventListener('click', () => {
    if (storeDropdown.classList.contains('open')) closeStoreDropdown()
    else openStoreDropdown()
  })

  storeSelectorBtn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); storeSelectorBtn.click() }
    if (e.key === 'Escape') closeStoreDropdown()
  })

  document.addEventListener('click', e => {
    if (!e.target.closest('.pos-store-dropdown-wrap')) closeStoreDropdown()
  })

  // ── PIN management ───────────────────────────────────────────────────────
  function renderPinDots() {
    pinDots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < pinDigits.length)
      dot.classList.remove('error')
    })
  }

  function resetPin(withError) {
    if (withError) {
      // Flash error state on dots before clearing
      pinDots.forEach(dot => dot.classList.add('error'))
      setTimeout(() => { pinDigits = []; renderPinDots(); clearPinError() }, 600)
    } else {
      pinDigits = []
      renderPinDots()
      clearPinError()
    }
  }

  function showPinError(msg) {
    if (pinError) pinError.textContent = msg || ''
  }

  function clearPinError() {
    if (pinError) pinError.textContent = ''
  }

  function loginTabletScreenActive() {
    var el = document.getElementById('screen-login-tablet')
    return Boolean(el && el.classList.contains('active'))
  }

  function loginStaffScreenActive() {
    var el = document.getElementById('screen-login-staff')
    return Boolean(el && el.classList.contains('active'))
  }

  function addDigit(digit) {
    if (loginTabletScreenActive()) {
      if (tabletPinDigits.length >= PIN_LENGTH) return
      tabletPinDigits.push(digit)
      renderTabletPinDots()
      clearTabletPinError()
      return
    }
    if (loginStaffScreenActive()) {
      if (pinDigits.length >= PIN_LENGTH) return
      pinDigits.push(digit)
      renderPinDots()
      clearPinError()
      if (pinDigits.length === PIN_LENGTH) handleLogin()
      return
    }
  }

  function removeDigit() {
    if (loginTabletScreenActive()) {
      if (!tabletPinDigits.length) return
      tabletPinDigits.pop()
      renderTabletPinDots()
      clearTabletPinError()
      return
    }
    if (loginStaffScreenActive()) {
      if (!pinDigits.length) return
      pinDigits.pop()
      renderPinDots()
      clearPinError()
      return
    }
  }

  function bindPosNumpad(tableEl, backspaceId) {
    if (!tableEl) return
    tableEl.addEventListener('click', function onNumpadClick(e) {
      const btn = e.target.closest('.pos-numpad-btn')
      if (!btn || btn.classList.contains('ghost')) return
      if (btn.id === backspaceId) { removeDigit(); return }
      const digit = btn.dataset.digit
      if (digit !== undefined) addDigit(digit)
    })
    tableEl.addEventListener('keydown', function onNumpadKeydown(e) {
      if (e.key !== 'Enter' && e.key !== ' ') return
      const btn = e.target.closest('.pos-numpad-btn')
      if (btn) btn.click()
    })
  }

  bindPosNumpad(numpadTablet, 'btn-backspace-tablet')
  bindPosNumpad(numpadStaff, 'btn-backspace-staff')

  // Physical keyboard (dev / bluetooth keyboard): route digits to whichever login screen is active
  document.addEventListener('keydown', function posLoginKeyboard(e) {
    if (!loginTabletScreenActive() && !loginStaffScreenActive()) return
    var tag = e.target && e.target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (e.key >= '0' && e.key <= '9') addDigit(e.key)
    if (e.key === 'Backspace') removeDigit()
  })

  document.addEventListener('keydown', function (e) {
    var sp = document.getElementById('screen-pos-set-pin')
    if (!sp || !sp.classList.contains('active')) return
    var tag = e.target && e.target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (e.key >= '0' && e.key <= '9') posSetPinAddDigit(e.key)
    if (e.key === 'Backspace') posSetPinRemoveDigit()
  })

  async function handleTabletUnlock() {
    var tidRaw = posTabletIdInput ? String(posTabletIdInput.value || '').trim() : ''
    var tabletId = parseInt(tidRaw, 10)
    if (!Number.isFinite(tabletId) || tabletId <= 0) {
      if (typeof cosmosFieldError === 'function' && posTabletIdInput) cosmosFieldError(posTabletIdInput, 'Enter tablet ID')
      showTabletPinError('Enter the tablet ID from Command Unit.')
      return
    }
    if (tabletPinDigits.length !== PIN_LENGTH) {
      showTabletPinError('Enter the 4-digit tablet PIN.')
      return
    }
    var tabPin = tabletPinDigits.join('')
    if (btnUnlockTablet && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btnUnlockTablet)
    try {
      var body = await publicPost('/api/pos/tablet-login', { tablet_id: tabletId, pin: tabPin })
      var tok = body.data && body.data.token
      if (!tok) throw new Error('Tablet login failed.')
      try {
        sessionStorage.setItem(POS_TABLET_TOKEN_KEY, tok)
      } catch (_e) { /* ignore */ }
      var respStoreId = body.data && body.data.store_id != null ? Number(body.data.store_id) : NaN
      if (!Number.isFinite(respStoreId) || respStoreId <= 0) {
        clearPosTabletToken()
        throw new Error('Tablet response missing store.')
      }
      var p = decodeJwtPayloadUnverified(tok)
      if (p && Number(p.store_id) !== Number(respStoreId)) {
        clearPosTabletToken()
        throw new Error('Tablet session mismatch.')
      }
      var storeName = await resolveStoreDisplayNameForId(respStoreId)
      if (!storeName) storeName = 'Store #' + String(respStoreId)
      selectStore(respStoreId, storeName)
      resetTabletPin(false)
      if (btnUnlockTablet && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btnUnlockTablet)
      else if (btnUnlockTablet && typeof cosmosBtnDone === 'function') cosmosBtnDone(btnUnlockTablet)
      if (typeof cosmosToastSuccess === 'function') {
        cosmosToastSuccess('Tablet unlocked — continue on the staff sign-in screen.')
      }
      navigate(POS_ROUTES.LOGIN_STAFF)
    } catch (err) {
      if (btnUnlockTablet && typeof cosmosBtnDone === 'function') cosmosBtnDone(btnUnlockTablet)
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
      showTabletPinError(err.message || 'Could not unlock tablet.')
      resetTabletPin(true)
    }
  }

  // ── Login handler ────────────────────────────────────────────────────────
  function getEffectiveLoginStoreContext() {
    var sid = selectedStoreId
    var name = selectedStoreName || ''
    if (!sid) {
      var j = getTabletJwtStoreId()
      if (j != null && isTabletSessionValidForStore(j)) {
        sid = j
        if (!name) {
          var opt = document.querySelector('.pos-store-option[data-store-id="' + String(j) + '"]')
          if (opt) name = opt.getAttribute('data-store-name') || ''
        }
        if (!name) {
          var row = cachedPosStores.find(function (s) { return Number(s.store_id) === Number(j) })
          if (row) name = row.store_name || ''
        }
      }
    }
    return { storeId: sid, storeName: name }
  }

  async function handleLogin() {
    var ctx = getEffectiveLoginStoreContext()
    if (!ctx.storeId) {
      showPinError('Please select a store first.')
      resetPin(true)
      return
    }
    if (!isTabletSessionValidForStore(ctx.storeId)) {
      showPinError('Unlock this store’s tablet first.')
      resetPin(true)
      return
    }

    if (btnUnlock && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btnUnlock)

    try {
      const pin = pinDigits.join('')
      const result = await staffPinLogin(pin)

      // Persist session
      savePosSession({
        token:       result.data.token,
        employee_id: result.data.employee_id,
        session_id:  result.data.session_id != null ? result.data.session_id : null,
        name:        result.data.name,
        role:        result.data.role,
        store_id:    result.data.store_id,
        store_name:  ctx.storeName || selectedStoreName,
        logged_in_at: new Date().toISOString()
      })
      if (result.data.store_id != null) {
        selectedStoreId = result.data.store_id
        if (ctx.storeName) selectedStoreName = ctx.storeName
      }

      if (btnUnlock && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btnUnlock)
      else if (btnUnlock && typeof cosmosBtnDone === 'function') cosmosBtnDone(btnUnlock)
      try {
        sessionStorage.setItem(POS_CATALOGUE_WELCOME_ONCE, '1')
      } catch (_e) { /* storage unavailable */ }
      navigate(POS_ROUTES.CATALOGUE)
    } catch (err) {
      if (btnUnlock && typeof cosmosBtnDone === 'function') cosmosBtnDone(btnUnlock)
      showPinError(err.message || 'Invalid PIN — try again')
      resetPin(true)
    }
  }

  if (btnUnlockTablet) {
    btnUnlockTablet.addEventListener('click', function () { void handleTabletUnlock() })
  }
  if (btnPosSignOutTablet) {
    btnPosSignOutTablet.addEventListener('click', function () {
      clearPosTabletToken()
      resetPin(false)
      tabletPinDigits = []
      resetTabletPin(false)
      if (typeof cosmosToastInfo === 'function') {
        cosmosToastInfo('Tablet session cleared. Unlock this tablet again.')
      }
      navigate(POS_ROUTES.LOGIN)
    })
  }
  if (posTabletIdInput && typeof cosmosFieldClear === 'function') {
    posTabletIdInput.addEventListener('input', function () { cosmosFieldClear(posTabletIdInput) })
  }

  if (btnUnlock) {
    btnUnlock.addEventListener('click', () => {
      if (pinDigits.length === PIN_LENGTH) handleLogin()
      else showPinError('Enter your 4-digit PIN to continue.')
    })
  }

  // ── Catalogue helpers ────────────────────────────────────────────────────

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase()
  }

  function updateScopeButtons() {
    const isStore = activeCatalogueScope === 'store'
    btnScopeStore.classList.toggle('active', isStore)
    btnScopeStore.setAttribute('aria-pressed', isStore ? 'true' : 'false')
    btnScopeGlobal.classList.toggle('active', !isStore)
    btnScopeGlobal.setAttribute('aria-pressed', isStore ? 'false' : 'true')
  }

  function typeEmoji(productType) {
    const t = normalizeText(productType || '')
    if (t === 'sunglasses') return '🕶️'
    if (t === 'lens' || t === 'contact lens') return '👁️'
    if (t === 'accessories') return '🧴'
    return '👓'
  }

  function inrFormat(price) {
    if (!price && price !== 0) return '—'
    return '₹' + Number(price).toLocaleString('en-IN')
  }

  function formatPdpCollectionModelLine(product) {
    if (!product) return ''
    const c = String(product.collection_name || '').trim()
    const m = String(product.model_number || '').trim()
    if (c && m) return c + ' · ' + m
    if (c) return c
    if (m) return m
    return String(product.product_name || '').trim()
  }

  function getSelectedSku(products) {
    if (!selectedProductId) return { colour: null, product: null }
    for (const p of products) {
      if (p.product_id !== selectedProductId[0]) continue
      const c = p.colours.find(col => col.sku_id === selectedProductId[1])
      if (c) return { colour: c, product: p }
    }
    return { colour: null, product: null }
  }

  function renderEmptyState(query) {
    const hasQuery = Boolean(normalizeText(query))
    const title = hasQuery ? 'No product found' : 'Start product search'
    const sub = hasQuery
      ? 'No match for "' + query.trim() + '". Try another code or clear.'
      : 'Search by SKU, barcode, brand, or product name.'

    catalogueResults.innerHTML = `
      <div class="pos-empty" style="grid-column:1/-1">
        <div class="pos-empty-title">${title}</div>
        <div class="pos-empty-sub">${sub}</div>
        <button id="btn-clear-search" class="pos-empty-btn" type="button">Clear search</button>
      </div>
    `
    document.getElementById('btn-clear-search').addEventListener('click', () => {
      searchInput.value = ''
      triggerCatalogueSearch()
    })
  }

  /** Trailing number is total colour count — only for compact catalogue rows; omit on PDP where every colour is already a swatch. */
  function buildSwatches(product, activeSkuId, options) {
    const showTrailingCount = options && options.showTrailingCount === true
    return product.colours.map(function (c) {
      const isActive = c.sku_id === activeSkuId
      const hex = colourToHex(c.colour_name, c.colour_code)
      const nm = escapeHtml(String(c.colour_name || 'Colour').trim()) || 'Colour'
      const oos = Number(c.store_qty || 0) <= 0
      const oosNote = oos ? ' — out of stock at this store' : ''
      return `<div class="pos-sku-swatch${isActive ? ' active' : ''}${oos ? ' pos-sku-swatch--oos' : ''}"
        style="background:${hex}"
        data-product-id="${product.product_id}"
        data-sku-id="${c.sku_id}"
        title="${nm}"
        tabindex="0"
        role="button"
        aria-label="${nm}${isActive ? ' selected' : ''}${oosNote}"></div>`
    }).join('') + (showTrailingCount && product.colours.length > 1
      ? `<span class="pos-sku-swatch-count" aria-hidden="true">${product.colours.length}</span>`
      : '')
  }

  function renderPdpColourSwatches(session, product, colour) {
    const block = document.getElementById('pos-pdp-colour-block')
    const wrap = document.getElementById('pos-pdp-colour-swatches')
    const nameEl = document.getElementById('pos-pdp-colour-name')
    if (!wrap || !block) return
    if (!product || !product.colours || product.colours.length < 2) {
      wrap.innerHTML = ''
      if (nameEl) nameEl.textContent = ''
      block.hidden = true
      return
    }
    block.hidden = false
    wrap.innerHTML = buildSwatches(product, colour.sku_id, { showTrailingCount: false })
    if (nameEl) nameEl.textContent = String(colour.colour_name || '').trim() || 'Selected colour'
    wrap.querySelectorAll('.pos-sku-swatch').forEach(function (sw) {
      sw.addEventListener('click', function (e) {
        e.preventDefault()
        e.stopPropagation()
        const sid = Number(sw.getAttribute('data-sku-id'))
        const c = product.colours.find(function (x) { return x.sku_id === sid })
        if (!c) return
        if (Number(c.store_qty || 0) <= 0) {
          if (typeof cosmosToastWarn === 'function') {
            cosmosToastWarn('This colour is not available at this store.')
          }
          return
        }
        selectedProductId = [product.product_id, c.sku_id]
        pendingOrderSelection = { colour: c, product: product }
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, '', productRoute(product.product_id, c.sku_id))
        }
        void showProductPageScreen(session || getPosSession())
      })
      sw.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        sw.click()
      })
    })
  }

  function renderCatalogueCards(products, query) {
    if (!products.length) {
      renderEmptyState(query)
      return
    }

    catalogueResults.innerHTML = ''

    products.forEach(product => {
      const activeColour = (selectedProductId && selectedProductId[0] === product.product_id)
        ? (product.colours.find(c => c.sku_id === selectedProductId[1]) || product.colours[0])
        : product.colours[0]
      const isSelected = selectedProductId && selectedProductId[0] === product.product_id
      const hasAnyStock = product.colours.some(function (c) { return Number(c.store_qty || 0) > 0 })
      const hasStock = hasAnyStock
      const lensCopy = String(product.lens_copy || '').trim()
      const deliveryCopy = product.delivery_copy || (hasStock ? 'Delivery by 6, May' : 'Click disabled in this state')
      const deliveryClass = hasStock ? '' : ' muted'

      const card = document.createElement('div')
      card.className = 'pos-lk-cat-card' + (isSelected ? ' active' : '')
      card.id = 'pos-sku-card-' + product.product_id
      card.setAttribute('role', 'button')
      const titleLine = formatPdpCollectionModelLine(product)
      const brandLine = String(product.brand_name || '').trim()
      const colourCountBit = product.colours.length > 1
        ? (product.colours.length + ' colours')
        : ''
      card.setAttribute('aria-label', [titleLine, brandLine, colourCountBit].filter(Boolean).join(' — '))
      card.setAttribute('tabindex', '0')
      card.dataset.productId = String(product.product_id)

      const displayColour = Number(activeColour.store_qty || 0) > 0
        ? activeColour
        : (product.colours.find(function (c) { return Number(c.store_qty || 0) > 0 }) || activeColour)
      card.dataset.skuId = String(displayColour.sku_id)
      const swatchActiveId = (selectedProductId && selectedProductId[0] === product.product_id)
        ? activeColour.sku_id
        : displayColour.sku_id

      const swatchRow = product.colours.length > 1
        ? `<div class="pos-lk-cat-swatches pos-sku-swatches" role="group" aria-label="Colours in stock">${buildSwatches(product, swatchActiveId, { showTrailingCount: false })}</div>`
        : ''
      const variantBadge = product.colours.length > 1
        ? `<span class="pos-lk-cat-variant-badge" aria-hidden="true">${product.colours.length} colours</span>`
        : ''

      const brandInner = brandLine
        ? `<span class="pos-lk-cat-brand">${escapeHtml(brandLine)}</span>`
        : '<span class="pos-lk-cat-brand pos-lk-cat-brand--empty" aria-hidden="true">\u00a0</span>'

      card.innerHTML = `
        <div class="pos-lk-cat-img-wrap">
          <div class="pos-lk-cat-img" aria-hidden="true">${typeEmoji(product.product_type)}</div>
          ${variantBadge}
        </div>
        <div class="pos-lk-cat-detail">
          <div class="pos-lk-cat-title">${escapeHtml(titleLine)}</div>
          <div class="pos-lk-cat-brand-slot">${brandInner}</div>
          <div class="pos-lk-cat-swatches-slot">${swatchRow}</div>
          <div class="pos-lk-cat-footer">
            <div class="pos-lk-cat-price-line">${inrFormat(displayColour.sale_price)}${lensCopy ? ' ' + escapeHtml(lensCopy) : ''}</div>
            <div class="pos-lk-cat-meta${deliveryClass}">${deliveryCopy}</div>
          </div>
        </div>
      `

      function openProductFor(c) {
        selectedProductId = [product.product_id, c.sku_id]
        pendingOrderSelection = { colour: c, product: product }
        navigate(productRoute(product.product_id, c.sku_id))
      }

      card.querySelectorAll('.pos-sku-swatch').forEach(function (sw) {
        sw.addEventListener('click', function (e) {
          e.preventDefault()
          e.stopPropagation()
          if (!hasStock) return
          const sid = Number(sw.getAttribute('data-sku-id'))
          const c = product.colours.find(function (x) { return x.sku_id === sid })
          if (!c) return
          if (Number(c.store_qty || 0) <= 0) {
            if (typeof cosmosToastWarn === 'function') {
              cosmosToastWarn('This colour is not available at this store.')
            }
            return
          }
          openProductFor(c)
        })
      })

      card.addEventListener('click', e => {
        if (!hasStock) return
        if (e.target.closest('.pos-sku-swatch')) return
        e.preventDefault()
        e.stopPropagation()
        openProductFor(displayColour)
      })

      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (hasStock) openProductFor(displayColour)
        }
      })

      catalogueResults.appendChild(card)

    })
  }

  /** Ensures grid matches selected brand even if API/SP ignores ?brand= (case-insensitive). */
  function filterPosCatalogueByBrand(products, brand) {
    if (!brand || !String(brand).trim()) return products
    const w = String(brand).trim().toLowerCase()
    return products.filter(function (p) {
      return String(p.brand_name || '').trim().toLowerCase() === w
    })
  }

  function renderCatalogueMeta(products, query) {
    const scopeLabel = activeCatalogueScope === 'store' ? 'Store catalogue' : 'Global catalogue'
    const totalVariants = products.reduce((acc, p) => acc + p.colours.length, 0)
    const hasQuery = Boolean(normalizeText(query))
    const brandSel = brandSelect && brandSelect.value ? brandSelect.value.trim() : ''
    const brandBit = brandSel ? ' · Brand: ' + brandSel : ''
    if (!hasQuery) {
      catalogueMeta.textContent = scopeLabel + brandBit + ': ' + products.length + ' models · ' + totalVariants + ' variants'
      return
    }
    catalogueMeta.textContent = scopeLabel + brandBit + ': ' + products.length + ' results for "' + query.trim() + '"'
  }

  async function loadCatalogueBrands() {
    if (!brandSelect) return
    const session = getPosSession()
    if (!session || !session.token) return
    const prev = brandSelect.value
    brandSelect.disabled = true
    try {
      const names = await apiGet('/api/pos/catalogue-brands?scope=' + encodeURIComponent(activeCatalogueScope), session.token)
      brandSelect.innerHTML = '<option value="">All brands</option>'
      if (Array.isArray(names)) {
        names.forEach(function (name) {
          const n = String(name || '').trim()
          if (!n) return
          const opt = document.createElement('option')
          opt.value = n
          opt.textContent = n
          brandSelect.appendChild(opt)
        })
      }
      if (prev && Array.prototype.some.call(brandSelect.options, function (o) { return o.value === prev })) {
        brandSelect.value = prev
      } else {
        brandSelect.value = ''
      }
    } catch (err) {
      brandSelect.innerHTML = '<option value="">All brands</option>'
      if (typeof cosmosToastError === 'function') cosmosToastError('Brands list failed: ' + err.message)
    } finally {
      brandSelect.disabled = false
    }
  }

  function showCatalogueSkeleton() {
    if (typeof cosmosSkeletonCards === 'function') {
      cosmosSkeletonCards('pos-catalogue-results', 6)
      return
    }
    catalogueResults.innerHTML = ''
  }

  async function triggerCatalogueSearch(useButton) {
    const query = searchInput.value || ''
    if (useButton) cosmosBtnLoading(btnSearch)
    showCatalogueSkeleton()

    const session = getPosSession()
    const q = query.trim()
    const brandQ = (brandSelect && brandSelect.value) ? String(brandSelect.value).trim() : ''
    let url = '/api/pos/catalogue?scope=' + activeCatalogueScope + (q ? '&q=' + encodeURIComponent(q) : '')
    if (brandQ) url += '&brand=' + encodeURIComponent(brandQ)

    try {
      let products = await apiGet(url, session && session.token)
      products = filterPosCatalogueByBrand(products, brandQ)
      lastLoadedProducts = products
      renderCatalogueMeta(products, query)
      renderCatalogueCards(products, query)
      const { colour } = getSelectedSku(products)
      if (!colour) selectedProductId = null
    } catch (err) {
      lastLoadedProducts = []
      renderEmptyState(query)
      catalogueMeta.textContent = ''
      cosmosToastError('Failed to load catalogue: ' + err.message)
    } finally {
      if (useButton) cosmosBtnDone(btnSearch)
    }
  }

  var posCatalogueScanRafId = null
  var posCatalogueScanLoopActive = false
  var posCatalogueScanEscHandler = null
  var posCatalogueScanDetector = null
  var posJsQrLoadPromise = null
  var posCatalogueScanCanvas = null
  var posCatalogueScanCtx = null
  var posCatalogueScanLastJsQrMs = 0
  var posCatalogueScanOverlayWired = false

  function ensureJsQrLoaded() {
    if (window.jsQR) return Promise.resolve()
    if (posJsQrLoadPromise) return posJsQrLoadPromise
    posJsQrLoadPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script')
      s.src = '/js/jsQR.min.js'
      s.async = true
      s.setAttribute('data-pos-jsqr', '1')
      s.onload = function () { resolve() }
      s.onerror = function () {
        posJsQrLoadPromise = null
        reject(new Error('jsQR load failed'))
      }
      document.head.appendChild(s)
    })
    return posJsQrLoadPromise
  }

  function stopPosCatalogueScan() {
    posCatalogueScanLoopActive = false
    if (posCatalogueScanRafId != null) {
      cancelAnimationFrame(posCatalogueScanRafId)
      posCatalogueScanRafId = null
    }
    if (posCatalogueScanEscHandler) {
      document.removeEventListener('keydown', posCatalogueScanEscHandler)
      posCatalogueScanEscHandler = null
    }
    document.body.classList.remove('pos-lk-modal-scroll-lock')
    var ov = document.getElementById('overlay-pos-catalogue-scan')
    if (ov) ov.classList.remove('open')
    var video = document.getElementById('pos-barcode-scan-video')
    if (video && video.srcObject) {
      try {
        video.srcObject.getTracks().forEach(function (t) { t.stop() })
      } catch (_e) { /* */ }
      video.srcObject = null
    }
    posCatalogueScanDetector = null
  }

  function bindPosCatalogueScanOverlay() {
    if (posCatalogueScanOverlayWired) return
    posCatalogueScanOverlayWired = true
    var bd = document.getElementById('pos-catalogue-scan-backdrop')
    var ds = document.getElementById('pos-catalogue-scan-dismiss')
    var cx = document.getElementById('pos-catalogue-scan-cancel')
    ;[bd, ds, cx].forEach(function (el) {
      if (!el) return
      el.addEventListener('click', function () { stopPosCatalogueScan() })
    })
  }

  async function applyCatalogueScanResult(raw) {
    var code = String(raw || '').trim()
    if (!code) return
    stopPosCatalogueScan()
    if (searchInput) searchInput.value = code
    await triggerCatalogueSearch(true)
  }

  function scheduleNextScanFrame(fn) {
    posCatalogueScanRafId = requestAnimationFrame(fn)
  }

  function runPosCatalogueScanFrame() {
    if (!posCatalogueScanLoopActive) return
    var video = document.getElementById('pos-barcode-scan-video')
    if (!video || video.readyState < 2) {
      scheduleNextScanFrame(runPosCatalogueScanFrame)
      return
    }

    if (posCatalogueScanDetector) {
      posCatalogueScanDetector.detect(video).then(function (codes) {
        if (!posCatalogueScanLoopActive) return
        if (codes && codes.length && codes[0].rawValue) {
          void applyCatalogueScanResult(codes[0].rawValue)
          return
        }
        scheduleNextScanFrame(runPosCatalogueScanFrame)
      }).catch(function () {
        if (posCatalogueScanLoopActive) scheduleNextScanFrame(runPosCatalogueScanFrame)
      })
      return
    }

    ensureJsQrLoaded().then(function () {
      if (!posCatalogueScanLoopActive) return
      var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
      if (now - posCatalogueScanLastJsQrMs < 200) {
        scheduleNextScanFrame(runPosCatalogueScanFrame)
        return
      }
      posCatalogueScanLastJsQrMs = now
      var vw = video.videoWidth
      var vh = video.videoHeight
      if (vw < 16 || vh < 16 || !window.jsQR) {
        scheduleNextScanFrame(runPosCatalogueScanFrame)
        return
      }
      if (!posCatalogueScanCanvas) {
        posCatalogueScanCanvas = document.createElement('canvas')
        posCatalogueScanCtx = posCatalogueScanCanvas.getContext('2d', { willReadFrequently: true })
      }
      var maxW = 480
      var tw = vw > maxW ? maxW : vw
      var th = Math.round((vh / vw) * tw)
      posCatalogueScanCanvas.width = tw
      posCatalogueScanCanvas.height = th
      posCatalogueScanCtx.drawImage(video, 0, 0, tw, th)
      var imageData
      try {
        imageData = posCatalogueScanCtx.getImageData(0, 0, tw, th)
      } catch (_e) {
        scheduleNextScanFrame(runPosCatalogueScanFrame)
        return
      }
      var res = window.jsQR(imageData.data, tw, th, { inversionAttempts: 'attemptBoth' })
      if (res && res.data) {
        void applyCatalogueScanResult(res.data)
        return
      }
      scheduleNextScanFrame(runPosCatalogueScanFrame)
    }).catch(function () {
      if (typeof cosmosToastError === 'function') {
        cosmosToastError('Could not load QR decoder. Try Chrome or Edge, or type the code manually.')
      }
      stopPosCatalogueScan()
    })
  }

  async function openPosCatalogueScanner(triggerBtn) {
    var ovOpen = document.getElementById('overlay-pos-catalogue-scan')
    if (ovOpen && ovOpen.classList.contains('open')) return
    if (!window.isSecureContext) {
      if (typeof cosmosToastWarn === 'function') {
        cosmosToastWarn('Camera needs a secure connection (HTTPS) or localhost.')
      }
      return
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Camera is not available on this device.')
      return
    }
    if (triggerBtn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(triggerBtn)
    var stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        audio: false
      })
    } catch (err) {
      if (triggerBtn && typeof cosmosBtnDone === 'function') cosmosBtnDone(triggerBtn)
      if (typeof cosmosToastError === 'function') {
        cosmosToastError(err && err.message ? err.message : 'Camera permission denied')
      }
      return
    }
    if (triggerBtn && typeof cosmosBtnDone === 'function') cosmosBtnDone(triggerBtn)

    posCatalogueScanDetector = null
    if (typeof BarcodeDetector !== 'undefined') {
      try {
        posCatalogueScanDetector = new BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'codabar', 'data_matrix']
        })
      } catch (_e) {
        try {
          posCatalogueScanDetector = new BarcodeDetector({ formats: ['qr_code'] })
        } catch (_e2) {
          posCatalogueScanDetector = null
        }
      }
    }

    var ov = document.getElementById('overlay-pos-catalogue-scan')
    var video = document.getElementById('pos-barcode-scan-video')
    if (!ov || !video) {
      stream.getTracks().forEach(function (t) { t.stop() })
      if (typeof cosmosToastError === 'function') cosmosToastError('Scanner UI is missing.')
      return
    }

    document.body.classList.add('pos-lk-modal-scroll-lock')
    ov.classList.add('open')
    video.setAttribute('playsinline', '')
    video.muted = true
    video.srcObject = stream
    try {
      await video.play()
    } catch (_e) {
      stream.getTracks().forEach(function (t) { t.stop() })
      document.body.classList.remove('pos-lk-modal-scroll-lock')
      ov.classList.remove('open')
      if (typeof cosmosToastError === 'function') cosmosToastError('Could not start camera preview.')
      return
    }

    posCatalogueScanLoopActive = true
    posCatalogueScanLastJsQrMs = 0
    posCatalogueScanEscHandler = function (e) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      stopPosCatalogueScan()
    }
    document.addEventListener('keydown', posCatalogueScanEscHandler)
    scheduleNextScanFrame(runPosCatalogueScanFrame)
  }

  function handleScopeChange(scope) {
    if (scope !== 'store' && scope !== 'global') return
    if (scope === activeCatalogueScope) return
    activeCatalogueScope = scope
    selectedProductId = null
    updateScopeButtons()
    if (brandSelect) brandSelect.value = ''
    loadCatalogueBrands().then(function () { triggerCatalogueSearch() })
  }

  function bindCatalogueEvents() {
    bindPosCatalogueScanOverlay()
    if (btnCatalogueScan) {
      btnCatalogueScan.addEventListener('click', function () { void openPosCatalogueScanner(btnCatalogueScan) })
    }
    btnScopeStore.addEventListener('click', () => handleScopeChange('store'))
    btnScopeGlobal.addEventListener('click', () => handleScopeChange('global'))

    searchInput.addEventListener('input', () => {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
      searchDebounceTimer = setTimeout(() => triggerCatalogueSearch(), 240)
    })

    searchInput.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      triggerCatalogueSearch(true)
    })

    btnSearch.addEventListener('click', () => triggerCatalogueSearch(true))
    if (btnHeaderCart) btnHeaderCart.addEventListener('click', () => navigate(POS_ROUTES.ORDER))

    if (btnPosCustomer) {
      btnPosCustomer.addEventListener('click', function () {
        var session = getPosSession()
        if (!session || !isSessionValid(session)) {
          navigate(POS_ROUTES.LOGIN)
          return
        }
        navigate(POS_ROUTES.ORDER)
        openPosCustomerPickerModal()
      })
    }
    if (brandSelect) {
      brandSelect.addEventListener('change', function () {
        selectedProductId = null
        triggerCatalogueSearch()
      })
    }
  }

  async function showCatalogueScreen(session) {
    await loadPosBootstrap(session)
    lastPaymentReceipt = null
    if (catalogueStaff) catalogueStaff.textContent = session.name + ' • ' + formatRole(session.role)
    if (catalogueStore) catalogueStore.textContent = session.store_name
    updateScopeButtons()
    searchInput.value = ''
    if (brandSelect) brandSelect.value = ''
    loadCatalogueBrands().then(function () {
      triggerCatalogueSearch()
    })
    showScreen('screen-pos-catalogue')
    try {
      if (sessionStorage.getItem(POS_CATALOGUE_WELCOME_ONCE)) {
        sessionStorage.removeItem(POS_CATALOGUE_WELCOME_ONCE)
        if (typeof cosmosToast === 'function') {
          var n = session && session.name ? String(session.name).trim() : ''
          var store = session && session.store_name ? String(session.store_name).trim() : ''
          var welcomeMsg = n
            ? ('Welcome back, ' + n + '!')
            : 'Welcome!'
          if (store) welcomeMsg += ' · ' + store
          cosmosToast(welcomeMsg, 'success', 2800)
        }
      }
    } catch (_e) { /* sessionStorage unavailable */ }
  }

  async function showProductPageScreen(session) {
    const sess = session || getPosSession()
    if (sess && sess.token) {
      await loadPosBootstrap(sess)
    }
    const selection = pendingOrderSelection
    if (!selection || !selection.colour || !selection.product) {
      navigate(POS_ROUTES.CATALOGUE)
      return
    }
    const colour = selection.colour
    const product = selection.product
    if (pdpProductTitle) pdpProductTitle.textContent = formatPdpCollectionModelLine(product)
    if (pdpBrand) pdpBrand.textContent = product.brand_name || ''
    if (pdpName) {
      const titleLine = formatPdpCollectionModelLine(product)
      const brandLine = String(product.brand_name || '').trim()
      pdpName.textContent = [titleLine, brandLine].filter(Boolean).join(' — ')
    }
    if (pdpPrice) pdpPrice.textContent = inrFormat(colour.sale_price || 0)
    if (pdpStrike) {
      const mrp = Number(colour.mrp || colour.sale_price || 0)
      const sale = Number(colour.sale_price || 0)
      const offPct = mrp > sale && mrp > 0 ? Math.round(((mrp - sale) / mrp) * 100) : 0
      pdpStrike.textContent = offPct > 0 ? (inrFormat(mrp) + '  (' + offPct + '% OFF)') : ''
      pdpStrike.style.display = offPct > 0 ? '' : 'none'
    }
    if (pdpDelivery) pdpDelivery.textContent = '⚡ Delivery by 6, May'
    if (pdpTotal) pdpTotal.textContent = inrFormat(colour.sale_price || 0)
    const inStoreEl = document.getElementById('pos-pdp-chip-instore')
    if (inStoreEl) {
      const inStock = Number(colour.store_qty || 0) > 0
      inStoreEl.textContent = inStock ? 'In Store' : 'Not at this store'
      inStoreEl.style.display = ''
    }
    renderPdpColourSwatches(sess, product, colour)
    const showWizard = lensWizardAllowed(product.product_type)
    var pdpHint = document.querySelector('#screen-pos-product .pos-lk-step-hint')
    if (pdpHint) {
      pdpHint.textContent = showWizard
        ? 'Step 1: review product details and tap Select Lenses.'
        : 'Review details and add this frame to your cart.'
    }
    if (btnPdpSelectLens) {
      btnPdpSelectLens.style.display = ''
      if (showWizard) {
        btnPdpSelectLens.textContent = 'Select Lenses'
        btnPdpSelectLens.setAttribute('aria-label', 'Open lens setup wizard')
      } else {
        btnPdpSelectLens.textContent = 'Add to cart'
        btnPdpSelectLens.setAttribute('aria-label', 'Add frame to cart — store pickup')
      }
    }
    showScreen('screen-pos-product')
  }

  async function resolveProductByIds(session, productId, skuId) {
    // Try in-memory cache first (no extra fetch if catalogue was already loaded)
    const cached = lastLoadedProducts.find(function (p) { return p.product_id === productId })
    if (cached) {
      const colour = cached.colours.find(function (c) { return c.sku_id === skuId }) || cached.colours[0]
      selectedProductId = [cached.product_id, colour.sku_id]
      pendingOrderSelection = { colour: colour, product: cached }
      if (colour.sku_id !== skuId) {
        history.replaceState({}, '', productRoute(cached.product_id, colour.sku_id))
      }
      await showProductPageScreen(session)
      return
    }
    // Cache miss — fetch the single product from the API
    showScreen('screen-pos-product')
    if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('pos-pdp-colour-swatches', 3)
    try {
      const results = await apiGet('/api/pos/catalogue?product_id=' + productId, session.token)
      const products = Array.isArray(results) ? results : (results && results.products ? results.products : [])
      const product = products.find(function (p) { return p.product_id === productId }) || products[0]
      if (!product) { navigate(POS_ROUTES.CATALOGUE); return }
      const colour = product.colours.find(function (c) { return c.sku_id === skuId }) || product.colours[0]
      selectedProductId = [product.product_id, colour.sku_id]
      pendingOrderSelection = { colour: colour, product: product }
      lastLoadedProducts = products.length ? products : lastLoadedProducts
      if (colour.sku_id !== skuId) {
        history.replaceState({}, '', productRoute(product.product_id, colour.sku_id))
      }
      await showProductPageScreen(session)
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError('Could not load product: ' + err.message)
      navigate(POS_ROUTES.CATALOGUE)
    }
  }

  function startLensFlowFromProduct() {
    if (!pendingOrderSelection || !pendingOrderSelection.colour || !pendingOrderSelection.product) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Select a product first.')
      navigate(POS_ROUTES.CATALOGUE)
      return
    }
    const newIdx = obCart.length
    addToCart(pendingOrderSelection)
    // addToCart may return early (qty>1 blocked) and NOT push — actual item may already be in cart.
    // Resolve the real index rather than blindly using newIdx.
    const skuId = pendingOrderSelection.colour.sku_id
    const actualIdx = obCart.length > newIdx ? newIdx : obCart.findIndex(function (l) { return l.sku_id === skuId })
    lensWizardLineIdx = actualIdx >= 0 ? actualIdx : newIdx
    lensWizardBackRoute = POS_ROUTES.PRODUCT
    resetLensWizardState()
    navigate(POS_ROUTES.LENS)
  }

  function resetLensWizardState() {
    lensWizard = {
      step: 0,
      subPhase: 'profile',
      powerType: null,
      category: null,
      pkg: null,
      addonIds: [],
      powerMode: null,
      brandFilter: 'all',
      customerName: lensWizard && lensWizard.customerName ? lensWizard.customerName : null,
      rx: { od: { sph: '', cyl: '', axis: '', plano: false }, os: { sph: '', cyl: '', axis: '', plano: false }, pd: '', doctor: '' }
    }
  }

  function syncCustomerPickerBannerAndActions() {
    var banner = document.getElementById('cust-picker-banner')
    var doneBtn = document.getElementById('cust-picker-btn-done')
    if (banner) {
      if (posSelectedCustomerSnapshot) {
        var ph = posSelectedCustomerSnapshot.phone ? ' · ' + posSelectedCustomerSnapshot.phone : ''
        banner.textContent = 'Selected: ' + posSelectedCustomerSnapshot.full_name + ph
      } else if (posSelectedCustomerId) {
        banner.textContent = 'Selected customer id: ' + posSelectedCustomerId
      } else {
        banner.textContent = 'No customer selected — optional for walk-in.'
      }
    }
    if (doneBtn) {
      doneBtn.textContent = posSelectedCustomerId ? 'Continue to cart' : 'Skip & continue to cart'
    }
  }

  function closePosCustomerPickerModal() {
    var overlay = document.getElementById('overlay-pos-customer-picker')
    if (!overlay || !overlay.classList.contains('open')) return
    overlay.classList.remove('open')
    posLkUnlockModalScroll()
  }

  function openPosCustomerPickerModal() {
    closeLensRxManualModal()
    closeLensNewCustomerModal()
    var overlay = document.getElementById('overlay-pos-customer-picker')
    if (!overlay) return
    syncCustomerPickerBannerAndActions()
    var pickSearch = document.getElementById('cust-picker-search-input')
    var pickResults = document.getElementById('cust-picker-results')
    if (pickSearch) pickSearch.value = ''
    if (pickResults) pickResults.innerHTML = ''
    var nm = document.getElementById('cust-picker-new-name')
    var ph = document.getElementById('cust-picker-new-phone')
    var em = document.getElementById('cust-picker-new-email')
    if (nm) {
      nm.value = ''
      if (typeof cosmosFieldClear === 'function') cosmosFieldClear(nm)
    }
    if (ph) {
      ph.value = ''
      if (typeof cosmosFieldClear === 'function') cosmosFieldClear(ph)
    }
    if (em) {
      em.value = ''
      if (typeof cosmosFieldClear === 'function') cosmosFieldClear(em)
    }
    var wasOpen = overlay.classList.contains('open')
    overlay.classList.add('open')
    if (!wasOpen) posLkLockModalScroll()
    window.requestAnimationFrame(function () {
      if (pickSearch) pickSearch.focus()
    })
  }

  async function runCustomerSearch() {
    const input = document.getElementById('cust-picker-search-input')
    const wrap = document.getElementById('cust-picker-results')
    const q = input ? input.value.trim() : ''
    const session = getPosSession()
    if (!session || !session.token) return
    if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('cust-picker-results', 4)
    try {
      const rows = await apiGet('/api/pos/customer-search?q=' + encodeURIComponent(q), session.token)
      if (!wrap) return
      wrap.innerHTML = ''
      if (!rows.length) {
        wrap.innerHTML = '<div class="pos-empty-sub">No customers found.</div>'
        return
      }
      rows.forEach(function (r) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'pos-cust-row tr-link'
        btn.innerHTML = '<span>' + (r.full_name || '') + '</span><span>' + (r.phone || '') + '</span>'
        btn.addEventListener('click', function () {
          setPosCustomerSelection(r.customer_id, r.full_name, r.phone)
          if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Customer selected')
          syncCustomerPickerBannerAndActions()
          leaveCustomerScreenToCart()
        })
        wrap.appendChild(btn)
      })
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
    }
  }

  async function handleCustomerCreate() {
    const session = getPosSession()
    if (!session || !session.token) return
    const nameEl = document.getElementById('cust-picker-new-name')
    const phoneEl = document.getElementById('cust-picker-new-phone')
    const emailEl = document.getElementById('cust-picker-new-email')
    const name = nameEl ? nameEl.value.trim() : ''
    const phone = phoneEl ? phoneEl.value.trim() : ''
    if (!name) {
      if (nameEl && typeof cosmosFieldError === 'function') cosmosFieldError(nameEl, 'Required')
      return
    }
    if (!phone) {
      if (phoneEl && typeof cosmosFieldError === 'function') cosmosFieldError(phoneEl, 'Required')
      return
    }
    var phoneParsed = parsePosCustomerMobileForSave(phone)
    if (!phoneParsed.ok) {
      if (phoneEl && typeof cosmosFieldError === 'function') cosmosFieldError(phoneEl, phoneParsed.message)
      return
    }
    const btn = document.getElementById('cust-picker-btn-create')
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn)
    try {
      const res = await apiPost('/api/pos/customer', {
        full_name: name,
        phone: phoneParsed.phone,
        email: emailEl && emailEl.value ? emailEl.value.trim() : null
      }, session.token)
      setPosCustomerSelection(res.data.customer_id, name, phoneParsed.phone)
      if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn)
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Customer created')
      leaveCustomerScreenToCart()
    } catch (err) {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn)
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
    }
  }

  function bindCustomerLensPayEvents() {
    const btnLensPrev = document.getElementById('btn-lens-prev')
    const btnLensNext = document.getElementById('btn-lens-next')
    if (btnLensPrev) btnLensPrev.addEventListener('click', lensWizardPrev)
    if (btnLensNext) btnLensNext.addEventListener('click', lensWizardNext)

    const btnPayBack = document.getElementById('btn-pay-back')
    if (btnPayBack) btnPayBack.addEventListener('click', () => {
      forceBalanceSettlement = false
      navigate(POS_ROUTES.ORDER)
    })
    const btnPaySubmit = document.getElementById('btn-pay-submit')
    if (btnPaySubmit) btnPaySubmit.addEventListener('click', function () { void submitPayment() })

    document.querySelectorAll('input[name="pos-lk-pay-method"]').forEach(function (r) {
      r.addEventListener('change', function () {
        document.querySelectorAll('.pos-lk-pay-row').forEach(function (row) {
          if (row.classList.contains('disabled')) return
          const inp = row.querySelector('input[name="pos-lk-pay-method"]')
          row.classList.toggle('selected', !!(inp && inp.checked))
        })
        const sel = document.getElementById('pay-method')
        if (sel && r.checked) sel.value = r.value
        const tw = document.getElementById('pos-lk-pay-tendered-wrap')
        if (tw) tw.classList.toggle('show', r.value === 'CASH')
        const cw = document.getElementById('pos-lk-pay-card-ref-wrap')
        if (cw) cw.style.display = r.value === 'CARD' ? '' : 'none'
      })
    })
    // Cash change calculator
    const tenderInput = document.getElementById('pay-tendered')
    if (tenderInput) {
      tenderInput.addEventListener('input', function () {
        const tendered = Number(this.value) || 0
        const due = Math.max(0, Number(paySessionSnapshot.amount) || 0)
        const changeEl = document.getElementById('pay-cash-change')
        if (changeEl) {
          if (tendered > 0 && tendered >= due) {
            const change = Math.round((tendered - due) * 100) / 100
            changeEl.textContent = 'Change: ' + formatRupees(change)
            changeEl.style.display = ''
          } else {
            changeEl.style.display = 'none'
          }
        }
      })
    }
    // Sync amount input → CTA button
    const amtInputBind = document.getElementById('pay-amount-input')
    if (amtInputBind) {
      amtInputBind.addEventListener('input', function () {
        const v = Math.max(0, Number(this.value) || 0)
        paySessionSnapshot.amount = v
        const span = document.getElementById('pay-cta-amt')
        if (span) span.textContent = formatRupees(v)
      })
    }

    if (btnPdpBack) btnPdpBack.addEventListener('click', () => navigate(POS_ROUTES.CATALOGUE))
    if (btnPdpSelectLens) {
      btnPdpSelectLens.addEventListener('click', function onPdpPrimaryClick() {
        if (!pendingOrderSelection || !pendingOrderSelection.product || !pendingOrderSelection.colour) {
          if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Select a product first.')
          navigate(POS_ROUTES.CATALOGUE)
          return
        }
        if (!lensWizardAllowed(pendingOrderSelection.product.product_type)) {
          addToCart(pendingOrderSelection)
          if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Added to cart.')
          navigate(POS_ROUTES.ORDER)
          return
        }
        startLensFlowFromProduct()
      })
    }

    // Breadcrumb navigation — clickable Cosmos brand link returns to its data-pos-nav target
    document.querySelectorAll('[data-pos-nav]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault()
        const target = el.getAttribute('data-pos-nav')
        if (target === 'catalogue') navigate(POS_ROUTES.CATALOGUE)
        else if (target === 'order') navigate(POS_ROUTES.ORDER)
      })
    })

    const btnConfirmBack = document.getElementById('btn-confirm-back')
    if (btnConfirmBack) btnConfirmBack.addEventListener('click', () => navigate(POS_ROUTES.CATALOGUE))
    const btnConfirmNew = document.getElementById('btn-confirm-new-order')
    if (btnConfirmNew) btnConfirmNew.addEventListener('click', () => navigate(POS_ROUTES.CATALOGUE))
    const btnConfirmPrint = document.getElementById('btn-confirm-print')
    if (btnConfirmPrint) {
      btnConfirmPrint.addEventListener('click', () => {
        if (typeof cosmosToastInfo === 'function') cosmosToastInfo('Print queued')
      })
    }
  }

  function lensWizardPrev() {
    closeAllPosLensOverlays()
    syncLensWizardStepNumber()
    const isInstantFrame = lensWizard.powerType === 'frame_only' || lensWizard.powerType === 'frame_sunglasses'
    if (lensWizard.step === 0) {
      navigate(lensWizardBackRoute || POS_ROUTES.ORDER)
      return
    }
    if (lensWizard.step === 2 && !isInstantFrame && lensWizard.subPhase === 'profile' && lensWizard.pkg && (lensWizard.pkg.addons || []).length) {
      lensWizard.subPhase = 'addons'
      renderLensStep()
      return
    }
    if (lensWizard.step === 2 && lensWizard.subPhase === 'addons') {
      lensWizard.step = 1
      lensWizard.subPhase = 'profile'
      renderLensStep()
      return
    }
    if (lensWizard.step > 0) {
      if (lensWizard.step === 2 && isInstantFrame) {
        lensWizard.step = 0
      } else {
        lensWizard.step -= 1
      }
      renderLensStep()
    }
  }

  function lensWizardNext() {
    closeAllPosLensOverlays()
    syncLensWizardStepNumber()
    const body = document.getElementById('lens-step-body')
    if (lensWizard.step === 0 && !lensWizard.category && lensWizard.powerType !== 'frame_only' && lensWizard.powerType !== 'frame_sunglasses') {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Pick a power type.')
      return
    }
    if (lensWizard.step === 1 && !lensWizard.pkg) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Pick a package.')
      return
    }
    if (lensWizard.step < 2) {
      lensWizard.step += 1
      renderLensStep()
      return
    }
    if (lensWizard.step === 2 && lensWizard.subPhase === 'addons') {
      lensWizard.subPhase = 'profile'
      renderLensStep()
      return
    }
    if (lensWizard.step === 2) {
      confirmLensWizard()
    }
  }

  function renderLensStep() {
    syncLensWizardStepNumber()
    const body = document.getElementById('lens-step-body')
    if (!body || !lensCatalogData) return
    if (lensWizard.step === 0) renderLensStep0PowerType(body)
    else if (lensWizard.step === 1) renderLensStep1LensSelection(body)
    else if (lensWizard.step === 2) renderLensStep2AddPower(body)
    body.classList.toggle('pos-lens-body--step1-split', lensWizard.step === 1)
    const lensStep2AddonsScroll =
      lensWizard.step === 2 &&
      lensWizard.subPhase === 'addons' &&
      lensWizard.pkg &&
      (lensWizard.pkg.addons || []).length > 0
    body.classList.toggle('pos-lens-body--step2-compact', lensWizard.step === 2 && !lensStep2AddonsScroll)
    refreshCheckout5Nav()
  }

  // ── Lens step 0 — Dynamic wizard_entries from /api/pos/lens-catalog ─────────
  function renderLensStep0PowerType(body) {
    const entries = (lensCatalogData && lensCatalogData.wizard_entries) || []
    const html = []
    html.push('<div class="pos-lk-lens-headrow">')
    html.push('  <div class="pos-lk-lens-section-title">Select your Power Type:</div>')
    html.push('</div>')
    if (entries.length === 0) {
      html.push(
        '<div class="pos-empty">' +
          '<div class="empty-ic">👁</div>' +
          '<div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">No lens options configured</div>' +
          '<div style="font-size:13px;color:var(--text2);margin-bottom:12px">Ask HQ to add lens categories in Foundry (Lens packages) and enable them for this product type.</div>' +
        '</div>'
      )
    } else {
      html.push('<div class="pos-lk-pt-list">')
      entries.forEach(function (entry) {
        var isSelected = false
        if (entry.kind === 'frame_only') {
          isSelected = lensWizard.powerType === 'frame_only'
        } else if (entry.kind === 'frame_sunglasses') {
          isSelected = lensWizard.powerType === 'frame_sunglasses'
        } else {
          isSelected = lensWizard.category && lensWizard.category.id === entry.category_id
        }
        var sel = isSelected ? ' selected' : ''
        var key = entry.kind === 'frame_only' ? 'frame_only' : (entry.kind === 'frame_sunglasses' ? 'frame_sunglasses' : ('cat_' + entry.category_id))
        var toneClass = lensWizardToneClass(entry.tone)
        html.push(
          '<button type="button" class="pos-lk-pt-card' + sel + '" data-lw-entry-key="' + key + '" tabindex="0">' +
            '<span class="pos-lk-pt-left">' +
              '<span class="pos-lk-pt-icon ' + toneClass + '">' + escapeHtml(entry.icon || '👁') + '</span>' +
              '<span class="pos-lk-pt-info">' +
                '<span class="pos-lk-pt-title">' + escapeHtml(entry.title) + '</span>' +
                (entry.subtitle ? '<span class="pos-lk-pt-sub">' + escapeHtml(entry.subtitle) + '</span>' : '') +
              '</span>' +
            '</span>' +
            '<span class="pos-lk-pt-chevron" aria-hidden="true">›</span>' +
          '</button>'
        )
      })
      html.push('</div>')
    }
    body.innerHTML = html.join('')
    body.querySelectorAll('[data-lw-entry-key]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-lw-entry-key')
        if (key === 'frame_only') {
          lensWizard.powerType = 'frame_only'
          lensWizard.category = null
          lensWizard.pkg = null
          lensWizard.addonIds = []
          lensWizard.step = 2
          lensWizard.subPhase = 'profile'
        } else if (key === 'frame_sunglasses') {
          lensWizard.powerType = 'frame_sunglasses'
          lensWizard.category = null
          lensWizard.pkg = null
          lensWizard.addonIds = []
          lensWizard.step = 2
          lensWizard.subPhase = 'profile'
        } else {
          var catId = Number(key.replace('cat_', ''))
          var cat = (lensCatalogData.categories || []).find(function (c) { return c.id === catId })
          if (!cat) return
          lensWizard.powerType = 'category'
          lensWizard.category = cat
          lensWizard.pkg = null
          lensWizard.addonIds = []
          lensWizard.brandFilter = 'all'
          lensWizard.step = 1
        }
        renderLensStep()
      })
    })
  }

  // ── Lens step 1 — lens packages for category chosen on step 0 (no category tabs) ────
  function renderLensStep1LensSelection(body) {
    if (!lensWizard.category) {
      // Cannot show lens packages without a power type → fall back.
      lensWizard.step = 0
      return renderLensStep()
    }
    const pkgsAll = (lensWizard.category && lensWizard.category.packages) ? lensWizard.category.packages : []
    const brandSet = {}
    pkgsAll.forEach(function (p) {
      const b = String((p && p.brand_label) || 'Other').trim() || 'Other'
      brandSet[b] = true
    })
    const brandList = Object.keys(brandSet).sort()
    const bf = lensWizard.brandFilter && lensWizard.brandFilter !== 'all' ? lensWizard.brandFilter : 'all'
    const pkgs = bf === 'all' ? pkgsAll : pkgsAll.filter(function (p) {
      return (String((p && p.brand_label) || 'Other').trim() || 'Other') === bf
    })
    const catName = String(lensWizard.category.name || '').trim()

    const html = []
    html.push('<div class="pos-lk-lens-step1-layout">')
    html.push('<div class="pos-lk-lens-step1-chrome">')
    html.push('<div class="pos-lk-lens-choose-card" role="region" aria-label="Lens package filter">')
    html.push('<div class="pos-lk-lens-headrow pos-lk-lens-headrow--brands">')
    html.push('  <div class="pos-lk-lens-head-left">')
    html.push('    <div class="pos-lk-lens-section-title">Choose your Lens:</div>')
    if (catName) {
      html.push('    <div class="pos-lk-lens-category-inline">' + escapeHtml(catName) + '</div>')
    }
    html.push('  </div>')
    if (brandList.length > 1) {
      html.push('  <div class="pos-lk-lens-brand-chips" role="toolbar" aria-label="Filter lens packages by brand">')
      html.push(
        '<button type="button" class="pos-lk-brand-chip' + (bf === 'all' ? ' is-active' : '') + '" data-brand-filter="all" aria-pressed="' + (bf === 'all' ? 'true' : 'false') + '" tabindex="0">All</button>'
      )
      brandList.forEach(function (b) {
        const on = bf === b
        html.push(
          '<button type="button" class="pos-lk-brand-chip' + (on ? ' is-active' : '') + '" data-brand-filter="' + escapeHtml(b) + '" aria-pressed="' + (on ? 'true' : 'false') + '" tabindex="0">' + escapeHtml(b) + '</button>'
        )
      })
      html.push('  </div>')
    }
    html.push('</div>')
    html.push('</div>')
    html.push('</div>')
    html.push('<div class="pos-lk-lens-step1-scroll">')
    html.push('<div class="pos-lk-lens-cards">')
    if (pkgs.length === 0) {
      html.push('<div class="pos-empty"><div class="pos-empty-sub">No lens packages for this filter. Try another brand.</div></div>')
    }
    pkgs.forEach(function (p, ix) {
      const isSel = lensWizard.pkg && lensWizard.pkg.id === p.id
      const newPrice = inrFormat(p.price)
      const mrp = Math.round((Number(p.price) || 0) * 1.6)
      const oldPrice = mrp > Number(p.price) ? inrFormat(mrp) : ''
      const thumbCls = (ix % 2 === 0) ? 'pos-lk-lens-thumb' : 'pos-lk-lens-thumb pos-lk-lens-thumb-2'
      const warrCls = (ix % 2 === 0) ? 'pos-lk-warranty-pill' : 'pos-lk-warranty-pill pos-lk-warranty-pill-2'
      html.push(
        '<button type="button" class="pos-lk-lens-card' + (isSel ? ' selected' : '') + '" data-pkg-id="' + p.id + '">' +
          '<div class="pos-lk-lens-thumb-col">' +
            '<div class="' + thumbCls + '" aria-hidden="true">👓</div>' +
            '<span class="' + warrCls + '">⚡ 1Y warranty</span>' +
          '</div>' +
          '<div class="pos-lk-lens-info">' +
            '<div class="pos-lk-lens-title">' + escapeHtml(p.name) + '</div>' +
            '<div class="pos-lk-lens-feat">• Premium coating   • Anti-Glare</div>' +
            '<div class="pos-lk-lens-feat">• Scratch resistant   • UV protection</div>' +
          '</div>' +
          '<div class="pos-lk-lens-price-col">' +
            '<span class="pos-lk-lens-fp">Frame + Lens</span>' +
            '<span class="pos-lk-lens-new">' + newPrice + '</span>' +
            (oldPrice ? '<span class="pos-lk-lens-old">' + oldPrice + '</span>' : '') +
          '</div>' +
        '</button>'
      )
    })
    html.push('</div>')
    html.push('</div>')
    html.push('</div>')
    body.innerHTML = html.join('')

    body.querySelectorAll('[data-brand-filter]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        lensWizard.brandFilter = chip.getAttribute('data-brand-filter') || 'all'
        renderLensStep()
      })
    })

    body.querySelectorAll('[data-pkg-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = Number(btn.getAttribute('data-pkg-id'))
        const pkg = pkgs.find(function (p) { return p.id === id })
        if (pkg) {
          lensWizard.pkg = pkg
          lensWizard.addonIds = []
          lensWizard.step = 2
          lensWizard.subPhase = (pkg.addons && pkg.addons.length) ? 'addons' : 'profile'
          renderLensStep()
        }
      })
    })
  }

  function lensWizardHasManualRxValues() {
    var rx = lensWizard.rx
    if (!rx) return false
    if (String(rx.pd || '').trim() || String(rx.doctor || '').trim()) return true
    var sides = ['od', 'os']
    for (var si = 0; si < sides.length; si++) {
      var row = rx[sides[si]] || {}
      if (String(row.sph || '').trim() || String(row.cyl || '').trim() || String(row.axis || '').trim()) return true
      if (row.plano) return true
    }
    return false
  }

  // ── Lens step 2 — Pencil 04-add-power: customer card + 4 power options ───
  function refreshLensCustomerBanner() {
    const customerName = lensWizard.customerName || (posSelectedCustomerId ? 'Selected customer #' + posSelectedCustomerId : 'Walk-in customer')
    const nameEl = document.getElementById('pos-lk-customer-name')
    const av = document.querySelector('#pos-lk-customer-card .pos-lk-customer-avatar')
    if (nameEl) nameEl.textContent = customerName
    if (av) av.textContent = (customerName || 'W').trim().charAt(0).toUpperCase()
  }

  function renderLensStep2AddPower(body) {
    const customerName = lensWizard.customerName || (posSelectedCustomerId ? 'Selected customer #' + posSelectedCustomerId : 'Walk-in customer')
    const initial = customerName ? customerName.trim().charAt(0).toUpperCase() : 'W'
    const isInstantFrame = lensWizard.powerType === 'frame_only' || lensWizard.powerType === 'frame_sunglasses'
    const hasPkgAddons = !isInstantFrame && lensWizard.pkg && (lensWizard.pkg.addons || []).length
    const showAddonsOnly = Boolean(hasPkgAddons && lensWizard.subPhase === 'addons')
    const showProfile = !showAddonsOnly
    if (showProfile && !isInstantFrame && !lensWizard.powerMode) {
      lensWizard.powerMode = 'later'
    }

    const html = []
    if (showProfile) {
      html.push('<div class="pos-lk-customer-card" id="pos-lk-customer-card">' +
        '<div class="pos-lk-customer-left">' +
          '<div class="pos-lk-customer-avatar">' + escapeHtml(initial) + '</div>' +
          '<div class="pos-lk-customer-meta">' +
            '<span class="pos-lk-customer-lbl">Shopping for</span>' +
            '<span class="pos-lk-customer-name" id="pos-lk-customer-name">' + escapeHtml(customerName) + '</span>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="pos-lk-text-link" id="pos-lk-customer-change">Change</button>' +
      '</div>')

      html.push('<div class="pos-lk-cust-dropdown" id="pos-lk-cust-dropdown" style="display:none">' +
        '<div class="pos-search-input-wrap">' +
          '<input id="pos-lk-cust-input" class="pos-search-input" type="search" autocomplete="off" placeholder="Search by phone or name" aria-label="Search customers">' +
          '<button type="button" id="pos-lk-cust-btn" class="pos-search-btn">Search</button>' +
        '</div>' +
        '<div class="pos-lk-cust-results" id="pos-lk-cust-results"></div>' +
        '<div style="font-size:12px;color:var(--text2);margin-top:4px">Walk-in is allowed if no customer is linked. Enter at least 2–3 digits of a phone number or the start of a name when searching.</div>' +
        '<div style="margin-top:12px">' +
          '<button type="button" class="pos-lk-text-link" id="pos-lk-walk-in-btn">Remove customer · continue as walk-in</button>' +
        '</div>' +
      '</div>')
    }

    if (showAddonsOnly && hasPkgAddons) {
      const addonRows = (lensWizard.pkg.addons || []).map(function (a) {
        const id = Number(a.id)
        const on = lensWizard.addonIds.indexOf(id) >= 0
        const nm = escapeHtml(String(a.name || '').trim() || 'Add-on')
        const pr = inrFormat(Number(a.price) || 0)
        return '<button type="button" class="pos-lk-addon-row' + (on ? ' pos-lk-addon-row--on' : '') + '" data-addon-id="' + id + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
          '<span class="pos-lk-addon-row-l"><span class="pos-lk-addon-check" aria-hidden="true"></span>' +
          '<span class="pos-lk-addon-name">' + nm + '</span></span>' +
          '<span class="pos-lk-addon-price">+ ' + pr + '</span></button>'
      }).join('')
      html.push(
        '<div class="pos-lk-addon-block" id="pos-lk-addon-block" role="region" aria-label="Lens add-ons">' +
          '<div class="pos-lk-addon-title">Lens add-ons</div>' +
          '<div class="pos-lk-addon-sub">From Foundry lens link matrix for this package.</div>' +
          '<div class="pos-lk-addon-card">' + addonRows + '</div>' +
        '</div>'
      )
      html.push('<p class="pos-lk-addon-next-hint">Use <strong>Next</strong> (footer) for customer &amp; prescription.</p>')
    } else if (showProfile && hasPkgAddons) {
      const selNames = (lensWizard.pkg.addons || []).filter(function (a) {
        return lensWizard.addonIds.indexOf(Number(a.id)) >= 0
      }).map(function (a) { return escapeHtml(String(a.name || '').trim()) })
      const line = selNames.length ? selNames.join(', ') : 'None selected'
      html.push('<div class="pos-lk-addon-summary" style="margin:12px 0;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:var(--card)">' +
        '<div style="font-size:12px;font-weight:600;color:var(--text1);margin-bottom:4px">Add-ons</div>' +
        '<div style="font-size:13px;color:var(--text2)">' + line + '</div></div>')
    }

    if (showProfile) {
      if (lensWizard.powerType === 'frame_only') {
        html.push('<div class="pos-lk-amber-banner pos-lk-banner--ok">' +
          '<span class="pos-lk-amber-banner-icon" aria-hidden="true">✓</span>' +
          '<span>Frame only — no lens power required.</span>' +
        '</div>')
      } else if (lensWizard.powerType === 'frame_sunglasses') {
        html.push('<div class="pos-lk-amber-banner pos-lk-banner--ok">' +
          '<span class="pos-lk-amber-banner-icon" aria-hidden="true">✓</span>' +
          '<span>Frame / sunglasses — no prescription lens package.</span>' +
        '</div>')
      } else {
        html.push('<div class="pos-lk-section-lbl">I don\'t know my power</div>')
        html.push(buildPowerCard('later',  '🕒', '#0D9F7B', 'Submit Power Later', 'Within 15 days of delivery'))

        html.push('<div class="pos-lk-section-lbl">I know my power</div>')
        html.push('<div class="pos-lk-know-power-region" role="group" aria-label="Power source options">')
        html.push(buildPowerCard('saved',   '🔖', '#2563EB', 'Saved Power',           '3 saved prescriptions for this customer'))
        html.push(buildPowerCard('manual',  '✎',  '#7C3AED', 'Enter Power Manually',  'SPH / CYL / AXIS'))
        if (lensWizard.powerMode === 'manual') {
          html.push(
            '<div class="pos-lk-rx-manual-cta" id="pos-lk-rx-manual-cta">' +
              '<button type="button" class="pos-lk-text-link" id="pos-lk-open-rx-modal">' +
                (lensWizardHasManualRxValues() ? 'Edit prescription values' : 'Enter prescription values') +
              '</button>' +
            '</div>'
          )
        }
        html.push(buildPowerCard('upload',  '⬆',  '#D97706', 'Upload Prescription',   'JPG / PDF · max 5 MB'))
        html.push('</div>')
      }
    }

    body.innerHTML = html.join('')

    body.querySelectorAll('[data-pwm-key]').forEach(function (el) {
      el.addEventListener('click', function () {
        const key = el.getAttribute('data-pwm-key')
        if (key !== 'manual') closeLensRxManualModal()
        lensWizard.powerMode = key
        if (key === 'manual') openLensRxManualModal()
        renderLensStep()
      })
    })

    const openRxBtn = document.getElementById('pos-lk-open-rx-modal')
    if (openRxBtn) openRxBtn.addEventListener('click', function () { openLensRxManualModal() })

    const change = document.getElementById('pos-lk-customer-change')
    const dd = document.getElementById('pos-lk-cust-dropdown')
    if (change && dd) {
      change.addEventListener('click', function () {
        dd.style.display = dd.style.display === 'none' ? 'flex' : 'none'
      })
    }
    const walkInLens = document.getElementById('pos-lk-walk-in-btn')
    if (walkInLens) {
      walkInLens.addEventListener('click', function () {
        closeLensNewCustomerModal()
        clearPosCustomerSelection()
        refreshLensCustomerBanner()
        if (dd) dd.style.display = 'none'
        if (typeof cosmosToastInfo === 'function') cosmosToastInfo('Customer removed for this order — walk-in.')
        maybeRefreshCartSidebar()
      })
    }
    const ddBtn = document.getElementById('pos-lk-cust-btn')
    if (ddBtn) ddBtn.addEventListener('click', function () { void runInlineCustomerSearch() })
    const ddInput = document.getElementById('pos-lk-cust-input')
    if (ddInput) {
      ddInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); void runInlineCustomerSearch() }
      })
    }

    const addonBlock = document.getElementById('pos-lk-addon-block')
    if (addonBlock) {
      addonBlock.querySelectorAll('.pos-lk-addon-row').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const id = Number(btn.getAttribute('data-addon-id'))
          if (!Number.isFinite(id)) return
          const ix = lensWizard.addonIds.indexOf(id)
          if (ix >= 0) lensWizard.addonIds.splice(ix, 1)
          else lensWizard.addonIds.push(id)
          const on = lensWizard.addonIds.indexOf(id) >= 0
          btn.classList.toggle('pos-lk-addon-row--on', on)
          btn.setAttribute('aria-pressed', on ? 'true' : 'false')
        })
      })
    }
  }

  function buildPowerCard(key, icon, color, title, sub) {
    const sel = lensWizard.powerMode === key ? ' selected' : ''
    return '<button type="button" class="pos-lk-power-card' + sel + '" data-pwm-key="' + key + '">' +
      '<span class="pos-lk-power-card-left">' +
        '<span class="pos-lk-power-icon" style="color:' + color + '">' + icon + '</span>' +
        '<span class="pos-lk-power-info">' +
          '<span class="pos-lk-power-title">' + escapeHtml(title) + '</span>' +
          (sub ? '<span class="pos-lk-power-sub">' + escapeHtml(sub) + '</span>' : '') +
        '</span>' +
      '</span>' +
      '<span class="pos-lk-pt-chevron" aria-hidden="true">›</span>' +
    '</button>'
  }

  function buildInlineRxForm() {
    function eyeBlock(side, label) {
      return '<div class="pos-lk-rx-eye-block">' +
        '<div class="pos-lk-rx-eye-lbl">' + label + '</div>' +
        '<div class="pos-lk-rx-fields">' +
          '<div class="pos-lk-rx-field"><span class="pos-lk-rx-field-lbl">SPH</span><input class="pos-lk-rx-input" data-rx-side="' + side + '" data-rx-axis="sph" placeholder="+0.00"></div>' +
          '<div class="pos-lk-rx-field"><span class="pos-lk-rx-field-lbl">CYL</span><input class="pos-lk-rx-input" data-rx-side="' + side + '" data-rx-axis="cyl" placeholder="−0.00"></div>' +
          '<div class="pos-lk-rx-field"><span class="pos-lk-rx-field-lbl">AXIS</span><input class="pos-lk-rx-input" data-rx-side="' + side + '" data-rx-axis="axis" placeholder="0°"></div>' +
        '</div>' +
        '<label class="pos-lk-rx-plano"><input type="checkbox" data-rx-plano="' + side + '"> <span>Plano ' + (side === 'od' ? 'OD' : 'OS') + '</span></label>' +
      '</div>'
    }
    return '<div class="pos-lk-rx-inline">' +
      '<div class="pos-lk-rx-grid">' + eyeBlock('od', 'RIGHT EYE (OD)') + eyeBlock('os', 'LEFT EYE (OS)') + '</div>' +
      '<div class="pos-lk-rx-fields" style="grid-template-columns: 1fr 2fr">' +
        '<div class="pos-lk-rx-field"><span class="pos-lk-rx-field-lbl">PD (mm)</span><input class="pos-lk-rx-input" id="pos-lk-rx-pd" placeholder="e.g. 63"></div>' +
        '<div class="pos-lk-rx-field"><span class="pos-lk-rx-field-lbl">DOCTOR (optional)</span><input class="pos-lk-rx-input" id="pos-lk-rx-doctor" placeholder="Doctor name"></div>' +
      '</div>' +
    '</div>'
  }

  function bindInlineRxHandlers() {
    document.querySelectorAll('.pos-lk-rx-input[data-rx-side]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        const side = inp.getAttribute('data-rx-side')
        const axis = inp.getAttribute('data-rx-axis')
        if (!lensWizard.rx[side]) lensWizard.rx[side] = { sph: '', cyl: '', axis: '', plano: false }
        lensWizard.rx[side][axis] = inp.value
      })
    })
    document.querySelectorAll('[data-rx-plano]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        const side = cb.getAttribute('data-rx-plano')
        if (!lensWizard.rx[side]) lensWizard.rx[side] = { sph: '', cyl: '', axis: '', plano: false }
        lensWizard.rx[side].plano = cb.checked
        document.querySelectorAll('.pos-lk-rx-input[data-rx-side="' + side + '"]').forEach(function (inp) {
          inp.disabled = cb.checked
          if (cb.checked) inp.value = ''
        })
      })
    })
    const pd = document.getElementById('pos-lk-rx-pd')
    const doc = document.getElementById('pos-lk-rx-doctor')
    if (pd) pd.addEventListener('input', function () { lensWizard.rx.pd = pd.value })
    if (doc) doc.addEventListener('input', function () { lensWizard.rx.doctor = doc.value })
  }

  function syncLensWizardRxFormFromModel() {
    var rx = lensWizard.rx || {}
    ;['od', 'os'].forEach(function (side) {
      var row = rx[side] || {}
      ;['sph', 'cyl', 'axis'].forEach(function (axis) {
        var inp = document.querySelector('.pos-lk-rx-input[data-rx-side="' + side + '"][data-rx-axis="' + axis + '"]')
        if (inp) inp.value = row[axis] != null ? String(row[axis]) : ''
      })
      var cb = document.querySelector('[data-rx-plano="' + side + '"]')
      if (cb) {
        cb.checked = !!row.plano
        document.querySelectorAll('.pos-lk-rx-input[data-rx-side="' + side + '"]').forEach(function (inp) {
          inp.disabled = !!row.plano
        })
      }
    })
    var pdEl = document.getElementById('pos-lk-rx-pd')
    if (pdEl) pdEl.value = rx.pd != null ? String(rx.pd) : ''
    var docEl = document.getElementById('pos-lk-rx-doctor')
    if (docEl) docEl.value = rx.doctor != null ? String(rx.doctor) : ''
  }

  function openLensRxManualModal() {
    closePosCustomerPickerModal()
    closeLensNewCustomerModal()
    var overlay = document.getElementById('overlay-pos-lens-rx-manual')
    var slot = document.getElementById('pos-lens-rx-manual-body')
    if (!overlay || !slot) return
    var wasOpen = overlay.classList.contains('open')
    slot.innerHTML = buildInlineRxForm()
    bindInlineRxHandlers()
    syncLensWizardRxFormFromModel()
    overlay.classList.add('open')
    if (!wasOpen) posLkLockModalScroll()
    window.requestAnimationFrame(function () {
      var el = slot.querySelector('.pos-lk-rx-input')
      if (el) el.focus()
    })
  }

  function closeLensRxManualModal() {
    var overlay = document.getElementById('overlay-pos-lens-rx-manual')
    if (!overlay || !overlay.classList.contains('open')) return
    overlay.classList.remove('open')
    var slot = document.getElementById('pos-lens-rx-manual-body')
    if (slot) slot.innerHTML = ''
    posLkUnlockModalScroll()
  }

  function closeAllPosLensOverlays() {
    closePosCustomerPickerModal()
    closeLensRxManualModal()
    closeLensNewCustomerModal()
  }

  function computeLensSearchPrefillForNewCustomer(q) {
    const t = String(q || '').trim()
    if (!t) return { name: '', phone: '' }
    const digits = t.replace(/\D/g, '')
    if (digits.length >= 8) return { name: '', phone: t }
    if (/[a-zA-Z\u00C0-\u024F\u0900-\u097F]/.test(t) && t.length >= 2) return { name: t, phone: '' }
    return { name: '', phone: '' }
  }

  function openLensNewCustomerModal(queryStr) {
    closePosCustomerPickerModal()
    closeLensRxManualModal()
    const pre = computeLensSearchPrefillForNewCustomer(queryStr)
    const overlay = document.getElementById('overlay-pos-lens-new-customer')
    const nameIn = document.getElementById('pos-lens-new-cust-name')
    const phoneIn = document.getElementById('pos-lens-new-cust-phone')
    const subEl = document.getElementById('pos-lens-new-cust-subtitle')
    const q = String(queryStr || '').trim()
    if (nameIn) {
      nameIn.value = pre.name
      if (typeof cosmosFieldClear === 'function') cosmosFieldClear(nameIn)
    }
    if (phoneIn) {
      phoneIn.value = pre.phone
      if (typeof cosmosFieldClear === 'function') cosmosFieldClear(phoneIn)
    }
    if (subEl) {
      subEl.textContent = q
        ? ('No match for “' + q.slice(0, 48) + (q.length > 48 ? '…' : '') + '”. Add a new customer to link to this order.')
        : 'Add a new customer to link to this order.'
    }
    if (!overlay) return
    var wasOpen = overlay.classList.contains('open')
    overlay.classList.add('open')
    if (!wasOpen) posLkLockModalScroll()
    window.requestAnimationFrame(function () {
      if (pre.name && !pre.phone && nameIn) nameIn.focus()
      else if (phoneIn) phoneIn.focus()
      else if (nameIn) nameIn.focus()
    })
  }

  function closeLensNewCustomerModal() {
    const overlay = document.getElementById('overlay-pos-lens-new-customer')
    if (!overlay || !overlay.classList.contains('open')) return
    overlay.classList.remove('open')
    posLkUnlockModalScroll()
  }

  async function submitLensModalNewCustomer(btn) {
    const session = getPosSession()
    if (!session || !session.token) return
    const nameEl = document.getElementById('pos-lens-new-cust-name')
    const phoneEl = document.getElementById('pos-lens-new-cust-phone')
    const name = nameEl ? nameEl.value.trim() : ''
    const phone = phoneEl ? phoneEl.value.trim() : ''
    if (!name) {
      if (nameEl && typeof cosmosFieldError === 'function') cosmosFieldError(nameEl, 'Required')
      return
    }
    if (!phone) {
      if (phoneEl && typeof cosmosFieldError === 'function') cosmosFieldError(phoneEl, 'Required')
      return
    }
    var phoneParsed = parsePosCustomerMobileForSave(phone)
    if (!phoneParsed.ok) {
      if (phoneEl && typeof cosmosFieldError === 'function') cosmosFieldError(phoneEl, phoneParsed.message)
      return
    }
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn)
    try {
      const res = await apiPost('/api/pos/customer', { full_name: name, phone: phoneParsed.phone, email: null }, session.token)
      setPosCustomerSelection(res.data.customer_id, name, phoneParsed.phone)
      closeLensNewCustomerModal()
      refreshLensCustomerBanner()
      const dd = document.getElementById('pos-lk-cust-dropdown')
      if (dd) dd.style.display = 'none'
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Customer created and linked.')
      maybeRefreshCartSidebar()
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
    } finally {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn)
    }
  }

  async function runInlineCustomerSearch() {
    const input = document.getElementById('pos-lk-cust-input')
    const wrap = document.getElementById('pos-lk-cust-results')
    const q = input ? input.value.trim() : ''
    const session = getPosSession()
    if (!session || !session.token || !wrap) return
    if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('pos-lk-cust-results', 3)
    try {
      const rows = await apiGet('/api/pos/customer-search?q=' + encodeURIComponent(q), session.token)
      wrap.innerHTML = ''
      if (!rows.length) {
        wrap.innerHTML =
          '<div class="pos-empty-sub">No customers found.</div>' +
          '<button type="button" class="pos-lk-text-link" style="display:block;margin-top:10px" id="pos-lk-open-add-cust-modal">Add new customer</button>'
        const reopen = document.getElementById('pos-lk-open-add-cust-modal')
        if (reopen) reopen.addEventListener('click', function () { openLensNewCustomerModal(q) })
        openLensNewCustomerModal(q)
        return
      }
      rows.forEach(function (r) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'pos-lk-cust-result'
        btn.innerHTML = '<span>' + escapeHtml(r.full_name || '') + '</span><span>' + escapeHtml(r.phone || '') + '</span>'
        btn.addEventListener('click', function () {
          setPosCustomerSelection(r.customer_id, r.full_name, r.phone)
          const nameElBanner = document.getElementById('pos-lk-customer-name')
          const nm = posSelectedCustomerSnapshot ? posSelectedCustomerSnapshot.full_name : ''
          if (nameElBanner) nameElBanner.textContent = nm
          const av = document.querySelector('#pos-lk-customer-card .pos-lk-customer-avatar')
          if (av) av.textContent = (nm || 'C').charAt(0).toUpperCase()
          const dd = document.getElementById('pos-lk-cust-dropdown')
          if (dd) dd.style.display = 'none'
          if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Customer selected')
          maybeRefreshCartSidebar()
        })
        wrap.appendChild(btn)
      })
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
    }
  }

  function confirmLensWizard() {
    syncLensWizardStepNumber()
    const line = resolveLensWizardCartLine()
    if (!line) {
      if (typeof cosmosToastError === 'function') cosmosToastError('No product selected.')
      return
    }
    const isInstantFrame = lensWizard.powerType === 'frame_only' || lensWizard.powerType === 'frame_sunglasses'
    try {
      if (!isInstantFrame) {
        if (!lensWizard.powerType) {
          if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Choose a power type.')
          lensWizard.step = 0
          renderLensStep()
          return
        }
        if (!lensWizard.pkg) {
          if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Choose a lens package.')
          lensWizard.step = 1
          renderLensStep()
          return
        }
        if (!lensWizard.category) {
          if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Lens category missing. Go back and pick a power type again.')
          lensWizard.step = 0
          renderLensStep()
          return
        }
        if (!lensWizard.powerMode) {
          lensWizard.powerMode = 'later'
        }
        const selAddons = (lensWizard.pkg.addons || []).filter(function (a) {
          return lensWizard.addonIds.indexOf(a.id) >= 0
        })
        const addonPrices = selAddons.map(function (a) { return Number(a.price) || 0 })
        line.lens_bundle = {
          category_id: lensWizard.category.id,
          package_id: lensWizard.pkg.id,
          addon_ids: lensWizard.addonIds.slice(),
          package_price: Number(lensWizard.pkg.price) || 0,
          addon_prices: addonPrices,
          package_name: String((lensWizard.pkg && lensWizard.pkg.name) || '').trim(),
          category_name: String((lensWizard.category && lensWizard.category.name) || '').trim()
        }
        line.power_mode = lensWizard.powerMode
        if (lensWizard.powerMode === 'manual') {
          line.rx = JSON.parse(JSON.stringify(lensWizard.rx))
        } else {
          line.rx = null
        }
        line.lab_status = lensWizard.powerMode === 'later' ? 'pending_power' : 'complete'
        line.fulfillment = 'LAB'
      } else {
        line.lens_bundle = null
        line.power_mode = lensWizard.powerType === 'frame_sunglasses' ? 'frame_sunglasses' : 'frame_only'
        line.rx = null
        line.lab_status = 'complete'
        line.fulfillment = 'INSTANT'
      }
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err && err.message ? err.message : 'Could not save lens setup.')
      return
    }
    saveCart()
    lensWizardLineIdx = -1
    navigate(POS_ROUTES.ORDER)
    if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Lens setup complete')
  }

  async function showLensWizardScreen(session) {
    await loadPosBootstrap(session)
    const lensLine = lensWizardLineIdx >= 0 ? obCart[lensWizardLineIdx] : null
    if (lensLine && !lensWizardAllowed(lensLine.product_type)) {
      lensWizardLineIdx = -1
      if (typeof cosmosToastInfo === 'function') {
        cosmosToastInfo('Lens setup is off for this product type — use store pickup.')
      }
      navigate(lensWizardBackRoute || POS_ROUTES.ORDER)
      return
    }
    const sessionTok = session.token
    if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('lens-step-body', 4)
    try {
      // Pass the current cart line's product_type so the API can filter wizard_entries correctly.
      var cartLine = lensWizardLineIdx >= 0 ? obCart[lensWizardLineIdx] : null
      var ptKey = cartLine ? String(cartLine.product_type || '').trim().toUpperCase() : ''
      var catalogUrl = '/api/pos/lens-catalog' + (ptKey ? '?product_type=' + encodeURIComponent(ptKey) : '')
      lensCatalogData = await apiGet(catalogUrl, sessionTok)
      if (!lensCatalogData.wizard_entries || lensCatalogData.wizard_entries.length === 0) {
        if (typeof cosmosToastWarn === 'function') {
          cosmosToastWarn('No lens options available for this product type. Configure in Foundry → Lens wizard rules.')
        }
      }
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
      navigate(POS_ROUTES.ORDER)
      return
    }
    // Preserve any choices the user already made (back navigation), only reset
    // when explicitly starting a fresh flow (handled in startLensFlowFromProduct).
    syncLensWizardStepNumber()
    renderLensStep()
    showScreen('screen-pos-lens')
  }

  async function showPaymentScreen(session) {
    const el = document.getElementById('pay-summary')
    function clearPaymentOffersPanel() {
      const payList = document.getElementById('pos-lk-pay-offers-list')
      const payHint = document.getElementById('pos-lk-pay-offers-hint')
      if (payList) payList.innerHTML = ''
      if (payHint) payHint.textContent = ''
    }
    showScreen('screen-pos-payment')
    setPosDeliveryMode(posDeliveryMode)
    if (!session || !session.token) {
      clearPaymentOffersPanel()
      return
    }
    if (!el || !lastCreatedOrder) {
      clearPaymentOffersPanel()
      return
    }
    if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('pay-summary', 4)
    paySessionSnapshot = { stage: 'FULL', amount: Number(lastCreatedOrder.total_amount) || 0 }
    payMinimumAdvanceAmount = 0
    payMinimumAdvancePct = Number(posSettings.lab_advance_pct) || 0
    try {
      const detail = await apiGet('/api/pos/orders/' + lastCreatedOrder.order_id, session.token)
      const order = detail.order
      const payments = detail.payments || []
      const total = Number(order.total_amount)
      const ps = detail.payment_summary
      const labLike = order.order_kind === 'LAB' || order.order_kind === 'MIXED'
      let advanceRemaining = 0
      let balanceRemaining = 0
      if (ps) {
        advanceRemaining = Number(ps.advance_remaining) || 0
        balanceRemaining = Number(ps.amount_remaining) || 0
      } else {
        const pct = Number(order.lab_advance_pct_snapshot) || 40
        // Match server logic: advance is pct% of pre-tax subtotal, not GST-inclusive total
        const subtotalForAdvance = Number(order.subtotal_amount) || total
        const advanceTarget = Math.round(subtotalForAdvance * (pct / 100) * 100) / 100
        let advPaid = 0
        for (let i = 0; i < payments.length; i++) {
          if (payments[i].stage === 'ADVANCE') advPaid += Number(payments[i].amount) || 0
        }
        advPaid = Math.round(advPaid * 100) / 100
        advanceRemaining = Math.max(0, Math.round((advanceTarget - advPaid) * 100) / 100)
        let paidAll = 0
        for (let j = 0; j < payments.length; j++) {
          paidAll += Number(payments[j].amount) || 0
        }
        paidAll = Math.round(paidAll * 100) / 100
        balanceRemaining = Math.max(0, Math.round((total - paidAll) * 100) / 100)
      }
      if (labLike && advanceRemaining > 0.009) {
        paySessionSnapshot = { stage: 'ADVANCE', amount: advanceRemaining }
      } else {
        paySessionSnapshot = { stage: 'FULL', amount: balanceRemaining }
      }
      let pctAdvDisplay = Number(order.lab_advance_pct_snapshot) || 40
      let advanceTargetDisplay = 0
      let advPaidDisplay = 0
      if (ps) {
        pctAdvDisplay = Number(ps.lab_advance_pct) || pctAdvDisplay
        advanceTargetDisplay = Number(ps.advance_target) || 0
        advPaidDisplay = Number(ps.paid_advance) || 0
      } else {
        const subtotalForAdv = Number(order.subtotal_amount) || total
        advanceTargetDisplay = Math.round(subtotalForAdv * (pctAdvDisplay / 100) * 100) / 100
        for (let k = 0; k < payments.length; k++) {
          if (payments[k].stage === 'ADVANCE') advPaidDisplay += Number(payments[k].amount) || 0
        }
        advPaidDisplay = Math.round(advPaidDisplay * 100) / 100
      }
      payMinimumAdvancePct = pctAdvDisplay
      // Use the server's advance_target (pre-tax basis) — NOT total_amount (GST-inclusive).
      // Recalculating from total inflates the minimum and causes "exceeds remaining advance" errors.
      payMinimumAdvanceAmount = advanceTargetDisplay > 0
        ? Math.round((advanceTargetDisplay - advPaidDisplay) * 100) / 100
        : Math.round((total * (pctAdvDisplay / 100)) * 100) / 100
      if (paySessionSnapshot.stage === 'ADVANCE' && advPaidDisplay <= 0.009) {
        paySessionSnapshot.amount = Math.max(paySessionSnapshot.amount, payMinimumAdvanceAmount)
      }
      if (forceBalanceSettlement) {
        paySessionSnapshot = { stage: 'BALANCE', amount: Math.max(0, balanceRemaining) }
      }
      let subHint = ''
      const subs = detail.sub_orders || []
      for (let j = 0; j < subs.length; j++) {
        if (subs[j].fulfillment === 'LAB') {
          subHint += '<div>Lab sub-order #' + subs[j].sub_order_id + ' — ' + (subs[j].lab_workflow_status || '') + '</div>'
        }
      }
      const orderLines = detail.lines || []
      // New Pencil-style summary panel — populate structured slots.
      const linesEl = document.getElementById('pay-summary-lines')
      if (linesEl) {
        let lh = ''
        if (orderLines.length === 0) {
          lh = '<div><span>Order ' + order.order_no + '</span><span>' + formatRupees(total) + '</span></div>'
        } else {
          for (let li = 0; li < orderLines.length; li++) {
            const l = orderLines[li]
            const nm = (l.product_name || l.sku_code || 'Item') + (l.lens_bundle ? ' + Lens' : '')
            const lt = Number(l.line_total)
            const alt = (Number(l.unit_price) || 0) * (Number(l.qty) || 1)
            lh += '<div><span>' + escapeHtml(nm) + '</span><span>' + formatRupees(!isNaN(lt) && lt > 0 ? lt : alt) + '</span></div>'
          }
        }
        linesEl.innerHTML = lh
      }
      // Subtotal / discount / GST / Total — align with persisted order row
      const sub = document.getElementById('pay-sub')
      const gstEl = document.getElementById('pay-gst')
      const gstLblEl = document.getElementById('pay-gst-lbl')
      const totEl = document.getElementById('pay-total')
      const discRow = document.getElementById('pay-discount-row')
      const discEl = document.getElementById('pay-discount')
      const orderSubtotal = Number(order.subtotal_amount)
      const orderDisc = order.discount_amount != null ? Number(order.discount_amount) : 0
      const gstOrderAmt = Number(order.gst_amount)
      const totalOrderAmt = Number(order.total_amount)
      if (sub) sub.textContent = formatRupees(orderSubtotal)
      if (discRow && discEl) {
        if (orderDisc > 0.009) {
          discRow.style.display = ''
          discEl.textContent = '−' + formatRupees(orderDisc)
        } else {
          discRow.style.display = 'none'
        }
      }
      if (gstEl) gstEl.textContent = formatRupees(gstOrderAmt)
      if (gstLblEl) gstLblEl.textContent = posGstLineLabel()
      if (totEl) totEl.textContent = formatRupees(totalOrderAmt)
      // Savings banner (computed from line discounts when available)
      let savings = 0
      for (let li = 0; li < orderLines.length; li++) {
        const l = orderLines[li]
        const mrp = Number(l.mrp) || 0
        const sale = Number(l.unit_price) || 0
        if (mrp > sale && mrp > 0) savings += (mrp - sale) * (Number(l.qty) || 1)
      }
      savings = Math.round(savings * 100) / 100
      const sb = document.getElementById('pos-lk-pay-savings')
      const sbt = document.getElementById('pos-lk-pay-savings-text')
      if (sb) sb.hidden = savings <= 0
      if (sbt) sbt.textContent = "You're saving " + formatRupees(savings) + " on this order"
      // ── Amount card: default to full balance, show advance info ────────
      const fullRemaining = Math.max(0, Math.round((total - (advPaidDisplay || 0)) * 100) / 100)
      // Default: collect full amount; staff can reduce to minimum advance
      if (!forceBalanceSettlement) {
        paySessionSnapshot = { stage: labLike && advanceRemaining > 0.009 ? 'ADVANCE' : 'FULL', amount: fullRemaining }
      }
      const collectAmt = Math.max(0, Number(paySessionSnapshot.amount) || 0)
      const amtInput = document.getElementById('pay-amount-input')
      const amtSpan = document.getElementById('pay-cta-amt')
      const amtBadge = document.getElementById('pay-advance-badge')
      const amtLabel = document.getElementById('pay-amount-stage-label')
      const amtHint = document.getElementById('pay-amount-hint')
      if (amtInput) {
        amtInput.value = collectAmt
        amtInput.min = payMinimumAdvanceAmount > 0 ? payMinimumAdvanceAmount : 1
        amtInput.max = fullRemaining
        // Replace handler so repeat visits to payment do not stack listeners.
        // Lab rule (server): BALANCE/FULL only after advance_target is covered by ADVANCE rows.
        // Full upfront must still post as stage ADVANCE — never FULL while advance_remaining > 0.
        amtInput.oninput = function () {
          const v = Math.max(0, Number(this.value) || 0)
          paySessionSnapshot.amount = v
          if (amtSpan) amtSpan.textContent = formatRupees(v)
          if (labLike && advanceRemaining > 0.009) {
            paySessionSnapshot.stage = 'ADVANCE'
            if (amtBadge) amtBadge.style.display = v < fullRemaining - 0.009 ? '' : 'none'
          } else {
            paySessionSnapshot.stage = 'FULL'
            if (amtBadge) amtBadge.style.display = 'none'
          }
          if (amtLabel) amtLabel.textContent = paySessionSnapshot.stage === 'ADVANCE' ? 'Advance to collect' : 'Amount to collect'
        }
      }
      if (amtSpan) amtSpan.textContent = formatRupees(collectAmt)
      if (amtBadge) amtBadge.style.display = labLike && advanceRemaining > 0.009 && collectAmt < fullRemaining - 0.009 ? '' : 'none'
      if (amtLabel) amtLabel.textContent = paySessionSnapshot.stage === 'ADVANCE' ? 'Advance to collect' : 'Amount to collect'
      if (amtHint) {
        if (labLike && payMinimumAdvanceAmount > 0.009) {
          amtHint.innerHTML = 'Min advance: <strong>' + formatRupees(payMinimumAdvanceAmount) + '</strong> (' + Math.round(payMinimumAdvancePct) + '%) · Full: <strong>' + formatRupees(fullRemaining) + '</strong>'
          amtHint.style.display = ''
        } else {
          amtHint.style.display = 'none'
        }
      }
      // Hidden legacy summary slot is left untouched.
      el.innerHTML = ''
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
      paySessionSnapshot = { stage: 'FULL', amount: Number(lastCreatedOrder.total_amount) || 0 }
      const fallbackTotal = Number(lastCreatedOrder.total_amount) || 0
      const linesEl2 = document.getElementById('pay-summary-lines')
      if (linesEl2) linesEl2.innerHTML = '<div><span>Order ' + lastCreatedOrder.order_no + '</span><span>' + formatRupees(fallbackTotal) + '</span></div>'
      const paySubFb = document.getElementById('pay-sub')
      const payGstFb = document.getElementById('pay-gst')
      const payGstLblFb = document.getElementById('pay-gst-lbl')
      const totEl2 = document.getElementById('pay-total')
      const discRowFb = document.getElementById('pay-discount-row')
      if (paySubFb) paySubFb.textContent = formatRupees(Number(lastCreatedOrder.subtotal_amount) || fallbackTotal)
      if (discRowFb) discRowFb.style.display = 'none'
      if (payGstFb) payGstFb.textContent = formatRupees(Number(lastCreatedOrder.gst_amount) || 0)
      if (payGstLblFb) payGstLblFb.textContent = posGstLineLabel()
      if (totEl2) totEl2.textContent = formatRupees(fallbackTotal)
      const amtInput2 = document.getElementById('pay-amount-input')
      if (amtInput2) amtInput2.value = fallbackTotal
      const amtSpan2 = document.getElementById('pay-cta-amt')
      if (amtSpan2) amtSpan2.textContent = formatRupees(fallbackTotal)
    }
    // Delivery sub-label
    const paySub = document.getElementById('pay-delivery-sub')
    if (paySub) {
      paySub.textContent = session && session.store_name ? session.store_name : 'Store'
    }
    // Default delivery date: today + 3 days (IST)
    const dateInput = document.getElementById('pay-delivery-date')
    if (dateInput && !dateInput.value) {
      const [d, m, y] = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).split('/')
      const base = new Date(y + '-' + m + '-' + d + 'T00:00:00+05:30')
      base.setDate(base.getDate() + 3)
      const dy = base.getFullYear()
      const dm = String(base.getMonth() + 1).padStart(2, '0')
      const dd2 = String(base.getDate()).padStart(2, '0')
      dateInput.value = dy + '-' + dm + '-' + dd2
    }
    const amtSpanFinal = document.getElementById('pay-cta-amt')
    if (amtSpanFinal) {
      const a = Math.max(0, Number(paySessionSnapshot.amount) || 0)
      amtSpanFinal.textContent = formatRupees(a)
    }
    await loadPosOffersPanel(session, 'pos-lk-pay-offers-list', null, true)
  }

  async function submitPayment() {
    if (submitPayment._inFlight) return
    submitPayment._inFlight = true
    try {
    const session = getPosSession()
    if (!session || !session.token || !lastCreatedOrder) return
    const methodEl = document.getElementById('pay-method')
    const rad = document.querySelector('input[name="pos-lk-pay-method"]:checked')
    const method = rad ? rad.value : (methodEl ? methodEl.value : 'UPI')
    if (methodEl) methodEl.value = method
    const tenderEl = document.getElementById('pay-tendered')
    const tendered = tenderEl && tenderEl.value ? Number(tenderEl.value) : null
    const cardRefEl = document.getElementById('pay-card-ref')
    const externalRef = cardRefEl && cardRefEl.value.trim() ? cardRefEl.value.trim() : null
    const btn = document.getElementById('btn-pay-submit')
    // Read amount from the editable input first, fallback to snapshot
    const amtInputEl = document.getElementById('pay-amount-input')
    if (amtInputEl && amtInputEl.value) paySessionSnapshot.amount = Math.max(0, Number(amtInputEl.value) || 0)
    const amt = Math.max(0, Number(paySessionSnapshot.amount) || 0)
    const orderDue = Math.max(0, Number(lastCreatedOrder.total_amount) || 0)
    if (amt <= 0 && orderDue > 0.009) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Enter a payment amount greater than zero.')
      return
    }
    if (amt <= 0 && orderDue <= 0.009) {
      /* Fully discounted / zero payable — still record settlement so invoice workflow runs. */
    }
    if (paySessionSnapshot.stage === 'ADVANCE' && amt + 0.01 < payMinimumAdvanceAmount) {
      if (typeof cosmosToastWarn === 'function') {
        cosmosToastWarn('Minimum advance is ' + formatRupees(payMinimumAdvanceAmount) + '. Reduce the amount or collect full payment.')
      }
      return
    }
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn)
    try {
      if (lastCreatedOrder.order_kind === 'LAB' && paySessionSnapshot.stage === 'FULL' && payMinimumAdvanceAmount > 0.009) {
        paySessionSnapshot.stage = 'ADVANCE'
      }
      const payBody = {
        order_id: lastCreatedOrder.order_id,
        stage: paySessionSnapshot.stage,
        method: orderDue <= 0.009 ? 'NONE' : method,
        amount: orderDue <= 0.009 ? 0 : amt,
        tendered: orderDue <= 0.009 ? null : method === 'CASH' ? tendered : null,
        external_ref: orderDue <= 0.009 ? null : method === 'CARD' ? externalRef : null
      }
      const payRes = await apiPost('/api/pos/payment', payBody, session.token)
      if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn)
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Payment recorded')
      // For ADVANCE stage: check if full balance is now settled (amount_remaining ≈ 0).
      // If so, fall through to confirm screen. Otherwise, stay on payment for balance collection.
      if (paySessionSnapshot.stage === 'ADVANCE') {
        const updatedSummary = payRes && payRes.data && payRes.data.payment_summary
        const stillDue = updatedSummary ? (Number(updatedSummary.amount_remaining) || 0) : -1
        if (stillDue > 0.009) {
          if (typeof cosmosToastInfo === 'function') {
            cosmosToastInfo('Advance saved. Balance due: ' + formatRupees(stillDue) + ' — collect when order is ready.')
          }
          void showPaymentScreen(session)
          return
        }
        // stillDue === 0 or unknown → treat as fully paid, go to confirm
      }
      const deliveryDateEl = document.getElementById('pay-delivery-date')
      const deliveryDate = deliveryDateEl ? deliveryDateEl.value : ''
      lastPaymentReceipt = {
        order_id: lastCreatedOrder.order_id,
        order_no: lastCreatedOrder.order_no,
        amount: amt,
        method: method,
        external_ref: externalRef,
        delivery_mode: posDeliveryMode,
        delivery_date: deliveryDate,
        customer_phone: lastCreatedOrder.customer_phone || '',
        invoice_no: (payRes && payRes.data && payRes.data.invoice_no) || (payRes && payRes.invoice_no) || null
      }
      lastCreatedOrder = null
      paySessionSnapshot = { stage: 'FULL', amount: 0 }
      forceBalanceSettlement = false
      obCart = []
      posSelectedOfferId = null
      clearCartStorage()
      navigate(POS_ROUTES.CONFIRM)
    } catch (err) {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn)
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
    }
    } finally {
      submitPayment._inFlight = false
    }
  }

  function showConfirmScreen() {
    const receipt = lastPaymentReceipt
    if (!receipt) {
      navigate(POS_ROUTES.CATALOGUE)
      return
    }
    const noEl = document.getElementById('confirm-order-no')
    const amtEl = document.getElementById('confirm-amount')
    const mEl = document.getElementById('confirm-method')
    if (noEl) noEl.textContent = 'Order #' + (receipt.order_no || '--')
    if (amtEl) amtEl.textContent = formatRupees(receipt.amount || 0)
    if (mEl) {
      const methodLabel = String(receipt.method || '').toUpperCase()
      const refPart = receipt.external_ref ? (' · Ref: ' + receipt.external_ref) : ''
      const inv = receipt.invoice_no ? (' · Invoice: ' + receipt.invoice_no) : ''
      const delPart = receipt.delivery_date
        ? ' · ' + (receipt.delivery_mode === 'HOME' ? 'Home delivery' : 'Pickup') + ' by ' + new Date(receipt.delivery_date).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' })
        : ''
      mEl.textContent = 'Paid via ' + methodLabel + refPart + inv + delPart
    }
    // WhatsApp button
    const waBtn = document.getElementById('btn-confirm-whatsapp')
    if (waBtn) {
      const phone = String(receipt.customer_phone || '').replace(/\D/g, '')
      if (phone.length >= 10) {
        const msg = encodeURIComponent(
          'Hi! Your Cosmos order #' + (receipt.order_no || '') + ' has been placed.\n' +
          'Amount paid: ' + formatRupees(receipt.amount || 0) + ' via ' + (receipt.method || '') +
          (receipt.invoice_no ? '\nInvoice: ' + receipt.invoice_no : '') +
          (receipt.delivery_date ? '\nExpected: ' + receipt.delivery_date : '') +
          '\nThank you!'
        )
        const wa = phone.length === 10 ? '91' + phone : phone
        waBtn.onclick = function () { window.open('https://wa.me/' + wa + '?text=' + msg, '_blank') }
        waBtn.disabled = false
        waBtn.style.opacity = '1'
      } else {
        waBtn.disabled = true
        waBtn.style.opacity = '0.4'
        waBtn.title = 'No customer phone number on this order'
      }
    }
    showScreen('screen-pos-confirm')
    void populateConfirmBreakdown(receipt)
  }

  async function populateConfirmBreakdown(receipt) {
    const breakEl = document.getElementById('confirm-breakdown')
    if (!breakEl) return
    const session = getPosSession()
    if (!receipt.order_id || !session || !session.token) {
      breakEl.innerHTML = ''
      return
    }
    if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('confirm-breakdown', 2)
    try {
      const detail = await apiGet('/api/pos/orders/' + receipt.order_id, session.token)
      const subs = detail.sub_orders || []
      const lines = detail.lines || []
      const storeName = (session && session.store_name) ? session.store_name : 'this store'

      function describeItems(set) {
        if (!set.length) return ''
        return set.map(function (l) { return (l.product_name || l.sku_code || 'Item') + (l.lens_bundle ? ' with ' + (l.lens_bundle.package_name || 'Standard Lenses') : ' (zero power)') }).join(' · ')
      }

      const instantLines = lines.filter(function (l) { return String(l.fulfillment || '').toUpperCase() !== 'LAB' })
      const labLines = lines.filter(function (l) { return String(l.fulfillment || '').toUpperCase() === 'LAB' })

      let html = '<div class="pos-lk-confirm-grid">'

      if (instantLines.length) {
        html += '<div class="pos-lk-confirm-pill">' +
          '<div class="pill-title" style="display:flex;align-items:center;gap:8px"><span aria-hidden="true" style="color:#D97706">⚡</span>Instant Pickup</div>' +
          '<div class="pill-sub">' + escapeHtml(instantLines.length + ' frame · ' + describeItems(instantLines)) + '</div>' +
          '<div class="pill-status">Pickup now from ' + escapeHtml(storeName) + '</div></div>'
      }
      if (labLines.length) {
        const labSub = subs.find(function (s) { return String(s.fulfillment || '').toUpperCase() === 'LAB' })
        const eta = (labSub && labSub.estimated_eta) ? labSub.estimated_eta : 'May 4 (5 days)'
        html += '<div class="pos-lk-confirm-pill">' +
          '<div class="pill-title" style="display:flex;align-items:center;gap:8px"><span aria-hidden="true" style="color:#2563EB">🚚</span>Lab Order</div>' +
          '<div class="pill-sub">' + escapeHtml(labLines.length + ' frame · ' + describeItems(labLines)) + '</div>' +
          '<div class="pill-status">Estimated delivery: ' + escapeHtml(eta) + '</div></div>'
      }
      if (!instantLines.length && !labLines.length) {
        html += '<div class="pos-lk-confirm-pill"><div class="pill-title">Thank you</div>' +
          '<div class="pill-sub">Your order is confirmed.</div><div class="pill-status">Details on the printed bill</div></div>'
      }
      html += '</div>'
      breakEl.innerHTML = html
    } catch (e) {
      breakEl.innerHTML = '<div class="pos-lk-confirm-pill"><div class="pill-sub">Line details unavailable.</div></div>'
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ORDER BUILDER
  // ═══════════════════════════════════════════════════════════════════════

  function formatRupees(amount) {
    return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  function formatRupeesDecimals(amount) {
    return '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function posGstLineLabel() {
    if (posSettings.composition_scheme) return 'GST (composition — not applicable)'
    if (posSettings.prices_gst_inclusive) return 'GST (inclusive catalogue)'
    return 'GST'
  }

  /** Match server totals for POS cart preview — discount on GST-inclusive subtotal when applicable. */
  function computePosCartTotals(rawSubtotal, discount) {
    var r = Number(posSettings.gst_rate) || 0
    var sub = Math.round(Number(rawSubtotal) * 100) / 100
    var disc = Math.max(0, Math.min(Math.round(Number(discount) * 100) / 100, sub))
    var net = Math.round((sub - disc) * 100) / 100
    if (posSettings.composition_scheme) {
      return { gst: 0, total: net }
    }
    if (posSettings.prices_gst_inclusive) {
      var denom = 1 + r
      if (denom <= 0) return { gst: 0, total: net }
      var taxable = Math.round((net / denom) * 100) / 100
      var gst = Math.round((net - taxable) * 100) / 100
      return { gst: gst, total: net }
    }
    var gstEx = Math.round(net * r * 100) / 100
    return { gst: gstEx, total: Math.round((net + gstEx) * 100) / 100 }
  }

  // Cache: sku_id → {brand_id, product_id, product_type} loaded from /api/pos/catalogue-scope-facts
  var posSkuScopeFacts = {}

  /**
   * Attempt to load scope facts for cart SKUs. Non-blocking — silently falls back to global matching on error.
   */
  function loadCartSkuScopeFacts(session) {
    var skuIds = obCart.map(function(l) { return l.sku_id }).filter(function(id) { return id && id > 0 })
    var missing = skuIds.filter(function(id) { return !posSkuScopeFacts[id] })
    if (!missing.length) return
    var url = '/api/pos/catalogue-scope-facts?sku_ids=' + missing.join(',')
    apiGet(url, session.token).then(function(data) {
      if (data && typeof data === 'object') {
        Object.assign(posSkuScopeFacts, data)
      }
      obRecalcTotals()
      scheduleServerDiscountPreview(session)
    }).catch(function() { /* silently ignore — scope facts are best-effort for client filter */ })
  }

  /**
   * Evaluate whether all non-empty scope dimensions of an offer match the given line's SKU facts.
   * AND across kinds, OR within each kind. Empty scopes = global (always match).
   */
  function offerScopeMatchesLine(offer, lineFacts) {
    var scopes = Array.isArray(offer.scopes) ? offer.scopes : []
    if (!scopes.length) return true
    var groups = {}
    for (var i = 0; i < scopes.length; i++) {
      var s = scopes[i]
      var k = String(s.kind || '')
      if (!groups[k]) groups[k] = []
      groups[k].push(s)
    }
    var kinds = Object.keys(groups)
    for (var ki = 0; ki < kinds.length; ki++) {
      var kind = kinds[ki]
      var rows = groups[kind]
      var lineVal = null
      if (kind === 'BRAND') lineVal = lineFacts.brand_id
      else if (kind === 'SKU') lineVal = lineFacts.sku_id
      else if (kind === 'PRODUCT') lineVal = lineFacts.product_id
      else if (kind === 'PRODUCT_TYPE') lineVal = lineFacts.product_type
      if (lineVal == null || lineVal === '') return false
      var matchAny = rows.some(function(r) {
        if (r.ref_int != null) return Number(r.ref_int) === Number(lineVal)
        if (r.ref_key != null) return String(r.ref_key).toLowerCase() === String(lineVal).toLowerCase()
        return false
      })
      if (!matchAny) return false
    }
    return true
  }

  /**
   * Compute eligible subtotal for an offer: sum of line totals whose SKU facts match offer scopes.
   * Falls back to full subtotal when scope facts are unavailable.
   */
  function computeEligibleSubtotalForOffer(offer) {
    var scopes = Array.isArray(offer.scopes) ? offer.scopes : []
    if (!scopes.length) {
      return obCart.reduce(function(s, l) { return s + computeLineDisplayUnit(l) * l.qty }, 0)
    }
    return obCart.reduce(function(s, l) {
      var facts = posSkuScopeFacts[l.sku_id] || { brand_id: null, product_id: null, product_type: l.product_type || null, sku_id: l.sku_id }
      facts.sku_id = l.sku_id
      if (!offerScopeMatchesLine(offer, facts)) return s
      return s + computeLineDisplayUnit(l) * l.qty
    }, 0)
  }

  function buildPosOrderLinesFromObCart() {
    return obCart.map(function (line) {
      var b = line.lens_bundle
      var qty = Math.max(1, parseInt(String(line.qty), 10) || 1)
      var unitPrice = Math.max(0, Number(line.frame_unit_price) || 0)
      var out = {
        sku_id: Number(line.sku_id),
        qty: qty,
        unit_price: unitPrice,
        product_type: String(line.product_type || '').trim(),
        fulfillment: line.fulfillment === 'LAB' ? 'LAB' : 'INSTANT',
        line_key: cartLineKey(line),
        lens_bundle: null
      }
      if (out.fulfillment === 'LAB' && b && b.package_id) {
        out.lens_bundle = {
          category_id: b.category_id != null ? Number(b.category_id) : null,
          package_id: Number(b.package_id),
          addon_ids: Array.isArray(b.addon_ids) ? b.addon_ids.map(function (x) { return Number(x) }) : [],
          package_price: Number(b.package_price) || 0,
          addon_prices: Array.isArray(b.addon_prices) ? b.addon_prices.map(function (x) { return Number(x) || 0 }) : []
        }
      }
      if (out.fulfillment === 'LAB') {
        out.lab_status = line.lab_status || null
      }
      if (line.pair_index != null && Number(line.pair_index) >= 1) {
        out.pair_index = Math.floor(Number(line.pair_index))
      }
      return out
    })
  }

  function buildObCartFingerprint() {
    var oid = posSelectedOfferId != null ? Number(posSelectedOfferId) : 0
    return JSON.stringify({
      c: posSelectedCustomerId || 0,
      o: Number.isFinite(oid) && oid > 0 ? oid : 0,
      lines: buildPosOrderLinesFromObCart()
    })
  }

  function scheduleServerDiscountPreview(session) {
    if (!session || !session.token) return
    if (!obCart.length) return
    if (posServerDiscountPreviewTimer) clearTimeout(posServerDiscountPreviewTimer)
    posServerDiscountPreviewTimer = setTimeout(function () {
      posServerDiscountPreviewTimer = null
      void runServerDiscountPreview(session)
    }, 280)
  }

  async function runServerDiscountPreview(session) {
    var gen = ++posDiscountPreviewSeq
    if (!obCart.length) {
      posServerDiscountPreview = null
      obRecalcTotals()
      return
    }
    var sig = buildObCartFingerprint()
    var lines = buildPosOrderLinesFromObCart()
    if (!lines.length) {
      posServerDiscountPreview = null
      obRecalcTotals()
      return
    }
    var selId = posSelectedOfferId != null ? Number(posSelectedOfferId) : null
    var hasOffer = selId != null && Number.isFinite(selId) && selId > 0
    if (!hasOffer) {
      posServerDiscountPreview = null
      if (gen === posDiscountPreviewSeq) {
        refreshPosOfferPickVisuals()
        obRecalcTotals()
      }
      return
    }
    try {
      var qp = posSelectedCustomerId ? ('?customer_id=' + encodeURIComponent(String(posSelectedCustomerId))) : ''
      var payload = { lines: lines, applied_offer_id: selId }
      var res = await apiPost('/api/pos/preview-order-discount' + qp, payload, session.token)
      if (gen !== posDiscountPreviewSeq) return
      var d = res && res.data ? res.data : {}
      posServerDiscountPreview = {
        amount: Math.max(0, Number(d.discount_amount) || 0),
        offerId: d.applied_offer_id != null && Number(d.applied_offer_id) > 0 ? Number(d.applied_offer_id) : null,
        cartSig: sig
      }
    } catch (e) {
      if (gen !== posDiscountPreviewSeq) return
      posServerDiscountPreview = null
      var msg = (e && e.message) ? String(e.message) : ''
      if (posSelectedOfferId && /not available|no longer active/i.test(msg)) {
        posSelectedOfferId = null
        posDiscountPreviewSeq++
        if (typeof cosmosToastWarn === 'function') cosmosToastWarn(msg)
      }
    }
    if (gen === posDiscountPreviewSeq) {
      refreshPosOfferPickVisuals()
      obRecalcTotals()
    }
  }

  /** PCT / FLAT only until server preview returns; structured promos rely on `/preview-order-discount`. */
  function computeClientPreviewForSelectedOffer(subtotal) {
    if (!posCartOffers || !posCartOffers.length || subtotal <= 0) return { amount: 0, offerId: null }
    var sid = posSelectedOfferId != null ? Number(posSelectedOfferId) : null
    if (sid == null || !Number.isFinite(sid) || sid < 1) return { amount: 0, offerId: null }
    var o = null
    for (var i = 0; i < posCartOffers.length; i++) {
      if (Number(posCartOffers[i].offer_id) === sid) {
        o = posCartOffers[i]
        break
      }
    }
    if (!o || !offerAppliesToCartContext(o)) return { amount: 0, offerId: null }
    var t = String(o.discount_type || '').trim().toUpperCase()
    var amt = 0
    if (t === 'PCT') {
      var p = effectiveOfferPct(o)
      var eligibleSub = computeEligibleSubtotalForOffer(o)
      amt = Math.round(eligibleSub * (p / 100) * 100) / 100
    } else if (t === 'FLAT') {
      var eligibleSubFlat = computeEligibleSubtotalForOffer(o)
      amt = Math.min(effectiveOfferFlat(o), eligibleSubFlat)
    }
    if (amt > subtotal) amt = subtotal
    if (amt <= 0) return { amount: 0, offerId: sid }
    return { amount: amt, offerId: sid }
  }

  function obRecalcTotals() {
    const subtotal = obCart.reduce(function (sum, line) {
      return sum + computeLineDisplayUnit(line) * line.qty
    }, 0)
    const sig = buildObCartFingerprint()
    let offerDisc = { amount: 0, offerId: null }
    const hasSel =
      posSelectedOfferId != null &&
      Number.isFinite(Number(posSelectedOfferId)) &&
      Number(posSelectedOfferId) > 0
    if (hasSel) {
      if (posServerDiscountPreview && posServerDiscountPreview.cartSig === sig) {
        offerDisc = {
          amount: posServerDiscountPreview.amount,
          offerId: posServerDiscountPreview.offerId
        }
      } else {
        offerDisc = computeClientPreviewForSelectedOffer(subtotal)
      }
    } else {
      offerDisc = { amount: 0, offerId: null }
    }
    const discount = Math.min(offerDisc.amount, subtotal)
    const tax = computePosCartTotals(subtotal, discount)
    const gst = tax.gst
    const total = tax.total
    if (obSubtotal) obSubtotal.textContent = formatRupees(subtotal)
    if (obDiscountLine) obDiscountLine.textContent = discount > 0 ? ('−' + formatRupees(discount)) : '−₹0'
    if (obGst) obGst.textContent = formatRupees(gst)
    if (obGstLbl) obGstLbl.textContent = posGstLineLabel()
    if (obTotal) obTotal.textContent = formatRupees(total)
    if (btnObProceed) {
      btnObProceed.disabled = obCart.length === 0
      btnObProceed.textContent = formatRupees(total) + ' · Proceed to payment'
    }
    if (obCartHeadingLine || headerCartCountEl) {
      const n = obCart.reduce(function (acc, line) { return acc + Math.max(1, Number(line.qty) || 0) }, 0)
      if (obCartHeadingLine) {
        obCartHeadingLine.textContent = n === 1 ? 'Cart · 1 item' : ('Cart · ' + n + ' items')
      }
      if (headerCartCountEl) {
        headerCartCountEl.textContent = String(n)
        headerCartCountEl.hidden = n <= 0
      }
    }
    const sessionRecalc = getPosSession()
    if (sessionRecalc && sessionRecalc.token && obCart.length) {
      scheduleServerDiscountPreview(sessionRecalc)
    }
    syncCartBillBenefitBox()
    syncCartAppliedOfferCard()
  }

  function cartLineRetailCardHtml(line, idx) {
    const rule = getTypeRule(line.product_type)
    const du = computeLineDisplayUnit(line)
    const qty = Math.max(1, Number(line.qty) || 0)
    const lineTotal = du * qty
    const frameUnit = Number(line.frame_unit_price) || 0
    const mrpListed = Number(line.mrp) > 0 ? Number(line.mrp) : frameUnit
    const lwp = rule ? String(rule.lens_wizard_policy || 'NEVER') : 'NEVER'
    const isDual = rule && rule.fulfillment_mode === 'DUAL' && lensWizardAllowed(line.product_type) && lwp !== 'REQUIRED'

    const brandName = String(line.brand_name || '').trim()
    const colourName = String(line.colour_name || '').trim()
    const rawTitle = String(line.product_name || '').replace(/\s+-\s+/, ' · ')
    // Display in title-case so "BOLD · 3120" renders as "Bold · 3120"
    const productTitle = rawTitle.replace(/\b\w+/g, function(w) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })

    const frameStrike = (mrpListed > frameUnit + 0.005)
      ? ('<span class="pos-lk-cart-strike">' + formatRupees(mrpListed) + '</span> ')
      : ''
    const framePriceHtml = frameStrike
      ? (frameStrike + '<span class="pos-lk-cart-price-now">' + formatRupees(frameUnit) + '</span>')
      : formatRupees(frameUnit)

    // Colour chip inline with product name
    const colourChip = colourName
      ? '<span class="pos-lk-cart-colour-chip">' + escapeHtml(colourName) + '</span>'
      : ''

    // Lens row — LAB complete: "PackageName · Category | ₹price", LAB pending: muted placeholder
    let lensRowHtml = ''
    if (line.fulfillment === 'LAB' && line.lab_status === 'complete' && line.lens_bundle) {
      const b = line.lens_bundle
      const lensP = Number(b.package_price) || 0
      let addonTotal = 0
      const aps = b.addon_prices || []
      for (let ai = 0; ai < aps.length; ai++) addonTotal += Number(aps[ai]) || 0
      const lensUnitTotal = lensP + addonTotal
      const pkgName = String(b.package_name || '').trim()
      const catName = String(b.category_name || '').trim()
      const addonNote = addonTotal > 0.005 ? ' + add-ons' : ''
      const parts = [pkgName, catName].filter(function (s, i, a) { return s && a.indexOf(s) === i })
      // Match Pencil: use middots; API often returns "EW - UV · Single Vision" style segments
      const lensLabelRaw = (parts.join(' · ') || 'Configured lens') + addonNote
      const lensLabel = lensLabelRaw.replace(/\s*[–—\-]\s*/g, ' · ')
      lensRowHtml =
        '<div class="pos-lk-cart-lens-row">' +
        '<span class="pos-lk-cart-lens-lbl">' + escapeHtml(lensLabel) + '</span>' +
        '<span class="pos-lk-cart-lens-price">' + formatRupees(lensUnitTotal) + '</span>' +
        '</div>'
    } else if (line.fulfillment === 'LAB') {
      lensRowHtml =
        '<div class="pos-lk-cart-lens-row pos-lk-cart-lens-row--pending">' +
        '<span class="pos-lk-cart-lens-lbl">Lens · pending setup</span>' +
        '<span class="pos-lk-cart-lens-price">—</span>' +
        '</div>'
    }

    const showFreeRibbon = lineTotal < 0.02
    const totalValHtml = showFreeRibbon
      ? '<span class="pos-lk-cart-free-val">Free</span>'
      : formatRupees(lineTotal)
    const ribbon = showFreeRibbon ? '<div class="pos-lk-cart-ribbon" aria-hidden="true">FREE</div>' : ''

    // Fulfillment toggle (dual-mode products only)
    const fulfillToggle = isDual
      ? '<div class="pos-ob-line-fulfill">' +
        '<button type="button" class="pos-ob-mini-btn' + (line.fulfillment === 'INSTANT' ? ' active' : '') + '" data-action="set-instant" data-idx="' + idx + '">Frame only</button>' +
        '<button type="button" class="pos-ob-mini-btn' + (line.fulfillment === 'LAB' ? ' active' : '') + '" data-action="set-lab" data-idx="' + idx + '">With lenses</button>' +
        '</div>'
      : ''

    // Configure-lenses CTA for pending LAB
    const configureBtn = (line.fulfillment === 'LAB' && line.lab_status !== 'complete')
      ? '<button type="button" class="pos-ob-mini-btn action-btn pos-lk-cart-config-btn" data-action="configure-lens" data-idx="' + idx + '">Select lenses →</button>'
      : ''

    const rxFoot = (line.fulfillment === 'LAB' && (line.lab_status === 'pending_power' || line.power_mode === 'later'))
      ? '<div class="pos-lk-cart-rx-foot"><span class="pos-lk-cart-rx-foot-ic" aria-hidden="true">✓</span> Upload prescription after payment.</div>'
      : ''

    const footerMeta = (fulfillToggle || configureBtn)
      ? '<div class="pos-lk-cart-v2-meta">' + fulfillToggle + configureBtn + '</div>'
      : ''

    return (
      '<div class="pos-lk-cart-item pos-lk-cart-item--v2">' +
      ribbon +
      '<div class="pos-lk-cart-v2-top">' +
        // Thumbnail: cream card with product-type emoji
        '<div class="pos-lk-cart-thumb" aria-hidden="true">' +
          '<span class="pos-lk-cart-thumb-emoji">' + typeEmoji(line.product_type) + '</span>' +
        '</div>' +
        '<div class="pos-lk-cart-v2-copy">' +
          // Row 1: brand | frame price
          '<div class="pos-lk-cart-row-brand-price">' +
            '<span class="pos-lk-cart-brand-lbl">' + escapeHtml(brandName || 'Product') + '</span>' +
            '<span class="pos-lk-cart-frame-price-val">' + framePriceHtml + '</span>' +
          '</div>' +
          // Row 2: product name + colour chip
          '<div class="pos-lk-cart-product-row">' +
            '<span class="pos-lk-cart-product-name">' + escapeHtml(productTitle) + '</span>' +
            colourChip +
          '</div>' +
          // Row 3: lens info (LAB) or nothing (instant)
          lensRowHtml +
          // Divider
          '<div class="pos-lk-cart-rule-dash" aria-hidden="true"></div>' +
          // Bottom: [−] [↻]  ·  Total ₹X
          '<div class="pos-lk-cart-total-row">' +
            '<div class="pos-lk-cart-qty-wrap">' +
              '<button type="button" class="pos-lk-cart-qty-btn' + (line.qty <= 1 ? ' pos-lk-cart-qty-btn--remove' : '') + '" data-action="' + (line.qty <= 1 ? 'remove' : 'dec') + '" data-idx="' + idx + '" aria-label="' + (line.qty <= 1 ? 'Remove item' : 'Decrease quantity') + '">−</button>' +
              (line.qty > 1 ? '<span class="pos-lk-cart-qty-num">' + line.qty + '</span>' : '') +
              '<button type="button" class="pos-lk-cart-qty-btn" data-action="repeat" data-idx="' + idx + '" aria-label="Duplicate">↻</button>' +
            '</div>' +
            '<div class="pos-lk-cart-total-section">' +
              '<span class="pos-lk-cart-total-lbl">Total</span>' +
              '<span class="pos-lk-cart-total-val">' + totalValHtml + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      footerMeta +
      rxFoot +
      '</div>'
    )
  }

  function obRenderCart() {
    if (!obCart_el) return
    updateKindChip()
    if (obCart.length === 0) {
      obCart_el.innerHTML =
        '<div class="pos-empty">' +
        '<div class="empty-ic" aria-hidden="true">🛒</div>' +
        '<div class="pos-empty-title">Cart is empty</div>' +
        '<div class="pos-empty-sub">Add a product from the catalogue to build an order.</div>' +
        '<button type="button" class="pos-empty-btn" data-action="empty-shop" tabindex="0">Browse catalogue</button>' +
        '</div>'
      if (btnObAddMore) btnObAddMore.hidden = true
      obRecalcTotals()
      syncRxSectionVisibility()
      return
    }

    if (btnObAddMore) btnObAddMore.hidden = false

    const instantLines = obCart.filter(function (l) { return l.fulfillment === 'INSTANT' })
    const labLines = obCart.filter(function (l) { return l.fulfillment === 'LAB' })

    const createLinesHTML = function (lines, title) {
      if (lines.length === 0) return ''
      const t = title != null && String(title).trim() !== '' ? String(title).trim() : ''
      const attrs = !t ? ' pos-lk-cart-group--no-title" role="group" aria-label="Lab order"' : '"'
      let html = '<div class="pos-lk-cart-group pos-lk-cart-group--v2' + attrs + '>'
      if (t) html += '<div class="pos-lk-cart-group-title">' + escapeHtml(t) + '</div>'
      lines.forEach(function (line) {
        const idx = obCart.indexOf(line)
        html += cartLineRetailCardHtml(line, idx)
      })
      html += '</div>'
      return html
    }

    obCart_el.innerHTML = createLinesHTML(instantLines, 'Instant pickup') + createLinesHTML(labLines)
    obRecalcTotals()
    syncRxSectionVisibility()
  }

  function obHandleCartClick(e) {
    const btn = e.target.closest('[data-action]')
    if (!btn) return
    const action = btn.dataset.action
    if (action === 'empty-shop') {
      navigate(POS_ROUTES.CATALOGUE)
      return
    }
    const idx = Number(btn.dataset.idx)
    if (action === 'inc') {
      const rule = getTypeRule(obCart[idx].product_type)
      if (rule && !rule.allow_qty_gt_1 && obCart[idx].qty >= 1) return
      obCart[idx].qty += 1
    } else if (action === 'dec') {
      if (obCart[idx].qty > 1) obCart[idx].qty -= 1
    } else if (action === 'remove') {
      obCart.splice(idx, 1)
    } else if (action === 'repeat') {
      if (!Number.isFinite(idx) || !obCart[idx]) return
      const rptRule = getTypeRule(obCart[idx].product_type)
      if (rptRule && !rptRule.allow_qty_gt_1) {
        if (typeof cosmosToastWarn === 'function') cosmosToastWarn('This product allows only one line — use + to change quantity if enabled.')
        return
      }
      const copy = JSON.parse(JSON.stringify(obCart[idx]))
      obCart.splice(idx + 1, 0, copy)
    } else if (action === 'set-instant') {
      obCart[idx].fulfillment = 'INSTANT'
      obCart[idx].lab_status = null
      obCart[idx].lens_bundle = null
    } else if (action === 'set-lab') {
      if (!obCart[idx] || !lensWizardAllowed(obCart[idx].product_type)) {
        if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Lenses aren’t enabled for this product type.')
        return
      }
      lensWizardBackRoute = POS_ROUTES.ORDER
      obCart[idx].fulfillment = 'LAB'
      obCart[idx].lab_status = 'incomplete'
      obCart[idx].lens_bundle = null
      lensWizardLineIdx = idx
      pendingResumeOrder = true
      resetLensWizardState()
      saveCart()
      navigate(POS_ROUTES.LENS)
      return
    } else if (action === 'configure-lens') {
      if (!obCart[idx] || !lensWizardAllowed(obCart[idx].product_type)) {
        if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Lenses aren’t enabled for this product type.')
        return
      }
      lensWizardBackRoute = POS_ROUTES.ORDER
      lensWizardLineIdx = idx
      pendingResumeOrder = true
      resetLensWizardState()
      saveCart()
      navigate(POS_ROUTES.LENS)
      return
    }
    saveCart()
    obRenderCart()
  }

  function addToCart(selection) {
    const colour = selection && selection.colour
    const product = selection && selection.product
    if (!colour || !product) return
    const rule = getTypeRule(product.product_type)
    let fulfillment = defaultFulfillmentForRule(rule)
    const lwp = rule ? String(rule.lens_wizard_policy || 'NEVER') : 'NEVER'
    if (rule && rule.fulfillment_mode === 'DUAL' && lwp === 'REQUIRED') {
      fulfillment = 'LAB'
    }
    const candidate = {
      product_id: product.product_id,
      sku_id: colour.sku_id,
      sku_code: colour.sku_code,
      product_name: product.product_name,
      brand_name: product.brand_name,
      colour_name: colour.colour_name,
      product_type: product.product_type || '',
      frame_unit_price: colour.sale_price || 0,
      mrp: Number(colour.mrp) > 0 ? Number(colour.mrp) : (Number(colour.sale_price) || 0),
      qty: 1,
      fulfillment: fulfillment,
      lab_status: fulfillment === 'LAB' ? 'incomplete' : null,
      rx_required: rule ? rule.rx_required : false,
      lens_bundle: null
    }
    const key = cartLineKey(candidate)
    const existing = obCart.find(function (line) { return cartLineKey(line) === key })
    if (existing) {
      const r = getTypeRule(existing.product_type)
      if (r && !r.allow_qty_gt_1) return
      existing.qty += 1
    } else {
      obCart.push(candidate)
    }
    saveCart()
  }

  async function showOrderBuilderScreen(session, selection) {
    if (session && session.token) await loadPosBootstrap(session)
    obStaffEl.textContent = session.name + ' • ' + formatRole(session.role)
    obStoreEl.textContent = session.store_name
    obCart = []
    posSelectedOfferId = null
    clearCartStorage()
    if (selection) addToCart(selection)
    updateKindChip()
    syncRxSectionVisibility()
    obRenderCart()
    refreshCartSidebar(session)
    showScreen('screen-pos-order-builder')
    void tryOfferCheckoutDraftBanner(session)
  }

  async function showOrderBuilderScreenResume(session) {
    if (session && session.token) await loadPosBootstrap(session)
    obStaffEl.textContent = session.name + ' • ' + formatRole(session.role)
    obStoreEl.textContent = session.store_name
    updateKindChip()
    syncRxSectionVisibility()
    obRenderCart()
    refreshCartSidebar(session)
    showScreen('screen-pos-order-builder')
    void tryOfferCheckoutDraftBanner(session)
  }

  function bindOrderBuilderEvents() {
    btnObBack.addEventListener('click', () => navigate(POS_ROUTES.CATALOGUE))
    btnObAddMore.addEventListener('click', () => navigate(POS_ROUTES.CATALOGUE))

    obCart_el.addEventListener('click', obHandleCartClick)

    btnObProceed.addEventListener('click', () => { void handleProceedToPayment() })

    const btnDraft = document.getElementById('btn-ob-save-draft')
    if (btnDraft) {
      btnDraft.addEventListener('click', function () { void savePosCheckoutDraft(btnDraft) })
    }

    if (btnCartApplyCoupon) {
      btnCartApplyCoupon.addEventListener('click', function () {
        setCartCouponOverlayOpen(true)
        const session = getPosSession()
        if (session && session.token) void loadCartOffers(session)
      })
    }
    if (btnCartCouponBack) {
      btnCartCouponBack.addEventListener('click', function () { setCartCouponOverlayOpen(false) })
    }
    if (backdropCartCoupon) {
      backdropCartCoupon.addEventListener('click', function () { setCartCouponOverlayOpen(false) })
    }
    if (btnCartCouponSearch) {
      btnCartCouponSearch.addEventListener('click', function () {
        const session = getPosSession()
        if (session && session.token) void loadCartOffers(session)
      })
    }
    if (cartCouponSearchInput) {
      cartCouponSearchInput.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return
        e.preventDefault()
        const session = getPosSession()
        if (session && session.token) void loadCartOffers(session)
      })
    }
    if (btnCartOfferRemove) {
      btnCartOfferRemove.addEventListener('click', function () {
        posSelectedOfferId = null
        posServerDiscountPreview = null
        posDiscountPreviewSeq++
        obRecalcTotals()
        refreshPosOfferPickVisuals()
        syncCartAppliedOfferCard()
      })
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return
      if (!overlayCartCoupons || !overlayCartCoupons.classList.contains('open')) return
      e.preventDefault()
      setCartCouponOverlayOpen(false)
    })
    setCartCouponOverlayOpen(false)
    if (btnCartCustomerChange) {
      btnCartCustomerChange.addEventListener('click', function () {
        clearPosCustomerSelection()
        renderCartCustomerRef()
        openPosCustomerPickerModal()
      })
    }
    if (btnCartCustomerSearch) {
      btnCartCustomerSearch.addEventListener('click', function () {
        openPosCustomerPickerModal()
      })
    }
    const btnIns = document.getElementById('btn-cart-apply-insurance')
    if (btnIns) {
      btnIns.addEventListener('click', function () {
        if (typeof cosmosToastInfo === 'function') cosmosToastInfo('Eyewoot Secure benefits are not enabled for this store yet.')
      })
    }
  }

  async function savePosCheckoutDraft(btn) {
    const session = getPosSession()
    if (!session || !session.token) return
    if (!obCart.length) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Cart is empty — nothing to save.')
      return
    }
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn)
    try {
      await apiPost('/api/pos/checkout-draft', {
        cart_json: obCart,
        checkout_stage: 5,
        delivery_mode: posDeliveryMode,
        customer_id: posSelectedCustomerId
      }, session.token)
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Draft saved for this tablet & staff.')
      const ban = document.getElementById('pos-ob-draft-banner')
      if (ban) { ban.hidden = true; ban.innerHTML = '' }
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
    } finally {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn)
    }
  }

  async function posFetchDeleteDraft(session) {
    await ensureCosmosApiKeyFromBootstrap()
    await fetch('/api/pos/checkout-draft', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': getApiKey(),
        Authorization: 'Bearer ' + session.token
      }
    })
  }

  async function tryOfferCheckoutDraftBanner(session) {
    const ban = document.getElementById('pos-ob-draft-banner')
    if (!ban || !session || !session.token || obCart.length > 0) {
      if (ban) { ban.hidden = true; ban.innerHTML = '' }
      return
    }
    try {
      const data = await apiGet('/api/pos/checkout-draft', session.token)
      const d = data && data.draft
      if (!d || !d.cart || !Array.isArray(d.cart) || d.cart.length === 0) {
        ban.hidden = true
        ban.innerHTML = ''
        return
      }
      const updated = d.updated_at ? new Date(d.updated_at).toLocaleString('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }) : ''
      ban.hidden = false
      ban.innerHTML =
        '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;justify-content:space-between">' +
        '<div style="font-size:13px;color:var(--text1)">Saved draft' + (updated ? ' · ' + updated : '') + '</div>' +
        '<div style="display:flex;gap:8px">' +
        '<button type="button" class="pos-ob-mini-btn" id="pos-ob-draft-dismiss">Dismiss</button>' +
        '<button type="button" class="pos-ob-mini-btn action-btn" id="pos-ob-draft-restore">Restore draft</button>' +
        '</div></div>'
      const dismiss = document.getElementById('pos-ob-draft-dismiss')
      const restore = document.getElementById('pos-ob-draft-restore')
      if (dismiss) {
        dismiss.addEventListener('click', async function () {
          try {
            await posFetchDeleteDraft(session)
          } catch (_e) { /* ignore */ }
          ban.hidden = true
          ban.innerHTML = ''
        })
      }
      if (restore) {
        restore.addEventListener('click', async function () {
          obCart = d.cart
          saveCart()
          if (d.delivery_mode === 'HOME' || d.delivery_mode === 'STORE') {
            posDeliveryMode = d.delivery_mode === 'HOME' ? 'HOME' : 'STORE'
            if (typeof setPosDeliveryMode === 'function') setPosDeliveryMode(posDeliveryMode)
          }
          if (d.customer_id) {
            posSelectedCustomerId = Number(d.customer_id)
          }
          ban.hidden = true
          ban.innerHTML = ''
          obRenderCart()
          refreshCartSidebar(session)
          if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Draft restored into cart.')
          try {
            await posFetchDeleteDraft(session)
          } catch (_e) { /* ignore */ }
        })
      }
    } catch (_err) {
      if (ban) { ban.hidden = true; ban.innerHTML = '' }
    }
  }

  /** Ends staff POS session only — tablet JWT is kept until "Sign out this tablet". */
  async function performPosStaffLogout() {
    var sess = getPosSession()
    if (sess && sess.token) {
      try {
        await apiPost('/api/pos/session/cancel', { cancel_reason: 'staff_logout' }, sess.token)
      } catch (_e) { /* non-fatal */ }
    }
    clearPosSession()
    obCart = []
    clearCartStorage()
    pendingResumeOrder = false
    pendingOrderSelection = null
    clearPosCustomerSelection()
    selectedProductId = null
    lensWizardLineIdx = -1
    lensWizardBackRoute = POS_ROUTES.ORDER
    lensWizard = {
      step: 0,
      subPhase: 'profile',
      powerType: null,
      category: null,
      pkg: null,
      addonIds: [],
      powerMode: null,
      brandFilter: 'all',
      rx: { od: { sph: '', cyl: '', axis: '', plano: false }, os: { sph: '', cyl: '', axis: '', plano: false }, pd: '', doctor: '' }
    }
    lastCreatedOrder = null
    lastPaymentReceipt = null
    paySessionSnapshot = { stage: 'FULL', amount: 0 }
    resetPin(false)
    tabletPinDigits = []
    resetTabletPin(false)
    pinDigits = []
    obRenderCart()
    var nextRoute = getTabletJwtStoreId() != null ? POS_ROUTES.LOGIN_STAFF : POS_ROUTES.LOGIN
    if (typeof cosmosToastInfo === 'function') cosmosToastInfo('Staff signed out. Tablet stays unlocked.')
    history.replaceState({}, '', nextRoute)
    resolve(nextRoute)
  }

  async function handleProceedToPayment() {
    if (obCart.length === 0) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Your cart is empty.')
      return
    }
    for (let i = 0; i < obCart.length; i++) {
      if (obCart[i].fulfillment === 'LAB' && obCart[i].lab_status !== 'complete') {
        if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Finish lens configuration for all lab lines.')
        return
      }
    }
    // Rx is now collected per-line inside the Lens wizard's Add Power step.
    // A line that uses 'Submit Power Later' is intentionally exempt.
    const linesNeedingRx = obCart.filter(function (l) {
      return l.fulfillment === 'LAB' && l.rx_required && l.power_mode !== 'later' && l.power_mode !== 'frame_only' && l.power_mode !== 'frame_sunglasses'
    })
    const missingRx = linesNeedingRx.some(function (l) {
      if (!l.rx) return true
      const od = l.rx.od || {}
      const os = l.rx.os || {}
      if (od.plano || os.plano) return false
      const odOk = (od.sph && String(od.sph).trim()) || (od.cyl && String(od.cyl).trim())
      const osOk = (os.sph && String(os.sph).trim()) || (os.cyl && String(os.cyl).trim())
      return !(odOk || osOk)
    })
    if (missingRx) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Some lab lines still need power values — finish lens setup.')
      return
    }
    const session = getPosSession()
    if (!session || !session.token) return
    await loadPosBootstrap(session)
    const lines = buildPosOrderLinesFromObCart()
    // Pick the first cart line that captured a per-line Rx in the Lens wizard.
    const rxLine = obCart.find(function (l) { return l.rx })
    const rxSnap = rxLine ? rxLine.rx : null
    let discInfo = { amount: 0, offerId: null }
    try {
      var qp = posSelectedCustomerId ? ('?customer_id=' + encodeURIComponent(String(posSelectedCustomerId))) : ''
      var prevPayload = { lines: lines }
      var pickId = posSelectedOfferId != null ? Number(posSelectedOfferId) : null
      if (pickId != null && Number.isFinite(pickId) && pickId > 0) prevPayload.applied_offer_id = pickId
      var prevBody = await apiPost('/api/pos/preview-order-discount' + qp, prevPayload, session.token)
      var prevD = prevBody && prevBody.data ? prevBody.data : {}
      discInfo = {
        amount: Math.max(0, Number(prevD.discount_amount) || 0),
        offerId: prevD.applied_offer_id != null && Number(prevD.applied_offer_id) > 0 ? Number(prevD.applied_offer_id) : null
      }
    } catch (err) {
      if (posSelectedOfferId) {
        if (typeof cosmosToastError === 'function') cosmosToastError(err.message || 'Could not confirm offer discount.')
        if (btnObProceed && typeof cosmosBtnDone === 'function') cosmosBtnDone(btnObProceed)
        return
      }
      discInfo = { amount: 0, offerId: null }
    }
    if (btnObProceed && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btnObProceed)
    try {
      const res = await apiPost('/api/pos/orders', {
        customer_id: posSelectedCustomerId,
        order_source: 'POS',
        rx_snapshot: rxSnap,
        discount_amount: discInfo.amount || 0,
        applied_offer_id: discInfo.offerId || null,
        // Commit store stock in the same DB transaction as order insert (not on final payment).
        inventory_deferred: false,
        lines: lines
      }, session.token)
      lastCreatedOrder = res.data
      forceBalanceSettlement = false
      if (btnObProceed && typeof cosmosBtnDone === 'function') cosmosBtnDone(btnObProceed)
      navigate(POS_ROUTES.PAYMENT)
    } catch (err) {
      if (btnObProceed && typeof cosmosBtnDone === 'function') cosmosBtnDone(btnObProceed)
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ORDER HISTORY SCREEN
  // ═══════════════════════════════════════════════════════════════════════

  const POS_LAB_WF_LABEL = {
    ORDER_PLACED: 'Order Placed',
    ADVANCE_PAID: 'Accepted',
    SENT_TO_LAB: 'Sent To Lab',
    LAB_FITTING: 'Fitting & Edging',
    QC_PASS: 'QC Pass',
    QC_FAIL_LAB: 'QC Fail',
    DISPATCHED_TO_STORE: 'Dispatched To Store',
    RECEIVED_AT_STORE: 'Received At Store'
  }

  function posLabWfDisplay(status) {
    const k = String(status || '').trim()
    return POS_LAB_WF_LABEL[k] || k.replace(/_/g, ' ')
  }

  function posOrdersSelectedStatus() {
    const active = document.querySelector('#pos-orders-status-tabs [role="tab"].active')
    if (!active) return ''
    return active.getAttribute('data-pos-order-status') || ''
  }

  function posFormatIstDateTime(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  function posFormatRxBlockHtml(rx) {
    if (!rx || typeof rx !== 'object') {
      return '<p class="pos-order-detail-muted">No prescription snapshot on this order.</p>'
    }
    const od = rx.od || {}
    const os = rx.os || {}
    function eyeLine(label, e) {
      if (e && e.plano) return escapeHtml(label + ': Plano')
      const p = []
      if (e.sph) p.push('SPH ' + String(e.sph))
      if (e.cyl) p.push('CYL ' + String(e.cyl))
      if (e.axis) p.push('Axis ' + String(e.axis))
      if (!p.length) return escapeHtml(label + ': —')
      return escapeHtml(label + ': ' + p.join(' · '))
    }
    const lines = [eyeLine('OD (right)', od), eyeLine('OS (left)', os)]
    if (rx.pd) lines.push(escapeHtml('PD: ' + String(rx.pd) + ' mm'))
    if (rx.doctor) lines.push(escapeHtml('Doctor: ' + String(rx.doctor)))
    return '<ul class="pos-order-detail-rx-list">' + lines.map(function (line) { return '<li>' + line + '</li>' }).join('') + '</ul>'
  }

  function posFormatLensBundleHtml(b) {
    if (!b || typeof b !== 'object') return ''
    const parts = []
    if (b.package_id != null) parts.push('Lens package #' + b.package_id)
    if (b.category_id != null) parts.push('Category #' + b.category_id)
    if (Array.isArray(b.addon_ids) && b.addon_ids.length) parts.push('Add-ons: ' + b.addon_ids.join(', '))
    if (!parts.length) return ''
    return '<div class="pos-order-detail-lens">' + parts.map(function (p) { return '<span>' + escapeHtml(p) + '</span>' }).join('<span class="pos-order-detail-dot"> · </span>') + '</div>'
  }

  function renderPosOrderDetailView(d) {
    const order = d.order || {}
    const cust = d.customer || null
    const subOrders = Array.isArray(d.sub_orders) ? d.sub_orders : []
    const pays = Array.isArray(d.payments) ? d.payments : []
    const summary = d.payment_summary || {}
    const rxHtml = posFormatRxBlockHtml(order.rx_snapshot)
    const custName = cust && cust.full_name ? cust.full_name : 'Walk-in Customer'
    const custPhone = cust && cust.phone ? cust.phone : ''
    const custEmail = cust && cust.email ? cust.email : ''

    let blocks = ''
    for (let si = 0; si < subOrders.length; si++) {
      const so = subOrders[si]
      const fulf = String(so.fulfillment || '')
      const lab = so.lab_workflow_status ? posLabWfDisplay(so.lab_workflow_status) : ''
      const items = Array.isArray(so.items) ? so.items : []
      let rows = ''
      for (let ii = 0; ii < items.length; ii++) {
        const it = items[ii]
        const title = (it.product_label && String(it.product_label).trim()) || (it.sku_code ? String(it.sku_code) : ('SKU #' + it.sku_id))
        const colour = it.colour_name ? String(it.colour_name) : ''
        const meta = [
          it.product_type ? String(it.product_type) : '',
          it.sku_code ? String(it.sku_code) : '',
          colour
        ].filter(Boolean).join(' · ')
        const lensHtml = posFormatLensBundleHtml(it.lens_bundle)
        rows +=
          '<div class="pos-order-detail-line">' +
          '<div class="pos-order-detail-line-main">' +
          '<div class="pos-order-detail-line-title">' + escapeHtml(title) + '</div>' +
          (meta ? '<div class="pos-order-detail-line-meta">' + escapeHtml(meta) + '</div>' : '') +
          (lensHtml ? '<div class="pos-order-detail-line-lens">' + lensHtml + '</div>' : '') +
          '<div class="pos-order-detail-line-flags">' +
          '<span class="pos-order-detail-chip">' + escapeHtml(String(it.fulfillment || '')) + '</span>' +
          '</div>' +
          '</div>' +
          '<div class="pos-order-detail-line-price">' +
          '<div>×' + escapeHtml(String(it.qty != null ? it.qty : 1)) + '</div>' +
          '<div class="pos-order-detail-line-total">₹' + Number(it.line_total || 0).toLocaleString('en-IN') + '</div>' +
          '</div>' +
          '</div>'
      }
      blocks +=
        '<section class="pos-order-detail-sub">' +
        '<div class="pos-order-detail-sub-h">' +
        '<span>' + escapeHtml(fulf === 'LAB' ? 'Lab fulfilment' : 'Instant / pickup') + '</span>' +
        (lab ? '<span class="pos-order-detail-badge">' + escapeHtml(lab) + '</span>' : '') +
        '</div>' +
        (rows || '<div class="pos-order-detail-muted">No line items.</div>') +
        '</section>'
    }

    let payRows = ''
    for (let pi = 0; pi < pays.length; pi++) {
      const p = pays[pi]
      const amt = Number(p.amount)
      payRows +=
        '<div class="pos-order-detail-pay-row">' +
        '<span>' + escapeHtml(String(p.stage || '') + ' · ' + String(p.method || '')) + '</span>' +
        '<span>₹' + amt.toLocaleString('en-IN') + '</span>' +
        '<span class="pos-order-detail-muted">' + escapeHtml(posFormatIstDateTime(p.created_at)) + '</span>' +
        '</div>'
    }

    const sumParts = [
      summary.order_kind ? ('Kind: ' + summary.order_kind) : '',
      summary.paid_total != null ? ('Paid: ₹' + Number(summary.paid_total).toLocaleString('en-IN')) : '',
      summary.amount_remaining != null ? ('Due: ₹' + Number(summary.amount_remaining).toLocaleString('en-IN')) : ''
    ].filter(Boolean)

    return (
      '<div class="pos-order-detail-grid">' +
      '<section class="pos-order-detail-card">' +
      '<div class="pos-order-detail-k">Order</div>' +
      '<div class="pos-order-detail-order-no">' + escapeHtml(String(order.order_no || '')) + '</div>' +
      '<div class="pos-order-detail-meta">' +
      '<span class="pos-order-detail-chip">' + escapeHtml(String(order.status || '')) + '</span>' +
      '<span class="pos-order-detail-chip">' + escapeHtml(String(order.order_kind || '')) + '</span>' +
      '<span class="pos-order-detail-muted">' + escapeHtml(posFormatIstDateTime(order.created_at)) + '</span>' +
      '</div>' +
      '<div class="pos-order-detail-total">₹' + Number(order.total_amount || 0).toLocaleString('en-IN') + ' <span class="pos-order-detail-muted">incl. totals</span></div>' +
      '</section>' +
      '<section class="pos-order-detail-card">' +
      '<div class="pos-order-detail-k">Customer</div>' +
      '<div class="pos-order-detail-cust-name">' + escapeHtml(custName) + '</div>' +
      (custPhone ? '<div class="pos-order-detail-cust-row">' + escapeHtml(custPhone) + '</div>' : '') +
      (custEmail ? '<div class="pos-order-detail-cust-row">' + escapeHtml(custEmail) + '</div>' : '') +
      '</section>' +
      '<section class="pos-order-detail-card pos-order-detail-card--rx">' +
      '<div class="pos-order-detail-k">Power / prescription</div>' +
      rxHtml +
      '</section>' +
      '</div>' +
      '<h3 class="pos-order-detail-h3">Products</h3>' +
      (blocks || '<div class="pos-order-detail-muted">No products listed.</div>') +
      '<h3 class="pos-order-detail-h3">Payments</h3>' +
      (sumParts.length ? '<div class="pos-order-detail-sum">' + escapeHtml(sumParts.join(' · ')) + '</div>' : '') +
      (payRows || '<div class="pos-order-detail-muted">No payments recorded.</div>')
    )
  }

  function closePosOrderDetailModal() {
    const ov = document.getElementById('overlay-pos-order-detail')
    if (!ov) return
    ov.classList.remove('open')
    ov.setAttribute('aria-hidden', 'true')
  }

  async function openPosOrderDetailModal(orderId) {
    const session = getPosSession()
    const body = document.getElementById('pos-order-detail-body')
    const titleEl = document.getElementById('pos-order-detail-title')
    const ov = document.getElementById('overlay-pos-order-detail')
    if (!session || !session.token || !orderId || !body || !ov) return
    ov.classList.add('open')
    ov.setAttribute('aria-hidden', 'false')
    if (titleEl) titleEl.textContent = 'Order details'
    if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('pos-order-detail-body', 5)
    else body.innerHTML = ''
    try {
      const d = await apiGet('/api/pos/orders/' + orderId, session.token)
      body.innerHTML = renderPosOrderDetailView(d)
      if (titleEl && d.order && d.order.order_no) titleEl.textContent = String(d.order.order_no)
    } catch (err) {
      body.innerHTML = '<div class="pos-order-detail-muted">Could not load this order.</div>'
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
    }
  }

  function bindPosOrderDetailOverlay() {
    const ov = document.getElementById('overlay-pos-order-detail')
    if (!ov || ov.dataset.bound === '1') return
    ov.dataset.bound = '1'
    const bd = document.getElementById('pos-order-detail-backdrop')
    const dismiss = document.getElementById('pos-order-detail-dismiss')
    const close = function () { closePosOrderDetailModal() }
    if (bd) bd.addEventListener('click', close)
    if (dismiss) dismiss.addEventListener('click', close)
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return
      if (ov.classList.contains('open')) close()
    })
  }

  function bindPosOrderHistoryGestures() {
    const listEl = document.getElementById('pos-orders-list')
    if (!listEl || listEl.dataset.posLpBound === '1') return
    listEl.dataset.posLpBound = '1'

    let timer = null
    let startPt = null
    let pendingOid = null

    function endListeners() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    function clearTimer() {
      if (timer) clearTimeout(timer)
      timer = null
    }

    function onMove(e) {
      if (!startPt) return
      if (Math.abs(e.clientX - startPt.x) + Math.abs(e.clientY - startPt.y) > 16) {
        clearTimer()
        startPt = null
        pendingOid = null
        endListeners()
      }
    }

    function onUp() {
      clearTimer()
      startPt = null
      pendingOid = null
      endListeners()
    }

    listEl.addEventListener('pointerdown', function (e) {
      const card = e.target.closest('.pos-order-card')
      if (!card || !listEl.contains(card)) return
      if (e.target.closest('button')) return
      const oid = card.getAttribute('data-order-id')
      if (!oid) return
      clearTimer()
      startPt = { x: e.clientX, y: e.clientY }
      pendingOid = oid
      window.addEventListener('pointermove', onMove, { passive: true })
      window.addEventListener('pointerup', onUp, { passive: true })
      window.addEventListener('pointercancel', onUp, { passive: true })
      timer = setTimeout(function () {
        clearTimer()
        startPt = null
        const holdId = pendingOid
        pendingOid = null
        endListeners()
        if (typeof navigator.vibrate === 'function') navigator.vibrate(12)
        openPosOrderDetailModal(Number(holdId))
      }, 480)
    })

    listEl.addEventListener('dblclick', function (e) {
      const card = e.target.closest('.pos-order-card')
      if (!card || !listEl.contains(card)) return
      if (e.target.closest('button')) return
      const oid = card.getAttribute('data-order-id')
      if (oid) openPosOrderDetailModal(Number(oid))
    })
  }

  async function showOrderHistoryScreen(session) {
    document.getElementById('pos-orders-staff').textContent = session.name + ' • ' + formatRole(session.role)
    document.getElementById('pos-orders-store').textContent = session.store_name || ''
    
    document.getElementById('btn-orders-back').onclick = () => {
      navigate(POS_ROUTES.CATALOGUE)
    }

    const searchInput = document.getElementById('pos-orders-search')
    const searchBtn = document.getElementById('btn-pos-orders-search')
    const tabsRoot = document.getElementById('pos-orders-status-tabs')

    searchBtn.onclick = () => loadOrderHistory(session, searchInput.value, posOrdersSelectedStatus())
    searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') loadOrderHistory(session, searchInput.value, posOrdersSelectedStatus())
    }

    if (tabsRoot && tabsRoot.dataset.bound !== '1') {
      tabsRoot.dataset.bound = '1'
      tabsRoot.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-pos-order-status]')
        if (!btn) return
        const st = btn.getAttribute('data-pos-order-status') || ''
        tabsRoot.querySelectorAll('[role="tab"]').forEach((t) => {
          const sel = (t.getAttribute('data-pos-order-status') || '') === st
          t.classList.toggle('active', sel)
          t.setAttribute('aria-selected', sel ? 'true' : 'false')
        })
        loadOrderHistory(session, searchInput.value, st)
      })
    }

    const refreshBtn = document.getElementById('btn-pos-orders-refresh')
    if (refreshBtn && refreshBtn.dataset.bound !== '1') {
      refreshBtn.dataset.bound = '1'
      refreshBtn.onclick = () => loadOrderHistory(session, searchInput.value, posOrdersSelectedStatus())
    }

    bindPosOrderDetailOverlay()
    bindPosHandoverOverlays()
    bindPosOrderHistoryGestures()

    showScreen('screen-pos-orders')
    await loadOrderHistory(session, '', posOrdersSelectedStatus())
  }

  async function loadOrderHistory(session, search, status) {
    const listEl = document.getElementById('pos-orders-list')
    if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('pos-orders-list', 5)
    else if (listEl) listEl.innerHTML = ''
    
    try {
      const qs = new URLSearchParams()
      if (search) qs.append('q', search)
      if (status === 'PROCESSING') {
        qs.append('kind', 'LAB')
        qs.append('exclude_lab_status', 'READY_FOR_DELIVERY,DELIVERED,INVOICED')
      } else if (status) {
        qs.append('status', status)
      }
      
      const orders = await apiGet('/api/pos/orders?' + qs.toString(), session.token)
      
      if (!orders || !orders.length) {
        listEl.innerHTML = `
          <div class="empty">
            <div class="empty-ic">📄</div>
            <div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">No orders found</div>
            <div style="font-size:13px;color:var(--text2);margin-bottom:14px">Try another filter or search term.</div>
            <button type="button" id="btn-pos-orders-refresh" class="btn primary" style="margin-top:4px">Refresh list</button>
          </div>
        `
        const refBtn = document.getElementById('btn-pos-orders-refresh')
        if (refBtn) {
          refBtn.onclick = () => loadOrderHistory(session, search, posOrdersSelectedStatus())
        }
        return
      }

      listEl.innerHTML = orders.map(o => {
        const d = new Date(o.created_at)
        const dateStr = d.toLocaleString('en-GB', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
        const statusLower = String(o.status).toLowerCase()
        const labStatus = String(o.lab_workflow_status || '')
        const canCollectBalance = o.order_kind === 'LAB' && labStatus === 'READY_FOR_DELIVERY'
        const collectHtml = canCollectBalance
          ? `<button style="margin-top:8px;padding:8px 10px;border:1px solid var(--acc2);background:var(--accL);color:var(--acc2);border-radius:8px;cursor:pointer" onclick="openBalanceCollection(${o.order_id})">Collect Balance</button>`
          : ''
        // Store OS advances stages 1–3 via lab-status buttons
        const labActionHtml = (() => {
          if (o.order_kind !== 'LAB' && o.order_kind !== 'MIXED') return ''
          if (labStatus === 'ORDER_PLACED')
            return `<button class="btn primary" type="button" style="margin-top:8px;font-size:12px;padding:6px 10px" onclick="posAdvanceLabStage(${o.order_id},${o.sub_order_id},'ADVANCE_PAID',this)">Mark Accepted</button>`
          if (labStatus === 'ADVANCE_PAID')
            return `<button class="btn primary" type="button" style="margin-top:8px;font-size:12px;padding:6px 10px" onclick="posAdvanceLabStage(${o.order_id},${o.sub_order_id},'SENT_TO_LAB',this)">Mark Sent To Lab</button>`
          return ''
        })()
        const labBadge = (o.order_kind === 'LAB' || o.order_kind === 'MIXED') && labStatus
          ? `<div class="pos-order-status" style="margin-top:6px">${posLabWfDisplay(labStatus)}</div>`
          : ''
        return `
          <div class="pos-order-card pos-order-card--pressable" data-order-id="${o.order_id}" role="listitem">
            <div class="pos-order-info">
              <div class="pos-order-no">${o.order_no}</div>
              <div class="pos-order-customer">${o.customer_name} ${o.customer_phone ? '(' + o.customer_phone + ')' : ''}</div>
              <div class="pos-order-date">${dateStr}</div>
            </div>
            <div class="pos-order-meta">
              <div class="pos-order-amount">₹${o.total_amount.toLocaleString('en-IN')}</div>
              <div class="pos-order-status ${statusLower}">${o.status}</div>
              ${labBadge}
              ${labActionHtml}
              ${collectHtml}
            </div>
          </div>
        `
      }).join('')
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
      if (listEl) listEl.innerHTML = ''
    }
  }

  window.setPosDeliveryMode = function(mode) {
    posDeliveryMode = mode
    const storeBtn = document.getElementById('pay-mode-store')
    const homeBtn = document.getElementById('pay-mode-home')
    const sub = document.getElementById('pay-delivery-sub')
    if (storeBtn) { storeBtn.classList.toggle('active', mode === 'STORE'); storeBtn.setAttribute('aria-pressed', mode === 'STORE') }
    if (homeBtn) { homeBtn.classList.toggle('active', mode === 'HOME'); homeBtn.setAttribute('aria-pressed', mode === 'HOME') }
    if (sub) sub.textContent = mode === 'HOME' ? 'Delivery address from customer profile' : 'Customer picks up at store'
  }

  function posHandoverEscAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
  }

  function readPosHandoverInvoicePreferencesFromDom() {
    function gv(id) {
      const el = document.getElementById(id)
      return el && el.value != null ? String(el.value).trim() : ''
    }
    return {
      bill_name: gv('pos-handover-bill-name'),
      gstin: gv('pos-handover-gstin'),
      billing_address: gv('pos-handover-billing-address'),
      shipping_address: gv('pos-handover-shipping-address'),
      phone: gv('pos-handover-phone'),
      email: gv('pos-handover-email'),
      notes: gv('pos-handover-notes')
    }
  }

  function closePosHandoverModal() {
    const overlay = document.getElementById('overlay-pos-handover')
    if (overlay) {
      overlay.classList.remove('open')
      overlay.setAttribute('aria-hidden', 'true')
    }
    _posHandoverCtx = null
  }

  function closePosHandoverSuccessModal() {
    const overlay = document.getElementById('overlay-pos-handover-success')
    if (overlay) {
      overlay.classList.remove('open')
      overlay.setAttribute('aria-hidden', 'true')
    }
    _posHandoverSuccessCtx = null
  }

  function closePosInvoicePreviewModal() {
    const overlay = document.getElementById('overlay-pos-invoice-preview')
    const frame = document.getElementById('pos-invoice-preview-frame')
    if (frame) {
      try {
        frame.srcdoc = ''
      } catch (_e) {}
    }
    if (overlay) {
      overlay.classList.remove('open')
      overlay.setAttribute('aria-hidden', 'true')
    }
  }

  /** @returns {boolean} true if print was invoked */
  function printPosInvoicePreviewFrame() {
    const overlay = document.getElementById('overlay-pos-invoice-preview')
    if (!overlay || !overlay.classList.contains('open')) return false
    const frame = document.getElementById('pos-invoice-preview-frame')
    if (!frame || !frame.contentWindow) return false
    try {
      frame.contentWindow.focus()
      frame.contentWindow.print()
      return true
    } catch (_e) {
      return false
    }
  }

  function showPosHandoverSuccessAfterHandover(ctx) {
    _posHandoverSuccessCtx = ctx || null
    const overlay = document.getElementById('overlay-pos-handover-success')
    const subEl = document.getElementById('pos-handover-success-sub')
    const invEl = document.getElementById('pos-handover-success-invoice')
    const waBtn = document.getElementById('btn-pos-handover-success-whatsapp')
    const printBtn = document.getElementById('btn-pos-handover-success-print')
    if (!overlay) return
    if (subEl) {
      subEl.textContent = 'Order ' + (ctx && ctx.order_no ? ctx.order_no : '') + ' is handed over and invoiced.'
    }
    if (invEl) {
      invEl.textContent = ctx && ctx.invoice_no ? ('Invoice: ' + ctx.invoice_no) : 'Invoice generated.'
    }
    if (waBtn) {
      const phone = String((ctx && ctx.customer_phone) || '').replace(/\D/g, '')
      if (phone.length >= 10) {
        const amtLine = ctx && ctx.amount_collected > 0.009
          ? ('Balance paid: ' + formatRupeesDecimals(ctx.amount_collected) + ' via ' + String(ctx.method || '') + '.')
          : 'Your lab order is ready — thank you!'
        const msg = encodeURIComponent(
          'Hi! Your Cosmos order ' + String(ctx && ctx.order_no || '') + ' — handed over and invoiced.\n' +
          (ctx && ctx.invoice_no ? ('Invoice: ' + ctx.invoice_no + '\n') : '') +
          amtLine +
          '\nThank you!'
        )
        const wa = phone.length === 10 ? '91' + phone : phone
        waBtn.onclick = function () { window.open('https://wa.me/' + wa + '?text=' + msg, '_blank') }
        waBtn.disabled = false
        waBtn.style.opacity = '1'
      } else {
        waBtn.disabled = true
        waBtn.style.opacity = '0.4'
        waBtn.onclick = null
        waBtn.title = 'No customer phone on file'
      }
    }
    if (printBtn) {
      printBtn.onclick = function () {
        if (typeof printPosInvoicePreviewFrame === 'function' && printPosInvoicePreviewFrame()) {
          return
        }
        const sessionSnap = getPosSession()
        const sn = sessionSnap && sessionSnap.store_name ? sessionSnap.store_name : 'Store'
        const succ = _posHandoverSuccessCtx
        const prefs = succ && succ.invoice_prefs ? succ.invoice_prefs : null
        const detailSnap = succ && succ.detail_snapshot ? succ.detail_snapshot : null
        const inv = succ && succ.invoice_no ? succ.invoice_no : null
        const last = _posHandoverInvoicePreviewLast
        let opened = null
        if (last && last.detailSnap && last.prefs) {
          opened = openPosHandoverInvoicePreview(last.storeName || sn, last.detailSnap, last.prefs, last.invoiceNo || inv)
        } else if (detailSnap && prefs) {
          opened = openPosHandoverInvoicePreview(sn, detailSnap, prefs, inv || '—')
        }
        if (opened) {
          window.setTimeout(function () {
            printPosInvoicePreviewFrame()
          }, 350)
        } else if (typeof cosmosToastWarn === 'function') {
          cosmosToastWarn('Invoice preview could not be opened — reload the page and try Print again.')
        }
      }
    }
    overlay.classList.add('open')
    overlay.setAttribute('aria-hidden', 'false')
  }

  window.setPosHandoverPayMethod = function (method) {
    ;['UPI', 'CARD', 'CASH'].forEach(function (m) {
      const btn = document.getElementById('pos-handover-pay-m-' + m)
      if (btn) btn.classList.toggle('active', m === method)
    })
    const cashWrap = document.getElementById('pos-handover-cash-wrap')
    const cardWrap = document.getElementById('pos-handover-card-wrap')
    if (cashWrap) cashWrap.style.display = method === 'CASH' ? '' : 'none'
    if (cardWrap) cardWrap.style.display = method === 'CARD' ? '' : 'none'
    if (_posHandoverCtx) _posHandoverCtx.method = method
  }

  window.togglePosHandoverInvoicePanel = function () {
    const wrap = document.getElementById('pos-handover-invoice-fields')
    const btn = document.getElementById('pos-handover-invoice-toggle')
    if (!wrap) return
    const open = wrap.classList.toggle('pos-handover-invoice-fields--open')
    if (btn) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false')
      btn.classList.toggle('pos-handover-invoice-toggle--open', open)
    }
    wrap.setAttribute('aria-hidden', open ? 'false' : 'true')
  }

  window.submitPosHandoverConfirm = async function (hasBalance) {
    if (!_posHandoverCtx) return
    if (_posHandoverSubmitting) return
    const session = getPosSession()
    if (!session || !session.token) return
    const errEl = document.getElementById('pos-handover-err')
    if (errEl) {
      errEl.style.display = 'none'
      errEl.textContent = ''
    }
    const orderId = _posHandoverCtx.orderId
    const balanceDue = _posHandoverCtx.balanceDue
    const invoice_preferences = readPosHandoverInvoicePreferencesFromDom()
    const btn = document.getElementById('btn-pos-handover-confirm')
    const detailSnapForPreview = _posHandoverCtx.detailSnapshot || null
    let body = { order_id: orderId, invoice_preferences: invoice_preferences }

    if (hasBalance) {
      const method = _posHandoverCtx.method || 'UPI'
      const tEl = document.getElementById('pos-handover-tendered')
      const refEl = document.getElementById('pos-handover-card-ref')
      const tendered = tEl && tEl.value ? Number(tEl.value) : null
      if (method === 'CASH' && (tendered == null || tendered < balanceDue - 0.001)) {
        if (errEl) {
          errEl.textContent = 'Tendered amount must be at least balance due (' + formatRupeesDecimals(balanceDue) + ').'
          errEl.style.display = 'block'
        }
        return
      }
      body.amount = balanceDue
      body.method = method
      if (method === 'CASH' && tendered != null) body.tendered = tendered
      if (method === 'CARD' && refEl && refEl.value.trim()) body.external_ref = refEl.value.trim()
    }

    _posHandoverSubmitting = true
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn)
    try {
      const res = await apiPost('/api/orders/' + orderId + '/handover', body, session.token)
      if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn)
      const inv = res.data && res.data.invoice_no ? res.data.invoice_no : null
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Order handed over successfully.')
      const prefsPhone = String((invoice_preferences && invoice_preferences.phone) || '').trim()
      const customerPhoneWa = prefsPhone.replace(/\D/g, '').length >= 10 ? prefsPhone : (_posHandoverCtx.customerPhone || '')
      const successSnap = {
        order_no: _posHandoverCtx.orderNo,
        invoice_no: inv,
        invoice_prefs: invoice_preferences,
        detail_snapshot: detailSnapForPreview,
        customer_phone: customerPhoneWa,
        amount_collected: hasBalance ? balanceDue : 0,
        method: hasBalance ? (_posHandoverCtx.method || 'UPI') : ''
      }
      closePosHandoverModal()
      showPosHandoverSuccessAfterHandover(successSnap)
      const sessionPv = getPosSession()
      const snPv = sessionPv && sessionPv.store_name ? sessionPv.store_name : 'Store'
      if (detailSnapForPreview && typeof window.setTimeout === 'function') {
        window.setTimeout(function () {
          openPosHandoverInvoicePreview(snPv, detailSnapForPreview, invoice_preferences, inv || 'Provisional')
        }, 200)
      }
      const listEl = document.getElementById('pos-orders-list')
      if (listEl) {
        const s = getPosSession()
        if (s && s.token) void loadOrderHistory(s, '', posOrdersSelectedStatus())
      }
    } catch (err) {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn)
      if (errEl) {
        errEl.textContent = err.message || 'Handover failed.'
        errEl.style.display = 'block'
      }
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
    } finally {
      _posHandoverSubmitting = false
    }
  }

  function bindPosHandoverOverlays() {
    const ov = document.getElementById('overlay-pos-handover')
    if (ov && ov.dataset.bound !== '1') {
      ov.dataset.bound = '1'
      const bd = document.getElementById('pos-handover-backdrop')
      const dismiss = document.getElementById('pos-handover-dismiss')
      const close = function () { closePosHandoverModal() }
      if (bd) bd.addEventListener('click', close)
      if (dismiss) dismiss.addEventListener('click', close)
    }
    const sv = document.getElementById('overlay-pos-handover-success')
    if (sv && sv.dataset.bound !== '1') {
      sv.dataset.bound = '1'
      const bd2 = document.getElementById('pos-handover-success-backdrop')
      const done = document.getElementById('btn-pos-handover-success-done')
      const closeS = function () { closePosHandoverSuccessModal() }
      if (bd2) bd2.addEventListener('click', closeS)
      if (done) done.addEventListener('click', closeS)
    }
    const ipv = document.getElementById('overlay-pos-invoice-preview')
    if (ipv && ipv.dataset.bound !== '1') {
      ipv.dataset.bound = '1'
      const bd3 = document.getElementById('pos-invoice-preview-backdrop')
      const dismiss3 = document.getElementById('pos-invoice-preview-dismiss')
      const close3 = document.getElementById('btn-pos-invoice-preview-close')
      const printIv = document.getElementById('btn-pos-invoice-preview-print')
      const shut = function () { closePosInvoicePreviewModal() }
      if (bd3) bd3.addEventListener('click', shut)
      if (dismiss3) dismiss3.addEventListener('click', shut)
      if (close3) close3.addEventListener('click', shut)
      if (printIv) {
        printIv.addEventListener('click', function () {
          printPosInvoicePreviewFrame()
        })
      }
    }
    if (document.documentElement.dataset.posHandoverEscBound !== '1') {
      document.documentElement.dataset.posHandoverEscBound = '1'
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return
        const ipv0 = document.getElementById('overlay-pos-invoice-preview')
        if (ipv0 && ipv0.classList.contains('open')) {
          closePosInvoicePreviewModal()
          return
        }
        const s1 = document.getElementById('overlay-pos-handover-success')
        if (s1 && s1.classList.contains('open')) {
          closePosHandoverSuccessModal()
          return
        }
        const h = document.getElementById('overlay-pos-handover')
        if (h && h.classList.contains('open')) closePosHandoverModal()
      })
    }
  }

  async function openPosHandoverModal(orderId) {
    const session = getPosSession()
    if (!session || !session.token || !orderId) return
    bindPosHandoverOverlays()
    const overlay = document.getElementById('overlay-pos-handover')
    const body = document.getElementById('pos-handover-modal-body')
    if (!overlay || !body) {
      if (typeof cosmosToastError === 'function') cosmosToastError('Handover screen is not available.')
      return
    }
    overlay.classList.add('open')
    overlay.setAttribute('aria-hidden', 'false')
    body.innerHTML = '<div class="pos-handover-loading" style="padding:20px;text-align:center;color:var(--text2)">Loading order…</div>'
    try {
      const detail = await apiGet('/api/pos/orders/' + orderId, session.token)
      const order = detail.order
      if (!order) {
        body.innerHTML = '<div style="padding:16px;color:var(--red)">Order not found.</div>'
        return
      }
      const summary = detail.payment_summary || {}
      const balanceDue = Math.max(0, Number(summary.amount_remaining) || 0)
      const total = Number(order.total_amount || 0)
      const orderNo = order.order_no || ('#' + orderId)
      const cust = detail.customer || {}
      const billName = String(cust.full_name || '').trim()
      const phone0 = String(cust.phone || '').trim()
      const email0 = String(cust.email || '').trim()
      _posHandoverCtx = {
        orderId: orderId,
        orderNo: orderNo,
        balanceDue: balanceDue,
        customerPhone: phone0,
        detailSnapshot: {
          order: order,
          sub_orders: detail.sub_orders || [],
          payment_summary: summary
        },
        method: 'UPI'
      }

      if (balanceDue < 0.01) {
        body.innerHTML =
          '<div class="pos-handover-stack">' +
          '<div class="pos-handover-badge-ok">Fully paid at POS</div>' +
          '<p class="pos-handover-lead">Order <strong>' + escapeHtml(orderNo) + '</strong> — Total ' + formatRupeesDecimals(total) + '</p>' +
          '<p class="pos-handover-muted">No balance due. Confirm to mark delivered and generate invoice.</p>' +
          posHandoverInvoiceSectionHtml(billName, phone0, email0) +
          '<div class="pos-handover-actions">' +
          '<button type="button" class="pos-handover-btn" onclick="closePosHandoverModal()">Cancel</button>' +
          '<button type="button" class="pos-handover-btn pos-handover-btn-primary" id="btn-pos-handover-confirm" onclick="submitPosHandoverConfirm(false)">Confirm handover</button>' +
          '</div></div>'
      } else {
        body.innerHTML =
          '<div class="pos-handover-stack">' +
          '<p class="pos-handover-lead">Order <strong>' + escapeHtml(orderNo) + '</strong> — Total ' + formatRupeesDecimals(total) + '</p>' +
          '<div class="pos-handover-balance-strip">' +
          '<span class="pos-handover-balance-label">Balance due</span>' +
          '<span class="pos-handover-balance-amt">' + formatRupeesDecimals(balanceDue) + '</span></div>' +
          '<div class="pos-handover-field-label">Payment method</div>' +
          '<div class="pos-handover-pay-row">' +
          '<button type="button" class="pos-handover-pay-m active" id="pos-handover-pay-m-UPI" onclick="setPosHandoverPayMethod(\'UPI\')">UPI</button>' +
          '<button type="button" class="pos-handover-pay-m" id="pos-handover-pay-m-CARD" onclick="setPosHandoverPayMethod(\'CARD\')">Card</button>' +
          '<button type="button" class="pos-handover-pay-m" id="pos-handover-pay-m-CASH" onclick="setPosHandoverPayMethod(\'CASH\')">Cash</button></div>' +
          '<div id="pos-handover-cash-wrap" style="display:none">' +
          '<label class="pos-handover-label" for="pos-handover-tendered">Tendered (cash)</label>' +
          '<input id="pos-handover-tendered" class="pos-handover-input" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Amount received">' +
          '<div id="pos-handover-change" class="pos-handover-change" style="display:none"></div></div>' +
          '<div id="pos-handover-card-wrap" style="display:none">' +
          '<label class="pos-handover-label" for="pos-handover-card-ref">Approval code / last 4 <span class="pos-handover-opt">(optional)</span></label>' +
          '<input id="pos-handover-card-ref" class="pos-handover-input" type="text" placeholder="e.g. 123456"></div>' +
          posHandoverInvoiceSectionHtml(billName, phone0, email0) +
          '<div id="pos-handover-err" class="pos-handover-err" style="display:none"></div>' +
          '<div class="pos-handover-actions">' +
          '<button type="button" class="pos-handover-btn" onclick="closePosHandoverModal()">Cancel</button>' +
          '<button type="button" class="pos-handover-btn pos-handover-btn-primary" id="btn-pos-handover-confirm" onclick="submitPosHandoverConfirm(true)">Collect ' + formatRupeesDecimals(balanceDue) + ' &amp; hand over</button>' +
          '</div></div>'
        const tEl = document.getElementById('pos-handover-tendered')
        if (tEl) {
          tEl.addEventListener('input', function () {
            const t = Number(this.value) || 0
            const chEl = document.getElementById('pos-handover-change')
            if (chEl) {
              if (t >= balanceDue) {
                chEl.textContent = 'Change: ' + formatRupeesDecimals(t - balanceDue)
                chEl.style.display = ''
              } else {
                chEl.style.display = 'none'
              }
            }
          })
        }
        window.setPosHandoverPayMethod('UPI')
      }
    } catch (err) {
      body.innerHTML = '<div style="padding:16px;color:var(--red)">' + escapeHtml(err.message || 'Failed to load order.') + '</div>'
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
    }
  }

  function posHandoverInvoiceSectionHtml(billName, phone0, email0) {
    return (
      '<div class="pos-handover-invoice-block">' +
      '<button type="button" class="pos-handover-invoice-toggle" id="pos-handover-invoice-toggle" onclick="togglePosHandoverInvoicePanel()" aria-expanded="false">' +
      'Invoice / bill details <span class="pos-handover-chevron">▾</span></button>' +
      '<div id="pos-handover-invoice-fields" class="pos-handover-invoice-fields" aria-hidden="true">' +
      '<p class="pos-handover-muted" style="margin:0 0 10px">Prefilled from customer profile. Edit before handover if the bill should read differently.</p>' +
      '<label class="pos-handover-label" for="pos-handover-bill-name">Bill name</label>' +
      '<input id="pos-handover-bill-name" class="pos-handover-input" type="text" value="' + posHandoverEscAttr(billName) + '">' +
      '<label class="pos-handover-label" for="pos-handover-gstin">GSTIN</label>' +
      '<input id="pos-handover-gstin" class="pos-handover-input" type="text" maxlength="20" placeholder="Optional">' +
      '<label class="pos-handover-label" for="pos-handover-billing-address">Billing address</label>' +
      '<textarea id="pos-handover-billing-address" class="pos-handover-textarea" rows="2" placeholder="Optional"></textarea>' +
      '<label class="pos-handover-label" for="pos-handover-shipping-address">Shipping / delivery address</label>' +
      '<textarea id="pos-handover-shipping-address" class="pos-handover-textarea" rows="2" placeholder="Optional"></textarea>' +
      '<label class="pos-handover-label" for="pos-handover-phone">Phone</label>' +
      '<input id="pos-handover-phone" class="pos-handover-input" type="tel" value="' + posHandoverEscAttr(phone0) + '">' +
      '<label class="pos-handover-label" for="pos-handover-email">Email</label>' +
      '<input id="pos-handover-email" class="pos-handover-input" type="email" value="' + posHandoverEscAttr(email0) + '">' +
      '<label class="pos-handover-label" for="pos-handover-notes">Notes on invoice</label>' +
      '<textarea id="pos-handover-notes" class="pos-handover-textarea" rows="2" placeholder="Optional"></textarea>' +
      '</div></div>'
    )
  }

  function flattenPosOrderItemsForPreview(detail) {
    const subs = detail && Array.isArray(detail.sub_orders) ? detail.sub_orders : []
    const rows = []
    for (let i = 0; i < subs.length; i++) {
      const sub = subs[i]
      const items = Array.isArray(sub.items) ? sub.items : []
      for (let j = 0; j < items.length; j++) {
        const it = items[j]
        rows.push({
          sku_code: it.sku_code ? String(it.sku_code) : '',
          product_label: (it.product_label && String(it.product_label).trim())
            || (it.product_type ? String(it.product_type) : ''),
          qty: Number(it.qty) || 1,
          line_total: Number(it.line_total) || 0,
          fulfillment: String(it.fulfillment || sub.fulfillment || '').toUpperCase()
        })
      }
    }
    return rows
  }

  function buildPosHandoverInvoicePreviewHtml(storeName, detail, prefs, invoiceNo) {
    const order = detail && detail.order ? detail.order : {}
    const p = prefs && typeof prefs === 'object' ? prefs : {}
    const displayStore = String(storeName || 'Store outlet').trim() || 'Store outlet'
    const dt = new Date().toLocaleString('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    const rows = flattenPosOrderItemsForPreview(detail)
    let bodyRows = ''
    for (let r = 0; r < rows.length; r++) {
      const it = rows[r]
      const labTag = it.fulfillment === 'LAB' ? '<span class="inv-lab-tag">Lab</span>' : ''
      const skuPart = it.sku_code ? ' <span class="inv-muted">(' + escapeHtml(String(it.sku_code)) + ')</span>' : ''
      bodyRows +=
        '<tr><td>' + escapeHtml(String(it.product_label || 'Item')) + skuPart + labTag +
        '</td><td>' + escapeHtml(String(it.qty)) + '</td><td>' +
        escapeHtml(formatRupeesDecimals(it.line_total)) + '</td></tr>'
    }
    if (!bodyRows) {
      bodyRows = '<tr><td colspan="3" class="inv-muted">Line items unavailable in this preview — reopen from order detail if needed.</td></tr>'
    }

    const sub = Number(order.subtotal_amount) || 0
    const disc = Number(order.discount_amount) || 0
    const gst = Number(order.gst_amount) || 0
    const total = Number(order.total_amount) || 0
    const taxableAfterDisc = Math.max(0, Math.round((sub - disc) * 100) / 100)
    const gstLabel = posGstLineLabel()

    function line(v) {
      const t = String(v || '').trim()
      return t ? escapeHtml(t) : ''
    }

    const billLines = []
    billLines.push(line(String(p.bill_name || '').trim() || '—'))
    if (String(p.phone || '').trim()) billLines.push(line(String(p.phone).trim()))
    if (String(p.email || '').trim()) billLines.push(line(String(p.email).trim()))
    if (String(p.gstin || '').trim()) billLines.push('<strong>GSTIN</strong> ' + line(String(p.gstin).trim()))
    if (String(p.billing_address || '').trim()) billLines.push(line(String(p.billing_address).trim()))
    if (String(p.notes || '').trim()) billLines.push('<strong>Notes</strong> ' + line(String(p.notes).trim()))

    let shipInner = ''
    if (String(p.shipping_address || '').trim()) {
      shipInner = line(String(p.shipping_address).trim())
    } else {
      shipInner = '<span class="inv-muted">Same as billing or handover arrangement at counter.</span>'
    }

    const css =
      ':root{--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--head:#0f2942;--accent:#1d4ed8;--tint:#eff6ff;--soft:#f8fafc}' +
      '*{box-sizing:border-box}body{margin:0;padding:32px 28px 48px;color:var(--ink);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.48;background:#fff}' +
      '.sheet{max-width:760px;margin:0 auto}' +
      '.banner{display:flex;justify-content:space-between;gap:24px;padding-bottom:22px;border-bottom:3px solid var(--head);margin-bottom:22px}' +
      '.brand-k{font-size:10px;font-weight:800;letter-spacing:.16em;color:var(--accent);text-transform:uppercase}' +
      '.store-n{font-size:21px;font-weight:800;color:var(--head);margin:8px 0 0;line-height:1.2}' +
      '.store-sub{font-size:12px;color:var(--muted);margin-top:6px}' +
      '.inv{text-align:right;min-width:220px}' +
      '.inv h1{margin:0 0 14px;font-size:26px;font-weight:900;color:var(--head);letter-spacing:-.03em;line-height:1}' +
      '.inv-row{font-size:13px;color:var(--muted);margin:4px 0}' +
      '.inv-row strong{color:var(--ink)}' +
      '.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}' +
      '@media(max-width:640px){.banner{flex-direction:column}.inv{text-align:left}.grid2{grid-template-columns:1fr}}' +
      '.card{border:1px solid var(--line);border-radius:12px;padding:16px;background:linear-gradient(180deg,var(--tint) 0,#fff 36%)}' +
      '.card h2{margin:0 0 10px;font-size:10px;font-weight:800;letter-spacing:.1em;color:var(--accent);text-transform:uppercase}' +
      '.addr{font-size:13px;line-height:1.55}' +
      'table{border-collapse:collapse;width:100%;margin:14px 0}' +
      'th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;background:var(--head);color:#fff;padding:11px 10px;text-align:left;font-weight:700}' +
      'th:nth-child(2){text-align:center}th:last-child{text-align:right}' +
      'td{border-bottom:1px solid var(--line);padding:11px 10px;font-size:13px}' +
      'td:nth-child(2){text-align:center;width:48px;color:var(--muted);font-weight:600}' +
      'td:last-child{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}' +
      'tbody tr:nth-child(even) td{background:var(--soft)}' +
      '.inv-muted{color:var(--muted)}' +
      '.inv-lab-tag{display:inline-block;margin-left:8px;font-size:9px;font-weight:800;padding:2px 8px;border-radius:999px;background:#dbeafe;color:#1e40af;vertical-align:middle;text-transform:none;letter-spacing:0}' +
      '.tot{display:flex;justify-content:flex-end;margin-top:12px}' +
      '.totbox{min-width:300px;border:1px solid var(--line);border-radius:12px;padding:18px 20px;background:#fff}' +
      '.totrow{display:flex;justify-content:space-between;gap:24px;margin:8px 0;font-size:13px;color:var(--muted)}' +
      '.totrow b{color:var(--ink)}' +
      '.grand{margin-top:14px;padding-top:14px;border-top:2px solid var(--head);font-size:18px;font-weight:900;color:var(--head);justify-content:space-between}' +
      '.foot{margin-top:36px;text-align:center;font-size:11px;color:var(--muted);line-height:1.55;padding-top:16px;border-top:1px dashed var(--line)}' +
      '.sig{margin-top:36px;display:flex;justify-content:space-between;font-size:12px;color:var(--muted);gap:20px}' +
      '.sig div:last-child{text-align:right}'

    const totDiscountRow = disc > 0.005
      ? '<div class="totrow"><span>Discount</span><span><b>− ' + escapeHtml(formatRupeesDecimals(disc)) + '</b></span></div>'
      : ''

    const billHtml = billLines.filter(Boolean).join('<br>')
    const orderNoDisp = escapeHtml(String(order.order_no || '—'))

    return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Invoice ' + escapeHtml(String(invoiceNo || 'Preview')) + '</title>' +
      '<style>@media print{body{padding:18px}}</style>' +
      '<style>' + css + '</style></head><body>' +
      '<div class="sheet">' +
      '<header class="banner">' +
      '<div><div class="brand-k">Store OS · Cosmos</div>' +
      '<div class="store-n">' + escapeHtml(displayStore) + '</div>' +
      '<div class="store-sub">Printed tax invoice (handover preview)</div></div>' +
      '<div class="inv"><h1>TAX INVOICE</h1>' +
      '<div class="inv-row"><strong>No.</strong> ' + escapeHtml(String(invoiceNo || '—')) + '</div>' +
      '<div class="inv-row"><strong>Order ref.</strong> ' + orderNoDisp + '</div>' +
      '<div class="inv-row"><strong>Dated</strong> ' + escapeHtml(dt) + ' IST</div>' +
      '</div></header>' +
      '<div class="grid2">' +
      '<section class="card"><h2>Bill to</h2><div class="addr">' + billHtml + '</div></section>' +
      '<section class="card"><h2>Deliver / fulfil</h2><div class="addr">' + shipInner + '</div></section>' +
      '</div>' +
      '<table><thead><tr><th scope="col">Description</th><th scope="col">Qty</th>' +
      '<th scope="col">Amount (₹)</th></tr></thead><tbody>' + bodyRows + '</tbody></table>' +
      '<div class="tot"><div class="totbox">' +
      '<div class="totrow"><span>Catalogue subtotal</span><span><b>' + escapeHtml(formatRupeesDecimals(sub)) + '</b></span></div>' +
      totDiscountRow +
      '<div class="totrow"><span>Value after discount (reference)</span><span><b>' + escapeHtml(formatRupeesDecimals(taxableAfterDisc)) + '</b></span></div>' +
      '<div class="totrow"><span>' + escapeHtml(gstLabel) + '</span><span><b>' + escapeHtml(formatRupeesDecimals(gst)) + '</b></span></div>' +
      '<div class="totrow grand"><span>Grand total</span><span>' + escapeHtml(formatRupeesDecimals(total)) + '</span></div>' +
      '</div></div>' +
      '<div class="sig"><div><span style="border-top:1px solid var(--line);display:inline-block;min-width:180px;margin-top:32px;padding-top:6px">Customer sign.</span></div>' +
      '<div>For <strong>' + escapeHtml(displayStore) + '</strong><div style="margin-top:36px">' +
      '<span style="border-top:1px solid var(--line);display:inline-block;min-width:200px;padding-top:6px">Authorised signatory</span>' +
      '</div></div></div>' +
      '<p class="foot">Computer-generated document · Review GST treatment with your Chartered Accountant · ' +
      'Eyewoot / Cosmos ERP handover artifact</p>' +
      '</div></body></html>'
  }

  function openPosHandoverInvoicePreview(storeName, detailSnap, prefs, invoiceNo) {
    let html
    try {
      html = buildPosHandoverInvoicePreviewHtml(storeName, detailSnap, prefs, invoiceNo)
    } catch (_e) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Could not build invoice preview.')
      return null
    }
    const overlay = document.getElementById('overlay-pos-invoice-preview')
    const frame = document.getElementById('pos-invoice-preview-frame')
    const metaEl = document.getElementById('pos-invoice-preview-meta')
    if (!overlay || !frame) {
      _posHandoverInvoicePreviewLast = {
        storeName: storeName || 'Store',
        detailSnap: detailSnap,
        prefs: prefs || {},
        invoiceNo: invoiceNo || null
      }
      if (typeof cosmosToastWarn === 'function') {
        cosmosToastWarn('Invoice preview is missing from this page — save POS_Prototype.html and hard-refresh.')
      }
      return null
    }
    try {
      frame.srcdoc = html
    } catch (_e2) {
      if (typeof cosmosToastError === 'function') cosmosToastError('Could not render invoice in the preview panel.')
      return null
    }
    if (metaEl) {
      metaEl.textContent = 'Invoice ' + String(invoiceNo || '') +
        ' — review the layout below. Use Print for a physical copy.'
    }
    bindPosHandoverOverlays()
    overlay.classList.add('open')
    overlay.setAttribute('aria-hidden', 'false')
    _posHandoverInvoicePreviewLast = {
      storeName: storeName || 'Store',
      detailSnap: detailSnap,
      prefs: prefs || {},
      invoiceNo: invoiceNo || null
    }
    return overlay
  }

  window.closePosHandoverModal = closePosHandoverModal

  window.posAdvanceLabStage = async function(orderId, subOrderId, toStatus, btn) {
    if (typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn)
    try {
      const session = getPosSession()
      await apiPost('/api/orders/' + orderId + '/lab-status', { sub_order_id: subOrderId, to_status: toStatus }, session.token)
      if (typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn)
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Lab stage: ' + posLabWfDisplay(toStatus))
      setTimeout(() => loadPosOrders(), 600)
    } catch (err) {
      if (typeof cosmosBtnDone === 'function') cosmosBtnDone(btn)
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
    }
  }

  window.openBalanceCollection = async function(orderId) {
    await openPosHandoverModal(orderId)
  }

  function bindPosLensNewCustomerModal() {
    var custPick = document.getElementById('overlay-pos-customer-picker')
    var custBackdrop = document.getElementById('pos-cust-picker-backdrop')
    var custDismiss = document.getElementById('pos-cust-picker-dismiss')
    var custCancel = document.getElementById('cust-picker-btn-cancel')
    var custDone = document.getElementById('cust-picker-btn-done')
    var custSearchBtn = document.getElementById('cust-picker-btn-search')
    var custSearchInp = document.getElementById('cust-picker-search-input')
    var custCreateBtn = document.getElementById('cust-picker-btn-create')
    var custNameIn = document.getElementById('cust-picker-new-name')
    var custPhoneIn = document.getElementById('cust-picker-new-phone')
    var custEmailIn = document.getElementById('cust-picker-new-email')
    var overlay = document.getElementById('overlay-pos-lens-new-customer')
    var backdrop = document.getElementById('pos-lens-newcust-backdrop')
    var dismiss = document.getElementById('pos-lens-new-cust-dismiss')
    var cancel = document.getElementById('btn-pos-lens-new-cust-cancel')
    var submitBtn = document.getElementById('btn-pos-lens-new-cust-submit')
    var nameIn = document.getElementById('pos-lens-new-cust-name')
    var phoneIn = document.getElementById('pos-lens-new-cust-phone')
    var rxOverlay = document.getElementById('overlay-pos-lens-rx-manual')
    var rxBackdrop = document.getElementById('pos-lens-rx-manual-backdrop')
    var rxDismiss = document.getElementById('pos-lens-rx-manual-dismiss')
    var rxCancel = document.getElementById('btn-pos-lens-rx-manual-cancel')
    var rxDone = document.getElementById('btn-pos-lens-rx-manual-done')
    if (!overlay && !rxOverlay && !custPick) return
    custBackdrop && custBackdrop.addEventListener('click', closePosCustomerPickerModal)
    custDismiss && custDismiss.addEventListener('click', closePosCustomerPickerModal)
    custCancel && custCancel.addEventListener('click', closePosCustomerPickerModal)
    custDone && custDone.addEventListener('click', function () {
      closePosCustomerPickerModal()
      var s = getPosSession()
      if (s && s.token) refreshCartSidebar(s)
      navigate(POS_ROUTES.ORDER)
    })
    custSearchBtn && custSearchBtn.addEventListener('click', function () { void runCustomerSearch() })
    if (custSearchInp) {
      custSearchInp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault()
          void runCustomerSearch()
        }
      })
    }
    custCreateBtn && custCreateBtn.addEventListener('click', function () { void handleCustomerCreate() })
    if (custNameIn && typeof cosmosFieldClear === 'function') {
      custNameIn.addEventListener('input', function () { cosmosFieldClear(custNameIn) })
    }
    if (custPhoneIn && typeof cosmosFieldClear === 'function') {
      custPhoneIn.addEventListener('input', function () { cosmosFieldClear(custPhoneIn) })
    }
    if (custEmailIn && typeof cosmosFieldClear === 'function') {
      custEmailIn.addEventListener('input', function () { cosmosFieldClear(custEmailIn) })
    }
    backdrop && backdrop.addEventListener('click', closeLensNewCustomerModal)
    dismiss && dismiss.addEventListener('click', closeLensNewCustomerModal)
    cancel && cancel.addEventListener('click', closeLensNewCustomerModal)
    if (submitBtn) submitBtn.addEventListener('click', function () { void submitLensModalNewCustomer(submitBtn) })
    if (nameIn && typeof cosmosFieldClear === 'function') {
      nameIn.addEventListener('input', function () { cosmosFieldClear(nameIn) })
    }
    if (phoneIn && typeof cosmosFieldClear === 'function') {
      phoneIn.addEventListener('input', function () { cosmosFieldClear(phoneIn) })
    }
    rxBackdrop && rxBackdrop.addEventListener('click', closeLensRxManualModal)
    rxDismiss && rxDismiss.addEventListener('click', closeLensRxManualModal)
    rxCancel && rxCancel.addEventListener('click', closeLensRxManualModal)
    rxDone && rxDone.addEventListener('click', closeLensRxManualModal)
    document.addEventListener('keydown', function onLensCustModalEscape(ev) {
      if (ev.key !== 'Escape') return
      if (custPick && custPick.classList.contains('open')) {
        ev.preventDefault()
        closePosCustomerPickerModal()
        return
      }
      if (rxOverlay && rxOverlay.classList.contains('open')) {
        ev.preventDefault()
        closeLensRxManualModal()
        return
      }
      if (overlay && overlay.classList.contains('open')) {
        ev.preventDefault()
        closeLensNewCustomerModal()
      }
    })
  }

  // ── 5-step lens checkout strip (hoisted; cart & pay are off this bar) ─────
  var checkout5NavBound = false
  function inferPosCheckoutStage() {
    const path = normalizePosPath(window.location.pathname.replace(/\/+$/, '') || '')
    if (path === POS_ROUTES.CONFIRM) return 7
    if (path === POS_ROUTES.PAYMENT) return 6
    if (path === POS_ROUTES.ORDER) return 5
    if (path === POS_ROUTES.LENS) {
      syncLensWizardStepNumber()
      if (lensWizard.step === 0) return 1
      if (lensWizard.step === 1) return 2
      if (lensWizard.step === 2) return lensWizard.subPhase === 'addons' ? 3 : 4
    }
    return 0
  }
  function applyLensCheckoutStageTarget(targetStage) {
    if (targetStage <= 1) {
      lensWizard.step = 0
      lensWizard.subPhase = 'profile'
      return
    }
    if (targetStage === 2) {
      lensWizard.step = 1
      lensWizard.subPhase = 'profile'
      return
    }
    lensWizard.step = 2
    if (targetStage === 3 && lensWizard.pkg && (lensWizard.pkg.addons || []).length) {
      lensWizard.subPhase = 'addons'
      return
    }
    lensWizard.subPhase = 'profile'
  }
  function goCheckoutStageBack(targetStage) {
    const cur = inferPosCheckoutStage()
    if (targetStage >= cur || targetStage < 1) return
    const session = getPosSession()
    if (!session || !isSessionValid(session)) {
      navigate(POS_ROUTES.LOGIN)
      return
    }
    if (targetStage <= 4) {
      if (lensWizardLineIdx < 0) {
        const idx = obCart.findIndex(function (l) { return l.fulfillment === 'LAB' })
        if (idx < 0) {
          if (typeof cosmosToastWarn === 'function') cosmosToastWarn('No lab line to open in lens setup.')
          return
        }
        lensWizardLineIdx = idx
      }
      lensWizardBackRoute = POS_ROUTES.ORDER
      applyLensCheckoutStageTarget(targetStage)
      navigate(POS_ROUTES.LENS)
      return
    }
    if (targetStage === 5) {
      navigate(POS_ROUTES.ORDER)
      return
    }
    if (targetStage === 6 && lastCreatedOrder) {
      navigate(POS_ROUTES.PAYMENT)
    }
  }
  function refreshCheckout5Nav() {
    const nav = document.getElementById('pos-lk-lens-checkout-5')
    if (!nav) return
    const path = normalizePosPath(window.location.pathname.replace(/\/+$/, '') || '')
    if (path !== POS_ROUTES.LENS) return
    const stage = inferPosCheckoutStage()
    if (stage < 1 || stage > 5) return
    nav.querySelectorAll('[data-checkout-stage]').forEach(function (btn) {
      const n = Number(btn.getAttribute('data-checkout-stage'))
      btn.classList.toggle('is-active', n === stage)
      btn.classList.toggle('is-done', n < stage)
      btn.disabled = n > stage
    })
  }
  function bindCheckout5NavOnce() {
    if (checkout5NavBound) return
    checkout5NavBound = true
    const nav = document.getElementById('pos-lk-lens-checkout-5')
    if (!nav) return
    nav.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-checkout-stage]')
      if (!btn || btn.disabled) return
      const n = Number(btn.getAttribute('data-checkout-stage'))
      const cur = inferPosCheckoutStage()
      if (n < cur) goCheckoutStageBack(n)
    })
  }

  // ── Boot ─────────────────────────────────────────────────────────────────
  ;(function boot() {
    document.body.addEventListener('click', function onPosLogoutClick(e) {
      var btn = e.target.closest('.pos-lk-logout-btn')
      if (!btn) return
      e.preventDefault()
      void performPosStaffLogout()
    })

    // Sidebar navigation delegation
    document.body.addEventListener('click', function onPosSidebarNav(e) {
      var btn = e.target.closest('[data-pos-sb-nav]')
      if (!btn) return
      var key = btn.getAttribute('data-pos-sb-nav')
      if (key === 'catalogue')  navigate(POS_ROUTES.CATALOGUE)
      if (key === 'new-order')  navigate(POS_ROUTES.CATALOGUE)
      if (key === 'set-pin')    navigate(POS_ROUTES.SET_PIN)
      if (key === 'orders')     navigate(POS_ROUTES.ORDERS)
    })

    var setpinNumpad = document.getElementById('pos-setpin-numpad')
    if (setpinNumpad) {
      setpinNumpad.addEventListener('click', function (e) {
        var btn = e.target.closest('.pos-numpad-btn')
        if (!btn || btn.classList.contains('ghost')) return
        if (btn.id === 'btn-setpin-backspace') {
          posSetPinRemoveDigit()
          return
        }
        var dig = btn.getAttribute('data-sp-digit')
        if (dig != null) posSetPinAddDigit(dig)
      })
      setpinNumpad.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return
        var btn = e.target.closest('.pos-numpad-btn')
        if (btn) btn.click()
      })
    }
    var btnSetPinSave = document.getElementById('btn-setpin-save')
    if (btnSetPinSave) btnSetPinSave.addEventListener('click', function () { void handlePosSetPinSave() })
    var btnSetPinBack = document.getElementById('btn-setpin-back')
    if (btnSetPinBack) btnSetPinBack.addEventListener('click', function () { navigate(POS_ROUTES.CATALOGUE) })

    bindRxPlanoHandlers()
    bindCatalogueEvents()
    bindCustomerLensPayEvents()
    bindOrderBuilderEvents()
    bindCheckout5NavOnce()
    loadSavedCart()
    bindPosLensNewCustomerModal()
    document.addEventListener('visibilitychange', function onPosVisibilityRefresh() {
      if (document.visibilityState !== 'visible') return
      var visSession = getPosSession()
      if (!visSession || !visSession.token || !isSessionValid(visSession)) return
      void loadPosBootstrap(visSession)
    })
    resolve()
  })()
  })
})()
