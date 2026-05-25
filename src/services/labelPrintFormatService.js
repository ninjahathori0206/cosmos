'use strict';

const sql = require('mssql');
const { getPool } = require('../config/db');
const {
  SEED_LABEL_PRINT_FORMATS,
  normalizeLabelPrintConfig,
  FORMAT_KEY_RE,
  slugifyFormatKey
} = require('../config/labelPrintFormatSchema');

function rowToApi(row) {
  let config = {};
  try {
    config = normalizeLabelPrintConfig(JSON.parse(String(row.config_json || '{}')));
  } catch (_e) {
    config = normalizeLabelPrintConfig({});
  }
  return {
    format_key: String(row.format_key || ''),
    name: String(row.name || ''),
    description: row.description != null && String(row.description).trim() !== ''
      ? String(row.description).trim()
      : null,
    config,
    is_default: row.is_default === true || row.is_default === 1,
    sort_order: Number(row.sort_order) || 0,
    is_active: row.is_active !== false && row.is_active !== 0
  };
}

function seedRowsToApi() {
  return SEED_LABEL_PRINT_FORMATS.map((s) => ({
    format_key: s.format_key,
    name: s.name,
    description: s.description || null,
    config: normalizeLabelPrintConfig(s.config),
    is_default: !!s.is_default,
    sort_order: Number(s.sort_order) || 0,
    is_active: true
  }));
}

async function listLabelPrintFormats({ activeOnly = true } = {}) {
  const pool = await getPool();
  try {
    const q = await pool.request().query(`
      SELECT format_key, name, description, config_json, is_default, sort_order, is_active
      FROM dbo.label_print_formats
      ${activeOnly ? 'WHERE is_active = 1' : ''}
      ORDER BY sort_order, format_key
    `);
    const rows = (q.recordset || []).map(rowToApi);
    if (rows.length) return rows;
  } catch (err) {
    if (!/Invalid object name/i.test(String(err.message || ''))) throw err;
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
  const pool = await getPool();
  try {
    const q = await pool.request()
      .input('format_key', sql.VarChar(50), key)
      .query(`
        SELECT format_key, name, description, config_json, is_default, sort_order, is_active
        FROM dbo.label_print_formats
        WHERE format_key = @format_key
      `);
    if (q.recordset && q.recordset[0]) return rowToApi(q.recordset[0]);
  } catch (err) {
    if (!/Invalid object name/i.test(String(err.message || ''))) throw err;
  }
  const seed = seedRowsToApi().find((r) => r.format_key === key);
  if (seed) return seed;
  const err = new Error('Label format not found.');
  err.statusCode = 404;
  throw err;
}

async function clearDefaultFormats(pool) {
  await pool.request().query(`
    UPDATE dbo.label_print_formats SET is_default = 0, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE is_default = 1
  `);
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
  const config = normalizeLabelPrintConfig(payload.config);
  const pool = await getPool();
  const isDefault = payload.is_default === true;

  if (isDefault) await clearDefaultFormats(pool);

  try {
    await pool.request()
      .input('format_key', sql.VarChar(50), formatKey)
      .input('name', sql.NVarChar(120), name)
      .input('description', sql.NVarChar(500), payload.description || null)
      .input('config_json', sql.NVarChar(sql.MAX), JSON.stringify(config))
      .input('is_default', sql.Bit, isDefault ? 1 : 0)
      .input('sort_order', sql.Int, Number(payload.sort_order) || 0)
      .input('is_active', sql.Bit, payload.is_active === false ? 0 : 1)
      .query(`
        INSERT INTO dbo.label_print_formats (format_key, name, description, config_json, is_default, sort_order, is_active)
        VALUES (@format_key, @name, @description, @config_json, @is_default, @sort_order, @is_active)
      `);
  } catch (err) {
    if (/Invalid object name/i.test(String(err.message || ''))) {
      const e = new Error('label_print_formats table missing. Run migration 64.');
      e.statusCode = 503;
      throw e;
    }
    if (/duplicate key|UNIQUE|PK_label_print_formats/i.test(String(err.message || ''))) {
      const e = new Error('A label format with this key already exists.');
      e.statusCode = 409;
      throw e;
    }
    throw err;
  }
  return getLabelPrintFormat(formatKey);
}

async function updateLabelPrintFormat(formatKey, payload) {
  const key = String(formatKey || '').trim();
  await getLabelPrintFormat(key);

  const pool = await getPool();
  const sets = [];
  const req = pool.request().input('format_key', sql.VarChar(50), key);

  if (payload.name !== undefined) {
    const name = String(payload.name || '').trim();
    if (!name) {
      const err = new Error('Name cannot be empty.');
      err.statusCode = 400;
      throw err;
    }
    req.input('name', sql.NVarChar(120), name);
    sets.push('name = @name');
  }
  if (payload.description !== undefined) {
    req.input('description', sql.NVarChar(500), payload.description || null);
    sets.push('description = @description');
  }
  if (payload.config !== undefined) {
    const config = normalizeLabelPrintConfig(payload.config);
    req.input('config_json', sql.NVarChar(sql.MAX), JSON.stringify(config));
    sets.push('config_json = @config_json');
  }
  if (payload.sort_order !== undefined) {
    req.input('sort_order', sql.Int, Number(payload.sort_order) || 0);
    sets.push('sort_order = @sort_order');
  }
  if (payload.is_active !== undefined) {
    req.input('is_active', sql.Bit, payload.is_active === false ? 0 : 1);
    sets.push('is_active = @is_active');
  }
  if (payload.is_default === true) {
    await clearDefaultFormats(pool);
    req.input('is_default', sql.Bit, 1);
    sets.push('is_default = @is_default');
  } else if (payload.is_default === false) {
    req.input('is_default', sql.Bit, 0);
    sets.push('is_default = @is_default');
  }

  if (!sets.length) {
    return getLabelPrintFormat(key);
  }

  sets.push('updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())');

  try {
    await req.query(`
      UPDATE dbo.label_print_formats
      SET ${sets.join(', ')}
      WHERE format_key = @format_key
    `);
  } catch (err) {
    if (/Invalid object name/i.test(String(err.message || ''))) {
      const e = new Error('label_print_formats table missing. Run migration 64.');
      e.statusCode = 503;
      throw e;
    }
    throw err;
  }
  return getLabelPrintFormat(key);
}

async function deleteLabelPrintFormat(formatKey) {
  const key = String(formatKey || '').trim();
  const existing = await getLabelPrintFormat(key);
  const pool = await getPool();
  try {
    await pool.request()
      .input('format_key', sql.VarChar(50), key)
      .query(`
        UPDATE dbo.label_print_formats
        SET is_active = 0, is_default = 0, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
        WHERE format_key = @format_key
      `);
  } catch (err) {
    if (/Invalid object name/i.test(String(err.message || ''))) {
      const e = new Error('label_print_formats table missing. Run migration 64.');
      e.statusCode = 503;
      throw e;
    }
    throw err;
  }
  if (existing.is_default) {
    try {
      await pool.request()
        .input('format_key', sql.VarChar(50), key)
        .query(`
          UPDATE TOP (1) dbo.label_print_formats
          SET is_default = 1, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
          WHERE is_active = 1 AND format_key <> @format_key
        `);
    } catch (_e) {
      /* ignore */
    }
  }
  return { format_key: key, deleted: true };
}

module.exports = {
  listLabelPrintFormats,
  getLabelPrintFormat,
  createLabelPrintFormat,
  updateLabelPrintFormat,
  deleteLabelPrintFormat
};
