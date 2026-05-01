-- ===========================================================================
-- Cosmos ERP — IST backfill: shift UTC-stored DATETIME/DATETIME2 to IST wall clock
-- File: sql/migrations/ist_backfill_utc_stored_rows.sql
--
-- WHAT THIS DOES
--   Adds +330 minutes to every listed column on every row, so values that were
--   incorrectly stored as UTC (because SQL Server / GETDATE() reflected UTC)
--   display and compare correctly as India Standard Time (IST).
--
-- WHEN TO RUN
--   ONLY after you confirm historical rows are UTC-based, not already IST.
--   If the host was always IST, running this will DOUBLE-SHIFT (+11 hours wrong).
--
-- VALIDATION (run in SSMS first):
--   SELECT SYSUTCDATETIME() AS utc_now,
--          DATEADD(MINUTE, 330, SYSUTCDATETIME()) AS ist_from_utc,
--          SYSDATETIMEOFFSET() AS server_wall_with_offset;
--   Compare to a known IST clock.
--
-- USAGE
--   1. Back up the database.
--   2. Set @ConfirmUtcStored = 1 below (after validation).
--   3. Execute this script in SSMS against CosmosERP.
--
-- SAFE ON PARTIAL SCHEMAS
--   Each UPDATE runs only if the table exists (OBJECT_ID check).
--
-- Reference: sql/sp/cosmos_ist_time.sql
-- Supersedes inline list in sql/alter/28_ist_backfill_utc_rows.sql (app_settings
--   had no created_at — this script uses updated_at only).
-- ===========================================================================

USE [CosmosERP];
GO

SET NOCOUNT ON;

DECLARE @ConfirmUtcStored BIT = 0;  -- Set to 1 only after UTC source is confirmed

IF @ConfirmUtcStored <> 1
BEGIN
  RAISERROR(
    N'IST UTC backfill aborted. Set @ConfirmUtcStored = 1 after confirming historical DATETIME values are UTC-based (see script header).',
    16, 1
  );
  RETURN;
END;

BEGIN TRANSACTION;

BEGIN TRY

  -- ---- shared core ---------------------------------------------------------
  IF OBJECT_ID('dbo.users', 'U') IS NOT NULL
    UPDATE dbo.users SET
      last_login = DATEADD(MINUTE, 330, last_login),
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.roles', 'U') IS NOT NULL
    UPDATE dbo.roles SET
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.role_permissions', 'U') IS NOT NULL
    UPDATE dbo.role_permissions SET created_at = DATEADD(MINUTE, 330, created_at);

  IF OBJECT_ID('dbo.stores', 'U') IS NOT NULL
    UPDATE dbo.stores SET
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.store_module_access', 'U') IS NOT NULL
    UPDATE dbo.store_module_access SET
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.app_settings', 'U') IS NOT NULL
    UPDATE dbo.app_settings SET updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.token_blacklist', 'U') IS NOT NULL
    UPDATE dbo.token_blacklist SET
      expires_at = DATEADD(MINUTE, 330, expires_at),
      created_at = DATEADD(MINUTE, 330, created_at);

  IF OBJECT_ID('dbo.audit_logs', 'U') IS NOT NULL
    UPDATE dbo.audit_logs SET created_at = DATEADD(MINUTE, 330, created_at);

  -- ---- command unit --------------------------------------------------------
  IF OBJECT_ID('dbo.home_brands', 'U') IS NOT NULL
    UPDATE dbo.home_brands SET
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.membership_tiers', 'U') IS NOT NULL
    UPDATE dbo.membership_tiers SET
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.leave_types', 'U') IS NOT NULL
    UPDATE dbo.leave_types SET
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.gst_rates', 'U') IS NOT NULL
    UPDATE dbo.gst_rates SET
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  -- ---- foundry core (legacy purchases.* may still exist) -------------------
  IF OBJECT_ID('dbo.suppliers', 'U') IS NOT NULL
    UPDATE dbo.suppliers SET
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.product_master', 'U') IS NOT NULL
    UPDATE dbo.product_master SET
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.purchases', 'U') IS NOT NULL
    UPDATE dbo.purchases SET
      purchase_date = DATEADD(MINUTE, 330, purchase_date),
      bill_date     = DATEADD(MINUTE, 330, bill_date),
      created_at    = DATEADD(MINUTE, 330, created_at),
      updated_at    = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.purchase_colours', 'U') IS NOT NULL
    UPDATE dbo.purchase_colours SET created_at = DATEADD(MINUTE, 330, created_at);

  IF OBJECT_ID('dbo.branding_jobs', 'U') IS NOT NULL
    UPDATE dbo.branding_jobs SET
      dispatch_date        = DATEADD(MINUTE, 330, dispatch_date),
      expected_return_date = DATEADD(MINUTE, 330, expected_return_date),
      actual_return_date   = DATEADD(MINUTE, 330, actual_return_date),
      created_at           = DATEADD(MINUTE, 330, created_at),
      updated_at           = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.branding_job_colours', 'U') IS NOT NULL
    UPDATE dbo.branding_job_colours SET
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  -- ---- foundry stock / rates ----------------------------------------------
  IF OBJECT_ID('dbo.skus', 'U') IS NOT NULL
    UPDATE dbo.skus SET
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.sku_digitisation', 'U') IS NOT NULL
    UPDATE dbo.sku_digitisation SET
      approved_at = DATEADD(MINUTE, 330, approved_at),
      created_at  = DATEADD(MINUTE, 330, created_at),
      updated_at  = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.sku_media', 'U') IS NOT NULL
    UPDATE dbo.sku_media SET created_at = DATEADD(MINUTE, 330, created_at);

  IF OBJECT_ID('dbo.stock_balances', 'U') IS NOT NULL
    UPDATE dbo.stock_balances SET last_updated = DATEADD(MINUTE, 330, last_updated);

  IF OBJECT_ID('dbo.stock_movements', 'U') IS NOT NULL
    UPDATE dbo.stock_movements SET created_at = DATEADD(MINUTE, 330, created_at);

  IF OBJECT_ID('dbo.location_visibility_config', 'U') IS NOT NULL
    UPDATE dbo.location_visibility_config SET
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.vendor_product_rates', 'U') IS NOT NULL
    UPDATE dbo.vendor_product_rates SET updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.product_rate_summary', 'U') IS NOT NULL
    UPDATE dbo.product_rate_summary SET updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.sku_sale_price_history', 'U') IS NOT NULL
    UPDATE dbo.sku_sale_price_history SET changed_at = DATEADD(MINUTE, 330, changed_at);

  -- ---- header/items pipeline (migration 07+) -------------------------------
  IF OBJECT_ID('dbo.maker_master', 'U') IS NOT NULL
    UPDATE dbo.maker_master SET
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.purchase_headers', 'U') IS NOT NULL
    UPDATE dbo.purchase_headers SET
      purchase_date = DATEADD(MINUTE, 330, purchase_date),
      bill_date     = DATEADD(MINUTE, 330, bill_date),
      dispatched_at = DATEADD(MINUTE, 330, dispatched_at),
      received_at   = DATEADD(MINUTE, 330, received_at),
      warehouse_at  = DATEADD(MINUTE, 330, warehouse_at),
      created_at    = DATEADD(MINUTE, 330, created_at),
      updated_at    = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.purchase_items', 'U') IS NOT NULL
    UPDATE dbo.purchase_items SET created_at = DATEADD(MINUTE, 330, created_at);

  IF OBJECT_ID('dbo.purchase_item_colours', 'U') IS NOT NULL
    UPDATE dbo.purchase_item_colours SET created_at = DATEADD(MINUTE, 330, created_at);

  IF OBJECT_ID('dbo.purchase_restock_events', 'U') IS NOT NULL
    UPDATE dbo.purchase_restock_events SET created_at = DATEADD(MINUTE, 330, created_at);

  -- ---- access / lookup / finance -------------------------------------------
  IF OBJECT_ID('dbo.user_module_access', 'U') IS NOT NULL
    UPDATE dbo.user_module_access SET
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.role_module_access', 'U') IS NOT NULL
    UPDATE dbo.role_module_access SET
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.foundry_lookup_values', 'U') IS NOT NULL
    UPDATE dbo.foundry_lookup_values SET
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.supplier_payments', 'U') IS NOT NULL
    UPDATE dbo.supplier_payments SET
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.payment_allocations', 'U') IS NOT NULL
    UPDATE dbo.payment_allocations SET created_at = DATEADD(MINUTE, 330, created_at);

  -- ---- transfer / store pilot ----------------------------------------------
  IF OBJECT_ID('dbo.transfer_requests', 'U') IS NOT NULL
    UPDATE dbo.transfer_requests SET
      reviewed_at   = DATEADD(MINUTE, 330, reviewed_at),
      dispatched_at = DATEADD(MINUTE, 330, dispatched_at),
      received_at   = DATEADD(MINUTE, 330, received_at),
      created_at    = DATEADD(MINUTE, 330, created_at),
      updated_at    = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.stock_transfer_docs', 'U') IS NOT NULL
    UPDATE dbo.stock_transfer_docs SET
      dispatched_at = DATEADD(MINUTE, 330, dispatched_at),
      accepted_at   = DATEADD(MINUTE, 330, accepted_at),
      stocked_at    = DATEADD(MINUTE, 330, stocked_at),
      created_at    = DATEADD(MINUTE, 330, created_at);

  -- ---- branding agents (optional table) ------------------------------------
  IF OBJECT_ID('dbo.branding_agents', 'U') IS NOT NULL
    UPDATE dbo.branding_agents SET
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  -- ---- POS -----------------------------------------------------------------
  IF OBJECT_ID('dbo.pos_customers', 'U') IS NOT NULL
    UPDATE dbo.pos_customers SET
      created_at = DATEADD(MINUTE, 330, created_at),
      updated_at = DATEADD(MINUTE, 330, updated_at);

  IF OBJECT_ID('dbo.pos_orders', 'U') IS NOT NULL
    UPDATE dbo.pos_orders SET created_at = DATEADD(MINUTE, 330, created_at);

  IF OBJECT_ID('dbo.pos_order_status_log', 'U') IS NOT NULL
    UPDATE dbo.pos_order_status_log SET created_at = DATEADD(MINUTE, 330, created_at);

  IF OBJECT_ID('dbo.pos_payments', 'U') IS NOT NULL
    UPDATE dbo.pos_payments SET created_at = DATEADD(MINUTE, 330, created_at);

  IF OBJECT_ID('dbo.pos_invoices', 'U') IS NOT NULL
    UPDATE dbo.pos_invoices SET created_at = DATEADD(MINUTE, 330, created_at);

  IF OBJECT_ID('dbo.pos_points_ledger', 'U') IS NOT NULL
    UPDATE dbo.pos_points_ledger SET created_at = DATEADD(MINUTE, 330, created_at);

  IF OBJECT_ID('dbo.pos_hq_stock_reservations', 'U') IS NOT NULL
    UPDATE dbo.pos_hq_stock_reservations SET created_at = DATEADD(MINUTE, 330, created_at);

  -- ---- shared order engine (oe_*) ------------------------------------------
  IF OBJECT_ID('dbo.oe_orders', 'U') IS NOT NULL
    UPDATE dbo.oe_orders SET created_at = DATEADD(MINUTE, 330, created_at);

  IF OBJECT_ID('dbo.oe_payments', 'U') IS NOT NULL
    UPDATE dbo.oe_payments SET created_at = DATEADD(MINUTE, 330, created_at);

  IF OBJECT_ID('dbo.oe_order_status_log', 'U') IS NOT NULL
    UPDATE dbo.oe_order_status_log SET created_at = DATEADD(MINUTE, 330, created_at);

  COMMIT TRANSACTION;
  PRINT N'IST UTC backfill completed successfully. Verify sample rows, then deploy.';
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
