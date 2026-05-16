'use strict';

const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const { executeStoredProcedure } = require('../config/db');
const { requireModule, requirePermission } = require('../middleware/authorize');
const { writeAuditLog } = require('../services/auditService');

const router = express.Router();

function clientIp(req) {
  const x = req.headers['x-forwarded-for'];
  if (x) return String(x).split(',')[0].trim().slice(0, 50);
  if (req.socket && req.socket.remoteAddress) return String(req.socket.remoteAddress).slice(0, 50);
  return null;
}

const createTabletSchema = Joi.object({
  store_id: Joi.number().integer().positive().required(),
  device_name: Joi.string().min(1).max(100).required(),
  pin: Joi.string().length(4).pattern(/^\d{4}$/).required()
});

const resetPinSchema = Joi.object({
  pin: Joi.string().length(4).pattern(/^\d{4}$/).required()
});

const updateTabletDetailsSchema = Joi.object({
  store_id: Joi.number().integer().positive().required(),
  device_name: Joi.string().min(1).max(100).required()
});

router.get(
  '/:store_id',
  requireModule('command_unit'),
  requirePermission('command_unit.tablets.view'),
  async (req, res, next) => {
    try {
      const storeId = Number(req.params.store_id);
      if (!Number.isFinite(storeId) || storeId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid store id.' });
      }
      const result = await executeStoredProcedure('sp_POS_GetTabletsByStore', {
        store_id: { type: sql.Int, value: storeId }
      });
      return res.json({ success: true, data: result.recordset || [] });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/',
  requireModule('command_unit'),
  requirePermission('command_unit.tablets.create'),
  async (req, res, next) => {
    try {
      const { error, value } = createTabletSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
      }
      const pinHash = await bcrypt.hash(value.pin, 12);
      const result = await executeStoredProcedure('sp_POS_CreateTablet', {
        store_id: { type: sql.Int, value: value.store_id },
        device_name: { type: sql.VarChar(100), value: value.device_name },
        pin_hash: { type: sql.VarChar(200), value: pinHash }
      });
      const row = (result.recordset || [])[0];
      if (row && row.tablet_id) {
        try {
          await writeAuditLog({
            userId: req.user && req.user.user_id != null ? Number(req.user.user_id) : null,
            action: 'TABLET_CREATED',
            module: 'command_unit',
            entityType: 'tablet',
            entityId: Number(row.tablet_id),
            newValue: JSON.stringify({ store_id: value.store_id, device_name: value.device_name }),
            ipAddress: clientIp(req)
          });
        } catch (_a) {
          /* non-fatal */
        }
      }
      return res.status(201).json({ success: true, data: row || null });
    } catch (err) {
      return next(err);
    }
  }
);

router.put(
  '/:tablet_id/details',
  requireModule('command_unit'),
  requirePermission('command_unit.tablets.edit'),
  async (req, res, next) => {
    try {
      const tabletId = Number(req.params.tablet_id);
      if (!Number.isFinite(tabletId) || tabletId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid tablet id.' });
      }
      const { error, value } = updateTabletDetailsSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
      }
      const result = await executeStoredProcedure('sp_POS_UpdateTabletDeviceForStore', {
        tablet_id: { type: sql.Int, value: tabletId },
        store_id: { type: sql.Int, value: value.store_id },
        device_name: { type: sql.VarChar(100), value: value.device_name }
      });
      const rows = Number((result.recordset && result.recordset[0] && result.recordset[0].rows_updated) || 0);
      if (!rows) {
        return res.status(404).json({ success: false, message: 'Tablet not found for this store or inactive.' });
      }
      try {
        await writeAuditLog({
          userId: req.user && req.user.user_id != null ? Number(req.user.user_id) : null,
          action: 'TABLET_UPDATED',
          module: 'command_unit',
          entityType: 'tablet',
          entityId: tabletId,
          newValue: JSON.stringify({ store_id: value.store_id, device_name: value.device_name }),
          ipAddress: clientIp(req)
        });
      } catch (_a) {
        /* non-fatal */
      }
      return res.json({ success: true, message: 'Tablet updated.' });
    } catch (err) {
      return next(err);
    }
  }
);

router.put(
  '/:tablet_id/reset-pin',
  requireModule('command_unit'),
  requirePermission('command_unit.tablets.edit'),
  async (req, res, next) => {
    try {
      const tabletId = Number(req.params.tablet_id);
      if (!Number.isFinite(tabletId) || tabletId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid tablet id.' });
      }
      const { error, value } = resetPinSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
      }
      const pinHash = await bcrypt.hash(value.pin, 12);
      const result = await executeStoredProcedure('sp_POS_ResetTabletPin', {
        tablet_id: { type: sql.Int, value: tabletId },
        pin_hash: { type: sql.VarChar(200), value: pinHash }
      });
      const rows = Number((result.recordset && result.recordset[0] && result.recordset[0].rows_updated) || 0);
      if (!rows) {
        return res.status(404).json({ success: false, message: 'Tablet not found or inactive.' });
      }
      try {
        await writeAuditLog({
          userId: req.user && req.user.user_id != null ? Number(req.user.user_id) : null,
          action: 'TABLET_PIN_RESET',
          module: 'command_unit',
          entityType: 'tablet',
          entityId: tabletId,
          ipAddress: clientIp(req)
        });
      } catch (_a) {
        /* non-fatal */
      }
      return res.json({ success: true, message: 'Tablet PIN reset.' });
    } catch (err) {
      return next(err);
    }
  }
);

/** End Store OS device session (invalidate X-Tablet-Token on browsers). Tablet and PIN stay as-is. */
router.post(
  '/:tablet_id/invalidate-session',
  requireModule('command_unit'),
  requirePermission('command_unit.tablets.edit'),
  async (req, res, next) => {
    try {
      const tabletId = Number(req.params.tablet_id);
      if (!Number.isFinite(tabletId) || tabletId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid tablet id.' });
      }
      const result = await executeStoredProcedure('sp_POS_InvalidateTabletDeviceSessions', {
        tablet_id: { type: sql.Int, value: tabletId }
      });
      const rows = Number((result.recordset && result.recordset[0] && result.recordset[0].rows_updated) || 0);
      if (!rows) {
        return res.status(404).json({ success: false, message: 'Tablet not found or inactive.' });
      }
      try {
        await writeAuditLog({
          userId: req.user && req.user.user_id != null ? Number(req.user.user_id) : null,
          action: 'TABLET_DEVICE_SESSION_ENDED',
          module: 'command_unit',
          entityType: 'tablet',
          entityId: tabletId,
          ipAddress: clientIp(req)
        });
      } catch (_a) {
        /* non-fatal */
      }
      return res.json({
        success: true,
        message: 'Tablet device sessions ended. Unlock Store OS again on each device with Tablet ID and PIN.'
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.delete(
  '/:tablet_id',
  requireModule('command_unit'),
  requirePermission('command_unit.tablets.edit'),
  async (req, res, next) => {
    try {
      const tabletId = Number(req.params.tablet_id);
      if (!Number.isFinite(tabletId) || tabletId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid tablet id.' });
      }
      const result = await executeStoredProcedure('sp_POS_DeactivateTablet', {
        tablet_id: { type: sql.Int, value: tabletId }
      });
      const rows = Number((result.recordset && result.recordset[0] && result.recordset[0].rows_updated) || 0);
      if (!rows) {
        return res.status(404).json({ success: false, message: 'Tablet not found.' });
      }
      try {
        await writeAuditLog({
          userId: req.user && req.user.user_id != null ? Number(req.user.user_id) : null,
          action: 'TABLET_DEACTIVATED',
          module: 'command_unit',
          entityType: 'tablet',
          entityId: tabletId,
          ipAddress: clientIp(req)
        });
      } catch (_a) {
        /* non-fatal */
      }
      return res.json({ success: true, message: 'Tablet deactivated.' });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
