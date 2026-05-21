const express = require('express');
const sql     = require('mssql');
const Joi     = require('joi');
const { executeStoredProcedure } = require('../config/db');
const {
  requireAnyModule,
  requirePermission,
  hasPermission,
  isSuperAdmin
} = require('../middleware/authorize');
const {
  shouldScopeTransferRequestsToUserStore,
  canConfirmTransferReceipt
} = require('../config/storeRoles');
const { buildDispatchSkuLines } = require('../services/transferDispatchUnits');

const router = express.Router();

const transferModAndView = [
  requireAnyModule(['foundry', 'storepilot']),
  requirePermission('foundry.transfers.view', 'storepilot.transfers.view')
];
const transferModAndRaise = [
  requireAnyModule(['foundry', 'storepilot']),
  requirePermission('foundry.transfers.create', 'storepilot.transfers.create')
];

function transferLineCap(line) {
  if (line.approved_qty != null && Number(line.approved_qty) > 0) {
    return Number(line.approved_qty);
  }
  return Math.max(0, Number(line.requested_qty) || 0);
}

function computeDispatchHeaderStatus(lines) {
  if (!lines || !lines.length) return 'APPROVED';
  let anyDispatched = false;
  let allComplete = true;
  for (const l of lines) {
    const cap = transferLineCap(l);
    const disp = Math.max(0, Number(l.dispatched_qty) || 0);
    if (disp > 0) anyDispatched = true;
    if (disp < cap) allComplete = false;
  }
  if (allComplete && anyDispatched) return 'DISPATCHED';
  if (anyDispatched) return 'PARTIALLY_DISPATCHED';
  return 'APPROVED';
}

function requestHasAnyDispatched(lines) {
  return (lines || []).some((l) => Math.max(0, Number(l.dispatched_qty) || 0) > 0);
}

async function syncTransferRequestFromDocs(requestId) {
  const result = await executeStoredProcedure('sp_TransferRequest_SyncDispatchedFromDocs', {
    request_id: { type: sql.Int, value: requestId }
  });
  return result.recordset?.[0]?.status || null;
}

// ── GET /api/transfer-requests ────────────────────────────────────────────────
// Store-scoped (permissions + store_id) → own store only. HQ (foundry.transfers.edit) → all.
// Optional ?status= and ?top_n= filters.
router.get('/', ...transferModAndView, async (req, res, next) => {
  try {
    const user    = req.user;
    const storeId = shouldScopeTransferRequestsToUserStore(req)
      ? Number(user.store_id)
      : null;
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
router.post('/', ...transferModAndRaise, async (req, res, next) => {
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

// ── GET /api/transfer-requests/:id/shipments ─────────────────────────────────
router.get('/:id/shipments', ...transferModAndView, async (req, res, next) => {
  try {
    const requestId = Number(req.params.id);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid request id.' });
    }

    const detail = await executeStoredProcedure('sp_TransferRequest_GetById', {
      request_id: { type: sql.Int, value: requestId }
    });
    const header = detail.recordsets?.[0]?.[0];
    if (!header) {
      return res.status(404).json({ success: false, message: 'Transfer request not found.' });
    }
    if (
      shouldScopeTransferRequestsToUserStore(req)
      && Number(header.store_id) !== Number(req.user.store_id)
    ) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { top_n = 50 } = req.query;
    const result = await executeStoredProcedure('sp_StockTransferDoc_List', {
      to_store_id:       { type: sql.Int, value: null },
      status:            { type: sql.VarChar(12), value: null },
      source_request_id: { type: sql.Int, value: requestId },
      top_n:             { type: sql.Int, value: Math.min(Number(top_n) || 50, 200) }
    });

    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

// ── POST /api/transfer-requests/:id/reconcile ────────────────────────────────
// Sync line dispatched_qty from transfer docs and recompute header status.
router.post(
  '/:id/reconcile',
  requireAnyModule(['foundry']),
  requirePermission('foundry.transfers.edit'),
  async (req, res, next) => {
    try {
      const requestId = Number(req.params.id);
      if (!Number.isFinite(requestId) || requestId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid request id.' });
      }

      const detail = await executeStoredProcedure('sp_TransferRequest_GetById', {
        request_id: { type: sql.Int, value: requestId }
      });
      const header = detail.recordsets?.[0]?.[0];
      if (!header) {
        return res.status(404).json({ success: false, message: 'Transfer request not found.' });
      }

      const status = await syncTransferRequestFromDocs(requestId);
      const refreshed = await executeStoredProcedure('sp_TransferRequest_GetById', {
        request_id: { type: sql.Int, value: requestId }
      });
      const newHeader = refreshed.recordsets?.[0]?.[0];
      const lines = refreshed.recordsets?.[1] || [];

      return res.json({
        success: true,
        data: {
          request_id: requestId,
          status: status || newHeader?.status,
          lines
        }
      });
    } catch (err) {
      return next(err);
    }
  }
);

// ── GET /api/transfer-requests/:id ───────────────────────────────────────────
// Returns header + lines for one request (two recordsets from the SP).
router.get('/:id', ...transferModAndView, async (req, res, next) => {
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

    if (
      shouldScopeTransferRequestsToUserStore(req)
      && Number(header.store_id) !== Number(req.user.store_id)
    ) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    return res.json({ success: true, data: { ...header, lines } });
  } catch (err) {
    return next(err);
  }
});

// ── PUT /api/transfer-requests/:id/status ────────────────────────────────────
// Allowed transitions (enforced at API level):
//   SUBMITTED  → APPROVED | REJECTED    (foundry.transfers.edit or super_admin)
//   APPROVED / PARTIALLY_DISPATCHED → shipment (body status DISPATCHED) → PARTIALLY_DISPATCHED or DISPATCHED
//   DISPATCHED → RECEIVED               (storepilot.transfers.edit + store; super_admin)
//
// Optional body:
//   lines         — array of { line_id, approved_qty? / dispatched_qty? / received_qty? }
//   extra_lines   — on DISPATCHED only: [{ sku_id, qty, unit_ids? }] SKUs not on the request (HQ adds)
//   notes         — reviewer / dispatch note
router.put('/:id/status', requireAnyModule(['foundry', 'storepilot']), requirePermission('foundry.transfers.edit', 'storepilot.transfers.edit'), async (req, res, next) => {
  try {
    const VALID_STATUSES = ['APPROVED', 'REJECTED', 'DISPATCHED', 'RECEIVED'];

    const { error, value } = Joi.object({
      status: Joi.string().valid(...VALID_STATUSES).required(),
      lines:  Joi.array().items(
        Joi.object({
          line_id:        Joi.number().integer().min(1).required(),
          approved_qty:   Joi.number().integer().min(0).optional(),
          dispatched_qty: Joi.number().integer().min(0).optional(),
          received_qty:   Joi.number().integer().min(0).optional(),
          unit_ids:       Joi.array().items(Joi.number().integer().min(1)).optional()
        })
      ).optional(),
      extra_lines: Joi.array().items(
        Joi.object({
          sku_id:   Joi.number().integer().min(1).required(),
          qty:      Joi.number().integer().min(1).required(),
          unit_ids: Joi.array().items(Joi.number().integer().min(1)).optional()
        })
      ).optional(),
      notes: Joi.string().max(500).allow('', null).optional()
    }).validate(req.body);

    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const user      = req.user;
    const requestId = Number(req.params.id);

    if (value.status === 'REJECTED') {
      const rejectDetail = await executeStoredProcedure('sp_TransferRequest_GetById', {
        request_id: { type: sql.Int, value: requestId }
      });
      const rejectHeader = rejectDetail.recordsets?.[0]?.[0];
      const rejectLines  = rejectDetail.recordsets?.[1] || [];
      if (!rejectHeader) {
        return res.status(404).json({ success: false, message: 'Transfer request not found.' });
      }
      if (requestHasAnyDispatched(rejectLines)) {
        return res.status(422).json({
          success: false,
          message: 'Cannot reject a request after stock has been dispatched. Ship the remainder or contact support.'
        });
      }
    }

    // Permission check
    const hqAction    = ['APPROVED', 'REJECTED', 'DISPATCHED'].includes(value.status);
    const storeAction = value.status === 'RECEIVED';

    if (hqAction && !isSuperAdmin(req) && !hasPermission(req, 'foundry.transfers.edit')) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied for this transfer action.'
      });
    }
    if (storeAction && !canConfirmTransferReceipt(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only store staff can confirm receipt.'
      });
    }

    // RECEIVED: fully dispatched only; must be for this user's store when scoped
    if (storeAction) {
      const recvDetail = await executeStoredProcedure('sp_TransferRequest_GetById', {
        request_id: { type: sql.Int, value: requestId }
      });
      const recvHeader = recvDetail.recordsets?.[0]?.[0];
      const recvLines  = recvDetail.recordsets?.[1] || [];
      if (!recvHeader) {
        return res.status(404).json({ success: false, message: 'Transfer request not found.' });
      }
      if (recvHeader.status !== 'DISPATCHED') {
        return res.status(422).json({
          success: false,
          message: recvHeader.status === 'PARTIALLY_DISPATCHED'
            ? 'Request is only partially dispatched. Receive each shipment under Incoming Goods, then confirm when HQ has shipped the full approved quantity.'
            : 'Request must be fully dispatched before confirming receipt.'
        });
      }
      if (!isSuperAdmin(req)) {
        const userStore = user.store_id != null ? Number(user.store_id) : null;
        const reqStore  = Number(recvHeader.store_id);
        if (userStore == null || userStore !== reqStore) {
          return res.status(403).json({
            success: false,
            message: 'Only staff at the requesting store can confirm receipt.'
          });
        }
      }
    }

    // ── Shipment dispatch (body status DISPATCHED): create transfer doc; cumulative line qty ──
    let createdDocId = null;
    let computedHeaderStatus = value.status;
    if (value.status === 'DISPATCHED') {
      const detail = await executeStoredProcedure('sp_TransferRequest_GetById', {
        request_id: { type: sql.Int, value: requestId }
      });
      const reqHeader = detail.recordsets?.[0]?.[0];
      const reqLines  = detail.recordsets?.[1] || [];

      if (!reqHeader) {
        return res.status(404).json({ success: false, message: 'Transfer request not found.' });
      }

      const headerStatus = String(reqHeader.status || '');
      if (!['APPROVED', 'PARTIALLY_DISPATCHED'].includes(headerStatus)) {
        return res.status(422).json({
          success: false,
          message: headerStatus === 'DISPATCHED'
            ? 'Request is fully dispatched. No remaining quantity to ship on this request.'
            : `Cannot dispatch shipment while request status is ${headerStatus}.`
        });
      }

      // Build dispatch lines from request rows.
      // If `lines` is provided, each listed line uses dispatched_qty (0 = omit); unlisted lines dispatch 0.
      // If `lines` is omitted, legacy: use body dispatched_qty > 0, else approved_qty, else requested_qty.
      const bodyLineMap = {};
      (value.lines || []).forEach((l) => { bodyLineMap[l.line_id] = l; });
      const linesProvided = Array.isArray(value.lines);

      const dispatchLines = [];
      for (const l of reqLines) {
        const bodyLine = bodyLineMap[l.line_id];
        let shipmentQty;
        if (linesProvided) {
          if (bodyLine && bodyLine.dispatched_qty != null) {
            shipmentQty = Math.max(0, Number(bodyLine.dispatched_qty));
          } else {
            shipmentQty = 0;
          }
        } else {
          shipmentQty =
            (bodyLine?.dispatched_qty != null && bodyLine.dispatched_qty > 0)
              ? bodyLine.dispatched_qty
              : transferLineCap(l) - Math.max(0, Number(l.dispatched_qty) || 0);
        }
        if (shipmentQty < 1) continue;

        const cap = transferLineCap(l);
        const already = Math.max(0, Number(l.dispatched_qty) || 0);
        const remaining = cap - already;
        if (shipmentQty > remaining) {
          const err = new Error(
            `SKU ${l.sku_code || l.sku_id}: shipment qty ${shipmentQty} exceeds remaining ${remaining} (approved ${cap}, already dispatched ${already}).`
          );
          err.statusCode = 422;
          throw err;
        }

        const unitIds = bodyLine && Array.isArray(bodyLine.unit_ids) ? bodyLine.unit_ids : undefined;
        dispatchLines.push({
          sku_id: l.sku_id,
          qty: shipmentQty,
          line_id: l.line_id,
          unit_ids: unitIds,
          sku_code: l.sku_code
        });
      }

      const extraLines = (value.extra_lines || []).filter((e) => e.sku_id && e.qty > 0);

      if (!dispatchLines.length && !extraLines.length) {
        return res.status(422).json({ success: false, message: 'No dispatchable lines (all quantities are zero).' });
      }

      let allSkuLines;
      try {
        allSkuLines = await buildDispatchSkuLines(
          dispatchLines.map(({ sku_id, qty, unit_ids }) => ({ sku_id, qty, unit_ids })),
          extraLines.map(({ sku_id, qty, unit_ids }) => ({ sku_id, qty, unit_ids })),
          reqLines,
          { strictUnitOnly: true }
        );
      } catch (unitErr) {
        const code = unitErr.statusCode === 422 ? 422 : 500;
        return res.status(code).json({ success: false, message: unitErr.message });
      }

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

      for (const l of dispatchLines) {
        await executeStoredProcedure('sp_TransferRequest_AddDispatchedQty', {
          line_id: { type: sql.Int, value: l.line_id },
          add_qty: { type: sql.Int, value: l.qty }
        });
      }

      try {
        const syncedStatus = await syncTransferRequestFromDocs(requestId);
        if (syncedStatus) computedHeaderStatus = syncedStatus;
      } catch (syncErr) {
        const partialErr = new Error(
          createdDocId
            ? `Transfer document #${createdDocId} was created but request sync failed. Re-open the request or use Reconcile.`
            : 'Shipment was recorded but request sync failed. Re-open the request or use Reconcile.'
        );
        partialErr.statusCode = 422;
        partialErr.doc_id = createdDocId;
        throw partialErr;
      }
    }

    const statusToWrite = value.status === 'DISPATCHED' ? computedHeaderStatus : value.status;

    try {
      await executeStoredProcedure('sp_TransferRequest_UpdateStatus', {
        request_id: { type: sql.Int,           value: requestId },
        status:     { type: sql.VarChar(20),   value: statusToWrite },
        user_id:    { type: sql.Int,           value: user.user_id },
        notes:      { type: sql.NVarChar(500), value: value.notes || null }
      });
    } catch (statusErr) {
      if (value.status === 'DISPATCHED' && createdDocId) {
        const partialErr = new Error(
          `Transfer document #${createdDocId} was created but request status update failed. Use Reconcile on the request.`
        );
        partialErr.statusCode = 422;
        partialErr.doc_id = createdDocId;
        throw partialErr;
      }
      throw statusErr;
    }

    // Quick approve (no lines body): default approved_qty = requested_qty per line
    if (value.status === 'APPROVED' && !value.lines?.length) {
      const approveDetail = await executeStoredProcedure('sp_TransferRequest_GetById', {
        request_id: { type: sql.Int, value: requestId }
      });
      const approveLines = approveDetail.recordsets?.[1] || [];
      for (const line of approveLines) {
        const reqQty = Math.max(0, Number(line.requested_qty) || 0);
        if (reqQty < 1) continue;
        const curApproved = line.approved_qty != null ? Number(line.approved_qty) : null;
        if (curApproved != null && curApproved > 0) continue;
        await executeStoredProcedure('sp_TransferRequest_SetLineQty', {
          line_id:        { type: sql.Int, value: line.line_id },
          approved_qty:   { type: sql.Int, value: reqQty },
          dispatched_qty: { type: sql.Int, value: null },
          received_qty:   { type: sql.Int, value: null }
        });
      }
    }

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

    const fullyDispatched = statusToWrite === 'DISPATCHED';
    return res.json({
      success: true,
      data: {
        request_id: requestId,
        status: statusToWrite,
        doc_id: createdDocId,
        fully_dispatched: fullyDispatched
      }
    });
  } catch (err) {
    if (err.statusCode === 422) {
      const body = { success: false, message: err.message };
      if (err.doc_id != null) body.doc_id = err.doc_id;
      return res.status(422).json(body);
    }
    return next(err);
  }
});

module.exports = router;
