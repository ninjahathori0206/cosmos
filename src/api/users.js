const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const { executeStoredProcedure } = require('../config/db');
const { requireModule, requirePermission } = require('../middleware/authorize');
const { writeAuditLog } = require('../services/auditService');
const { generateAndAssignPosPin } = require('../services/posPinService');

const router = express.Router();

const createSchema = Joi.object({
  username: Joi.string().max(100).required(),
  password: Joi.string().max(200).required(),
  full_name: Joi.string().max(200).required(),
  email: Joi.string().email().max(200).allow(null, ''),
  phone: Joi.string().max(20).allow(null, ''),
  role_key: Joi.string().max(50).required(),
  store_id: Joi.number().integer().allow(null),
  is_active: Joi.boolean().optional()
});

const updateSchema = Joi.object({
  full_name: Joi.string().max(200).required(),
  email: Joi.string().email().max(200).allow(null, ''),
  phone: Joi.string().max(20).allow(null, ''),
  role_key: Joi.string().max(50).required(),
  store_id: Joi.number().integer().allow(null),
  is_active: Joi.boolean().optional(),
  password: Joi.string().max(200).allow(null, '')
});

router.get(
  '/',
  requireModule('command_unit'),
  requirePermission('command_unit.users.view'),
  async (req, res, next) => {
    try {
      const result = await executeStoredProcedure('sp_User_GetAll', {});
      return res.json({ success: true, data: result.recordset || [] });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/:id/regenerate-pos-pin',
  requireModule('command_unit'),
  requirePermission('command_unit.users.edit'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: 'Invalid user id' });

      const existing = await executeStoredProcedure('sp_User_GetById', {
        user_id: { type: sql.Int, value: id }
      });
      if (!existing.recordset || !existing.recordset[0]) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const posPin = await generateAndAssignPosPin(id);
      try {
        await writeAuditLog({
          userId: req.user && req.user.user_id != null ? Number(req.user.user_id) : null,
          action: 'USER_POS_PIN_REGENERATED',
          module: 'command_unit',
          entityType: 'user',
          entityId: id,
          ipAddress: req.ip || null
        });
      } catch (_a) {
        /* non-fatal */
      }

      return res.json({
        success: true,
        data: { user_id: id, pos_pin: posPin, has_pos_pin: true }
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.get(
  '/:id',
  requireModule('command_unit'),
  requirePermission('command_unit.users.view'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const result = await executeStoredProcedure('sp_User_GetById', {
        user_id: { type: sql.Int, value: id }
      });
      const row = result.recordset && result.recordset[0];
      if (!row) return res.status(404).json({ success: false, message: 'User not found' });
      return res.json({ success: true, data: row });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/',
  requireModule('command_unit'),
  requirePermission('command_unit.users.create'),
  async (req, res, next) => {
    try {
      const { error, value } = createSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map((d) => d.message)
        });
      }

      const result = await executeStoredProcedure('sp_User_Create', {
        username:  { type: sql.VarChar(100), value: value.username },
        password:  { type: sql.VarChar(200), value: await bcrypt.hash(value.password, 12) },
        full_name: { type: sql.VarChar(200), value: value.full_name },
        email:     { type: sql.VarChar(200), value: value.email || null },
        phone:     { type: sql.VarChar(20),  value: value.phone || null },
        role_key:  { type: sql.VarChar(50),  value: value.role_key },
        store_id:  { type: sql.Int,          value: value.store_id || null },
        is_active: { type: sql.Bit,          value: value.is_active !== false }
      });

      const row = result.recordset && result.recordset[0];
      let posPin = null;
      if (row && row.user_id != null) {
        try {
          posPin = await generateAndAssignPosPin(Number(row.user_id));
          try {
            await writeAuditLog({
              userId: req.user && req.user.user_id != null ? Number(req.user.user_id) : null,
              action: 'USER_POS_PIN_GENERATED',
              module: 'command_unit',
              entityType: 'user',
              entityId: Number(row.user_id),
              ipAddress: req.ip || null
            });
          } catch (_a) {
            /* non-fatal */
          }
        } catch (pinErr) {
          return res.status(500).json({
            success: false,
            message: `User created but POS PIN could not be assigned: ${pinErr.message}`
          });
        }
      }

      return res.status(201).json({
        success: true,
        data: row ? { ...row, pos_pin: posPin, has_pos_pin: posPin != null } : row
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.put(
  '/:id',
  requireModule('command_unit'),
  requirePermission('command_unit.users.edit'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: 'Invalid user id' });

      const { error, value } = updateSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map((d) => d.message)
        });
      }

      const nextPassword = value.password ? await bcrypt.hash(value.password, 12) : null;
      const result = await executeStoredProcedure('sp_User_Update', {
        user_id:   { type: sql.Int,          value: id },
        full_name: { type: sql.VarChar(200), value: value.full_name },
        email:     { type: sql.VarChar(200), value: value.email || null },
        phone:     { type: sql.VarChar(20),  value: value.phone || null },
        role_key:  { type: sql.VarChar(50),  value: value.role_key },
        store_id:  { type: sql.Int,          value: value.store_id || null },
        is_active: { type: sql.Bit,          value: value.is_active !== false },
        password:  { type: sql.VarChar(200), value: nextPassword }
      });

      return res.json({ success: true, data: result.recordset && result.recordset[0] });
    } catch (err) {
      return next(err);
    }
  }
);

router.delete(
  '/:id',
  requireModule('command_unit'),
  requirePermission('command_unit.users.edit'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: 'Invalid user id' });

      const result = await executeStoredProcedure('sp_User_Deactivate', {
        user_id: { type: sql.Int, value: id }
      });

      return res.json({ success: true, data: result.recordset && result.recordset[0] });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
