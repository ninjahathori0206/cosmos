'use strict';

const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure, getPool } = require('../config/db');
const { requireAnyModule, requirePermission } = require('../middleware/authorize');
const { isValidGatepassPurpose } = require('../config/gatepassPurposeCatalog');

const router = express.Router();

const gatepassView = [
  requireAnyModule(['pos', 'storepilot']),
  requirePermission('gatepass.view')
];
const gatepassCheckin = [
  requireAnyModule(['pos', 'storepilot']),
  requirePermission('gatepass.checkin')
];
const gatepassAction = [
  requireAnyModule(['pos', 'storepilot']),
  requirePermission('gatepass.action')
];

const VALID_CHANNELS = ['staff_desktop', 'staff_tablet', 'self_qr'];
const VALID_STATUSES = ['waiting', 'in_service', 'completed', 'no_show', 'expired'];

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim().slice(0, 45);
  return req.ip ? String(req.ip).slice(0, 45) : null;
}

function actorUserId(req) {
  if (req.user && req.user.user_id != null) return Number(req.user.user_id);
  return null;
}

function normalizeIndiaPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 10) return digits;
  return digits.slice(-10);
}

function validateIndiaMobile(phone) {
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return { ok: false, message: 'Enter a valid 10-digit Indian mobile number.' };
  }
  return { ok: true, phone };
}

function resolveStoreId(req, res, requestedStoreId) {
  const jwtStoreId = req.user && req.user.store_id != null ? Number(req.user.store_id) : null;
  const sid = requestedStoreId != null ? Number(requestedStoreId) : jwtStoreId;
  if (!sid || Number.isNaN(sid)) {
    res.status(400).json({ success: false, message: 'store_id is required.' });
    return null;
  }
  if (jwtStoreId && sid !== jwtStoreId) {
    res.status(403).json({ success: false, message: 'Cross-store access denied.' });
    return null;
  }
  return sid;
}

async function lookupCentralCustomerIdByPhone(pool, phone) {
  const normalized = normalizeIndiaPhone(phone);
  if (!normalized || normalized.length !== 10) return null;
  const r = await pool.request()
    .input('phone', sql.VarChar(15), normalized)
    .query(`
      SELECT TOP 1 customer_id
      FROM dbo.pos_customers
      WHERE phone = @phone AND is_active = 1
      ORDER BY customer_id
    `);
  const row = (r.recordset || [])[0];
  return row && row.customer_id != null ? Number(row.customer_id) : null;
}

async function enrichVisitorWithCentralCx(pool, visitor) {
  if (!visitor) return visitor;
  if (visitor.customer_id) {
    return { ...visitor, has_customer: true };
  }
  const cid = await lookupCentralCustomerIdByPhone(pool, visitor.phone);
  if (!cid) return visitor;
  return { ...visitor, customer_id: cid, has_customer: true };
}

async function enrichVisitorList(pool, list) {
  return Promise.all((list || []).map((v) => enrichVisitorWithCentralCx(pool, v)));
}

async function lookupCxProfilesByPhone(pool, phone) {
  const normalized = normalizeIndiaPhone(phone);
  if (!normalized || normalized.length !== 10) return [];
  const result = await executeStoredProcedure('sp_POS_CustomerSearch', {
    q: { type: sql.NVarChar(200), value: normalized }
  });
  const rows = result.recordset || [];
  return rows
    .filter((row) => normalizeIndiaPhone(row.phone) === normalized)
    .map((row) => ({
      customer_id: row.customer_id != null ? Number(row.customer_id) : null,
      full_name: row.full_name,
      phone: row.phone,
      email: row.email || null,
      display_name: row.display_name || row.full_name,
      home_store_id: row.home_store_id != null ? Number(row.home_store_id) : null
    }));
}

function mapVisitorRow(row) {
  if (!row) return null;
  return {
    visitor_id: row.visitor_id,
    name: row.name,
    phone: row.phone,
    customer_id: row.customer_id != null ? Number(row.customer_id) : null,
    has_customer: !!(row.has_customer === true || row.has_customer === 1),
    store_id: row.store_id,
    purpose: row.purpose || null,
    status: row.status,
    checkin_at: row.checkin_at,
    checkout_at: row.checkout_at || null,
    expiry_at: row.expiry_at || null,
    notes: row.notes || null,
    assigned_staff_name: row.assigned_staff_name || null,
    wait_minutes: row.wait_minutes != null ? Number(row.wait_minutes) : null,
    already_checked_in: !!(row.already_checked_in === true || row.already_checked_in === 1)
  };
}

const checkinSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  phone: Joi.string().trim().min(10).max(15).required(),
  store_id: Joi.number().integer().positive().optional(),
  channel: Joi.string().valid(...VALID_CHANNELS).default('staff_tablet'),
  purpose: Joi.string().max(50).allow('', null).custom((val, helpers) => {
    if (!isValidGatepassPurpose(val)) {
      return helpers.error('any.invalid');
    }
    return val === '' ? null : val;
  }),
  notes: Joi.string().max(500).allow('', null)
});

const statusSchema = Joi.object({
  status: Joi.string().valid('in_service', 'completed', 'no_show').required()
});

router.post('/checkin', ...gatepassCheckin, async (req, res, next) => {
  try {
    const { error, value } = checkinSchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details.map((d) => d.message).join('; ')
      });
    }
    const phoneParsed = validateIndiaMobile(normalizeIndiaPhone(value.phone));
    if (!phoneParsed.ok) {
      return res.status(400).json({ success: false, message: phoneParsed.message });
    }
    const storeId = resolveStoreId(req, res, value.store_id);
    if (storeId == null) return;

    const result = await executeStoredProcedure('sp_gatepass_checkin', {
      name: { type: sql.NVarChar(100), value: value.name.trim() },
      phone: { type: sql.VarChar(15), value: phoneParsed.phone },
      store_id: { type: sql.Int, value: storeId },
      channel: { type: sql.VarChar(20), value: value.channel },
      checkin_by_user_id: { type: sql.Int, value: actorUserId(req) },
      purpose: { type: sql.VarChar(50), value: value.purpose || null },
      notes: { type: sql.NVarChar(500), value: value.notes || null },
      ip_address: { type: sql.VarChar(45), value: clientIp(req) }
    });

    let visitor = mapVisitorRow((result.recordset || [])[0]);
    if (!visitor) {
      return res.status(500).json({ success: false, message: 'Check-in failed.' });
    }
    const pool = await getPool();
    visitor = await enrichVisitorWithCentralCx(pool, visitor);
    return res.json({
      success: true,
      data: {
        visitor,
        already_checked_in: visitor.already_checked_in
      }
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/search', ...gatepassView, async (req, res, next) => {
  try {
    const storeId = resolveStoreId(req, res, req.query.storeId || req.query.store_id);
    if (storeId == null) return;

    const fragment = normalizeIndiaPhone(req.query.phone || '');
    const result = await executeStoredProcedure('sp_gatepass_search', {
      phone_fragment: { type: sql.VarChar(15), value: fragment },
      store_id: { type: sql.Int, value: storeId }
    });

    const sets = result.recordsets || [];
    const pool = await getPool();
    const inStore = await enrichVisitorList(pool, (sets[0] || []).map(mapVisitorRow).filter(Boolean));
    const exited = await enrichVisitorList(pool, (sets[1] || []).map(mapVisitorRow).filter(Boolean));
    let cxProfiles = [];
    /* gatepass.view already required for this route — include central Cx at full mobile without pos.customers.view in JWT (staff PIN sessions refresh permissions separately). */
    if (fragment.length === 10) {
      cxProfiles = await lookupCxProfilesByPhone(pool, fragment);
    }
    return res.json({
      success: true,
      data: {
        inStore,
        exited,
        cxProfiles
      }
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/queue/:storeId', ...gatepassView, async (req, res, next) => {
  try {
    const storeId = resolveStoreId(req, res, parseInt(req.params.storeId, 10));
    if (storeId == null) return;

    const statusFilter = String(req.query.status || '').trim() || null;
    const result = await executeStoredProcedure('sp_gatepass_queue', {
      store_id: { type: sql.Int, value: storeId },
      status_filter: { type: sql.VarChar(50), value: statusFilter }
    });

    const pool = await getPool();
    const queue = await enrichVisitorList(
      pool,
      (result.recordset || []).map(mapVisitorRow).filter(Boolean)
    );
    return res.json({
      success: true,
      data: queue
    });
  } catch (err) {
    return next(err);
  }
});

router.patch('/visitor/:id/status', ...gatepassAction, async (req, res, next) => {
  try {
    const visitorId = parseInt(req.params.id, 10);
    if (!visitorId) {
      return res.status(400).json({ success: false, message: 'Invalid visitor id.' });
    }
    const { error, value } = statusSchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details.map((d) => d.message).join('; ')
      });
    }

    const jwtStoreId = req.user && req.user.store_id != null ? Number(req.user.store_id) : null;

    const result = await executeStoredProcedure('sp_gatepass_update_status', {
      visitor_id: { type: sql.Int, value: visitorId },
      new_status: { type: sql.VarChar(20), value: value.status },
      store_id: { type: sql.Int, value: jwtStoreId },
      performed_by: { type: sql.Int, value: actorUserId(req) },
      ip_address: { type: sql.VarChar(45), value: clientIp(req) },
      allow_system: { type: sql.Bit, value: 0 }
    });

    const visitor = mapVisitorRow((result.recordset || [])[0]);
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found.' });
    }
    return res.json({ success: true, data: visitor });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
module.exports.VALID_CHANNELS = VALID_CHANNELS;
module.exports.VALID_STATUSES = VALID_STATUSES;
