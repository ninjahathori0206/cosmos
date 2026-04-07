-- ===========================================================================
-- Cosmos ERP — Migrate existing DEFAULT GETDATE() constraints to IST
-- Script: 27_ist_timestamp_defaults.sql
-- Purpose: Drop existing GETDATE()-based default constraints on all
--          timestamp columns and replace with the canonical IST expression:
--            DATEADD(MINUTE, 330, SYSUTCDATETIME())
--
-- Run this on any database that was created BEFORE the table/SP IST change
-- (sql/tables/*.sql and sql/sp/*.sql were already updated for fresh installs).
--
-- SAFE TO RUN MULTIPLE TIMES — IF block prevents duplicate work.
-- Historical rows are NOT changed; only future INSERTs will use IST defaults.
-- ===========================================================================

SET NOCOUNT ON;

-- Helper: drop a named default constraint if it exists, then add the IST one.
-- We use dynamic SQL because SQL Server auto-generates constraint names on
-- legacy tables (e.g. DF__users__created__...).

DECLARE @sql   NVARCHAR(MAX);
DECLARE @cn    NVARCHAR(256);

-- ---- dbo.users ----
SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    JOIN sys.tables  t ON t.object_id = dc.parent_object_id
WHERE t.name = 'users' AND c.name = 'created_at';
IF @cn IS NOT NULL BEGIN
    SET @sql = N'ALTER TABLE dbo.users DROP CONSTRAINT ' + QUOTENAME(@cn);
    EXEC sp_executesql @sql;
END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
    WHERE t.name='users' AND c.name='created_at')
    ALTER TABLE dbo.users ADD CONSTRAINT DF_users_created_at
        DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())) FOR created_at;

SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    JOIN sys.tables  t ON t.object_id = dc.parent_object_id
WHERE t.name = 'users' AND c.name = 'updated_at';
IF @cn IS NOT NULL BEGIN
    SET @sql = N'ALTER TABLE dbo.users DROP CONSTRAINT ' + QUOTENAME(@cn);
    EXEC sp_executesql @sql;
END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
    WHERE t.name='users' AND c.name='updated_at')
    ALTER TABLE dbo.users ADD CONSTRAINT DF_users_updated_at
        DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())) FOR updated_at;
GO

-- ---- dbo.roles ----
DECLARE @sql NVARCHAR(MAX); DECLARE @cn NVARCHAR(256);
SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='roles' AND c.name='created_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.roles DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='roles' AND c.name='created_at')
    ALTER TABLE dbo.roles ADD CONSTRAINT DF_roles_created_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR created_at;

SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='roles' AND c.name='updated_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.roles DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='roles' AND c.name='updated_at')
    ALTER TABLE dbo.roles ADD CONSTRAINT DF_roles_updated_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR updated_at;
GO

-- ---- dbo.stores ----
DECLARE @sql NVARCHAR(MAX); DECLARE @cn NVARCHAR(256);
SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='stores' AND c.name='created_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.stores DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='stores' AND c.name='created_at')
    ALTER TABLE dbo.stores ADD CONSTRAINT DF_stores_created_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR created_at;

SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='stores' AND c.name='updated_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.stores DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='stores' AND c.name='updated_at')
    ALTER TABLE dbo.stores ADD CONSTRAINT DF_stores_updated_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR updated_at;
GO

-- ---- dbo.store_module_access ----
DECLARE @sql NVARCHAR(MAX); DECLARE @cn NVARCHAR(256);
SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='store_module_access' AND c.name='updated_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.store_module_access DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='store_module_access' AND c.name='updated_at')
    ALTER TABLE dbo.store_module_access ADD CONSTRAINT DF_store_module_access_updated_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR updated_at;
GO

-- ---- dbo.app_settings ----
DECLARE @sql NVARCHAR(MAX); DECLARE @cn NVARCHAR(256);
SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='app_settings' AND c.name='created_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.app_settings DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='app_settings' AND c.name='created_at')
    ALTER TABLE dbo.app_settings ADD CONSTRAINT DF_app_settings_created_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR created_at;
GO

-- ---- dbo.token_blacklist ----
DECLARE @sql NVARCHAR(MAX); DECLARE @cn NVARCHAR(256);
SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='token_blacklist' AND c.name='created_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.token_blacklist DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='token_blacklist' AND c.name='created_at')
    ALTER TABLE dbo.token_blacklist ADD CONSTRAINT DF_token_blacklist_created_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR created_at;
GO

-- ---- dbo.audit_logs ----
DECLARE @sql NVARCHAR(MAX); DECLARE @cn NVARCHAR(256);
SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='audit_logs' AND c.name='created_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.audit_logs DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='audit_logs' AND c.name='created_at')
    ALTER TABLE dbo.audit_logs ADD CONSTRAINT DF_audit_logs_created_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR created_at;
GO

-- ---- dbo.home_brands ----
DECLARE @sql NVARCHAR(MAX); DECLARE @cn NVARCHAR(256);
SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='home_brands' AND c.name='created_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.home_brands DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='home_brands' AND c.name='created_at')
    ALTER TABLE dbo.home_brands ADD CONSTRAINT DF_home_brands_created_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR created_at;

SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='home_brands' AND c.name='updated_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.home_brands DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='home_brands' AND c.name='updated_at')
    ALTER TABLE dbo.home_brands ADD CONSTRAINT DF_home_brands_updated_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR updated_at;
GO

-- ---- dbo.suppliers ----
DECLARE @sql NVARCHAR(MAX); DECLARE @cn NVARCHAR(256);
SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='suppliers' AND c.name='created_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.suppliers DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='suppliers' AND c.name='created_at')
    ALTER TABLE dbo.suppliers ADD CONSTRAINT DF_suppliers_created_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR created_at;

SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='suppliers' AND c.name='updated_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.suppliers DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='suppliers' AND c.name='updated_at')
    ALTER TABLE dbo.suppliers ADD CONSTRAINT DF_suppliers_updated_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR updated_at;
GO

-- ---- dbo.product_master ----
DECLARE @sql NVARCHAR(MAX); DECLARE @cn NVARCHAR(256);
SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='product_master' AND c.name='created_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.product_master DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='product_master' AND c.name='created_at')
    ALTER TABLE dbo.product_master ADD CONSTRAINT DF_product_master_created_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR created_at;

SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='product_master' AND c.name='updated_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.product_master DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='product_master' AND c.name='updated_at')
    ALTER TABLE dbo.product_master ADD CONSTRAINT DF_product_master_updated_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR updated_at;
GO

-- ---- dbo.purchases ----
DECLARE @sql NVARCHAR(MAX); DECLARE @cn NVARCHAR(256);
SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='purchases' AND c.name='purchase_date';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.purchases DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='purchases' AND c.name='purchase_date')
    ALTER TABLE dbo.purchases ADD CONSTRAINT DF_purchases_purchase_date DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR purchase_date;

SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='purchases' AND c.name='created_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.purchases DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='purchases' AND c.name='created_at')
    ALTER TABLE dbo.purchases ADD CONSTRAINT DF_purchases_created_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR created_at;

SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='purchases' AND c.name='updated_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.purchases DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='purchases' AND c.name='updated_at')
    ALTER TABLE dbo.purchases ADD CONSTRAINT DF_purchases_updated_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR updated_at;
GO

-- ---- dbo.branding_jobs ----
DECLARE @sql NVARCHAR(MAX); DECLARE @cn NVARCHAR(256);
SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='branding_jobs' AND c.name='created_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.branding_jobs DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='branding_jobs' AND c.name='created_at')
    ALTER TABLE dbo.branding_jobs ADD CONSTRAINT DF_branding_jobs_created_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR created_at;

SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='branding_jobs' AND c.name='updated_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.branding_jobs DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='branding_jobs' AND c.name='updated_at')
    ALTER TABLE dbo.branding_jobs ADD CONSTRAINT DF_branding_jobs_updated_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR updated_at;
GO

-- ---- dbo.skus ----
DECLARE @sql NVARCHAR(MAX); DECLARE @cn NVARCHAR(256);
SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='skus' AND c.name='created_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.skus DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='skus' AND c.name='created_at')
    ALTER TABLE dbo.skus ADD CONSTRAINT DF_skus_created_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR created_at;

SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='skus' AND c.name='updated_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.skus DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='skus' AND c.name='updated_at')
    ALTER TABLE dbo.skus ADD CONSTRAINT DF_skus_updated_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR updated_at;
GO

-- ---- dbo.stock_balances ----
DECLARE @sql NVARCHAR(MAX); DECLARE @cn NVARCHAR(256);
SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='stock_balances' AND c.name='last_updated';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.stock_balances DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='stock_balances' AND c.name='last_updated')
    ALTER TABLE dbo.stock_balances ADD CONSTRAINT DF_stock_balances_last_updated DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR last_updated;
GO

-- ---- dbo.stock_movements ----
DECLARE @sql NVARCHAR(MAX); DECLARE @cn NVARCHAR(256);
SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='stock_movements' AND c.name='created_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.stock_movements DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='stock_movements' AND c.name='created_at')
    ALTER TABLE dbo.stock_movements ADD CONSTRAINT DF_stock_movements_created_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR created_at;
GO

-- ---- dbo.vendor_product_rates ----
DECLARE @sql NVARCHAR(MAX); DECLARE @cn NVARCHAR(256);
SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='vendor_product_rates' AND c.name='created_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.vendor_product_rates DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='vendor_product_rates' AND c.name='created_at')
    ALTER TABLE dbo.vendor_product_rates ADD CONSTRAINT DF_vendor_product_rates_created_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR created_at;

SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='vendor_product_rates' AND c.name='updated_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.vendor_product_rates DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='vendor_product_rates' AND c.name='updated_at')
    ALTER TABLE dbo.vendor_product_rates ADD CONSTRAINT DF_vendor_product_rates_updated_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR updated_at;
GO

-- ---- dbo.product_rate_summary ----
DECLARE @sql NVARCHAR(MAX); DECLARE @cn NVARCHAR(256);
SELECT @cn = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
    JOIN sys.tables  t ON t.object_id=dc.parent_object_id
WHERE t.name='product_rate_summary' AND c.name='updated_at';
IF @cn IS NOT NULL BEGIN SET @sql=N'ALTER TABLE dbo.product_rate_summary DROP CONSTRAINT '+QUOTENAME(@cn); EXEC sp_executesql @sql; END
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id JOIN sys.tables t ON t.object_id=dc.parent_object_id WHERE t.name='product_rate_summary' AND c.name='updated_at')
    ALTER TABLE dbo.product_rate_summary ADD CONSTRAINT DF_product_rate_summary_updated_at DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME())) FOR updated_at;
GO

PRINT 'IST default constraints applied successfully.';
