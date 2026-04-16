const express = require('express');
const sql = require('mssql');
const { executeStoredProcedure, getPool } = require('../config/db');
const {
  requireModule,
  requirePermission,
  requireAnyModule,
  hasPermission,
  isSuperAdmin
} = require('../middleware/authorize');

const router = express.Router();

const WAREHOUSE_STOCK_VISIBILITY_PERMISSIONS = [
  'foundry.stock.view',
  'foundry.transfers.create',
  'foundry.transfers.view'
];

const STOCK_QUANTITY_KEYS = ['quantity', 'stock_qty', 'warehouse_qty', 'total_qty'];

function canViewExactNetworkStock(req) {
  if (isSuperAdmin(req)) return true;
  return WAREHOUSE_STOCK_VISIBILITY_PERMISSIONS.some((key) => hasPermission(req, key));
}

function toAvailabilityLabel(qty) {
  return Number(qty) > 0 ? 'AVAILABLE' : 'NOT_AVAILABLE';
}

function maskSkuStockQuantities(row) {
  const availabilityQty = STOCK_QUANTITY_KEYS
    .map((key) => Number(row[key]) || 0)
    .find((value) => value > 0) || 0;
  const maskedRow = { ...row };
  STOCK_QUANTITY_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(maskedRow, key)) maskedRow[key] = null;
  });
  maskedRow.availability = toAvailabilityLabel(availabilityQty);
  maskedRow.is_available = availabilityQty > 0;
  return maskedRow;
}

// GET /api/skus — SKU catalogue with optional filters
router.get(
  '/',
  requireAnyModule(['foundry', 'storepilot']),
  requirePermission('storepilot.catalogue.view', 'foundry.catalogue.view'),
  async (req, res, next) => {
    try {
      const { q, brand_id, product_type, status } = req.query;
      const result = await executeStoredProcedure('sp_SKU_GetAll', {
        q:            { type: sql.VarChar(200), value: q || null },
        brand_id:     { type: sql.Int,          value: brand_id ? parseInt(brand_id, 10) : null },
        product_type: { type: sql.VarChar(50),  value: product_type || null },
        status:       { type: sql.VarChar(30),  value: status || 'LIVE' }
      });
      const rows = result.recordset || [];
      if (canViewExactNetworkStock(req)) {
        return res.json({ success: true, data: rows });
      }
      return res.json({ success: true, data: rows.map(maskSkuStockQuantities) });
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
