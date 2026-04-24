const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
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
const salePriceUpdateSchema = Joi.object({
  sale_price: Joi.number().precision(2).positive().required(),
  reason: Joi.string().max(500).allow('', null)
});
const mediaUpdateSchema = Joi.object({
  image_url: Joi.string().uri().max(500).allow('', null),
  video_url: Joi.string().uri().max(500).allow('', null)
}).or('image_url', 'video_url');

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

router.get(
  '/by-product/:productId',
  requireAnyModule(['foundry', 'storepilot']),
  requirePermission('storepilot.catalogue.view', 'foundry.catalogue.view'),
  async (req, res, next) => {
    try {
      const productId = Number(req.params.productId);
      if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid product id' });
      }
      const pool = await getPool();
      const result = await pool.request()
        .input('pid', sql.Int, productId)
        .query(`
          SELECT
            s.sku_id,
            s.sku_code,
            s.sale_price,
            s.status,
            s.created_at,
            pc.colour_name,
            pc.colour_code,
            pc.image_url,
            pc.video_url
          FROM dbo.skus s
          LEFT JOIN dbo.purchase_item_colours pc ON pc.colour_id = s.item_colour_id
          WHERE s.product_master_id = @pid
          ORDER BY s.created_at DESC, s.sku_id DESC
        `);
      return res.json({ success: true, data: result.recordset || [] });
    } catch (err) {
      return next(err);
    }
  }
);

router.put(
  '/:id/sale-price',
  requireModule('foundry'),
  requirePermission('foundry.catalogue.edit'),
  async (req, res, next) => {
    try {
      const { error, value } = salePriceUpdateSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map((d) => d.message)
        });
      }
      const skuId = Number(req.params.id);
      const userId = req.user && req.user.user_id ? Number(req.user.user_id) : null;
      const pool = await getPool();
      const current = await pool.request()
        .input('sid', sql.Int, skuId)
        .query('SELECT TOP 1 sku_id, sale_price FROM dbo.skus WHERE sku_id = @sid');
      const row = current.recordset && current.recordset[0];
      if (!row) return res.status(404).json({ success: false, message: 'SKU not found' });

      const oldPrice = Number(row.sale_price || 0);
      const newPrice = Number(value.sale_price);
      if (oldPrice === newPrice) {
        return res.json({ success: true, data: { sku_id: skuId, sale_price: oldPrice, unchanged: true } });
      }

      await pool.request()
        .input('sid', sql.Int, skuId)
        .input('np', sql.Decimal(10, 2), newPrice)
        .query(`
          UPDATE dbo.skus
          SET sale_price = @np,
              updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
          WHERE sku_id = @sid
        `);

      await pool.request()
        .input('sid', sql.Int, skuId)
        .input('op', sql.Decimal(10, 2), oldPrice)
        .input('np', sql.Decimal(10, 2), newPrice)
        .input('uid', sql.Int, userId)
        .input('src', sql.VarChar(50), 'SKU_CATALOGUE')
        .input('reason', sql.VarChar(500), value.reason || null)
        .query(`
          IF OBJECT_ID('dbo.sku_sale_price_history', 'U') IS NOT NULL
          BEGIN
            INSERT INTO dbo.sku_sale_price_history (
              sku_id, old_sale_price, new_sale_price, changed_by, change_source, change_reason
            )
            VALUES (@sid, @op, @np, @uid, @src, @reason)
          END
        `);

      return res.json({ success: true, data: { sku_id: skuId, old_sale_price: oldPrice, sale_price: newPrice } });
    } catch (err) { return next(err); }
  }
);

router.put(
  '/:id/media',
  requireModule('foundry'),
  requirePermission('foundry.catalogue.edit'),
  async (req, res, next) => {
    try {
      const skuId = Number(req.params.id);
      if (!Number.isFinite(skuId) || skuId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid SKU id' });
      }
      const { error, value } = mediaUpdateSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map((d) => d.message)
        });
      }
      const pool = await getPool();
      const existing = await pool.request()
        .input('sid', sql.Int, skuId)
        .query(`
          SELECT TOP 1
            s.sku_id,
            pc.image_url,
            pc.video_url
          FROM dbo.skus s
          LEFT JOIN dbo.purchase_item_colours pc ON pc.colour_id = s.item_colour_id
          WHERE s.sku_id = @sid
        `);
      const row = existing.recordset && existing.recordset[0];
      if (!row) return res.status(404).json({ success: false, message: 'SKU not found' });

      const imageUrl = Object.prototype.hasOwnProperty.call(value, 'image_url')
        ? (value.image_url || null)
        : row.image_url;
      const videoUrl = Object.prototype.hasOwnProperty.call(value, 'video_url')
        ? (value.video_url || null)
        : row.video_url;

      await pool.request()
        .input('sid', sql.Int, skuId)
        .input('iu', sql.VarChar(500), imageUrl)
        .input('vu', sql.VarChar(500), videoUrl)
        .query(`
          UPDATE pc
          SET
            pc.image_url = @iu,
            pc.video_url = @vu
          FROM dbo.purchase_item_colours pc
          INNER JOIN dbo.skus s ON s.item_colour_id = pc.colour_id
          WHERE s.sku_id = @sid
        `);

      return res.json({
        success: true,
        data: {
          sku_id: skuId,
          image_url: imageUrl,
          video_url: videoUrl
        }
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.get(
  '/:id/sale-price-history',
  requireModule('foundry'),
  requirePermission('foundry.catalogue.view'),
  async (req, res, next) => {
    try {
      const skuId = Number(req.params.id);
      const pool = await getPool();
      const result = await pool.request()
        .input('sid', sql.Int, skuId)
        .query(`
          IF OBJECT_ID('dbo.sku_sale_price_history', 'U') IS NULL
          BEGIN
            SELECT TOP 0
              CAST(NULL AS INT) AS history_id,
              CAST(NULL AS DECIMAL(10,2)) AS old_sale_price,
              CAST(NULL AS DECIMAL(10,2)) AS new_sale_price,
              CAST(NULL AS DATETIME) AS changed_at,
              CAST(NULL AS VARCHAR(200)) AS changed_by_name,
              CAST(NULL AS VARCHAR(500)) AS change_reason
          END
          ELSE
          BEGIN
            SELECT TOP 20
              h.history_id,
              h.old_sale_price,
              h.new_sale_price,
              h.changed_at,
              u.full_name AS changed_by_name,
              h.change_reason
            FROM dbo.sku_sale_price_history h
            LEFT JOIN dbo.users u ON u.user_id = h.changed_by
            WHERE h.sku_id = @sid
            ORDER BY h.changed_at DESC, h.history_id DESC
          END
        `);
      return res.json({ success: true, data: result.recordset || [] });
    } catch (err) { return next(err); }
  }
);

module.exports = router;
