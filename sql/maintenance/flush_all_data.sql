/*
  Cosmos ERP - FULL DATA FLUSH (DESTRUCTIVE)

  WARNING:
  - This script deletes ALL rows from ALL user tables in the target database.
  - Schema, stored procedures, and constraints are kept.
  - Run only with an elevated SQL login (sa or migration admin), not app user.
  - Take a full database backup before running.

  Recommended post-flush order:
    1) sql/alter/05_foundry_lookup_values.sql
    2) sql/seed/01_seed_core.sql

  Example:
    sqlcmd -S <host>,<port> -U <admin_user> -P <password> -d CosmosERP -i sql/maintenance/flush_all_data.sql
*/

USE [CosmosERP];
GO

SET NOCOUNT ON;
PRINT 'Starting data flush for database: ' + DB_NAME();

DECLARE @sql NVARCHAR(MAX) = N'';

/* 1) Disable constraints on all user tables */
SELECT @sql = STRING_AGG(
  N'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name) + N' NOCHECK CONSTRAINT ALL;',
  CHAR(10)
)
FROM sys.tables t
WHERE t.is_ms_shipped = 0;

IF @sql IS NOT NULL AND LEN(@sql) > 0
BEGIN
  PRINT 'Disabling constraints...';
  EXEC sp_executesql @sql;
END;

/* 2) Delete all data from all user tables */
SET @sql = N'';
SELECT @sql = STRING_AGG(
  N'DELETE FROM ' + QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name) + N';',
  CHAR(10)
)
FROM sys.tables t
WHERE t.is_ms_shipped = 0;

IF @sql IS NOT NULL AND LEN(@sql) > 0
BEGIN
  PRINT 'Deleting rows from all user tables...';
  EXEC sp_executesql @sql;
END;

/* 3) Reseed all identity tables so next insert starts from 1 */
SET @sql = N'';
SELECT @sql = STRING_AGG(
  N'DBCC CHECKIDENT (''' + QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name) + N''', RESEED, 0) WITH NO_INFOMSGS;',
  CHAR(10)
)
FROM sys.tables t
INNER JOIN sys.identity_columns ic ON ic.object_id = t.object_id
WHERE t.is_ms_shipped = 0;

IF @sql IS NOT NULL AND LEN(@sql) > 0
BEGIN
  PRINT 'Reseeding identity tables...';
  EXEC sp_executesql @sql;
END;

/* 4) Re-enable and validate constraints on all user tables */
SET @sql = N'';
SELECT @sql = STRING_AGG(
  N'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name) + N' WITH CHECK CHECK CONSTRAINT ALL;',
  CHAR(10)
)
FROM sys.tables t
WHERE t.is_ms_shipped = 0;

IF @sql IS NOT NULL AND LEN(@sql) > 0
BEGIN
  PRINT 'Re-enabling constraints...';
  EXEC sp_executesql @sql;
END;

PRINT 'Flush completed successfully.';
GO
