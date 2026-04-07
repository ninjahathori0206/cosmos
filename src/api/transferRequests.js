const express = require('express');
const sql     = require('mssql');
const Joi     = require('joi');
const { executeStoredProcedure } = require('../config/db');

const router = express.Router();

// Roles that belong to a specific store (their requests are scoped to that store)
const STORE_ROLES = new Set(['store_incharge', 'store_manager']);
function isStoreRole(role) { return STORE_ROLES.has(role); }

// ── GET /api/transfer-requests ────────────────────────────────────────────────
// Store roles → see only their own store's requests.
// HQ / admin  → see all. Optional ?status= and ?top_n= filters.
router.get('/', async (req, res, next) => {
  try {
    const user    = req.user;
    const storeId = isStoreRole(user.role) ? Number(user.store_id) : null;
    const { status, top_n = 50 } = req.query;

    const result = await executeStoredProcedure('sp_TransferRequest_List', {
      store_id: { type: sql.Int,         value: storeId || null },
      status:   { type: sql.VarChar(20), value: status  || null },
      top_n:    { type: sql.Int,         value: Math.min(Number(top_n) || 50, 200) }
    });

    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

// ── POST /api/transfer-requests ───────────────────────────────────────────────
// Creates a new transfer request (header + lines).
// store_id defaults to the caller's own store when not provided.
router.post('/', async (req, res, next) => {
  try {
    const { error, value } = Joi.object({
      store_id: Joi.number().integer().min(1).optional(),
      lines: Joi.array().items(
        Joi.object({
          sku_id: Joi.number().integer().min(1).required(),
          qty:    Joi.number().integer().min(1).required()
        })
      ).min(1).required(),
      notes: Joi.string().max(500).allow('', null).optional()
    }).validate(req.body);

    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const user            = req.user;
    const effectiveStore  = value.store_id || user.store_id;
    if (!effectiveStore) {
      return res.status(400).json({ success: false, message: 'store_id is required (or log in with a store-scoped account).' });
    }

    // Create header
    const createResult = await executeStoredProcedure('sp_TransferRequest_Create', {
      store_id: { type: sql.Int,           value: Number(effectiveStore) },
      user_id:  { type: sql.Int,           value: user.user_id },
      notes:    { type: sql.NVarChar(500), value: value.notes || null }
    });

    const requestId = createResult.recordset?.[0]?.request_id;
    if (!requestId) {
      return res.status(500).json({ success: false, message: 'Failed to create request — no ID returned.' });
    }

    // Add lines
    for (const line of value.lines) {
      await executeStoredProcedure('sp_TransferRequest_AddLine', {
        request_id:    { type: sql.Int, value: requestId },
        sku_id:        { type: sql.Int, value: line.sku_id },
        requested_qty: { type: sql.Int, value: line.qty }
      });
    }

    return res.status(201).json({ success: true, data: { request_id: requestId } });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/transfer-requests/:id ───────────────────────────────────────────
// Returns header + lines for one request (two recordsets from the SP).
router.get('/:id', async (req, res, next) => {
  try {
    const requestId = Number(req.params.id);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid request id.' });
    }

    const result = await executeStoredProcedure('sp_TransferRequest_GetById', {
      request_id: { type: sql.Int, value: requestId }
    });

    const header = result.recordsets?.[0]?.[0];
    const lines  = result.recordsets?.[1] || [];

    if (!header) {
      return res.status(404).json({ success: false, message: 'Transfer request not found.' });
    }

    return res.json({ success: true, data: { ...header, lines } });
  } catch (err) {
    return next(err);
  }
});

// ── PUT /api/transfer-requests/:id/status ────────────────────────────────────
// Allowed transitions (enforced at API level):
//   SUBMITTED  → APPROVED | REJECTED    (HQ / non-store-role only)
//   APPROVED   → DISPATCHED             (HQ / non-store-role only)
//   DISPATCHED → RECEIVED               (store role OR super_admin)
//
// Optional body:
//   lines         — array of { line_id, approved_qty? / dispatched_qty? / received_qty? }
//   extra_lines   — on DISPATCHED only: [{ sku_id, qty }] SKUs not on the request (HQ adds)
//   notes         — reviewer / dispatch note
router.put('/:id/status', async (req, res, next) => {
  try {
    const VALID_STATUSES = ['APPROVED', 'REJECTED', 'DISPATCHED', 'RECEIVED'];

    const { error, value } = Joi.object({
      status: Joi.string().valid(...VALID_STATUSES).required(),
      lines:  Joi.array().items(
        Joi.object({
          line_id:        Joi.number().integer().min(1).required(),
          approved_qty:   Joi.number().integer().min(0).optional(),
          dispatched_qty: Joi.number().integer().min(0).optional(),
          received_qty:   Joi.number().integer().min(0).optional()
        })
      ).optional(),
      extra_lines: Joi.array().items(
        Joi.object({
          sku_id: Joi.number().integer().min(1).required(),
          qty:    Joi.number().integer().min(1).required()
        })
      ).optional(),
      notes: Joi.string().max(500).allow('', null).optional()
    }).validate(req.body);

    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const user      = req.user;
    const requestId = Number(req.params.id);

    // Permission check
    const hqAction    = ['APPROVED', 'REJECTED', 'DISPATCHED'].includes(value.status);
    const storeAction = value.status === 'RECEIVED';

    if (hqAction && isStoreRole(user.role)) {
      return res.status(403).json({
        success: false,
        message: `Only HQ staff can set status to ${value.status}.`
      });
    }
    if (storeAction && !isStoreRole(user.role) && user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only store staff can confirm receipt.'
      });
    }

    // ── DISPATCHED: create a Transfer Document (decrement WAREHOUSE; store accepts/stocks later) ──
    let createdDocId = null;
    if (value.status === 'DISPATCHED') {
      const detail = await executeStoredProcedure('sp_TransferRequest_GetById', {
        request_id: { type: sql.Int, value: requestId }
      });
      const reqHeader = detail.recordsets?.[0]?.[0];
      const reqLines  = detail.recordsets?.[1] || [];

      if (!reqHeader) {
        return res.status(404).json({ success: false, message: 'Transfer request not found.' });
      }

      // Build dispatch lines from request rows.
      // If `lines` is provided, each listed line uses dispatched_qty (0 = omit); unlisted lines dispatch 0.
      // If `lines` is omitted, legacy: use body dispatched_qty > 0, else approved_qty, else requested_qty.
      const bodyLineMap = {};
      (value.lines || []).forEach((l) => { bodyLineMap[l.line_id] = l; });
      const linesProvided = Array.isArray(value.lines);

      const dispatchLines = reqLines
        .map((l) => {
          const bodyLine = bodyLineMap[l.line_id];
          let dispatchQty;
          if (linesProvided) {
            if (bodyLine && bodyLine.dispatched_qty != null) {
              dispatchQty = Math.max(0, Number(bodyLine.dispatched_qty));
            } else {
              dispatchQty = 0;
            }
          } else {
            dispatchQty =
              (bodyLine?.dispatched_qty != null && bodyLine.dispatched_qty > 0)
                ? bodyLine.dispatched_qty
                : (l.approved_qty != null && l.approved_qty > 0) ? l.approved_qty
                : l.requested_qty;
          }
          return { sku_id: l.sku_id, qty: dispatchQty, line_id: l.line_id };
        })
        .filter((l) => l.qty > 0);

      const extraLines = (value.extra_lines || []).filter((e) => e.sku_id && e.qty > 0);
      const allSkuLines = [
        ...dispatchLines.map(({ sku_id, qty }) => ({ sku_id, qty })),
        ...extraLines.map(({ sku_id, qty }) => ({ sku_id, qty }))
      ];

      if (!allSkuLines.length) {
        return res.status(422).json({ success: false, message: 'No dispatchable lines (all quantities are zero).' });
      }

      // Create Transfer Document — WAREHOUSE balance decrements here.
      // Store will Accept then Stock the document to credit their balance.
      const docResult = await executeStoredProcedure('sp_StockTransferDoc_Dispatch', {
        lines_json:        { type: sql.NVarChar(sql.MAX), value: JSON.stringify(allSkuLines) },
        to_store_id:       { type: sql.Int,               value: reqHeader.store_id },
        doc_type:          { type: sql.VarChar(10),        value: 'REQUEST' },
        source_request_id: { type: sql.Int,               value: requestId },
        notes:             { type: sql.NVarChar(500),      value: value.notes || `Dispatched from transfer request #${requestId}` },
        dispatched_by:     { type: sql.Int,               value: user.user_id }
      });

      createdDocId = docResult.recordset?.[0]?.doc_id || null;

      // Update dispatched_qty on each request line
      for (const l of dispatchLines) {
        await executeStoredProcedure('sp_TransferRequest_SetLineQty', {
          line_id:        { type: sql.Int, value: l.line_id },
          approved_qty:   { type: sql.Int, value: null },
          dispatched_qty: { type: sql.Int, value: l.qty },
          received_qty:   { type: sql.Int, value: null }
        });
      }
    }

    // Advance the lifecycle status
    await executeStoredProcedure('sp_TransferRequest_UpdateStatus', {
      request_id: { type: sql.Int,           value: requestId },
      status:     { type: sql.VarChar(20),   value: value.status },
      user_id:    { type: sql.Int,           value: user.user_id },
      notes:      { type: sql.NVarChar(500), value: value.notes || null }
    });

    // Update remaining per-line quantities (APPROVED / RECEIVED phases)
    if (value.status !== 'DISPATCHED' && value.lines?.length) {
      for (const line of value.lines) {
        await executeStoredProcedure('sp_TransferRequest_SetLineQty', {
          line_id:        { type: sql.Int, value: line.line_id },
          approved_qty:   { type: sql.Int, value: line.approved_qty   ?? null },
          dispatched_qty: { type: sql.Int, value: line.dispatched_qty ?? null },
          received_qty:   { type: sql.Int, value: line.received_qty   ?? null }
        });
      }
    }

    return res.json({ success: true, data: { request_id: requestId, status: value.status, doc_id: createdDocId } });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
