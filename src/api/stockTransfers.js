const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');
const { requireModule, requirePermission } = require('../middleware/authorize');

const router = express.Router();

const foundryStockView = [
  requireModule('foundry'),
  requirePermission('foundry.stock.view')
];
const foundryTransferHistoryView = [
  requireModule('foundry'),
  requirePermission('foundry.stock.view', 'foundry.transfers.view', 'storepilot.transfers.view')
];
const foundryStockCreate = [
  requireModule('foundry'),
  requirePermission('foundry.stock.create')
];

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

// Destination store list: implemented in app.js (GET /api/stock-transfers/destination-stores)
// so long-lived Node processes always pick it up.

// ── GET /api/stock-transfers/distribution/search?q=&limit= ───────────────────
// Full-text search across live SKUs for the Stock Distribution picker.
router.get('/distribution/search', ...foundryStockView, async (req, res, next) => {
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
router.get('/distribution/:sku_id', ...foundryStockView, async (req, res, next) => {
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
router.get('/available', ...foundryStockView, async (req, res, next) => {
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
router.get('/lookup', ...foundryStockView, async (req, res, next) => {
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
router.get('/history', ...foundryTransferHistoryView, async (req, res, next) => {
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

// ── GET /api/stock-transfers/store-catalogue ─────────────────────────────────
// Returns SKUs with qty > 0 at a specific store, for the StorePilot Store Catalogue page.
// Query params: store_id (required), q (optional search)
router.get('/store-catalogue', async (req, res, next) => {
  try {
    const { store_id, q } = req.query;
    const storeId = Number(store_id);
    if (!storeId || storeId <= 0) {
      return res.status(400).json({ success: false, message: 'store_id is required' });
    }
    const result = await executeStoredProcedure('sp_Store_Catalogue', {
      store_id: { type: sql.Int,          value: storeId },
      q:        { type: sql.NVarChar(200), value: q || null }
    });
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

// ── POST /api/stock-transfers ─────────────────────────────────────────────────
// Creates a direct HQ-to-store stock transfer.
// Body: { to_store_id, lines: [{ sku_id, qty }], notes? }
router.post('/', ...foundryStockCreate, async (req, res, next) => {
  try {
    const { error, value } = transferSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }

    const userId    = req.user && req.user.user_id ? Number(req.user.user_id) : null;
    const linesJson = JSON.stringify(value.lines.map(l => ({ sku_id: l.sku_id, qty: l.qty })));

    // Creates a Transfer Document: WAREHOUSE balance decrements immediately.
    // Store must Accept then Stock the document to credit their balance.
    const result = await executeStoredProcedure('sp_StockTransferDoc_Dispatch', {
      lines_json:        { type: sql.NVarChar(sql.MAX), value: linesJson },
      to_store_id:       { type: sql.Int,               value: value.to_store_id },
      doc_type:          { type: sql.VarChar(10),        value: 'DIRECT' },
      source_request_id: { type: sql.Int,               value: null },
      notes:             { type: sql.NVarChar(500),      value: value.notes || null },
      dispatched_by:     { type: sql.Int,               value: userId }
    });

    const docId = result.recordset?.[0]?.doc_id;
    return res.status(201).json({
      success: true,
      data: { doc_id: docId }
    });
  } catch (err) {
    if (err.code === 'EREQUEST') {
      return res.status(422).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

module.exports = router;
