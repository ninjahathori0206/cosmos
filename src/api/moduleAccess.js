const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');
const { withCache, clearCacheByPrefix } = require('../cache/ttlCache');
const { requireModule, requirePermission } = require('../middleware/authorize');

const router = express.Router();

const modulesManage = [
  requireModule('command_unit'),
  requirePermission('command_unit.modules.edit')
];

router.get(
  '/:storeId',
  ...modulesManage,
  withCache((req) => `store-modules:${Number(req.params.storeId) || 0}`, 5 * 60 * 1000, async (req) => {
    const storeId = Number(req.params.storeId);
    const result = await executeStoredProcedure('sp_StoreModuleAccess_GetByStore', {
      store_id: { type: sql.Int, value: storeId }
    });
    return { success: true, data: result.recordset || [] };
  })
);

router.put('/:storeId', ...modulesManage, async (req, res, next) => {
  try {
    const storeId = Number(req.params.storeId);
    const { error, value } = Joi.object({
      module_key: Joi.string().max(50).required(),
      is_enabled: Joi.boolean().required()
    }).validate(req.body);

    if (error) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
    }

    const result = await executeStoredProcedure('sp_StoreModuleAccess_Toggle', {
      store_id:   { type: sql.Int,         value: storeId },
      module_key: { type: sql.VarChar(50), value: value.module_key },
      is_enabled: { type: sql.Bit,         value: value.is_enabled }
    });
    clearCacheByPrefix(`store-modules:${storeId}`);

    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
