/*
 * DESTRUCTIVE — Operational reset: clear sales, orders, stock, transfers, customers,
 * sessions/audit, and Foundry purchases/SKUs. Keeps users, stores, tablets, RBAC,
 * app_settings (except pos_order_seq reset), product-type/lens categorization, suppliers,
 * product_master, home_brands, branding_agents.
 *
 * Backup the database first.
 * Run: npm run maintenance:purge-operational-reset
 * Requires env: COSMOS_PURGE_CONFIRM=I_UNDERSTAND
 */
USE [CosmosERP];
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @phase NVARCHAR(20) = N'PREFLIGHT';

PRINT N'=== purge_operational_reset_keep_config — ' + @phase + N' ===';

SELECT
  N'pos_orders' AS domain,
  CASE WHEN OBJECT_ID(N'dbo.pos_orders', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.pos_orders) END AS row_count
UNION ALL
SELECT N'oe_orders',
  CASE WHEN OBJECT_ID(N'dbo.oe_orders', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.oe_orders) END
UNION ALL
SELECT N'pos_customers',
  CASE WHEN OBJECT_ID(N'dbo.pos_customers', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.pos_customers) END
UNION ALL
SELECT N'stock_balances',
  CASE WHEN OBJECT_ID(N'dbo.stock_balances', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.stock_balances) END
UNION ALL
SELECT N'stock_movements',
  CASE WHEN OBJECT_ID(N'dbo.stock_movements', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.stock_movements) END
UNION ALL
SELECT N'stock_transfer_docs',
  CASE WHEN OBJECT_ID(N'dbo.stock_transfer_docs', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.stock_transfer_docs) END
UNION ALL
SELECT N'transfer_requests',
  CASE WHEN OBJECT_ID(N'dbo.transfer_requests', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.transfer_requests) END
UNION ALL
SELECT N'sku_units',
  CASE WHEN OBJECT_ID(N'dbo.sku_units', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.sku_units) END
UNION ALL
SELECT N'skus',
  CASE WHEN OBJECT_ID(N'dbo.skus', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.skus) END
UNION ALL
SELECT N'purchase_headers',
  CASE WHEN OBJECT_ID(N'dbo.purchase_headers', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.purchase_headers) END
UNION ALL
SELECT N'audit_logs',
  CASE WHEN OBJECT_ID(N'dbo.audit_logs', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.audit_logs) END;

BEGIN TRANSACTION;

SET @phase = N'DELETE';
PRINT N'=== purge_operational_reset_keep_config — ' + @phase + N' ===';

/* ── A — Sales / orders ─────────────────────────────────────────────────────── */
IF OBJECT_ID(N'dbo.order_item_units', N'U') IS NOT NULL
  DELETE FROM dbo.order_item_units;

IF OBJECT_ID(N'dbo.pos_order_status_log', N'U') IS NOT NULL
  DELETE FROM dbo.pos_order_status_log;

IF OBJECT_ID(N'dbo.pos_order_items', N'U') IS NOT NULL
  DELETE FROM dbo.pos_order_items;

IF OBJECT_ID(N'dbo.pos_sub_orders', N'U') IS NOT NULL
  DELETE FROM dbo.pos_sub_orders;

IF OBJECT_ID(N'dbo.pos_payments', N'U') IS NOT NULL
  DELETE FROM dbo.pos_payments;

IF OBJECT_ID(N'dbo.pos_invoices', N'U') IS NOT NULL
  DELETE FROM dbo.pos_invoices;

IF OBJECT_ID(N'dbo.pos_orders', N'U') IS NOT NULL
  DELETE FROM dbo.pos_orders;

IF OBJECT_ID(N'dbo.oe_order_status_log', N'U') IS NOT NULL
  DELETE FROM dbo.oe_order_status_log;

IF OBJECT_ID(N'dbo.oe_order_items', N'U') IS NOT NULL
  DELETE FROM dbo.oe_order_items;

IF OBJECT_ID(N'dbo.oe_payments', N'U') IS NOT NULL
  DELETE FROM dbo.oe_payments;

IF OBJECT_ID(N'dbo.oe_sub_orders', N'U') IS NOT NULL
  DELETE FROM dbo.oe_sub_orders;

IF OBJECT_ID(N'dbo.oe_orders', N'U') IS NOT NULL
  DELETE FROM dbo.oe_orders;

IF OBJECT_ID(N'dbo.pos_checkout_drafts', N'U') IS NOT NULL
  DELETE FROM dbo.pos_checkout_drafts;

IF OBJECT_ID(N'dbo.pos_hq_stock_reservations', N'U') IS NOT NULL
  DELETE FROM dbo.pos_hq_stock_reservations;

IF OBJECT_ID(N'dbo.pos_points_ledger', N'U') IS NOT NULL
  DELETE FROM dbo.pos_points_ledger;

IF OBJECT_ID(N'dbo.offer_usage', N'U') IS NOT NULL
  DELETE FROM dbo.offer_usage;

/* ── B — Customers ─────────────────────────────────────────────────────────── */
IF OBJECT_ID(N'dbo.customer_offer_scope', N'U') IS NOT NULL
  DELETE FROM dbo.customer_offer_scope;

IF OBJECT_ID(N'dbo.customer_membership_dependents', N'U') IS NOT NULL
  DELETE FROM dbo.customer_membership_dependents;

IF OBJECT_ID(N'dbo.customer_memberships', N'U') IS NOT NULL
  DELETE FROM dbo.customer_memberships;

IF OBJECT_ID(N'dbo.customer_auth', N'U') IS NOT NULL
  DELETE FROM dbo.customer_auth;

IF OBJECT_ID(N'dbo.eye_tests', N'U') IS NOT NULL
  DELETE FROM dbo.eye_tests;

IF OBJECT_ID(N'dbo.pos_customers', N'U') IS NOT NULL
  DELETE FROM dbo.pos_customers;

/* ── C — Sessions / audit ──────────────────────────────────────────────────── */
IF OBJECT_ID(N'dbo.pos_order_sessions', N'U') IS NOT NULL
  DELETE FROM dbo.pos_order_sessions;

IF OBJECT_ID(N'dbo.pos_pin_attempts', N'U') IS NOT NULL
  DELETE FROM dbo.pos_pin_attempts;

IF OBJECT_ID(N'dbo.audit_logs', N'U') IS NOT NULL
  DELETE FROM dbo.audit_logs;

/* ── D — Stock & transfers ───────────────────────────────────────────────────── */
IF OBJECT_ID(N'dbo.stock_transfer_doc_units', N'U') IS NOT NULL
  DELETE FROM dbo.stock_transfer_doc_units;

IF OBJECT_ID(N'dbo.stock_transfer_doc_lines', N'U') IS NOT NULL
  DELETE FROM dbo.stock_transfer_doc_lines;

IF OBJECT_ID(N'dbo.stock_transfer_docs', N'U') IS NOT NULL
  DELETE FROM dbo.stock_transfer_docs;

IF OBJECT_ID(N'dbo.transfer_request_lines', N'U') IS NOT NULL
  DELETE FROM dbo.transfer_request_lines;

IF OBJECT_ID(N'dbo.transfer_requests', N'U') IS NOT NULL
  DELETE FROM dbo.transfer_requests;

IF OBJECT_ID(N'dbo.stock_movements', N'U') IS NOT NULL
  DELETE FROM dbo.stock_movements;

IF OBJECT_ID(N'dbo.stock_balances', N'U') IS NOT NULL
  DELETE FROM dbo.stock_balances;

IF OBJECT_ID(N'dbo.sku_units', N'U') IS NOT NULL
  DELETE FROM dbo.sku_units;

/* ── E — Foundry purchases + SKUs + purchase finance ─────────────────────────── */
IF OBJECT_ID(N'dbo.payment_invoice_allocations', N'U') IS NOT NULL
  DELETE FROM dbo.payment_invoice_allocations;

IF OBJECT_ID(N'dbo.payment_allocations', N'U') IS NOT NULL
  DELETE FROM dbo.payment_allocations;

IF OBJECT_ID(N'dbo.invoice_challan_allocations', N'U') IS NOT NULL
  DELETE FROM dbo.invoice_challan_allocations;

IF OBJECT_ID(N'dbo.supplier_purchase_invoices', N'U') IS NOT NULL
  DELETE FROM dbo.supplier_purchase_invoices;

IF OBJECT_ID(N'dbo.supplier_payments', N'U') IS NOT NULL
  DELETE FROM dbo.supplier_payments;

IF OBJECT_ID(N'dbo.purchase_restock_events', N'U') IS NOT NULL
  DELETE FROM dbo.purchase_restock_events;

IF OBJECT_ID(N'dbo.purchase_item_colours', N'U') IS NOT NULL
BEGIN
  UPDATE dbo.purchase_item_colours SET linked_sku_id = NULL WHERE linked_sku_id IS NOT NULL;
END;

IF OBJECT_ID(N'dbo.pos_package_freebies', N'U') IS NOT NULL
  DELETE FROM dbo.pos_package_freebies;

IF OBJECT_ID(N'dbo.sku_sale_price_history', N'U') IS NOT NULL
  DELETE FROM dbo.sku_sale_price_history;

IF OBJECT_ID(N'dbo.sku_digitisation', N'U') IS NOT NULL
  DELETE FROM dbo.sku_digitisation;

IF OBJECT_ID(N'dbo.sku_media', N'U') IS NOT NULL
  DELETE FROM dbo.sku_media;

IF OBJECT_ID(N'dbo.skus', N'U') IS NOT NULL
  DELETE FROM dbo.skus;

IF OBJECT_ID(N'dbo.purchase_item_colours', N'U') IS NOT NULL
  DELETE FROM dbo.purchase_item_colours;

IF OBJECT_ID(N'dbo.purchase_items', N'U') IS NOT NULL
  DELETE FROM dbo.purchase_items;

IF OBJECT_ID(N'dbo.purchase_headers', N'U') IS NOT NULL
  DELETE FROM dbo.purchase_headers;

IF OBJECT_ID(N'dbo.branding_job_colours', N'U') IS NOT NULL
  DELETE FROM dbo.branding_job_colours;

IF OBJECT_ID(N'dbo.branding_jobs', N'U') IS NOT NULL
  DELETE FROM dbo.branding_jobs;

IF OBJECT_ID(N'dbo.purchase_colours', N'U') IS NOT NULL
  DELETE FROM dbo.purchase_colours;

IF OBJECT_ID(N'dbo.purchases', N'U') IS NOT NULL
  DELETE FROM dbo.purchases;

/* ── F — Reseed / reset sequences (config rows preserved) ────────────────────── */
DECLARE @k VARCHAR(100) = N'pos_order_seq';

IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = @k)
  INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
  VALUES (@k, N'0', N'pos', N'Monotonic order sequence (integer string).');
ELSE
  UPDATE dbo.app_settings
  SET setting_value = N'0',
      updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
  WHERE setting_key = @k;

IF EXISTS (SELECT 1 FROM sys.sequences WHERE name = N'seq_sku_unit_barcode' AND SCHEMA_NAME(schema_id) = N'dbo')
  ALTER SEQUENCE dbo.seq_sku_unit_barcode RESTART WITH 1;

IF OBJECT_ID(N'dbo.order_item_units', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.order_item_units', RESEED, 0);

IF OBJECT_ID(N'dbo.pos_orders', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.pos_orders', RESEED, 0);
IF OBJECT_ID(N'dbo.pos_sub_orders', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.pos_sub_orders', RESEED, 0);
IF OBJECT_ID(N'dbo.pos_order_items', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.pos_order_items', RESEED, 0);
IF OBJECT_ID(N'dbo.pos_order_status_log', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.pos_order_status_log', RESEED, 0);
IF OBJECT_ID(N'dbo.pos_payments', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.pos_payments', RESEED, 0);
IF OBJECT_ID(N'dbo.pos_invoices', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.pos_invoices', RESEED, 0);
IF OBJECT_ID(N'dbo.pos_customers', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.pos_customers', RESEED, 0);

IF OBJECT_ID(N'dbo.oe_orders', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.oe_orders', RESEED, 0);
IF OBJECT_ID(N'dbo.oe_sub_orders', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.oe_sub_orders', RESEED, 0);
IF OBJECT_ID(N'dbo.oe_order_items', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.oe_order_items', RESEED, 0);
IF OBJECT_ID(N'dbo.oe_payments', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.oe_payments', RESEED, 0);
IF OBJECT_ID(N'dbo.oe_order_status_log', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.oe_order_status_log', RESEED, 0);

IF OBJECT_ID(N'dbo.stock_transfer_docs', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.stock_transfer_docs', RESEED, 0);
IF OBJECT_ID(N'dbo.stock_transfer_doc_lines', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.stock_transfer_doc_lines', RESEED, 0);
IF OBJECT_ID(N'dbo.stock_transfer_doc_units', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.stock_transfer_doc_units', RESEED, 0);
IF OBJECT_ID(N'dbo.transfer_requests', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.transfer_requests', RESEED, 0);
IF OBJECT_ID(N'dbo.transfer_request_lines', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.transfer_request_lines', RESEED, 0);

IF OBJECT_ID(N'dbo.sku_units', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.sku_units', RESEED, 0);
IF OBJECT_ID(N'dbo.skus', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.skus', RESEED, 0);

IF OBJECT_ID(N'dbo.purchase_headers', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.purchase_headers', RESEED, 0);
IF OBJECT_ID(N'dbo.purchase_items', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.purchase_items', RESEED, 0);
IF OBJECT_ID(N'dbo.purchase_item_colours', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.purchase_item_colours', RESEED, 0);
IF OBJECT_ID(N'dbo.purchase_restock_events', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.purchase_restock_events', RESEED, 0);
IF OBJECT_ID(N'dbo.purchases', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.purchases', RESEED, 0);
IF OBJECT_ID(N'dbo.purchase_colours', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.purchase_colours', RESEED, 0);
IF OBJECT_ID(N'dbo.branding_jobs', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.branding_jobs', RESEED, 0);
IF OBJECT_ID(N'dbo.branding_job_colours', N'U') IS NOT NULL
  DBCC CHECKIDENT (N'dbo.branding_job_colours', RESEED, 0);

COMMIT TRANSACTION;

SET @phase = N'POST_VERIFY';
PRINT N'=== purge_operational_reset_keep_config — ' + @phase + N' ===';

SELECT
  N'pos_orders' AS domain,
  CASE WHEN OBJECT_ID(N'dbo.pos_orders', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.pos_orders) END AS row_count
UNION ALL
SELECT N'oe_orders',
  CASE WHEN OBJECT_ID(N'dbo.oe_orders', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.oe_orders) END
UNION ALL
SELECT N'pos_customers',
  CASE WHEN OBJECT_ID(N'dbo.pos_customers', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.pos_customers) END
UNION ALL
SELECT N'stock_balances',
  CASE WHEN OBJECT_ID(N'dbo.stock_balances', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.stock_balances) END
UNION ALL
SELECT N'stock_movements',
  CASE WHEN OBJECT_ID(N'dbo.stock_movements', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.stock_movements) END
UNION ALL
SELECT N'stock_transfer_docs',
  CASE WHEN OBJECT_ID(N'dbo.stock_transfer_docs', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.stock_transfer_docs) END
UNION ALL
SELECT N'transfer_requests',
  CASE WHEN OBJECT_ID(N'dbo.transfer_requests', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.transfer_requests) END
UNION ALL
SELECT N'sku_units',
  CASE WHEN OBJECT_ID(N'dbo.sku_units', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.sku_units) END
UNION ALL
SELECT N'skus',
  CASE WHEN OBJECT_ID(N'dbo.skus', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.skus) END
UNION ALL
SELECT N'purchase_headers',
  CASE WHEN OBJECT_ID(N'dbo.purchase_headers', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.purchase_headers) END
UNION ALL
SELECT N'audit_logs',
  CASE WHEN OBJECT_ID(N'dbo.audit_logs', N'U') IS NULL THEN NULL
       ELSE (SELECT COUNT(*) FROM dbo.audit_logs) END;

SELECT
  setting_value AS pos_order_seq_after_reset
FROM dbo.app_settings
WHERE setting_key = N'pos_order_seq';

PRINT N'purge_operational_reset_keep_config: finished. Re-login users; next purchase header_id and EW-ORD sequence start at 1.';
GO
