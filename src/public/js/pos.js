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
    SESSION:   '/pos/session',
    CATALOGUE: '/pos/catalogue',
    ORDER:     '/pos/order'
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

    if (path === POS_ROUTES.CATALOGUE) {
      if (!valid) { navigate(POS_ROUTES.LOGIN); return }
      showCatalogueScreen(session)
      return
    }

    if (path === POS_ROUTES.ORDER) {
      if (!valid) { navigate(POS_ROUTES.LOGIN); return }
      if (!pendingOrderSelection) { navigate(POS_ROUTES.CATALOGUE); return }
      showOrderBuilderScreen(session, pendingOrderSelection)
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

  // ── Order Builder state ──────────────────────────────────────────────────
  const GST_RATE = 0.05
  let obOrderType = 'INSTANT'
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

  // ── Order Builder DOM refs ───────────────────────────────────────────────
  const btnObBack         = document.getElementById('btn-ob-back')
  const btnObAddMore      = document.getElementById('btn-ob-add-more')
  const btnTypeInstant    = document.getElementById('btn-type-instant')
  const btnTypeLab        = document.getElementById('btn-type-lab')
  const obCart_el         = document.getElementById('pos-ob-cart')
  const obRxSection       = document.getElementById('pos-ob-rx-section')
  const obSubtotal        = document.getElementById('pos-ob-subtotal')
  const obGst             = document.getElementById('pos-ob-gst')
  const obTotal           = document.getElementById('pos-ob-total')
  const btnObProceed      = document.getElementById('btn-ob-proceed')
  const obStaffEl         = document.getElementById('pos-ob-staff')
  const obStoreEl         = document.getElementById('pos-ob-store')

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
  }

  function showCatalogueScreen(session) {
    catalogueStaff.textContent = session.name + ' • ' + formatRole(session.role)
    catalogueStore.textContent = session.store_name
    updateScopeButtons()
    renderSelectionState(null, null)
    searchInput.value = ''
    triggerCatalogueSearch()
    showScreen('screen-pos-catalogue')
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ORDER BUILDER
  // ═══════════════════════════════════════════════════════════════════════

  function formatRupees(amount) {
    return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  function obRecalcTotals() {
    const subtotal = obCart.reduce((sum, line) => sum + line.unit_price * line.qty, 0)
    const gst = Math.round(subtotal * GST_RATE)
    const total = subtotal + gst
    obSubtotal.textContent = formatRupees(subtotal)
    obGst.textContent = formatRupees(gst)
    obTotal.textContent = formatRupees(total)
    btnObProceed.disabled = obCart.length === 0
  }

  function obRenderCart() {
    obCart_el.innerHTML = ''
    if (obCart.length === 0) {
      obCart_el.innerHTML = `
        <div class="pos-empty">
          <div class="pos-empty-title">Cart is empty</div>
          <div class="pos-empty-sub">Add a product from the catalogue to get started.</div>
        </div>
      `
      obRecalcTotals()
      return
    }
    obCart.forEach((line, idx) => {
      const lineEl = document.createElement('div')
      lineEl.className = 'pos-ob-cart-line'
      lineEl.innerHTML = `
        <div class="pos-ob-cart-line-info">
          <div class="pos-ob-cart-code">${line.sku_code}</div>
          <div class="pos-ob-cart-name">${line.product_name}</div>
          <div class="pos-ob-cart-sub">${line.brand_name} • ${line.colour_name}</div>
        </div>
        <div class="pos-ob-cart-line-right">
          <div class="pos-ob-cart-price">${formatRupees(line.unit_price * line.qty)}</div>
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
  }

  function obHandleCartClick(e) {
    const btn = e.target.closest('[data-action]')
    if (!btn) return
    const action = btn.dataset.action
    const idx = Number(btn.dataset.idx)
    if (action === 'inc') {
      obCart[idx].qty += 1
    } else if (action === 'dec') {
      if (obCart[idx].qty > 1) obCart[idx].qty -= 1
    } else if (action === 'remove') {
      obCart.splice(idx, 1)
    }
    obRenderCart()
  }

  function obUpdateOrderType(type) {
    obOrderType = type
    const isInstant = type === 'INSTANT'
    btnTypeInstant.classList.toggle('active', isInstant)
    btnTypeInstant.setAttribute('aria-pressed', isInstant ? 'true' : 'false')
    btnTypeLab.classList.toggle('active', !isInstant)
    btnTypeLab.setAttribute('aria-pressed', isInstant ? 'false' : 'true')
    obRxSection.setAttribute('aria-hidden', isInstant ? 'true' : 'false')
  }

  function addToCart(selection) {
    const { colour, product } = selection || {}
    if (!colour || !product) return
    const existing = obCart.find(line => line.sku_id === colour.sku_id)
    if (existing) {
      existing.qty += 1
    } else {
      obCart.push({
        product_id:   product.product_id,
        sku_id:       colour.sku_id,
        sku_code:     colour.sku_code,
        product_name: product.product_name,
        brand_name:   product.brand_name,
        colour_name:  colour.colour_name,
        unit_price:   colour.sale_price || 0,
        qty:          1
      })
    }
  }

  function showOrderBuilderScreen(session, selection) {
    obStaffEl.textContent = session.name + ' • ' + formatRole(session.role)
    obStoreEl.textContent = session.store_name
    obCart = []
    if (selection) addToCart(selection)
    obUpdateOrderType('INSTANT')
    obRenderCart()
    showScreen('screen-pos-order-builder')
  }

  function bindOrderBuilderEvents() {
    btnObBack.addEventListener('click', () => navigate(POS_ROUTES.CATALOGUE))
    btnObAddMore.addEventListener('click', () => navigate(POS_ROUTES.CATALOGUE))

    btnTypeInstant.addEventListener('click', () => obUpdateOrderType('INSTANT'))
    btnTypeLab.addEventListener('click', () => obUpdateOrderType('LAB'))

    obCart_el.addEventListener('click', obHandleCartClick)

    btnObProceed.addEventListener('click', () => {
      if (obCart.length === 0) {
        cosmosToastWarn('Your cart is empty.')
        return
      }
      const subtotal = obCart.reduce((sum, line) => sum + line.unit_price * line.qty, 0)
      cosmosToastInfo('Next step: payment screen — ' + obOrderType + ' order, total ' + formatRupees(subtotal + Math.round(subtotal * GST_RATE)))
    })
  }

  // ── Boot ─────────────────────────────────────────────────────────────────
  ;(function boot() {
    bindCatalogueEvents()
    bindOrderBuilderEvents()
    resolve()
  })()
  })
})()
