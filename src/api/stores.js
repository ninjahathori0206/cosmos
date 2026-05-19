const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');
const { requireModule, requirePermission } = require('../middleware/authorize');
const {
  getStoreTypeMetaForApi,
  isKnownStoreTypeRole,
  filterStoresByStoreTypeRole,
  isAllowedStoreTypeAsync
} = require('../config/storeTypesCatalog');

const router = express.Router();

router.get(
  '/store-types',
  requireModule('command_unit'),
  requirePermission('command_unit.stores.view'),
  async (req, res, next) => {
    try {
      return res.json({
        success: true,
        data: await getStoreTypeMetaForApi()
      });
    } catch (err) {
      return next(err);
    }
  }
);

const storeBodySchema = Joi.object({
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

async function validateStoreBody(body) {
  const { error, value } = storeBodySchema.validate(body);
  if (error) {
    return {
      error: {
        status: 400,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      }
    };
  }
  if (!(await isAllowedStoreTypeAsync(value.store_type))) {
    return {
      error: {
        status: 400,
        message: 'Validation error',
        errors: ['store_type must be an active format from Command Unit → Store Types.']
      }
    };
  }
  return { value };
}

router.get(
  '/',
  requireModule('command_unit'),
  requirePermission('command_unit.stores.view'),
  async (req, res, next) => {
    try {
      const result = await executeStoredProcedure('sp_Store_GetAll', {});
      let rows = result.recordset || [];
      const roleKey = req.query.role != null ? String(req.query.role).trim() : '';
      if (roleKey) {
        if (!isKnownStoreTypeRole(roleKey)) {
          return res.status(400).json({
            success: false,
            message: 'Unknown store type role. Use keys from GET /api/meta/store-types (store_type_role_defs).'
          });
        }
        rows = await filterStoresByStoreTypeRole(rows, roleKey);
      }
      return res.json({
        success: true,
        data: rows
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
      const validated = await validateStoreBody(req.body);
      if (validated.error) {
        return res.status(validated.error.status).json({
          success: false,
          message: validated.error.message,
          errors: validated.error.errors
        });
      }
      const value = validated.value;
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

      const validated = await validateStoreBody(req.body);
      if (validated.error) {
        return res.status(validated.error.status).json({
          success: false,
          message: validated.error.message,
          errors: validated.error.errors
        });
      }
      const value = validated.value;
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
