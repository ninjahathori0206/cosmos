'use strict';

const sql = require('mssql');
const { getPool } = require('../config/db');
const { isValidGatepassPurposeBadgeVariant } = require('../config/gatepassPurposeBadgeCatalog');

/** Fallback when table missing or empty (matches migration 94 seed). */
const FALLBACK_SEED = Object.freeze([
  { key: 'order', label: 'Buying frames', badgeVariant: 'blue', sort_order: 10, is_active: true },
  { key: 'eye_test', label: 'Eye test', badgeVariant: 'purple', sort_order: 20, is_active: true },
  { key: 'handover', label: 'Collecting order', badgeVariant: 'amber', sort_order: 30, is_active: true },
  { key: 'general', label: 'General', badgeVariant: 'gray', sort_order: 40, is_active: true }
]);

let memoryCache = null;

function normalizeRow(row) {
  return {
    key: String(row.key || row.purpose_key || ''),
    label: String(row.label || ''),
    badgeVariant: String(row.badgeVariant || row.badge_variant || 'gray').toLowerCase(),
    sort_order: Number(row.sort_order) || 100,
    is_active: row.is_active !== false && row.is_active !== 0
  };
}

function invalidateGatepassPurposeCatalogCache() {
  memoryCache = null;
}

async function refreshGatepassPurposeCatalogCache() {
  const pool = await getPool();
  let rows = [];
  try {
    const q = await pool.request().query(`
      SELECT
        purpose_key,
        label,
        badge_variant,
        sort_order,
        CAST(COALESCE(is_active, 1) AS BIT) AS is_active
      FROM dbo.gatepass_purpose_catalog
      ORDER BY sort_order, purpose_key
    `);
    rows = q.recordset || [];
  } catch (err) {
    if (!/Invalid object name/i.test(String(err.message || ''))) throw err;
  }

  if (!rows.length) {
    memoryCache = FALLBACK_SEED.map(normalizeRow);
    return memoryCache;
  }

  memoryCache = rows.map((r) =>
    normalizeRow({
      key: r.purpose_key,
      label: r.label,
      badgeVariant: r.badge_variant,
      sort_order: r.sort_order,
      is_active: r.is_active
    })
  );
  return memoryCache;
}

async function getCatalogRows({ activeOnly = false } = {}) {
  const rows = memoryCache || (await refreshGatepassPurposeCatalogCache());
  const list = rows.map((r) => ({ ...r }));
  if (!activeOnly) return list;
  return list.filter((r) => r.is_active);
}

/** API shape for meta / dropdowns: { key, label, badgeVariant } */
async function getGatepassPurposeCatalogForApi({ activeOnly = true } = {}) {
  const rows = await getCatalogRows({ activeOnly });
  return rows.map((r) => ({
    key: r.key,
    label: r.label,
    badgeVariant: r.badgeVariant
  }));
}

async function getGatepassPurposeMeta(key) {
  const k = String(key || '').trim().toLowerCase();
  const rows = await getCatalogRows({ activeOnly: false });
  return rows.find((p) => p.key === k) || null;
}

async function isValidGatepassPurpose(key) {
  if (key == null || String(key).trim() === '') return true;
  const k = String(key).trim().toLowerCase();
  const rows = await getCatalogRows({ activeOnly: true });
  return rows.some((p) => p.key === k);
}

async function countVisitorsUsingPurpose(purposeKey) {
  const pool = await getPool();
  try {
    const q = await pool
      .request()
      .input('purpose_key', sql.VarChar(50), purposeKey)
      .query(`
        SELECT COUNT(1) AS cnt
        FROM dbo.store_visitors
        WHERE LOWER(LTRIM(RTRIM(purpose))) = LOWER(@purpose_key)
      `);
    return Number(q.recordset?.[0]?.cnt) || 0;
  } catch (err) {
    if (!/Invalid object name/i.test(String(err.message || ''))) throw err;
    return 0;
  }
}

async function createPurpose({ purpose_key, label, badge_variant, sort_order, is_active }) {
  const pool = await getPool();
  const key = String(purpose_key || '').trim().toLowerCase();
  const badge = String(badge_variant || 'gray').trim().toLowerCase();
  if (!isValidGatepassPurposeBadgeVariant(badge)) {
    const err = new Error('Invalid badge variant.');
    err.statusCode = 400;
    throw err;
  }
  await pool
    .request()
    .input('purpose_key', sql.VarChar(50), key)
    .input('label', sql.NVarChar(200), label)
    .input('badge_variant', sql.VarChar(20), badge)
    .input('sort_order', sql.Int, sort_order != null ? sort_order : 100)
    .input('is_active', sql.Bit, is_active !== false)
    .query(`
      INSERT INTO dbo.gatepass_purpose_catalog (purpose_key, label, badge_variant, sort_order, is_active, updated_at)
      VALUES (@purpose_key, @label, @badge_variant, @sort_order, @is_active, DATEADD(MINUTE, 330, SYSUTCDATETIME()))
    `);
  invalidateGatepassPurposeCatalogCache();
  return normalizeRow({
    key,
    label,
    badgeVariant: badge,
    sort_order,
    is_active: is_active !== false
  });
}

async function updatePurpose(purposeKey, patch) {
  const pool = await getPool();
  const key = String(purposeKey || '').trim().toLowerCase();
  const existing = await getGatepassPurposeMeta(key);
  if (!existing) {
    const err = new Error('Purpose not found.');
    err.statusCode = 404;
    throw err;
  }
  const label = patch.label != null ? String(patch.label).trim() : existing.label;
  const badge =
    patch.badge_variant != null
      ? String(patch.badge_variant).trim().toLowerCase()
      : existing.badgeVariant;
  if (!isValidGatepassPurposeBadgeVariant(badge)) {
    const err = new Error('Invalid badge variant.');
    err.statusCode = 400;
    throw err;
  }
  const sortOrder = patch.sort_order != null ? Number(patch.sort_order) : existing.sort_order;
  const isActive = patch.is_active != null ? patch.is_active !== false : existing.is_active;

  await pool
    .request()
    .input('purpose_key', sql.VarChar(50), key)
    .input('label', sql.NVarChar(200), label)
    .input('badge_variant', sql.VarChar(20), badge)
    .input('sort_order', sql.Int, Number.isFinite(sortOrder) ? sortOrder : 100)
    .input('is_active', sql.Bit, isActive)
    .query(`
      UPDATE dbo.gatepass_purpose_catalog
      SET label = @label,
          badge_variant = @badge_variant,
          sort_order = @sort_order,
          is_active = @is_active,
          updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      WHERE purpose_key = @purpose_key
    `);
  invalidateGatepassPurposeCatalogCache();
  const row = await getGatepassPurposeMeta(key);
  return { ...row, visitor_count: await countVisitorsUsingPurpose(key) };
}

async function deactivatePurpose(purposeKey) {
  const key = String(purposeKey || '').trim().toLowerCase();
  const cnt = await countVisitorsUsingPurpose(key);
  if (cnt > 0) {
    const err = new Error(
      `Cannot deactivate: ${cnt} visit record(s) use this purpose. Deactivate only when unused, or keep active.`
    );
    err.statusCode = 422;
    throw err;
  }
  return updatePurpose(key, { is_active: false });
}

async function getAdminCatalog() {
  const rows = await getCatalogRows({ activeOnly: false });
  const withCounts = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      visitor_count: await countVisitorsUsingPurpose(row.key)
    }))
  );
  return withCounts;
}

module.exports = {
  FALLBACK_SEED,
  invalidateGatepassPurposeCatalogCache,
  refreshGatepassPurposeCatalogCache,
  getCatalogRows,
  getGatepassPurposeCatalogForApi,
  getGatepassPurposeMeta,
  isValidGatepassPurpose,
  getAdminCatalog,
  createPurpose,
  updatePurpose,
  deactivatePurpose,
  countVisitorsUsingPurpose
};
