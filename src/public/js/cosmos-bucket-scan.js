/**
 * Cosmos Bucket Scan — TRANSFER (Foundry dispatch) + RECEIVE (StorePilot incoming verify).
 * Popup modal, unit-barcode only, BarcodeDetector / jsQR camera.
 */
(function () {
  'use strict';

  const DEBOUNCE_MS = 2000;
  const SCAN_TICK_MS = 100;
  const ROI_SIZE = 0.42;
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
  let _camRafId = null;
  let _camLastTick = 0;
  let _camDetector = null;
  let _camDecodeMode = null;
  let _camCanvas = null;
  let _camCtx = null;
  let _camRoi = null;
  let _camRoiMissFrames = 0;
  let _camViewportBound = false;
  let _highlightTimer = null;

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

  function bucketApplyTapFocus(clientX, clientY, viewportEl) {
    if (!viewportEl) return;
    const r = viewportEl.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    const nx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const ny = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    _camRoi = { x: nx, y: ny };
    _camRoiMissFrames = 0;
    bucketShowFocusReticle(clientX, clientY, viewportEl);

    if (!_camStream) return;
    const track = _camStream.getVideoTracks()[0];
    if (!track || typeof track.applyConstraints !== 'function') return;
    try {
      const caps = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
      const advanced = { pointsOfInterest: [{ x: nx, y: ny }] };
      if (caps.focusMode && caps.focusMode.indexOf('single-shot') >= 0) {
        advanced.focusMode = 'single-shot';
      } else if (caps.focusMode && caps.focusMode.indexOf('continuous') >= 0) {
        advanced.focusMode = 'continuous';
      }
      track.applyConstraints({ advanced: [advanced] }).catch(function () { /* unsupported */ });
    } catch (_) { /* ignore */ }
  }

  function bucketBindCameraViewport() {
    if (_camViewportBound) return;
    const viewport = document.getElementById('bucket-scan-viewport');
    if (!viewport) return;
    _camViewportBound = true;
    viewport.addEventListener('pointerdown', function (e) {
      if (e.isPrimary === false) return;
      bucketApplyTapFocus(e.clientX, e.clientY, viewport);
    });
  }

  function bucketDecodeQrFromImageData(imageData, w, h) {
    if (!window.jsQR) return '';
    const code = window.jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
    return code && code.data ? code.data : '';
  }

  async function bucketDecodeFrame(video) {
    if (_camDecodeMode === 'native' && _camDetector) {
      const codes = await _camDetector.detect(video);
      return codes && codes.length && codes[0].rawValue ? codes[0].rawValue : '';
    }
    if (_camDecodeMode !== 'jsqr' || !_camCtx || !window.jsQR || video.readyState < 2) return '';
    const w = video.videoWidth || 0;
    const h = video.videoHeight || 0;
    if (w < 16 || h < 16) return '';

    _camCanvas.width = w;
    _camCanvas.height = h;
    _camCtx.drawImage(video, 0, 0, w, h);

    if (_camRoi) {
      const rw = Math.max(64, Math.floor(w * ROI_SIZE));
      const rh = Math.max(64, Math.floor(h * ROI_SIZE));
      const sx = Math.min(w - rw, Math.max(0, Math.floor(_camRoi.x * w - rw / 2)));
      const sy = Math.min(h - rh, Math.max(0, Math.floor(_camRoi.y * h - rh / 2)));
      const roiData = _camCtx.getImageData(sx, sy, rw, rh);
      const roiVal = bucketDecodeQrFromImageData(roiData, rw, rh);
      if (roiVal) {
        _camRoiMissFrames = 0;
        return roiVal;
      }
      _camRoiMissFrames += 1;
      if (_camRoiMissFrames < 12) return '';
      _camRoi = null;
    }

    const fullData = _camCtx.getImageData(0, 0, w, h);
    return bucketDecodeQrFromImageData(fullData, w, h);
  }

  function bucketStopCamera() {
    if (_camRafId) {
      cancelAnimationFrame(_camRafId);
      _camRafId = null;
    }
    _camLastTick = 0;
    _camRoi = null;
    _camRoiMissFrames = 0;
    if (_camStream) {
      _camStream.getTracks().forEach(function (t) { t.stop(); });
      _camStream = null;
    }
    const video = document.getElementById('bucket-video');
    if (video) video.srcObject = null;
    _camDetector = null;
    _camDecodeMode = null;
    _camCanvas = null;
    _camCtx = null;
  }

  async function bucketStartCamera() {
    const blocked = bucketCameraBlockedReason();
    if (blocked) {
      bucketSetScanStatus(blocked, 'err');
      return;
    }
    const video = document.getElementById('bucket-video');
    if (!video) return;

    bucketBindCameraViewport();

    try {
      bucketStopCamera();
      if ('BarcodeDetector' in window) {
        _camDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        _camDecodeMode = 'native';
      } else {
        await bucketLoadJsQr();
        if (!window.jsQR) throw new Error('QR decoder unavailable');
        _camDecodeMode = 'jsqr';
        _camCanvas = document.createElement('canvas');
        _camCtx = _camCanvas.getContext('2d', { willReadFrequently: true });
      }
      _camStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      video.srcObject = _camStream;

      const tick = async function (ts) {
        if (!_camStream) return;
        if (!ts) ts = performance.now();
        if (ts - _camLastTick < SCAN_TICK_MS) {
          _camRafId = requestAnimationFrame(tick);
          return;
        }
        _camLastTick = ts;
        try {
          const scannedValue = await bucketDecodeFrame(video);
          if (scannedValue) await bucketHandleScan(scannedValue);
        } catch (_) { /* frame */ }
        _camRafId = requestAnimationFrame(tick);
      };
      _camRafId = requestAnimationFrame(tick);
    } catch (err) {
      bucketStopCamera();
      bucketSetScanStatus(err.message || 'Camera failed', 'err');
    }
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
})();
