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
const {
  isAllowedTransferRequestListView,
  DEFAULT_TRANSFER_REQUEST_LIST_VIEW,
  DEFAULT_LIST_TOP_N,
  getTransferRequestListViewTopNDefault,
  HISTORY_DEFAULT_DAYS
} = require('../config/transferRequestListViewsCatalog');

const router = express.Router();

const TRANSFER_REQUEST_RESERVED_PATHS = new Set(['history', 'search-skus']);

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

function requestHasAnyDispatched(lines) {
  return (lines || []).some((l) => Math.max(0, Number(l.dispatched_qty) || 0) > 0);
}

function computeRemainderLines(lines) {
  const out = [];
  for (const line of lines || []) {
    const cap = transferLineCap(line);
    const progressed = Math.max(
      Math.max(0, Number(line.dispatched_qty) || 0),
      Math.max(0, Number(line.received_qty) || 0)
    );
    const remainder = cap - progressed;
    if (remainder > 0) {
      out.push({
        sku_id: line.sku_id,
        qty: remainder,
        sku_code: line.sku_code
      });
    }
  }
  return out;
}

async function requestHasStockedDocs(requestId) {
  const result = await executeStoredProcedure('sp_StockTransferDoc_List', {
    to_store_id:       { type: sql.Int, value: null },
    status:            { type: sql.VarChar(12), value: null },
    source_request_id: { type: sql.Int, value: requestId },
    top_n:             { type: sql.Int, value: 5 }
  });
  return (result.recordset || []).some((d) => String(d.status) === 'STOCKED');
}

function shouldAutoSyncTransferRequestOnGet(header, lines) {
  const st = String(header?.status || '');
  if (['RECEIVED', 'PARTIALLY_RECEIVED', 'DISPATCHED', 'PARTIALLY_DISPATCHED'].includes(st)) {
    return true;
  }
  return (lines || []).some(
    (l) =>
      (Math.max(0, Number(l.dispatched_qty) || 0) > 0) ||
      (Math.max(0, Number(l.received_qty) || 0) > 0)
  );
}

async function syncTransferRequestFromDocs(requestId) {
  const dispatchResult = await executeStoredProcedure('sp_TransferRequest_SyncDispatchedFromDocs', {
    request_id: { type: sql.Int, value: requestId }
  });
  const dispatchStatus = dispatchResult.recordset?.[0]?.status || null;
  try {
    const receivedResult = await executeStoredProcedure('sp_TransferRequest_SyncReceivedFromDocs', {
      request_id: { type: sql.Int, value: requestId }
    });
    return receivedResult.recordset?.[0]?.status || dispatchStatus;
  } catch (err) {
    if (err.message && /sp_TransferRequest_SyncReceivedFromDocs/i.test(err.message)) {
      return dispatchStatus;
    }
    throw err;
  }
}

function toSkuAvailabilityLabel(qty) {
  return Number(qty) > 0 ? 'AVAILABLE' : 'NOT_AVAILABLE';
}

function maskRequestSearchRows(rows, req) {
  const showQty = isSuperAdmin(req)
    || hasPermission(req, 'foundry.stock.view')
    || hasPermission(req, 'foundry.transfers.create')
    || hasPermission(req, 'foundry.transfers.view');
  if (showQty) return rows || [];
  return (rows || []).map((row) => {
    const warehouseQty = Number(row.warehouse_qty) || 0;
    return {
      ...row,
      warehouse_qty: null,
      availability: toSkuAvailabilityLabel(warehouseQty),
      is_available: warehouseQty > 0
    };
  });
}

// ── GET /api/transfer-requests/search-skus ───────────────────────────────────
// SKU catalogue search for store create-request (unit code → SKU; no unit location gate).
router.get('/search-skus', ...transferModAndRaise, async (req, res, next) => {
  try {
    const q = req.query.q != null ? String(req.query.q).trim() : '';
    if (!q) {
      return res.status(400).json({ success: false, message: 'q param required' });
    }
    const result = await executeStoredProcedure('sp_TransferRequest_SearchSkus', {
      q: { type: sql.VarChar(200), value: q }
    });
    const rows = result.recordset || [];
    return res.json({ success: true, data: maskRequestSearchRows(rows, req) });
  } catch (err) {
    return next(err);
  }
});

function istDateStringFromDate(d) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function istDateAddDays(isoDate, deltaDays) {
  const [y, m, day] = String(isoDate).split('-').map(Number);
  const anchor = new Date(`${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00+05:30`);
  anchor.setDate(anchor.getDate() + deltaDays);
  return istDateStringFromDate(anchor);
}

function resolveHistoryStoreId(req, queryStoreId) {
  if (shouldScopeTransferRequestsToUserStore(req)) {
    return Number(req.user.store_id) || null;
  }
  if (queryStoreId != null && String(queryStoreId).trim() !== '') {
    const qStore = Number(queryStoreId);
    if (!Number.isFinite(qStore) || qStore <= 0) return { error: 'Invalid store_id.' };
    return { storeId: qStore };
  }
  return { storeId: null };
}

// ── GET /api/transfer-requests/history ─────────────────────────────────────────
async function handleTransferRequestHistoryGet(req, res, next) {
  try {
    const { error, value } = Joi.object({
      store_id: Joi.number().integer().min(1).optional(),
      request_id: Joi.number().integer().min(1).optional(),
      date_from: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
      date_to: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
      sku_q: Joi.string().max(100).allow('').optional(),
      unit_barcode: Joi.string().max(20).allow('').optional(),
      top_n: Joi.number().integer().min(1).max(200).optional()
    }).validate(req.query, { convert: true, stripUnknown: true });

    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const storeResolved = resolveHistoryStoreId(req, value.store_id);
    if (storeResolved.error) {
      return res.status(400).json({ success: false, message: storeResolved.error });
    }

    const skuQ = value.sku_q != null ? String(value.sku_q).trim() : '';
    const unitQ = value.unit_barcode != null ? String(value.unit_barcode).trim() : '';
    const hasRequestId = Number.isFinite(value.request_id) && value.request_id > 0;
    const hasOptionalLookup = hasRequestId || !!skuQ || !!unitQ;
    let dateFrom = value.date_from || null;
    let dateTo = value.date_to || null;

    if (dateFrom && dateTo && dateFrom > dateTo) {
      return res.status(400).json({ success: false, message: 'date_from cannot be after date_to.' });
    }

    /* Request ID, SKU, and unit are optional; default date window when browsing by store/dates only */
    if (!hasOptionalLookup && (!dateFrom || !dateTo)) {
      dateTo = istDateStringFromDate(new Date());
      dateFrom = istDateAddDays(dateTo, -(HISTORY_DEFAULT_DAYS - 1));
    }

    const result = await executeStoredProcedure('sp_TransferRequest_SearchHistory', {
      store_id: { type: sql.Int, value: storeResolved.storeId },
      request_id: { type: sql.Int, value: hasRequestId ? value.request_id : null },
      date_from: { type: sql.Date, value: dateFrom || null },
      date_to: { type: sql.Date, value: dateTo || null },
      sku_q: { type: sql.VarChar(100), value: skuQ || null },
      unit_barcode: { type: sql.VarChar(20), value: unitQ || null },
      top_n: { type: sql.Int, value: Math.min(Number(value.top_n) || 200, 200) }
    });

    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
}

router.get('/history', ...transferModAndView, handleTransferRequestHistoryGet);

// ── GET /api/transfer-requests ────────────────────────────────────────────────
// Store-scoped (permissions + store_id) → own store only. HQ (foundry.transfers.edit) → all.
// Optional ?view= (need_attention|partial|fulfilled), legacy ?status=, ?store_id=, ?top_n=
router.get('/', ...transferModAndView, async (req, res, next) => {
  try {
    const user = req.user;
    let storeId = null;
    if (shouldScopeTransferRequestsToUserStore(req)) {
      storeId = Number(user.store_id);
    } else if (req.query.store_id != null && String(req.query.store_id).trim() !== '') {
      const qStore = Number(req.query.store_id);
      if (!Number.isFinite(qStore) || qStore <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid store_id.' });
      }
      storeId = qStore;
    }

    const viewRaw = req.query.view != null ? String(req.query.view).trim() : '';
    const { status, top_n } = req.query;
    let viewParam = null;
    let statusParam = null;

    if (viewRaw) {
      if (!isAllowedTransferRequestListView(viewRaw)) {
        return res.status(400).json({ success: false, message: 'Invalid view. Use need_attention, partial, or fulfilled.' });
      }
      viewParam = viewRaw;
    } else if (status) {
      statusParam = String(status).trim() || null;
    } else {
      viewParam = DEFAULT_TRANSFER_REQUEST_LIST_VIEW;
    }

    const topDefault = viewParam
      ? getTransferRequestListViewTopNDefault(viewParam)
      : DEFAULT_LIST_TOP_N;

    const result = await executeStoredProcedure('sp_TransferRequest_List', {
      store_id: { type: sql.Int, value: storeId || null },
      status: { type: sql.VarChar(20), value: statusParam },
      view: { type: sql.VarChar(30), value: viewParam },
      top_n: { type: sql.Int, value: Math.min(Number(top_n) || topDefault, 200) }
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
// Sync line dispatched_qty and received_qty from transfer docs; recompute header status.
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
    if (TRANSFER_REQUEST_RESERVED_PATHS.has(String(req.params.id || '').toLowerCase())) {
      return res.status(404).json({
        success: false,
        message: 'Use GET /api/transfer-requests/history for request history search.'
      });
    }
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

    if (
      shouldAutoSyncTransferRequestOnGet(header, lines) ||
      (await requestHasStockedDocs(requestId))
    ) {
      await syncTransferRequestFromDocs(requestId);
      const refreshed = await executeStoredProcedure('sp_TransferRequest_GetById', {
        request_id: { type: sql.Int, value: requestId }
      });
      const newHeader = refreshed.recordsets?.[0]?.[0];
      const newLines = refreshed.recordsets?.[1] || [];
      if (newHeader) {
        return res.json({ success: true, data: { ...newHeader, lines: newLines } });
      }
    }

    return res.json({ success: true, data: { ...header, lines } });
  } catch (err) {
    return next(err);
  }
});

// ── POST /api/transfer-requests/:id/remainder ─────────────────────────────────
// Create a new SUBMITTED request for approved qty not yet shipped/stocked.
router.post('/:id/remainder', ...transferModAndRaise, async (req, res, next) => {
  try {
    const parentId = Number(req.params.id);
    if (!Number.isFinite(parentId) || parentId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid request id.' });
    }

    const detail = await executeStoredProcedure('sp_TransferRequest_GetById', {
      request_id: { type: sql.Int, value: parentId }
    });
    const parentHeader = detail.recordsets?.[0]?.[0];
    const parentLines  = detail.recordsets?.[1] || [];
    if (!parentHeader) {
      return res.status(404).json({ success: false, message: 'Transfer request not found.' });
    }

    if (
      shouldScopeTransferRequestsToUserStore(req)
      && Number(parentHeader.store_id) !== Number(req.user.store_id)
    ) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const allowedParent = ['PARTIALLY_DISPATCHED', 'DISPATCHED', 'PARTIALLY_RECEIVED', 'RECEIVED'];
    if (!allowedParent.includes(String(parentHeader.status || ''))) {
      return res.status(422).json({
        success: false,
        message: 'Remainder requests can only be created after HQ has approved and started shipping.'
      });
    }

    const remainderLines = computeRemainderLines(parentLines);
    if (!remainderLines.length) {
      return res.status(422).json({
        success: false,
        message: 'No remaining quantity on this request — nothing to request.'
      });
    }

    const user = req.user;
    const storeId = Number(parentHeader.store_id);
    const notes = `Remainder of request #${parentId}`;

    const createResult = await executeStoredProcedure('sp_TransferRequest_Create', {
      store_id: { type: sql.Int, value: storeId },
      user_id:  { type: sql.Int, value: user.user_id },
      notes:    { type: sql.NVarChar(500), value: notes }
    });
    const newRequestId = createResult.recordset?.[0]?.request_id;
    if (!newRequestId) {
      return res.status(500).json({ success: false, message: 'Failed to create remainder request.' });
    }

    for (const line of remainderLines) {
      await executeStoredProcedure('sp_TransferRequest_AddLine', {
        request_id:    { type: sql.Int, value: newRequestId },
        sku_id:        { type: sql.Int, value: line.sku_id },
        requested_qty: { type: sql.Int, value: line.qty }
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        request_id: newRequestId,
        parent_request_id: parentId,
        lines: remainderLines
      }
    });
  } catch (err) {
    return next(err);
  }
});

// ── PUT /api/transfer-requests/:id/lines ─────────────────────────────────────
// HQ: adjust approved_qty on historical lines (then re-sync from docs).
router.put(
  '/:id/lines',
  requireAnyModule(['foundry']),
  requirePermission('foundry.transfers.edit'),
  async (req, res, next) => {
    try {
      const requestId = Number(req.params.id);
      if (!Number.isFinite(requestId) || requestId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid request id.' });
      }

      const { error, value } = Joi.object({
        lines: Joi.array().items(
          Joi.object({
            line_id:      Joi.number().integer().min(1).required(),
            approved_qty: Joi.number().integer().min(0).required()
          })
        ).min(1).required()
      }).validate(req.body);

      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
      }

      const detail = await executeStoredProcedure('sp_TransferRequest_GetById', {
        request_id: { type: sql.Int, value: requestId }
      });
      const header = detail.recordsets?.[0]?.[0];
      const requestLines = detail.recordsets?.[1] || [];
      if (!header) {
        return res.status(404).json({ success: false, message: 'Transfer request not found.' });
      }

      const lineById = new Map(requestLines.map((l) => [Number(l.line_id), l]));

      for (const line of value.lines) {
        const existing = lineById.get(Number(line.line_id));
        if (!existing) {
          return res.status(422).json({
            success: false,
            message: `Line ${line.line_id} not found on this request.`
          });
        }
        const requestedQty = Math.max(0, Number(existing.requested_qty) || 0);
        if (Number(line.approved_qty) > requestedQty) {
          return res.status(422).json({
            success: false,
            message: `Approved qty cannot exceed requested (${requestedQty}) for line ${line.line_id}.`
          });
        }
        await executeStoredProcedure('sp_TransferRequest_SetLineQty', {
          line_id:        { type: sql.Int, value: line.line_id },
          approved_qty:   { type: sql.Int, value: line.approved_qty },
          dispatched_qty: { type: sql.Int, value: null },
          received_qty:   { type: sql.Int, value: null }
        });
      }

      await syncTransferRequestFromDocs(requestId);
      const refreshed = await executeStoredProcedure('sp_TransferRequest_GetById', {
        request_id: { type: sql.Int, value: requestId }
      });

      return res.json({
        success: true,
        data: {
          ...refreshed.recordsets?.[0]?.[0],
          lines: refreshed.recordsets?.[1] || []
        }
      });
    } catch (err) {
      return next(err);
    }
  }
);

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
      const fromStatus = String(rejectHeader.status || '');
      if (!['SUBMITTED', 'APPROVED'].includes(fromStatus)) {
        return res.status(422).json({
          success: false,
          message: `Cannot reject a transfer request while status is ${fromStatus}.`
        });
      }
      if (fromStatus === 'APPROVED' && !isSuperAdmin(req)) {
        return res.status(403).json({
          success: false,
          message: 'Only an admin can reject a request after HQ approval.'
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

    // RECEIVED: manual confirm removed — stocking under Incoming Goods syncs request status.
    if (storeAction) {
      return res.status(422).json({
        success: false,
        message: 'Stock receipt is recorded automatically when you stock goods under Incoming Goods. Manual confirm is not required.'
      });
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

      const dispatchNotes = value.notes || `Dispatched from transfer request #${requestId}`;
      const shipmentResult = await executeStoredProcedure('sp_TransferRequest_DispatchShipment', {
        request_id:    { type: sql.Int,               value: requestId },
        lines_json:    { type: sql.NVarChar(sql.MAX), value: JSON.stringify(allSkuLines) },
        to_store_id:   { type: sql.Int,               value: reqHeader.store_id },
        notes:         { type: sql.NVarChar(500),      value: dispatchNotes },
        dispatched_by: { type: sql.Int,               value: user.user_id }
      });

      const shipmentRow = shipmentResult.recordset?.[0];
      createdDocId = shipmentRow?.doc_id || null;
      computedHeaderStatus = shipmentRow?.status || computedHeaderStatus;
    }

    const statusToWrite = value.status === 'DISPATCHED' ? computedHeaderStatus : value.status;

    if (value.status !== 'DISPATCHED') {
      await executeStoredProcedure('sp_TransferRequest_UpdateStatus', {
        request_id: { type: sql.Int,           value: requestId },
        status:     { type: sql.VarChar(20),   value: statusToWrite },
        user_id:    { type: sql.Int,           value: user.user_id },
        notes:      { type: sql.NVarChar(500), value: value.notes || null }
      });
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
      if (value.status === 'APPROVED') {
        const approveDetail = await executeStoredProcedure('sp_TransferRequest_GetById', {
          request_id: { type: sql.Int, value: requestId }
        });
        const requestLines = approveDetail.recordsets?.[1] || [];
        const requestedByLine = new Map(
          requestLines.map((line) => [
            Number(line.line_id),
            Math.max(0, Number(line.requested_qty) || 0)
          ])
        );

        for (const line of value.lines) {
          if (line.approved_qty == null) continue;
          const requestedQty = requestedByLine.get(Number(line.line_id));
          if (requestedQty == null) {
            return res.status(422).json({
              success: false,
              message: `Transfer request line ${line.line_id} was not found on this request.`
            });
          }
          if (Number(line.approved_qty) > requestedQty) {
            return res.status(422).json({
              success: false,
              message: `Approved quantity cannot exceed requested quantity for line ${line.line_id} (requested ${requestedQty}, approved ${line.approved_qty}).`
            });
          }
        }
      }
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
module.exports.transferModAndView = transferModAndView;
module.exports.handleTransferRequestHistoryGet = handleTransferRequestHistoryGet;
