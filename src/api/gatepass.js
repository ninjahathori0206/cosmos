'use strict';

const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure, getPool } = require('../config/db');
const { requireAnyModule, requireModule, requirePermission } = require('../middleware/authorize');
const { isValidGatepassPurposeAsync } = require('../config/gatepassPurposeCatalog');
const {
  getGatepassVmsCatalog,
  isGatepassVmsKey,
  GATEPASS_VMS_SETTINGS
} = require('../config/gatepassVmsCatalog');
const { wallClockIso } = require('../lib/cosmosIst');
const cxService = require('../services/cxService');

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
const gatepassSettingsRead = [
  requireAnyModule(['pos', 'storepilot', 'command_unit']),
  requirePermission('gatepass.view', 'command_unit.stores.view')
];
const gatepassSettingsWrite = [
  requireModule('command_unit'),
  requirePermission('command_unit.stores.edit')
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
    assigned_user_id: row.assigned_user_id != null ? Number(row.assigned_user_id) : null,
    assigned_staff_name: row.assigned_staff_name || null,
    wait_minutes: row.wait_minutes != null ? Number(row.wait_minutes) : null,
    already_checked_in: !!(row.already_checked_in === true || row.already_checked_in === 1)
  };
}

async function readGatepassSettingRaw(pool, storeId, settingKey) {
  const r = await pool.request()
    .input('store_id', sql.Int, storeId)
    .input('setting_key', sql.VarChar(100), settingKey)
    .query(`
      SELECT sas.setting_value AS store_value, a.setting_value AS global_value
      FROM (SELECT 1 AS x) d
      LEFT JOIN dbo.store_app_settings sas
        ON sas.store_id = @store_id AND sas.setting_key = @setting_key
      LEFT JOIN dbo.app_settings a ON a.setting_key = @setting_key
    `);
  const row = (r.recordset || [])[0] || {};
  return {
    store_value: row.store_value != null ? String(row.store_value) : null,
    global_value: row.global_value != null ? String(row.global_value) : null
  };
}

async function buildGatepassSettingsPayload(pool, storeId) {
  const catalog = getGatepassVmsCatalog();
  const items = [];
  for (const def of catalog) {
    const raw = await readGatepassSettingRaw(pool, storeId, def.key);
    const effectiveRaw = raw.store_value != null && String(raw.store_value).trim() !== ''
      ? raw.store_value
      : raw.global_value;
    let effective = effectiveRaw;
    if (def.type === 'int') {
      const n = parseInt(String(effectiveRaw || def.defaultValue), 10);
      effective = Number.isFinite(n) ? n : def.defaultValue;
    } else if (def.type === 'bool') {
      const s = String(effectiveRaw ?? def.defaultValue).toLowerCase();
      effective = s === '1' || s === 'true' || s === 'yes';
    }
    items.push({
      key: def.key,
      label: def.label,
      description: def.description,
      type: def.type,
      store_value: raw.store_value,
      global_value: raw.global_value,
      effective,
      has_store_override: raw.store_value != null && String(raw.store_value).trim() !== ''
    });
  }
  return { store_id: storeId, settings: items, catalog_revision: 'gatepass-vms-v1' };
}

const checkinSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  phone: Joi.string().trim().min(10).max(15).required(),
  store_id: Joi.number().integer().positive().optional(),
  channel: Joi.string().valid(...VALID_CHANNELS).default('staff_tablet'),
  purpose: Joi.string().max(50).allow('', null),
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

    if (value.purpose && !(await isValidGatepassPurposeAsync(value.purpose))) {
      return res.status(400).json({ success: false, message: 'Invalid visit purpose.' });
    }

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
    if (visitor.already_checked_in) {
      return res.status(409).json({
        success: false,
        message: 'This mobile number is already in the visitor queue.',
        data: { visitor, already_checked_in: true }
      });
    }
    return res.json({
      success: true,
      data: {
        visitor,
        already_checked_in: false
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

router.get('/settings', ...gatepassSettingsRead, async (req, res, next) => {
  try {
    const storeId = resolveStoreId(req, res, req.query.storeId || req.query.store_id);
    if (storeId == null) return;
    const pool = await getPool();
    const payload = await buildGatepassSettingsPayload(pool, storeId);
    return res.json({ success: true, data: payload });
  } catch (err) {
    return next(err);
  }
});

const settingsPutSchema = Joi.object({
  store_id: Joi.number().integer().positive().required(),
  settings: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives().try(Joi.number(), Joi.boolean(), Joi.string())
  ).min(1)
});

router.put('/settings', ...gatepassSettingsWrite, async (req, res, next) => {
  try {
    const { error, value } = settingsPutSchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details.map((d) => d.message).join('; ')
      });
    }
    const storeId = Number(value.store_id);
    const pool = await getPool();
    const now = new Date();
    const entries = Object.entries(value.settings || {});
    for (const [key, val] of entries) {
      if (!isGatepassVmsKey(key)) {
        return res.status(400).json({ success: false, message: `Unknown setting: ${key}` });
      }
      const def = GATEPASS_VMS_SETTINGS.find((s) => s.key === key);
      let stored = '';
      if (def.type === 'bool') {
        stored = val === true || val === '1' || val === 'true' ? '1' : '0';
      } else {
        const n = parseInt(String(val), 10);
        if (!Number.isFinite(n)) {
          return res.status(400).json({ success: false, message: `Invalid value for ${key}` });
        }
        if (def.min != null && n < def.min) {
          return res.status(400).json({ success: false, message: `${key} must be at least ${def.min}` });
        }
        if (def.max != null && n > def.max) {
          return res.status(400).json({ success: false, message: `${key} must be at most ${def.max}` });
        }
        stored = String(n);
      }
      await pool.request()
        .input('store_id', sql.Int, storeId)
        .input('setting_key', sql.VarChar(100), key)
        .input('setting_value', sql.NVarChar(500), stored)
        .input('updated_at', sql.DateTime2, now)
        .query(`
          MERGE dbo.store_app_settings AS tgt
          USING (SELECT @store_id AS store_id, @setting_key AS setting_key) AS src
          ON tgt.store_id = src.store_id AND tgt.setting_key = src.setting_key
          WHEN MATCHED THEN
            UPDATE SET setting_value = @setting_value, updated_at = @updated_at
          WHEN NOT MATCHED THEN
            INSERT (store_id, setting_key, setting_value, updated_at)
            VALUES (@store_id, @setting_key, @setting_value, @updated_at);
        `);
    }
    const payload = await buildGatepassSettingsPayload(pool, storeId);
    return res.json({ success: true, data: payload });
  } catch (err) {
    return next(err);
  }
});

const assignSchema = Joi.object({
  assigned_user_id: Joi.number().integer().positive().allow(null)
});

router.patch('/visitor/:id/assign', ...gatepassAction, async (req, res, next) => {
  try {
    const visitorId = parseInt(req.params.id, 10);
    if (!visitorId) {
      return res.status(400).json({ success: false, message: 'Invalid visitor id.' });
    }
    const { error, value } = assignSchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details.map((d) => d.message).join('; ')
      });
    }
    const jwtStoreId = req.user && req.user.store_id != null ? Number(req.user.store_id) : null;
    const assignId = value.assigned_user_id != null ? Number(value.assigned_user_id) : null;
    if (assignId != null && assignId === actorUserId(req)) {
      /* allow self-assign */
    }
    const result = await executeStoredProcedure('sp_gatepass_assign_staff', {
      visitor_id: { type: sql.Int, value: visitorId },
      assigned_user_id: { type: sql.Int, value: assignId },
      store_id: { type: sql.Int, value: jwtStoreId },
      performed_by: { type: sql.Int, value: actorUserId(req) },
      ip_address: { type: sql.VarChar(45), value: clientIp(req) }
    });
    let visitor = mapVisitorRow((result.recordset || [])[0]);
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found.' });
    }
    const pool = await getPool();
    visitor = await enrichVisitorWithCentralCx(pool, visitor);
    return res.json({ success: true, data: visitor });
  } catch (err) {
    return next(err);
  }
});

const rxBodySchema = Joi.object({
  tested_at: Joi.string().optional(),
  store_id: Joi.number().integer().positive().optional(),
  family_name_id: Joi.number().integer().positive().optional().allow(null),
  patient_name: Joi.string().max(100).optional().allow('', null),
  patient_dob: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().allow('', null),
  re_sph: Joi.number().optional().allow(null),
  re_cyl: Joi.number().optional().allow(null),
  re_axis: Joi.number().integer().optional().allow(null),
  re_add: Joi.number().optional().allow(null),
  re_va: Joi.string().max(10).optional().allow('', null),
  le_sph: Joi.number().optional().allow(null),
  le_cyl: Joi.number().optional().allow(null),
  le_axis: Joi.number().integer().optional().allow(null),
  le_add: Joi.number().optional().allow(null),
  le_va: Joi.string().max(10).optional().allow('', null),
  pd: Joi.number().optional().allow(null),
  lens_type: Joi.string().max(50).optional().allow('', null),
  notes: Joi.string().max(500).optional().allow('', null),
  lifestyle: Joi.object({
    screen_hrs: Joi.string().max(50).optional().allow('', null),
    working_conditions: Joi.array().items(Joi.string().max(80)).optional(),
    diabetes: Joi.boolean().optional(),
    hypertension: Joi.boolean().optional(),
    eye_surgery: Joi.boolean().optional(),
    family_eye_history: Joi.string().max(200).optional().allow('', null),
    has_spectacles: Joi.boolean().optional()
  }).optional()
});

/** POST /api/gatepass/visitor/:id/rx — record Rx linked to visitor (optional CX + family name) */
router.post('/visitor/:id/rx', ...gatepassAction, async (req, res, next) => {
  try {
    const visitorId = parseInt(req.params.id, 10);
    if (!visitorId) {
      return res.status(400).json({ success: false, message: 'Invalid visitor id.' });
    }
    const { error, value } = rxBodySchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details.map((d) => d.message).join('; ')
      });
    }
    const pool = await getPool();
    let visitor = await cxService.getVisitorRowForRx(pool, visitorId);
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found.' });
    }
    let customerId =
      visitor.customer_id != null && Number(visitor.customer_id) > 0
        ? Number(visitor.customer_id)
        : null;
    if (!customerId && visitor.phone) {
      const cid = await lookupCentralCustomerIdByPhone(pool, visitor.phone);
      if (cid) customerId = cid;
    }
    const hasRx =
      value.re_sph != null ||
      value.le_sph != null ||
      value.re_cyl != null ||
      value.le_cyl != null;
    if (!hasRx) {
      return res.status(400).json({
        success: false,
        message: 'Enter at least one eye SPH value.'
      });
    }
    const jwtStoreId = req.user && req.user.store_id != null ? Number(req.user.store_id) : null;
    const row = await cxService.insertStaffEyeTest(pool, {
      customerId,
      visitorId,
      familyNameId: value.family_name_id,
      patientName: value.patient_name || visitor.name || null,
      patientDob: cxService.parsePatientDobYmd(value.patient_dob),
      testedAt: value.tested_at || wallClockIso(),
      storeId: value.store_id || visitor.store_id || jwtStoreId,
      actorUserId: actorUserId(req),
      reSph: value.re_sph,
      reCyl: value.re_cyl,
      reAxis: value.re_axis,
      reAdd: value.re_add,
      reVa: value.re_va || null,
      leSph: value.le_sph,
      leCyl: value.le_cyl,
      leAxis: value.le_axis,
      leAdd: value.le_add,
      leVa: value.le_va || null,
      pd: value.pd,
      lensType: value.lens_type || null,
      notes: value.notes || null
    });
    if (value.patient_dob) {
      try {
        await cxService.upsertRxModalPatientDob(pool, {
          customerId,
          patientDob: value.patient_dob,
          syncPrimaryProfile: !value.family_name_id,
          actorUserId: actorUserId(req)
        });
      } catch (_) {
        /* best-effort */
      }
    }
    if (customerId && value.lifestyle) {
      try {
        await cxService.upsertRxModalLifestyle(pool, customerId, value.lifestyle, actorUserId(req));
      } catch (lifErr) {
        /* Rx saved; lifestyle is best-effort */
      }
    }
    return res.status(201).json({ success: true, data: { test_id: row && row.test_id } });
  } catch (err) {
    const msg = String(err.message || '');
    if (msg.includes('required') || msg.includes('family_name')) {
      return res.status(400).json({ success: false, message: msg });
    }
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
