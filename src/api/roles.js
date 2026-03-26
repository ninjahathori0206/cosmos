const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');

const router = express.Router();

const roleSchema = Joi.object({
  role_key:      Joi.string().max(50).required(),
  display_name:  Joi.string().max(200).required(),
  hierarchy_lvl: Joi.number().integer().min(1).max(99).required(),
  is_global:     Joi.boolean().optional()
});

const roleUpdateSchema = Joi.object({
  display_name:  Joi.string().max(200).required(),
  hierarchy_lvl: Joi.number().integer().min(1).max(99).required(),
  is_global:     Joi.boolean().optional()
});

router.get('/', async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_Role_GetAll', {});
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = roleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
    }

    const result = await executeStoredProcedure('sp_Role_Create', {
      role_key:      { type: sql.VarChar(50),  value: value.role_key },
      display_name:  { type: sql.VarChar(200), value: value.display_name },
      hierarchy_lvl: { type: sql.Int,          value: value.hierarchy_lvl },
      is_global:     { type: sql.Bit,          value: value.is_global ? 1 : 0 }
    });

    return res.status(201).json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    return next(err);
  }
});

router.put('/:key', async (req, res, next) => {
  try {
    const roleKey = req.params.key;
    const { error, value } = roleUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
    }

    const result = await executeStoredProcedure('sp_Role_Update', {
      role_key:      { type: sql.VarChar(50),  value: roleKey },
      display_name:  { type: sql.VarChar(200), value: value.display_name },
      hierarchy_lvl: { type: sql.Int,          value: value.hierarchy_lvl },
      is_global:     { type: sql.Bit,          value: value.is_global ? 1 : 0 }
    });

    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:key', async (req, res, next) => {
  try {
    const roleKey = req.params.key;
    const result = await executeStoredProcedure('sp_Role_Delete', {
      role_key: { type: sql.VarChar(50), value: roleKey }
    });

    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    return next(err);
  }
});

// ── Permissions ──────────────────────────────────────────────────

router.get('/:key/permissions', async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_Role_GetPermissions', {
      role_key: { type: sql.VarChar(50), value: req.params.key }
    });
    const perms = (result.recordset || []).map((r) => r.permission);
    return res.json({ success: true, data: perms });
  } catch (err) {
    return next(err);
  }
});

router.put('/:key/permissions', async (req, res, next) => {
  try {
    const roleKey = req.params.key;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ success: false, message: 'permissions must be an array of strings.' });
    }

    // Clear existing permissions then insert each new one
    await executeStoredProcedure('sp_Role_ClearPermissions', {
      role_key: { type: sql.VarChar(50), value: roleKey }
    });

    for (const perm of permissions) {
      if (typeof perm === 'string' && perm.trim()) {
        await executeStoredProcedure('sp_Role_AddPermission', {
          role_key:   { type: sql.VarChar(50),  value: roleKey },
          permission: { type: sql.VarChar(200), value: perm.trim() }
        });
      }
    }

    const result = await executeStoredProcedure('sp_Role_GetPermissions', {
      role_key: { type: sql.VarChar(50), value: roleKey }
    });
    const saved = (result.recordset || []).map((r) => r.permission);
    return res.json({ success: true, data: saved });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
