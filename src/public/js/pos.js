(function initPosApp() {
  'use strict'
  document.addEventListener('DOMContentLoaded', function onPosDomReady() {

  // ── Session helpers ──────────────────────────────────────────────────────
  const API_KEY = sessionStorage.getItem('cosmos_api_key') || ''
  const POS_SESSION_KEY = 'pos_session'

  function getPosSession() {
    try { return JSON.parse(sessionStorage.getItem(POS_SESSION_KEY) || 'null') } catch { return null }
  }

  function savePosSession(data) {
    sessionStorage.setItem(POS_SESSION_KEY, JSON.stringify(data))
  }

  function clearPosSession() {
    sessionStorage.removeItem(POS_SESSION_KEY)
  }

  // ── Generic API fetch ────────────────────────────────────────────────────
  async function apiGet(path, token) {
    const headers = { 'X-API-Key': API_KEY }
    if (token) headers['Authorization'] = 'Bearer ' + token
    const res = await fetch(path, { headers })
    const body = await res.json()
    if (!res.ok || !body.success) throw new Error(body.message || 'Request failed')
    return body.data
  }

  async function publicGet(path) {
    const res = await fetch(path)
    const body = await res.json()
    if (!res.ok || !body.success) throw new Error(body.message || 'Request failed')
    return body.data
  }

  async function apiPost(path, payload, token) {
    const headers = { 'Content-Type': 'application/json', 'X-API-Key': API_KEY }
    if (token) headers['Authorization'] = 'Bearer ' + token
    const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(payload) })
    const body = await res.json()
    if (!res.ok || !body.success) throw new Error(body.message || 'Request failed')
    return body
  }

  // ── Screen navigation (internal — callers use navigate()) ───────────────
  function showScreen(id) {
    document.querySelectorAll('.pos-screen').forEach(el => el.classList.remove('active'))
    const target = document.getElementById(id)
    if (target) target.classList.add('active')
  }

  // ── SPA routing ──────────────────────────────────────────────────────────
  const POS_ROUTES = {
    LOGIN:     '/pos/login',
    DASHBOARD: '/pos/dashboard',
    SESSION:   '/pos/session',
    CATALOGUE: '/pos/catalogue',
    CUSTOMER:  '/pos/customer',
    ORDER:     '/pos/order',
    LENS:      '/pos/lens-config',
    PAYMENT:   '/pos/payment'
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
    const path = (pathname || window.location.pathname).replace(/\/$/, '') || POS_ROUTES.LOGIN
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

    if (path === POS_ROUTES.ORDER) {
      if (!valid) { navigate(POS_ROUTES.LOGIN); return }
      if (pendingResumeOrder) {
        pendingResumeOrder = false
        showOrderBuilderScreenResume(session)
        return
      }
      if (!pendingOrderSelection) { navigate(POS_ROUTES.CATALOGUE); return }
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
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
  let lensWizard = { step: 0, category: null, pkg: null, addonIds: [] }
  let lastCreatedOrder = null
  let paySessionSnapshot = { stage: 'FULL', amount: 0 }

  // ── Order Builder state ──────────────────────────────────────────────────
  let obCart = []

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
  const searchInput       = document.getElementById('pos-search-code')
  const btnSearch         = document.getElementById('btn-pos-search')
  const catalogueMeta     = document.getElementById('pos-catalogue-meta')
  const catalogueResults  = document.getElementById('pos-catalogue-results')
  const selectionPanel    = document.getElementById('pos-catalogue-selection')
  const btnNextOrder      = document.getElementById('btn-pos-next-order')
  const btnPosCustomer    = document.getElementById('btn-pos-customer')

  // ── Order Builder DOM refs ───────────────────────────────────────────────
  const btnObBack         = document.getElementById('btn-ob-back')
  const btnObAddMore      = document.getElementById('btn-ob-add-more')
  const obKindChip        = document.getElementById('pos-ob-kind-chip')
  const obCart_el         = document.getElementById('pos-ob-cart')
  const obRxSection       = document.getElementById('pos-ob-rx-section')
  const obSubtotal        = document.getElementById('pos-ob-subtotal')
  const obGst             = document.getElementById('pos-ob-gst')
  const obTotal           = document.getElementById('pos-ob-total')
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
    const raw = String(productTypeKey || '').trim().toUpperCase()
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

  function renderSelectionState(colour, product) {
    const title = selectionPanel.querySelector('.pos-selection-title')
    const sub = selectionPanel.querySelector('.pos-selection-sub')
    if (!colour || !product) {
      title.textContent = 'No product selected'
      sub.textContent = 'Tap a product card to select it.'
      btnNextOrder.disabled = true
      return
    }
    title.textContent = colour.sku_code + ' • ' + product.product_name
    sub.textContent = product.brand_name + ' • ' + colour.colour_name + ' • ' + inrFormat(colour.sale_price)
    btnNextOrder.disabled = false
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

      const card = document.createElement('div')
      card.className = 'pos-sku-card' + (isSelected ? ' active' : '')
      card.id = 'pos-sku-card-' + product.product_id
      card.setAttribute('role', 'button')
      card.setAttribute('tabindex', '0')
      card.setAttribute('aria-label', product.brand_name + ' ' + product.product_name)

      card.innerHTML = `
        <div class="pos-sku-img">
          <div class="pos-sku-img-fallback">${typeEmoji(product.product_type)}</div>
        </div>
        <div class="pos-sku-body">
          <div class="pos-sku-brand">${product.brand_name}</div>
          <div class="pos-sku-name">${product.product_name}</div>
          ${product.specs ? `<div class="pos-sku-spec">${product.specs}</div>` : ''}
          <div class="pos-sku-swatches" id="pos-sku-swatches-${product.product_id}">
            ${buildSwatches(product, activeColour.sku_id)}
          </div>
          <div class="pos-sku-colour-row">
            <span class="pos-sku-colour-dot" id="pos-colour-dot-${product.product_id}" style="background:${colourToHex(activeColour.colour_name, activeColour.colour_code)}"></span>
            <span class="pos-sku-colour-label" id="pos-colour-label-${product.product_id}">${activeColour.colour_name}</span>
          </div>
          <div class="pos-sku-price-row">
            <span class="pos-sku-price" id="pos-sku-price-${product.product_id}">${inrFormat(activeColour.sale_price)}</span>
            <span class="pos-sku-qty ${hasStock ? 'ok' : 'none'}" id="pos-sku-qty-${product.product_id}">${hasStock ? 'Qty ' + activeColour.store_qty : 'Not at store'}</span>
          </div>
          <div class="pos-sku-code" id="pos-sku-code-${product.product_id}">${activeColour.sku_code}</div>
          <button class="pos-sku-select-btn${isSelected ? ' selected' : ''}" id="pos-sku-btn-${product.product_id}" type="button"
            data-product-id="${product.product_id}" data-sku-id="${activeColour.sku_id}">
            ${isSelected ? '✓ Selected' : 'Select'}
          </button>
        </div>
      `

      card.addEventListener('click', e => {
        const swatchEl = e.target.closest('.pos-sku-swatch')
        if (swatchEl) {
          e.stopPropagation()
          selectedProductId = [product.product_id, Number(swatchEl.dataset.skuId)]
          renderCatalogueCards(products, query)
          const { colour: c, product: p } = getSelectedSku(products)
          renderSelectionState(c, p)
          return
        }
        selectedProductId = [product.product_id, activeColour.sku_id]
        renderCatalogueCards(products, query)
        renderSelectionState(activeColour, product)
      })

      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          selectedProductId = [product.product_id, activeColour.sku_id]
          renderCatalogueCards(products, query)
          renderSelectionState(activeColour, product)
        }
      })

      catalogueResults.appendChild(card)
    })
  }

  function renderCatalogueMeta(products, query) {
    const scopeLabel = activeCatalogueScope === 'store' ? 'Store catalogue' : 'Global catalogue'
    const totalVariants = products.reduce((acc, p) => acc + p.colours.length, 0)
    const hasQuery = Boolean(normalizeText(query))
    if (!hasQuery) {
      catalogueMeta.textContent = scopeLabel + ': ' + products.length + ' models · ' + totalVariants + ' variants'
      return
    }
    catalogueMeta.textContent = scopeLabel + ': ' + products.length + ' results for "' + query.trim() + '"'
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
    const url = '/api/pos/catalogue?scope=' + activeCatalogueScope + (q ? '&q=' + encodeURIComponent(q) : '')

    try {
      const products = await apiGet(url, session && session.token)
      lastLoadedProducts = products
      renderCatalogueMeta(products, query)
      renderCatalogueCards(products, query)
      const { colour, product } = getSelectedSku(products)
      if (!colour) selectedProductId = null
      renderSelectionState(colour, product)
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
    renderSelectionState(null, null)
    triggerCatalogueSearch()
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

    btnNextOrder.addEventListener('click', () => {
      if (!selectedProductId) { cosmosToastWarn('Select a product first.'); return }
      const { colour, product } = getSelectedSku(lastLoadedProducts)
      if (!colour) { cosmosToastWarn('Select a product first.'); return }
      pendingOrderSelection = { colour, product }
      navigate(POS_ROUTES.ORDER)
    })

    if (btnPosCustomer) {
      btnPosCustomer.addEventListener('click', () => navigate(POS_ROUTES.CUSTOMER))
    }
  }

  async function showCatalogueScreen(session) {
    await loadPosBootstrap(session)
    catalogueStaff.textContent = session.name + ' • ' + formatRole(session.role)
    catalogueStore.textContent = session.store_name
    updateScopeButtons()
    renderSelectionState(null, null)
    searchInput.value = ''
    triggerCatalogueSearch()
    showScreen('screen-pos-catalogue')
  }

  function showCustomerScreen(session) {
    const banner = document.getElementById('cust-selected-banner')
    if (banner) {
      banner.textContent = posSelectedCustomerId
        ? ('Selected customer id: ' + posSelectedCustomerId)
        : 'No customer selected — optional for walk-in.'
    }
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
    if (btnBack) btnBack.addEventListener('click', () => navigate(POS_ROUTES.CATALOGUE))
    const btnS = document.getElementById('btn-cust-search')
    if (btnS) btnS.addEventListener('click', () => { void runCustomerSearch() })
    const btnC = document.getElementById('btn-cust-create')
    if (btnC) btnC.addEventListener('click', () => { void handleCustomerCreate() })

    const btnLensBack = document.getElementById('btn-lens-back')
    if (btnLensBack) {
      btnLensBack.addEventListener('click', () => {
        pendingResumeOrder = true
        navigate(POS_ROUTES.ORDER)
      })
    }
    const btnLensPrev = document.getElementById('btn-lens-prev')
    const btnLensNext = document.getElementById('btn-lens-next')
    if (btnLensPrev) btnLensPrev.addEventListener('click', lensWizardPrev)
    if (btnLensNext) btnLensNext.addEventListener('click', lensWizardNext)

    const btnPayBack = document.getElementById('btn-pay-back')
    if (btnPayBack) btnPayBack.addEventListener('click', () => navigate(POS_ROUTES.ORDER))
    const btnPaySubmit = document.getElementById('btn-pay-submit')
    if (btnPaySubmit) btnPaySubmit.addEventListener('click', () => { void submitPayment() })
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

  function renderLensStep() {
    const nextBtn = document.getElementById('btn-lens-next')
    if (nextBtn && lensWizard.step < 2) nextBtn.textContent = 'Next'
    const ind = document.getElementById('lens-step-indicator')
    const body = document.getElementById('lens-step-body')
    if (!body || !lensCatalogData) return
    const cats = lensCatalogData.categories || []
    if (lensWizard.step === 0) {
      if (ind) ind.textContent = 'Step 1 — Category'
      body.innerHTML = '<div class="pos-lens-pick" id="lens-pick-cat"></div>'
      const pick = document.getElementById('lens-pick-cat')
      cats.forEach(function (c) {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'pos-lens-opt' + (lensWizard.category && lensWizard.category.id === c.id ? ' selected' : '')
        b.textContent = c.name
        b.addEventListener('click', function () {
          lensWizard.category = c
          lensWizard.pkg = null
          lensWizard.addonIds = []
          renderLensStep()
        })
        pick.appendChild(b)
      })
      return
    }
    if (lensWizard.step === 1) {
      if (ind) ind.textContent = 'Step 2 — Package'
      const pkgs = (lensWizard.category && lensWizard.category.packages) ? lensWizard.category.packages : []
      body.innerHTML = '<div class="pos-lens-pick" id="lens-pick-pkg"></div>'
      const pick = document.getElementById('lens-pick-pkg')
      pkgs.forEach(function (p) {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'pos-lens-opt' + (lensWizard.pkg && lensWizard.pkg.id === p.id ? ' selected' : '')
        b.textContent = p.name + ' — ' + inrFormat(p.price)
        b.addEventListener('click', function () {
          lensWizard.pkg = p
          lensWizard.addonIds = []
          renderLensStep()
        })
        pick.appendChild(b)
      })
      return
    }
    if (lensWizard.step === 2) {
      if (ind) ind.textContent = 'Step 3 — Add-ons'
      const addons = (lensWizard.pkg && lensWizard.pkg.addons) ? lensWizard.pkg.addons : []
      body.innerHTML = '<div class="pos-lens-pick" id="lens-pick-addon"></div>'
      const pick = document.getElementById('lens-pick-addon')
      addons.forEach(function (a) {
        const b = document.createElement('button')
        b.type = 'button'
        const on = lensWizard.addonIds.indexOf(a.id) >= 0
        b.className = 'pos-lens-opt' + (on ? ' selected' : '')
        b.textContent = a.name + ' +' + inrFormat(a.price)
        b.addEventListener('click', function () {
          const ix = lensWizard.addonIds.indexOf(a.id)
          if (ix >= 0) lensWizard.addonIds.splice(ix, 1)
          else lensWizard.addonIds.push(a.id)
          renderLensStep()
        })
        pick.appendChild(b)
      })
      const next = document.getElementById('btn-lens-next')
      if (next) next.textContent = 'Confirm'
    }
  }

  function confirmLensWizard() {
    const line = obCart[lensWizardLineIdx]
    if (!line || !lensWizard.pkg || !lensWizard.category) return
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
    line.lab_status = 'complete'
    line.fulfillment = 'LAB'
    lensWizardLineIdx = -1
    pendingResumeOrder = true
    navigate(POS_ROUTES.ORDER)
    if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Lenses configured')
  }

  async function showLensWizardScreen(session) {
    await loadPosBootstrap(session)
    const sessionTok = session.token
    if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('lens-step-body', 4)
    try {
      lensCatalogData = await apiGet('/api/pos/lens-catalog', sessionTok)
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
      navigate(POS_ROUTES.ORDER)
      return
    }
    lensWizard = { step: 0, category: null, pkg: null, addonIds: [] }
    const next = document.getElementById('btn-lens-next')
    if (next) next.textContent = 'Next'
    renderLensStep()
    showScreen('screen-pos-lens')
  }

  async function showPaymentScreen(session) {
    const el = document.getElementById('pay-summary')
    showScreen('screen-pos-payment')
    if (!el || !lastCreatedOrder || !session || !session.token) return
    if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('pay-summary', 4)
    paySessionSnapshot = { stage: 'FULL', amount: Number(lastCreatedOrder.total_amount) || 0 }
    try {
      const detail = await apiGet('/api/pos/orders/' + lastCreatedOrder.order_id, session.token)
      const order = detail.order
      const payments = detail.payments || []
      const total = Number(order.total_amount)
      const pct = Number(order.lab_advance_pct_snapshot) || 40
      const advanceTarget = Math.round(total * (pct / 100) * 100) / 100
      let advPaid = 0
      for (let i = 0; i < payments.length; i++) {
        if (payments[i].stage === 'ADVANCE') advPaid += Number(payments[i].amount) || 0
      }
      advPaid = Math.round(advPaid * 100) / 100
      const labLike = order.order_kind === 'LAB' || order.order_kind === 'MIXED'
      const advanceRemaining = Math.max(0, Math.round((advanceTarget - advPaid) * 100) / 100)
      const balanceRemaining = Math.max(0, Math.round((total - advPaid) * 100) / 100)
      if (labLike && advanceRemaining > 0.009) {
        paySessionSnapshot = { stage: 'ADVANCE', amount: advanceRemaining }
      } else {
        paySessionSnapshot = { stage: 'FULL', amount: balanceRemaining }
      }
      let subHint = ''
      const subs = detail.sub_orders || []
      for (let j = 0; j < subs.length; j++) {
        if (subs[j].fulfillment === 'LAB') {
          subHint += '<div>Lab sub-order #' + subs[j].sub_order_id + ' — ' + (subs[j].lab_workflow_status || '') + '</div>'
        }
      }
      el.innerHTML =
        '<div>Order <strong>' + order.order_no + '</strong> · ' + order.order_kind + '</div>' +
        '<div>Order total (incl. GST): <strong>' + formatRupees(total) + '</strong></div>' +
        (labLike
          ? '<div>Lab advance (' + pct + '%): target ' + formatRupees(advanceTarget) + ', paid ' + formatRupees(advPaid) + '</div>'
          : '') +
        '<div style="margin-top:10px">Collecting: <strong>' + paySessionSnapshot.stage + '</strong> — <strong>' + formatRupees(paySessionSnapshot.amount) + '</strong></div>' +
        subHint
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
      el.innerHTML =
        '<div>Order <strong>' + lastCreatedOrder.order_no + '</strong></div>' +
        '<div>Total: <strong>' + formatRupees(lastCreatedOrder.total_amount) + '</strong></div>' +
        '<div>Could not load order detail — using totals from checkout.</div>'
      paySessionSnapshot = { stage: 'FULL', amount: Number(lastCreatedOrder.total_amount) || 0 }
    }
  }

  async function submitPayment() {
    const session = getPosSession()
    if (!session || !session.token || !lastCreatedOrder) return
    const methodEl = document.getElementById('pay-method')
    const tenderEl = document.getElementById('pay-tendered')
    const method = methodEl ? methodEl.value : 'CASH'
    const tendered = tenderEl && tenderEl.value ? Number(tenderEl.value) : null
    const btn = document.getElementById('btn-pay-submit')
    const amt = Math.max(0, Number(paySessionSnapshot.amount) || 0)
    if (amt <= 0) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Nothing to collect — return to catalogue or refresh payment.')
      return
    }
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn)
    try {
      await apiPost('/api/pos/payment', {
        order_id: lastCreatedOrder.order_id,
        stage: paySessionSnapshot.stage,
        method: method,
        amount: amt,
        tendered: method === 'CASH' ? tendered : null
      }, session.token)
      if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn)
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Payment recorded')
      if (paySessionSnapshot.stage === 'ADVANCE') {
        if (typeof cosmosToastInfo === 'function') {
          cosmosToastInfo('Advance saved. Collect balance when the order is ready.')
        }
        void showPaymentScreen(session)
        return
      }
      lastCreatedOrder = null
      paySessionSnapshot = { stage: 'FULL', amount: 0 }
      navigate(POS_ROUTES.CATALOGUE)
    } catch (err) {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn)
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
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
    const gst = Math.round(subtotal * gstRate * 100) / 100
    const total = Math.round((subtotal + gst) * 100) / 100
    obSubtotal.textContent = formatRupees(subtotal)
    obGst.textContent = formatRupees(gst)
    obTotal.textContent = formatRupees(total)
    btnObProceed.disabled = obCart.length === 0
  }

  function obRenderCart() {
    obCart_el.innerHTML = ''
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
    obCart.forEach(function (line, idx) {
      const rule = getTypeRule(line.product_type)
      const isDual = rule && rule.fulfillment_mode === 'DUAL'
      const lineEl = document.createElement('div')
      lineEl.className = 'pos-ob-cart-line'
      let fulfillHtml = ''
      if (isDual) {
        fulfillHtml =
          '<div class="pos-ob-line-fulfill">' +
          '<button type="button" class="pos-ob-mini-btn' + (line.fulfillment === 'INSTANT' ? ' active' : '') + '" data-action="set-instant" data-idx="' + idx + '">Frame only</button>' +
          '<button type="button" class="pos-ob-mini-btn' + (line.fulfillment === 'LAB' ? ' active' : '') + '" data-action="set-lab" data-idx="' + idx + '">With lenses</button>' +
          '</div>'
      }
      let labBadge = ''
      if (line.fulfillment === 'LAB') {
        labBadge = line.lab_status === 'complete'
          ? '<div class="pos-ob-lab-badge">Lenses configured</div>'
          : '<div class="pos-ob-lab-badge">Configure lenses</div>'
      }
      const du = computeLineDisplayUnit(line)
      lineEl.innerHTML = `
        <div class="pos-ob-cart-line-info">
          <div class="pos-ob-cart-code">${line.sku_code}</div>
          <div class="pos-ob-cart-name">${line.product_name}</div>
          <div class="pos-ob-cart-sub">${line.brand_name} • ${line.colour_name}</div>
          ${fulfillHtml}
          ${labBadge}
          ${line.fulfillment === 'LAB' && line.lab_status !== 'complete'
            ? '<button type="button" class="pos-ob-mini-btn" data-action="configure-lens" data-idx="' + idx + '">Open lens wizard</button>'
            : ''}
        </div>
        <div class="pos-ob-cart-line-right">
          <div class="pos-ob-cart-price">${formatRupees(du * line.qty)}</div>
          <div class="pos-ob-qty-ctrl" aria-label="Quantity for ${line.product_name}">
            <button class="pos-ob-qty-btn" data-action="dec" data-idx="${idx}" aria-label="Decrease quantity" tabindex="0" ${line.qty <= 1 ? 'disabled' : ''}>−</button>
            <span class="pos-ob-qty-val">${line.qty}</span>
            <button class="pos-ob-qty-btn" data-action="inc" data-idx="${idx}" aria-label="Increase quantity" tabindex="0">+</button>
          </div>
          <button class="pos-ob-remove-btn" data-action="remove" data-idx="${idx}" aria-label="Remove ${line.product_name}" tabindex="0">Remove</button>
        </div>
      `
      obCart_el.appendChild(lineEl)
    })
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
      obCart[idx].fulfillment = 'LAB'
      obCart[idx].lab_status = 'incomplete'
      obCart[idx].lens_bundle = null
      lensWizardLineIdx = idx
      pendingResumeOrder = true
      navigate(POS_ROUTES.LENS)
      return
    } else if (action === 'configure-lens') {
      lensWizardLineIdx = idx
      pendingResumeOrder = true
      navigate(POS_ROUTES.LENS)
      return
    }
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
  }

  function showOrderBuilderScreen(session, selection) {
    obStaffEl.textContent = session.name + ' • ' + formatRole(session.role)
    obStoreEl.textContent = session.store_name
    obCart = []
    if (selection) addToCart(selection)
    updateKindChip()
    syncRxSectionVisibility()
    obRenderCart()
    showScreen('screen-pos-order-builder')
  }

  function showOrderBuilderScreenResume(session) {
    obStaffEl.textContent = session.name + ' • ' + formatRole(session.role)
    obStoreEl.textContent = session.store_name
    updateKindChip()
    syncRxSectionVisibility()
    obRenderCart()
    showScreen('screen-pos-order-builder')
  }

  function bindOrderBuilderEvents() {
    btnObBack.addEventListener('click', () => navigate(POS_ROUTES.CATALOGUE))
    btnObAddMore.addEventListener('click', () => navigate(POS_ROUTES.CATALOGUE))

    obCart_el.addEventListener('click', obHandleCartClick)

    btnObProceed.addEventListener('click', () => { void handleProceedToPayment() })
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
    const needRx = obCart.some(function (l) { return l.fulfillment === 'LAB' && l.rx_required })
    if (needRx && !rxMeetsRequirement()) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Enter prescription or mark Plano for required eyes.')
      return
    }
    const session = getPosSession()
    if (!session || !session.token) return
    await loadPosBootstrap(session)
    const lines = obCart.map(function (line) {
      const b = line.lens_bundle
      return {
        sku_id: line.sku_id,
        qty: line.qty,
        unit_price: line.frame_unit_price,
        product_type: line.product_type,
        fulfillment: line.fulfillment,
        line_key: cartLineKey(line),
        lens_bundle: line.fulfillment === 'LAB' ? b : null
      }
    })
    const rxSnap = needRx ? collectRxSnapshot() : null
    if (btnObProceed && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btnObProceed)
    try {
      const res = await apiPost('/api/pos/orders', {
        customer_id: posSelectedCustomerId,
        order_source: 'POS',
        rx_snapshot: rxSnap,
        lines: lines
      }, session.token)
      lastCreatedOrder = res.data
      if (btnObProceed && typeof cosmosBtnDone === 'function') cosmosBtnDone(btnObProceed)
      navigate(POS_ROUTES.PAYMENT)
    } catch (err) {
      if (btnObProceed && typeof cosmosBtnDone === 'function') cosmosBtnDone(btnObProceed)
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message)
    }
  }

  // ── Boot ─────────────────────────────────────────────────────────────────
  ;(function boot() {
    bindRxPlanoHandlers()
    bindCatalogueEvents()
    bindCustomerLensPayEvents()
    bindOrderBuilderEvents()
    resolve()
  })()
  })
})()
