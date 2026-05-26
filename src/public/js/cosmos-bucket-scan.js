/**
 * Cosmos Bucket Scan — TRANSFER (Foundry dispatch) + RECEIVE (StorePilot incoming verify).
 * Popup modal, unit-barcode only, BarcodeDetector / jsQR camera.
 */
(function () {
  'use strict';

  const DEBOUNCE_MS = 2000;
  const TAP_DEBOUNCE_MS = 400;
  const SCAN_TICK_MS = 100;
  const TAP_ROI_SIZE = 0.52;
  const TAP_ROI_SIZE_MACRO = 0.68;
  const JSQR_MAX_WIDTH = 640;
  const JSQR_MAX_WIDTH_CAP = 960;
  const MACRO_ZOOM_RATIO_TAP = 0.35;
  const MACRO_ZOOM_RATIO_FALLBACK = 0.2;
  const FOCUS_REAPPLY_MS = 350;
  const TAP_ZOOM_SETTLE_MS = 500;
  const STREAM_WARMUP_MS = 600;
  const ANDROID_WEAK_AF_SETTLE_BUMP_MS = 200;
  const MOBILE_SETTLE_FACTOR = 1.25;
  const MODAL_ID = 'modal-bucket-scan';

  const _bucket = {
    mode: null,
    sessionId: null,
    label: '',
    expected: [],
    scanned: [],
    verifiedSlots: {},
    status: 'IDLE',
    onSubmit: null,
    _lastScanKey: '',
    _lastScanTs: 0
  };

  const _scanCooldown = {};
  let _bucketActiveSuccessToast = null;
  let _camStream = null;
  let _camDetector = null;
  let _camDecodeMode = null;
  let _camCanvas = null;
  let _camCtx = null;
  let _camRoi = null;
  let _camViewportBound = false;
  let _lastTapAttemptTs = 0;
  let _tapScanBusy = false;
  let _highlightTimer = null;
  let _camFocusProfile = null;
  let _camMacroZoomActive = false;
  let _camLastFocusAppliedTs = 0;
  let _camStartPromise = null;
  let _camResumeTimer = null;
  let _camIgnoreTrackEnd = false;
  let _camDeviceProfile = null;
  let _camTorchOn = false;

  function bucketEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function bucketNormUnitBarcode(bc) {
    const s = String(bc || '').trim();
    if (/^\d+$/.test(s)) return s.padStart(7, '0');
    return s;
  }

  function bucketCooldownKey(raw) {
    return bucketNormUnitBarcode(window.bucketNormalizeScan(raw));
  }

  function bucketInCooldown(key) {
    if (!key) return false;
    const ts = _scanCooldown[key];
    return ts != null && Date.now() - ts < DEBOUNCE_MS;
  }

  function bucketRecordCooldown(key) {
    if (key) _scanCooldown[key] = Date.now();
  }

  window.bucketNormalizeScan = function bucketNormalizeScan(raw) {
    let s = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) {
      try {
        const u = new URL(s);
        const q = u.searchParams.get('sku') || u.searchParams.get('code') || u.searchParams.get('unit');
        if (q) return String(q).trim();
        const parts = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
        if (parts.length) return decodeURIComponent(parts[parts.length - 1]);
      } catch (_) { /* ignore */ }
    }
    if (s.startsWith('{') && s.endsWith('}')) {
      try {
        const p = JSON.parse(s);
        const unitBc = p.unit_barcode || p.unit || p.barcode;
        if (unitBc) return String(unitBc).trim();
        return String(p.sku_code || p.sku || p.code || '').trim() || s;
      } catch (_) { /* ignore */ }
    }
    if (window.transferNormalizeScanPayload) return window.transferNormalizeScanPayload(s) || s;
    if (/^\d{1,7}$/.test(s)) return s.padStart(7, '0');
    return s;
  };

  function bucketIsSecureOrigin() {
    const h = window.location.hostname;
    return window.location.protocol === 'https:' || h === 'localhost' || h === '127.0.0.1';
  }

  function bucketCameraBlockedReason() {
    if (!bucketIsSecureOrigin()) {
      return 'Camera requires HTTPS or localhost. Use a secure URL or type unit codes with a wedge scanner.';
    }
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      return 'Camera is not available in this browser.';
    }
    return '';
  }

  function bucketLoadJsQr() {
    if (window.jsQR) return Promise.resolve();
    if (window.__bucketJsQrLoading) return window.__bucketJsQrLoading;
    window.__bucketJsQrLoading = new Promise(function (resolve, reject) {
      const existing = document.querySelector('script[data-cosmos-jsqr="1"]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(); }, { once: true });
        existing.addEventListener('error', function () { reject(new Error('Failed to load QR decoder')); }, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = '/js/jsQR.min.js';
      script.setAttribute('data-cosmos-jsqr', '1');
      script.async = true;
      script.onload = function () { resolve(); };
      script.onerror = function () {
        script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
        script.onload = function () { resolve(); };
        script.onerror = function () { reject(new Error('Failed to load QR decoder')); };
      };
      document.head.appendChild(script);
    }).finally(function () {
      window.__bucketJsQrLoading = null;
    });
    return window.__bucketJsQrLoading;
  }

  function bucketModalOpen() {
    const el = document.getElementById(MODAL_ID);
    if (!el) return;
    if (el.parentNode !== document.body || document.body.lastElementChild !== el) {
      document.body.appendChild(el);
    }
    document.body.classList.add('cosmos-bucket-open');
    if (typeof window.openM === 'function') window.openM(MODAL_ID);
    else el.classList.add('open');
    if (window.cosmosUpdateToastTopOffset) {
      window.cosmosUpdateToastTopOffset();
      setTimeout(window.cosmosUpdateToastTopOffset, 80);
    }
  }

  function bucketModalClose() {
    bucketStopCamera();
    const el = document.getElementById(MODAL_ID);
    if (!el) return;
    if (typeof window.closeM === 'function') window.closeM(MODAL_ID);
    else el.classList.remove('open');
    document.body.classList.remove('cosmos-bucket-open');
    if (window.cosmosUpdateToastTopOffset) window.cosmosUpdateToastTopOffset();
  }

  function bucketShowScreen(name) {
    ['idle', 'scan', 'review'].forEach(function (n) {
      const el = document.getElementById('bucket-screen-' + n);
      if (el) el.style.display = n === name ? '' : 'none';
    });
    const foot = document.getElementById('bucket-modal-foot');
    const footScan = document.getElementById('bucket-foot-scan');
    const footReview = document.getElementById('bucket-foot-review');
    if (foot) foot.classList.toggle('is-visible', name === 'scan' || name === 'review');
    if (footScan) footScan.style.display = name === 'scan' ? '' : 'none';
    if (footReview) footReview.style.display = name === 'review' ? '' : 'none';
    _bucket.status = name === 'idle' ? 'IDLE' : name === 'scan' ? 'SCANNING' : 'REVIEW';
    if (window.cosmosUpdateToastTopOffset) {
      window.cosmosUpdateToastTopOffset();
      setTimeout(window.cosmosUpdateToastTopOffset, 60);
    }
  }

  function bucketSetScanStatus(message, kind) {
    const el = document.getElementById('bucket-scan-status');
    if (!el) return;
    const text = message == null ? '' : String(message);
    if (!text) {
      el.textContent = '';
      el.className = 'bucket-scan-status';
      return;
    }
    const k = kind === 'warn' || kind === 'err' || kind === 'ok' ? kind : 'warn';
    el.className = 'bucket-scan-status bucket-scan-status--' + k;
    el.textContent = text;
  }

  function bucketClearScanStatus() {
    bucketSetScanStatus('', '');
  }

  function bucketIsListOpen() {
    const wrap = document.getElementById('bucket-scanned-list-wrap');
    return wrap && !wrap.classList.contains('is-collapsed') && !wrap.hidden;
  }

  function bucketSetListOpen(open) {
    const wrap = document.getElementById('bucket-scanned-list-wrap');
    const btn = document.getElementById('bucket-show-qr-btn');
    if (wrap) {
      wrap.classList.toggle('is-collapsed', !open);
      wrap.hidden = !open;
    }
    if (btn) {
      const n = _bucket.scanned.length;
      btn.textContent = open ? 'Hide QR' : (n ? 'Show QR (' + n + ')' : 'Show QR');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  }

  function bucketUpdateShowQrBtn() {
    const btn = document.getElementById('bucket-show-qr-btn');
    if (!btn) return;
    const open = bucketIsListOpen();
    const n = _bucket.scanned.length;
    btn.textContent = open ? 'Hide QR' : (n ? 'Show QR (' + n + ')' : 'Show QR');
  }

  window.bucketToggleScannedList = function bucketToggleScannedList() {
    bucketSetListOpen(!bucketIsListOpen());
    if (bucketIsListOpen()) bucketRenderScannedList();
  };

  function bucketFlash(kind) {
    const el = document.getElementById('bucket-scan-flash');
    if (!el) return;
    el.className = 'bucket-scan-flash bucket-scan-flash--' + (kind === 'ok' ? 'ok' : kind === 'warn' ? 'warn' : 'err');
    el.style.opacity = '1';
    setTimeout(function () { el.style.opacity = '0'; }, 220);
  }

  function bucketToastSuccessOnce(msg) {
    if (_bucketActiveSuccessToast && typeof window.cosmosToastDismiss === 'function') {
      window.cosmosToastDismiss(_bucketActiveSuccessToast);
    }
    _bucketActiveSuccessToast = null;
    if (typeof window.cosmosToastSuccess === 'function') {
      _bucketActiveSuccessToast = window.cosmosToastSuccess(msg);
    }
  }

  function bucketHighlightScannedRow(unitBarcode) {
    if (!bucketIsListOpen()) return;
    const norm = bucketNormUnitBarcode(unitBarcode);
    const listEl = document.getElementById('bucket-scanned-list');
    if (!listEl) return;
    const row = listEl.querySelector('[data-unit="' + norm + '"]');
    if (!row) return;
    row.classList.add('bucket-scanned-row--pulse');
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (_highlightTimer) clearTimeout(_highlightTimer);
    _highlightTimer = setTimeout(function () {
      row.classList.remove('bucket-scanned-row--pulse');
      _highlightTimer = null;
    }, 1400);
  }

  function bucketDuplicateFeedback(unitBarcode, message) {
    bucketFlash('warn');
    bucketSetScanStatus(message, 'warn');
    bucketHighlightScannedRow(unitBarcode);
  }

  function bucketFindExpectedMatch(scannedNorm, scannedRaw) {
    for (let i = 0; i < _bucket.expected.length; i++) {
      const e = _bucket.expected[i];
      const bc = bucketNormUnitBarcode(e.unit_barcode);
      if (bc && bc === scannedNorm) return { index: i, expected: e };
      if (e.unit_id != null && String(e.unit_id) === String(scannedRaw)) return { index: i, expected: e };
    }
    return null;
  }

  function bucketScore() {
    if (_bucket.mode === 'TRANSFER') {
      const units = _bucket.scanned.length;
      const skus = new Set(_bucket.scanned.map(function (s) { return s.sku_code; })).size;
      return { mode: 'TRANSFER', verified: units, total: units, uniqueSkus: skus, missing: [] };
    }
    const total = _bucket.expected.length;
    let verified = 0;
    const missing = [];
    _bucket.expected.forEach(function (e, i) {
      if (_bucket.verifiedSlots[i]) verified++;
      else missing.push(e);
    });
    return { mode: 'RECEIVE', verified: verified, total: total, missing: missing, uniqueSkus: 0 };
  }

  function bucketScoreLabel() {
    const sc = bucketScore();
    if (sc.mode === 'TRANSFER') {
      return sc.verified + ' unit' + (sc.verified !== 1 ? 's' : '') + ' · ' + sc.uniqueSkus + ' SKU' + (sc.uniqueSkus !== 1 ? 's' : '');
    }
    return sc.verified + ' / ' + sc.total + ' units verified';
  }

  function bucketCanSubmit() {
    const sc = bucketScore();
    if (_bucket.mode === 'TRANSFER') return _bucket.scanned.length >= 1;
    return sc.total > 0 && sc.verified === sc.total;
  }

  function bucketRenderScore() {
    const sc = bucketScore();
    const labelEl = document.getElementById('bucket-score-label');
    const barEl = document.getElementById('bucket-score-bar-fill');
    if (labelEl) labelEl.textContent = bucketScoreLabel();
    if (barEl) {
      if (_bucket.mode === 'TRANSFER') {
        barEl.style.width = _bucket.scanned.length ? '100%' : '0%';
      } else {
        const pct = sc.total ? Math.round((sc.verified / sc.total) * 100) : 0;
        barEl.style.width = pct + '%';
      }
    }
    const submitBtn = document.getElementById('bucket-review-submit-btn');
    if (submitBtn) submitBtn.disabled = !bucketCanSubmit();
    bucketUpdateShowQrBtn();
  }

  function bucketRenderScannedList() {
    const listEl = document.getElementById('bucket-scanned-list');
    if (!listEl) return;
    if (!_bucket.scanned.length) {
      listEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0">No units scanned yet</div>';
      return;
    }
    listEl.innerHTML = _bucket.scanned.map(function (s) {
      const bc = bucketNormUnitBarcode(s.unit_barcode);
      return '<div class="bucket-scanned-row" data-unit="' + bucketEsc(bc) + '">' +
        '<span class="mono" style="font-weight:600;color:var(--acc2)">' + bucketEsc(bc) + '</span>' +
        '<span style="font-size:12px;color:var(--text2)">' + bucketEsc(s.sku_code) + '</span>' +
        '</div>';
    }).join('');
  }

  function bucketRenderReview() {
    const sc = bucketScore();
    const verifiedEl = document.getElementById('bucket-review-verified');
    const missingEl = document.getElementById('bucket-review-missing');
    const titleEl = document.getElementById('bucket-review-title');
    if (titleEl) titleEl.textContent = _bucket.label || 'Scan bucket';
    const reviewScoreEl = document.getElementById('bucket-review-score-text');
    if (reviewScoreEl) reviewScoreEl.textContent = bucketScoreLabel();
    if (verifiedEl) {
      verifiedEl.innerHTML = _bucket.scanned.map(function (s) {
        return '<div class="bucket-scanned-row"><span class="mono">' + bucketEsc(s.unit_barcode) + '</span>' +
          '<span style="font-size:12px">' + bucketEsc(s.sku_code) + '</span></div>';
      }).join('') || '<div style="color:var(--text3);font-size:12px">None</div>';
    }
    if (missingEl) {
      if (_bucket.mode === 'RECEIVE' && sc.missing.length) {
        missingEl.innerHTML = sc.missing.map(function (e) {
          return '<div class="bucket-scanned-row"><span class="mono" style="color:var(--gold)">' +
            bucketEsc(e.unit_barcode) + '</span><span style="font-size:12px">' + bucketEsc(e.sku_code || '') + '</span></div>';
        }).join('');
        const missWrap = document.getElementById('bucket-review-missing-wrap');
        if (missWrap) missWrap.style.display = '';
      } else {
        missingEl.innerHTML = '';
        const missWrap = document.getElementById('bucket-review-missing-wrap');
        if (missWrap) missWrap.style.display = 'none';
      }
    }
    bucketRenderScore();
  }

  async function bucketTransferLookup(code) {
    if (typeof window.transferLookupSku === 'function') {
      return window.transferLookupSku(code);
    }
    throw new Error('Transfer lookup is not available on this screen.');
  }

  function bucketAlreadyScanned(unitBarcode, unitId) {
    const norm = bucketNormUnitBarcode(unitBarcode);
    return _bucket.scanned.some(function (s) {
      if (norm && bucketNormUnitBarcode(s.unit_barcode) === norm) return true;
      if (unitId != null && Number(s.unit_id) === Number(unitId)) return true;
      return false;
    });
  }

  async function bucketHandleScan(rawValue) {
    const norm = window.bucketNormalizeScan(rawValue);
    if (!norm) return;

    const cdKey = bucketCooldownKey(rawValue);
    if (bucketInCooldown(cdKey)) return;

    const now = Date.now();

    if (_bucket.mode === 'RECEIVE') {
      const match = bucketFindExpectedMatch(bucketNormUnitBarcode(norm), norm);
      if (!match) {
        bucketRecordCooldown(cdKey);
        bucketFlash('err');
        bucketSetScanStatus('Not on this transfer document', 'err');
        return;
      }
      const unitBc = bucketNormUnitBarcode(match.expected.unit_barcode);
      if (_bucket.verifiedSlots[match.index]) {
        bucketRecordCooldown(cdKey);
        bucketDuplicateFeedback(unitBc, unitBc + ' already verified');
        return;
      }
      _bucket.verifiedSlots[match.index] = true;
      const e = match.expected;
      if (!bucketAlreadyScanned(e.unit_barcode, e.unit_id)) {
        _bucket.scanned.push({
          unit_barcode: unitBc,
          unit_id: e.unit_id,
          sku_code: e.sku_code || '',
          sku_id: e.sku_id,
          line_id: e.line_id
        });
      }
      _bucket._lastScanKey = norm;
      _bucket._lastScanTs = now;
      bucketRecordCooldown(cdKey);
      bucketFlash('ok');
      bucketClearScanStatus();
      bucketRenderScannedList();
      bucketRenderScore();
      const sc = bucketScore();
      if (sc.verified === sc.total) bucketToastSuccessOnce('All units verified');
      return;
    }

    if (_bucket.mode === 'TRANSFER') {
      let sku;
      try {
        sku = await bucketTransferLookup(rawValue);
      } catch (err) {
        bucketRecordCooldown(cdKey);
        bucketFlash('err');
        bucketSetScanStatus(err.message || 'Lookup failed', 'err');
        return;
      }
      if (!sku || sku.unit_id == null) {
        bucketRecordCooldown(cdKey);
        bucketFlash('err');
        bucketSetScanStatus('Scan the 7-digit unit barcode on each piece', 'err');
        return;
      }
      const unitBc = bucketNormUnitBarcode(sku.unit_barcode || norm);
      if (bucketAlreadyScanned(unitBc, sku.unit_id)) {
        bucketRecordCooldown(cdKey);
        bucketDuplicateFeedback(unitBc, unitBc + ' already in bucket');
        return;
      }
      _bucket.scanned.push({
        unit_barcode: unitBc,
        unit_id: Number(sku.unit_id),
        sku_code: sku.sku_code || '',
        sku_id: sku.sku_id,
        product_name: sku.product_name || '',
        brand_name: sku.brand_name || '',
        colour_name: sku.colour_name || '',
        warehouse_qty: sku.warehouse_qty
      });
      _bucket._lastScanKey = unitBc;
      _bucket._lastScanTs = now;
      bucketRecordCooldown(cdKey);
      bucketFlash('ok');
      bucketClearScanStatus();
      bucketRenderScannedList();
      bucketRenderScore();
      bucketToastSuccessOnce('Added ' + unitBc + ' · ' + (sku.sku_code || ''));
    }
  }

  function bucketGetVideoCaps(track) {
    if (!track || typeof track.getCapabilities !== 'function') {
      return { focusMode: [], zoom: null };
    }
    try {
      return track.getCapabilities() || { focusMode: [], zoom: null };
    } catch (_) {
      return { focusMode: [], zoom: null };
    }
  }

  function bucketPickFocusMode(caps, phase) {
    const modes = caps.focusMode || [];
    if (phase === 'start') {
      if (modes.indexOf('continuous') >= 0) return 'continuous';
      if (modes.indexOf('auto') >= 0) return 'auto';
      return modes.length ? modes[0] : null;
    }
    if (modes.indexOf('single-shot') >= 0) return 'single-shot';
    if (modes.indexOf('continuous') >= 0) return 'continuous';
    if (modes.indexOf('auto') >= 0) return 'auto';
    return null;
  }

  function bucketIsMobileDevice() {
    if (bucketIsAndroidChrome()) return true;
    if (/iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')) return true;
    return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches;
  }

  function bucketFocusProfile(caps) {
    const modes = caps.focusMode || [];
    let profile;
    if (modes.indexOf('single-shot') >= 0) {
      profile = { settleMs: 1200, scanLoopMs: 3600, tier: 'single-shot' };
    } else if (modes.indexOf('continuous') >= 0 || modes.indexOf('auto') >= 0 || modes.length > 0) {
      profile = { settleMs: 1600, scanLoopMs: 4500, tier: 'continuous' };
    } else {
      profile = { settleMs: 1800, scanLoopMs: 5000, tier: 'none' };
    }
    if (bucketIsMobileDevice()) {
      profile.settleMs = Math.round(profile.settleMs * MOBILE_SETTLE_FACTOR);
      profile.scanLoopMs = Math.round(profile.scanLoopMs * 1.1);
    }
    return profile;
  }

  function bucketProbeDeviceCamera(track) {
    const caps = bucketGetVideoCaps(track);
    const focusProfile = bucketFocusProfile(caps);
    const mobile = bucketIsMobileDevice();
    let idealW = mobile ? 1920 : 1920;
    let idealH = mobile ? 1080 : 1080;
    let maxW = mobile ? 1920 : 3840;
    let maxH = mobile ? 1080 : 2160;
    if (caps.width && caps.width.max != null) {
      maxW = Math.min(maxW, caps.width.max);
      idealW = Math.min(idealW, Math.max(caps.width.min || 640, caps.width.max));
    }
    if (caps.height && caps.height.max != null) {
      maxH = Math.min(maxH, caps.height.max);
      idealH = Math.min(idealH, Math.max(caps.height.min || 480, caps.height.max));
    }
    const supported = navigator.mediaDevices && navigator.mediaDevices.getSupportedConstraints
      ? navigator.mediaDevices.getSupportedConstraints()
      : {};
    const supportsPoi = supported.pointsOfInterest === true || caps.pointsOfInterest != null;
    const z = caps.zoom;
    const supportsZoom = !!(z && z.max != null && z.min != null && z.max > z.min);
    const supportsTorch = caps.torch === true
      || (Array.isArray(caps.fillLightMode) && caps.fillLightMode.indexOf('flash') >= 0);
    return {
      idealWidth: idealW,
      idealHeight: idealH,
      maxWidth: maxW,
      maxHeight: maxH,
      startFocusMode: bucketPickFocusMode(caps, 'start'),
      tapFocusMode: bucketPickFocusMode(caps, 'tap'),
      supportsPoi: supportsPoi,
      supportsZoom: supportsZoom,
      supportsTorch: supportsTorch,
      settleMs: focusProfile.settleMs,
      scanLoopMs: focusProfile.scanLoopMs,
      tier: focusProfile.tier
    };
  }

  function bucketMacroZoomLevel(caps, ratio) {
    const z = caps.zoom;
    if (!z || z.max == null || z.min == null) return null;
    const min = z.min;
    const max = z.max;
    const range = max - min;
    if (range <= 0) return null;
    const r = ratio != null ? ratio : MACRO_ZOOM_RATIO_TAP;
    let level = min + range * r;
    const step = z.step;
    if (step && step > 0) {
      level = Math.round(level / step) * step;
    }
    return Math.min(max, Math.max(min, level));
  }

  function bucketBuildGetUserMediaVideoConstraints() {
    const video = { facingMode: { ideal: 'environment' } };
    const supported = navigator.mediaDevices && navigator.mediaDevices.getSupportedConstraints
      ? navigator.mediaDevices.getSupportedConstraints()
      : {};
    const mobile = bucketIsMobileDevice();
    const profile = _camDeviceProfile;
    if (supported.width && supported.height) {
      if (profile) {
        video.width = { ideal: profile.idealWidth, max: profile.maxWidth };
        video.height = { ideal: profile.idealHeight, max: profile.maxHeight };
      } else if (mobile) {
        video.width = { ideal: 1920, max: 1920 };
        video.height = { ideal: 1080, max: 1080 };
      } else {
        video.width = { ideal: 1920, min: 1280 };
        video.height = { ideal: 1080, min: 720 };
      }
    } else {
      video.width = { ideal: profile ? profile.idealWidth : 1280 };
      video.height = { ideal: profile ? profile.idealHeight : 720 };
    }
    return video;
  }

  async function bucketApplyTrackConstraints(track, constraintObj) {
    if (!track || typeof track.applyConstraints !== 'function' || !constraintObj) return false;
    try {
      await track.applyConstraints(constraintObj);
      _camLastFocusAppliedTs = Date.now();
      return true;
    } catch (_) { /* try advanced */ }
    try {
      await track.applyConstraints({ advanced: [constraintObj] });
      _camLastFocusAppliedTs = Date.now();
      return true;
    } catch (_) { /* ignore */ }
    return false;
  }

  function bucketJsqrMaxWidth(frameW) {
    const w = frameW || 0;
    if (w < 1) return JSQR_MAX_WIDTH;
    return Math.min(JSQR_MAX_WIDTH_CAP, Math.max(JSQR_MAX_WIDTH, Math.floor(w * 0.5)));
  }

  async function bucketApplyStreamFocusAtStart(track, caps) {
    const mode = bucketPickFocusMode(caps, 'start');
    if (!mode) return;
    await bucketApplyTrackConstraints(track, { focusMode: mode });
  }

  async function bucketApplyTapMacroZoom(track, caps) {
    if (!track) return false;
    _camMacroZoomActive = false;
    let level = bucketMacroZoomLevel(caps, MACRO_ZOOM_RATIO_TAP);
    if (level == null) return false;
    if (await bucketApplyTrackConstraints(track, { zoom: level })) {
      _camMacroZoomActive = true;
      return true;
    }
    level = bucketMacroZoomLevel(caps, MACRO_ZOOM_RATIO_FALLBACK);
    if (level == null) return false;
    if (await bucketApplyTrackConstraints(track, { zoom: level })) {
      _camMacroZoomActive = true;
      return true;
    }
    return false;
  }

  async function bucketEnhanceVideoTrack(track) {
    _camDeviceProfile = bucketProbeDeviceCamera(track);
    _camFocusProfile = {
      settleMs: _camDeviceProfile.settleMs,
      scanLoopMs: _camDeviceProfile.scanLoopMs,
      tier: _camDeviceProfile.tier
    };
    let settings = {};
    try {
      settings = typeof track.getSettings === 'function' ? track.getSettings() : {};
    } catch (_) { /* ignore */ }
    if (_camDeviceProfile.idealWidth && (!settings.width || settings.width < _camDeviceProfile.idealWidth * 0.85)) {
      await bucketApplyTrackConstraints(track, {
        width: { ideal: _camDeviceProfile.idealWidth },
        height: { ideal: _camDeviceProfile.idealHeight }
      });
    }
    if (_camDeviceProfile.startFocusMode) {
      await bucketApplyTrackConstraints(track, { focusMode: _camDeviceProfile.startFocusMode });
    } else {
      await bucketApplyStreamFocusAtStart(track, bucketGetVideoCaps(track));
    }
    bucketSyncTorchButton();
    await bucketDelay(STREAM_WARMUP_MS);
  }

  function bucketSyncTorchButton() {
    const btn = document.getElementById('bucket-torch-btn');
    if (!btn) return;
    const show = _camDeviceProfile && _camDeviceProfile.supportsTorch && _bucket.status === 'SCANNING';
    btn.style.display = show ? '' : 'none';
    btn.setAttribute('aria-pressed', _camTorchOn ? 'true' : 'false');
    btn.textContent = _camTorchOn ? 'Torch on' : 'Torch';
  }

  window.bucketToggleTorch = async function bucketToggleTorch() {
    if (!_camStream || !_camDeviceProfile || !_camDeviceProfile.supportsTorch) return;
    const track = _camStream.getVideoTracks()[0];
    if (!track) return;
    _camTorchOn = !_camTorchOn;
    const ok = await bucketApplyTrackConstraints(track, { torch: _camTorchOn });
    if (!ok) _camTorchOn = !_camTorchOn;
    bucketSyncTorchButton();
  };

  function bucketTapSettleMs(profile) {
    const p = profile || _camFocusProfile || { settleMs: 900, tier: 'single-shot' };
    let ms = p.settleMs;
    if (bucketIsAndroidChrome() && p.tier === 'none') {
      ms += ANDROID_WEAK_AF_SETTLE_BUMP_MS;
    }
    return ms;
  }

  function bucketShowFocusReticle(clientX, clientY, viewportEl) {
    const reticle = document.getElementById('bucket-focus-reticle');
    if (!reticle || !viewportEl) return;
    const r = viewportEl.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    reticle.style.left = x + 'px';
    reticle.style.top = y + 'px';
    reticle.classList.add('is-visible');
    setTimeout(function () { reticle.classList.remove('is-visible'); }, 900);
  }

  async function bucketApplyTapFocus(clientX, clientY, viewportEl) {
    if (!viewportEl) return;
    const r = viewportEl.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;

    const raw_nx = (clientX - r.left) / r.width;
    const raw_ny = (clientY - r.top) / r.height;
    if (raw_nx < 0 || raw_nx > 1 || raw_ny < 0 || raw_ny > 1) {
      _camRoi = { x: 0.5, y: 0.5 };
    } else {
      _camRoi = {
        x: Math.min(0.95, Math.max(0.05, raw_nx)),
        y: Math.min(0.95, Math.max(0.05, raw_ny))
      };
    }

    bucketShowFocusReticle(clientX, clientY, viewportEl);

    if (!_camStream) return;
    const track = _camStream.getVideoTracks()[0];
    if (!track || typeof track.applyConstraints !== 'function') return;
    const caps = bucketGetVideoCaps(track);
    const constraintObj = { pointsOfInterest: [{ x: _camRoi.x, y: _camRoi.y }] };
    const tapMode = (_camDeviceProfile && _camDeviceProfile.tapFocusMode)
      || bucketPickFocusMode(caps, 'tap');
    if (tapMode) constraintObj.focusMode = tapMode;
    await bucketApplyTrackConstraints(track, constraintObj);
  }

  function bucketIsAndroidChrome() {
    const ua = navigator.userAgent || '';
    return /Android/i.test(ua) && /Chrome/i.test(ua) && !/EdgA/i.test(ua);
  }

  function bucketWaitNextFrame(video) {
    return new Promise(function (resolve) {
      if (video && typeof video.requestVideoFrameCallback === 'function') {
        video.requestVideoFrameCallback(function () { resolve(); });
        return;
      }
      requestAnimationFrame(function () { resolve(); });
    });
  }

  function bucketTapRoiSize() {
    return _camMacroZoomActive ? TAP_ROI_SIZE_MACRO : TAP_ROI_SIZE;
  }

  function bucketDelay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function bucketEnsureCanvas() {
    if (!_camCanvas) {
      _camCanvas = document.createElement('canvas');
      _camCtx = _camCanvas.getContext('2d', { willReadFrequently: true });
    }
    return _camCtx;
  }

  function bucketDrawFrameToCanvas(video) {
    const ctx = bucketEnsureCanvas();
    if (!ctx || video.readyState < 2) return null;
    const w = video.videoWidth || 0;
    const h = video.videoHeight || 0;
    if (w < 16 || h < 16) return null;
    _camCanvas.width = w;
    _camCanvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    return { w: w, h: h };
  }

  async function bucketGrabFrameToCanvas(video, track) {
    const focusSettledEnough = Date.now() - _camLastFocusAppliedTs > 400;
    if (focusSettledEnough && track && typeof ImageCapture !== 'undefined') {
      try {
        const ic = new ImageCapture(track);
        const bmp = await ic.grabFrame();
        const ctx = bucketEnsureCanvas();
        if (ctx && bmp.width >= 16 && bmp.height >= 16) {
          _camCanvas.width = bmp.width;
          _camCanvas.height = bmp.height;
          ctx.drawImage(bmp, 0, 0);
          bmp.close();
          return { w: bmp.width, h: bmp.height };
        }
        bmp.close();
      } catch (_) { /* fall back to video frame */ }
    }
    return bucketDrawFrameToCanvas(video);
  }

  function bucketDecodeQrFromImageData(imageData, w, h) {
    if (!window.jsQR) return '';
    const code = window.jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
    return code && code.data ? code.data : '';
  }

  async function bucketDetectOnVideo(video) {
    if (!_camDetector || !video || video.readyState < 2) return '';
    try {
      const codes = await _camDetector.detect(video);
      return codes && codes.length && codes[0].rawValue ? codes[0].rawValue : '';
    } catch (_) {
      return '';
    }
  }

  async function bucketDetectOnCanvas(canvasEl) {
    if (!_camDetector || !canvasEl) return '';
    try {
      const codes = await _camDetector.detect(canvasEl);
      return codes && codes.length && codes[0].rawValue ? codes[0].rawValue : '';
    } catch (_) {
      return '';
    }
  }

  async function bucketDecodeCanvasMultiScale(canvasEl, w, h) {
    const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
    if (!ctx) return '';
    let roiData = ctx.getImageData(0, 0, w, h);
    let jsqrVal = bucketDecodeQrFromImageData(roiData, w, h);
    if (jsqrVal) return jsqrVal;
    let nativeVal = await bucketDetectOnCanvas(canvasEl);
    if (nativeVal) return nativeVal;
    const scales = [2, 3];
    for (let i = 0; i < scales.length; i++) {
      const scale = scales[i];
      const uw = Math.min(Math.floor(w * scale), 1920);
      const uh = Math.min(Math.floor(h * scale), 1920);
      const up = document.createElement('canvas');
      up.width = uw;
      up.height = uh;
      const uctx = up.getContext('2d', { willReadFrequently: true });
      if (!uctx) continue;
      uctx.imageSmoothingEnabled = false;
      uctx.drawImage(canvasEl, 0, 0, uw, uh);
      roiData = uctx.getImageData(0, 0, uw, uh);
      jsqrVal = bucketDecodeQrFromImageData(roiData, uw, uh);
      if (jsqrVal) return jsqrVal;
      nativeVal = await bucketDetectOnCanvas(up);
      if (nativeVal) return nativeVal;
    }
    return '';
  }

  async function bucketDecodeCropAtRoi(frameSize, roi, roiSize) {
    if (!frameSize || !roi || !_camCtx) return '';
    const w = frameSize.w;
    const h = frameSize.h;
    const rw = Math.max(64, Math.floor(w * roiSize));
    const rh = Math.max(64, Math.floor(h * roiSize));
    const sx = Math.min(w - rw, Math.max(0, Math.floor(roi.x * w - rw / 2)));
    const sy = Math.min(h - rh, Math.max(0, Math.floor(roi.y * h - rh / 2)));

    const roiCanvas = document.createElement('canvas');
    roiCanvas.width = rw;
    roiCanvas.height = rh;
    const roiCtx = roiCanvas.getContext('2d', { willReadFrequently: true });
    if (!roiCtx) return '';
    roiCtx.drawImage(_camCanvas, sx, sy, rw, rh, 0, 0, rw, rh);

    return bucketDecodeCanvasMultiScale(roiCanvas, rw, rh);
  }

  async function bucketDecodeFullFrameJsqrDownscaled(frameSize) {
    if (!frameSize || !_camCtx || !window.jsQR) return '';
    let dw = frameSize.w;
    let dh = frameSize.h;
    const maxW = frameSize.w <= 1280 ? frameSize.w : bucketJsqrMaxWidth(frameSize.w);
    if (dw > maxW) {
      dh = Math.max(1, Math.floor(dh * maxW / dw));
      dw = maxW;
    }
    const small = document.createElement('canvas');
    small.width = dw;
    small.height = dh;
    const sctx = small.getContext('2d', { willReadFrequently: true });
    if (!sctx) return '';
    sctx.drawImage(_camCanvas, 0, 0, dw, dh);
    const data = sctx.getImageData(0, 0, dw, dh);
    return bucketDecodeQrFromImageData(data, dw, dh);
  }

  async function bucketDecodeFullFrame(frameSize) {
    if (!frameSize || !_camCtx) return '';

    const jsVal = await bucketDecodeFullFrameJsqrDownscaled(frameSize);
    if (jsVal) return jsVal;

    return bucketDetectOnCanvas(_camCanvas);
  }

  async function bucketDecodeAtRoi(video, track, roi, roiSize) {
    if (!video || video.readyState < 2) return '';
    const frameSize = await bucketGrabFrameToCanvas(video, track);
    if (!frameSize) return '';

    if (roi) {
      const roiVal = await bucketDecodeCropAtRoi(frameSize, roi, roiSize);
      if (roiVal) return roiVal;
    }

    return bucketDecodeFullFrame(frameSize);
  }

  async function bucketDecodeAllPaths(video, track, roi, roiSize) {
    const roiVal = await bucketDecodeAtRoi(video, track, roi, roiSize);
    if (roiVal) return roiVal;

    if (bucketIsAndroidChrome() && _camDetector) {
      const videoVal = await bucketDetectOnVideo(video);
      if (videoVal) return videoVal;
    }

    return '';
  }

  async function bucketScanAfterFocus(video, track, scanLoopMs) {
    const loopMs = scanLoopMs || (_camFocusProfile && _camFocusProfile.scanLoopMs) || 3200;
    const deadline = Date.now() + loopMs;
    while (Date.now() < deadline) {
      const val = await bucketDecodeAllPaths(video, track, _camRoi, bucketTapRoiSize());
      if (val) return val;
      await bucketWaitNextFrame(video);
      await bucketDelay(SCAN_TICK_MS);
    }
    return '';
  }

  async function bucketTapToScan(clientX, clientY, viewportEl) {
    const now = Date.now();
    if (now - _lastTapAttemptTs < TAP_DEBOUNCE_MS || _tapScanBusy) return;
    _lastTapAttemptTs = now;

    const video = document.getElementById('bucket-video');
    if (!video || !_camStream) return;

    _tapScanBusy = true;

    try {
      if (video.readyState < 2) {
        await new Promise(function (resolve) {
          const onReady = function () {
            video.removeEventListener('loadeddata', onReady);
            resolve();
          };
          video.addEventListener('loadeddata', onReady);
          setTimeout(resolve, 300);
        });
      }

      const track = _camStream.getVideoTracks()[0];
      const caps = bucketGetVideoCaps(track);
      const profile = _camFocusProfile || bucketFocusProfile(caps);
      bucketSetScanStatus('Focusing…', 'ok');
      await bucketApplyTapFocus(clientX, clientY, viewportEl);
      if (bucketIsMobileDevice() && (_camDeviceProfile == null || _camDeviceProfile.supportsZoom)) {
        await bucketApplyTapMacroZoom(track, caps);
      }
      let settleMs = bucketTapSettleMs(profile);
      if (_camMacroZoomActive) settleMs += TAP_ZOOM_SETTLE_MS;
      await bucketDelay(settleMs);

      bucketSetScanStatus('Scanning…', 'ok');
      const scannedValue = await bucketScanAfterFocus(video, track, profile.scanLoopMs);

      if (scannedValue) {
        bucketClearScanStatus();
        await bucketHandleScan(scannedValue);
      } else {
        bucketSetScanStatus('No QR detected — aim at QR, tap to focus, release to scan, or enter 7 digits below', 'warn');
        bucketFlash('warn');
      }
    } catch (_) {
      bucketSetScanStatus('Scan failed — tap again', 'err');
    } finally {
      _tapScanBusy = false;
    }
  }

  function bucketBindCameraViewport() {
    if (_camViewportBound) return;
    const viewport = document.getElementById('bucket-scan-viewport');
    if (!viewport) return;
    _camViewportBound = true;

    function handleTap(clientX, clientY) {
      bucketTapToScan(clientX, clientY, viewport);
    }

    // Use pointerup for ALL pointer types — avoids Android Chrome double-fire
    viewport.addEventListener('pointerup', function (e) {
      if (e.isPrimary === false) return;
      e.preventDefault();
      handleTap(e.clientX, e.clientY);
    }, { passive: false });

    // Fallback only for browsers without PointerEvent support (very rare)
    viewport.addEventListener('touchend', function (e) {
      if (window.PointerEvent) return;
      e.preventDefault();
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      handleTap(t.clientX, t.clientY);
    }, { passive: false });
  }

  function bucketIsModalOpen() {
    const el = document.getElementById(MODAL_ID);
    return !!(el && (el.classList.contains('open') || el.style.display === 'flex' || el.style.display === 'block'));
  }

  function bucketShouldResumeCamera() {
    return _bucket.status === 'SCANNING' && bucketIsModalOpen() && document.visibilityState !== 'hidden';
  }

  function bucketScheduleCameraResume(message, delayMs) {
    if (!bucketShouldResumeCamera()) return;
    if (_camResumeTimer) clearTimeout(_camResumeTimer);
    if (message) bucketSetScanStatus(message, 'warn');
    _camResumeTimer = setTimeout(function () {
      _camResumeTimer = null;
      if (bucketShouldResumeCamera()) bucketStartCamera();
    }, Number(delayMs) || 350);
  }

  function bucketHandleCameraTrackInterrupted() {
    if (_camIgnoreTrackEnd) return;
    if (!_camStream) return;
    _camStream = null;
    const video = document.getElementById('bucket-video');
    if (video) video.srcObject = null;
    _camDetector = null;
    _camDecodeMode = null;
    _camCanvas = null;
    _camCtx = null;
    _camDeviceProfile = null;
    _camFocusProfile = null;
    _camMacroZoomActive = false;
    _camTorchOn = false;
    bucketScheduleCameraResume('Camera interrupted. Resuming...', 650);
  }

  function bucketBindCameraTrackLifecycle(stream) {
    if (!stream) return;
    stream.getTracks().forEach(function (track) {
      track.addEventListener('ended', bucketHandleCameraTrackInterrupted);
      track.addEventListener('mute', function () {
        bucketScheduleCameraResume('Camera paused. Waiting to resume...', 900);
      });
      track.addEventListener('unmute', function () {
        if (_bucket.status === 'SCANNING') bucketClearScanStatus();
      });
    });
  }

  function bucketIsTransientCameraError(err) {
    const name = String(err && err.name || '');
    const message = String(err && err.message || '');
    return /^(AbortError|NotReadableError)$/i.test(name) || /camera.*(busy|in use|starting)|could not start/i.test(message);
  }

  function bucketStopCamera() {
    if (_camResumeTimer) {
      clearTimeout(_camResumeTimer);
      _camResumeTimer = null;
    }
    _camRoi = null;
    _lastTapAttemptTs = 0;
    _tapScanBusy = false;
    _camFocusProfile = null;
    _camMacroZoomActive = false;
    _camDeviceProfile = null;
    if (_camStream) {
      if (_camTorchOn) {
        const tr = _camStream.getVideoTracks()[0];
        if (tr) bucketApplyTrackConstraints(tr, { torch: false }).catch(function () { /* ignore */ });
      }
      _camTorchOn = false;
      _camIgnoreTrackEnd = true;
      _camStream.getTracks().forEach(function (t) { t.stop(); });
      _camIgnoreTrackEnd = false;
      _camStream = null;
    }
    const video = document.getElementById('bucket-video');
    if (video) video.srcObject = null;
    _camDetector = null;
    _camDecodeMode = null;
    _camCanvas = null;
    _camCtx = null;
    bucketSyncTorchButton();
  }

  async function bucketStartCamera() {
    if (_camStartPromise) return _camStartPromise;
    if (document.visibilityState === 'hidden') {
      bucketSetScanStatus('Camera paused while app is in background.', 'warn');
      return Promise.resolve();
    }
    const blocked = bucketCameraBlockedReason();
    if (blocked) {
      bucketSetScanStatus(blocked, 'err');
      return Promise.resolve();
    }
    const video = document.getElementById('bucket-video');
    if (!video) return Promise.resolve();

    bucketBindCameraViewport();

    _camStartPromise = (async function () {
      bucketStopCamera();
      await bucketLoadJsQr();
      if (!window.jsQR && !('BarcodeDetector' in window)) {
        throw new Error('QR decoder unavailable');
      }
      bucketEnsureCanvas();
      if ('BarcodeDetector' in window) {
        _camDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        _camDecodeMode = 'hybrid';
      } else {
        _camDecodeMode = 'jsqr';
      }
      _camStream = await navigator.mediaDevices.getUserMedia({
        video: bucketBuildGetUserMediaVideoConstraints(),
        audio: false
      });
      bucketBindCameraTrackLifecycle(_camStream);
      video.srcObject = _camStream;
      await video.play().catch(function () { /* autoplay */ });
      const track = _camStream.getVideoTracks()[0];
      if (track) await bucketEnhanceVideoTrack(track);
      bucketSetScanStatus('', '');
    })().catch(function (err) {
      bucketStopCamera();
      if (bucketIsTransientCameraError(err) && bucketShouldResumeCamera()) {
        bucketScheduleCameraResume('Camera is coming back. Retrying...', 1400);
      } else {
        bucketSetScanStatus(err.message || 'Camera failed', 'err');
      }
    }).finally(function () {
      _camStartPromise = null;
    });
    return _camStartPromise;
  }

  function bucketBuildResult() {
    const sc = bucketScore();
    const istNow = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T') + '+05:30';
    return {
      mode: _bucket.mode,
      sessionId: _bucket.sessionId,
      label: _bucket.label,
      scanned: _bucket.scanned.slice(),
      score: sc,
      submitted_at: istNow
    };
  }

  window.bucketClose = function bucketClose() {
    bucketModalClose();
  };

  window.bucketStartScanning = function bucketStartScanning() {
    bucketShowScreen('scan');
    bucketSetListOpen(false);
    bucketClearScanStatus();
    bucketRenderScannedList();
    bucketRenderScore();
    const hint = document.querySelector('#modal-bucket-scan .bucket-scan-focus-hint');
    if (hint) {
      hint.textContent = 'Aim at QR · tap to focus · release to scan';
    }
    bucketStartCamera();
  };

  window.bucketStopScanning = function bucketStopScanning() {
    bucketStopCamera();
    bucketShowScreen('idle');
  };

  window.bucketGoReview = function bucketGoReview() {
    bucketStopCamera();
    bucketShowScreen('review');
    bucketRenderReview();
  };

  window.bucketBackToScan = function bucketBackToScan() {
    bucketShowScreen('scan');
    bucketRenderScannedList();
    bucketRenderScore();
    bucketStartCamera();
  };

  window.bucketSubmit = async function bucketSubmit() {
    if (!bucketCanSubmit()) {
      if (typeof window.cosmosToastWarn === 'function') {
        window.cosmosToastWarn(_bucket.mode === 'RECEIVE'
          ? 'Scan every unit on the transfer document'
          : 'Scan at least one unit');
      }
      return;
    }
    const btn = document.getElementById('bucket-review-submit-btn');
    if (btn && typeof window.cosmosBtnLoading === 'function') window.cosmosBtnLoading(btn);
    const result = bucketBuildResult();
    const fn = _bucket.onSubmit;
    try {
      if (typeof fn === 'function') await fn(result);
      bucketModalClose();
      if (typeof window.cosmosToastSuccess === 'function') window.cosmosToastSuccess('Scan bucket saved');
    } catch (err) {
      if (typeof window.cosmosToastError === 'function') window.cosmosToastError(err.message || 'Submit failed');
    } finally {
      if (btn && typeof window.cosmosBtnDone === 'function') window.cosmosBtnDone(btn);
    }
  };

  window.bucketManualScan = function bucketManualScan() {
    const inp = document.getElementById('bucket-manual-input');
    const v = inp ? String(inp.value || '').trim() : '';
    if (!v) return;
    bucketHandleScan(v);
    if (inp) inp.value = '';
  };

  window.bucketManualKeydown = function bucketManualKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.bucketManualScan();
    }
  };

  /**
   * @param {{ mode: 'TRANSFER'|'RECEIVE', sessionId?: *, label?: string, expected?: Array, onSubmit?: Function }} opts
   */
  window.openBucket = function openBucket(opts) {
    opts = opts || {};
    const mode = String(opts.mode || '').toUpperCase();
    if (mode !== 'TRANSFER' && mode !== 'RECEIVE') {
      if (typeof window.cosmosToastError === 'function') window.cosmosToastError('Invalid bucket mode');
      return;
    }
    if (mode === 'RECEIVE' && (!opts.expected || !opts.expected.length)) {
      if (typeof window.cosmosToastError === 'function') {
        window.cosmosToastError('No units on this document. HQ must dispatch with unit scans.');
      }
      return;
    }

    Object.keys(_scanCooldown).forEach(function (k) { delete _scanCooldown[k]; });
    _bucketActiveSuccessToast = null;

    _bucket.mode = mode;
    _bucket.sessionId = opts.sessionId != null ? opts.sessionId : null;
    _bucket.label = opts.label || (mode === 'TRANSFER' ? 'Transfer dispatch' : 'Receive transfer');
    _bucket.expected = Array.isArray(opts.expected) ? opts.expected.slice() : [];
    _bucket.scanned = [];
    _bucket.verifiedSlots = {};
    _bucket.onSubmit = typeof opts.onSubmit === 'function' ? opts.onSubmit : null;
    _bucket._lastScanKey = '';
    _bucket._lastScanTs = 0;

    const modeBadge = document.getElementById('bucket-mode-badge');
    const titleEl = document.getElementById('bucket-header-label');
    if (modeBadge) {
      modeBadge.textContent = mode;
      modeBadge.className = 'b ' + (mode === 'TRANSFER' ? 'b-blue' : 'b-green');
    }
    if (titleEl) titleEl.textContent = _bucket.label;

    bucketSetListOpen(false);
    bucketClearScanStatus();
    bucketShowScreen('idle');
    bucketRenderScannedList();
    bucketRenderScore();
    bucketModalOpen();
  };

  document.addEventListener('visibilitychange', function () {
    if (_bucket.status !== 'SCANNING') return;
    if (document.visibilityState === 'hidden') {
      bucketStopCamera();
      return;
    }
    bucketScheduleCameraResume('Resuming camera...', 300);
  });

  window.addEventListener('pagehide', function () {
    if (_bucket.status !== 'SCANNING') return;
    bucketStopCamera();
  });

  window.addEventListener('focus', function () {
    if (_bucket.status !== 'SCANNING') return;
    bucketScheduleCameraResume('', 250);
  });
})();
