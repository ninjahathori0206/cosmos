const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');

const router = express.Router();

const productSchema = Joi.object({
  source_type:       Joi.string().max(50).allow('', null),
  maker_id:          Joi.number().integer().allow(null),
  maker_master_id:   Joi.number().integer().allow(null),
  source_brand:      Joi.string().max(200).allow('', null),
  home_brand_id:     Joi.number().integer().allow(null),
  source_collection: Joi.string().max(200).allow('', null),
  ew_collection:     Joi.string().max(200).required(),
  style_model:       Joi.string().max(200).required(),
  product_type:      Joi.string().max(50).allow('', null),
  branding_required: Joi.boolean().default(true),
  catalogue_status:  Joi.string().valid('ACTIVE','DRAFT','DISCONTINUED').optional()
});

router.get('/', async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_ProductMaster_GetAll', {});
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

router.get('/check-repeat', async (req, res, next) => {
  try {
    const { ew_collection, style_model, home_brand_id, source_brand } = req.query;
    if (!ew_collection || !style_model) {
      return res.status(400).json({ success: false, message: 'ew_collection and style_model required' });
    }
    const result = await executeStoredProcedure('sp_ProductMaster_CheckRepeat', {
      ew_collection: { type: sql.VarChar(200), value: ew_collection },
      style_model: { type: sql.VarChar(200), value: style_model },
      home_brand_id: { type: sql.Int, value: home_brand_id ? Number(home_brand_id) : null },
      source_brand: { type: sql.VarChar(200), value: source_brand || null }
    });
    const row = result.recordset && result.recordset[0];
    return res.json({ success: true, data: row || null });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', async (req, res, next) => {
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

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = productSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }

    const userId = req.user && req.user.user_id ? Number(req.user.user_id) : null;

    const resolvedMakerId = value.maker_id || value.maker_master_id || null;
    const result = await executeStoredProcedure('sp_ProductMaster_Create', {
      source_type:       { type: sql.VarChar(50),  value: value.source_type || null },
      maker_id:          { type: sql.Int,           value: resolvedMakerId },
      source_brand:      { type: sql.VarChar(200),  value: value.source_brand || null },
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

router.put('/:id', async (req, res, next) => {
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

    const resolvedMakerId = value.maker_id || value.maker_master_id || null;
    const result = await executeStoredProcedure('sp_ProductMaster_Update', {
      product_id: { type: sql.Int, value: id },
      source_type: { type: sql.VarChar(50), value: value.source_type || null },
      maker_id: { type: sql.Int, value: resolvedMakerId },
      source_brand: { type: sql.VarChar(200), value: value.source_brand || null },
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
router.put('/:id/details', async (req, res, next) => {
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
