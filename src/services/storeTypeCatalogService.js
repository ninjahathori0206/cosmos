'use strict';

const sql = require('mssql');
const { getPool } = require('../config/db');
const { getStoreTypeRoleKeys, isKnownStoreTypeRole } = require('../config/storeTypeRolesCatalog');

/** In-memory defaults when dbo.store_type_catalog is empty (read-only; not written to SQL). */
const FALLBACK_SEED = Object.freeze([
  {
    key: 'HQ',
    label: 'Corporate HQ (warehouse hub)',
    description:
      'Foundry primary warehouse hub. WAREHOUSE stock uses this store_id as stock_balances.location_id.',
    sort_order: 10,
    is_active: true,
    roles: ['warehouse_hub']
  },
  { key: 'Owned', label: 'Eyewoot-Owned', description: null, sort_order: 20, is_active: true, roles: [] },
  { key: 'Franchise', label: 'Franchise', description: null, sort_order: 30, is_active: true, roles: [] },
  { key: 'Kiosk', label: 'Kiosk / Pop-up', description: null, sort_order: 40, is_active: true, roles: [] },
  { key: 'Online', label: 'Online / D2C', description: null, sort_order: 50, is_active: true, roles: [] }
]);

let memoryCache = null;

function normalizeRow(row) {
  return {
    key: String(row.key || row.type_key || ''),
    label: String(row.label || ''),
    description: row.description != null && String(row.description).trim() !== '' ? String(row.description) : null,
    sort_order: Number(row.sort_order) || 0,
    is_active: row.is_active !== false && row.is_active !== 0,
    roles: Array.isArray(row.roles) ? [...row.roles] : []
  };
}

async function loadRolesByTypeKey(pool) {
  const map = new Map();
  try {
    const q = await pool.request().query(`
      SELECT type_key, role_key
      FROM dbo.store_type_catalog_roles
      ORDER BY type_key, role_key
    `);
    for (const r of q.recordset || []) {
      const k = String(r.type_key || '');
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(String(r.role_key || ''));
    }
  } catch (err) {
    if (!/Invalid object name/i.test(String(err.message || ''))) throw err;
  }
  return map;
}

async function refreshStoreTypeCatalogCache() {
  const pool = await getPool();
  let rows = [];
  try {
    const q = await pool.request().query(`
      SELECT
        type_key,
        label,
        description,
        sort_order,
        CAST(COALESCE(is_active, 1) AS BIT) AS is_active
      FROM dbo.store_type_catalog
      ORDER BY sort_order, type_key
    `);
    rows = q.recordset || [];
  } catch (err) {
    if (!/Invalid object name/i.test(String(err.message || ''))) throw err;
  }

  if (!rows.length) {
    memoryCache = FALLBACK_SEED.map(normalizeRow);
    return memoryCache;
  }

  const roleMap = await loadRolesByTypeKey(pool);
  memoryCache = rows.map((r) =>
    normalizeRow({
      key: r.type_key,
      label: r.label,
      description: r.description,
      sort_order: r.sort_order,
      is_active: r.is_active,
      roles: roleMap.get(String(r.type_key || '')) || []
    })
  );
  return memoryCache;
}

function invalidateStoreTypeCatalogCache() {
  memoryCache = null;
}

async function getCatalogRows({ activeOnly = false } = {}) {
  const rows = memoryCache || (await refreshStoreTypeCatalogCache());
  if (!activeOnly) return rows.map((r) => ({ ...r, roles: [...r.roles] }));
  return rows
    .filter((r) => r.is_active)
    .map((r) => ({ ...r, roles: [...r.roles] }));
}

async function isAllowedStoreTypeAsync(typeKey) {
  const keys = (await getCatalogRows({ activeOnly: true })).map((r) => r.key);
  return keys.includes(String(typeKey || ''));
}

async function replaceRolesForType(pool, typeKey, roles) {
  await pool
    .request()
    .input('type_key', sql.VarChar(50), typeKey)
    .query('DELETE FROM dbo.store_type_catalog_roles WHERE type_key = @type_key');

  const unique = [...new Set((roles || []).map((r) => String(r).trim()).filter(Boolean))];
  for (const roleKey of unique) {
    if (!isKnownStoreTypeRole(roleKey)) {
      const err = new Error(`Unknown store type role: ${roleKey}`);
      err.statusCode = 400;
      throw err;
    }
    await pool
      .request()
      .input('type_key', sql.VarChar(50), typeKey)
      .input('role_key', sql.VarChar(50), roleKey)
      .query(`
        INSERT INTO dbo.store_type_catalog_roles (type_key, role_key)
        VALUES (@type_key, @role_key)
      `);
  }
}

async function createStoreType({ type_key, label, description, sort_order, roles, is_active }) {
  const pool = await getPool();
  const key = String(type_key || '').trim();
  await pool
    .request()
    .input('type_key', sql.VarChar(50), key)
    .input('label', sql.NVarChar(200), label)
    .input('description', sql.NVarChar(500), description || null)
    .input('sort_order', sql.Int, sort_order != null ? sort_order : 100)
    .input('is_active', sql.Bit, is_active !== false)
    .query(`
      INSERT INTO dbo.store_type_catalog (type_key, label, description, sort_order, is_active)
      VALUES (@type_key, @label, @description, @sort_order, @is_active)
    `);
  await replaceRolesForType(pool, key, roles);
  invalidateStoreTypeCatalogCache();
  return (await getCatalogRows()).find((r) => r.key === key);
}

async function updateStoreType(typeKey, { label, description, sort_order, roles, is_active }) {
  const pool = await getPool();
  const key = String(typeKey || '').trim();
  const sets = ['updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())'];
  const req = pool.request().input('type_key', sql.VarChar(50), key);

  if (label != null) {
    sets.push('label = @label');
    req.input('label', sql.NVarChar(200), label);
  }
  if (description !== undefined) {
    sets.push('description = @description');
    req.input('description', sql.NVarChar(500), description || null);
  }
  if (sort_order != null) {
    sets.push('sort_order = @sort_order');
    req.input('sort_order', sql.Int, sort_order);
  }
  if (is_active != null) {
    sets.push('is_active = @is_active');
    req.input('is_active', sql.Bit, is_active !== false);
  }

  const result = await req.query(`
    UPDATE dbo.store_type_catalog
    SET ${sets.join(', ')}
    WHERE type_key = @type_key
  `);
  if (!result.rowsAffected[0]) {
    const err = new Error('Store type not found.');
    err.statusCode = 404;
    throw err;
  }
  if (roles != null) await replaceRolesForType(pool, key, roles);
  invalidateStoreTypeCatalogCache();
  return (await getCatalogRows()).find((r) => r.key === key);
}

async function countStoresUsingType(typeKey) {
  const pool = await getPool();
  const q = await pool
    .request()
    .input('type_key', sql.VarChar(50), typeKey)
    .query('SELECT COUNT(*) AS cnt FROM dbo.stores WHERE store_type = @type_key');
  return Number(q.recordset[0]?.cnt || 0);
}

async function deactivateStoreType(typeKey) {
  const inUse = await countStoresUsingType(typeKey);
  if (inUse > 0) {
    const err = new Error(
      `Cannot deactivate: ${inUse} store(s) still use this format. Reassign those stores first.`
    );
    err.statusCode = 422;
    throw err;
  }
  return updateStoreType(typeKey, { is_active: false });
}

module.exports = {
  FALLBACK_SEED,
  refreshStoreTypeCatalogCache,
  invalidateStoreTypeCatalogCache,
  getCatalogRows,
  isAllowedStoreTypeAsync,
  createStoreType,
  updateStoreType,
  deactivateStoreType,
  countStoresUsingType,
  getStoreTypeRoleKeys
};
