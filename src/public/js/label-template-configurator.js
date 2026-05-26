/**
 * Command Unit — Label Template Configurator
 * API: /api/foundry/label-print-formats
 */
(function () {
  'use strict';

  /** Canvas zoom only (label geometry uses true CSS mm — matches Foundry preview). */
  let scale = 2.5;
  let currentStep = 1;
  let selectedZoneId = null;
  let canEdit = false;
  let formatsList = [];
  let template = null;
  let loadError = null;
  let sampleItem = null;
  let ltcQrLoader = null;
  let contentTokensCatalog = null;
  let contentPresetsCatalog = null;

  const LTC_CONFIG_KEYS = [
    'v', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'gapRow', 'gapCol',
    'labelWidthMm', 'labelHeightMm', 'labelsPerRow', 'dotsPerMm', 'qrCellSize', 'qrVisualSizeMm',
    'qrTopRatio', 'textTopRatio', 'textXMul', 'textYMul', 'textFontId', 'textFontPt', 'layoutType',
    'bottomBandHeightMm', 'rightRailWidthMm', 'printWidthMm', 'zone1WidthMm', 'zone2WidthMm',
    'tailWidthMm'
  ];

  /** Client-side zone presets when API returns empty zones_json (matches migration seeds). */
  const CLIENT_ZONE_PRESETS = {
    small_15x15: [
      { zone_key: 'qr', zone_type: 'qr', label: 'QR Code', printable: true, x_mm: 0, y_mm: 0, width_mm: 10, height_mm: 10, content: '{unit_id}', font_size_pt: 8, font_weight: '700', writing_mode: 'horizontal', error_level: 'L' },
      { zone_key: 'uid_strip', zone_type: 'text', label: 'Unit ID', printable: true, x_mm: 10.5, y_mm: 0, width_mm: 4, height_mm: 15, content: '{unit_id}', font_size_pt: 8, font_weight: '700', writing_mode: 'vertical', error_level: 'L' },
      { zone_key: 'footer', zone_type: 'text', label: 'Brand - MRP', printable: true, x_mm: 0, y_mm: 10.5, width_mm: 10, height_mm: 4.5, content: '{brand}-{mrp}', font_size_pt: 8, font_weight: '700', writing_mode: 'horizontal', error_level: 'L' }
    ],
    small_15x15_fixed: [
      { zone_key: 'qr', zone_type: 'qr', label: 'QR Code', printable: true, x_mm: 0, y_mm: 0, width_mm: 10, height_mm: 10, content: '{unit_id}', font_size_pt: 8, font_weight: '700', writing_mode: 'horizontal', error_level: 'L' },
      { zone_key: 'brand_rail', zone_type: 'text', label: 'Brand - MRP', printable: true, x_mm: 10, y_mm: 0, width_mm: 5, height_mm: 15, content: '{brand}-{mrp}', font_size_pt: 8, font_weight: '700', writing_mode: 'vertical', error_level: 'L' },
      { zone_key: 'unit_footer', zone_type: 'text', label: 'Unit ID', printable: true, x_mm: 0, y_mm: 10, width_mm: 10, height_mm: 5, content: '{unit_id}', font_size_pt: 8, font_weight: '700', writing_mode: 'horizontal', error_level: 'L' }
    ],
    small_15x15_alt: [
      { zone_key: 'qr', zone_type: 'qr', label: 'QR Code', printable: true, x_mm: 0, y_mm: 0, width_mm: 10, height_mm: 10, content: '{unit_id}', font_size_pt: 8, font_weight: '700', writing_mode: 'horizontal', error_level: 'L' },
      { zone_key: 'brand_rail', zone_type: 'text', label: 'Brand - MRP', printable: true, x_mm: 10.5, y_mm: 0, width_mm: 4.5, height_mm: 15, content: '{brand}-{mrp}', font_size_pt: 8, font_weight: '700', writing_mode: 'vertical', error_level: 'L' },
      { zone_key: 'unit_band', zone_type: 'text', label: 'Unit ID', printable: true, x_mm: 0, y_mm: 10.5, width_mm: 10.5, height_mm: 4.5, content: '{unit_id}', font_size_pt: 8, font_weight: '700', writing_mode: 'horizontal', error_level: 'L' }
    ],
    strip_104x12: [
      { zone_key: 'zone_qr_sku', zone_type: 'qr', label: 'Zone 1 — QR', printable: true, x_mm: 0, y_mm: 0, width_mm: 33, height_mm: 12, content: '{unit_id}', font_size_pt: 6, font_weight: '700', writing_mode: 'horizontal', error_level: 'L' },
      { zone_key: 'zone_brand_mrp', zone_type: 'text', label: 'Zone 2 — Brand', printable: true, x_mm: 33, y_mm: 0, width_mm: 33, height_mm: 12, content: '{brand}\n{model}\nMRP {mrp}', font_size_pt: 6, font_weight: '700', writing_mode: 'horizontal', error_level: 'L' },
      { zone_key: 'tail', zone_type: 'tail', label: 'Tail', printable: false, x_mm: 66, y_mm: 0, width_mm: 38, height_mm: 12, content: '' }
    ]
  };

  const PRESETS = {
    SQUARE: {
      label_type: 'SQUARE',
      page_width_mm: 109,
      columns: 6,
      col_gap_mm: 3,
      row_gap_mm: 3,
      margin_left_mm: 2,
      margin_right_mm: 2,
      margin_top_mm: 2,
      margin_bottom_mm: 0,
      label_width_mm: 15,
      label_height_mm: 15,
      zones: null
    },
    STRIP: {
      label_type: 'STRIP',
      page_width_mm: 108,
      columns: 1,
      col_gap_mm: 0,
      row_gap_mm: 2,
      margin_left_mm: 2,
      margin_right_mm: 2,
      margin_top_mm: 2,
      margin_bottom_mm: 0,
      label_width_mm: 104,
      label_height_mm: 12,
      zones: null
    }
  };

  async function ltcAuthHeaders(extra) {
    const token = sessionStorage.getItem('cosmos_token');
    let apiKey = sessionStorage.getItem('cosmos_api_key');
    if (!apiKey && typeof window.cosmosEnsureApiKey === 'function') {
      apiKey = await window.cosmosEnsureApiKey();
    }
    return Object.assign(
      { Authorization: 'Bearer ' + token, 'X-API-Key': apiKey },
      extra || {}
    );
  }

  async function ltcApi(method, path, body) {
    const opts = { method: method, headers: await ltcAuthHeaders(body ? { 'Content-Type': 'application/json' } : {}) };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    const data = await res.json();
    if (!res.ok || !data.success) {
      const details = Array.isArray(data.errors) ? ' — ' + data.errors.join('; ') : '';
      throw new Error((data.message || 'Request failed') + details);
    }
    return data.data;
  }

  function ltcEl(id) { return document.getElementById(id); }

  function ltcAlign() {
    return window.cosmosLabelZoneAlign || null;
  }

  function ltcDefaultSample() {
    const api = ltcAlign();
    if (api && api.SAMPLE_ITEM_DEFAULT) {
      return Object.assign({}, api.SAMPLE_ITEM_DEFAULT);
    }
    return {
      code: '1234567',
      unitText: '1234567',
      sku_code: 'SKU-MAR-001',
      label: 'SKU-MAR-001',
      brand: 'MAR',
      model: 'Aviator Classic',
      mrp: '4000',
      bottomLine: 'MAR-4000'
    };
  }

  function ensureSampleItem() {
    if (!sampleItem) sampleItem = ltcDefaultSample();
    return sampleItem;
  }

  function applyTokens(tpl) {
    const api = ltcAlign();
    if (api && typeof api.applyZoneTokens === 'function') {
      return api.applyZoneTokens(tpl, ensureSampleItem());
    }
    return String(tpl || '');
  }

  function readSampleFromPanel() {
    const unit = (ltcEl('ltc-sample-unit') && ltcEl('ltc-sample-unit').value.trim()) || '1234567';
    const digits = unit.replace(/\D/g, '').slice(0, 7);
    const brand = (ltcEl('ltc-sample-brand') && ltcEl('ltc-sample-brand').value.trim()) || 'MAR';
    const mrp = (ltcEl('ltc-sample-mrp') && ltcEl('ltc-sample-mrp').value.trim()) || '4000';
    sampleItem = {
      code: digits || '1234567',
      unitText: digits || '1234567',
      sku_code: (ltcEl('ltc-sample-sku') && ltcEl('ltc-sample-sku').value.trim()) || 'SKU-MAR-001',
      label: (ltcEl('ltc-sample-sku') && ltcEl('ltc-sample-sku').value.trim()) || 'SKU-MAR-001',
      brand: brand,
      model: (ltcEl('ltc-sample-model') && ltcEl('ltc-sample-model').value.trim()) || 'Aviator Classic',
      mrp: mrp,
      bottomLine: brand + '-' + mrp
    };
    return sampleItem;
  }

  function writeSampleToPanel() {
    const s = ensureSampleItem();
    if (ltcEl('ltc-sample-unit')) ltcEl('ltc-sample-unit').value = s.code || '';
    if (ltcEl('ltc-sample-sku')) ltcEl('ltc-sample-sku').value = s.sku_code || '';
    if (ltcEl('ltc-sample-brand')) ltcEl('ltc-sample-brand').value = s.brand || '';
    if (ltcEl('ltc-sample-model')) ltcEl('ltc-sample-model').value = s.model || '';
    if (ltcEl('ltc-sample-mrp')) ltcEl('ltc-sample-mrp').value = s.mrp || '';
  }

  function resetSampleData() {
    sampleItem = ltcDefaultSample();
    writeSampleToPanel();
    if (currentStep === 3) {
      renderCanvas();
      renderTspl();
    }
  }

  function loadLtcQrLib() {
    if (window._ltcQRCode_loaded && typeof QRCode !== 'undefined') return Promise.resolve();
    if (ltcQrLoader) return ltcQrLoader;
    const sources = ['/js/vendor/qrcode.min.js', 'https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js'];
    ltcQrLoader = new Promise(function (resolve, reject) {
      let idx = 0;
      function tryNext() {
        if (typeof QRCode !== 'undefined') {
          window._ltcQRCode_loaded = true;
          resolve();
          return;
        }
        if (idx >= sources.length) {
          reject(new Error('QR library unavailable'));
          return;
        }
        const s = document.createElement('script');
        s.src = sources[idx];
        idx += 1;
        s.async = true;
        s.onload = function () {
          if (typeof QRCode !== 'undefined') {
            window._ltcQRCode_loaded = true;
            resolve();
          } else tryNext();
        };
        s.onerror = tryNext;
        document.head.appendChild(s);
      }
      tryNext();
    }).finally(function () {
      ltcQrLoader = null;
    });
    return ltcQrLoader;
  }

  function ltcQrDataUrl(code) {
    const digits = String(code || '').replace(/\D/g, '');
    if (digits.length !== 7) return Promise.reject(new Error('7-digit unit required'));
    return loadLtcQrLib().then(function () {
      return QRCode.toDataURL(digits, { errorCorrectionLevel: 'L', margin: 1, width: 120 });
    });
  }

  function updateSamplePanelVisibility(step) {
    const panel = ltcEl('ltc-sample-panel');
    if (panel) panel.style.display = step === 3 ? '' : 'none';
  }

  function refreshZonePropVisibility(zoneType) {
    const alignRows = ltcEl('ltc-zp-align-rows');
    const ecRow = ltcEl('ltc-zp-ec-row');
    if (alignRows) alignRows.style.display = zoneType === 'text' ? '' : 'none';
    if (ecRow) ecRow.style.display = zoneType === 'qr' ? '' : 'none';
  }

  function zoneId(z) { return z.id || z.zone_key; }

  function ensureZoneIds(zones) {
    return (zones || []).map(function (z, i) {
      const copy = Object.assign({}, z);
      if (!copy.id) copy.id = copy.zone_key || 'z_' + i;
      if (!copy.zone_key) copy.zone_key = copy.id;
      return copy;
    });
  }

  function parseZonesField(zones) {
    if (Array.isArray(zones)) return zones;
    if (zones && typeof zones === 'object') return [zones];
    if (typeof zones === 'string' && zones.trim()) {
      try {
        const parsed = JSON.parse(zones);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_e) {
        return [];
      }
    }
    return [];
  }

  function hydrateZonesForFormat(fmt) {
    let zones = ensureZoneIds(parseZonesField(fmt.zones));
    const key = String(fmt.format_key || '').trim();
    if (!zones.length && key && CLIENT_ZONE_PRESETS[key]) {
      zones = ensureZoneIds(JSON.parse(JSON.stringify(CLIENT_ZONE_PRESETS[key])));
    }
    return zones;
  }

  function ensureTemplateReady() {
    if (!template) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Select a template from the list first.');
      return false;
    }
    if (!Array.isArray(template.zones)) template.zones = [];
    return true;
  }

  function requireEditPermission(actionLabel) {
    if (canEdit) return true;
    if (typeof cosmosToastWarn === 'function') {
      cosmosToastWarn('You need label format edit permission to ' + actionLabel + '.');
    }
    return false;
  }

  function formatToTemplate(fmt) {
    return {
      format_key: fmt.format_key,
      template_key: fmt.format_key,
      template_name: fmt.name,
      label_type: fmt.label_type || 'CUSTOM',
      page_width_mm: fmt.page_width_mm != null ? fmt.page_width_mm : (fmt.config && fmt.config.pageWidthMm),
      page_height_mm: fmt.page_height_mm,
      margin_left_mm: fmt.margin_left_mm != null ? fmt.margin_left_mm : (fmt.config && fmt.config.marginLeft) || 0,
      margin_right_mm: fmt.margin_right_mm != null ? fmt.margin_right_mm : (fmt.config && fmt.config.marginRight) || 0,
      margin_top_mm: fmt.margin_top_mm != null ? fmt.margin_top_mm : (fmt.config && fmt.config.marginTop) || 0,
      margin_bottom_mm: fmt.margin_bottom_mm != null ? fmt.margin_bottom_mm : (fmt.config && fmt.config.marginBottom) || 0,
      columns: fmt.columns != null ? fmt.columns : (fmt.config && fmt.config.labelsPerRow) || 1,
      col_gap_mm: fmt.col_gap_mm != null ? fmt.col_gap_mm : (fmt.config && fmt.config.gapCol) || 0,
      row_gap_mm: fmt.row_gap_mm != null ? fmt.row_gap_mm : (fmt.config && fmt.config.gapRow) || 0,
      label_width_mm: fmt.label_width_mm != null ? fmt.label_width_mm : (fmt.config && fmt.config.labelWidthMm) || 15,
      label_height_mm: fmt.label_height_mm != null ? fmt.label_height_mm : (fmt.config && fmt.config.labelHeightMm) || 15,
      config: fmt.config || {},
      zones: hydrateZonesForFormat(fmt)
    };
  }

  function readStep1() {
    if (!template) return;
    template.template_name = ltcEl('ltc-s1-name').value.trim();
    template.label_type = ltcEl('ltc-s1-type').value;
    template.page_width_mm = +ltcEl('ltc-s1-pw').value || 109;
    template.label_width_mm = +ltcEl('ltc-s1-lw').value || 15;
    template.label_height_mm = +ltcEl('ltc-s1-lh').value || 15;
    template.margin_left_mm = +ltcEl('ltc-s1-ml').value || 0;
    template.margin_right_mm = +ltcEl('ltc-s1-mr').value || 0;
  }

  function readStep2() {
    if (!template) return;
    template.columns = +ltcEl('ltc-s2-cols').value || 1;
    template.col_gap_mm = +ltcEl('ltc-s2-cg').value || 0;
    template.row_gap_mm = +ltcEl('ltc-s2-rg').value || 0;
    template.margin_top_mm = +ltcEl('ltc-s2-mt').value || 0;
  }

  function widthProof() {
    const ml = template.margin_left_mm || 0;
    const mr = template.margin_right_mm || 0;
    const cols = template.columns || 1;
    const lw = template.label_width_mm || 15;
    const cg = template.col_gap_mm || 0;
    const pw = template.page_width_mm || 109;
    const total = ml + cols * lw + Math.max(0, cols - 1) * cg + mr;
    return { total: total, pw: pw, ok: Math.abs(total - pw) < 0.5 };
  }

  function updateWidthProof() {
    const el = ltcEl('ltc-width-proof');
    if (!el || !template) return;
    const p = widthProof();
    el.textContent = mlLine(p) + '\n= ' + p.total.toFixed(1) + 'mm ' + (p.ok ? '✓ fits roll' : '⚠ mismatch');
    el.className = 'ltc-proof ' + (p.ok ? 'ok' : 'warn');
  }

  function mlLine(p) {
    const t = template;
    return (t.margin_left_mm || 0) + ' + ' + (t.columns || 1) + '×' + (t.label_width_mm || 15) +
      ' + ' + Math.max(0, (t.columns || 1) - 1) + '×' + (t.col_gap_mm || 0) + ' + ' + (t.margin_right_mm || 0);
  }

  function applyPreset(type) {
    const p = PRESETS[type];
    if (!p || !template) return;
    Object.assign(template, p);
    if (type === 'SQUARE' && CLIENT_ZONE_PRESETS.small_15x15) {
      template.zones = ensureZoneIds(JSON.parse(JSON.stringify(CLIENT_ZONE_PRESETS.small_15x15)));
    }
    if (type === 'STRIP' && !template.zones.length) {
      template.zones = [
        { id: 'zone_qr_sku', zone_key: 'zone_qr_sku', zone_type: 'qr', label: 'Zone 1 — QR', printable: true, x_mm: 0, y_mm: 0, width_mm: 33, height_mm: 12, content: '{unit_id}', font_size_pt: 6, font_weight: '700', writing_mode: 'horizontal', error_level: 'L' },
        { id: 'zone_brand_mrp', zone_key: 'zone_brand_mrp', zone_type: 'text', label: 'Zone 2 — Brand', printable: true, x_mm: 33, y_mm: 0, width_mm: 33, height_mm: 12, content: '{brand}\n{model}\nMRP {mrp}', font_size_pt: 6, font_weight: '700', writing_mode: 'horizontal', error_level: 'L' },
        { id: 'tail', zone_key: 'tail', zone_type: 'tail', label: 'Tail', printable: false, x_mm: 66, y_mm: 0, width_mm: 38, height_mm: 12, content: '' }
      ];
    }
    syncFieldsFromTemplate();
    updateWidthProof();
  }

  function syncFieldsFromTemplate() {
    if (!template) return;
    ltcEl('ltc-s1-name').value = template.template_name || '';
    ltcEl('ltc-s1-type').value = template.label_type || 'SQUARE';
    ltcEl('ltc-s1-pw').value = template.page_width_mm || 109;
    ltcEl('ltc-s1-lw').value = template.label_width_mm || 15;
    ltcEl('ltc-s1-lh').value = template.label_height_mm || 15;
    ltcEl('ltc-s1-ml').value = template.margin_left_mm || 0;
    ltcEl('ltc-s1-mr').value = template.margin_right_mm || 0;
    ltcEl('ltc-s2-cols').value = template.columns || 1;
    ltcEl('ltc-s2-cg').value = template.col_gap_mm || 0;
    ltcEl('ltc-s2-rg').value = template.row_gap_mm || 0;
    ltcEl('ltc-s2-mt').value = template.margin_top_mm || 0;
  }

  function normalizeFormatsList(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.formats)) return data.formats;
    return [];
  }

  async function fetchFormatsList() {
    try {
      const data = await ltcApi('GET', '/api/foundry/label-print-formats');
      return normalizeFormatsList(data);
    } catch (foundryErr) {
      try {
        const meta = await ltcApi('GET', '/api/meta/label-print-formats');
        return normalizeFormatsList(meta);
      } catch (metaErr) {
        const err = new Error(foundryErr.message || 'Could not load label templates');
        err.statusCode = foundryErr.statusCode || metaErr.statusCode;
        throw err;
      }
    }
  }

  function showDesignerLoadBanner(message) {
    const canvas = ltcEl('ltc-label-canvas');
    if (!canvas) return;
    let banner = ltcEl('ltc-load-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'ltc-load-banner';
      banner.className = 'ltc-load-banner';
      canvas.appendChild(banner);
    }
    banner.innerHTML =
      '<div style="font-size:14px;font-weight:600;color:var(--text1);margin-bottom:8px">Could not load templates</div>' +
      '<div style="font-size:13px;color:var(--text2);margin-bottom:14px">' + escapeHtml(message || 'Resource not found') + '</div>' +
      '<button type="button" class="topbar-btn primary" id="ltc-retry-load">Retry</button>';
    const retry = ltcEl('ltc-retry-load');
    if (retry) {
      retry.addEventListener('click', function () {
        window.initLabelTemplateConfigurator({ canEdit: canEdit });
      });
    }
  }

  function clearDesignerLoadBanner() {
    const banner = ltcEl('ltc-load-banner');
    if (banner) banner.remove();
  }

  function goStep(n) {
    if (n < 1 || n > 3) return;
    if (n === 3 && !template) {
      if (!formatsList.length && loadError) {
        currentStep = 3;
        document.querySelectorAll('.ltc-step-panel').forEach(function (p) { p.classList.remove('active'); });
        document.querySelectorAll('.ltc-step').forEach(function (s, i) {
          s.classList.remove('active', 'done');
          if (i + 1 === 3) s.classList.add('active');
          else if (i + 1 < 3) s.classList.add('done');
        });
        const designer = ltcEl('ltc-designer');
        ltcEl('ltc-step-panels').style.display = 'none';
        if (designer) designer.classList.add('active');
        ltcEl('ltc-next-btn').style.display = 'none';
        ltcEl('ltc-save-btn').style.display = 'none';
        ltcEl('ltc-step-label').textContent = 'Step 3 of 3';
        showDesignerLoadBanner(loadError);
        return;
      }
      if (typeof cosmosToastWarn === 'function') {
        cosmosToastWarn(loadError || 'Select or create a template first.');
      }
      return goStep(1);
    }
    if (n > 1) readStep1();
    if (n > 2) readStep2();
    currentStep = n;
    document.querySelectorAll('.ltc-step-panel').forEach(function (p) { p.classList.remove('active'); });
    document.querySelectorAll('.ltc-step').forEach(function (s, i) {
      s.classList.remove('active', 'done');
      if (i + 1 === n) s.classList.add('active');
      else if (i + 1 < n) s.classList.add('done');
    });
    const designer = ltcEl('ltc-designer');
    if (n === 3) {
      ltcEl('ltc-step-panels').style.display = 'none';
      if (designer) designer.classList.add('active');
      clearDesignerLoadBanner();
      renderCanvas();
      renderZoneList();
      renderTspl();
    } else {
      if (designer) designer.classList.remove('active');
      ltcEl('ltc-step-panels').style.display = '';
      ltcEl('ltc-panel-' + n).classList.add('active');
      if (n === 1) updateWidthProof();
      if (n === 2) updateGridPreview();
    }
    ltcEl('ltc-next-btn').style.display = n < 3 ? '' : 'none';
    ltcEl('ltc-save-btn').style.display = n === 3 && canEdit ? '' : 'none';
    ltcEl('ltc-step-label').textContent = 'Step ' + n + ' of 3';
    updateSamplePanelVisibility(n);
  }

  function updateGridPreview() {
    readStep1();
    readStep2();
    updateWidthProof();
    const svg = ltcEl('ltc-grid-svg');
    if (!svg || !template) return;
    const pw = template.page_width_mm || 109;
    const lw = template.label_width_mm || 15;
    const lh = template.label_height_mm || 15;
    const cols = Math.min(template.columns || 1, 8);
    const cg = template.col_gap_mm || 0;
    const rg = template.row_gap_mm || 0;
    const mt = template.margin_top_mm || 0;
    const ml = template.margin_left_mm || 0;
    const W = 300;
    const H = 120;
    const sc = Math.min((W - 20) / pw, (H - 20) / (lh * 2 + rg + mt + 4));
    let html = '<rect width="' + W + '" height="' + H + '" fill="var(--bg)" rx="4"/>';
    html += '<rect x="10" y="10" width="' + (pw * sc) + '" height="' + (H - 20) + '" fill="var(--card)" stroke="var(--border)" stroke-dasharray="3,3"/>';
    for (let r = 0; r < 2; r++) {
      const y = 10 + (mt + r * (lh + rg)) * sc;
      for (let c = 0; c < cols; c++) {
        const x = 10 + (ml + c * (lw + cg)) * sc;
        html += '<rect x="' + x + '" y="' + y + '" width="' + (lw * sc) + '" height="' + (lh * sc) + '" fill="#fff" stroke="' + (c === 0 ? 'var(--acc)' : 'var(--border)') + '"/>';
      }
    }
    svg.innerHTML = html;
  }

  function renderCanvas() {
    const canvas = ltcEl('ltc-label-canvas');
    if (!canvas || !template) return;
    const lw = template.label_width_mm;
    const lh = template.label_height_mm;
    canvas.style.width = lw + 'mm';
    canvas.style.height = lh + 'mm';
    canvas.style.transform = 'scale(' + scale + ')';
    canvas.style.transformOrigin = 'top left';
    canvas.querySelectorAll('.ltc-cz').forEach(function (el) { el.remove(); });
    template.zones.forEach(function (zone) {
      const el = document.createElement('div');
      el.className = 'ltc-cz ' + zone.zone_type + (selectedZoneId === zoneId(zone) ? ' selected' : '');
      el.id = 'ltc-cz-' + zoneId(zone);
      el.style.left = zone.x_mm + 'mm';
      el.style.top = zone.y_mm + 'mm';
      el.style.width = zone.width_mm + 'mm';
      el.style.height = zone.height_mm + 'mm';
      const inner = document.createElement('div');
      inner.className = 'ltc-cz-inner';
      const alignApi = ltcAlign();
      if (alignApi && zone.zone_type === 'text') {
        inner.setAttribute('style', alignApi.zoneAlignCss(zone));
      } else {
        inner.setAttribute('style', 'display:flex;width:100%;height:100%;align-items:center;justify-content:center;');
      }
      if (zone.zone_type === 'qr') {
        const qrCode = applyTokens(zone.content || '{unit_id}');
        const ph = document.createElement('div');
        ph.className = 'ltc-cz-qr-ph';
        ph.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--acc2);';
        ph.textContent = qrCode;
        inner.appendChild(ph);
        ltcQrDataUrl(qrCode).then(function (url) {
          if (!ltcEl('ltc-cz-' + zoneId(zone))) return;
          ph.innerHTML = '';
          const img = document.createElement('img');
          img.className = 'ltc-cz-qr-img';
          img.alt = 'Sample QR ' + qrCode;
          img.src = url;
          ph.appendChild(img);
        }).catch(function () { /* keep numeric fallback */ });
      } else if (zone.zone_type === 'tail') {
        inner.textContent = '···';
        inner.style.opacity = '0.5';
      } else {
        const preview = document.createElement('span');
        preview.className = 'mono';
        const alignApiText = ltcAlign();
        if (alignApiText && alignApiText.zonePreviewTextStyle) {
          preview.setAttribute('style', alignApiText.zonePreviewTextStyle(zone));
        } else {
          preview.style.fontSize = (zone.font_size_pt || 8) + 'pt';
          preview.style.fontWeight = zone.font_weight || '700';
          preview.style.lineHeight = '1.15';
          preview.style.whiteSpace = 'pre-wrap';
          preview.style.wordBreak = 'break-word';
          preview.style.maxWidth = '100%';
          if (zone.writing_mode === 'vertical') preview.style.writingMode = 'vertical-rl';
        }
        preview.textContent = applyTokens(zone.content || '');
        inner.appendChild(preview);
      }
      el.appendChild(inner);
      if (zone.zone_type !== 'tail') {
        const rh = document.createElement('div');
        rh.className = 'ltc-resize';
        rh.addEventListener('mousedown', function (e) { startResize(e, zoneId(zone)); });
        el.appendChild(rh);
      }
      el.addEventListener('mousedown', function (e) {
        if (e.target.classList.contains('ltc-resize')) return;
        selectZone(zoneId(zone));
        startDrag(e, zoneId(zone));
      });
      canvas.appendChild(el);
    });
    const scaleEl = ltcEl('ltc-scale-info');
    if (scaleEl) scaleEl.textContent = 'Scale: ' + scale + ' px/mm';
    renderTspl();
  }

  function selectZone(id) {
    if (!ensureTemplateReady()) return;
    selectedZoneId = id;
    const zone = template.zones.find(function (z) { return zoneId(z) === id; });
    const props = ltcEl('ltc-zone-props');
    if (!zone || !props) return;
    props.classList.add('open');
    props.style.display = 'block';
    ltcEl('ltc-zp-name').value = zone.label;
    ltcEl('ltc-zp-type').value = zone.zone_type;
    ltcEl('ltc-zp-content').value = zone.content || '';
    ltcEl('ltc-zp-x').value = zone.x_mm;
    ltcEl('ltc-zp-y').value = zone.y_mm;
    ltcEl('ltc-zp-w').value = zone.width_mm;
    ltcEl('ltc-zp-h').value = zone.height_mm;
    ltcEl('ltc-zp-fs').value = zone.font_size_pt || 8;
    ltcEl('ltc-zp-fw').value = zone.font_weight || '700';
    ltcEl('ltc-zp-wm').value = zone.writing_mode || 'horizontal';
    ltcEl('ltc-zp-tah').value = zone.text_align_h || 'left';
    ltcEl('ltc-zp-tav').value = zone.text_align_v || 'top';
    ltcEl('ltc-zp-ec').value = zone.error_level || 'L';
    refreshZonePropVisibility(zone.zone_type);
    renderZoneList();
    renderCanvas();
    try {
      props.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (_e) { /* ignore */ }
  }

  function handleAddZone() {
    if (!requireEditPermission('add zones')) return;
    if (!ensureTemplateReady()) return;
    const id = 'z_' + Date.now();
    template.zones.push({
      id: id,
      zone_key: id,
      zone_type: 'text',
      label: 'New zone',
      printable: true,
      x_mm: 1,
      y_mm: 1,
      width_mm: Math.min(8, template.label_width_mm || 15),
      height_mm: Math.min(8, template.label_height_mm || 15),
      content: '{unit_id}',
      font_size_pt: 8,
      font_weight: '700',
      writing_mode: 'horizontal',
      text_align_h: 'left',
      text_align_v: 'top',
      error_level: 'L'
    });
    renderCanvas();
    renderZoneList();
    selectZone(id);
    if (currentStep !== 3) goStep(3);
  }

  function handleDeleteZone() {
    if (!requireEditPermission('delete zones')) return;
    if (!ensureTemplateReady() || !selectedZoneId) return;
    template.zones = template.zones.filter(function (z) { return zoneId(z) !== selectedZoneId; });
    selectedZoneId = null;
    const props = ltcEl('ltc-zone-props');
    if (props) {
      props.classList.remove('open');
      props.style.display = 'none';
    }
    renderCanvas();
    renderZoneList();
    renderTspl();
  }

  function updateSelectedZoneFromForm() {
    if (!selectedZoneId) return;
    const zone = template.zones.find(function (z) { return zoneId(z) === selectedZoneId; });
    if (!zone) return;
    zone.label = ltcEl('ltc-zp-name').value;
    zone.zone_type = ltcEl('ltc-zp-type').value;
    zone.content = ltcEl('ltc-zp-content').value;
    zone.font_size_pt = +ltcEl('ltc-zp-fs').value;
    zone.font_weight = ltcEl('ltc-zp-fw').value;
    zone.writing_mode = ltcEl('ltc-zp-wm').value;
    zone.text_align_h = ltcEl('ltc-zp-tah').value;
    zone.text_align_v = ltcEl('ltc-zp-tav').value;
    zone.error_level = ltcEl('ltc-zp-ec').value;
    zone.printable = zone.zone_type !== 'tail';
    refreshZonePropVisibility(zone.zone_type);
    syncZoneFromProps();
    renderZoneList();
    renderCanvas();
    renderTspl();
  }

  function syncZoneFromProps() {
    if (!selectedZoneId) return;
    const zone = template.zones.find(function (z) { return zoneId(z) === selectedZoneId; });
    if (!zone) return;
    zone.x_mm = +ltcEl('ltc-zp-x').value;
    zone.y_mm = +ltcEl('ltc-zp-y').value;
    zone.width_mm = +ltcEl('ltc-zp-w').value;
    zone.height_mm = +ltcEl('ltc-zp-h').value;
    renderCanvas();
  }

  function startDrag(e, id) {
    e.preventDefault();
    const zone = template.zones.find(function (z) { return zoneId(z) === id; });
    const el = ltcEl('ltc-cz-' + id);
    const offX = e.clientX - el.getBoundingClientRect().left;
    const offY = e.clientY - el.getBoundingClientRect().top;
    function onMove(ev) {
      const canvas = ltcEl('ltc-label-canvas');
      const rect = canvas.getBoundingClientRect();
      const pxPerMmX = rect.width / template.label_width_mm;
      const pxPerMmY = rect.height / template.label_height_mm;
      let x = (ev.clientX - rect.left - offX) / pxPerMmX;
      let y = (ev.clientY - rect.top - offY) / pxPerMmY;
      x = Math.max(0, Math.min(template.label_width_mm - zone.width_mm, +x.toFixed(1)));
      y = Math.max(0, Math.min(template.label_height_mm - zone.height_mm, +y.toFixed(1)));
      zone.x_mm = x;
      zone.y_mm = y;
      ltcEl('ltc-zp-x').value = x;
      ltcEl('ltc-zp-y').value = y;
      renderCanvas();
      renderZoneList();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function startResize(e, id) {
    e.preventDefault();
    e.stopPropagation();
    const zone = template.zones.find(function (z) { return zoneId(z) === id; });
    const sx = e.clientX;
    const sy = e.clientY;
    const sw = zone.width_mm;
    const sh = zone.height_mm;
    function onMove(ev) {
      zone.width_mm = Math.max(1, +(sw + (ev.clientX - sx) / scale).toFixed(1));
      zone.height_mm = Math.max(1, +(sh + (ev.clientY - sy) / scale).toFixed(1));
      ltcEl('ltc-zp-w').value = zone.width_mm;
      ltcEl('ltc-zp-h').value = zone.height_mm;
      renderCanvas();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function renderZoneList() {
    const list = ltcEl('ltc-zone-list');
    if (!list || !template) return;
    list.innerHTML = template.zones.map(function (z) {
      const id = zoneId(z);
      return '<div class="ltc-zone-item' + (selectedZoneId === id ? ' selected' : '') + '" data-id="' + id + '">' +
        '<div style="font-weight:600;font-size:12px">' + escapeHtml(z.label) + ' <span style="color:var(--text3);font-size:10px">' + z.zone_type + '</span></div>' +
        '<div style="font-size:10px;color:var(--text3);font-family:monospace">' + z.x_mm + ',' + z.y_mm + ' → ' + z.width_mm + '×' + z.height_mm + 'mm</div></div>';
    }).join('');
    list.querySelectorAll('.ltc-zone-item').forEach(function (el) {
      el.addEventListener('click', function () { selectZone(el.getAttribute('data-id')); });
    });
  }

  function generateTsplLines() {
    if (!template) return '';
    const D = (template.config && template.config.dotsPerMm) || 8;
    const cell = (template.config && template.config.qrCellSize) || 3;
    const fontId = (template.config && template.config.textFontId) != null ? template.config.textFontId : 1;
    const xMul = (template.config && template.config.textXMul) || 1;
    const yMul = (template.config && template.config.textYMul) || 1;
    const lines = [];
    lines.push('SIZE ' + template.label_width_mm + ' mm, ' + template.label_height_mm + ' mm');
    lines.push('GAP ' + (template.row_gap_mm || 0) + ' mm, 0 mm');
    lines.push('DIRECTION 1');
    lines.push('CLS');
    template.zones.forEach(function (z) {
      if (!z.printable || z.zone_type === 'tail') return;
      const xd = Math.round(z.x_mm * D) + 1;
      const yd = Math.round(z.y_mm * D) + 1;
      if (z.zone_type === 'qr') {
        const qrRaw = applyTokens(z.content || '{unit_id}').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        lines.push('QRCODE ' + xd + ',' + yd + ',' + (z.error_level || 'L') + ',' + cell + ',A,0,"' + qrRaw + '"');
      } else if (z.zone_type === 'text') {
        const alignApi = ltcAlign();
        const raw = applyTokens(z.content || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        if (alignApi) {
          lines.push(alignApi.zoneTextTsplLine(z, xd, yd, D, fontId, xMul, yMul, raw));
        } else {
          const rot = z.writing_mode === 'vertical' ? 270 : 0;
          lines.push('TEXT ' + xd + ',' + yd + ',"' + fontId + '",' + rot + ',' + xMul + ',' + yMul + ',"' + raw + '"');
        }
      }
    });
    lines.push('PRINT 1,1');
    return lines.join('\r\n');
  }

  function renderTspl() {
    const pre = ltcEl('ltc-tspl-output');
    if (pre) pre.textContent = generateTsplLines();
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function sanitizeLabelConfig(raw) {
    const out = { v: 1 };
    const src = raw || {};
    LTC_CONFIG_KEYS.forEach(function (k) {
      if (src[k] !== undefined && src[k] !== null) out[k] = src[k];
    });
    return out;
  }

  async function loadContentTokenCatalog() {
    if (contentTokensCatalog && contentPresetsCatalog) return;
    const api = ltcAlign();
    try {
      const data = await ltcApi('GET', '/api/meta/label-zone-content-tokens');
      contentTokensCatalog = (data && data.tokens) || (api && api.ZONE_CONTENT_TOKENS) || [];
      contentPresetsCatalog = (data && data.presets) || (api && api.ZONE_CONTENT_PRESETS) || [];
    } catch (_e) {
      contentTokensCatalog = (api && api.ZONE_CONTENT_TOKENS) || [];
      contentPresetsCatalog = (api && api.ZONE_CONTENT_PRESETS) || [];
    }
    renderContentLinkUi();
  }

  function insertContentToken(tokenKey) {
    const input = ltcEl('ltc-zp-content');
    if (!input || !tokenKey) return;
    const token = '{' + tokenKey + '}';
    const start = input.selectionStart != null ? input.selectionStart : input.value.length;
    const end = input.selectionEnd != null ? input.selectionEnd : start;
    const before = input.value.slice(0, start);
    const after = input.value.slice(end);
    input.value = before + token + after;
    input.focus();
    const pos = start + token.length;
    try {
      input.setSelectionRange(pos, pos);
    } catch (_e) { /* ignore */ }
    updateSelectedZoneFromForm();
  }

  function applyContentPreset(content) {
    const input = ltcEl('ltc-zp-content');
    if (!input) return;
    input.value = content;
    updateSelectedZoneFromForm();
  }

  function renderContentLinkUi() {
    const tokensWrap = ltcEl('ltc-content-insert');
    const presetsWrap = ltcEl('ltc-content-presets');
    if (!tokensWrap || !contentTokensCatalog) return;
    tokensWrap.innerHTML = contentTokensCatalog.map(function (t) {
      return '<button type="button" class="ltc-token-btn" data-token="' + escapeHtml(t.key) + '" title="' +
        escapeHtml(t.description || t.label) + '">{' + escapeHtml(t.key) + '}</button>';
    }).join('');
    tokensWrap.querySelectorAll('.ltc-token-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        insertContentToken(btn.getAttribute('data-token'));
      });
    });
    if (presetsWrap && contentPresetsCatalog) {
      presetsWrap.innerHTML = contentPresetsCatalog.map(function (p, idx) {
        return '<button type="button" class="ltc-preset-btn" data-preset-idx="' + idx + '" title="' +
          escapeHtml(String(p.content || '').replace(/\n/g, ' / ')) + '">' + escapeHtml(p.label) + '</button>';
      }).join('');
      presetsWrap.querySelectorAll('.ltc-preset-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          const idx = parseInt(btn.getAttribute('data-preset-idx'), 10);
          const p = contentPresetsCatalog[idx];
          if (p) applyContentPreset(p.content);
        });
      });
    }
  }

  function buildSavePayload() {
    readStep1();
    readStep2();
    const zones = template.zones.map(function (z) {
      return {
        zone_key: z.zone_key || z.id,
        zone_type: z.zone_type,
        label: z.label,
        printable: z.zone_type !== 'tail' && z.printable !== false,
        x_mm: z.x_mm,
        y_mm: z.y_mm,
        width_mm: z.width_mm,
        height_mm: z.height_mm,
        content: z.content || '',
        font_size_pt: z.font_size_pt,
        font_weight: z.font_weight,
        writing_mode: z.writing_mode,
        text_align_h: z.text_align_h || 'left',
        text_align_v: z.text_align_v || 'top',
        error_level: z.error_level,
        background: 'transparent',
        border_top: !!z.border_top
      };
    });
    const labelType = template.label_type || 'SQUARE';
    const cfg = sanitizeLabelConfig(Object.assign({}, template.config || {}, {
      labelWidthMm: template.label_width_mm,
      labelHeightMm: template.label_height_mm,
      labelsPerRow: template.columns,
      gapCol: template.col_gap_mm,
      gapRow: template.row_gap_mm,
      marginLeft: template.margin_left_mm,
      marginRight: template.margin_right_mm,
      marginTop: template.margin_top_mm,
      marginBottom: template.margin_bottom_mm,
      layoutType: labelType === 'STRIP' ? 'strip' : 'compact'
    }));
    return {
      name: template.template_name,
      description: null,
      config: cfg,
      label_type: labelType,
      page_width_mm: template.page_width_mm,
      margin_left_mm: template.margin_left_mm,
      margin_right_mm: template.margin_right_mm,
      margin_top_mm: template.margin_top_mm,
      margin_bottom_mm: template.margin_bottom_mm,
      columns: template.columns,
      col_gap_mm: template.col_gap_mm,
      row_gap_mm: template.row_gap_mm,
      label_width_mm: template.label_width_mm,
      label_height_mm: template.label_height_mm,
      zones: zones
    };
  }

  async function saveTemplate() {
    if (!canEdit || !template) return;
    const p = widthProof();
    if (!p.ok) {
      if (typeof cosmosToastWarn === 'function') cosmosToastWarn('Page width proof failed — adjust margins, columns, or label width.');
      return;
    }
    const btn = ltcEl('ltc-save-btn');
    if (typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      await ltcApi('PUT', '/api/foundry/label-print-formats/' + encodeURIComponent(template.format_key), buildSavePayload());
      if (typeof cosmosToastSuccess === 'function') {
        cosmosToastSuccess('Template saved. Reopen Foundry → Print labels and choose this template to print with the same zones.');
      }
      await loadFormatsList();
      await loadTemplate(template.format_key);
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    } finally {
      if (typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
    }
  }

  async function createTemplate() {
    if (!canEdit) return;
    const name = window.prompt('Template name');
    if (!name || !name.trim()) return;
    try {
      const row = await ltcApi('POST', '/api/foundry/label-print-formats', {
        name: name.trim(),
        config: { v: 1, dotsPerMm: 8, qrCellSize: 3, textFontId: 1, textXMul: 1, textYMul: 1, layoutType: 'compact' },
        label_type: 'SQUARE',
        page_width_mm: 109,
        columns: 6,
        col_gap_mm: 3,
        row_gap_mm: 3,
        margin_left_mm: 2,
        margin_right_mm: 2,
        margin_top_mm: 2,
        label_width_mm: 15,
        label_height_mm: 15,
        zones: [
          { zone_key: 'qr', zone_type: 'qr', label: 'QR', printable: true, x_mm: 0, y_mm: 0, width_mm: 10, height_mm: 10, content: '{unit_id}', font_size_pt: 8, font_weight: '700', writing_mode: 'horizontal', error_level: 'L', background: 'transparent', border_top: false }
        ]
      });
      await loadFormatsList();
      await loadTemplate(row.format_key);
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Template created');
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    }
  }

  async function deleteTemplate() {
    if (!canEdit || !template) return;
    if (!window.confirm('Permanently delete template "' + template.template_name + '"?')) return;
    try {
      await ltcApi('DELETE', '/api/foundry/label-print-formats/' + encodeURIComponent(template.format_key));
      if (typeof cosmosToastSuccess === 'function') cosmosToastSuccess('Template deleted');
      template = null;
      await loadFormatsList();
      if (formatsList.length) await loadTemplate(formatsList[0].format_key);
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    }
  }

  function renderTemplateList() {
    const wrap = ltcEl('ltc-tpl-list');
    if (!wrap) return;
    if (!formatsList.length) {
      wrap.innerHTML =
        '<div style="padding:12px;text-align:center">' +
        '<div style="font-size:13px;font-weight:600;color:var(--text1);margin-bottom:6px">No templates</div>' +
        '<div style="font-size:12px;color:var(--text2);margin-bottom:12px">' +
        escapeHtml(loadError || 'Nothing loaded from the server.') +
        '</div>' +
        '<button type="button" class="topbar-btn primary" id="ltc-retry-list" style="width:100%">Retry</button>' +
        '</div>';
      const retryBtn = ltcEl('ltc-retry-list');
      if (retryBtn) {
        retryBtn.addEventListener('click', function () {
          window.initLabelTemplateConfigurator({ canEdit: canEdit });
        });
      }
      return;
    }
    wrap.innerHTML = formatsList.map(function (f) {
      const active = template && template.format_key === f.format_key;
      return '<button type="button" class="ltc-tpl-btn' + (active ? ' active' : '') + '" data-key="' + escapeHtml(f.format_key) + '">' + escapeHtml(f.name) + '</button>';
    }).join('');
    wrap.querySelectorAll('.ltc-tpl-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { loadTemplate(btn.getAttribute('data-key')); });
    });
  }

  async function loadTemplate(key) {
    try {
      let fmt = null;
      try {
        fmt = await ltcApi('GET', '/api/foundry/label-print-formats/' + encodeURIComponent(key));
      } catch (detailErr) {
        fmt = formatsList.find(function (f) { return f.format_key === key; }) || null;
        if (!fmt) throw detailErr;
      }
      template = formatToTemplate(fmt);
      loadError = null;
      syncFieldsFromTemplate();
      selectedZoneId = null;
      const props = ltcEl('ltc-zone-props');
      if (props) {
        props.classList.remove('open');
        props.style.display = 'none';
      }
      renderTemplateList();
      goStep(currentStep);
      if (currentStep === 3 && template.zones.length) {
        renderCanvas();
        renderZoneList();
        renderTspl();
      }
    } catch (err) {
      if (typeof cosmosToastError === 'function') cosmosToastError(err.message);
    }
  }

  async function loadFormatsList() {
    const listEl = ltcEl('ltc-tpl-list');
    if (listEl && typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('ltc-tpl-list', 4);
    loadError = null;
    try {
      formatsList = await fetchFormatsList();
      renderTemplateList();
    } catch (err) {
      loadError = err.message || 'Could not load label templates';
      formatsList = [];
      renderTemplateList();
      if (typeof cosmosToastError === 'function') cosmosToastError(loadError);
    }
  }

  function safeOn(el, event, handler) {
    if (el) el.addEventListener(event, handler);
  }

  function wireEvents() {
    const root = ltcEl('ltc-root');
    if (!root || root.dataset.ltcWired === '1') return;
    root.dataset.ltcWired = '1';

    root.addEventListener('click', function (e) {
      if (e.target.closest('#ltc-add-zone')) {
        e.preventDefault();
        handleAddZone();
        return;
      }
      if (e.target.closest('#ltc-del-zone')) {
        e.preventDefault();
        handleDeleteZone();
        return;
      }
      if (e.target.closest('#ltc-next-btn')) {
        e.preventDefault();
        goStep(currentStep + 1);
        return;
      }
      if (e.target.closest('#ltc-prev-btn')) {
        e.preventDefault();
        goStep(currentStep - 1);
        return;
      }
      if (e.target.closest('#ltc-save-btn')) {
        e.preventDefault();
        saveTemplate();
        return;
      }
      if (e.target.closest('#ltc-create-btn')) {
        e.preventDefault();
        createTemplate();
        return;
      }
      if (e.target.closest('#ltc-delete-btn')) {
        e.preventDefault();
        deleteTemplate();
        return;
      }
      if (e.target.closest('#ltc-copy-tspl')) {
        e.preventDefault();
        navigator.clipboard.writeText(generateTsplLines()).then(function () {
          if (typeof cosmosToastInfo === 'function') cosmosToastInfo('TSPL copied');
        });
        return;
      }
      if (e.target.closest('#ltc-zoom-in')) {
        e.preventDefault();
        scale = Math.min(+(scale + 0.25).toFixed(2), 5);
        renderCanvas();
        return;
      }
      if (e.target.closest('#ltc-zoom-out')) {
        e.preventDefault();
        scale = Math.max(+(scale - 0.25).toFixed(2), 0.5);
        renderCanvas();
        return;
      }
      const stepEl = e.target.closest('.ltc-step');
      if (stepEl && root.contains(stepEl)) {
        const step = parseInt(stepEl.getAttribute('data-step'), 10);
        if (step >= 1 && step <= 3) goStep(step);
      }
    });

    safeOn(ltcEl('ltc-s1-type'), 'change', function () {
      applyPreset(ltcEl('ltc-s1-type').value);
    });
    ['ltc-s1-pw', 'ltc-s1-lw', 'ltc-s1-lh', 'ltc-s1-ml', 'ltc-s1-mr', 'ltc-s2-cols', 'ltc-s2-cg'].forEach(function (id) {
      safeOn(ltcEl(id), 'input', updateWidthProof);
    });
    ['ltc-zp-name', 'ltc-zp-type', 'ltc-zp-content', 'ltc-zp-fs', 'ltc-zp-fw', 'ltc-zp-wm', 'ltc-zp-tah', 'ltc-zp-tav', 'ltc-zp-ec'].forEach(function (id) {
      safeOn(ltcEl(id), 'change', updateSelectedZoneFromForm);
    });
    ['ltc-zp-x', 'ltc-zp-y', 'ltc-zp-w', 'ltc-zp-h'].forEach(function (id) {
      safeOn(ltcEl(id), 'input', syncZoneFromProps);
    });
    ['ltc-sample-unit', 'ltc-sample-sku', 'ltc-sample-brand', 'ltc-sample-model', 'ltc-sample-mrp'].forEach(function (id) {
      safeOn(ltcEl(id), 'input', function () {
        readSampleFromPanel();
        if (currentStep === 3) {
          renderCanvas();
          renderTspl();
        }
      });
    });
    safeOn(ltcEl('ltc-sample-reset'), 'click', function (e) {
      e.preventDefault();
      resetSampleData();
    });
  }

  let ltcEventsWired = false;

  window.initLabelTemplateConfigurator = async function (opts) {
    opts = opts || {};
    canEdit = !!opts.canEdit;
    const createBtn = ltcEl('ltc-create-btn');
    const deleteBtn = ltcEl('ltc-delete-btn');
    const saveBtn = ltcEl('ltc-save-btn');
    if (createBtn) createBtn.style.display = canEdit ? '' : 'none';
    if (deleteBtn) deleteBtn.style.display = canEdit ? '' : 'none';
    if (saveBtn) saveBtn.style.display = canEdit ? '' : 'none';
    const addZoneBtn = ltcEl('ltc-add-zone');
    if (addZoneBtn) {
      addZoneBtn.disabled = !canEdit;
      addZoneBtn.title = canEdit ? 'Add a print zone to this template' : 'Requires label format edit permission';
    }
    const delZoneBtn = ltcEl('ltc-del-zone');
    if (delZoneBtn) delZoneBtn.disabled = !canEdit;
    wireEvents();
    ltcEventsWired = true;
    clearDesignerLoadBanner();
    sampleItem = ltcDefaultSample();
    writeSampleToPanel();
    await loadContentTokenCatalog();
    await loadFormatsList();
    if (formatsList.length) {
      await loadTemplate(formatsList[0].format_key);
      goStep(1);
    } else if (loadError) {
      template = null;
      goStep(3);
    } else {
      goStep(1);
    }
  };
})();
