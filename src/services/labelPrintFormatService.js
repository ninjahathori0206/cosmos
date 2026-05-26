'use strict';

const sql = require('mssql');
const { executeStoredProcedure } = require('../config/db');
const {
  SEED_LABEL_PRINT_FORMATS,
  normalizeLabelPrintConfig,
  normalizeZones,
  rowToLabelPrintFormatApi,
  seedToApi,
  validateZonesFitLabel,
  syncConfigFromPage,
  FORMAT_KEY_RE,
  slugifyFormatKey
} = require('../config/labelPrintFormatSchema');

function seedRowsToApi() {
  return SEED_LABEL_PRINT_FORMATS.map((s) => seedToApi(s));
}

function buildSpPayload(payload) {
  const config = normalizeLabelPrintConfig(payload.config || {});
  const synced = syncConfigFromPage(config, {
    label_width_mm: payload.label_width_mm,
    label_height_mm: payload.label_height_mm,
    page_width_mm: payload.page_width_mm,
    columns: payload.columns,
    col_gap_mm: payload.col_gap_mm,
    row_gap_mm: payload.row_gap_mm,
    margin_left_mm: payload.margin_left_mm,
    margin_right_mm: payload.margin_right_mm,
    margin_top_mm: payload.margin_top_mm,
    margin_bottom_mm: payload.margin_bottom_mm
  });
  const zones = payload.zones != null ? normalizeZones(payload.zones) : null;
  return {
    config: synced,
    zones,
    config_json: JSON.stringify(synced),
    zones_json: zones != null ? JSON.stringify(zones) : null,
    label_type: payload.label_type || null,
    page_width_mm: payload.page_width_mm != null ? payload.page_width_mm : synced.pageWidthMm,
    page_height_mm: payload.page_height_mm != null ? payload.page_height_mm : null,
    margin_left_mm: payload.margin_left_mm != null ? payload.margin_left_mm : synced.marginLeft,
    margin_right_mm: payload.margin_right_mm != null ? payload.margin_right_mm : synced.marginRight,
    margin_top_mm: payload.margin_top_mm != null ? payload.margin_top_mm : synced.marginTop,
    margin_bottom_mm: payload.margin_bottom_mm != null ? payload.margin_bottom_mm : synced.marginBottom,
    columns_count: payload.columns != null ? payload.columns : synced.labelsPerRow,
    col_gap_mm: payload.col_gap_mm != null ? payload.col_gap_mm : synced.gapCol,
    row_gap_mm: payload.row_gap_mm != null ? payload.row_gap_mm : synced.gapRow,
    label_width_mm: payload.label_width_mm != null ? payload.label_width_mm : synced.labelWidthMm,
    label_height_mm: payload.label_height_mm != null ? payload.label_height_mm : synced.labelHeightMm
  };
}

async function listLabelPrintFormats({ activeOnly = true } = {}) {
  try {
    const result = await executeStoredProcedure('sp_LabelPrintFormat_GetAll', {
      active_only: { type: sql.Bit, value: activeOnly ? 1 : 0 }
    });
    const rows = (result.recordset || []).map(rowToLabelPrintFormatApi);
    if (rows.length) return rows;
  } catch (err) {
    if (!/Could not find stored procedure|Invalid object name/i.test(String(err.message || ''))) throw err;
  }
  return seedRowsToApi();
}

async function getLabelPrintFormat(formatKey) {
  const key = String(formatKey || '').trim();
  if (!key) {
    const err = new Error('format_key required.');
    err.statusCode = 400;
    throw err;
  }
  try {
    const result = await executeStoredProcedure('sp_LabelPrintFormat_GetByKey', {
      format_key: { type: sql.VarChar(50), value: key }
    });
    if (result.recordset && result.recordset[0]) return rowToLabelPrintFormatApi(result.recordset[0]);
  } catch (err) {
    if (!/Could not find stored procedure|Invalid object name/i.test(String(err.message || ''))) throw err;
  }
  const seed = seedRowsToApi().find((r) => r.format_key === key);
  if (seed) return seed;
  const err = new Error('Label format not found.');
  err.statusCode = 404;
  throw err;
}

async function createLabelPrintFormat(payload) {
  const formatKey = String(payload.format_key || slugifyFormatKey(payload.name) || '').trim();
  if (!FORMAT_KEY_RE.test(formatKey)) {
    const err = new Error('Invalid format_key. Use lowercase letters, digits, and underscores (max 49 chars).');
    err.statusCode = 400;
    throw err;
  }
  const name = String(payload.name || '').trim();
  if (!name) {
    const err = new Error('Name is required.');
    err.statusCode = 400;
    throw err;
  }
  const built = buildSpPayload(payload);
  const zones = built.zones || [];
  const labelW = built.label_width_mm;
  const labelH = built.label_height_mm;
  if (zones.length) {
    const zoneErr = validateZonesFitLabel(zones, labelW, labelH);
    if (zoneErr) {
      const err = new Error(zoneErr);
      err.statusCode = 400;
      throw err;
    }
  }
  try {
    const result = await executeStoredProcedure('sp_LabelPrintFormat_Create', {
      format_key: { type: sql.VarChar(50), value: formatKey },
      name: { type: sql.NVarChar(120), value: name },
      description: { type: sql.NVarChar(500), value: payload.description || null },
      config_json: { type: sql.NVarChar(sql.MAX), value: built.config_json },
      is_default: { type: sql.Bit, value: payload.is_default === true ? 1 : 0 },
      sort_order: { type: sql.Int, value: Number(payload.sort_order) || 0 },
      is_active: { type: sql.Bit, value: payload.is_active === false ? 0 : 1 },
      label_type: { type: sql.NVarChar(20), value: built.label_type },
      page_width_mm: { type: sql.Decimal(6, 2), value: built.page_width_mm },
      page_height_mm: { type: sql.Decimal(6, 2), value: built.page_height_mm },
      margin_left_mm: { type: sql.Decimal(6, 2), value: built.margin_left_mm },
      margin_right_mm: { type: sql.Decimal(6, 2), value: built.margin_right_mm },
      margin_top_mm: { type: sql.Decimal(6, 2), value: built.margin_top_mm },
      margin_bottom_mm: { type: sql.Decimal(6, 2), value: built.margin_bottom_mm },
      columns_count: { type: sql.Int, value: built.columns_count },
      col_gap_mm: { type: sql.Decimal(6, 2), value: built.col_gap_mm },
      row_gap_mm: { type: sql.Decimal(6, 2), value: built.row_gap_mm },
      label_width_mm: { type: sql.Decimal(6, 2), value: built.label_width_mm },
      label_height_mm: { type: sql.Decimal(6, 2), value: built.label_height_mm },
      zones_json: { type: sql.NVarChar(sql.MAX), value: built.zones_json }
    });
    if (result.recordset && result.recordset[0]) return rowToLabelPrintFormatApi(result.recordset[0]);
    return getLabelPrintFormat(formatKey);
  } catch (err) {
    if (/duplicate key|UNIQUE|PK_label_print_formats/i.test(String(err.message || ''))) {
      const e = new Error('A label format with this key already exists.');
      e.statusCode = 409;
      throw e;
    }
    if (/Invalid object name|stored procedure/i.test(String(err.message || ''))) {
      const e = new Error('label_print_formats not ready. Run migration 70.');
      e.statusCode = 503;
      throw e;
    }
    throw err;
  }
}

async function updateLabelPrintFormat(formatKey, payload) {
  const key = String(formatKey || '').trim();
  const existing = await getLabelPrintFormat(key);
  const merged = {
    name: payload.name !== undefined ? payload.name : existing.name,
    description: payload.description !== undefined ? payload.description : existing.description,
    config: payload.config !== undefined ? payload.config : existing.config,
    label_type: payload.label_type !== undefined ? payload.label_type : existing.label_type,
    page_width_mm: payload.page_width_mm !== undefined ? payload.page_width_mm : existing.page_width_mm,
    page_height_mm: payload.page_height_mm !== undefined ? payload.page_height_mm : existing.page_height_mm,
    margin_left_mm: payload.margin_left_mm !== undefined ? payload.margin_left_mm : existing.margin_left_mm,
    margin_right_mm: payload.margin_right_mm !== undefined ? payload.margin_right_mm : existing.margin_right_mm,
    margin_top_mm: payload.margin_top_mm !== undefined ? payload.margin_top_mm : existing.margin_top_mm,
    margin_bottom_mm: payload.margin_bottom_mm !== undefined ? payload.margin_bottom_mm : existing.margin_bottom_mm,
    columns: payload.columns !== undefined ? payload.columns : existing.columns,
    col_gap_mm: payload.col_gap_mm !== undefined ? payload.col_gap_mm : existing.col_gap_mm,
    row_gap_mm: payload.row_gap_mm !== undefined ? payload.row_gap_mm : existing.row_gap_mm,
    label_width_mm: payload.label_width_mm !== undefined ? payload.label_width_mm : existing.label_width_mm,
    label_height_mm: payload.label_height_mm !== undefined ? payload.label_height_mm : existing.label_height_mm,
    zones: payload.zones !== undefined ? payload.zones : existing.zones
  };

  const built = buildSpPayload(merged);
  const zones = built.zones || [];
  if (zones.length) {
    const zoneErr = validateZonesFitLabel(zones, built.label_width_mm, built.label_height_mm);
    if (zoneErr) {
      const err = new Error(zoneErr);
      err.statusCode = 400;
      throw err;
    }
  }

  try {
    const result = await executeStoredProcedure('sp_LabelPrintFormat_Update', {
      format_key: { type: sql.VarChar(50), value: key },
      name: { type: sql.NVarChar(120), value: merged.name },
      description: { type: sql.NVarChar(500), value: merged.description || null },
      config_json: { type: sql.NVarChar(sql.MAX), value: built.config_json },
      is_default: { type: sql.Bit, value: payload.is_default === undefined ? (existing.is_default ? 1 : 0) : (payload.is_default ? 1 : 0) },
      sort_order: { type: sql.Int, value: payload.sort_order === undefined ? (existing.sort_order || 0) : (Number(payload.sort_order) || 0) },
      is_active: { type: sql.Bit, value: payload.is_active === undefined ? (existing.is_active !== false ? 1 : 0) : (payload.is_active === false ? 0 : 1) },
      label_type: { type: sql.NVarChar(20), value: built.label_type },
      page_width_mm: { type: sql.Decimal(6, 2), value: built.page_width_mm },
      page_height_mm: { type: sql.Decimal(6, 2), value: built.page_height_mm },
      margin_left_mm: { type: sql.Decimal(6, 2), value: built.margin_left_mm },
      margin_right_mm: { type: sql.Decimal(6, 2), value: built.margin_right_mm },
      margin_top_mm: { type: sql.Decimal(6, 2), value: built.margin_top_mm },
      margin_bottom_mm: { type: sql.Decimal(6, 2), value: built.margin_bottom_mm },
      columns_count: { type: sql.Int, value: built.columns_count },
      col_gap_mm: { type: sql.Decimal(6, 2), value: built.col_gap_mm },
      row_gap_mm: { type: sql.Decimal(6, 2), value: built.row_gap_mm },
      label_width_mm: { type: sql.Decimal(6, 2), value: built.label_width_mm },
      label_height_mm: { type: sql.Decimal(6, 2), value: built.label_height_mm },
      zones_json: { type: sql.NVarChar(sql.MAX), value: built.zones_json }
    });
    if (result.recordset && result.recordset[0]) return rowToLabelPrintFormatApi(result.recordset[0]);
    return getLabelPrintFormat(key);
  } catch (err) {
    if (/Invalid object name|stored procedure/i.test(String(err.message || ''))) {
      const e = new Error('label_print_formats not ready. Run migration 70.');
      e.statusCode = 503;
      throw e;
    }
    throw err;
  }
}

async function deleteLabelPrintFormat(formatKey) {
  const key = String(formatKey || '').trim();
  await getLabelPrintFormat(key);
  try {
    const result = await executeStoredProcedure('sp_LabelPrintFormat_Delete', {
      format_key: { type: sql.VarChar(50), value: key }
    });
    return result.recordset && result.recordset[0] ? result.recordset[0] : { format_key: key, deleted: true };
  } catch (err) {
    if (/Invalid object name|stored procedure/i.test(String(err.message || ''))) {
      const e = new Error('label_print_formats not ready. Run migration 70.');
      e.statusCode = 503;
      throw e;
    }
    throw err;
  }
}

module.exports = {
  listLabelPrintFormats,
  getLabelPrintFormat,
  createLabelPrintFormat,
  updateLabelPrintFormat,
  deleteLabelPrintFormat
};
