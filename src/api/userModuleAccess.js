const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');
const { requireModule, requirePermission } = require('../middleware/authorize');

const router = express.Router();

const modulesManage = [
  requireModule('command_unit'),
  requirePermission('command_unit.modules.edit')
];

router.get('/:userId', ...modulesManage, async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    const result = await executeStoredProcedure('sp_UserModuleAccess_GetByUser', {
      user_id: { type: sql.Int, value: userId }
    });
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

router.put('/:userId', ...modulesManage, async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    const { error, value } = Joi.object({
      module_key: Joi.string().max(50).required(),
      is_enabled: Joi.boolean().required()
    }).validate(req.body);

    if (error) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
    }

    const result = await executeStoredProcedure('sp_UserModuleAccess_Toggle', {
      user_id:    { type: sql.Int,         value: userId },
      module_key: { type: sql.VarChar(50), value: value.module_key },
      is_enabled: { type: sql.Bit,         value: value.is_enabled }
    });

    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
