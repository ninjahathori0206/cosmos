const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');
const { requireModule, requirePermission } = require('../middleware/authorize');

const router = express.Router();

const foundryPurchasesView = [
  requireModule('foundry'),
  requirePermission('foundry.purchases.view')
];
const foundryPurchasesCreate = [
  requireModule('foundry'),
  requirePermission('foundry.purchases.create')
];
const foundryPurchasesEdit = [
  requireModule('foundry'),
  requirePermission('foundry.purchases.edit')
];

/** Master Catalogue list + other product reads that serve catalogue users. */
const foundryCatalogueOrPurchasesView = [
  requireModule('foundry'),
  requirePermission('foundry.catalogue.view', 'foundry.purchases.view')
];

const productSchema = Joi.object({
  source_type:       Joi.string().max(50).allow('', null),
  maker_id:          Joi.number().integer().allow(null),
  maker_master_id:   Joi.number().integer().allow(null),
  source_brand:      Joi.string().max(200).allow('', null),
  source_model_number: Joi.string().max(200).allow('', null),
  home_brand_id:     Joi.number().integer().allow(null),
  source_collection: Joi.string().max(200).allow('', null),
  ew_collection:     Joi.string().max(200).required(),
  style_model:       Joi.string().max(200).required(),
  product_type:      Joi.string().max(50).allow('', null),
  branding_required: Joi.boolean().default(true),
  catalogue_status:  Joi.string().valid('ACTIVE','DRAFT','DISCONTINUED').optional()
});

router.get('/', ...foundryCatalogueOrPurchasesView, async (req, res, next) => {
  try {
    const { catalogue_status, source_type, q, product_type, brand_id } = req.query;
    const cs = catalogue_status != null && String(catalogue_status).trim() !== ''
      ? String(catalogue_status).trim().toUpperCase()
      : null;
    const st = source_type != null && String(source_type).trim() !== ''
      ? String(source_type).trim()
      : null;
    const qv = q != null && String(q).trim() !== '' ? String(q).trim() : null;
    const pt = product_type != null && String(product_type).trim() !== ''
      ? String(product_type).trim()
      : null;
    const bid = brand_id != null && String(brand_id).trim() !== ''
      ? parseInt(String(brand_id).trim(), 10)
      : null;
    const result = await executeStoredProcedure('sp_ProductMaster_GetAll', {
      catalogue_status: { type: sql.VarChar(20), value: cs },
      source_type: { type: sql.VarChar(50), value: st },
      q: { type: sql.VarChar(200), value: qv },
      product_type: { type: sql.VarChar(50), value: pt },
      home_brand_id: { type: sql.Int, value: Number.isFinite(bid) ? bid : null }
    });
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

router.get('/check-repeat', ...foundryPurchasesView, async (req, res, next) => {
  try {
    const {
      ew_collection,
      style_model,
      home_brand_id,
      source_brand,
      source_model_number,
      maker_master_id
    } = req.query;

    const hasSourceLookup = Boolean(source_brand && source_model_number);
    const hasLegacyLookup = Boolean(ew_collection && style_model);
    if (!hasSourceLookup && !hasLegacyLookup) {
      return res.status(400).json({
        success: false,
        message: 'Provide source_brand + source_model_number or ew_collection + style_model'
      });
    }

    const mmCheck = maker_master_id != null && maker_master_id !== '' ? Number(maker_master_id) : null;
    const result = await executeStoredProcedure('sp_ProductMaster_CheckRepeat', {
      ew_collection: { type: sql.VarChar(200), value: ew_collection || null },
      style_model: { type: sql.VarChar(200), value: style_model || null },
      home_brand_id: { type: sql.Int, value: home_brand_id ? Number(home_brand_id) : null },
      source_brand: { type: sql.VarChar(200), value: source_brand || null },
      source_model_number: { type: sql.VarChar(200), value: source_model_number || null },
      maker_master_id: { type: sql.Int, value: Number.isFinite(mmCheck) ? mmCheck : null }
    });
    const row = result.recordset && result.recordset[0];
    return res.json({
      success: true,
      exists: Boolean(row),
      product_master_id: row ? row.product_id : null,
      data: row || null
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/source-suggestions', ...foundryPurchasesView, async (req, res, next) => {
  try {
    const { field, q, source_brand, source_collection, limit, maker_master_id } = req.query;
    const allowed = new Set(['source_brand', 'source_collection', 'source_model_number']);
    if (!allowed.has(field)) {
      return res.status(400).json({
        success: false,
        message: 'field must be one of source_brand, source_collection, source_model_number'
      });
    }

    const maxLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const mmId = maker_master_id != null && maker_master_id !== '' ? Number(maker_master_id) : null;
    const result = await executeStoredProcedure('sp_ProductMaster_SourceSuggestions', {
      field_name: { type: sql.VarChar(40), value: field },
      q: { type: sql.VarChar(200), value: q || null },
      maker_master_id: { type: sql.Int, value: Number.isFinite(mmId) ? mmId : null },
      source_brand: { type: sql.VarChar(200), value: source_brand || null },
      source_collection: { type: sql.VarChar(200), value: source_collection || null },
      top_n: { type: sql.Int, value: maxLimit }
    });
    const suggestions = (result.recordset || [])
      .map((r) => r.suggestion)
      .filter((v) => typeof v === 'string' && v.trim());
    return res.json({ success: true, data: suggestions });
  } catch (err) {
    return next(err);
  }
});

router.get('/search', ...foundryPurchasesView, async (req, res, next) => {
  try {
    const { q, maker_master_id, limit } = req.query;
    const maxLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const mmId = maker_master_id != null && maker_master_id !== '' ? Number(maker_master_id) : null;
    const result = await executeStoredProcedure('sp_ProductMaster_Search', {
      q:               { type: sql.VarChar(200), value: q || null },
      maker_master_id: { type: sql.Int,          value: Number.isFinite(mmId) ? mmId : null },
      top_n:           { type: sql.Int,          value: maxLimit }
    });
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', ...foundryCatalogueOrPurchasesView, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const result = await executeStoredProcedure('sp_ProductMaster_GetById', {
      product_id: { type: sql.Int, value: id }
    });
    const row = result.recordset && result.recordset[0];
    if (!row) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/', ...foundryPurchasesCreate, async (req, res, next) => {
  try {
    const { error, value } = productSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }
    if (value.source_model_number && !value.source_brand) {
      return res.status(400).json({
        success: false,
        message: 'source_brand is required when source_model_number is provided'
      });
    }

    const userId = req.user && req.user.user_id ? Number(req.user.user_id) : null;

    const resolvedMakerSupplierId = value.maker_id != null ? Number(value.maker_id) : null;
    const resolvedMakerMasterId = value.maker_master_id != null ? Number(value.maker_master_id) : null;
    const result = await executeStoredProcedure('sp_ProductMaster_Create', {
      source_type:       { type: sql.VarChar(50),  value: value.source_type || null },
      maker_id:          { type: sql.Int,           value: resolvedMakerSupplierId },
      maker_master_id:   { type: sql.Int,           value: resolvedMakerMasterId },
      source_brand:      { type: sql.VarChar(200),  value: value.source_brand || null },
      source_model_number: { type: sql.VarChar(200), value: value.source_model_number || null },
      home_brand_id:     { type: sql.Int,           value: value.home_brand_id || null },
      source_collection: { type: sql.VarChar(200),  value: value.source_collection || null },
      ew_collection:     { type: sql.VarChar(200),  value: value.ew_collection },
      style_model:       { type: sql.VarChar(200),  value: value.style_model },
      product_type:      { type: sql.VarChar(50),   value: value.product_type || null },
      branding_required: { type: sql.Bit,           value: value.branding_required ? 1 : 0 },
      created_by:        { type: sql.Int,           value: userId }
    });

    return res.status(201).json({
      success: true,
      data: result.recordset && result.recordset[0]
    });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', ...foundryPurchasesEdit, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { error, value } = productSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }
    if (value.source_model_number && !value.source_brand) {
      return res.status(400).json({
        success: false,
        message: 'source_brand is required when source_model_number is provided'
      });
    }

    const resolvedMakerSupplierId = value.maker_id != null ? Number(value.maker_id) : null;
    const resolvedMakerMasterId = value.maker_master_id != null ? Number(value.maker_master_id) : null;
    const result = await executeStoredProcedure('sp_ProductMaster_Update', {
      product_id: { type: sql.Int, value: id },
      source_type: { type: sql.VarChar(50), value: value.source_type || null },
      maker_id: { type: sql.Int, value: resolvedMakerSupplierId },
      maker_master_id: { type: sql.Int, value: resolvedMakerMasterId },
      source_brand: { type: sql.VarChar(200), value: value.source_brand || null },
      source_model_number: { type: sql.VarChar(200), value: value.source_model_number || null },
      home_brand_id: { type: sql.Int, value: value.home_brand_id || null },
      source_collection: { type: sql.VarChar(200), value: value.source_collection || null },
      ew_collection: { type: sql.VarChar(200), value: value.ew_collection },
      style_model: { type: sql.VarChar(200), value: value.style_model },
      product_type: { type: sql.VarChar(50), value: value.product_type },
      branding_required: { type: sql.Bit, value: value.branding_required ? 1 : 0 },
      catalogue_status: { type: sql.VarChar(30), value: value.catalogue_status || 'ACTIVE' }
    });

    const row = result.recordset && result.recordset[0];
    if (!row) return res.status(404).json({ success: false, message: 'Product not found' });

    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/products/:id/details — update digitisation / catalogue detail fields
router.put('/:id/details', ...foundryPurchasesEdit, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { description, frame_width, lens_height, temple_length, frame_material, image_url } = req.body;
    const result = await executeStoredProcedure('sp_ProductMaster_UpdateDetails', {
      product_id:     { type: sql.Int,          value: id },
      description:    { type: sql.VarChar(500),  value: description    || null },
      frame_width:    { type: sql.Decimal(5, 1), value: frame_width    != null ? Number(frame_width)    : null },
      lens_height:    { type: sql.Decimal(5, 1), value: lens_height    != null ? Number(lens_height)    : null },
      temple_length:  { type: sql.Decimal(5, 1), value: temple_length  != null ? Number(temple_length)  : null },
      frame_material: { type: sql.VarChar(100),  value: frame_material || null },
      image_url:      { type: sql.VarChar(500),  value: image_url      || null }
    });
    const row = result.recordset && result.recordset[0];
    if (!row) return res.status(404).json({ success: false, message: 'Product not found' });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

module.exports = router;
