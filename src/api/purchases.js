const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');

const router = express.Router();

// ── Validation schemas ──────────────────────────────────────────────────────

const colourSchema = Joi.object({
  colour_name: Joi.string().max(100).required(),
  colour_code: Joi.string().max(20).required(),
  quantity:    Joi.number().integer().min(1).required()
});

const itemSchema = Joi.object({
  product_master_id: Joi.number().integer().required(),
  maker_master_id:   Joi.number().integer().allow(null),
  purchase_rate:     Joi.number().precision(2).positive().required(),
  quantity:          Joi.number().integer().positive().required(),
  gst_pct:           Joi.number().precision(4).min(0).required(),
  colours:           Joi.array().items(colourSchema).min(1).required()
});

const createSchema = Joi.object({
  supplier_id:    Joi.number().integer().required(),
  source_type:    Joi.string().max(50).allow('', null),
  bill_ref:       Joi.string().max(100).allow('', null),
  purchase_date:  Joi.date().required(),
  transport_cost: Joi.number().precision(2).min(0).default(0),
  po_reference:   Joi.string().max(100).allow('', null),
  notes:          Joi.string().max(500).allow('', null),
  items:          Joi.array().items(itemSchema).min(1).required()
});

const updateSchema = Joi.object({
  supplier_id:    Joi.number().integer().allow(null),
  source_type:    Joi.string().max(50).allow('', null),
  bill_ref:       Joi.string().max(100).allow('', null),
  purchase_date:  Joi.date().allow(null),
  transport_cost: Joi.number().precision(2).min(0).allow(null),
  po_reference:   Joi.string().max(100).allow('', null),
  notes:          Joi.string().max(500).allow('', null)
});

const billVerifySchema = Joi.object({
  actual_bill_amt:  Joi.number().precision(2).required(),
  bill_number:      Joi.string().max(100).required(),
  bill_date:        Joi.date().required(),
  discrepancy_note: Joi.string().max(500).allow('', null)
});

const brandingDispatchSchema = Joi.object({
  branding_instructions: Joi.string().max(500).allow('', null)
});

const brandingBypassSchema = Joi.object({
  bypass_reason: Joi.string().max(500).required()
});

const skuGenerateSchema = Joi.object({
  item_id:        Joi.number().integer().required(),
  item_colour_id: Joi.number().integer().required(),
  sale_price:     Joi.number().precision(2).positive().required()
});

// ── GET dashboard stats ─────────────────────────────────────────────────────
router.get('/dashboard-stats', async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_Foundry_DashboardStatsV2', {});
    return res.json({
      success: true,
      data: {
        purchases: result.recordsets[0] && result.recordsets[0][0],
        skus:      result.recordsets[1] && result.recordsets[1][0],
        stock:     result.recordsets[2] && result.recordsets[2][0],
        suppliers: result.recordsets[3] && result.recordsets[3][0]
      }
    });
  } catch (err) { return next(err); }
});

// ── GET all purchase headers ────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { pipeline_status, q } = req.query;
    const result = await executeStoredProcedure('sp_PurchaseHeader_GetAll', {
      pipeline_status: { type: sql.VarChar(50),  value: pipeline_status || null },
      search_term:     { type: sql.VarChar(200), value: q || null }
    });
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) { return next(err); }
});

// ── GET single purchase header with items + colours ─────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const result = await executeStoredProcedure('sp_PurchaseHeader_GetById', {
      header_id: { type: sql.Int, value: id }
    });
    const header = result.recordsets[0] && result.recordsets[0][0];
    if (!header) return res.status(404).json({ success: false, message: 'Purchase not found' });
    const items   = result.recordsets[1] || [];
    const colours = result.recordsets[2] || [];
    // Attach colours to their items
    items.forEach((item) => {
      item.colours = colours.filter((c) => c.item_id === item.item_id);
    });
    return res.json({ success: true, data: { header, items } });
  } catch (err) { return next(err); }
});

// ── GET SKUs for a header ────────────────────────────────────────────────────
router.get('/:id/skus', async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_PurchaseHeader_GetSKUs', {
      header_id: { type: sql.Int, value: Number(req.params.id) }
    });
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) { return next(err); }
});

// ── POST create purchase (header + items) ───────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { error, value } = createSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });

    const userId = req.user && req.user.user_id ? Number(req.user.user_id) : null;

    // First create all product masters if needed (handled by client before calling this)
    // Build JSON for items
    const itemsJson = JSON.stringify(value.items.map((it) => ({
      product_master_id: it.product_master_id,
      maker_master_id:   it.maker_master_id || null,
      purchase_rate:     it.purchase_rate,
      quantity:          it.quantity,
      gst_pct:           it.gst_pct,
      colours:           it.colours
    })));

    const result = await executeStoredProcedure('sp_PurchaseHeader_Create', {
      supplier_id:    { type: sql.Int,              value: value.supplier_id },
      source_type:    { type: sql.VarChar(50),       value: value.source_type || null },
      bill_ref:       { type: sql.VarChar(100),      value: value.bill_ref || null },
      purchase_date:  { type: sql.DateTime,          value: value.purchase_date },
      transport_cost: { type: sql.Decimal(10,2),     value: value.transport_cost || 0 },
      po_reference:   { type: sql.VarChar(100),      value: value.po_reference || null },
      notes:          { type: sql.VarChar(500),      value: value.notes || null },
      created_by:     { type: sql.Int,              value: userId },
      items_json:     { type: sql.NVarChar(sql.MAX), value: itemsJson }
    });

    const header  = result.recordsets[0] && result.recordsets[0][0];
    const items   = result.recordsets[1] || [];
    const colours = result.recordsets[2] || [];
    items.forEach((item) => { item.colours = colours.filter((c) => c.item_id === item.item_id); });

    return res.status(201).json({ success: true, data: { header, items } });
  } catch (err) {
    if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
    return next(err);
  }
});

// ── PUT update header details (Stage 1 edit) ────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const { error, value } = updateSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
    const result = await executeStoredProcedure('sp_PurchaseHeader_Update', {
      header_id:      { type: sql.Int,           value: Number(req.params.id) },
      supplier_id:    { type: sql.Int,           value: value.supplier_id    || null },
      source_type:    { type: sql.VarChar(50),   value: value.source_type    || null },
      bill_ref:       { type: sql.VarChar(100),  value: value.bill_ref       || null },
      purchase_date:  { type: sql.DateTime,      value: value.purchase_date  || null },
      transport_cost: { type: sql.Decimal(10,2), value: value.transport_cost ?? null },
      po_reference:   { type: sql.VarChar(100),  value: value.po_reference   || null },
      notes:          { type: sql.VarChar(500),  value: value.notes          || null }
    });
    const row = result.recordset && result.recordset[0];
    if (!row) return res.status(404).json({ success: false, message: 'Purchase not found' });
    return res.json({ success: true, data: row });
  } catch (err) {
    if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
    return next(err);
  }
});

// ── PUT Stage 2: Verify Bill ─────────────────────────────────────────────────
router.put('/:id/verify-bill', async (req, res, next) => {
  try {
    const { error, value } = billVerifySchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
    const result = await executeStoredProcedure('sp_PurchaseHeader_VerifyBill', {
      header_id:        { type: sql.Int,          value: Number(req.params.id) },
      actual_bill_amt:  { type: sql.Decimal(10,2), value: value.actual_bill_amt },
      bill_number:      { type: sql.VarChar(100),  value: value.bill_number },
      bill_date:        { type: sql.DateTime,      value: value.bill_date },
      discrepancy_note: { type: sql.VarChar(500),  value: value.discrepancy_note || null }
    });
    const row = result.recordset && result.recordset[0];
    return res.json({ success: true, data: row });
  } catch (err) {
    if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
    return next(err);
  }
});

// ── PUT Stage 3: Branding Dispatch ───────────────────────────────────────────
router.put('/:id/branding-dispatch', async (req, res, next) => {
  try {
    const { error, value } = brandingDispatchSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
    const result = await executeStoredProcedure('sp_PurchaseHeader_BrandingDispatch', {
      header_id:             { type: sql.Int,         value: Number(req.params.id) },
      branding_instructions: { type: sql.VarChar(500), value: value.branding_instructions || null }
    });
    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
    return next(err);
  }
});

// ── PUT Stage 3: Branding Receive ────────────────────────────────────────────
router.put('/:id/branding-receive', async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_PurchaseHeader_BrandingReceive', {
      header_id: { type: sql.Int, value: Number(req.params.id) }
    });
    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
    return next(err);
  }
});

// ── PUT Stage 3: Branding Bypass ─────────────────────────────────────────────
router.put('/:id/branding-bypass', async (req, res, next) => {
  try {
    const { error, value } = brandingBypassSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
    const result = await executeStoredProcedure('sp_PurchaseHeader_BrandingBypass', {
      header_id:     { type: sql.Int,         value: Number(req.params.id) },
      bypass_reason: { type: sql.VarChar(500), value: value.bypass_reason }
    });
    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
    return next(err);
  }
});

// ── POST Stage 4: Generate SKU ───────────────────────────────────────────────
router.post('/:id/generate-sku', async (req, res, next) => {
  try {
    const { error, value } = skuGenerateSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
    const result = await executeStoredProcedure('sp_SKUv2_Generate', {
      header_id:      { type: sql.Int,          value: Number(req.params.id) },
      item_id:        { type: sql.Int,           value: value.item_id },
      item_colour_id: { type: sql.Int,           value: value.item_colour_id },
      sale_price:     { type: sql.Decimal(10,2), value: value.sale_price }
    });
    const row = result.recordset && result.recordset[0];
    return res.json({ success: true, data: row });
  } catch (err) {
    if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
    return next(err);
  }
});

// ── PUT Colour Media: save image_url and/or video_url for a colour variant ─────
router.put('/:id/colours/:colourId/media', async (req, res, next) => {
  try {
    const { image_url, video_url } = req.body;
    if (!image_url && !video_url)
      return res.status(400).json({ success: false, message: 'image_url or video_url is required.' });
    const result = await executeStoredProcedure('sp_PurchaseItemColour_SetMedia', {
      colour_id: { type: sql.Int,          value: Number(req.params.colourId) },
      image_url: { type: sql.VarChar(500), value: image_url || null },
      video_url: { type: sql.VarChar(500), value: video_url || null }
    });
    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) { return next(err); }
});

// ── PUT Stage 5: Warehouse Ready ─────────────────────────────────────────────
router.put('/:id/warehouse-ready', async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_PurchaseHeader_WarehouseReady', {
      header_id: { type: sql.Int, value: Number(req.params.id) }
    });
    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
    return next(err);
  }
});

module.exports = router;
