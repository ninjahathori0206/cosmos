const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure, getPool } = require('../config/db');
const { clearCacheByPrefix } = require('../cache/ttlCache');
const { requireModule, requireAnyModule, requirePermission } = require('../middleware/authorize');
const { getGatepassPurposeBadgeVariants } = require('../config/gatepassPurposeBadgeCatalog');
const {
  getAdminCatalog,
  createPurpose,
  updatePurpose,
  deactivatePurpose
} = require('../services/gatepassPurposeCatalogService');
const { writeAuditLog } = require('../services/auditService');
const { wallClockIso } = require('../lib/cosmosIst');
const { SCOPE_DIMENSIONS, ALLOWED_SCOPE_KINDS } = require('../config/offerScopeDimensions');
const {
  validateScopeRefs,
  replaceOfferScopes,
  loadScopesGrouped
} = require('../services/customerOfferDiscountService');
const {
  OFFER_DISCOUNT_TYPES,
  TRIGGER_TYPES,
  BENEFIT_TARGETS,
  SCOPE_MODES,
  isStructuredOfferType,
  structuredOfferTypeRespectsAllocation
} = require('../config/customerOfferDiscountTypes')
const { CAPABILITY_KEYS } = require('../config/membershipCapabilityGroups');
const {
  getCosmosTimeSnapshot,
  setThresholdMinutes,
  evaluateCosmosTimeHealth
} = require('../services/cosmosTimeHealthService');

const router = express.Router();

const settingsView = [requireModule('command_unit'), requirePermission('command_unit.settings.view')];
const settingsManage = [requireModule('command_unit'), requirePermission('command_unit.settings.edit')];

const purposeCatalogView = [
  requireAnyModule(['command_unit', 'cx']),
  requirePermission('command_unit.settings.view', 'cx.admin', 'cx.customers.view')
];
const purposeCatalogManage = [
  requireAnyModule(['command_unit', 'cx']),
  requirePermission('command_unit.settings.edit', 'cx.admin')
];
/** Eyewoot Go customer_offers — view/manage from Command Unit → Promotion (fallback to settings perm until roles are seeded). */
const promotionsView = [
  requireModule('command_unit'),
  requirePermission('command_unit.promotions.view', 'command_unit.settings.view')
];
const promotionsManage = [
  requireModule('command_unit'),
  requirePermission('command_unit.promotions.manage', 'command_unit.settings.edit')
];
const posSettingsPutSchema = Joi.object({
  lab_advance_pct: Joi.number().min(0).max(100),
  gst_rate_pct: Joi.number().min(0).max(100),
  composition_scheme: Joi.boolean(),
  prices_gst_inclusive: Joi.boolean()
}).min(1);

const cosmosTimePutSchema = Joi.object({
  threshold_minutes: Joi.number().integer().min(1).max(60).required()
});

const cosmosTimeDeviceQuerySchema = Joi.object({
  device_ist_wire: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/).optional()
});

async function upsertAppSetting(pool, {
  settingKey,
  settingValue,
  settingGroup,
  description
}) {
  await pool.request()
    .input('setting_key', sql.NVarChar(100), settingKey)
    .input('setting_value', sql.NVarChar(400), settingValue)
    .input('setting_group', sql.NVarChar(50), settingGroup)
    .input('description', sql.NVarChar(500), description)
    .query(`
        MERGE dbo.app_settings AS tgt
        USING (SELECT @setting_key AS setting_key) AS src
        ON tgt.setting_key = src.setting_key
        WHEN MATCHED THEN
          UPDATE SET
            setting_value = @setting_value,
            setting_group = @setting_group,
            description = @description,
            updated_at = DATEADD(MINUTE,330,SYSUTCDATETIME())
        WHEN NOT MATCHED THEN
          INSERT (setting_key, setting_value, setting_group, description)
          VALUES (@setting_key, @setting_value, @setting_group, @description);
    `);
}

function truthyPosSetting(val) {
  const s = String(val ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

// ─── POS SETTINGS ────────────────────────────────────────────────────────────
router.get('/pos', ...settingsView, async (req, res, next) => {
  try {
    const pool = await getPool();
    const rows = await pool.request().query(`
      SELECT setting_key, setting_value
      FROM dbo.app_settings
      WHERE setting_key IN (
        N'lab_advance_pct',
        N'pos_gst_rate',
        N'pos_composition_scheme',
        N'pos_prices_gst_inclusive'
      )
    `);

    const map = {};
    for (const row of (rows.recordset || [])) {
      map[row.setting_key] = row.setting_value;
    }

    const gstDecimal = Number(map.pos_gst_rate || 0.05);
    return res.json({
      success: true,
      data: {
        lab_advance_pct: Number(map.lab_advance_pct || 40),
        gst_rate_pct: Math.round(gstDecimal * 10000) / 100,
        composition_scheme: truthyPosSetting(map.pos_composition_scheme),
        prices_gst_inclusive: truthyPosSetting(map.pos_prices_gst_inclusive)
      }
    });
  } catch (err) { return next(err); }
});

router.put('/pos', ...settingsManage, async (req, res, next) => {
  try {
    const { error, value } = posSettingsPutSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }

    const pool = await getPool();
    if (value.lab_advance_pct != null) {
      await upsertAppSetting(pool, {
        settingKey: 'lab_advance_pct',
        settingValue: String(value.lab_advance_pct),
        settingGroup: 'pos',
        description: 'Lab order advance percent (0–100).'
      });
    }
    if (value.gst_rate_pct != null) {
      const dec = Math.round((Number(value.gst_rate_pct) / 100) * 10000) / 10000;
      await upsertAppSetting(pool, {
        settingKey: 'pos_gst_rate',
        settingValue: String(dec),
        settingGroup: 'pos',
        description: 'POS bill GST rate as decimal (e.g. 0.05 for 5%).'
      });
    }
    if (value.composition_scheme != null) {
      await upsertAppSetting(pool, {
        settingKey: 'pos_composition_scheme',
        settingValue: value.composition_scheme ? '1' : '0',
        settingGroup: 'pos',
        description: 'Composition: no GST on POS bill.'
      });
    }
    if (value.prices_gst_inclusive != null) {
      await upsertAppSetting(pool, {
        settingKey: 'pos_prices_gst_inclusive',
        settingValue: value.prices_gst_inclusive ? '1' : '0',
        settingGroup: 'pos',
        description: 'Catalogue prices include GST; offers apply on that base.'
      });
    }

    const rows = await pool.request().query(`
      SELECT setting_key, setting_value
      FROM dbo.app_settings
      WHERE setting_key IN (
        N'lab_advance_pct',
        N'pos_gst_rate',
        N'pos_composition_scheme',
        N'pos_prices_gst_inclusive'
      )
    `);
    const map = {};
    for (const row of (rows.recordset || [])) {
      map[row.setting_key] = row.setting_value;
    }
    const gstDecimal = Number(map.pos_gst_rate || 0.05);

    return res.json({
      success: true,
      data: {
        lab_advance_pct: Number(map.lab_advance_pct || 40),
        gst_rate_pct: Math.round(gstDecimal * 10000) / 100,
        composition_scheme: truthyPosSetting(map.pos_composition_scheme),
        prices_gst_inclusive: truthyPosSetting(map.pos_prices_gst_inclusive)
      }
    });
  } catch (err) { return next(err); }
});

// ─── INVENTORY HUB (primary warehouse = HQ store_id for WAREHOUSE stock) ─────
const {
  STORE_TYPE_ROLES,
  isStoreTypeInRole,
  filterStoresByStoreTypeRole,
  getStoreTypeRoleDefs
} = require('../config/storeTypesCatalog');
const {
  getCatalogRows,
  createStoreType,
  updateStoreType,
  deactivateStoreType,
  countStoresUsingType
} = require('../services/storeTypeCatalogService');
const { getStoreTypeRoleKeys, isKnownStoreTypeRole } = require('../config/storeTypeRolesCatalog');

const inventoryHubPutSchema = Joi.object({
  primary_warehouse_store_id: Joi.number().integer().positive().required()
});

function activeStoresOnly(stores) {
  return (Array.isArray(stores) ? stores : []).filter((s) => {
    if (!s || typeof s !== 'object') return false;
    return (
      s.is_active
      && String(s.status || 'ACTIVE').trim().toUpperCase() === 'ACTIVE'
    );
  });
}

router.get('/inventory-hub', ...settingsView, async (req, res, next) => {
  try {
    const pool = await getPool();
    const [hubQ, storesResult] = await Promise.all([
      pool.request().query(`
        SELECT
          dbo.fn_Foundry_PrimaryWarehouseLocationId() AS primary_warehouse_store_id,
          CAST(dbo.fn_Foundry_WarehouseDisplayName() AS NVARCHAR(200)) AS warehouse_display_name
      `),
      executeStoredProcedure('sp_Store_GetAll', {})
    ]);
    const row = (hubQ.recordset && hubQ.recordset[0]) || {};
    const sid = row.primary_warehouse_store_id;
    const eligibleStores = await filterStoresByStoreTypeRole(
      activeStoresOnly(storesResult.recordset || []),
      STORE_TYPE_ROLES.WAREHOUSE_HUB
    );
    if (sid == null || Number.isNaN(Number(sid))) {
      return res.json({
        success: true,
        data: {
          primary_warehouse_store_id: null,
          warehouse_display_name: null,
          configured: false,
          eligible_stores: eligibleStores
        }
      });
    }
    return res.json({
      success: true,
      data: {
        primary_warehouse_store_id: Number(sid),
        warehouse_display_name: row.warehouse_display_name || 'Warehouse',
        configured: true,
        eligible_stores: eligibleStores
      }
    });
  } catch (err) {
    if (err.code === 'EREQUEST' || /fn_Foundry|Invalid object name/i.test(String(err.message || ''))) {
      return res.status(503).json({
        success: false,
        message:
          'Primary warehouse SQL functions missing. Deploy sql/migrations/46_foundry_primary_warehouse_functions.sql.'
      });
    }
    return next(err);
  }
});

router.put('/inventory-hub', ...settingsManage, async (req, res, next) => {
  try {
    const { error, value } = inventoryHubPutSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }

    const pool = await getPool();
    const chk = await pool.request()
      .input('sid', sql.Int, value.primary_warehouse_store_id)
      .query(`
        SELECT store_id, store_type, status, is_active
        FROM dbo.stores
        WHERE store_id = @sid
      `);
    const st = chk.recordset && chk.recordset[0];
    if (!st) {
      return res.status(422).json({ success: false, message: 'Store not found.' });
    }
    if (!(await isStoreTypeInRole(st.store_type, STORE_TYPE_ROLES.WAREHOUSE_HUB))) {
      return res.status(422).json({
        success: false,
        message:
          'Primary warehouse must be a store whose format is configured as a warehouse hub (see store type catalog).'
      });
    }
    if (!st.is_active || String(st.status || '').toUpperCase() !== 'ACTIVE') {
      return res.status(422).json({
        success: false,
        message: 'Primary warehouse must be an active store (is_active = 1, status ACTIVE).'
      });
    }

    await upsertAppSetting(pool, {
      settingKey: 'foundry_primary_warehouse_location_id',
      settingValue: String(value.primary_warehouse_store_id),
      settingGroup: 'inventory',
      description: 'Primary WAREHOUSE stock_balances.location_id (HQ hub store_id).'
    });

    try {
      const { alignWarehouseStockToPrimary } = require('../services/alignWarehouseStockToPrimary');
      await alignWarehouseStockToPrimary(pool);
    } catch (alignErr) {
      console.error('[inventory-hub] alignWarehouseStockToPrimary', alignErr.message || alignErr);
    }

    try {
      await writeAuditLog({
        userId: req.user && req.user.user_id ? Number(req.user.user_id) : null,
        action: 'INVENTORY_HUB_PRIMARY_WAREHOUSE_SET',
        module: 'command_unit',
        entityType: 'app_settings',
        entityId: null,
        newValue: JSON.stringify({ primary_warehouse_store_id: value.primary_warehouse_store_id }),
        ipAddress: req.ip || null
      });
    } catch (_auditErr) {
      /* non-fatal */
    }

    const q2 = await pool.request().query(`
      SELECT
        dbo.fn_Foundry_PrimaryWarehouseLocationId() AS primary_warehouse_store_id,
        CAST(dbo.fn_Foundry_WarehouseDisplayName() AS NVARCHAR(200)) AS warehouse_display_name
    `);
    const row2 = (q2.recordset && q2.recordset[0]) || {};
    return res.json({
      success: true,
      data: {
        primary_warehouse_store_id: Number(row2.primary_warehouse_store_id),
        warehouse_display_name: row2.warehouse_display_name || 'Warehouse',
        configured: true
      }
    });
  } catch (err) {
    return next(err);
  }
});

// ─── GST RATES ───────────────────────────────────────────────────────────────

const gstSchema = Joi.object({
  hsn_sac:    Joi.string().max(50).required(),
  category:   Joi.string().max(200).required(),
  gst_rate:   Joi.number().min(0).max(100).required(),
  cgst_rate:  Joi.number().min(0).max(100).required(),
  sgst_rate:  Joi.number().min(0).max(100).required(),
  applied_to: Joi.string().max(500).allow(null, '')
});

const gstUpdateSchema = gstSchema.append({
  is_active: Joi.boolean().optional()
});

router.get('/gst-rates', ...settingsView, async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_GstRate_GetAll', {});
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) { return next(err); }
});

router.post('/gst-rates', ...settingsManage, async (req, res, next) => {
  try {
    const { error, value } = gstSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });

    const result = await executeStoredProcedure('sp_GstRate_Create', {
      hsn_sac:    { type: sql.VarChar(50),   value: value.hsn_sac },
      category:   { type: sql.VarChar(200),  value: value.category },
      gst_rate:   { type: sql.Decimal(5,2),  value: value.gst_rate },
      cgst_rate:  { type: sql.Decimal(5,2),  value: value.cgst_rate },
      sgst_rate:  { type: sql.Decimal(5,2),  value: value.sgst_rate },
      applied_to: { type: sql.VarChar(500),  value: value.applied_to || null }
    });

    return res.status(201).json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) { return next(err); }
});

router.put('/gst-rates/:id', ...settingsManage, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { error, value } = gstUpdateSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });

    const result = await executeStoredProcedure('sp_GstRate_Update', {
      gst_id:     { type: sql.Int,           value: id },
      hsn_sac:    { type: sql.VarChar(50),   value: value.hsn_sac },
      category:   { type: sql.VarChar(200),  value: value.category },
      gst_rate:   { type: sql.Decimal(5,2),  value: value.gst_rate },
      cgst_rate:  { type: sql.Decimal(5,2),  value: value.cgst_rate },
      sgst_rate:  { type: sql.Decimal(5,2),  value: value.sgst_rate },
      applied_to: { type: sql.VarChar(500),  value: value.applied_to || null },
      is_active:  { type: sql.Bit,           value: value.is_active !== false }
    });

    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) { return next(err); }
});

router.delete('/gst-rates/:id', ...settingsManage, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const result = await executeStoredProcedure('sp_GstRate_Delete', {
      gst_id: { type: sql.Int, value: id }
    });
    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) { return next(err); }
});

// ─── MEMBERSHIP TIERS ────────────────────────────────────────────────────────

const tierSchema = Joi.object({
  tier_name:           Joi.string().max(200).required(),
  annual_fee:          Joi.number().min(0).required(),
  benefits:            Joi.string().max(500).allow(null, ''),
  loyalty_tier:        Joi.string().max(50).allow(null, ''),
  promoter_commission: Joi.number().min(0).allow(null)
});

const tierUpdateSchema = tierSchema.append({
  is_active: Joi.boolean().optional()
});

router.get('/membership-tiers', ...settingsView, async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_MembershipTier_GetAll', {});
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) { return next(err); }
});

router.post('/membership-tiers', async (req, res, next) => {
  try {
    const { error, value } = tierSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });

    const userId = req.user && req.user.user_id ? Number(req.user.user_id) : null;

    const result = await executeStoredProcedure('sp_MembershipTier_Create', {
      tier_name:           { type: sql.VarChar(200),   value: value.tier_name },
      annual_fee:          { type: sql.Decimal(10,2),  value: value.annual_fee },
      benefits:            { type: sql.VarChar(500),   value: value.benefits || null },
      loyalty_tier:        { type: sql.VarChar(50),    value: value.loyalty_tier || null },
      promoter_commission: { type: sql.Decimal(10,2),  value: value.promoter_commission || null },
      created_by:          { type: sql.Int,            value: userId }
    });

    return res.status(201).json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) { return next(err); }
});

router.put('/membership-tiers/:id', ...settingsManage, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { error, value } = tierUpdateSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });

    const result = await executeStoredProcedure('sp_MembershipTier_Update', {
      membership_id:       { type: sql.Int,           value: id },
      tier_name:           { type: sql.VarChar(200),  value: value.tier_name },
      annual_fee:          { type: sql.Decimal(10,2), value: value.annual_fee },
      benefits:            { type: sql.VarChar(500),  value: value.benefits || null },
      loyalty_tier:        { type: sql.VarChar(50),   value: value.loyalty_tier || null },
      promoter_commission: { type: sql.Decimal(10,2), value: value.promoter_commission || null },
      is_active:           { type: sql.Bit,           value: value.is_active !== false }
    });

    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) { return next(err); }
});

router.delete('/membership-tiers/:id', ...settingsManage, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const result = await executeStoredProcedure('sp_MembershipTier_Deactivate', {
      membership_id: { type: sql.Int, value: id }
    });
    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) { return next(err); }
});

// ─── MEMBERSHIP PLANS (capability-based engine) ───────────────────────────────

const membershipPlanCreateSchema = Joi.object({
  plan_key: Joi.string().max(50).pattern(/^[A-Z][A-Z0-9_]*$/).required()
    .messages({ 'string.pattern.base': 'plan_key must start with an uppercase letter and use only uppercase letters, digits, and underscores.' }),
  display_name: Joi.string().max(100).required(),
  price: Joi.number().min(0).required(),
  validity_days: Joi.number().integer().min(0).required(),
  max_dependents: Joi.number().integer().min(0).default(5),
  validity_type: Joi.string().valid('DAYS', 'LIFETIME').default('DAYS'),
  has_plus_access: Joi.boolean().default(false),
  extra_cashback_pct: Joi.number().min(0).max(100).allow(null).default(null),
  flat_discount_pct: Joi.number().min(0).max(100).allow(null).default(null),
  has_one_time_discount: Joi.boolean().default(false),
  one_time_discount_pct: Joi.number().min(0).max(100).allow(null).default(null),
  can_create_sub_cards: Joi.boolean().default(false)
});

const membershipPlanUpdateSchema = Joi.object({
  display_name: Joi.string().max(100),
  price: Joi.number().min(0),
  validity_days: Joi.number().integer().min(0),
  max_dependents: Joi.number().integer().min(0),
  validity_type: Joi.string().valid('DAYS', 'LIFETIME'),
  has_plus_access: Joi.boolean(),
  extra_cashback_pct: Joi.number().min(0).max(100).allow(null),
  flat_discount_pct: Joi.number().min(0).max(100).allow(null),
  has_one_time_discount: Joi.boolean(),
  one_time_discount_pct: Joi.number().min(0).max(100).allow(null),
  can_create_sub_cards: Joi.boolean(),
  is_active: Joi.boolean()
}).min(1);

router.get('/membership-plans', ...settingsView, async (req, res, next) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT plan_id, plan_key, display_name, price, validity_days, max_dependents, is_active, created_at,
             has_plus_access, extra_cashback_pct, flat_discount_pct,
             has_one_time_discount, one_time_discount_pct, can_create_sub_cards, validity_type
      FROM   dbo.membership_plans
      ORDER BY is_active DESC, plan_key ASC
    `);
    return res.json({ success: true, data: r.recordset || [] });
  } catch (err) { return next(err); }
});

router.post('/membership-plans', ...settingsManage, async (req, res, next) => {
  try {
    const { error, value } = membershipPlanCreateSchema.validate(req.body || {});
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
    const pool = await getPool();
    const r = await pool.request()
      .input('plan_key',            sql.NVarChar(50),    value.plan_key)
      .input('display_name',        sql.NVarChar(100),   value.display_name)
      .input('price',               sql.Decimal(10, 2),  value.price)
      .input('validity_days',       sql.Int,             value.validity_days)
      .input('max_dependents',      sql.Int,             value.max_dependents ?? 5)
      .input('validity_type',       sql.NVarChar(20),    value.validity_type || 'DAYS')
      .input('has_plus_access',     sql.Bit,             value.has_plus_access ? 1 : 0)
      .input('extra_cashback_pct',  sql.Decimal(5, 2),   value.extra_cashback_pct ?? null)
      .input('flat_discount_pct',   sql.Decimal(5, 2),   value.flat_discount_pct ?? null)
      .input('has_one_time_disc',   sql.Bit,             value.has_one_time_discount ? 1 : 0)
      .input('one_time_disc_pct',   sql.Decimal(5, 2),   value.one_time_discount_pct ?? null)
      .input('can_create_sub',      sql.Bit,             value.can_create_sub_cards ? 1 : 0)
      .query(`
        INSERT INTO dbo.membership_plans
          (plan_key, display_name, price, validity_days, max_dependents, validity_type,
           has_plus_access, extra_cashback_pct, flat_discount_pct,
           has_one_time_discount, one_time_discount_pct, can_create_sub_cards)
        OUTPUT INSERTED.plan_id
        VALUES
          (@plan_key, @display_name, @price, @validity_days, @max_dependents, @validity_type,
           @has_plus_access, @extra_cashback_pct, @flat_discount_pct,
           @has_one_time_disc, @one_time_disc_pct, @can_create_sub)
      `);
    const planId = r.recordset[0].plan_id;
    await writeAuditLog({
      userId: req.user && req.user.user_id ? Number(req.user.user_id) : null,
      action: 'MEMBERSHIP_PLAN_CREATED',
      module: 'command_unit',
      entityType: 'membership_plan',
      entityId: planId,
      newValue: JSON.stringify({ plan_id: planId, body: value }),
      ipAddress: req.ip || null
    });
    return res.status(201).json({ success: true, plan_id: planId });
  } catch (err) { return next(err); }
});

router.put('/membership-plans/:id', ...settingsManage, async (req, res, next) => {
  try {
    const planId = parseInt(req.params.id, 10);
    if (!planId) return res.status(400).json({ success: false, message: 'Invalid plan ID.' });
    const { error, value } = membershipPlanUpdateSchema.validate(req.body || {});
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
    const pool = await getPool();

    const capPctProvided = (k) => Object.prototype.hasOwnProperty.call(value, k);

    await pool.request()
      .input('id',               sql.Int,            planId)
      .input('display_name',     sql.NVarChar(100),  value.display_name ?? null)
      .input('price',            sql.Decimal(10, 2), value.price ?? null)
      .input('validity_days',    sql.Int,            value.validity_days ?? null)
      .input('max_dependents',   sql.Int,            value.max_dependents ?? null)
      .input('validity_type',    sql.NVarChar(20),   value.validity_type ?? null)
      .input('has_plus_access',  sql.Bit,            value.has_plus_access != null ? (value.has_plus_access ? 1 : 0) : null)
      .input('extra_cashback',   sql.Decimal(5, 2),  capPctProvided('extra_cashback_pct') ? (value.extra_cashback_pct ?? null) : undefined)
      .input('flat_discount',    sql.Decimal(5, 2),  capPctProvided('flat_discount_pct')  ? (value.flat_discount_pct ?? null)  : undefined)
      .input('has_one_time',     sql.Bit,            value.has_one_time_discount != null ? (value.has_one_time_discount ? 1 : 0) : null)
      .input('one_time_pct',     sql.Decimal(5, 2),  capPctProvided('one_time_discount_pct') ? (value.one_time_discount_pct ?? null) : undefined)
      .input('can_sub',          sql.Bit,            value.can_create_sub_cards != null ? (value.can_create_sub_cards ? 1 : 0) : null)
      .input('is_active',        sql.Bit,            value.is_active != null ? (value.is_active ? 1 : 0) : null)
      .query(`
        UPDATE dbo.membership_plans SET
          display_name          = ISNULL(@display_name,    display_name),
          price                 = ISNULL(@price,           price),
          validity_days         = ISNULL(@validity_days,   validity_days),
          max_dependents        = ISNULL(@max_dependents,  max_dependents),
          validity_type         = ISNULL(@validity_type,   validity_type),
          has_plus_access       = ISNULL(@has_plus_access, has_plus_access),
          extra_cashback_pct    = ISNULL(@extra_cashback,  extra_cashback_pct),
          flat_discount_pct     = ISNULL(@flat_discount,   flat_discount_pct),
          has_one_time_discount = ISNULL(@has_one_time,    has_one_time_discount),
          one_time_discount_pct = ISNULL(@one_time_pct,    one_time_discount_pct),
          can_create_sub_cards  = ISNULL(@can_sub,         can_create_sub_cards),
          is_active             = ISNULL(@is_active,       is_active)
        WHERE plan_id = @id
      `);
    await writeAuditLog({
      userId: req.user && req.user.user_id ? Number(req.user.user_id) : null,
      action: 'MEMBERSHIP_PLAN_UPDATED',
      module: 'command_unit',
      entityType: 'membership_plan',
      entityId: planId,
      newValue: JSON.stringify({ plan_id: planId, body: value }),
      ipAddress: req.ip || null
    });
    return res.json({ success: true });
  } catch (err) { return next(err); }
});

// ─── STORE TYPE CATALOG (Command Unit — store formats) ───────────────────────

const storeTypeKeySchema = Joi.string()
  .max(50)
  .pattern(/^[A-Za-z][A-Za-z0-9_]*$/)
  .required()
  .messages({
    'string.pattern.base':
      'type_key must start with a letter and use only letters, numbers, and underscores.'
  });

const storeTypeCreateSchema = Joi.object({
  type_key: storeTypeKeySchema,
  label: Joi.string().max(200).required(),
  description: Joi.string().max(500).allow('', null),
  sort_order: Joi.number().integer().min(0).max(9999).optional(),
  roles: Joi.array()
    .items(Joi.string().valid(...getStoreTypeRoleKeys()))
    .default([]),
  is_active: Joi.boolean().optional()
});

const storeTypeUpdateSchema = Joi.object({
  label: Joi.string().max(200).optional(),
  description: Joi.string().max(500).allow('', null),
  sort_order: Joi.number().integer().min(0).max(9999).optional(),
  roles: Joi.array().items(Joi.string().valid(...getStoreTypeRoleKeys())).optional(),
  is_active: Joi.boolean().optional()
}).min(1);

router.get('/store-type-catalog', ...settingsView, async (req, res, next) => {
  try {
    const rows = await getCatalogRows({ activeOnly: false });
    const withCounts = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        store_count: await countStoresUsingType(row.key)
      }))
    );
    return res.json({
      success: true,
      data: {
        store_types: withCounts,
        store_type_role_defs: getStoreTypeRoleDefs()
      }
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/store-type-catalog', ...settingsManage, async (req, res, next) => {
  try {
    const { error, value } = storeTypeCreateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }
    const row = await createStoreType({
      type_key: value.type_key,
      label: value.label,
      description: value.description || null,
      sort_order: value.sort_order,
      roles: value.roles,
      is_active: value.is_active !== false
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (/duplicate key|UNIQUE|PK_store_type_catalog/i.test(String(err.message || ''))) {
      return res.status(409).json({ success: false, message: 'A store type with this key already exists.' });
    }
    return next(err);
  }
});

router.put('/store-type-catalog/:typeKey', ...settingsManage, async (req, res, next) => {
  try {
    const typeKey = String(req.params.typeKey || '').trim();
    const { error, value } = storeTypeUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }
    const row = await updateStoreType(typeKey, {
      label: value.label,
      description: value.description,
      sort_order: value.sort_order,
      roles: value.roles,
      is_active: value.is_active
    });
    return res.json({ success: true, data: row });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

router.delete('/store-type-catalog/:typeKey', ...settingsManage, async (req, res, next) => {
  try {
    const typeKey = String(req.params.typeKey || '').trim();
    const row = await deactivateStoreType(typeKey);
    return res.json({ success: true, data: row });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (err.statusCode === 422) {
      return res.status(422).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

// ─── LEAVE TYPES ─────────────────────────────────────────────────────────────

const leaveSchema = Joi.object({
  leave_name:        Joi.string().max(200).required(),
  annual_quota:      Joi.number().integer().min(0).allow(null),
  max_carry_fwd:     Joi.number().integer().min(0).allow(null),
  requires_approval: Joi.boolean().optional(),
  is_paid:           Joi.boolean().optional(),
  affects_score:     Joi.boolean().optional()
});

const leaveUpdateSchema = leaveSchema.append({
  is_active: Joi.boolean().optional()
});

router.get('/leave-types', ...settingsView, async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_LeaveType_GetAll', {});
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) { return next(err); }
});

router.post('/leave-types', ...settingsManage, async (req, res, next) => {
  try {
    const { error, value } = leaveSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });

    const userId = req.user && req.user.user_id ? Number(req.user.user_id) : null;

    const result = await executeStoredProcedure('sp_LeaveType_Create', {
      leave_name:        { type: sql.VarChar(200), value: value.leave_name },
      annual_quota:      { type: sql.Int,          value: value.annual_quota != null ? value.annual_quota : null },
      max_carry_fwd:     { type: sql.Int,          value: value.max_carry_fwd != null ? value.max_carry_fwd : null },
      requires_approval: { type: sql.Bit,          value: value.requires_approval !== false },
      is_paid:           { type: sql.Bit,          value: value.is_paid !== false },
      affects_score:     { type: sql.Bit,          value: value.affects_score !== false },
      created_by:        { type: sql.Int,          value: userId }
    });

    return res.status(201).json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) { return next(err); }
});

router.put('/leave-types/:id', ...settingsManage, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { error, value } = leaveUpdateSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });

    const result = await executeStoredProcedure('sp_LeaveType_Update', {
      leave_type_id:     { type: sql.Int,          value: id },
      leave_name:        { type: sql.VarChar(200), value: value.leave_name },
      annual_quota:      { type: sql.Int,          value: value.annual_quota != null ? value.annual_quota : null },
      max_carry_fwd:     { type: sql.Int,          value: value.max_carry_fwd != null ? value.max_carry_fwd : null },
      requires_approval: { type: sql.Bit,          value: value.requires_approval !== false },
      is_paid:           { type: sql.Bit,          value: value.is_paid !== false },
      affects_score:     { type: sql.Bit,          value: value.affects_score !== false },
      is_active:         { type: sql.Bit,          value: value.is_active !== false }
    });

    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) { return next(err); }
});

router.delete('/leave-types/:id', ...settingsManage, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const result = await executeStoredProcedure('sp_LeaveType_Deactivate', {
      leave_type_id: { type: sql.Int, value: id }
    });
    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) { return next(err); }
});

// ─── GATEPASS VISIT PURPOSES (CX / GatePass check-in) ───────────────────────────

const purposeKeySchema = Joi.string()
  .trim()
  .max(50)
  .pattern(/^[a-z][a-z0-9_]*$/)
  .required()
  .messages({
    'string.pattern.base':
      'purpose_key must start with a letter and use only lowercase letters, numbers, and underscores.'
  });

const purposeCreateSchema = Joi.object({
  purpose_key: purposeKeySchema,
  label: Joi.string().max(200).required(),
  badge_variant: Joi.string().max(20).required(),
  sort_order: Joi.number().integer().min(0).max(9999).optional(),
  is_active: Joi.boolean().optional()
});

const purposeUpdateSchema = Joi.object({
  label: Joi.string().max(200).optional(),
  badge_variant: Joi.string().max(20).optional(),
  sort_order: Joi.number().integer().min(0).max(9999).optional(),
  is_active: Joi.boolean().optional()
}).min(1);

router.get('/gatepass-purpose-catalog', ...purposeCatalogView, async (req, res, next) => {
  try {
    const purposes = await getAdminCatalog();
    return res.json({
      success: true,
      data: {
        purposes,
        badge_variants: getGatepassPurposeBadgeVariants()
      }
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/gatepass-purpose-catalog', ...purposeCatalogManage, async (req, res, next) => {
  try {
    const { error, value } = purposeCreateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }
    const row = await createPurpose({
      purpose_key: value.purpose_key,
      label: value.label,
      badge_variant: value.badge_variant,
      sort_order: value.sort_order,
      is_active: value.is_active !== false
    });
    return res.status(201).json({ success: true, data: { ...row, visitor_count: 0 } });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (/duplicate key|UNIQUE|PK_gatepass_purpose/i.test(String(err.message || ''))) {
      return res.status(409).json({ success: false, message: 'A purpose with this key already exists.' });
    }
    return next(err);
  }
});

router.put('/gatepass-purpose-catalog/:purposeKey', ...purposeCatalogManage, async (req, res, next) => {
  try {
    const purposeKey = String(req.params.purposeKey || '').trim();
    const { error, value } = purposeUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }
    const row = await updatePurpose(purposeKey, {
      label: value.label,
      badge_variant: value.badge_variant,
      sort_order: value.sort_order,
      is_active: value.is_active
    });
    return res.json({ success: true, data: row });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

router.delete('/gatepass-purpose-catalog/:purposeKey', ...purposeCatalogManage, async (req, res, next) => {
  try {
    const purposeKey = String(req.params.purposeKey || '').trim();
    const row = await deactivatePurpose(purposeKey);
    return res.json({ success: true, data: row });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (err.statusCode === 422) {
      return res.status(422).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

// ─── PROMOTION: CUSTOMER OFFERS (Eyewoot Go) ────────────────────────────────────

const scopeItemSchema = Joi.object({
  kind: Joi.string().valid(...ALLOWED_SCOPE_KINDS).required(),
  ref_int: Joi.number().integer().positive().allow(null),
  ref_key: Joi.string().max(60).allow(null, ''),
  is_exclusion: Joi.boolean().default(false)
}).or('ref_int', 'ref_key');

/** Legacy Configure Offer fields (tier dropdown, Plus-only toggle) — still accepted for older UI payloads. */
const legacyOfferFieldsSchema = {
  eligible_tier: Joi.string().max(50).allow(null, ''),
  is_plus_only: Joi.boolean()
};

function normalizeCustomerOfferPayload (value) {
  const out = { ...value };
  if (out.eligible_tier === '') out.eligible_tier = null;
  if (out.required_capability === '') out.required_capability = null;
  if (out.is_plus_only === true && !out.required_capability) {
    out.required_capability = 'has_plus_access';
  }
  return out;
}

const customerOfferCreateSchema = Joi.object({
  title: Joi.string().max(200).required(),
  description: Joi.string().max(500).allow('', null),
  icon_emoji: Joi.string().max(10).allow('', null),
  discount_type: Joi.string().valid(...OFFER_DISCOUNT_TYPES).default('PCT'),
  discount_value: Joi.number().min(0).default(0),
  trigger_type: Joi.string().valid(...TRIGGER_TYPES).default('ANY_ITEM'),
  trigger_value: Joi.string().max(100).allow(null, ''),
  benefit_target: Joi.string().valid(...BENEFIT_TARGETS).default('ELIGIBLE_LINES'),
  max_discount_amount: Joi.number().min(0).allow(null),
  scope_mode: Joi.string().valid(...SCOPE_MODES).default('ALL_PRODUCTS'),
  valid_from: Joi.any().optional(),
  valid_to: Joi.any().required(),
  required_capability: Joi.string().valid(...CAPABILITY_KEYS).allow(null, '').default(null),
  cashback_rate: Joi.number().min(0).max(100).allow(null),
  sort_order: Joi.number().integer().min(0).default(0),
  scopes: Joi.array().items(scopeItemSchema).default([]),
  ...legacyOfferFieldsSchema
});

const customerOfferUpdateSchema = Joi.object({
  title: Joi.string().max(200),
  description: Joi.string().max(500).allow('', null),
  icon_emoji: Joi.string().max(10).allow('', null),
  discount_type: Joi.string().valid(...OFFER_DISCOUNT_TYPES),
  discount_value: Joi.number().min(0),
  trigger_type: Joi.string().valid(...TRIGGER_TYPES),
  trigger_value: Joi.string().max(100).allow(null, ''),
  benefit_target: Joi.string().valid(...BENEFIT_TARGETS),
  max_discount_amount: Joi.number().min(0).allow(null),
  scope_mode: Joi.string().valid(...SCOPE_MODES),
  valid_from: Joi.any().optional(),
  valid_to: Joi.any(),
  required_capability: Joi.string().valid(...CAPABILITY_KEYS).allow(null, ''),
  cashback_rate: Joi.number().min(0).max(100).allow(null),
  is_active: Joi.boolean(),
  sort_order: Joi.number().integer().min(0),
  scopes: Joi.array().items(scopeItemSchema),
  ...legacyOfferFieldsSchema
}).min(1);

router.get('/customer-offers', ...promotionsView, async (req, res, next) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT offer_id, title, description, icon_emoji, discount_type,
             discount_value, trigger_type, trigger_value, benefit_target, max_discount_amount, scope_mode,
             valid_from, valid_to,
             eligible_tier, is_plus_only,
             required_capability, cashback_rate,
             is_active, sort_order, created_at
      FROM   dbo.customer_offers
      ORDER BY is_active DESC, sort_order ASC, created_at DESC
    `);
    const offers = r.recordset || [];

    const scopeRows = offers.length
      ? await pool.request().query(`
          SELECT offer_id, scope_kind, ref_int, ref_key, is_exclusion
          FROM   dbo.customer_offer_scope
          WHERE  offer_id IN (${offers.map((o) => o.offer_id).join(',')})
        `)
      : { recordset: [] };

    const scopesByOffer = {}
    for (const sr of (scopeRows.recordset || [])) {
      const oid = Number(sr.offer_id)
      if (!scopesByOffer[oid]) scopesByOffer[oid] = []
      scopesByOffer[oid].push({
        kind: sr.scope_kind,
        ref_int: sr.ref_int != null ? Number(sr.ref_int) : null,
        ref_key: sr.ref_key != null ? String(sr.ref_key) : null,
        is_exclusion: Boolean(sr.is_exclusion)
      })
    }

    return res.json({
      success: true,
      data: offers.map((o) => ({ ...o, scopes: scopesByOffer[o.offer_id] || [] }))
    });
  } catch (err) { return next(err); }
});

router.post('/customer-offers', ...promotionsManage, async (req, res, next) => {
  try {
    const { error, value: rawValue } = customerOfferCreateSchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }
    const value = normalizeCustomerOfferPayload(rawValue);
    const pool = await getPool();
    if ((value.discount_type || 'PCT') !== 'PCT' && value.max_discount_amount != null) {
      return res.status(400).json({ success: false, message: 'max_discount_amount is allowed only for PCT offers.' });
    }
    if ((value.trigger_type || 'ANY_ITEM') !== 'ANY_ITEM' && !String(value.trigger_value || '').trim()) {
      return res.status(400).json({ success: false, message: 'trigger_value is required when trigger_type is not ANY_ITEM.' });
    }
    const rawScopes = Array.isArray(value.scopes) ? value.scopes : [];
    const discountType = value.discount_type || 'PCT';
    const scopes =
      isStructuredOfferType(discountType) && !structuredOfferTypeRespectsAllocation(discountType) ? [] : rawScopes;
    if (scopes.length) await validateScopeRefs(pool, scopes);

    const istWall = wallClockIso();
    const vf = value.valid_from ? String(value.valid_from).trim() : istWall;
    const vt = String(value.valid_to).trim();

    const r = await pool.request()
      .input('title', value.title)
      .input('description', value.description || '')
      .input('icon_emoji', value.icon_emoji || '🎁')
      .input('discount_type', value.discount_type || 'PCT')
      .input('discount_value', parseFloat(value.discount_value) || 0)
      .input('trigger_type', value.trigger_type || 'ANY_ITEM')
      .input('trigger_value', value.trigger_value ? String(value.trigger_value).trim() : null)
      .input('benefit_target', value.benefit_target || 'ELIGIBLE_LINES')
      .input('max_discount_amount', value.max_discount_amount != null ? Number(value.max_discount_amount) : null)
      .input('scope_mode', value.scope_mode || 'ALL_PRODUCTS')
      .input('valid_from', vf)
      .input('valid_to', vt)
      .input('required_capability', value.required_capability ? String(value.required_capability).trim() : null)
      .input('eligible_tier', value.eligible_tier ? String(value.eligible_tier).trim() : null)
      .input('is_plus_only', value.is_plus_only === true ? 1 : 0)
      .input('cashback_rate', value.cashback_rate != null ? parseFloat(value.cashback_rate) : null)
      .input('sort_order', parseInt(value.sort_order, 10) || 0)
      .input('uid', req.user && req.user.user_id ? Number(req.user.user_id) : null)
      .query(`
        INSERT INTO dbo.customer_offers
          (title, description, icon_emoji, discount_type, discount_value,
           trigger_type, trigger_value, benefit_target, max_discount_amount, scope_mode,
           valid_from, valid_to, eligible_tier, is_plus_only, required_capability, cashback_rate, sort_order,
           created_by_user_id)
        OUTPUT INSERTED.offer_id
        VALUES
          (@title, @description, @icon_emoji, @discount_type, @discount_value,
           @trigger_type, @trigger_value, @benefit_target, @max_discount_amount, @scope_mode,
           @valid_from, @valid_to, @eligible_tier, @is_plus_only, @required_capability, @cashback_rate, @sort_order,
           @uid)
      `);
    const offerId = r.recordset[0].offer_id;
    if (scopes.length) await replaceOfferScopes(pool, offerId, scopes);
    await writeAuditLog({
      userId: req.user && req.user.user_id ? Number(req.user.user_id) : null,
      action: 'PROMOTION_OFFER_CREATED',
      module: 'command_unit',
      entityType: 'customer_offer',
      entityId: offerId,
      newValue: JSON.stringify({ offer_id: offerId, body: value }),
      ipAddress: req.ip || null
    });
    return res.status(201).json({ success: true, offer_id: offerId });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    return next(err);
  }
});

router.put('/customer-offers/:id', ...promotionsManage, async (req, res, next) => {
  try {
    const offerId = parseInt(req.params.id, 10);
    if (!offerId) return res.status(400).json({ success: false, message: 'Invalid offer ID.' });

    const { error, value: rawValue } = customerOfferUpdateSchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }
    const value = normalizeCustomerOfferPayload(rawValue);

    const pool = await getPool();
    const {
      title, description, icon_emoji, discount_type, discount_value,
      trigger_type, trigger_value, benefit_target, max_discount_amount, scope_mode,
      valid_from, valid_to, eligible_tier, is_plus_only, required_capability, cashback_rate, is_active, sort_order,
      scopes
    } = value;
    if ((discount_type && discount_type !== 'PCT') && max_discount_amount != null) {
      return res.status(400).json({ success: false, message: 'max_discount_amount is allowed only for PCT offers.' });
    }
    if ((trigger_type && trigger_type !== 'ANY_ITEM') && !String(trigger_value || '').trim()) {
      return res.status(400).json({ success: false, message: 'trigger_value is required when trigger_type is not ANY_ITEM.' });
    }

    let scopesList = Array.isArray(scopes) ? scopes : null;
    let typeForScopes = discount_type != null ? discount_type : null;
    if (scopesList != null && typeForScopes == null) {
      const tr = await pool.request().input('id', sql.Int, offerId).query(`
        SELECT discount_type FROM dbo.customer_offers WHERE offer_id = @id
      `);
      typeForScopes = tr.recordset[0] ? tr.recordset[0].discount_type : null;
    }
    if (
      scopesList != null &&
      isStructuredOfferType(typeForScopes) &&
      !structuredOfferTypeRespectsAllocation(typeForScopes)
    ) {
      scopesList = [];
    }
    if (scopesList && scopesList.length) await validateScopeRefs(pool, scopesList);

    await pool.request()
      .input('id', offerId)
      .input('title', title != null ? title : null)
      .input('description', description !== undefined ? description : null)
      .input('icon_emoji', icon_emoji !== undefined ? icon_emoji : null)
      .input('discount_type', discount_type != null ? discount_type : null)
      .input('discount_value', discount_value != null ? parseFloat(discount_value) : null)
      .input('trigger_type', trigger_type != null ? trigger_type : null)
      .input('trigger_value', trigger_value !== undefined ? (trigger_value ? String(trigger_value).trim() : null) : null)
      .input('benefit_target', benefit_target != null ? benefit_target : null)
      .input('max_discount_amount', max_discount_amount != null ? Number(max_discount_amount) : null)
      .input('scope_mode', scope_mode != null ? scope_mode : null)
      .input('valid_from', valid_from !== undefined ? (valid_from ? String(valid_from).trim() : null) : null)
      .input('valid_to', valid_to !== undefined ? String(valid_to).trim() : null)
      .input('required_capability', required_capability !== undefined ? (required_capability ? String(required_capability).trim() : null) : null)
      .input('eligible_tier', eligible_tier !== undefined ? (eligible_tier ? String(eligible_tier).trim() : null) : null)
      .input('is_plus_only', is_plus_only != null ? (is_plus_only ? 1 : 0) : null)
      .input('cashback_rate', cashback_rate !== undefined ? (cashback_rate != null ? parseFloat(cashback_rate) : null) : null)
      .input('is_active', is_active != null ? (is_active ? 1 : 0) : null)
      .input('sort_order', sort_order != null ? parseInt(sort_order, 10) : null)
      .query(`
        UPDATE dbo.customer_offers SET
          title               = ISNULL(@title,               title),
          description         = ISNULL(@description,         description),
          icon_emoji          = ISNULL(@icon_emoji,          icon_emoji),
          discount_type       = ISNULL(@discount_type,       discount_type),
          discount_value      = ISNULL(@discount_value,      discount_value),
          trigger_type        = ISNULL(@trigger_type,        trigger_type),
          trigger_value       = ISNULL(@trigger_value,       trigger_value),
          benefit_target      = ISNULL(@benefit_target,      benefit_target),
          max_discount_amount = ISNULL(@max_discount_amount, max_discount_amount),
          scope_mode          = ISNULL(@scope_mode,          scope_mode),
          valid_from          = ISNULL(@valid_from,          valid_from),
          valid_to            = ISNULL(@valid_to,            valid_to),
          eligible_tier       = ISNULL(@eligible_tier,       eligible_tier),
          is_plus_only        = ISNULL(@is_plus_only,        is_plus_only),
          required_capability = ISNULL(@required_capability, required_capability),
          cashback_rate       = ISNULL(@cashback_rate,       cashback_rate),
          is_active           = ISNULL(@is_active,           is_active),
          sort_order          = ISNULL(@sort_order,          sort_order),
          updated_at          = DATEADD(MINUTE, 330, SYSUTCDATETIME())
        WHERE offer_id = @id
      `);

    const curTr = await pool.request().input('id', sql.Int, offerId).query(`
      SELECT discount_type FROM dbo.customer_offers WHERE offer_id = @id
    `)
    const finalType = curTr.recordset[0] && curTr.recordset[0].discount_type
    if (isStructuredOfferType(finalType) && !structuredOfferTypeRespectsAllocation(finalType)) {
      await replaceOfferScopes(pool, offerId, [])
    } else if (scopesList != null) {
      await replaceOfferScopes(pool, offerId, scopesList)
    }
    await writeAuditLog({
      userId: req.user && req.user.user_id ? Number(req.user.user_id) : null,
      action: 'PROMOTION_OFFER_UPDATED',
      module: 'command_unit',
      entityType: 'customer_offer',
      entityId: offerId,
      newValue: JSON.stringify({ offer_id: offerId, body: value }),
      ipAddress: req.ip || null
    });
    return res.json({ success: true });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    return next(err);
  }
});

router.delete('/customer-offers/:id', ...promotionsManage, async (req, res, next) => {
  try {
    const offerId = parseInt(req.params.id, 10);
    if (!offerId) return res.status(400).json({ success: false, message: 'Invalid offer ID.' });
    const pool = await getPool();
    await pool.request().input('id', offerId).query(`
      UPDATE dbo.customer_offers
      SET is_active = 0, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      WHERE offer_id = @id
    `);
    await writeAuditLog({
      userId: req.user && req.user.user_id ? Number(req.user.user_id) : null,
      action: 'PROMOTION_OFFER_DEACTIVATED',
      module: 'command_unit',
      entityType: 'customer_offer',
      entityId: offerId,
      ipAddress: req.ip || null
    });
    return res.json({ success: true });
  } catch (err) { return next(err); }
});

router.get('/customer-offers/report/usage', ...promotionsView, async (req, res, next) => {
  try {
    const pool = await getPool();
    const from = req.query.from ? String(req.query.from).trim() : null;
    const to = req.query.to ? String(req.query.to).trim() : null;
    const q = await pool.request()
      .input('from_dt', from)
      .input('to_dt', to)
      .query(`
        SELECT ou.offer_id,
               COALESCE(co.title, CONCAT('Offer #', ou.offer_id)) AS offer_title,
               COUNT_BIG(1) AS usage_count,
               SUM(ISNULL(ou.discount_amount, 0)) AS total_discount,
               SUM(ISNULL(ou.sale_amount, 0)) AS total_sales
        FROM dbo.offer_usage ou
        LEFT JOIN dbo.customer_offers co ON co.offer_id = ou.offer_id
        WHERE (@from_dt IS NULL OR ou.used_at >= @from_dt)
          AND (@to_dt IS NULL OR ou.used_at <= @to_dt)
        GROUP BY ou.offer_id, co.title
        ORDER BY total_discount DESC
      `);
    return res.json({ success: true, data: q.recordset || [] });
  } catch (err) { return next(err); }
});

// ─── OFFER SCOPE META ────────────────────────────────────────────────────────

/**
 * GET /api/settings/offer-scope-meta
 * Returns the declarative scope dimension manifest for UI rendering.
 * Both Command Unit and POS use this to build allocation pickers without hardcoding.
 */
router.get('/offer-scope-meta', ...promotionsView, (req, res) => {
  const meta = SCOPE_DIMENSIONS.map((d) => ({
    kind: d.kind,
    label: d.label,
    refField: d.refField,
    pickerHint: d.pickerHint,
    pickerApi: d.pickerApi
  }));
  return res.json({ success: true, data: meta });
});

// ─── POS PRODUCT TYPES ────────────────────────────────────────────────────────

/**
 * GET /api/settings/pos-product-types
 * Returns distinct product_type keys from product_master that POS startup recognises.
 * Command Unit uses this for the PRODUCT_TYPE scope picker — same source as POS catalogue.
 */
router.get('/pos-product-types', ...promotionsView, async (req, res, next) => {
  try {
    const { executeStoredProcedure: execSP } = require('../config/db');
    const result = await execSP('sp_POS_GetStartupConfig', {});
    const productRows = (result.recordsets || [])[0] || [];
    const types = productRows
      .map((r) => ({ key: String(r.product_type_key || ''), fulfillment_mode: String(r.fulfillment_mode || '') }))
      .filter((r) => r.key);
    return res.json({ success: true, data: types });
  } catch (err) { return next(err); }
});

const FULFILLMENT_MODES = ['INSTANT', 'LAB', 'DUAL'];
const LENS_WIZARD_POLICIES = ['NEVER', 'OPTIONAL', 'REQUIRED'];

const posProductTypeConfigPutSchema = Joi.object({
  rows: Joi.array().items(
    Joi.object({
      product_type_key: Joi.string().max(100).required(),
      requires_unit_barcode: Joi.boolean().required()
    }).unknown(true)
  ).min(1).required()
});

const posProductTypeCreateSchema = Joi.object({
  product_type_key: Joi.string().max(100).required(),
  label: Joi.string().max(200).required(),
  description: Joi.string().max(500).allow(null, '').optional(),
  display_order: Joi.number().integer().min(0).optional(),
  fulfillment_mode: Joi.string().valid(...FULFILLMENT_MODES).default('INSTANT'),
  requires_unit_barcode: Joi.boolean().default(true),
  lens_wizard_policy: Joi.string().valid(...LENS_WIZARD_POLICIES).default('NEVER'),
  rx_required: Joi.boolean().optional(),
  allow_qty_gt_1: Joi.boolean().optional(),
  is_active: Joi.boolean().optional()
});

const posProductTypeUpdateSchema = Joi.object({
  product_type_key: Joi.string().max(100).optional(),
  label: Joi.string().max(200).required(),
  description: Joi.string().max(500).allow(null, '').optional(),
  display_order: Joi.number().integer().min(0).optional(),
  fulfillment_mode: Joi.string().valid(...FULFILLMENT_MODES).optional(),
  requires_unit_barcode: Joi.boolean().optional(),
  lens_wizard_policy: Joi.string().valid(...LENS_WIZARD_POLICIES).optional(),
  rx_required: Joi.boolean().optional(),
  allow_qty_gt_1: Joi.boolean().optional(),
  is_active: Joi.boolean().optional()
});

function normalizeProductTypeKey(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

async function queryPosProductTypeConfig(pool) {
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
    ORDER BY display_order, product_type_key
  `);
  return result.recordset || [];
}

function defaultLensWizardPolicy(fulfillmentMode) {
  return fulfillmentMode === 'DUAL' ? 'OPTIONAL' : 'NEVER';
}

/**
 * GET /api/settings/pos-product-type-config
 * SSOT for product types (labels + POS behaviour).
 */
router.get('/pos-product-type-config', ...settingsView, async (req, res, next) => {
  try {
    const pool = await getPool();
    return res.json({ success: true, data: await queryPosProductTypeConfig(pool) });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/settings/pos-product-type-config
 * Create a product type row.
 */
router.post('/pos-product-type-config', ...settingsManage, async (req, res, next) => {
  try {
    const { error, value } = posProductTypeCreateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }
    const key = normalizeProductTypeKey(value.product_type_key);
    if (!key) {
      return res.status(400).json({ success: false, message: 'Product type key is required.' });
    }
    const fulfillment = value.fulfillment_mode || 'INSTANT';
    const lensPolicy = value.lens_wizard_policy || defaultLensWizardPolicy(fulfillment);
    const pool = await getPool();
    const reqIns = pool.request();
    reqIns.input('product_type_key', sql.NVarChar(100), key);
    reqIns.input('label', sql.NVarChar(200), value.label);
    reqIns.input('description', sql.NVarChar(500), value.description || null);
    reqIns.input('display_order', sql.Int, value.display_order ?? 0);
    reqIns.input('fulfillment_mode', sql.VarChar(10), fulfillment);
    reqIns.input('requires_unit_barcode', sql.Bit, value.requires_unit_barcode !== false ? 1 : 0);
    reqIns.input('lens_wizard_policy', sql.NVarChar(10), lensPolicy);
    reqIns.input('rx_required', sql.Bit, value.rx_required ? 1 : 0);
    reqIns.input('allow_qty_gt_1', sql.Bit, value.allow_qty_gt_1 !== false ? 1 : 0);
    reqIns.input('is_active', sql.Bit, value.is_active !== false ? 1 : 0);
    try {
      await reqIns.query(`
        INSERT INTO dbo.pos_product_type_config (
          product_type_key, label, description, display_order,
          fulfillment_mode, requires_unit_barcode, lens_wizard_policy,
          rx_required, allow_qty_gt_1, is_active
        )
        VALUES (
          @product_type_key, @label, @description, @display_order,
          @fulfillment_mode, @requires_unit_barcode, @lens_wizard_policy,
          @rx_required, @allow_qty_gt_1, @is_active
        );
      `);
    } catch (err) {
      if (err.number === 2627 || err.number === 2601) {
        return res.status(422).json({ success: false, message: 'A product type with this key already exists.' });
      }
      throw err;
    }
    clearCacheByPrefix('foundry-lookups:');
    return res.status(201).json({
      success: true,
      data: (await queryPosProductTypeConfig(pool)).find((r) => r.product_type_key === key)
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * PUT /api/settings/pos-product-type-config/:configId
 * Update one product type (full row).
 */
router.put('/pos-product-type-config/:configId', ...settingsManage, async (req, res, next) => {
  try {
    const configId = Number(req.params.configId);
    if (!configId) {
      return res.status(400).json({ success: false, message: 'Invalid config id.' });
    }
    const { error, value } = posProductTypeUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }
    const pool = await getPool();
    const existing = await pool.request()
      .input('config_id', sql.Int, configId)
      .query('SELECT product_type_key FROM dbo.pos_product_type_config WHERE config_id = @config_id');
    if (!existing.recordset || !existing.recordset[0]) {
      return res.status(404).json({ success: false, message: 'Product type not found.' });
    }
    const oldKey = existing.recordset[0].product_type_key;
    const newKey = value.product_type_key != null
      ? normalizeProductTypeKey(value.product_type_key)
      : oldKey;
    if (!newKey) {
      return res.status(400).json({ success: false, message: 'Product type key is required.' });
    }
    const fulfillment = value.fulfillment_mode;
    const lensPolicy = value.lens_wizard_policy
      || (fulfillment ? defaultLensWizardPolicy(fulfillment) : undefined);
    const reqUp = pool.request();
    reqUp.input('config_id', sql.Int, configId);
    reqUp.input('product_type_key', sql.NVarChar(100), newKey);
    reqUp.input('label', sql.NVarChar(200), value.label);
    reqUp.input('description', sql.NVarChar(500), value.description || null);
    reqUp.input('display_order', sql.Int, value.display_order ?? 0);
    reqUp.input('fulfillment_mode', sql.VarChar(10), fulfillment || null);
    reqUp.input('requires_unit_barcode', sql.Bit, value.requires_unit_barcode != null ? (value.requires_unit_barcode ? 1 : 0) : null);
    reqUp.input('lens_wizard_policy', sql.NVarChar(10), lensPolicy || null);
    reqUp.input('rx_required', sql.Bit, value.rx_required != null ? (value.rx_required ? 1 : 0) : null);
    reqUp.input('allow_qty_gt_1', sql.Bit, value.allow_qty_gt_1 != null ? (value.allow_qty_gt_1 ? 1 : 0) : null);
    reqUp.input('is_active', sql.Bit, value.is_active !== false ? 1 : 0);
    await reqUp.query(`
      UPDATE dbo.pos_product_type_config
      SET
        product_type_key = @product_type_key,
        label = @label,
        description = @description,
        display_order = @display_order,
        fulfillment_mode = COALESCE(@fulfillment_mode, fulfillment_mode),
        requires_unit_barcode = COALESCE(@requires_unit_barcode, requires_unit_barcode),
        lens_wizard_policy = COALESCE(@lens_wizard_policy, lens_wizard_policy),
        rx_required = COALESCE(@rx_required, rx_required),
        allow_qty_gt_1 = COALESCE(@allow_qty_gt_1, allow_qty_gt_1),
        is_active = @is_active
      WHERE config_id = @config_id;
    `);
    clearCacheByPrefix('foundry-lookups:');
    const rows = await queryPosProductTypeConfig(pool);
    const row = rows.find((r) => r.config_id === configId) || rows.find((r) => r.product_type_key === newKey);
    return res.json({ success: true, data: row || null });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(422).json({ success: false, message: 'A product type with this key already exists.' });
    }
    return next(err);
  }
});

/**
 * PUT /api/settings/pos-product-type-config
 * Bulk update requires_unit_barcode (legacy path; still supported).
 */
router.put('/pos-product-type-config', ...settingsManage, async (req, res, next) => {
  try {
    const { error, value } = posProductTypeConfigPutSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      for (const row of value.rows) {
        const reqUp = new sql.Request(transaction);
        reqUp.input('product_type_key', sql.NVarChar(100), row.product_type_key);
        reqUp.input('requires_unit_barcode', sql.Bit, row.requires_unit_barcode ? 1 : 0);
        const upd = await reqUp.query(`
          UPDATE dbo.pos_product_type_config
          SET requires_unit_barcode = @requires_unit_barcode
          WHERE product_type_key = @product_type_key;
          SELECT @@ROWCOUNT AS rows_updated;
        `);
        const n = upd.recordset && upd.recordset[0] ? Number(upd.recordset[0].rows_updated) : 0;
        if (n < 1) {
          const err = new Error(`Unknown product type: ${row.product_type_key}`);
          err.statusCode = 400;
          throw err;
        }
      }
      await transaction.commit();
    } catch (inner) {
      await transaction.rollback();
      throw inner;
    }
    try {
      await writeAuditLog({
        userId: req.user && req.user.user_id ? Number(req.user.user_id) : null,
        action: 'POS_PRODUCT_TYPE_UNIT_BARCODE_UPDATE',
        module: 'command_unit',
        entityType: 'pos_product_type_config',
        entityId: null,
        newValue: JSON.stringify({ row_count: value.rows.length }),
        ipAddress: req.ip || null
      });
    } catch (_auditErr) {
      /* non-fatal */
    }
    clearCacheByPrefix('foundry-lookups:');
    return res.json({ success: true, data: await queryPosProductTypeConfig(pool) });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

// ─── Loyalty engine (CX Customer 360 / Eyewoot Go coins) ─────────────────────
const cxService = require('../services/cxService');
const { clearLoyaltyEngineFlagCache } = require('../lib/loyaltyEngineFlag');

const loyaltySettingsPutSchema = Joi.object({
  earn_percent: Joi.number().min(0).max(100),
  credit_delay_days: Joi.number().integer().min(0).max(365),
  redemption_coins_per_rupee: Joi.number().integer().min(1),
  max_redeem_percent_of_bill: Joi.number().min(0).max(100).allow(null),
  loyalty_engine_v2: Joi.boolean()
}).min(1);

router.get('/loyalty', ...settingsView, async (req, res, next) => {
  try {
    const pool = await getPool();
    const row = await cxService.getLoyaltySettings(pool);
    const flagR = await pool.request().query(`
      SELECT setting_value FROM dbo.app_settings WHERE setting_key = N'loyalty_engine_v2'
    `);
    const flagVal = flagR.recordset[0] ? String(flagR.recordset[0].setting_value || '').trim() : '0';
    return res.json({
      success: true,
      data: {
        settings: row,
        loyalty_engine_v2: flagVal === '1' || flagVal.toLowerCase() === 'true'
      }
    });
  } catch (err) {
    return next(err);
  }
});

router.put('/loyalty', ...settingsManage, async (req, res, next) => {
  try {
    const { error, value } = loyaltySettingsPutSchema.validate(req.body || {}, { abortEarly: false });
    if (error) {
      return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join('; ') });
    }
    const pool = await getPool();
    let settings = await cxService.getLoyaltySettings(pool);
    if (
      value.earn_percent != null ||
      value.credit_delay_days != null ||
      value.redemption_coins_per_rupee != null ||
      value.max_redeem_percent_of_bill != null
    ) {
      settings = await cxService.updateLoyaltySettings(pool, {
        earnPercent: value.earn_percent,
        creditDelayDays: value.credit_delay_days,
        redemptionCoinsPerRupee: value.redemption_coins_per_rupee,
        maxRedeemPercentOfBill: value.max_redeem_percent_of_bill,
        actorUserId: req.user?.user_id || null
      });
    }
    if (value.loyalty_engine_v2 != null) {
      await upsertAppSetting(pool, {
        settingKey: 'loyalty_engine_v2',
        settingValue: value.loyalty_engine_v2 ? '1' : '0',
        settingGroup: 'loyalty',
        description: '1 = loyalty_ledger engine; 0 = legacy pos_points_ledger'
      });
      if (value.loyalty_engine_v2) {
        await upsertAppSetting(pool, {
          settingKey: 'coin_redemption_rate',
          settingValue: '__retired__',
          settingGroup: 'loyalty',
          description: 'RETIRED — use loyalty_settings.redemption_coins_per_rupee'
        });
        await upsertAppSetting(pool, {
          settingKey: 'pos_points_maturity_days',
          settingValue: '__retired__',
          settingGroup: 'loyalty',
          description: 'RETIRED — use loyalty_settings.credit_delay_days'
        });
      }
      clearLoyaltyEngineFlagCache();
    }
    const flagR = await pool.request().query(`
      SELECT setting_value FROM dbo.app_settings WHERE setting_key = N'loyalty_engine_v2'
    `);
    const flagVal = flagR.recordset[0] ? String(flagR.recordset[0].setting_value || '').trim() : '0';
    return res.json({
      success: true,
      data: {
        settings,
        loyalty_engine_v2: flagVal === '1' || flagVal.toLowerCase() === 'true'
      }
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/cosmos-time', ...settingsView, async (req, res, next) => {
  try {
    const { error, value } = cosmosTimeDeviceQuerySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }
    const snapshot = await getCosmosTimeSnapshot();
    const evaluation = evaluateCosmosTimeHealth(snapshot, value.device_ist_wire || null);
    res.set('Cache-Control', 'no-store');
    return res.json({
      success: true,
      data: Object.assign({}, snapshot, evaluation)
    });
  } catch (err) {
    return next(err);
  }
});

router.put('/cosmos-time', ...settingsManage, async (req, res, next) => {
  try {
    const { error, value } = cosmosTimePutSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }
    const pool = await getPool();
    const thresholdMinutes = await setThresholdMinutes(pool, value.threshold_minutes);
    await writeAuditLog({
      req,
      action: 'update',
      entityType: 'app_settings',
      entityId: 'cosmos_time_drift_threshold_minutes',
      notes: 'threshold_minutes=' + thresholdMinutes
    });
    const snapshot = await getCosmosTimeSnapshot({ pool });
    return res.json({
      success: true,
      data: Object.assign({}, snapshot, { threshold_minutes: thresholdMinutes })
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
