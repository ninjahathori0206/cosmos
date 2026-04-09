const express = require('express');
const sql = require('mssql');
const { executeStoredProcedure, getPool } = require('../config/db');
const { requireModule, requirePermission } = require('../middleware/authorize');

const router = express.Router();

// GET /api/skus — SKU catalogue with optional filters
router.get(
  '/',
  requireModule('foundry'),
  requirePermission('foundry.catalogue.view'),
  async (req, res, next) => {
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
  }
);

// GET /api/skus/lookup/:pid — resolve a scanned PID → full product + purchase details
// Called when a QR code is scanned at sale or stock transfer
router.get(
  '/lookup/:pid',
  requireModule('foundry'),
  async (req, res, next) => {
    try {
      const pool = await getPool();
      const result = await pool.request()
        .input('pid', sql.VarChar(80), req.params.pid)
        .query(`
          SELECT s.sku_id, s.sku_code, s.pid, s.quantity, s.cost_price, s.sale_price, s.status,
                 DATEDIFF(DAY, s.created_at, GETDATE()) AS product_age_days,
                 pm.product_name, pm.product_type, pm.ew_collection, pm.style_model,
                 hb.brand_name,
                 pc.colour_name, pc.colour_code,
                 ph.header_id, ph.created_at AS purchase_date,
                 sup.vendor_name AS supplier_name
          FROM   dbo.skus s
          JOIN   dbo.product_master pm          ON s.product_master_id = pm.product_id
          LEFT JOIN dbo.home_brands hb          ON pm.home_brand_id    = hb.brand_id
          LEFT JOIN dbo.purchase_item_colours pc ON s.item_colour_id   = pc.colour_id
          LEFT JOIN dbo.purchase_headers ph      ON s.header_id        = ph.header_id
          LEFT JOIN dbo.suppliers sup            ON ph.supplier_id      = sup.supplier_id
          WHERE  s.pid = @pid
        `);

      if (!result.recordset.length) {
        return res.status(404).json({ success: false, message: `No product found for PID: ${req.params.pid}` });
      }
      res.json({ success: true, data: result.recordset[0] });
    } catch (err) { next(err); }
  }
);

module.exports = router;
