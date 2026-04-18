const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');
const { requireModule, requirePermission } = require('../middleware/authorize');

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
        password:  { type: sql.VarChar(200), value: value.password },
        full_name: { type: sql.VarChar(200), value: value.full_name },
        email:     { type: sql.VarChar(200), value: value.email || null },
        phone:     { type: sql.VarChar(20),  value: value.phone || null },
        role_key:  { type: sql.VarChar(50),  value: value.role_key },
        store_id:  { type: sql.Int,          value: value.store_id || null },
        is_active: { type: sql.Bit,          value: value.is_active !== false }
      });

      return res.status(201).json({ success: true, data: result.recordset && result.recordset[0] });
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

      const nextPassword = value.password && String(value.password).length > 0 ? value.password : null;
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
