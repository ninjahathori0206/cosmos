/**
 * Stock Transfer Document API
 *
 * Lifecycle: DISPATCHED → ACCEPTED → STOCKED
 *
 *  POST   /api/stock-transfer-docs          — HQ dispatches (Direct Transfer)
 *  GET    /api/stock-transfer-docs          — list (scoped by permissions + store_id)
 *  GET    /api/stock-transfer-docs/:id      — detail (header + lines)
 *  PUT    /api/stock-transfer-docs/:id/accept — store accepts  (DISPATCHED→ACCEPTED)
 *  PUT    /api/stock-transfer-docs/:id/stock  — store verifies (ACCEPTED→STOCKED)
 */
const express = require('express');
const sql     = require('mssql');
const Joi     = require('joi');
const { executeStoredProcedure } = require('../config/db');
const {
  requireModule,
  requirePermission,
  requireAnyModule
} = require('../middleware/authorize');
const {
  shouldScopeStockTransferDocsToUserStore,
  canAcceptOrStockTransfer
} = require('../config/storeRoles');

const router = express.Router();

const docListAccess = [
  requireAnyModule(['foundry', 'storepilot']),
  requirePermission('foundry.transfers.view', 'storepilot.transfers.view')
];

// ── POST /api/stock-transfer-docs ─────────────────────────────────────────────
// HQ dispatches a direct transfer.  Decrements WAREHOUSE balance immediately.
// Body: { to_store_id, lines: [{ sku_id, qty }], notes? }
router.post(
  '/',
  requireModule('foundry'),
  requirePermission('foundry.transfers.create'),
  async (req, res, next) => {
    try {
      const { error, value } = Joi.object({
        to_store_id: Joi.number().integer().min(1).required(),
        lines: Joi.array().items(
          Joi.object({
            sku_id: Joi.number().integer().min(1).required(),
            qty:    Joi.number().integer().min(1).required()
          })
        ).min(1).required(),
        notes: Joi.string().max(500).allow('', null).optional()
      }).validate(req.body, { abortEarly: false });

      if (error) {
        return res.status(400).json({ success: false, message: error.details.map(d => d.message).join('; ') });
      }

      const linesJson = JSON.stringify(value.lines.map(l => ({ sku_id: l.sku_id, qty: l.qty })));

      const result = await executeStoredProcedure('sp_StockTransferDoc_Dispatch', {
        lines_json:        { type: sql.NVarChar(sql.MAX), value: linesJson },
        to_store_id:       { type: sql.Int,               value: value.to_store_id },
        doc_type:          { type: sql.VarChar(10),        value: 'DIRECT' },
        source_request_id: { type: sql.Int,               value: null },
        notes:             { type: sql.NVarChar(500),      value: value.notes || null },
        dispatched_by:     { type: sql.Int,               value: req.user.user_id }
      });

      const docId = result.recordset?.[0]?.doc_id;
      return res.status(201).json({ success: true, data: { doc_id: docId } });
    } catch (err) {
      if (err.code === 'EREQUEST') {
        return res.status(422).json({ success: false, message: err.message });
      }
      return next(err);
    }
  }
);

// ── GET /api/stock-transfer-docs ──────────────────────────────────────────────
// Retail store users → their store only. HQ (Foundry create / no retail scope) → all or ?to_store_id=
// Optional: ?status=DISPATCHED|ACCEPTED|STOCKED  ?top_n=50
router.get('/', ...docListAccess, async (req, res, next) => {
  try {
    const user    = req.user;
    const storeId = shouldScopeStockTransferDocsToUserStore(req)
      ? Number(user.store_id)
      : (req.query.to_store_id ? Number(req.query.to_store_id) : null);
    const { status, top_n = 50 } = req.query;

    const result = await executeStoredProcedure('sp_StockTransferDoc_List', {
      to_store_id: { type: sql.Int,         value: storeId || null },
      status:      { type: sql.VarChar(12), value: status  || null },
      top_n:       { type: sql.Int,         value: Math.min(Number(top_n) || 50, 200) }
    });

    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/stock-transfer-docs/:id ─────────────────────────────────────────
router.get('/:id', ...docListAccess, async (req, res, next) => {
  try {
    const docId = Number(req.params.id);
    if (!Number.isFinite(docId) || docId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid doc id.' });
    }

    const result = await executeStoredProcedure('sp_StockTransferDoc_GetById', {
      doc_id: { type: sql.Int, value: docId }
    });

    const header = result.recordsets?.[0]?.[0];
    if (!header) {
      return res.status(404).json({ success: false, message: 'Transfer document not found.' });
    }

    if (
      shouldScopeStockTransferDocsToUserStore(req)
      && header.to_store_id !== Number(req.user.store_id)
    ) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const lines = result.recordsets?.[1] || [];
    return res.json({ success: true, data: { ...header, lines } });
  } catch (err) {
    return next(err);
  }
});

// ── PUT /api/stock-transfer-docs/:id/accept ───────────────────────────────────
// Store accepts the incoming transfer.  DISPATCHED → ACCEPTED.
router.put('/:id/accept', requireModule('storepilot'), async (req, res, next) => {
  try {
    const docId = Number(req.params.id);
    if (!Number.isFinite(docId) || docId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid doc id.' });
    }

    const getResult = await executeStoredProcedure('sp_StockTransferDoc_GetById', {
      doc_id: { type: sql.Int, value: docId }
    });
    const header = getResult.recordsets?.[0]?.[0];
    if (!header) {
      return res.status(404).json({ success: false, message: 'Transfer document not found.' });
    }

    if (!canAcceptOrStockTransfer(req, header.to_store_id)) {
      const userStore = req.user.store_id != null ? Number(req.user.store_id) : null;
      const dest = Number(header.to_store_id);
      if (userStore == null || userStore !== dest) {
        return res.status(403).json({
          success: false,
          message: 'Only staff at the destination store can accept this transfer.'
        });
      }
      return res.status(403).json({ success: false, message: 'Permission denied.' });
    }

    const result = await executeStoredProcedure('sp_StockTransferDoc_Accept', {
      doc_id:      { type: sql.Int, value: docId },
      accepted_by: { type: sql.Int, value: req.user.user_id }
    });

    return res.json({ success: true, data: result.recordset?.[0] || { doc_id: docId } });
  } catch (err) {
    if (err.code === 'EREQUEST') {
      return res.status(422).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

// ── PUT /api/stock-transfer-docs/:id/stock ────────────────────────────────────
// Store verifies quantities received.  ACCEPTED → STOCKED.
// Increments STORE balance per verified line.
// Body: { lines: [{ line_id, qty_received }] }
router.put('/:id/stock', requireModule('storepilot'), async (req, res, next) => {
  try {
    const docId = Number(req.params.id);
    if (!Number.isFinite(docId) || docId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid doc id.' });
    }

    const { error, value } = Joi.object({
      lines: Joi.array().items(
        Joi.object({
          line_id:      Joi.number().integer().min(1).required(),
          qty_received: Joi.number().integer().min(0).required()
        })
      ).min(1).required()
    }).validate(req.body, { abortEarly: false });

    if (error) {
      return res.status(400).json({ success: false, message: error.details.map(d => d.message).join('; ') });
    }

    const getResult = await executeStoredProcedure('sp_StockTransferDoc_GetById', {
      doc_id: { type: sql.Int, value: docId }
    });
    const header = getResult.recordsets?.[0]?.[0];
    if (!header) {
      return res.status(404).json({ success: false, message: 'Transfer document not found.' });
    }

    if (!canAcceptOrStockTransfer(req, header.to_store_id)) {
      const userStore = req.user.store_id != null ? Number(req.user.store_id) : null;
      const dest = Number(header.to_store_id);
      if (userStore == null || userStore !== dest) {
        return res.status(403).json({
          success: false,
          message: 'Only staff at the destination store can verify and stock transfers.'
        });
      }
      return res.status(403).json({ success: false, message: 'Permission denied.' });
    }

    const linesJson = JSON.stringify(value.lines);

    const result = await executeStoredProcedure('sp_StockTransferDoc_Stock', {
      doc_id:     { type: sql.Int,               value: docId },
      lines_json: { type: sql.NVarChar(sql.MAX), value: linesJson },
      stocked_by: { type: sql.Int,               value: req.user.user_id }
    });

    return res.json({ success: true, data: result.recordset?.[0] || { doc_id: docId } });
  } catch (err) {
    if (err.code === 'EREQUEST') {
      return res.status(422).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

module.exports = router;
