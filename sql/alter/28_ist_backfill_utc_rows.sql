-- ===========================================================================
-- Cosmos ERP — One-time backfill: shift UTC-stored datetimes to IST
-- Script: 28_ist_backfill_utc_rows.sql
--
-- WHEN TO RUN:
--   ONLY if the SQL Server OS was previously configured in UTC (or any TZ
--   other than IST) so GETDATE() stored UTC times in datetime columns.
--
-- IF the server was already in IST, DO NOT run this — rows are already
-- correct and +330 min would be double-counted.
--
-- CONFIRM FIRST:
--   SELECT SYSUTCDATETIME(), DATEADD(MINUTE,330,SYSUTCDATETIME()),
--          GETDATE(),         SYSDATETIMEOFFSET()
--   Compare the result against a known IST clock to decide.
--
-- ===========================================================================
-- REVIEW BEFORE RUNNING: uncomment the UPDATE blocks once confirmed.
-- This script is intentionally commented out to prevent accidental runs.
-- ===========================================================================

/*
BEGIN TRANSACTION;

-- Shift all created_at / updated_at by +330 minutes (UTC → IST).
-- Add or remove tables as your audit confirms they contain UTC-based values.

UPDATE dbo.users        SET created_at = DATEADD(MINUTE,330,created_at), updated_at = DATEADD(MINUTE,330,updated_at);
UPDATE dbo.roles        SET created_at = DATEADD(MINUTE,330,created_at), updated_at = DATEADD(MINUTE,330,updated_at);
UPDATE dbo.stores       SET created_at = DATEADD(MINUTE,330,created_at), updated_at = DATEADD(MINUTE,330,updated_at);
UPDATE dbo.home_brands  SET created_at = DATEADD(MINUTE,330,created_at), updated_at = DATEADD(MINUTE,330,updated_at);
UPDATE dbo.suppliers    SET created_at = DATEADD(MINUTE,330,created_at), updated_at = DATEADD(MINUTE,330,updated_at);
UPDATE dbo.product_master SET created_at = DATEADD(MINUTE,330,created_at), updated_at = DATEADD(MINUTE,330,updated_at);
UPDATE dbo.purchases    SET created_at = DATEADD(MINUTE,330,created_at), updated_at = DATEADD(MINUTE,330,updated_at),
                            purchase_date = DATEADD(MINUTE,330,purchase_date);
UPDATE dbo.branding_jobs SET created_at = DATEADD(MINUTE,330,created_at), updated_at = DATEADD(MINUTE,330,updated_at);
UPDATE dbo.skus         SET created_at = DATEADD(MINUTE,330,created_at), updated_at = DATEADD(MINUTE,330,updated_at);
UPDATE dbo.stock_balances    SET last_updated = DATEADD(MINUTE,330,last_updated);
UPDATE dbo.stock_movements   SET created_at   = DATEADD(MINUTE,330,created_at);
UPDATE dbo.vendor_product_rates SET created_at = DATEADD(MINUTE,330,created_at), updated_at = DATEADD(MINUTE,330,updated_at);
UPDATE dbo.product_rate_summary SET updated_at = DATEADD(MINUTE,330,updated_at);
UPDATE dbo.audit_logs   SET created_at = DATEADD(MINUTE,330,created_at);
UPDATE dbo.token_blacklist SET created_at = DATEADD(MINUTE,330,created_at);
UPDATE dbo.app_settings SET created_at = DATEADD(MINUTE,330,created_at);

-- Transfer / StorePilot tables (if they were also written in UTC)
-- UPDATE dbo.transfer_requests SET created_at = DATEADD(MINUTE,330,created_at), updated_at = DATEADD(MINUTE,330,updated_at);
-- UPDATE dbo.stock_transfer_docs SET created_at = DATEADD(MINUTE,330,created_at), updated_at = DATEADD(MINUTE,330,updated_at);

-- Verify a few rows look correct, THEN commit:
-- SELECT TOP 5 user_id, created_at FROM dbo.users ORDER BY user_id;

COMMIT;
-- ROLLBACK; -- use this instead if anything looks wrong
*/

PRINT 'Backfill script loaded. Read the comments and uncomment only after confirming UTC source data.';
