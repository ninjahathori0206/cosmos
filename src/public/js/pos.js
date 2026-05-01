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
  const POS_CART_KEY    = 'pos_cart'

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

  async function apiPost(path, payload, token) {
    await ensureCosmosApiKeyFromBootstrap()
    const headers = { 'Content-Type': 'application/json', 'X-API-Key': getApiKey() }
    if (token) headers['Authorization'] = 'Bearer ' + token
    const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(payload) })
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
    'screen-pos-orders':        'orders'
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
    document.querySelectorAll('.pos-screen').forEach(function (el) { el.classList.remove('active') })
    var target = document.getElementById(id)
    if (target) target.classList.add('active')
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
    LOGIN:     '/storeos/login',
    DASHBOARD: '/storeos/dashboard',
    /** Post-PIN success screen (avoid path segment "session" — some proxies/ad lists block it). */
    SESSION:   '/storeos/staff-ready',
    CATALOGUE: '/storeos/catalogue',
    /** Product detail — canonical form is /storeos/product/:productId/:skuId */
    PRODUCT:   '/storeos/product',
    CUSTOMER:  '/storeos/customer',
    ORDER:     '/storeos/cart',
    LENS:      '/storeos/lens-config',
    PAYMENT:   '/storeos/payment',
    CONFIRM:   '/storeos/confirm',
    ORDERS:    '/storeos/orders'
  }

  function productRoute(productId, skuId) {
    return '/storeos/product/' + productId + '/' + skuId
  }

  /** Alternate paths → canonical (Pencil / marketing URLs, spelling variants). */
  const POS_PATH_ALIASES = {
    '/pos': POS_ROUTES.LOGIN,
    '/storeos': POS_ROUTES.LOGIN,
    '/pos/login': POS_ROUTES.LOGIN,
    '/pos/dashboard': POS_ROUTES.DASHBOARD,
    '/pos/session': POS_ROUTES.SESSION,
    '/storeos/session': POS_ROUTES.SESSION,
    '/pos/catelogue': POS_ROUTES.CATALOGUE,
    '/pos/catalog': POS_ROUTES.CATALOGUE,
    '/storeos/catelogue': POS_ROUTES.CATALOGUE,
    '/storeos/catalog': POS_ROUTES.CATALOGUE,
    '/storeos/order': POS_ROUTES.ORDER
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

    if (path === POS_ROUTES.CATALOGUE) {
      if (!valid) { navigate(POS_ROUTES.LOGIN); return }
      void showCatalogueScreen(session)
      return
    }

    if (path === POS_ROUTES.CUSTOMER) {
      if (!valid) { navigate(POS_ROUTES.LOGIN); return }
      showCustomerScreen(session)
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
          showProductPageScreen(session)
        } else {
          void resolveProductByIds(session, pId, sId)
        }
        return
      }
      showProductPageScreen(session)
      return
    }

    if (path === POS_ROUTES.ORDER) {
      if (!valid) { navigate(POS_ROUTES.LOGIN); return }
      if (pendingResumeOrder) {
        pendingResumeOrder = false
        showOrderBuilderScreenResume(session)
        return
      }
      if (obCart.length > 0) {
        showOrderBuilderScreenResume(session)
        return
      }
      if (!pendingOrderSelection) { showOrderBuilderScreenResume(session); return }
      showOrderBuilderScreen(session, pendingOrderSelection)
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

    if (path === POS_ROUTES.SESSION) {
      if (!valid) { navigate(POS_ROUTES.LOGIN); return }
      document.getElementById('success-staff-name').textContent  = session.name || ''
      document.getElementById('success-role-badge').textContent  = formatRole(session.role)
      document.getElementById('success-store-name').textContent  = session.store_name || ''
      document.getElementById('success-session-time').textContent = formatTime(new Date(session.logged_in_at))
      showScreen('screen-login-success')
      return
    }

    // /pos, /pos/login, or any unrecognised path → login
    // If session is still valid, bounce to session screen (tablet returning from sleep)
    if (valid) { navigate(POS_ROUTES.SESSION); return }
    if (session) clearPosSession()
    showScreen('screen-login')
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
  const PIN_LENGTH      = 4
  let activeCatalogueScope = 'store'
  let selectedProductId = null
  let searchDebounceTimer = null
  let pendingOrderSelection = null
  let pendingResumeOrder = false
  let posSelectedCustomerId = null
  let posSettings = { gst_rate: 0.05, lab_advance_pct: 40 }
  let lensCatalogData = null
  let lensWizardLineIdx = -1
  let lensWizardBackRoute = POS_ROUTES.ORDER
  let lensWizard = {
    step: 0,
    powerType: null,
    category: null,
    pkg: null,
    addonIds: [],
    powerMode: null,
    rx: { od: { sph: '', cyl: '', axis: '', plano: false }, os: { sph: '', cyl: '', axis: '', plano: false }, pd: '', doctor: '' }
  }
  let lastCreatedOrder = null
  let lastPaymentReceipt = null
  let paySessionSnapshot = { stage: 'FULL', amount: 0 }
  let payMinimumAdvanceAmount = 0
  let payMinimumAdvancePct = 0
  let forceBalanceSettlement = false
  let posDeliveryMode = 'STORE'

  // ── Order Builder state ──────────────────────────────────────────────────
  let obCart = []

  // Pencil 02-power-type — five power options shown in the Lens wizard step 0.
  // Each maps to the closest catalogue category by `match` (substring match
  // against the category name). When `match` is null (e.g. Frame Only) the
  // wizard skips lens selection entirely.
  const POWER_TYPES = [
    { key: 'with',         icon: '👁',  iconColor: '#2563EB', title: 'With Power',           sub: 'Most common - I have a prescription', match: 'single' },
    { key: 'zero',         icon: '🛡',  iconColor: '#0D9F7B', title: 'Zero Power',           sub: 'BLU Screen lenses for digital devices', match: 'zero' },
    { key: 'reading',      icon: '📖',  iconColor: '#D97706', title: 'Reading Power',        sub: '',                                       match: 'single' },
    { key: 'progressive',  icon: '🪟',  iconColor: '#7C3AED', title: 'Progressive / Bifocals', sub: 'For both near and far vision',         match: 'bifocal' },
    { key: 'frame',        icon: '⬜',  iconColor: '#64748B', title: 'Frame Only',           sub: 'No lenses required',                     match: null }
  ]

  function findCategoryForPowerType(powerType) {
    if (!powerType || !powerType.match || !lensCatalogData) return null
    const cats = lensCatalogData.categories || []
    const needle = powerType.match.toLowerCase()
    return cats.find(function (c) { return String(c.name || '').toLowerCase().indexOf(needle) >= 0 }) || cats[0] || null
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]
    })
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
  const pinDots           = document.querySelectorAll('.pos-pin-dot')
  const pinError          = document.getElementById('pin-error')
  const numpad            = document.getElementById('pos-numpad')
  const btnUnlock         = document.getElementById('btn-unlock-pos')
  const btnEnterPos       = document.getElementById('btn-enter-pos')
  const catalogueStaff    = document.getElementById('pos-catalogue-staff')
  const catalogueStore    = document.getElementById('pos-catalogue-store')
  const btnScopeStore     = document.getElementById('btn-scope-store')
  const btnScopeGlobal    = document.getElementById('btn-scope-global')
  const brandSelect       = document.getElementById('pos-catalogue-brand')
  const searchInput       = document.getElementById('pos-search-code')
  const btnSearch         = document.getElementById('btn-pos-search')
  const btnHeaderCart     = document.getElementById('btn-pos-header-cart')
  const headerCartCountEl = document.getElementById('pos-header-cart-count')
  const catalogueMeta     = document.getElementById('pos-catalogue-meta')
  const catalogueResults  = document.getElementById('pos-catalogue-results')
  const btnPosCustomer    = document.getElementById('btn-pos-customer')
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
  const obTotal           = document.getElementById('pos-ob-total')
  const obDiscountLine    = document.getElementById('pos-ob-discount-line')
  const obDiscountVal     = document.getElementById('pos-ob-discount-val')
  const lkCartCountEl     = document.getElementById('pos-lk-cart-count')
  const btnObProceed      = document.getElementById('btn-ob-proceed')
  const obStaffEl         = document.getElementById('pos-ob-staff')
  const obStoreEl         = document.getElementById('pos-ob-store')
  const rxPlanoOd         = document.getElementById('rx-plano-od')
  const rxPlanoOs         = document.getElementById('rx-plano-os')
  const rxPd              = document.getElementById('rx-pd')

  // ── POS config (from API) ────────────────────────────────────────────────
  async function loadPosBootstrap(session) {
    if (!session || !session.token) return
    if (window.posConfig && window.posConfig.__loaded && window.__posSettingsLoaded) return
    try {
      const cfg = await apiGet('/api/pos/startup-config', session.token)
      window.posConfig = Object.assign({}, cfg, { __loaded: true })
      const st = await apiGet('/api/pos/settings', session.token)
      posSettings = st || posSettings
      window.posSettings = posSettings
      window.__posSettingsLoaded = true
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

  // ── Load stores ──────────────────────────────────────────────────────────
  async function loadStores() {
    storeSelectorName.textContent = 'Fetching stores'
    storeSelectorBtn.disabled = true
    try {
      const stores = await publicGet('/api/pos/stores')
      renderStoreDropdown(stores)
      if (stores.length === 1) {
        selectStore(stores[0].store_id, stores[0].store_name)
      } else {
        storeSelectorName.textContent = 'Select a store'
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
    resetPin()
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
    pinError.textContent = msg
  }

  function clearPinError() {
    pinError.textContent = ''
  }

  function addDigit(digit) {
    if (pinDigits.length >= PIN_LENGTH) return
    pinDigits.push(digit)
    renderPinDots()
    clearPinError()
    if (pinDigits.length === PIN_LENGTH) handleLogin()
  }

  function removeDigit() {
    if (!pinDigits.length) return
    pinDigits.pop()
    renderPinDots()
    clearPinError()
  }

  // ── Numpad events ────────────────────────────────────────────────────────
  numpad.addEventListener('click', e => {
    const btn = e.target.closest('.pos-numpad-btn')
    if (!btn || btn.classList.contains('ghost')) return
    if (btn.id === 'btn-backspace') { removeDigit(); return }
    const digit = btn.dataset.digit
    if (digit !== undefined) addDigit(digit)
  })

  numpad.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    const btn = e.target.closest('.pos-numpad-btn')
    if (btn) btn.click()
  })

  // Physical keyboard support (useful in dev / external keyboard on tablet)
  document.addEventListener('keydown', e => {
    if (document.getElementById('screen-login').classList.contains('active')) {
      if (e.key >= '0' && e.key <= '9') addDigit(e.key)
      if (e.key === 'Backspace') removeDigit()
    }
  })

  // ── Login handler ────────────────────────────────────────────────────────
  async function handleLogin() {
    if (!selectedStoreId) {
      showPinError('Please select a store first.')
      resetPin(true)
      return
    }

    cosmosBtnLoading(btnUnlock)

    try {
      const pin = pinDigits.join('')
      const result = await apiPost('/api/pos/staff-login', { pin, store_id: selectedStoreId })

      // Persist session
      savePosSession({
        token:       result.data.token,
        employee_id: result.data.employee_id,
        name:        result.data.name,
        role:        result.data.role,
        store_id:    result.data.store_id,
        store_name:  selectedStoreName,
        logged_in_at: new Date().toISOString()
      })

      cosmosBtnSuccess(btnUnlock)
      navigate(POS_ROUTES.SESSION)
    } catch (err) {
      cosmosBtnDone(btnUnlock)
      showPinError('Invalid PIN — try again')
      resetPin(true)
    }
  }

  btnUnlock.addEventListener('click', () => {
    if (pinDigits.length === PIN_LENGTH) handleLogin()
    else showPinError('Enter your 4-digit PIN to continue.')
  })

  // ── Success screen ───────────────────────────────────────────────────────
  function showSuccessScreen(data) {
    document.getElementById('success-staff-name').textContent  = data.name || ''
    document.getElementById('success-role-badge').textContent  = formatRole(data.role)
    document.getElementById('success-store-name').textContent  = selectedStoreName
    document.getElementById('success-session-time').textContent = formatTime(new Date())
    showScreen('screen-login-success')
  }

  btnEnterPos.addEventListener('click', () => navigate(POS_ROUTES.CATALOGUE))

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

  function buildSwatches(product, activeSkuId) {
    return product.colours.map(c => {
      const isActive = c.sku_id === activeSkuId
      const hex = colourToHex(c.colour_name, c.colour_code)
      return `<div class="pos-sku-swatch${isActive ? ' active' : ''}"
        style="background:${hex}"
        data-product-id="${product.product_id}"
        data-sku-id="${c.sku_id}"
        title="${c.colour_name}"
        tabindex="0"
        role="button"
        aria-label="${c.colour_name}${isActive ? ' selected' : ''}"></div>`
    }).join('') + (product.colours.length > 1 ? `<span class="pos-sku-swatch-count">${product.colours.length}</span>` : '')
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
      const hasStock = activeColour.store_qty > 0
      const lensCopy = String(product.lens_copy || '').trim()
      const deliveryCopy = product.delivery_copy || (hasStock ? 'Delivery by 6, May' : 'Click disabled in this state')
      const deliveryClass = hasStock ? '' : ' muted'

      const card = document.createElement('div')
      card.className = 'pos-lk-cat-card' + (isSelected ? ' active' : '')
      card.id = 'pos-sku-card-' + product.product_id
      card.setAttribute('role', 'button')
      const titleLine = formatPdpCollectionModelLine(product)
      const brandLine = String(product.brand_name || '').trim()
      card.setAttribute('aria-label', [titleLine, brandLine].filter(Boolean).join(' — '))
      card.setAttribute('tabindex', '0')
      card.dataset.productId = String(product.product_id)
      card.dataset.skuId = String(activeColour.sku_id)

      card.innerHTML = `
        <div class="pos-lk-cat-img" aria-hidden="true">${typeEmoji(product.product_type)}</div>
        <div class="pos-lk-cat-title">${escapeHtml(titleLine)}</div>
        ${brandLine ? `<div class="pos-lk-cat-brand">${escapeHtml(brandLine)}</div>` : ''}
        <div class="pos-lk-cat-price-line">${inrFormat(activeColour.sale_price)}${lensCopy ? ' ' + escapeHtml(lensCopy) : ''}</div>
        <div class="pos-lk-cat-meta${deliveryClass}">${deliveryCopy}</div>
      `

      function openProductFor(c) {
        selectedProductId = [product.product_id, c.sku_id]
        pendingOrderSelection = { colour: c, product: product }
        navigate(productRoute(product.product_id, c.sku_id))
      }

      card.addEventListener('click', e => {
        if (!hasStock) return
        e.preventDefault()
        e.stopPropagation()
        openProductFor(activeColour)
      })

      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (hasStock) openProductFor(activeColour)
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
      // Customer lookup is now embedded in the Add Power step; the legacy
      // toolbar button remains in DOM only for back-compat.
      btnPosCustomer.addEventListener('click', () => navigate(POS_ROUTES.CUSTOMER))
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
  }

  function showProductPageScreen(session) {
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
      showProductPageScreen(session)
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
      showProductPageScreen(session)
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
      powerType: null,
      category: null,
      pkg: null,
      addonIds: [],
      powerMode: null,
      customerName: lensWizard && lensWizard.customerName ? lensWizard.customerName : null,
      rx: { od: { sph: '', cyl: '', axis: '', plano: false }, os: { sph: '', cyl: '', axis: '', plano: false }, pd: '', doctor: '' }
    }
  }

  function showCustomerScreen(session) {
    const banner = document.getElementById('cust-selected-banner')
    const continueBtn = document.getElementById('btn-cust-continue')
    if (banner) {
      banner.textContent = posSelectedCustomerId
        ? ('Selected customer id: ' + posSelectedCustomerId)
        : 'No customer selected — optional for walk-in.'
    }
    if (continueBtn) continueBtn.textContent = posSelectedCustomerId ? 'Continue to Cart' : 'Skip & Continue to Cart'
    showScreen('screen-pos-customer')
  }

  async function runCustomerSearch() {
    const input = document.getElementById('cust-search-input')
    const wrap = document.getElementById('cust-results')
    const q = input ? input.value.trim() : ''
    const session = getPosSession()
    if (!session || !session.token) return
    if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('cust-results', 4)
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
        btn.className = 'pos-cust-row'
        btn.innerHTML = '<span>' + (r.full_name || '') + '</span><span>' + (r.phone || '') + '</span>'
        btn.addEventListener('click', function () {
          posSelectedCustomerId = r.customer_id
          const b = document.getElementById('cust-selected-banner')
          if (b) b.textContent = 'Selected: ' + (r.full_name || '') + ' (' + (r.phone || '') + ')'
          cosmosToastSuccess('Customer selected')
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
    const nameEl = document.getElementById('cust-new-name')
    const phoneEl = document.getElementById('cust-new-phone')
    const emailEl = document.getElementById('cust-new-email')
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
    const btn = document.getElementById('btn-cust-create')
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn)
    try {
      const res = await apiPost('/api/pos/customer', {
        full_name: name,
        phone: phone,
        email: emailEl && emailEl.value ? emailEl.value.trim() : null
      }, session.token)
      posSelectedCustomerId = res.data.customer_id
      if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn)
      const b = document.getElementById('cust-selected-banner')
      if (b) b.textContent = 'Created and selected: ' + name
      cosmosToastSuccess('Customer created')
    } catch (err) {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn)
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
    }
  }

  function bindCustomerLensPayEvents() {
    const btnBack = document.getElementById('btn-cust-back')
    if (btnBack) btnBack.addEventListener('click', () => navigate(POS_ROUTES.LENS))
    const btnCustContinue = document.getElementById('btn-cust-continue')
    if (btnCustContinue) btnCustContinue.addEventListener('click', () => navigate(POS_ROUTES.ORDER))
    const btnS = document.getElementById('btn-cust-search')
    if (btnS) btnS.addEventListener('click', () => { void runCustomerSearch() })
    const btnC = document.getElementById('btn-cust-create')
    if (btnC) btnC.addEventListener('click', () => { void handleCustomerCreate() })

    const btnLensBack = document.getElementById('btn-lens-back')
    if (btnLensBack) {
      btnLensBack.addEventListener('click', function () {
        if (lensWizard && typeof lensWizard.step === 'number' && lensWizard.step > 0) {
          // Step inside the wizard if we are past the first step.
          if (lensWizard.step === 2 && lensWizard.powerType && lensWizard.powerType.key === 'frame') {
            lensWizard.step = 0
          } else {
            lensWizard.step -= 1
          }
          renderLensStep()
          return
        }
        navigate(lensWizardBackRoute || POS_ROUTES.ORDER)
      })
    }
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
    if (btnPdpSelectLens) btnPdpSelectLens.addEventListener('click', startLensFlowFromProduct)

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
    if (lensWizard.step > 0) {
      lensWizard.step -= 1
      renderLensStep()
    }
  }

  function lensWizardNext() {
    const body = document.getElementById('lens-step-body')
    if (lensWizard.step === 0 && !lensWizard.category) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Pick a category.')
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
    if (lensWizard.step === 2) {
      confirmLensWizard()
    }
  }

  function updateLensStepper(step) {
    const wrap = document.getElementById('pos-lk-lens-stepper')
    if (!wrap) return
    wrap.querySelectorAll('.pos-lk-step-dot').forEach(function (dot, i) {
      dot.classList.toggle('active', i === step)
      dot.classList.toggle('done', i < step)
    })
  }

  function renderLensStep() {
    const body = document.getElementById('lens-step-body')
    if (!body || !lensCatalogData) return
    if (lensWizard.step === 0) return renderLensStep0PowerType(body)
    if (lensWizard.step === 1) return renderLensStep1LensSelection(body)
    if (lensWizard.step === 2) return renderLensStep2AddPower(body)
  }

  // ── Lens step 0 — Pencil 02-power-type: 5 cards (icon + title + sub + ›) ──
  function renderLensStep0PowerType(body) {
    updateLensStepper(0)
    const html = []
    html.push('<div class="pos-lk-lens-headrow">')
    html.push('  <div class="pos-lk-lens-section-title">Select your Power Type:</div>')
    html.push('  <button type="button" class="pos-lk-text-link" aria-disabled="true">Learn more</button>')
    html.push('</div>')
    html.push('<div class="pos-lk-pt-list">')
    POWER_TYPES.forEach(function (pt) {
      const sel = lensWizard.powerType && lensWizard.powerType.key === pt.key ? ' selected' : ''
      html.push(
        '<button type="button" class="pos-lk-pt-card' + sel + '" data-pt-key="' + pt.key + '" tabindex="0">' +
          '<span class="pos-lk-pt-left">' +
            '<span class="pos-lk-pt-icon" style="color:' + pt.iconColor + '">' + pt.icon + '</span>' +
            '<span class="pos-lk-pt-info">' +
              '<span class="pos-lk-pt-title">' + escapeHtml(pt.title) + '</span>' +
              (pt.sub ? '<span class="pos-lk-pt-sub">' + escapeHtml(pt.sub) + '</span>' : '') +
            '</span>' +
          '</span>' +
          '<span class="pos-lk-pt-chevron" aria-hidden="true">›</span>' +
        '</button>'
      )
    })
    html.push('</div>')
    body.innerHTML = html.join('')
    body.querySelectorAll('[data-pt-key]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const key = btn.getAttribute('data-pt-key')
        const pt = POWER_TYPES.find(function (x) { return x.key === key })
        if (!pt) return
        lensWizard.powerType = pt
        lensWizard.category = findCategoryForPowerType(pt)
        lensWizard.pkg = null
        lensWizard.addonIds = []
        if (pt.key === 'frame') {
          // Frame only — skip lens selection entirely; jump to Add Power CTA only.
          lensWizard.step = 2
        } else {
          lensWizard.step = 1
        }
        renderLensStep()
      })
    })
  }

  // ── Lens step 1 — Pencil 03-lens-selection: tab bar + 3-col lens cards ────
  function renderLensStep1LensSelection(body) {
    updateLensStepper(1)
    if (!lensWizard.category) {
      // Cannot show lens packages without a power type → fall back.
      lensWizard.step = 0
      return renderLensStep()
    }
    const cats = lensCatalogData.categories || []
    const tabCats = cats.length ? cats : [lensWizard.category]
    const pkgs = (lensWizard.category && lensWizard.category.packages) ? lensWizard.category.packages : []

    const html = []
    html.push('<div class="pos-lk-lens-headrow">')
    html.push('  <div class="pos-lk-lens-section-title">Choose your Lens:</div>')
    html.push('  <button type="button" class="pos-lk-text-link" aria-disabled="true">Learn more</button>')
    html.push('</div>')

    html.push('<div class="pos-lk-tabs-row" role="tablist">')
    tabCats.forEach(function (c) {
      const isActive = lensWizard.category && c.id === lensWizard.category.id
      html.push(
        '<button type="button" class="pos-lk-tab' + (isActive ? ' active' : '') +
        '" data-cat-id="' + c.id + '" role="tab" aria-selected="' + (isActive ? 'true' : 'false') + '">' +
        escapeHtml(c.name) + '</button>'
      )
    })
    html.push('</div>')

    html.push('<div class="pos-lk-lens-cards">')
    if (pkgs.length === 0) {
      html.push('<div class="pos-empty"><div class="pos-empty-sub">No lens packages available for this category.</div></div>')
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
    body.innerHTML = html.join('')

    body.querySelectorAll('[data-cat-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = Number(btn.getAttribute('data-cat-id'))
        const next = cats.find(function (c) { return c.id === id })
        if (next) {
          lensWizard.category = next
          lensWizard.pkg = null
          renderLensStep()
        }
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
          renderLensStep()
        }
      })
    })
  }

  // ── Lens step 2 — Pencil 04-add-power: customer card + 4 power options ───
  function renderLensStep2AddPower(body) {
    updateLensStepper(2)
    const customerName = lensWizard.customerName || (posSelectedCustomerId ? 'Selected customer #' + posSelectedCustomerId : 'Walk-in customer')
    const initial = customerName ? customerName.trim().charAt(0).toUpperCase() : 'W'

    const html = []
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
      '<div style="font-size:12px;color:var(--lk-text-muted);margin-top:4px">Walk-in customer is allowed if no record exists.</div>' +
    '</div>')

    if (lensWizard.powerType && lensWizard.powerType.key === 'frame') {
      // Frame only — skip power entry; just show CTA.
      html.push('<div class="pos-lk-amber-banner" style="background:#ECFDF5;color:#065F46">' +
        '<span class="pos-lk-amber-banner-icon" style="color:#0D9F7B">✓</span>' +
        '<span>Frame Only — no lens power required.</span>' +
      '</div>')
    } else {
      html.push('<div class="pos-lk-amber-banner">' +
        '<span class="pos-lk-amber-banner-icon">ⓘ</span>' +
        '<span>Not sure which power option to choose?</span>' +
        '<button type="button" class="pos-lk-amber-banner-link">Learn more</button>' +
      '</div>')

      html.push('<div class="pos-lk-section-lbl">I don\'t know my power</div>')
      html.push(buildPowerCard('later',  '🕒', '#0D9F7B', 'Submit Power Later', 'Within 15 days of order delivery'))

      html.push('<div class="pos-lk-section-lbl">I know my power</div>')
      html.push(buildPowerCard('saved',   '🔖', '#2563EB', 'Saved Power',           '3 saved prescriptions for this customer'))
      html.push(buildPowerCard('manual',  '✎',  '#7C3AED', 'Enter Power Manually',  'Type SPH/CYL/AXIS values'))
      html.push('<div id="pos-lk-rx-inline"></div>')
      html.push(buildPowerCard('upload',  '⬆',  '#D97706', 'Upload Prescription',   'JPG / PDF up to 5 MB'))
    }

    html.push('<button type="button" id="pos-lk-continue-payment" class="pos-lk-continue-payment">Continue to Payment</button>')

    body.innerHTML = html.join('')

    body.querySelectorAll('[data-pwm-key]').forEach(function (el) {
      el.addEventListener('click', function () {
        const key = el.getAttribute('data-pwm-key')
        lensWizard.powerMode = key
        body.querySelectorAll('[data-pwm-key]').forEach(function (n) {
          n.classList.toggle('selected', n.getAttribute('data-pwm-key') === key)
        })
        const rxSlot = document.getElementById('pos-lk-rx-inline')
        if (rxSlot) rxSlot.innerHTML = key === 'manual' ? buildInlineRxForm() : ''
        if (key === 'manual') bindInlineRxHandlers()
      })
    })

    const change = document.getElementById('pos-lk-customer-change')
    const dd = document.getElementById('pos-lk-cust-dropdown')
    if (change && dd) {
      change.addEventListener('click', function () {
        dd.style.display = dd.style.display === 'none' ? 'flex' : 'none'
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

    const cta = document.getElementById('pos-lk-continue-payment')
    if (cta) cta.addEventListener('click', confirmLensWizard)
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
        wrap.innerHTML = '<div class="pos-empty-sub">No customers found.</div>'
        return
      }
      rows.forEach(function (r) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'pos-lk-cust-result'
        btn.innerHTML = '<span>' + escapeHtml(r.full_name || '') + '</span><span>' + escapeHtml(r.phone || '') + '</span>'
        btn.addEventListener('click', function () {
          posSelectedCustomerId = r.customer_id
          lensWizard.customerName = r.full_name || ''
          const nameEl = document.getElementById('pos-lk-customer-name')
          if (nameEl) nameEl.textContent = lensWizard.customerName
          const av = document.querySelector('#pos-lk-customer-card .pos-lk-customer-avatar')
          if (av) av.textContent = lensWizard.customerName.charAt(0).toUpperCase()
          const dd = document.getElementById('pos-lk-cust-dropdown')
          if (dd) dd.style.display = 'none'
          if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Customer selected')
        })
        wrap.appendChild(btn)
      })
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
    }
  }

  function confirmLensWizard() {
    const line = obCart[lensWizardLineIdx >= 0 ? lensWizardLineIdx : 0]
    if (!line) {
      if (typeof cosmosToastError === 'function') cosmosToastError('No product selected.')
      return
    }
    const isFrameOnly = lensWizard.powerType && lensWizard.powerType.key === 'frame'
    if (!isFrameOnly) {
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
      if (!lensWizard.powerMode) {
        if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Pick a power option (later, saved, manual or upload).')
        return
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
        addon_prices: addonPrices
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
      line.power_mode = 'frame_only'
      line.rx = null
      line.lab_status = 'complete'
      line.fulfillment = 'INSTANT'
    }
    saveCart()
    lensWizardLineIdx = -1
    navigate(POS_ROUTES.ORDER)
    if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Lens setup complete')
  }

  async function showLensWizardScreen(session) {
    await loadPosBootstrap(session)
    const sessionTok = session.token
    if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('lens-step-body', 4)
    try {
      lensCatalogData = await apiGet('/api/pos/lens-catalog', sessionTok)
      // Inject Mock Data if DB is empty for demonstration!
      if (!lensCatalogData.categories || lensCatalogData.categories.length === 0) {
        lensCatalogData.categories = [
          { id: 1, name: 'Single Vision', packages: [
            { id: 101, name: 'Standard Anti-Glare', price: 500 },
            { id: 102, name: 'Premium Blue-Cut', price: 1200 },
            { id: 103, name: 'Ultra-Thin 1.67', price: 2500 }
          ]},
          { id: 2, name: 'Bifocal / Progressive', packages: [
            { id: 201, name: 'Standard Progressive', price: 3000 },
            { id: 202, name: 'Premium Wide-Corridor', price: 5500 }
          ]},
          { id: 3, name: 'Zero Power (Computer Glasses)', packages: [
            { id: 301, name: 'Blue-Cut Blockers', price: 800 }
          ]}
        ]
        // Add some mock addons
        lensCatalogData.categories.forEach(c => {
          c.packages.forEach(p => {
            p.addons = [
              { id: 901, name: 'Anti-Fog Coating', price: 300 },
              { id: 902, name: 'Photochromic (Transitions)', price: 1500 }
            ]
          })
        })
      }
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
      navigate(POS_ROUTES.ORDER)
      return
    }
    // Preserve any choices the user already made (back navigation), only reset
    // when explicitly starting a fresh flow (handled in startLensFlowFromProduct).
    if (typeof lensWizard.step !== 'number') resetLensWizardState()
    renderLensStep()
    showScreen('screen-pos-lens')
  }

  async function showPaymentScreen(session) {
    const el = document.getElementById('pay-summary')
    showScreen('screen-pos-payment')
    if (!el || !lastCreatedOrder || !session || !session.token) return
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
      // Subtotal / GST / Total
      const gstRate = Number(posSettings.gst_rate) || 0.05
      const gstShown = Math.round((total - total / (1 + gstRate)) * 100) / 100
      const subShown = Math.round((total - gstShown) * 100) / 100
      const sub = document.getElementById('pay-sub')
      const gstEl = document.getElementById('pay-gst')
      const totEl = document.getElementById('pay-total')
      if (sub) sub.textContent = formatRupees(subShown)
      if (gstEl) gstEl.textContent = formatRupees(gstShown)
      if (totEl) totEl.textContent = formatRupees(total)
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
        amtInput.addEventListener('input', function () {
          const v = Math.max(0, Number(this.value) || 0)
          paySessionSnapshot.amount = v
          if (amtSpan) amtSpan.textContent = formatRupees(v)
          // update stage based on amount
          if (labLike && advanceRemaining > 0.009 && v < fullRemaining - 0.009) {
            paySessionSnapshot.stage = 'ADVANCE'
            if (amtBadge) amtBadge.style.display = ''
          } else {
            paySessionSnapshot.stage = 'FULL'
            if (amtBadge) amtBadge.style.display = 'none'
          }
        })
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
      const totEl2 = document.getElementById('pay-total')
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
  }

  async function submitPayment() {
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
    if (amt <= 0) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Nothing to collect — return to catalogue or refresh payment.')
      return
    }
    if (paySessionSnapshot.stage === 'ADVANCE' && amt + 0.01 < payMinimumAdvanceAmount) {
      if (typeof cosmosToastWarn === 'function') {
        cosmosToastWarn('Minimum advance is ' + formatRupees(payMinimumAdvanceAmount) + '. Reduce the amount or collect full payment.')
      }
      return
    }
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn)
    try {
      const payRes = await apiPost('/api/pos/payment', {
        order_id: lastCreatedOrder.order_id,
        stage: paySessionSnapshot.stage,
        method: method,
        amount: amt,
        tendered: method === 'CASH' ? tendered : null,
        external_ref: method === 'CARD' ? externalRef : null
      }, session.token)
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
      clearCartStorage()
      navigate(POS_ROUTES.CONFIRM)
    } catch (err) {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn)
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
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

  function obRecalcTotals() {
    const gstRate = Number(posSettings.gst_rate) || 0.05
    const subtotal = obCart.reduce(function (sum, line) {
      return sum + computeLineDisplayUnit(line) * line.qty
    }, 0)
    const discount = 0
    const taxable = Math.max(0, Math.round((subtotal - discount) * 100) / 100)
    const gst = Math.round(taxable * gstRate * 100) / 100
    const total = Math.round((taxable + gst) * 100) / 100
    if (obSubtotal) obSubtotal.textContent = formatRupees(subtotal)
    if (obDiscountLine) obDiscountLine.textContent = discount > 0 ? ('−' + formatRupees(discount)) : '−₹0'
    if (obDiscountVal) obDiscountVal.textContent = discount > 0 ? ('−' + formatRupees(discount)) : '−₹0'
    if (obGst) obGst.textContent = formatRupees(gst)
    if (obTotal) obTotal.textContent = formatRupees(total)
    if (btnObProceed) {
      btnObProceed.disabled = obCart.length === 0
      btnObProceed.textContent = formatRupees(total) + ' • Proceed to Payment'
    }
    if (lkCartCountEl) {
      const n = obCart.reduce(function (acc, line) { return acc + Math.max(1, Number(line.qty) || 0) }, 0)
      lkCartCountEl.textContent = String(n)
      if (headerCartCountEl) {
        headerCartCountEl.textContent = String(n)
        headerCartCountEl.hidden = n <= 0
      }
    }
  }

  function obRenderCart() {
    if (!obCart_el) return
    updateKindChip()
    if (obCart.length === 0) {
      obCart_el.innerHTML = `
        <div class="pos-empty">
          <div class="pos-empty-title">Cart is empty</div>
          <div class="pos-empty-sub">Add a product from the catalogue to get started.</div>
        </div>
      `
      obRecalcTotals()
      syncRxSectionVisibility()
      return
    }

    let instantLines = obCart.filter(function(l) { return l.fulfillment === 'INSTANT' })
    let labLines = obCart.filter(function(l) { return l.fulfillment === 'LAB' })

    const createLinesHTML = function(lines, title) {
      if (lines.length === 0) return ''
      let html = '<div class="pos-lk-cart-group"><div class="pos-lk-cart-group-title">' + title + '</div>'
      lines.forEach(function(line) {
        let idx = obCart.indexOf(line)
        const rule = getTypeRule(line.product_type)
        const isDual = rule && rule.fulfillment_mode === 'DUAL'
        let fulfillHtml = ''
        if (isDual) {
          fulfillHtml =
            '<div class="pos-ob-line-fulfill">' +
            '<button type="button" class="pos-ob-mini-btn' + (line.fulfillment === 'INSTANT' ? ' active' : '') + '" data-action="set-instant" data-idx="' + idx + '">Frame only</button>' +
            '<button type="button" class="pos-ob-mini-btn' + (line.fulfillment === 'LAB' ? ' active' : '') + '" data-action="set-lab" data-idx="' + idx + '">With Lenses</button>' +
            '</div>'
        }
        let labBadge = ''
        if (line.fulfillment === 'LAB') {
          labBadge = line.lab_status === 'complete'
            ? '<div class="pos-ob-lab-badge configured">✓ Lenses configured</div>'
            : '<div class="pos-ob-lab-badge error">⚠ Action required</div>'
        }
        let lensTag = ''
        if (line.fulfillment === 'LAB' && line.lab_status === 'complete' && line.lens_bundle) {
          lensTag = '<span class="pos-lk-cart-tag">Lens package selected</span>'
        } else if (line.fulfillment === 'LAB') {
          lensTag = '<span class="pos-lk-cart-tag">Eye power · configure lenses</span>'
        }
        const delTag = line.fulfillment === 'LAB'
          ? '<span class="pos-lk-cart-tag">' + (line.lab_status === 'complete' ? '5 day delivery' : 'Lens setup pending') + '</span>'
          : '<span class="pos-lk-cart-tag">Store pickup</span>'
        const du = computeLineDisplayUnit(line)
        html += '<div class="pos-lk-cart-item">' +
          '<button type="button" class="pos-lk-cart-remove" data-action="remove" data-idx="' + idx + '" aria-label="Remove line" tabindex="0">×</button>' +
          '<div class="pos-lk-cart-item-media" aria-hidden="true">' + typeEmoji(line.product_type) + '</div>' +
          '<div class="pos-lk-cart-item-body">' +
            '<div class="pos-lk-cart-item-title">' + line.product_name + '</div>' +
            '<div class="pos-lk-cart-item-sub">' + line.brand_name + ' · ' + line.colour_name + '</div>' +
            '<div class="pos-lk-cart-item-tags">' + lensTag + delTag + '</div>' +
            fulfillHtml +
            labBadge +
            (line.fulfillment === 'LAB' && line.lab_status !== 'complete'
              ? '<button type="button" class="pos-ob-mini-btn action-btn" data-action="configure-lens" data-idx="' + idx + '">Select Lenses →</button>'
              : '') +
            '<div class="pos-ob-qty-ctrl" aria-label="Quantity">' +
              '<button type="button" class="pos-ob-qty-btn" data-action="dec" data-idx="' + idx + '" tabindex="0" ' + (line.qty <= 1 ? 'disabled' : '') + '>−</button>' +
              '<span class="pos-ob-qty-val">' + line.qty + '</span>' +
              '<button type="button" class="pos-ob-qty-btn" data-action="inc" data-idx="' + idx + '" tabindex="0">+</button>' +
            '</div>' +
          '</div>' +
          '<div class="pos-lk-cart-item-price">' +
            '<span class="pos-lk-cart-fl-label">Frame + Lens</span>' +
            '<span class="pos-lk-cart-fl-price">' + formatRupees(du * line.qty) + '</span>' +
          '</div>' +
        '</div>'
      })
      html += '</div>'
      return html
    }

    obCart_el.innerHTML = createLinesHTML(instantLines, 'Instant pickup') + createLinesHTML(labLines, 'Lab order')
    obRecalcTotals()
    syncRxSectionVisibility()
  }

  function obHandleCartClick(e) {
    const btn = e.target.closest('[data-action]')
    if (!btn) return
    const action = btn.dataset.action
    const idx = Number(btn.dataset.idx)
    if (action === 'inc') {
      const rule = getTypeRule(obCart[idx].product_type)
      if (rule && !rule.allow_qty_gt_1 && obCart[idx].qty >= 1) return
      obCart[idx].qty += 1
    } else if (action === 'dec') {
      if (obCart[idx].qty > 1) obCart[idx].qty -= 1
    } else if (action === 'remove') {
      obCart.splice(idx, 1)
    } else if (action === 'set-instant') {
      obCart[idx].fulfillment = 'INSTANT'
      obCart[idx].lab_status = null
      obCart[idx].lens_bundle = null
    } else if (action === 'set-lab') {
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
    const fulfillment = defaultFulfillmentForRule(rule)
    const candidate = {
      product_id: product.product_id,
      sku_id: colour.sku_id,
      sku_code: colour.sku_code,
      product_name: product.product_name,
      brand_name: product.brand_name,
      colour_name: colour.colour_name,
      product_type: product.product_type || '',
      frame_unit_price: colour.sale_price || 0,
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

  function syncCartDeliveryStoreName(session) {
    const el = document.getElementById('pos-lk-delivery-store-name')
    if (el && session && session.store_name) {
      el.textContent = session.store_name
    }
  }

  function showOrderBuilderScreen(session, selection) {
    obStaffEl.textContent = session.name + ' • ' + formatRole(session.role)
    obStoreEl.textContent = session.store_name
    obCart = []
    clearCartStorage()
    if (selection) addToCart(selection)
    updateKindChip()
    syncRxSectionVisibility()
    syncCartDeliveryStoreName(session)
    obRenderCart()
    showScreen('screen-pos-order-builder')
  }

  function showOrderBuilderScreenResume(session) {
    obStaffEl.textContent = session.name + ' • ' + formatRole(session.role)
    obStoreEl.textContent = session.store_name
    updateKindChip()
    syncRxSectionVisibility()
    syncCartDeliveryStoreName(session)
    obRenderCart()
    showScreen('screen-pos-order-builder')
  }

  function bindOrderBuilderEvents() {
    btnObBack.addEventListener('click', () => navigate(POS_ROUTES.CATALOGUE))
    btnObAddMore.addEventListener('click', () => navigate(POS_ROUTES.CATALOGUE))

    obCart_el.addEventListener('click', obHandleCartClick)

    btnObProceed.addEventListener('click', () => { void handleProceedToPayment() })
  }

  /** Clears POS tablet session, checkout state, and returns to PIN login (same tab). */
  function performPosLogout() {
    clearPosSession()
    obCart = []
    clearCartStorage()
    pendingResumeOrder = false
    pendingOrderSelection = null
    posSelectedCustomerId = null
    selectedProductId = null
    lensWizardLineIdx = -1
    lensWizardBackRoute = POS_ROUTES.ORDER
    lensWizard = {
      step: 0,
      powerType: null,
      category: null,
      pkg: null,
      addonIds: [],
      powerMode: null,
      rx: { od: { sph: '', cyl: '', axis: '', plano: false }, os: { sph: '', cyl: '', axis: '', plano: false }, pd: '', doctor: '' }
    }
    lastCreatedOrder = null
    lastPaymentReceipt = null
    paySessionSnapshot = { stage: 'FULL', amount: 0 }
    resetPin(false)
    obRenderCart()
    if (typeof cosmosToastInfo === 'function') cosmosToastInfo('Logged out')
    history.replaceState({}, '', POS_ROUTES.LOGIN)
    resolve(POS_ROUTES.LOGIN)
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
      return l.fulfillment === 'LAB' && l.rx_required && l.power_mode !== 'later' && l.power_mode !== 'frame_only'
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
    const lines = obCart.map(function (line) {
      const b = line.lens_bundle
      const qty = Math.max(1, parseInt(String(line.qty), 10) || 1)
      const unitPrice = Math.max(0, Number(line.frame_unit_price) || 0)
      const out = {
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
      return out
    })
    // Pick the first cart line that captured a per-line Rx in the Lens wizard.
    const rxLine = obCart.find(function (l) { return l.rx })
    const rxSnap = rxLine ? rxLine.rx : null
    if (btnObProceed && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btnObProceed)
    try {
      const res = await apiPost('/api/pos/orders', {
        customer_id: posSelectedCustomerId,
        order_source: 'POS',
        rx_snapshot: rxSnap,
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

  async function showOrderHistoryScreen(session) {
    document.getElementById('pos-orders-staff').textContent = session.name + ' • ' + formatRole(session.role)
    document.getElementById('pos-orders-store').textContent = session.store_name || ''
    
    document.getElementById('btn-orders-back').onclick = () => {
      navigate(POS_ROUTES.CATALOGUE)
    }

    const searchInput = document.getElementById('pos-orders-search')
    const statusSelect = document.getElementById('pos-orders-status')
    const searchBtn = document.getElementById('btn-pos-orders-search')
    if (statusSelect && !statusSelect.querySelector('option[value="PROCESSING"]')) {
      const opt = document.createElement('option')
      opt.value = 'PROCESSING'
      opt.textContent = 'Processing (Lab)'
      statusSelect.appendChild(opt)
    }

    searchBtn.onclick = () => loadOrderHistory(session, searchInput.value, statusSelect.value)
    searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') loadOrderHistory(session, searchInput.value, statusSelect.value)
    }
    statusSelect.onchange = () => loadOrderHistory(session, searchInput.value, statusSelect.value)

    showScreen('screen-pos-orders')
    await loadOrderHistory(session, '', '')
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
            <button style="padding:8px 10px;border:1px solid var(--border);background:var(--card);border-radius:8px;cursor:pointer" onclick="location.reload()">Refresh</button>
          </div>
        `
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
          <div class="pos-order-card">
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
    const session = getPosSession()
    if (!session || !session.token || !orderId) return
    try {
      const detail = await apiGet('/api/pos/orders/' + orderId, session.token)
      lastCreatedOrder = detail.order || null
      forceBalanceSettlement = true
      if (!lastCreatedOrder) {
        if (typeof cosmosToastError === 'function') cosmosToastError('Order not found for balance collection.')
        return
      }
      navigate(POS_ROUTES.PAYMENT)
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
    }
  }

  // ── Boot ─────────────────────────────────────────────────────────────────
  ;(function boot() {
    document.body.addEventListener('click', function onPosLogoutClick(e) {
      var btn = e.target.closest('.pos-lk-logout-btn')
      if (!btn) return
      e.preventDefault()
      performPosLogout()
    })

    // Sidebar navigation delegation
    document.body.addEventListener('click', function onPosSidebarNav(e) {
      var btn = e.target.closest('[data-pos-sb-nav]')
      if (!btn) return
      var key = btn.getAttribute('data-pos-sb-nav')
      if (key === 'catalogue')  navigate(POS_ROUTES.CATALOGUE)
      if (key === 'new-order')  navigate(POS_ROUTES.CATALOGUE)
      if (key === 'orders')     navigate(POS_ROUTES.ORDERS)
    })

    bindRxPlanoHandlers()
    bindCatalogueEvents()
    bindCustomerLensPayEvents()
    bindOrderBuilderEvents()
    loadSavedCart()
    resolve()
  })()
  })
})()
