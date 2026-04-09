const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');
const { requireModule, requirePermission } = require('../middleware/authorize');

const router = express.Router();

const storeSchema = Joi.object({
  store_name: Joi.string().max(200).required(),
  store_code: Joi.string().max(20).required(),
  store_type: Joi.string().max(50).required(),
  gstin: Joi.string().max(20).allow(null, ''),
  address: Joi.string().max(500).allow(null, ''),
  city: Joi.string().max(100).allow(null, ''),
  state: Joi.string().max(100).allow(null, ''),
  phone: Joi.string().max(20).allow(null, ''),
  status: Joi.string().valid('ACTIVE', 'COMING_SOON', 'INACTIVE').optional()
});

router.get(
  '/',
  requireModule('command_unit'),
  requirePermission('command_unit.stores.view'),
  async (req, res, next) => {
    try {
      const result = await executeStoredProcedure('sp_Store_GetAll', {});
      return res.json({
        success: true,
        data: result.recordset || []
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/',
  requireModule('command_unit'),
  requirePermission('command_unit.stores.create'),
  async (req, res, next) => {
    try {
      const { error, value } = storeSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map((d) => d.message)
        });
      }

      const status = value.status || 'ACTIVE';

      const result = await executeStoredProcedure('sp_Store_Create', {
        store_name: { type: sql.VarChar(200), value: value.store_name },
        store_code: { type: sql.VarChar(20), value: value.store_code },
        store_type: { type: sql.VarChar(50), value: value.store_type },
        gstin: { type: sql.VarChar(20), value: value.gstin || null },
        address: { type: sql.VarChar(500), value: value.address || null },
        city: { type: sql.VarChar(100), value: value.city || null },
        state: { type: sql.VarChar(100), value: value.state || null },
        phone: { type: sql.VarChar(20), value: value.phone || null },
        status: { type: sql.VarChar(20), value: status }
      });

      return res.status(201).json({
        success: true,
        data: result.recordset && result.recordset[0]
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.put(
  '/:id',
  requireModule('command_unit'),
  requirePermission('command_unit.stores.edit'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, message: 'Invalid store id' });
      }

      const { error, value } = storeSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map((d) => d.message)
        });
      }

      const status = value.status || 'ACTIVE';

      const result = await executeStoredProcedure('sp_Store_Update', {
        store_id: { type: sql.Int, value: id },
        store_name: { type: sql.VarChar(200), value: value.store_name },
        store_code: { type: sql.VarChar(20), value: value.store_code },
        store_type: { type: sql.VarChar(50), value: value.store_type },
        gstin: { type: sql.VarChar(20), value: value.gstin || null },
        address: { type: sql.VarChar(500), value: value.address || null },
        city: { type: sql.VarChar(100), value: value.city || null },
        state: { type: sql.VarChar(100), value: value.state || null },
        phone: { type: sql.VarChar(20), value: value.phone || null },
        status: { type: sql.VarChar(20), value: status }
      });

      return res.json({
        success: true,
        data: result.recordset && result.recordset[0]
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.delete(
  '/:id',
  requireModule('command_unit'),
  requirePermission('command_unit.stores.edit'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, message: 'Invalid store id' });
      }

      const result = await executeStoredProcedure('sp_Store_Delete', {
        store_id: { type: sql.Int, value: id }
      });

      return res.json({
        success: true,
        data: result.recordset && result.recordset[0]
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;


