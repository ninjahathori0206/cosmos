'use strict';

const Joi = require('joi');

/** Canonical layout fields (server JSON). USB offset is browser-local only. */
const LABEL_PRINT_FORMAT_FIELDS = Object.freeze([
  { configKey: 'marginTop', inputId: 'bc-margin-top', type: 'float', default: 0, min: 0, max: 60 },
  { configKey: 'marginBottom', inputId: 'bc-margin-bottom', type: 'float', default: 0, min: 0, max: 60 },
  { configKey: 'marginLeft', inputId: 'bc-margin-left', type: 'float', default: 0, min: 0, max: 60 },
  { configKey: 'marginRight', inputId: 'bc-margin-right', type: 'float', default: 0, min: 0, max: 60 },
  { configKey: 'gapRow', inputId: 'bc-gap-row', type: 'float', default: 0, min: 0, max: 30 },
  { configKey: 'gapCol', inputId: 'bc-gap-col', type: 'float', default: 0, min: 0, max: 30 },
  { configKey: 'labelWidthMm', inputId: 'bc-label-width', type: 'float', default: 40, min: 1, max: 200 },
  { configKey: 'labelHeightMm', inputId: 'bc-label-height', type: 'float', default: 28, min: 1, max: 200 },
  { configKey: 'labelsPerRow', inputId: 'bc-labels-per-row', type: 'int', default: 1, min: 1, max: 40 },
  { configKey: 'dotsPerMm', inputId: 'bc-dots-per-mm', type: 'float', default: 8, min: 1, max: 40 },
  { configKey: 'qrCellSize', inputId: 'bc-qr-cell-size', type: 'int', default: 4, min: 1, max: 10 },
  { configKey: 'qrVisualSizeMm', inputId: 'bc-qr-visual-size-mm', type: 'float', default: 14, min: 1, max: 50 },
  { configKey: 'qrTopRatio', inputId: 'bc-qr-top-ratio', type: 'float', default: 0, min: 0, max: 1 },
  { configKey: 'textTopRatio', inputId: 'bc-text-top-ratio', type: 'float', default: 0.72, min: 0, max: 1 },
  { configKey: 'textXMul', inputId: 'bc-text-x-mul', type: 'int', default: 2, min: 1, max: 10 },
  { configKey: 'textYMul', inputId: 'bc-text-y-mul', type: 'int', default: 2, min: 1, max: 10 },
  { configKey: 'textFontId', inputId: 'bc-text-font-id', type: 'int', default: 2, min: 0, max: 3 },
  { configKey: 'textFontPt', inputId: 'bc-text-font-pt', type: 'float', default: 5, min: 0.5, max: 20 },
  { configKey: 'layoutType', inputId: null, type: 'string', default: 'grid' },
  { configKey: 'printOrientation', inputId: null, type: 'string', default: 'portrait' },
  { configKey: 'printWidthMm', inputId: null, type: 'float', default: 0, min: 0, max: 200 },
  { configKey: 'zone1WidthMm', inputId: null, type: 'float', default: 33, min: 1, max: 100 },
  { configKey: 'zone2WidthMm', inputId: null, type: 'float', default: 33, min: 1, max: 100 },
  { configKey: 'tailWidthMm', inputId: null, type: 'float', default: 34, min: 0, max: 100 },
  { configKey: 'bottomBandHeightMm', inputId: null, type: 'float', default: 4, min: 1, max: 20 },
  { configKey: 'rightRailWidthMm', inputId: null, type: 'float', default: 3.5, min: 1, max: 20 },
  { configKey: 'pageWidthMm', inputId: null, type: 'float', default: 0, min: 0, max: 300 }
]);

const FORMAT_KEY_RE = /^[a-z][a-z0-9_]{0,48}$/;

/** USB TSPL print orientation — BarTender Page Setup equivalent (not browser Portrait/Landscape). */
const PRINT_ORIENTATION_CATALOG = Object.freeze([
  { key: 'portrait', label: 'Portrait', tsplDirection: 0, description: 'Default — wide roll row, content top-left (BarTender Portrait)' },
  { key: 'portrait_180', label: 'Portrait 180°', tsplDirection: 1, description: 'BarTender Portrait 180°' },
  { key: 'landscape', label: 'Landscape', tsplDirection: 0, description: 'Strip / alternate roll layouts' },
  { key: 'landscape_180', label: 'Landscape 180°', tsplDirection: 1, description: 'Landscape rotated 180°' }
]);

const PRINT_ORIENTATION_KEYS = PRINT_ORIENTATION_CATALOG.map((o) => o.key);
const DEFAULT_PRINT_ORIENTATION = 'portrait';

function normalizePrintOrientation(value) {
  const s = String(value == null ? '' : value).trim().toLowerCase();
  return PRINT_ORIENTATION_KEYS.includes(s) ? s : DEFAULT_PRINT_ORIENTATION;
}

function tsplDirectionFromPrintOrientation(value) {
  const key = normalizePrintOrientation(value);
  const row = PRINT_ORIENTATION_CATALOG.find((o) => o.key === key);
  return row ? row.tsplDirection : 0;
}

function printOrientationLabel(value) {
  const key = normalizePrintOrientation(value);
  const row = PRINT_ORIENTATION_CATALOG.find((o) => o.key === key);
  return row ? row.label : 'Portrait';
}

function clampField(field, value) {
  if (field.type === 'string') {
    const s = String(value == null ? '' : value).trim().toLowerCase();
    if (field.configKey === 'layoutType') {
      const allowed = ['grid', 'strip', 'compact', 'compact-alt', 'compact-fixed'];
      if (allowed.includes(s)) return s;
      return 'grid';
    }
    if (field.configKey === 'printOrientation') {
      return normalizePrintOrientation(s);
    }
    return s || field.default;
  }
  const n = field.type === 'int' ? Math.round(Number(value)) : Number(value);
  if (!Number.isFinite(n)) return field.default;
  return Math.max(field.min, Math.min(field.max, n));
}

function buildDefaultConfig(overrides) {
  const out = { v: 1 };
  for (const f of LABEL_PRINT_FORMAT_FIELDS) {
    out[f.configKey] = f.default;
  }
  if (overrides && typeof overrides === 'object') {
    for (const f of LABEL_PRINT_FORMAT_FIELDS) {
      if (overrides[f.configKey] !== undefined) {
        out[f.configKey] = clampField(f, overrides[f.configKey]);
      }
    }
  }
  return out;
}

const LARGE_LABEL_CONFIG = buildDefaultConfig({
  labelWidthMm: 40,
  labelHeightMm: 28,
  labelsPerRow: 1,
  qrCellSize: 4,
  qrVisualSizeMm: 14,
  qrTopRatio: 0,
  textTopRatio: 0.72,
  textXMul: 2,
  textYMul: 2,
  textFontId: 2,
  textFontPt: 5
});

const SMALL_LABEL_CONFIG = buildDefaultConfig({
  layoutType: 'compact',
  labelWidthMm: 15,
  labelHeightMm: 15,
  labelsPerRow: 1,
  qrCellSize: 3,
  qrVisualSizeMm: 9,
  qrTopRatio: 0.02,
  textTopRatio: 0.68,
  textXMul: 1,
  textYMul: 1,
  textFontId: 2,
  textFontPt: 8,
  bottomBandHeightMm: 4,
  rightRailWidthMm: 3.5
});

/** 6-up 15×15 on 109 mm continuous roll (compact: QR + vertical unit id + brand/price). */
const SMALL_15X15_CONTINUOUS_109_CONFIG = buildDefaultConfig({
  layoutType: 'compact',
  labelWidthMm: 15,
  labelHeightMm: 15,
  labelsPerRow: 6,
  marginLeft: 2,
  marginRight: 2,
  gapRow: 2,
  gapCol: 3,
  qrCellSize: 3,
  qrVisualSizeMm: 9,
  qrTopRatio: 0.02,
  textTopRatio: 0.68,
  textXMul: 1,
  textYMul: 1,
  textFontId: 2,
  textFontPt: 8,
  bottomBandHeightMm: 4,
  rightRailWidthMm: 3.5,
  pageWidthMm: 109
});

/** 15×15 alt: QR + brand rail (right, vertical) + unit code band (bottom, horizontal). */
const SMALL_15X15_ALT_CONFIG = buildDefaultConfig({
  layoutType: 'compact-alt',
  labelWidthMm: 15,
  labelHeightMm: 15,
  labelsPerRow: 6,
  marginLeft: 2,
  marginRight: 2,
  gapRow: 2,
  gapCol: 3,
  qrCellSize: 3,
  qrVisualSizeMm: 9,
  qrTopRatio: 0.02,
  textTopRatio: 0.68,
  textXMul: 1,
  textYMul: 1,
  textFontId: 2,
  textFontPt: 8,
  bottomBandHeightMm: 4,
  rightRailWidthMm: 3.5,
  pageWidthMm: 109
});

/** 15×15 fixed: 10×10 QR, 5mm brand rail (full height), 10×5 unit footer — zero padding inside cell. */
const SMALL_15X15_FIXED_CONFIG = buildDefaultConfig({
  layoutType: 'compact-fixed',
  labelWidthMm: 15,
  labelHeightMm: 15,
  labelsPerRow: 6,
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 2,
  marginRight: 2,
  gapRow: 2,
  gapCol: 3,
  qrCellSize: 3,
  qrVisualSizeMm: 10,
  qrTopRatio: 0.02,
  textTopRatio: 0.68,
  textXMul: 1,
  textYMul: 1,
  textFontId: 1,
  textFontPt: 8,
  bottomBandHeightMm: 5,
  rightRailWidthMm: 5,
  pageWidthMm: 109,
  printOrientation: 'portrait_180'
});

const EYEWEAR_STRIP_CONFIG = buildDefaultConfig({
  layoutType: 'strip',
  labelWidthMm: 100,
  labelHeightMm: 12,
  labelsPerRow: 1,
  printWidthMm: 66,
  zone1WidthMm: 33,
  zone2WidthMm: 33,
  tailWidthMm: 34,
  qrCellSize: 3,
  qrVisualSizeMm: 10,
  qrTopRatio: 0.06,
  textTopRatio: 0.72,
  textXMul: 1,
  textYMul: 1,
  textFontId: 2,
  textFontPt: 4,
  dotsPerMm: 8
});

const ZONES_SMALL_15X15 = [
  { zone_key: 'qr', zone_type: 'qr', label: 'QR Code', printable: true, x_mm: 0, y_mm: 0, width_mm: 10, height_mm: 10, content: '{unit_id}', font_size_pt: 8, font_weight: '700', writing_mode: 'horizontal', error_level: 'L', background: 'transparent', border_top: false },
  { zone_key: 'uid_strip', zone_type: 'text', label: 'Unit ID', printable: true, x_mm: 10.5, y_mm: 0, width_mm: 4, height_mm: 15, content: '{unit_id}', font_size_pt: 8, font_weight: '700', writing_mode: 'vertical', error_level: 'L', background: 'transparent', border_top: false },
  { zone_key: 'footer', zone_type: 'text', label: 'Brand - MRP', printable: true, x_mm: 0, y_mm: 10.5, width_mm: 10, height_mm: 4.5, content: '{brand}-{mrp}', font_size_pt: 8, font_weight: '700', writing_mode: 'horizontal', error_level: 'L', background: 'transparent', border_top: true }
];

const ZONES_SMALL_15X15_FIXED = [
  { zone_key: 'qr', zone_type: 'qr', label: 'QR Code', printable: true, x_mm: 0, y_mm: 0, width_mm: 10, height_mm: 10, content: '{unit_id}', font_size_pt: 8, font_weight: '700', writing_mode: 'horizontal', error_level: 'L', background: 'transparent', border_top: false },
  { zone_key: 'brand_rail', zone_type: 'text', label: 'Brand - MRP', printable: true, x_mm: 10, y_mm: 0, width_mm: 5, height_mm: 15, content: '{brand}-{mrp}', font_size_pt: 8, font_weight: '700', writing_mode: 'vertical', error_level: 'L', background: 'transparent', border_top: false },
  { zone_key: 'unit_footer', zone_type: 'text', label: 'Unit ID', printable: true, x_mm: 0, y_mm: 10, width_mm: 10, height_mm: 5, content: '{unit_id}', font_size_pt: 8, font_weight: '700', writing_mode: 'horizontal', error_level: 'L', background: 'transparent', border_top: true }
];

const ZONES_SMALL_15X15_ALT = [
  { zone_key: 'qr', zone_type: 'qr', label: 'QR Code', printable: true, x_mm: 0, y_mm: 0, width_mm: 10, height_mm: 10, content: '{unit_id}', font_size_pt: 8, font_weight: '700', writing_mode: 'horizontal', error_level: 'L', background: 'transparent', border_top: false },
  { zone_key: 'brand_rail', zone_type: 'text', label: 'Brand - MRP', printable: true, x_mm: 10.5, y_mm: 0, width_mm: 4.5, height_mm: 15, content: '{brand}-{mrp}', font_size_pt: 8, font_weight: '700', writing_mode: 'vertical', error_level: 'L', background: 'transparent', border_top: false },
  { zone_key: 'unit_band', zone_type: 'text', label: 'Unit ID', printable: true, x_mm: 0, y_mm: 10.5, width_mm: 10.5, height_mm: 4.5, content: '{unit_id}', font_size_pt: 8, font_weight: '700', writing_mode: 'horizontal', error_level: 'L', background: 'transparent', border_top: true }
];

const ZONES_STRIP_104X12 = [
  { zone_key: 'zone_qr_sku', zone_type: 'qr', label: 'Zone 1 — QR + SKU', printable: true, x_mm: 0, y_mm: 0, width_mm: 33, height_mm: 12, content: '{unit_id}', font_size_pt: 6, font_weight: '700', writing_mode: 'horizontal', error_level: 'L', background: 'transparent', border_top: false },
  { zone_key: 'zone_brand_mrp', zone_type: 'text', label: 'Zone 2 — Brand + Model + MRP', printable: true, x_mm: 33, y_mm: 0, width_mm: 33, height_mm: 12, content: '{brand}\n{model}\nMRP {mrp}', font_size_pt: 6, font_weight: '700', writing_mode: 'horizontal', error_level: 'L', background: 'transparent', border_top: false },
  { zone_key: 'tail', zone_type: 'tail', label: 'Tail (non-print)', printable: false, x_mm: 66, y_mm: 0, width_mm: 38, height_mm: 12, content: '', font_size_pt: null, font_weight: null, writing_mode: null, error_level: null, background: 'transparent', border_top: false }
];

const LABEL_PAGE_DEFAULTS = Object.freeze({
  SQUARE: { page_width_mm: 109, columns: 6, col_gap_mm: 3, row_gap_mm: 3, margin_left_mm: 2, margin_right_mm: 2, margin_top_mm: 2, margin_bottom_mm: 0, label_width_mm: 15, label_height_mm: 15 },
  STRIP: { page_width_mm: 108, columns: 1, col_gap_mm: 0, row_gap_mm: 2, margin_left_mm: 2, margin_right_mm: 2, margin_top_mm: 2, margin_bottom_mm: 0, label_width_mm: 104, label_height_mm: 12 }
});

const SEED_LABEL_PRINT_FORMATS = Object.freeze([
  {
    format_key: 'large_label',
    name: 'Large label',
    description: 'Roll label — 40×28 mm (legacy grid)',
    config: LARGE_LABEL_CONFIG,
    is_default: false,
    sort_order: 10,
    zones: null
  },
  {
    format_key: 'small_15x15',
    name: '15×15mm Small Label',
    description: '6-up on 109mm roll · QR + vertical unit id + brand/MRP footer',
    config: buildDefaultConfig({ layoutType: 'compact', labelWidthMm: 15, labelHeightMm: 15, labelsPerRow: 6, marginLeft: 2, marginRight: 2, marginTop: 2, gapRow: 3, gapCol: 3, qrCellSize: 3, qrVisualSizeMm: 10, textFontId: 1, textFontPt: 8, pageWidthMm: 109 }),
    label_type: 'SQUARE',
    page: LABEL_PAGE_DEFAULTS.SQUARE,
    zones: ZONES_SMALL_15X15,
    is_default: true,
    sort_order: 20
  },
  {
    format_key: 'small_15x15_alt',
    name: '15×15mm — Brand rail + Unit band',
    description: 'QR + vertical brand/MRP rail + horizontal unit code band',
    config: SMALL_15X15_ALT_CONFIG,
    label_type: 'SQUARE',
    page: LABEL_PAGE_DEFAULTS.SQUARE,
    zones: ZONES_SMALL_15X15_ALT,
    is_default: false,
    sort_order: 26
  },
  {
    format_key: 'small_15x15_fixed',
    name: '15×15mm — Fixed (Brand rail + Unit footer)',
    description: '10×10 QR · brand vertical rail · 7-digit unit footer',
    config: SMALL_15X15_FIXED_CONFIG,
    label_type: 'SQUARE',
    page: { ...LABEL_PAGE_DEFAULTS.SQUARE, margin_top_mm: 0, row_gap_mm: 2 },
    zones: ZONES_SMALL_15X15_FIXED,
    is_default: false,
    sort_order: 27
  },
  {
    format_key: 'strip_104x12',
    name: '104×12mm Frame Wrap Label',
    description: '66 mm print (QR + brand) + 34 mm tail on 108 mm roll',
    config: buildDefaultConfig({ layoutType: 'strip', labelWidthMm: 104, labelHeightMm: 12, labelsPerRow: 1, marginLeft: 2, marginRight: 2, marginTop: 2, gapRow: 2, printWidthMm: 66, zone1WidthMm: 33, zone2WidthMm: 33, tailWidthMm: 34, pageWidthMm: 108, qrCellSize: 3, qrVisualSizeMm: 10, textFontPt: 6 }),
    label_type: 'STRIP',
    page: LABEL_PAGE_DEFAULTS.STRIP,
    zones: ZONES_STRIP_104X12,
    is_default: false,
    sort_order: 30
  }
]);

function normalizeLabelPrintConfig(raw) {
  const base = buildDefaultConfig();
  if (!raw || typeof raw !== 'object') return base;
  const src = raw.config && typeof raw.config === 'object' ? raw.config : raw;
  for (const f of LABEL_PRINT_FORMAT_FIELDS) {
    if (src[f.configKey] !== undefined) {
      base[f.configKey] = clampField(f, src[f.configKey]);
    }
  }
  const rawLayout = String(src.layoutType || base.layoutType || '').toLowerCase();
  if (src.printOrientation !== undefined) {
    base.printOrientation = normalizePrintOrientation(src.printOrientation);
  } else if (rawLayout === 'compact-fixed') {
    base.printOrientation = 'portrait_180';
  } else if (!base.printOrientation) {
    base.printOrientation = DEFAULT_PRINT_ORIENTATION;
  }
  base.v = 1;
  return base;
}

function parseZonesJson(raw) {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

function normalizeZones(zones) {
  const arr = Array.isArray(zones) ? zones : [];
  return arr.map((z) => ({
    zone_key: String(z.zone_key || '').trim(),
    zone_type: String(z.zone_type || 'text').toLowerCase(),
    label: String(z.label || ''),
    printable: z.printable !== false && z.zone_type !== 'tail',
    x_mm: Number(z.x_mm) || 0,
    y_mm: Number(z.y_mm) || 0,
    width_mm: Number(z.width_mm) || 1,
    height_mm: Number(z.height_mm) || 1,
    content: z.content == null ? '' : String(z.content),
    font_size_pt: z.font_size_pt == null ? null : Number(z.font_size_pt),
    font_weight: z.font_weight == null ? null : String(z.font_weight),
    writing_mode: z.writing_mode == null ? 'horizontal' : String(z.writing_mode),
    text_align_h: ['left', 'center', 'right'].includes(String(z.text_align_h || '')) ? String(z.text_align_h) : 'left',
    text_align_v: ['top', 'middle', 'bottom'].includes(String(z.text_align_v || '')) ? String(z.text_align_v) : 'top',
    error_level: z.error_level == null ? 'L' : String(z.error_level),
    background: z.background == null ? 'transparent' : String(z.background),
    border_top: !!z.border_top
  })).filter((z) => z.zone_key);
}

function syncConfigFromPage(config, page) {
  if (!page || typeof page !== 'object') return config;
  const c = normalizeLabelPrintConfig(config);
  if (page.label_width_mm != null) c.labelWidthMm = Number(page.label_width_mm);
  if (page.label_height_mm != null) c.labelHeightMm = Number(page.label_height_mm);
  if (page.page_width_mm != null) c.pageWidthMm = Number(page.page_width_mm);
  if (page.columns != null) c.labelsPerRow = Math.round(Number(page.columns));
  if (page.col_gap_mm != null) c.gapCol = Number(page.col_gap_mm);
  if (page.row_gap_mm != null) c.gapRow = Number(page.row_gap_mm);
  if (page.margin_left_mm != null) c.marginLeft = Number(page.margin_left_mm);
  if (page.margin_right_mm != null) c.marginRight = Number(page.margin_right_mm);
  if (page.margin_top_mm != null) c.marginTop = Number(page.margin_top_mm);
  if (page.margin_bottom_mm != null) c.marginBottom = Number(page.margin_bottom_mm);
  return c;
}

function rowToLabelPrintFormatApi(row) {
  let config = normalizeLabelPrintConfig({});
  try {
    config = normalizeLabelPrintConfig(JSON.parse(String(row.config_json || '{}')));
  } catch (_e) {
    config = normalizeLabelPrintConfig({});
  }
  let zones = normalizeZones(parseZonesJson(row.zones_json));
  let page = {
    label_type: row.label_type != null ? String(row.label_type) : null,
    page_width_mm: row.page_width_mm != null ? Number(row.page_width_mm) : null,
    page_height_mm: row.page_height_mm != null ? Number(row.page_height_mm) : null,
    margin_left_mm: row.margin_left_mm != null ? Number(row.margin_left_mm) : null,
    margin_right_mm: row.margin_right_mm != null ? Number(row.margin_right_mm) : null,
    margin_top_mm: row.margin_top_mm != null ? Number(row.margin_top_mm) : null,
    margin_bottom_mm: row.margin_bottom_mm != null ? Number(row.margin_bottom_mm) : null,
    columns: row.columns_count != null ? Number(row.columns_count) : null,
    col_gap_mm: row.col_gap_mm != null ? Number(row.col_gap_mm) : null,
    row_gap_mm: row.row_gap_mm != null ? Number(row.row_gap_mm) : null,
    label_width_mm: row.label_width_mm != null ? Number(row.label_width_mm) : null,
    label_height_mm: row.label_height_mm != null ? Number(row.label_height_mm) : null
  };
  config = syncConfigFromPage(config, page);
  if (zones.length > 0) {
    const hasStripTail = zones.some((z) => z.zone_type === 'tail');
    if (!page.label_type || page.label_type === 'CUSTOM') {
      page.label_type = hasStripTail ? 'STRIP' : 'SQUARE';
    }
    if (page.label_type === 'SQUARE' && String(config.layoutType || '').toLowerCase() === 'grid') {
      config = Object.assign({}, config, { layoutType: 'compact' });
    }
  }
  return {
    format_key: String(row.format_key || ''),
    name: String(row.name || ''),
    description: row.description != null && String(row.description).trim() !== '' ? String(row.description).trim() : null,
    config,
    label_type: page.label_type,
    page_width_mm: page.page_width_mm,
    page_height_mm: page.page_height_mm,
    margin_left_mm: page.margin_left_mm,
    margin_right_mm: page.margin_right_mm,
    margin_top_mm: page.margin_top_mm,
    margin_bottom_mm: page.margin_bottom_mm,
    columns: page.columns,
    col_gap_mm: page.col_gap_mm,
    row_gap_mm: page.row_gap_mm,
    label_width_mm: page.label_width_mm,
    label_height_mm: page.label_height_mm,
    zones,
    has_zones: zones.length > 0,
    is_default: row.is_default === true || row.is_default === 1,
    sort_order: Number(row.sort_order) || 0,
    is_active: row.is_active !== false && row.is_active !== 0,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

function seedToApi(seed) {
  const page = seed.page || {};
  const config = syncConfigFromPage(seed.config, {
    label_width_mm: page.label_width_mm,
    label_height_mm: page.label_height_mm,
    page_width_mm: page.page_width_mm,
    columns: page.columns,
    col_gap_mm: page.col_gap_mm,
    row_gap_mm: page.row_gap_mm,
    margin_left_mm: page.margin_left_mm,
    margin_right_mm: page.margin_right_mm,
    margin_top_mm: page.margin_top_mm,
    margin_bottom_mm: page.margin_bottom_mm
  });
  const zones = seed.zones ? normalizeZones(seed.zones) : [];
  return {
    format_key: seed.format_key,
    name: seed.name,
    description: seed.description || null,
    config,
    label_type: seed.label_type || null,
    page_width_mm: page.page_width_mm ?? null,
    page_height_mm: page.page_height_mm ?? null,
    margin_left_mm: page.margin_left_mm ?? null,
    margin_right_mm: page.margin_right_mm ?? null,
    margin_top_mm: page.margin_top_mm ?? null,
    margin_bottom_mm: page.margin_bottom_mm ?? null,
    columns: page.columns ?? null,
    col_gap_mm: page.col_gap_mm ?? null,
    row_gap_mm: page.row_gap_mm ?? null,
    label_width_mm: page.label_width_mm ?? null,
    label_height_mm: page.label_height_mm ?? null,
    zones,
    has_zones: zones.length > 0,
    is_default: !!seed.is_default,
    sort_order: Number(seed.sort_order) || 0,
    is_active: true,
    created_at: null,
    updated_at: null
  };
}

function validateZonesFitLabel(zones, labelW, labelH) {
  for (const z of zones) {
    if (z.x_mm + z.width_mm > labelW + 0.5) {
      return `Zone "${z.label || z.zone_key}" exceeds label width`;
    }
    if (z.y_mm + z.height_mm > labelH + 0.5) {
      return `Zone "${z.label || z.zone_key}" exceeds label height`;
    }
  }
  return null;
}

const labelZoneSchema = Joi.object({
  zone_key: Joi.string().max(50).required(),
  zone_type: Joi.string().valid('qr', 'text', 'tail', 'barcode', 'image').required(),
  label: Joi.string().max(100).required(),
  printable: Joi.boolean().required(),
  x_mm: Joi.number().min(0).required(),
  y_mm: Joi.number().min(0).required(),
  width_mm: Joi.number().min(0.5).required(),
  height_mm: Joi.number().min(0.5).required(),
  content: Joi.string().max(500).allow(null, ''),
  font_size_pt: Joi.number().min(4).max(24).allow(null),
  font_weight: Joi.string().valid('400', '500', '600', '700').allow(null),
  writing_mode: Joi.string().valid('horizontal', 'vertical').allow(null),
  text_align_h: Joi.string().valid('left', 'center', 'right').allow(null),
  text_align_v: Joi.string().valid('top', 'middle', 'bottom').allow(null),
  error_level: Joi.string().valid('L', 'M', 'Q', 'H').allow(null),
  background: Joi.string().max(20).allow(null),
  border_top: Joi.boolean().allow(null)
});

const labelPrintPageSchema = Joi.object({
  label_type: Joi.string().valid('SQUARE', 'STRIP', 'CUSTOM').allow(null),
  page_width_mm: Joi.number().min(10).max(300).allow(null),
  page_height_mm: Joi.number().min(1).max(300).allow(null),
  margin_left_mm: Joi.number().min(0).max(20).allow(null),
  margin_right_mm: Joi.number().min(0).max(20).allow(null),
  margin_top_mm: Joi.number().min(0).max(20).allow(null),
  margin_bottom_mm: Joi.number().min(0).max(20).allow(null),
  columns: Joi.number().integer().min(1).max(12).allow(null),
  col_gap_mm: Joi.number().min(0).max(20).allow(null),
  row_gap_mm: Joi.number().min(0).max(20).allow(null),
  label_width_mm: Joi.number().min(5).max(200).allow(null),
  label_height_mm: Joi.number().min(5).max(200).allow(null)
});

const labelPrintConfigSchema = Joi.object({
  v: Joi.number().integer().valid(1).optional(),
  marginTop: Joi.number().min(0).max(60),
  marginBottom: Joi.number().min(0).max(60),
  marginLeft: Joi.number().min(0).max(60),
  marginRight: Joi.number().min(0).max(60),
  gapRow: Joi.number().min(0).max(30),
  gapCol: Joi.number().min(0).max(30),
  labelWidthMm: Joi.number().min(1).max(200),
  labelHeightMm: Joi.number().min(1).max(200),
  labelsPerRow: Joi.number().integer().min(1).max(40),
  dotsPerMm: Joi.number().min(1).max(40),
  qrCellSize: Joi.number().integer().min(1).max(10),
  qrVisualSizeMm: Joi.number().min(1).max(50),
  qrTopRatio: Joi.number().min(0).max(1),
  textTopRatio: Joi.number().min(0).max(1),
  textXMul: Joi.number().integer().min(1).max(10),
  textYMul: Joi.number().integer().min(1).max(10),
  textFontId: Joi.number().integer().min(0).max(3),
  textFontPt: Joi.number().min(0.5).max(20),
  layoutType: Joi.string().valid('grid', 'strip', 'compact', 'compact-alt', 'compact-fixed'),
  bottomBandHeightMm: Joi.number().min(1).max(20),
  rightRailWidthMm: Joi.number().min(1).max(20),
  printWidthMm: Joi.number().min(0).max(200),
  zone1WidthMm: Joi.number().min(1).max(100),
  zone2WidthMm: Joi.number().min(1).max(100),
  tailWidthMm: Joi.number().min(0).max(100),
  pageWidthMm: Joi.number().min(0).max(300),
  printOrientation: Joi.string().valid(...PRINT_ORIENTATION_KEYS)
}).unknown(false);

/** Tokens for zone `content` — keep in sync with Foundry `_bcApplyZoneTokens`. */
const ZONE_CONTENT_TOKENS = Object.freeze([
  { key: 'unit_id', label: 'Unit ID', description: '7-digit unit barcode' },
  { key: 'sku_code', label: 'SKU code', description: 'Product SKU on the unit' },
  { key: 'brand', label: 'Brand', description: 'Brand code (uppercase)' },
  { key: 'model', label: 'Model', description: 'Model / style name' },
  { key: 'power', label: 'Power', description: 'Reading diopter for Readers (+1.00 … +4.00); blank for other types' },
  { key: 'mrp', label: 'MRP', description: 'Sale price (integer)' }
]);

/** Common content patterns (insert as full Content value or combine tokens). */
const ZONE_CONTENT_PRESETS = Object.freeze([
  { key: 'unit_only', label: 'Unit ID only', content: '{unit_id}' },
  { key: 'sku_only', label: 'SKU only', content: '{sku_code}' },
  { key: 'brand_mrp', label: 'Brand-MRP', content: '{brand}-{mrp}' },
  { key: 'brand_model_mrp', label: 'Brand + model + MRP (3 lines)', content: '{brand}\n{model}\nMRP {mrp}' },
  { key: 'readers_power', label: 'Readers — power', content: '{power}' },
  { key: 'readers_brand_power_mrp', label: 'Readers 3-line', content: '{brand}\n{power}\nMRP {mrp}' }
]);

function slugifyFormatKey(name) {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  if (!base || !FORMAT_KEY_RE.test(base)) return '';
  return base;
}

function getFormatInputIds() {
  return LABEL_PRINT_FORMAT_FIELDS.map((f) => f.inputId);
}

const labelPrintFormatWriteSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
  config: labelPrintConfigSchema.required(),
  label_type: Joi.string().valid('SQUARE', 'STRIP', 'CUSTOM').allow(null),
  page_width_mm: Joi.number().min(10).max(300).allow(null),
  page_height_mm: Joi.number().min(1).max(300).allow(null),
  margin_left_mm: Joi.number().min(0).max(20).allow(null),
  margin_right_mm: Joi.number().min(0).max(20).allow(null),
  margin_top_mm: Joi.number().min(0).max(20).allow(null),
  margin_bottom_mm: Joi.number().min(0).max(20).allow(null),
  columns: Joi.number().integer().min(1).max(12).allow(null),
  col_gap_mm: Joi.number().min(0).max(20).allow(null),
  row_gap_mm: Joi.number().min(0).max(20).allow(null),
  label_width_mm: Joi.number().min(5).max(200).allow(null),
  label_height_mm: Joi.number().min(5).max(200).allow(null),
  zones: Joi.array().items(labelZoneSchema).allow(null),
  is_default: Joi.boolean().optional(),
  sort_order: Joi.number().integer().min(0).max(9999).optional(),
  is_active: Joi.boolean().optional()
});

module.exports = {
  LABEL_PRINT_FORMAT_FIELDS,
  FORMAT_KEY_RE,
  PRINT_ORIENTATION_CATALOG,
  PRINT_ORIENTATION_KEYS,
  DEFAULT_PRINT_ORIENTATION,
  normalizePrintOrientation,
  tsplDirectionFromPrintOrientation,
  printOrientationLabel,
  SEED_LABEL_PRINT_FORMATS,
  ZONES_SMALL_15X15,
  ZONES_SMALL_15X15_FIXED,
  ZONES_SMALL_15X15_ALT,
  ZONES_STRIP_104X12,
  LARGE_LABEL_CONFIG,
  SMALL_LABEL_CONFIG,
  SMALL_15X15_ALT_CONFIG,
  SMALL_15X15_FIXED_CONFIG,
  EYEWEAR_STRIP_CONFIG,
  buildDefaultConfig,
  normalizeLabelPrintConfig,
  normalizeZones,
  parseZonesJson,
  rowToLabelPrintFormatApi,
  seedToApi,
  validateZonesFitLabel,
  syncConfigFromPage,
  labelPrintConfigSchema,
  labelZoneSchema,
  labelPrintPageSchema,
  labelPrintFormatWriteSchema,
  ZONE_CONTENT_TOKENS,
  ZONE_CONTENT_PRESETS,
  slugifyFormatKey,
  getFormatInputIds
};
