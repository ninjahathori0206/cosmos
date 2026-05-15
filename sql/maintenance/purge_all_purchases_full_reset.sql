/*
 * DESTRUCTIVE — Remove ALL Foundry purchase pipeline rows + purchase-linked SKUs/stock.
 * Reseeds IDENTITY so the next purchase header is #1 (barcode/pid suffix becomes -P1).
 *
 * Does NOT delete: suppliers, product_master, home_brands, users, RBAC, stores.
 *
 * Backup first. Run: npm run maintenance:purge-all-purchases
 * Requires env: COSMOS_PURGE_CONFIRM=I_UNDERSTAND
 */
USE [CosmosERP];
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

DECLARE @skuIds TABLE (sku_id INT PRIMARY KEY);
INSERT INTO @skuIds (sku_id)
SELECT sk.sku_id
FROM dbo.skus sk
WHERE sk.header_id IS NOT NULL
   OR sk.item_colour_id IS NOT NULL
   OR sk.item_id IS NOT NULL;

UPDATE pic
SET pic.linked_sku_id = NULL
FROM dbo.purchase_item_colours pic
WHERE pic.linked_sku_id IS NOT NULL;

IF OBJECT_ID('dbo.purchase_restock_events', 'U') IS NOT NULL
  DELETE FROM dbo.purchase_restock_events;

IF OBJECT_ID('dbo.payment_allocations', 'U') IS NOT NULL
  DELETE FROM dbo.payment_allocations;

IF OBJECT_ID('dbo.sku_sale_price_history', 'U') IS NOT NULL
  DELETE sph
  FROM dbo.sku_sale_price_history sph
  INNER JOIN @skuIds s ON s.sku_id = sph.sku_id;

IF OBJECT_ID('dbo.sku_digitisation', 'U') IS NOT NULL
  DELETE sd
  FROM dbo.sku_digitisation sd
  INNER JOIN @skuIds s ON s.sku_id = sd.sku_id;

IF OBJECT_ID('dbo.sku_media', 'U') IS NOT NULL
  DELETE sm
  FROM dbo.sku_media sm
  INNER JOIN @skuIds s ON s.sku_id = sm.sku_id;

IF OBJECT_ID('dbo.stock_balances', 'U') IS NOT NULL
  DELETE sb
  FROM dbo.stock_balances sb
  INNER JOIN @skuIds s ON s.sku_id = sb.sku_id;

IF OBJECT_ID('dbo.stock_movements', 'U') IS NOT NULL
  DELETE smv
  FROM dbo.stock_movements smv
  INNER JOIN @skuIds s ON s.sku_id = smv.sku_id;

IF OBJECT_ID('dbo.stock_transfer_doc_lines', 'U') IS NOT NULL
  DELETE stdl
  FROM dbo.stock_transfer_doc_lines stdl
  INNER JOIN @skuIds s ON s.sku_id = stdl.sku_id;

IF OBJECT_ID('dbo.transfer_request_lines', 'U') IS NOT NULL
  DELETE trl
  FROM dbo.transfer_request_lines trl
  INNER JOIN @skuIds s ON s.sku_id = trl.sku_id;

IF EXISTS (SELECT 1 FROM @skuIds)
  DELETE sk
  FROM dbo.skus sk
  INNER JOIN @skuIds s ON s.sku_id = sk.sku_id;

DELETE FROM dbo.purchase_item_colours;
DELETE FROM dbo.purchase_items;
DELETE FROM dbo.purchase_headers;

IF OBJECT_ID('dbo.branding_job_colours', 'U') IS NOT NULL
  DELETE FROM dbo.branding_job_colours;
IF OBJECT_ID('dbo.branding_jobs', 'U') IS NOT NULL
  DELETE FROM dbo.branding_jobs;
IF OBJECT_ID('dbo.purchase_colours', 'U') IS NOT NULL
  DELETE FROM dbo.purchase_colours;
IF OBJECT_ID('dbo.purchases', 'U') IS NOT NULL
  DELETE FROM dbo.purchases;

DBCC CHECKIDENT ('dbo.purchase_headers', RESEED, 0);
DBCC CHECKIDENT ('dbo.purchase_items', RESEED, 0);
DBCC CHECKIDENT ('dbo.purchase_item_colours', RESEED, 0);

IF OBJECT_ID('dbo.purchase_restock_events', 'U') IS NOT NULL
  DBCC CHECKIDENT ('dbo.purchase_restock_events', RESEED, 0);

IF OBJECT_ID('dbo.skus', 'U') IS NOT NULL
  DBCC CHECKIDENT ('dbo.skus', RESEED, 0);

IF OBJECT_ID('dbo.purchases', 'U') IS NOT NULL
  DBCC CHECKIDENT ('dbo.purchases', RESEED, 0);
IF OBJECT_ID('dbo.purchase_colours', 'U') IS NOT NULL
  DBCC CHECKIDENT ('dbo.purchase_colours', RESEED, 0);
IF OBJECT_ID('dbo.branding_jobs', 'U') IS NOT NULL
  DBCC CHECKIDENT ('dbo.branding_jobs', RESEED, 0);
IF OBJECT_ID('dbo.branding_job_colours', 'U') IS NOT NULL
  DBCC CHECKIDENT ('dbo.branding_job_colours', RESEED, 0);

COMMIT TRANSACTION;

SELECT
  (SELECT COUNT(*) FROM dbo.purchase_headers) AS purchase_headers_remaining,
  (SELECT COUNT(*) FROM dbo.skus) AS skus_remaining,
  (SELECT IDENT_CURRENT('dbo.purchase_headers')) AS purchase_headers_identity_current;
GO
