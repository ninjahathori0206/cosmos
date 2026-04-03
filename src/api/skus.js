const express = require('express');
const sql = require('mssql');
const { executeStoredProcedure } = require('../config/db');

const router = express.Router();

// GET /api/skus — SKU catalogue with optional filters
router.get('/', async (req, res, next) => {
  try {
    const { q, brand_id, product_type, status } = req.query;
    const result = await executeStoredProcedure('sp_SKU_GetAll', {
      q:            { type: sql.VarChar(200), value: q || null },
      brand_id:     { type: sql.Int,          value: brand_id ? parseInt(brand_id, 10) : null },
      product_type: { type: sql.VarChar(50),  value: product_type || null },
      status:       { type: sql.VarChar(30),  value: status || 'LIVE' }
    });
    res.json({ success: true, data: result.recordset });
  } catch (err) { next(err); }
});

module.exports = router;
