const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure, getPool } = require('../config/db');
const { withCache, clearCacheByPrefix } = require('../cache/ttlCache');
const {
  isSuperAdmin,
  hasModuleAccess,
  hasPermission,
  requireModule,
  requirePermission
} = require('../middleware/authorize');

/** Primary warehouse label + id for Foundry / StorePilot UIs (read-only). */
function warehouseContextAuth(req, res, next) {
  if (isSuperAdmin(req)) return next();
  if (hasModuleAccess(req, 'foundry')) return next();
  if (hasModuleAccess(req, 'storepilot')) return next();
  return res.status(403).json({ success: false, message: 'Module access denied.' });
}

const router = express.Router();

const PRODUCT_TYPE_LOOKUP = 'product_type';
const FULFILLMENT_MODES = ['INSTANT', 'LAB', 'DUAL'];
const LENS_WIZARD_POLICIES = ['NEVER', 'OPTIONAL', 'REQUIRED'];

function normalizeProductTypeKey(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function defaultLensWizardPolicy(fulfillmentMode) {
  return fulfillmentMode === 'DUAL' ? 'OPTIONAL' : 'NEVER';
}

/** Map pos_product_type_config row → foundry_lookup_values shape for UI compat. */
function mapProductTypeToLookup(row) {
  return {
    lookup_id: row.config_id,
    lookup_type: PRODUCT_TYPE_LOOKUP,
    lookup_key: row.product_type_key,
    lookup_label: row.label,
    description: row.description || null,
    display_order: row.display_order ?? 0,
    is_active: row.is_active !== false && row.is_active !== 0,
    fulfillment_mode: row.fulfillment_mode,
    requires_unit_barcode: row.requires_unit_barcode !== false && row.requires_unit_barcode !== 0,
    lens_wizard_policy: row.lens_wizard_policy || 'NEVER',
    config_id: row.config_id,
    product_type_key: row.product_type_key
  };
}

async function fetchProductTypesFromConfig(pool, { activeOnly }) {
  const result = await pool.request().query(`
    SELECT
      config_id,
      product_type_key,
      label,
      description,
      display_order,
      fulfillment_mode,
      rx_required,
      allow_qty_gt_1,
      is_active,
      ISNULL(lens_wizard_policy, N'NEVER') AS lens_wizard_policy,
      CAST(requires_unit_barcode AS BIT) AS requires_unit_barcode
    FROM dbo.pos_product_type_config
    ${activeOnly ? 'WHERE is_active = 1' : ''}
    ORDER BY display_order, label, product_type_key
  `);
  return (result.recordset || []).map(mapProductTypeToLookup);
}

async function fetchProductTypeByConfigId(pool, configId) {
  const result = await pool.request()
    .input('config_id', sql.Int, configId)
    .query(`
      SELECT
        config_id,
        product_type_key,
        label,
        description,
        display_order,
        fulfillment_mode,
        is_active,
        ISNULL(lens_wizard_policy, N'NEVER') AS lens_wizard_policy,
        CAST(requires_unit_barcode AS BIT) AS requires_unit_barcode
      FROM dbo.pos_product_type_config
      WHERE config_id = @config_id
    `);
  const row = result.recordset && result.recordset[0];
  return row ? mapProductTypeToLookup(row) : null;
}

// GET /api/foundry-lookups/warehouse-context — must stay above `/:id` routes
router.get('/warehouse-context', warehouseContextAuth, async (req, res, next) => {
  try {
    const pool = await getPool();
    const q = await pool.request().query(`
      SELECT
        dbo.fn_Foundry_PrimaryWarehouseLocationId() AS primary_warehouse_location_id,
        CAST(dbo.fn_Foundry_WarehouseDisplayName() AS NVARCHAR(200)) AS warehouse_display_name
    `);
    const row = (q.recordset && q.recordset[0]) || {};
    const wid = row.primary_warehouse_location_id;
    if (wid == null || Number.isNaN(Number(wid))) {
      return res.status(503).json({
        success: false,
        message:
          'Primary warehouse not configured. Run sql/migrations/46_foundry_primary_warehouse_functions.sql, set app_settings.foundry_primary_warehouse_location_id, or ensure an active HQ store exists.'
      });
    }
    return res.json({
      success: true,
      data: {
        primary_warehouse_location_id: Number(wid),
        warehouse_display_name: row.warehouse_display_name || 'Warehouse'
      }
    });
  } catch (err) {
    if (err.code === 'EREQUEST' || /Invalid object name|Could not find stored procedure|fn_Foundry/i.test(String(err.message || ''))) {
      return res.status(503).json({
        success: false,
        message:
          'Primary warehouse functions missing. Deploy sql/migrations/46_foundry_primary_warehouse_functions.sql against this database.'
      });
    }
    return next(err);
  }
});

/** ?type= — Foundry form dropdowns; no type — full admin list (Command Unit). */
function foundryLookupListAuth(req, res, next) {
  if (isSuperAdmin(req)) return next();
  if (req.query.type) {
    if (!hasModuleAccess(req, 'foundry')) {
      return res.status(403).json({ success: false, message: 'Module access denied.' });
    }
    if (
      !hasPermission(req, 'foundry.purchases.view')
      && !hasPermission(req, 'foundry.branding.view')
      && !hasPermission(req, 'foundry.digitisation.view')
    ) {
      return res.status(403).json({ success: false, message: 'Permission denied.' });
    }
    return next();
  }
  if (hasModuleAccess(req, 'command_unit') && hasPermission(req, 'command_unit.settings.edit')) {
    return next();
  }
  // Foundry users need all lookup types to populate form dropdowns (branding, new purchase, digitisation, etc.)
  if (
    hasModuleAccess(req, 'foundry')
    && (
      hasPermission(req, 'foundry.purchases.view')
      || hasPermission(req, 'foundry.branding.view')
      || hasPermission(req, 'foundry.digitisation.view')
    )
  ) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Permission denied.' });
}

const createSchema = Joi.object({
  lookup_type:   Joi.string().max(50).required(),
  lookup_key:    Joi.string().max(100).required(),
  lookup_label:  Joi.string().max(200).required(),
  description:   Joi.string().max(500).allow(null, '').optional(),
  display_order: Joi.number().integer().min(0).optional(),
  is_active:     Joi.boolean().optional(),
  __is_active:   Joi.boolean().optional()
});

const updateSchema = Joi.object({
  lookup_key:    Joi.string().max(100).allow(null, '').optional(),
  lookup_label:  Joi.string().max(200).required(),
  description:   Joi.string().max(500).allow(null, '').optional(),
  display_order: Joi.number().integer().min(0).optional(),
  is_active:     Joi.boolean().optional()
});

// GET /api/foundry-lookups?type=source_type  — active values for one type
// GET /api/foundry-lookups                   — all values (all types, for admin)
router.get(
  '/',
  foundryLookupListAuth,
  withCache((req) => `foundry-lookups:${String(req.query.type || 'all').toLowerCase()}`, 5 * 60 * 1000, async (req) => {
    const { type } = req.query;
    const typeNorm = type ? String(type).toLowerCase() : null;

    if (typeNorm === PRODUCT_TYPE_LOOKUP) {
      const pool = await getPool();
      const data = await fetchProductTypesFromConfig(pool, { activeOnly: true });
      return { success: true, data };
    }

    if (!typeNorm) {
      const pool = await getPool();
      const result = await executeStoredProcedure('sp_FoundryLookup_GetAll', {});
      const other = (result.recordset || []).filter(
        (r) => String(r.lookup_type || '').toLowerCase() !== PRODUCT_TYPE_LOOKUP
      );
      const productTypes = await fetchProductTypesFromConfig(pool, { activeOnly: false });
      return { success: true, data: [...other, ...productTypes] };
    }

    const result = await executeStoredProcedure('sp_FoundryLookup_GetByType', {
      lookup_type: { type: sql.VarChar(50), value: type }
    });
    return { success: true, data: result.recordset || [] };
  })
);

// POST /api/foundry-lookups
router.post(
  '/',
  requireModule('command_unit'),
  requirePermission('command_unit.settings.edit'),
  async (req, res, next) => {
    try {
      const { error, value } = createSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
      }

      if (String(value.lookup_type).toLowerCase() === PRODUCT_TYPE_LOOKUP) {
        const key = normalizeProductTypeKey(value.lookup_key);
        if (!key) {
          return res.status(400).json({ success: false, message: 'Product type key is required.' });
        }
        const fulfillment = FULFILLMENT_MODES.includes(req.body.fulfillment_mode)
          ? req.body.fulfillment_mode
          : 'INSTANT';
        const lensPolicy = LENS_WIZARD_POLICIES.includes(req.body.lens_wizard_policy)
          ? req.body.lens_wizard_policy
          : defaultLensWizardPolicy(fulfillment);
        const pool = await getPool();
        const reqIns = pool.request();
        reqIns.input('product_type_key', sql.NVarChar(100), key);
        reqIns.input('label', sql.NVarChar(200), value.lookup_label);
        reqIns.input('description', sql.NVarChar(500), value.description || null);
        reqIns.input('display_order', sql.Int, value.display_order || 0);
        reqIns.input('fulfillment_mode', sql.VarChar(10), fulfillment);
        reqIns.input('requires_unit_barcode', sql.Bit, req.body.requires_unit_barcode !== false ? 1 : 0);
        reqIns.input('lens_wizard_policy', sql.NVarChar(10), lensPolicy);
        let insertResult;
        try {
          insertResult = await reqIns.query(`
            INSERT INTO dbo.pos_product_type_config (
              product_type_key, label, description, display_order,
              fulfillment_mode, requires_unit_barcode, lens_wizard_policy,
              rx_required, allow_qty_gt_1, is_active
            )
            OUTPUT INSERTED.config_id
            VALUES (
              @product_type_key, @label, @description, @display_order,
              @fulfillment_mode, @requires_unit_barcode, @lens_wizard_policy,
              0, 1, 1
            );
          `);
        } catch (err) {
          if (err.number === 2627 || err.number === 2601) {
            return res.status(422).json({ success: false, message: 'A product type with this key already exists.' });
          }
          throw err;
        }
        clearCacheByPrefix('foundry-lookups:');
        const newId = insertResult.recordset && insertResult.recordset[0]
          ? Number(insertResult.recordset[0].config_id)
          : null;
        const created = newId ? await fetchProductTypeByConfigId(pool, newId) : null;
        return res.status(201).json({ success: true, data: created });
      }

      const result = await executeStoredProcedure('sp_FoundryLookup_Create', {
        lookup_type:   { type: sql.VarChar(50),  value: value.lookup_type },
        lookup_key:    { type: sql.VarChar(100), value: value.lookup_key.toUpperCase().replace(/\s+/g, '_') },
        lookup_label:  { type: sql.VarChar(200), value: value.lookup_label },
        description:   { type: sql.VarChar(500), value: value.description || null },
        display_order: { type: sql.Int,          value: value.display_order || 0 }
      });
      clearCacheByPrefix('foundry-lookups:');

      return res.status(201).json({ success: true, data: result.recordset && result.recordset[0] });
    } catch (err) {
      if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
      return next(err);
    }
  }
);

// PUT /api/foundry-lookups/:id
router.put(
  '/:id',
  requireModule('command_unit'),
  requirePermission('command_unit.settings.edit'),
  async (req, res, next) => {
    try {
      const lookupId = Number(req.params.id);
      const { error, value } = updateSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
      }

      const pool = await getPool();
      const existingPt = await fetchProductTypeByConfigId(pool, lookupId);
      if (existingPt) {
        const keyNorm = value.lookup_key != null && String(value.lookup_key).trim() !== ''
          ? normalizeProductTypeKey(value.lookup_key)
          : existingPt.lookup_key;
        const fulfillment = FULFILLMENT_MODES.includes(req.body.fulfillment_mode)
          ? req.body.fulfillment_mode
          : existingPt.fulfillment_mode;
        const lensPolicy = LENS_WIZARD_POLICIES.includes(req.body.lens_wizard_policy)
          ? req.body.lens_wizard_policy
          : existingPt.lens_wizard_policy;
        const reqUp = pool.request();
        reqUp.input('config_id', sql.Int, lookupId);
        reqUp.input('product_type_key', sql.NVarChar(100), keyNorm);
        reqUp.input('label', sql.NVarChar(200), value.lookup_label);
        reqUp.input('description', sql.NVarChar(500), value.description || null);
        reqUp.input('display_order', sql.Int, value.display_order ?? 0);
        reqUp.input('is_active', sql.Bit, value.is_active !== false ? 1 : 0);
        reqUp.input('fulfillment_mode', sql.VarChar(10), fulfillment);
        reqUp.input('lens_wizard_policy', sql.NVarChar(10), lensPolicy);
        reqUp.input(
          'requires_unit_barcode',
          sql.Bit,
          req.body.requires_unit_barcode != null
            ? (req.body.requires_unit_barcode ? 1 : 0)
            : (existingPt.requires_unit_barcode ? 1 : 0)
        );
        try {
          await reqUp.query(`
            UPDATE dbo.pos_product_type_config
            SET
              product_type_key = @product_type_key,
              label = @label,
              description = @description,
              display_order = @display_order,
              is_active = @is_active,
              fulfillment_mode = @fulfillment_mode,
              lens_wizard_policy = @lens_wizard_policy,
              requires_unit_barcode = @requires_unit_barcode
            WHERE config_id = @config_id;
          `);
        } catch (err) {
          if (err.number === 2627 || err.number === 2601) {
            return res.status(422).json({ success: false, message: 'A product type with this key already exists.' });
          }
          throw err;
        }
        clearCacheByPrefix('foundry-lookups:');
        const updated = await fetchProductTypeByConfigId(pool, lookupId);
        return res.json({ success: true, data: updated });
      }

      const keyNorm = value.lookup_key != null && String(value.lookup_key).trim() !== ''
        ? String(value.lookup_key).toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
        : null;
      const result = await executeStoredProcedure('sp_FoundryLookup_Update', {
        lookup_id:     { type: sql.Int,          value: lookupId },
        lookup_label:  { type: sql.VarChar(200), value: value.lookup_label },
        description:   { type: sql.VarChar(500), value: value.description || null },
        display_order: { type: sql.Int,          value: value.display_order ?? 0 },
        is_active:     { type: sql.Bit,          value: value.is_active !== false ? 1 : 0 },
        lookup_key:    { type: sql.VarChar(100), value: keyNorm }
      });
      clearCacheByPrefix('foundry-lookups:');

      return res.json({ success: true, data: result.recordset && result.recordset[0] });
    } catch (err) {
      if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
      return next(err);
    }
  }
);

// DELETE /api/foundry-lookups/:id  — soft delete
router.delete(
  '/:id',
  requireModule('command_unit'),
  requirePermission('command_unit.settings.edit'),
  async (req, res, next) => {
    try {
      const lookupId = Number(req.params.id);
      const pool = await getPool();
      const existingPt = await fetchProductTypeByConfigId(pool, lookupId);
      if (existingPt) {
        await pool.request()
          .input('config_id', sql.Int, lookupId)
          .query(`
            UPDATE dbo.pos_product_type_config
            SET is_active = 0
            WHERE config_id = @config_id;
          `);
        clearCacheByPrefix('foundry-lookups:');
        return res.json({
          success: true,
          data: { lookup_id: lookupId, is_active: false, lookup_type: PRODUCT_TYPE_LOOKUP }
        });
      }

      const result = await executeStoredProcedure('sp_FoundryLookup_Delete', {
        lookup_id: { type: sql.Int, value: lookupId }
      });
      clearCacheByPrefix('foundry-lookups:');
      return res.json({ success: true, data: result.recordset && result.recordset[0] });
    } catch (err) {
      if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
      return next(err);
    }
  }
);

module.exports = router;
