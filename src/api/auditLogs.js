const express = require('express');
const sql = require('mssql');
const { executeStoredProcedure } = require('../config/db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const top = Number(req.query.top) || 50;
    const result = await executeStoredProcedure('sp_AuditLogs_GetRecent', {
      Top: { type: sql.Int, value: top }
    });
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

