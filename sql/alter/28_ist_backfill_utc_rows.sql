-- ===========================================================================
-- Cosmos ERP — One-time backfill: shift UTC-stored datetimes to IST
-- Script: 28_ist_backfill_utc_rows.sql (reference / legacy comment block)
--
-- RUNNABLE VERSION (guarded + full table list + OBJECT_ID checks):
--   sql/migrations/ist_backfill_utc_stored_rows.sql
--
--   Set @ConfirmUtcStored = 1 in that file after validating that historical
--   DATETIME values are UTC-based. Do not run if the server always stored IST.
--
-- WHEN TO RUN:
--   ONLY if SQL Server previously wrote GETDATE() / local time as UTC (host TZ
--   was UTC, etc.). If the host was already IST, +330 would double-shift.
--
-- CONFIRM FIRST:
--   SELECT SYSUTCDATETIME(), DATEADD(MINUTE,330,SYSUTCDATETIME()),
--          SYSDATETIMEOFFSET();
--   Compare to a known IST clock.
--
-- NOTE: Older commented block below referenced dbo.app_settings.created_at;
--   current schema (sql/tables/01_shared_core.sql) has updated_at only —
--   the migration script uses updated_at.
-- ===========================================================================

/*
BEGIN TRANSACTION;

-- Minimal legacy list (see sql/migrations/ist_backfill_utc_stored_rows.sql for full set).

UPDATE dbo.users        SET last_login = DATEADD(MINUTE,330,last_login), created_at = DATEADD(MINUTE,330,created_at), updated_at = DATEADD(MINUTE,330,updated_at);
UPDATE dbo.roles        SET created_at = DATEADD(MINUTE,330,created_at), updated_at = DATEADD(MINUTE,330,updated_at);
UPDATE dbo.stores       SET created_at = DATEADD(MINUTE,330,created_at), updated_at = DATEADD(MINUTE,330,updated_at);
UPDATE dbo.product_master SET created_at = DATEADD(MINUTE,330,created_at), updated_at = DATEADD(MINUTE,330,updated_at);
UPDATE dbo.purchases    SET purchase_date = DATEADD(MINUTE,330,purchase_date), bill_date = DATEADD(MINUTE,330,bill_date), created_at = DATEADD(MINUTE,330,created_at), updated_at = DATEADD(MINUTE,330,updated_at);
UPDATE dbo.skus         SET created_at = DATEADD(MINUTE,330,created_at), updated_at = DATEADD(MINUTE,330,updated_at);
UPDATE dbo.stock_balances    SET last_updated = DATEADD(MINUTE,330,last_updated);
UPDATE dbo.stock_movements   SET created_at   = DATEADD(MINUTE,330,created_at);
UPDATE dbo.app_settings SET updated_at = DATEADD(MINUTE,330,updated_at);

COMMIT;
-- ROLLBACK;
*/

PRINT 'See sql/migrations/ist_backfill_utc_stored_rows.sql for the guarded IST UTC backfill.';
