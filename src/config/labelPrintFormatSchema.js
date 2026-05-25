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
  { configKey: 'printWidthMm', inputId: null, type: 'float', default: 0, min: 0, max: 200 },
  { configKey: 'zone1WidthMm', inputId: null, type: 'float', default: 33, min: 1, max: 100 },
  { configKey: 'zone2WidthMm', inputId: null, type: 'float', default: 33, min: 1, max: 100 },
  { configKey: 'tailWidthMm', inputId: null, type: 'float', default: 34, min: 0, max: 100 },
  { configKey: 'bottomBandHeightMm', inputId: null, type: 'float', default: 4, min: 1, max: 20 },
  { configKey: 'rightRailWidthMm', inputId: null, type: 'float', default: 3.5, min: 1, max: 20 }
]);

const FORMAT_KEY_RE = /^[a-z][a-z0-9_]{0,48}$/;

function clampField(field, value) {
  if (field.type === 'string') {
    const s = String(value == null ? '' : value).trim().toLowerCase();
    if (field.configKey === 'layoutType') {
      if (s === 'strip' || s === 'compact') return s;
      return 'grid';
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
  qrVisualSizeMm: 10,
  qrTopRatio: 0.02,
  textTopRatio: 0.68,
  textXMul: 1,
  textYMul: 1,
  textFontId: 2,
  textFontPt: 3.5,
  bottomBandHeightMm: 4,
  rightRailWidthMm: 3.5
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

const SEED_LABEL_PRINT_FORMATS = Object.freeze([
  {
    format_key: 'large_label',
    name: 'Large label',
    description: 'Roll label — 40×28 mm (default)',
    config: LARGE_LABEL_CONFIG,
    is_default: true,
    sort_order: 10
  },
  {
    format_key: 'small_label',
    name: 'Small label',
    description: 'Eyewear QR sticker — 15×15 mm (unit + brand/price)',
    config: SMALL_LABEL_CONFIG,
    is_default: false,
    sort_order: 20
  },
  {
    format_key: 'eyewear_strip_12x100',
    name: 'Eyewear strip 12×100',
    description: 'Frame wrap — 66 mm print (QR + brand) + 34 mm tail',
    config: EYEWEAR_STRIP_CONFIG,
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
  base.v = 1;
  return base;
}

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
  layoutType: Joi.string().valid('grid', 'strip', 'compact'),
  bottomBandHeightMm: Joi.number().min(1).max(20),
  rightRailWidthMm: Joi.number().min(1).max(20),
  printWidthMm: Joi.number().min(0).max(200),
  zone1WidthMm: Joi.number().min(1).max(100),
  zone2WidthMm: Joi.number().min(1).max(100),
  tailWidthMm: Joi.number().min(0).max(100)
}).unknown(false);

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

module.exports = {
  LABEL_PRINT_FORMAT_FIELDS,
  FORMAT_KEY_RE,
  SEED_LABEL_PRINT_FORMATS,
  LARGE_LABEL_CONFIG,
  SMALL_LABEL_CONFIG,
  EYEWEAR_STRIP_CONFIG,
  buildDefaultConfig,
  normalizeLabelPrintConfig,
  labelPrintConfigSchema,
  slugifyFormatKey,
  getFormatInputIds
};
