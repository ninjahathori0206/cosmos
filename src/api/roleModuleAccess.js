const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');

const router = express.Router();

// GET /api/role-modules/:roleKey
router.get('/:roleKey', async (req, res, next) => {
  try {
    const roleKey = req.params.roleKey;
    const result = await executeStoredProcedure('sp_RoleModuleAccess_GetByRole', {
      role_key: { type: sql.VarChar(50), value: roleKey }
    });
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/role-modules/:roleKey  — body: { module_key, is_enabled }
router.put('/:roleKey', async (req, res, next) => {
  try {
    const roleKey = req.params.roleKey;
    const { error, value } = Joi.object({
      module_key: Joi.string().max(50).required(),
      is_enabled: Joi.boolean().required()
    }).validate(req.body);

    if (error) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
    }

    const result = await executeStoredProcedure('sp_RoleModuleAccess_Toggle', {
      role_key:   { type: sql.VarChar(50), value: roleKey },
      module_key: { type: sql.VarChar(50), value: value.module_key },
      is_enabled: { type: sql.Bit,         value: value.is_enabled }
    });

    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
