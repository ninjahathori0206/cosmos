/**
 * Foundry — POS lens catalogue admin (categories, packages, add-ons, links).
 * GET requires foundry.catalogue.view; mutating routes require foundry.catalogue.edit.
 */
const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');
const {
  requireModule,
  requirePermission
} = require('../middleware/authorize');

const router = express.Router();

const lensView = [requireModule('foundry'), requirePermission('foundry.catalogue.view')];
const lensEdit = [requireModule('foundry'), requirePermission('foundry.catalogue.edit')];

function mapProductTypeLensWizardRows(result) {
  const rs = result.recordsets || [];
  const productTypes = (rs[4] || []).map((r) => ({
    product_type_key: String(r.product_type_key || ''),
    lens_wizard_policy: String(r.lens_wizard_policy || 'NEVER'),
    fulfillment_mode: String(r.fulfillment_mode || ''),
    is_active: Boolean(r.is_active)
  }));
  const bridgeRows = (rs[5] || []).map((r) => ({
    product_type_key: String(r.product_type_key || ''),
    lens_category_id: Number(r.lens_category_id),
    sort_order: Number(r.sort_order) || 0
  }));
  return { productTypes, bridgeRows };
}

function buildAdminPayload(result) {
  const rs = result.recordsets || [];
  const wizard = mapProductTypeLensWizardRows(result);
  return {
    categories: rs[0] || [],
    packages: rs[1] || [],
    addons: rs[2] || [],
    packageAddons: (rs[3] || []).map((r) => ({
      package_id: Number(r.package_id),
      addon_id: Number(r.addon_id)
    })),
    productTypes: wizard.productTypes,
    bridgeRows: wizard.bridgeRows
  };
}

// GET /api/foundry/lens-config
router.get('/', ...lensView, async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_LensConfig_AdminGet', {});
    return res.json({ success: true, data: buildAdminPayload(result) });
  } catch (err) {
    return next(err);
  }
});

const catsSaveSchema = Joi.object({
  id: Joi.number().integer().min(1).optional(),
  pos_brand: Joi.string().max(100).allow('', null),
  pos_name: Joi.string().max(100).allow('', null).required(),
  internal_brand: Joi.string().max(100).allow('', null),
  internal_name: Joi.string().max(100).allow('', null),
  sort_order: Joi.number().integer().min(0).default(0),
  is_active: Joi.boolean().default(true),
  notes: Joi.string().max(500).allow('', null),
  show_in_pos_wizard: Joi.boolean().default(true),
  wizard_subtitle: Joi.string().max(250).allow('', null),
  wizard_icon: Joi.string().max(20).allow('', null),
  wizard_tone: Joi.number().integer().min(1).max(5).allow(null)
});

router.post('/categories', ...lensEdit, async (req, res, next) => {
  try {
    const { error, value } = catsSaveSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join('; ') });
    }
    const result = await executeStoredProcedure('sp_LensConfig_Category_Save', {
      id: { type: sql.Int, value: value.id || null },
      pos_brand: { type: sql.NVarChar(100), value: value.pos_brand || '' },
      pos_name: { type: sql.NVarChar(100), value: value.pos_name },
      internal_brand: { type: sql.NVarChar(100), value: value.internal_brand || '' },
      internal_name: { type: sql.NVarChar(100), value: value.internal_name || value.pos_name },
      sort_order: { type: sql.Int, value: value.sort_order },
      is_active: { type: sql.Bit, value: value.is_active ? 1 : 0 },
      notes: { type: sql.NVarChar(500), value: value.notes || null },
      show_in_pos_wizard: { type: sql.Bit, value: value.show_in_pos_wizard ? 1 : 0 },
      wizard_subtitle: { type: sql.NVarChar(250), value: value.wizard_subtitle || null },
      wizard_icon: { type: sql.NVarChar(20), value: value.wizard_icon || null },
      wizard_tone: { type: sql.TinyInt, value: value.wizard_tone || null }
    });
    const row = (result.recordset || [])[0];
    return res.status(201).json({ success: true, data: { id: row && row.id } });
  } catch (err) {
    if (err.code === 'EREQUEST') {
      return res.status(422).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

router.put('/categories/:id', ...lensEdit, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ success: false, message: 'Invalid category id.' });
    }
    const { error, value } = catsSaveSchema.validate({ ...req.body, id }, { abortEarly: false });
    if (error) {
      return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join('; ') });
    }
    const result = await executeStoredProcedure('sp_LensConfig_Category_Save', {
      id: { type: sql.Int, value: id },
      pos_brand: { type: sql.NVarChar(100), value: value.pos_brand || '' },
      pos_name: { type: sql.NVarChar(100), value: value.pos_name },
      internal_brand: { type: sql.NVarChar(100), value: value.internal_brand || '' },
      internal_name: { type: sql.NVarChar(100), value: value.internal_name || value.pos_name },
      sort_order: { type: sql.Int, value: value.sort_order },
      is_active: { type: sql.Bit, value: value.is_active ? 1 : 0 },
      notes: { type: sql.NVarChar(500), value: value.notes || null },
      show_in_pos_wizard: { type: sql.Bit, value: value.show_in_pos_wizard ? 1 : 0 },
      wizard_subtitle: { type: sql.NVarChar(250), value: value.wizard_subtitle || null },
      wizard_icon: { type: sql.NVarChar(20), value: value.wizard_icon || null },
      wizard_tone: { type: sql.TinyInt, value: value.wizard_tone || null }
    });
    const row = (result.recordset || [])[0];
    return res.json({ success: true, data: { id: row && row.id } });
  } catch (err) {
    if (err.code === 'EREQUEST') {
      return res.status(422).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

const pkgSaveSchema = Joi.object({
  id: Joi.number().integer().min(1).optional(),
  category_id: Joi.number().integer().min(1).required(),
  pos_brand: Joi.string().max(100).allow('', null),
  pos_name: Joi.string().max(100).allow('', null).required(),
  internal_brand: Joi.string().max(100).allow('', null),
  internal_name: Joi.string().max(100).allow('', null),
  price: Joi.number().min(0).required(),
  sort_order: Joi.number().integer().min(0).default(0),
  is_active: Joi.boolean().default(true),
  card_feat_line1: Joi.string().max(250).allow('', null),
  card_feat_line2: Joi.string().max(250).allow('', null),
  card_warranty_label: Joi.string().max(40).allow('', null),
  card_warranty_tone: Joi.number().integer().min(1).max(5).allow(null)
});

function lensConfigPackageSaveParams(value) {
  return {
    id: { type: sql.Int, value: value.id || null },
    category_id: { type: sql.Int, value: value.category_id },
    pos_brand: { type: sql.NVarChar(100), value: value.pos_brand || '' },
    pos_name: { type: sql.NVarChar(100), value: value.pos_name },
    internal_brand: { type: sql.NVarChar(100), value: value.internal_brand || '' },
    internal_name: { type: sql.NVarChar(100), value: value.internal_name || value.pos_name },
    price: { type: sql.Decimal(10, 2), value: value.price },
    sort_order: { type: sql.Int, value: value.sort_order },
    is_active: { type: sql.Bit, value: value.is_active ? 1 : 0 },
    card_feat_line1: { type: sql.NVarChar(250), value: value.card_feat_line1 || null },
    card_feat_line2: { type: sql.NVarChar(250), value: value.card_feat_line2 || null },
    card_warranty_label: { type: sql.NVarChar(40), value: value.card_warranty_label || null },
    card_warranty_tone: { type: sql.TinyInt, value: value.card_warranty_tone || null }
  };
}

router.post('/packages', ...lensEdit, async (req, res, next) => {
  try {
    const { error, value } = pkgSaveSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join('; ') });
    }
    const result = await executeStoredProcedure('sp_LensConfig_Package_Save', lensConfigPackageSaveParams(value));
    const row = (result.recordset || [])[0];
    return res.status(201).json({ success: true, data: { id: row && row.id } });
  } catch (err) {
    if (err.code === 'EREQUEST') {
      return res.status(422).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

router.put('/packages/:id', ...lensEdit, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ success: false, message: 'Invalid package id.' });
    }
    const { error, value } = pkgSaveSchema.validate({ ...req.body, id }, { abortEarly: false });
    if (error) {
      return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join('; ') });
    }
    const result = await executeStoredProcedure('sp_LensConfig_Package_Save', lensConfigPackageSaveParams({ ...value, id }));
    const row = (result.recordset || [])[0];
    return res.json({ success: true, data: { id: row && row.id } });
  } catch (err) {
    if (err.code === 'EREQUEST') {
      return res.status(422).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

const addonSaveSchema = Joi.object({
  id: Joi.number().integer().min(1).optional(),
  pos_brand: Joi.string().max(100).allow('', null),
  pos_name: Joi.string().max(100).allow('', null).required(),
  internal_brand: Joi.string().max(100).allow('', null),
  internal_name: Joi.string().max(100).allow('', null),
  price: Joi.number().min(0).required(),
  sort_order: Joi.number().integer().min(0).default(0),
  is_active: Joi.boolean().default(true)
});

router.post('/addons', ...lensEdit, async (req, res, next) => {
  try {
    const { error, value } = addonSaveSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join('; ') });
    }
    const result = await executeStoredProcedure('sp_LensConfig_Addon_Save', {
      id: { type: sql.Int, value: value.id || null },
      pos_brand: { type: sql.NVarChar(100), value: value.pos_brand || '' },
      pos_name: { type: sql.NVarChar(100), value: value.pos_name },
      internal_brand: { type: sql.NVarChar(100), value: value.internal_brand || '' },
      internal_name: { type: sql.NVarChar(100), value: value.internal_name || value.pos_name },
      price: { type: sql.Decimal(10, 2), value: value.price },
      sort_order: { type: sql.Int, value: value.sort_order },
      is_active: { type: sql.Bit, value: value.is_active ? 1 : 0 }
    });
    const row = (result.recordset || [])[0];
    return res.status(201).json({ success: true, data: { id: row && row.id } });
  } catch (err) {
    if (err.code === 'EREQUEST') {
      return res.status(422).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

router.put('/addons/:id', ...lensEdit, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ success: false, message: 'Invalid add-on id.' });
    }
    const { error, value } = addonSaveSchema.validate({ ...req.body, id }, { abortEarly: false });
    if (error) {
      return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join('; ') });
    }
    const result = await executeStoredProcedure('sp_LensConfig_Addon_Save', {
      id: { type: sql.Int, value: id },
      pos_brand: { type: sql.NVarChar(100), value: value.pos_brand || '' },
      pos_name: { type: sql.NVarChar(100), value: value.pos_name },
      internal_brand: { type: sql.NVarChar(100), value: value.internal_brand || '' },
      internal_name: { type: sql.NVarChar(100), value: value.internal_name || value.pos_name },
      price: { type: sql.Decimal(10, 2), value: value.price },
      sort_order: { type: sql.Int, value: value.sort_order },
      is_active: { type: sql.Bit, value: value.is_active ? 1 : 0 }
    });
    const row = (result.recordset || [])[0];
    return res.json({ success: true, data: { id: row && row.id } });
  } catch (err) {
    if (err.code === 'EREQUEST') {
      return res.status(422).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

const pkgAddonsSchema = Joi.object({
  addon_ids: Joi.array().items(Joi.number().integer().min(1)).required()
});

router.put('/packages/:id/addons', ...lensEdit, async (req, res, next) => {
  try {
    const packageId = Number(req.params.id);
    if (!Number.isFinite(packageId) || packageId < 1) {
      return res.status(400).json({ success: false, message: 'Invalid package id.' });
    }
    const { error, value } = pkgAddonsSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join('; ') });
    }
    const json = JSON.stringify(value.addon_ids || []);
    const result = await executeStoredProcedure('sp_LensConfig_PackageAddons_Set', {
      package_id: { type: sql.Int, value: packageId },
      addon_ids_json: { type: sql.NVarChar(sql.MAX), value: json }
    });
    const row = (result.recordset || [])[0];
    return res.json({ success: true, data: { package_id: row && row.package_id } });
  } catch (err) {
    if (err.code === 'EREQUEST') {
      return res.status(422).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

// ── GET /api/foundry/lens-config/product-type-rules ──────────────────────────
// Returns product type lens policies + full bridge matrix (for Foundry matrix page).
// Loaded fresh from sp_LensConfig_AdminGet RS4+RS5.
router.get('/product-type-rules', ...lensView, async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_LensConfig_AdminGet', {});
    const { productTypes, bridgeRows } = mapProductTypeLensWizardRows(result);
    return res.json({ success: true, data: { productTypes, bridgeRows } });
  } catch (err) {
    return next(err);
  }
});

const productTypeLensWizardSchema = Joi.object({
  lens_wizard_policy: Joi.string().valid('NEVER', 'OPTIONAL', 'REQUIRED').allow(null),
  // [{id, sort_order}] — empty array clears allow-list; null/omit = don't touch
  category_ids: Joi.array().items(
    Joi.object({
      id: Joi.number().integer().min(1).required(),
      sort_order: Joi.number().integer().min(0).default(0)
    })
  ).allow(null)
});

// ── PUT /api/foundry/lens-config/product-type-rules/:key ─────────────────────
// Update lens_wizard_policy and/or the category allow-list for one product type.
router.put('/product-type-rules/:key', ...lensEdit, async (req, res, next) => {
  try {
    const key = String(req.params.key || '').trim().toUpperCase();
    if (!key) return res.status(400).json({ success: false, message: 'Invalid product type key.' });
    const { error, value } = productTypeLensWizardSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join('; ') });
    }
    const catIdsJson = value.category_ids !== null && value.category_ids !== undefined
      ? JSON.stringify(value.category_ids.map((x) => ({ id: x.id, sort_order: x.sort_order })))
      : null;
    // Only call SP if there's something to update
    if (value.lens_wizard_policy !== null && value.lens_wizard_policy !== undefined || catIdsJson !== null) {
      await executeStoredProcedure('sp_LensConfig_ProductTypeLensWizard_Set', {
        product_type_key: { type: sql.NVarChar(100), value: key },
        lens_wizard_policy: { type: sql.VarChar(20), value: value.lens_wizard_policy || null },
        category_ids_json: { type: sql.NVarChar(sql.MAX), value: catIdsJson !== null ? catIdsJson : '[]' }
      });
    }
    return res.json({ success: true });
  } catch (err) {
    if (err.code === 'EREQUEST') {
      return res.status(422).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

module.exports = router;
