const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure, getPool } = require('../config/db');
const { requireModule, requirePermission } = require('../middleware/authorize');
const { writeAuditLog } = require('../services/auditService');
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
} = require('../config/customerOfferDiscountTypes');

const router = express.Router();

const settingsView = [requireModule('command_unit'), requirePermission('command_unit.settings.view')];
const settingsManage = [requireModule('command_unit'), requirePermission('command_unit.settings.edit')];
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

// ─── PROMOTION: CUSTOMER OFFERS (Eyewoot Go) ────────────────────────────────────

const scopeItemSchema = Joi.object({
  kind: Joi.string().valid(...ALLOWED_SCOPE_KINDS).required(),
  ref_int: Joi.number().integer().positive().allow(null),
  ref_key: Joi.string().max(60).allow(null, ''),
  is_exclusion: Joi.boolean().default(false)
}).or('ref_int', 'ref_key');

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
  eligible_tier: Joi.string().max(50).allow(null, ''),
  is_plus_only: Joi.boolean().default(false),
  sort_order: Joi.number().integer().min(0).default(0),
  scopes: Joi.array().items(scopeItemSchema).default([])
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
  eligible_tier: Joi.string().max(50).allow(null, ''),
  is_plus_only: Joi.boolean(),
  is_active: Joi.boolean(),
  sort_order: Joi.number().integer().min(0),
  scopes: Joi.array().items(scopeItemSchema)
}).min(1);

router.get('/customer-offers', ...promotionsView, async (req, res, next) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT offer_id, title, description, icon_emoji, discount_type,
             discount_value, trigger_type, trigger_value, benefit_target, max_discount_amount, scope_mode,
             valid_from, valid_to, eligible_tier,
             is_plus_only, is_active, sort_order, created_at
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
    const { error, value } = customerOfferCreateSchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }
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

    const istWall = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T');
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
      .input('eligible_tier', value.eligible_tier ? String(value.eligible_tier).trim() : null)
      .input('is_plus_only', value.is_plus_only ? 1 : 0)
      .input('sort_order', parseInt(value.sort_order, 10) || 0)
      .input('uid', req.user && req.user.user_id ? Number(req.user.user_id) : null)
      .query(`
        INSERT INTO dbo.customer_offers
          (title, description, icon_emoji, discount_type, discount_value,
           trigger_type, trigger_value, benefit_target, max_discount_amount, scope_mode,
           valid_from, valid_to, eligible_tier, is_plus_only, sort_order,
           created_by_user_id)
        OUTPUT INSERTED.offer_id
        VALUES
          (@title, @description, @icon_emoji, @discount_type, @discount_value,
           @trigger_type, @trigger_value, @benefit_target, @max_discount_amount, @scope_mode,
           @valid_from, @valid_to, @eligible_tier, @is_plus_only, @sort_order,
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

    const { error, value } = customerOfferUpdateSchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }

    const pool = await getPool();
    const {
      title, description, icon_emoji, discount_type, discount_value,
      trigger_type, trigger_value, benefit_target, max_discount_amount, scope_mode,
      valid_from, valid_to, eligible_tier, is_plus_only, is_active, sort_order,
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
      .input('eligible_tier', eligible_tier !== undefined ? (eligible_tier ? String(eligible_tier).trim() : null) : null)
      .input('is_plus_only', is_plus_only != null ? (is_plus_only ? 1 : 0) : null)
      .input('is_active', is_active != null ? (is_active ? 1 : 0) : null)
      .input('sort_order', sort_order != null ? parseInt(sort_order, 10) : null)
      .query(`
        UPDATE dbo.customer_offers SET
          title          = ISNULL(@title,          title),
          description    = ISNULL(@description,    description),
          icon_emoji     = ISNULL(@icon_emoji,     icon_emoji),
          discount_type  = ISNULL(@discount_type,  discount_type),
          discount_value = ISNULL(@discount_value, discount_value),
          trigger_type   = ISNULL(@trigger_type,   trigger_type),
          trigger_value  = ISNULL(@trigger_value,  trigger_value),
          benefit_target = ISNULL(@benefit_target, benefit_target),
          max_discount_amount = ISNULL(@max_discount_amount, max_discount_amount),
          scope_mode     = ISNULL(@scope_mode,     scope_mode),
          valid_from     = ISNULL(@valid_from,     valid_from),
          valid_to       = ISNULL(@valid_to,       valid_to),
          eligible_tier  = ISNULL(@eligible_tier,  eligible_tier),
          is_plus_only   = ISNULL(@is_plus_only,   is_plus_only),
          is_active      = ISNULL(@is_active,      is_active),
          sort_order     = ISNULL(@sort_order,     sort_order),
          updated_at     = DATEADD(MINUTE, 330, SYSUTCDATETIME())
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

module.exports = router;
