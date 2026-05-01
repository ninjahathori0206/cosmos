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

function buildAdminPayload(result) {
  const rs = result.recordsets || [];
  return {
    categories: rs[0] || [],
    packages: rs[1] || [],
    addons: rs[2] || [],
    packageAddons: (rs[3] || []).map((r) => ({
      package_id: Number(r.package_id),
      addon_id: Number(r.addon_id)
    }))
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
  notes: Joi.string().max(500).allow('', null)
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
      notes: { type: sql.NVarChar(500), value: value.notes || null }
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
      notes: { type: sql.NVarChar(500), value: value.notes || null }
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
  is_active: Joi.boolean().default(true)
});

router.post('/packages', ...lensEdit, async (req, res, next) => {
  try {
    const { error, value } = pkgSaveSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join('; ') });
    }
    const result = await executeStoredProcedure('sp_LensConfig_Package_Save', {
      id: { type: sql.Int, value: value.id || null },
      category_id: { type: sql.Int, value: value.category_id },
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
    const result = await executeStoredProcedure('sp_LensConfig_Package_Save', {
      id: { type: sql.Int, value: id },
      category_id: { type: sql.Int, value: value.category_id },
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

module.exports = router;
