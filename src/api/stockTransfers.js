const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');

const router = express.Router();

// ── Validation ─────────────────────────────────────────────────────────────────

const transferLineSchema = Joi.object({
  sku_id: Joi.number().integer().min(1).required(),
  qty:    Joi.number().integer().min(1).required()
});

const transferSchema = Joi.object({
  to_store_id: Joi.number().integer().min(1).required(),
  lines:       Joi.array().items(transferLineSchema).min(1).required(),
  notes:       Joi.string().max(500).allow('', null)
});

// ── GET /api/stock-transfers/distribution/search?q=&limit= ───────────────────
// Full-text search across live SKUs for the Stock Distribution picker.
router.get('/distribution/search', async (req, res, next) => {
  try {
    const { q, limit } = req.query;
    const maxLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const result = await executeStoredProcedure('sp_SKU_StockSearch', {
      q:     { type: sql.VarChar(200), value: q || null },
      top_n: { type: sql.Int,          value: maxLimit }
    });
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/stock-transfers/distribution/:sku_id ─────────────────────────────
// Returns SKU header + per-location stock breakdown for one SKU.
router.get('/distribution/:sku_id', async (req, res, next) => {
  try {
    const skuId = Number(req.params.sku_id);
    if (!Number.isFinite(skuId) || skuId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid sku_id' });
    }
    const result = await executeStoredProcedure('sp_SKU_StockDistribution', {
      sku_id: { type: sql.Int, value: skuId }
    });
    const sku = result.recordsets && result.recordsets[0] && result.recordsets[0][0];
    if (!sku) {
      return res.status(404).json({ success: false, message: 'SKU not found' });
    }
    const locations = (result.recordsets && result.recordsets[1]) || [];
    return res.json({ success: true, data: { sku, locations } });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/stock-transfers/available ────────────────────────────────────────
// Returns warehouse-stock SKUs that can be transferred.
// Query params: q (search), brand_id, product_type
router.get('/available', async (req, res, next) => {
  try {
    const { q, brand_id, product_type } = req.query;
    const result = await executeStoredProcedure('sp_StockTransfer_ListAvailable', {
      q:            { type: sql.VarChar(200), value: q            || null },
      brand_id:     { type: sql.Int,          value: brand_id     ? Number(brand_id) : null },
      product_type: { type: sql.VarChar(50),  value: product_type || null }
    });
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/stock-transfers/lookup ──────────────────────────────────────────
// Resolves a scanned QR / barcode / SKU code to a transferable SKU row.
// Query param: q (sku_code or barcode)
router.get('/lookup', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({ success: false, message: 'q param required' });
    }
    const result = await executeStoredProcedure('sp_StockTransfer_LookupByCode', {
      code: { type: sql.VarChar(200), value: q.trim() }
    });
    const row = result.recordset && result.recordset[0];
    if (!row) {
      return res.status(404).json({ success: false, message: 'SKU not found' });
    }
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/stock-transfers/history ─────────────────────────────────────────
// Returns recent HQ-to-store movements.
// Query params: to_store_id (optional), top_n (default 100)
router.get('/history', async (req, res, next) => {
  try {
    const { to_store_id, top_n } = req.query;
    const result = await executeStoredProcedure('sp_StockTransfer_History', {
      top_n:       { type: sql.Int, value: top_n       ? Number(top_n)       : 100 },
      to_store_id: { type: sql.Int, value: to_store_id ? Number(to_store_id) : null }
    });
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

// ── POST /api/stock-transfers ─────────────────────────────────────────────────
// Creates a direct HQ-to-store stock transfer.
// Body: { to_store_id, lines: [{ sku_id, qty }], notes? }
router.post('/', async (req, res, next) => {
  try {
    const { error, value } = transferSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }

    const userId = req.user && req.user.user_id ? Number(req.user.user_id) : null;
    const linesJson = JSON.stringify(value.lines);

    const result = await executeStoredProcedure('sp_StockTransfer_Create', {
      lines_json:  { type: sql.NVarChar(sql.MAX), value: linesJson },
      to_store_id: { type: sql.Int,               value: value.to_store_id },
      notes:       { type: sql.VarChar(500),       value: value.notes || null },
      created_by:  { type: sql.Int,                value: userId }
    });

    return res.status(201).json({
      success: true,
      data: result.recordset && result.recordset[0]
    });
  } catch (err) {
    if (err.code === 'EREQUEST') {
      return res.status(422).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

module.exports = router;
