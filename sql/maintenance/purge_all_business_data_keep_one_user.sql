/*
 * DESTRUCTIVE — Full business data wipe (dev / reset)
 *
 * Deletes ALL rows from every dbo base table except:
 *   - dbo.roles
 *   - dbo.role_permissions
 *   - dbo.role_module_access
 *   - dbo.store_type_catalog + dbo.store_type_catalog_roles (reference data)
 *
 * Keeps exactly ONE user:
 *   1) Match dbo.users.username (case-insensitive) to @KeepUsername below, OR
 *   2) If not found, first user where full_name LIKE N'%Talha%'
 *
 * After delete: clears store_id on the kept user (all stores removed).
 *
 * Backup the database first. Run: node scripts/run-maintenance-purge-keep-user.js
 */
USE [CosmosERP];
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @KeepUsername NVARCHAR(100) = N'talha';
DECLARE @KeepUserId INT = NULL;

SELECT @KeepUserId = u.user_id
FROM dbo.users AS u
WHERE LOWER(LTRIM(RTRIM(u.username))) = LOWER(LTRIM(RTRIM(@KeepUsername)));

IF @KeepUserId IS NULL
BEGIN
  SELECT TOP (1) @KeepUserId = u.user_id
  FROM dbo.users AS u
  WHERE u.full_name LIKE N'%Talha%'
  ORDER BY u.user_id ASC;
END;

IF @KeepUserId IS NULL
BEGIN
  RAISERROR(
    N'purge: No keeper user — set @KeepUsername to your Cosmos login, or ensure full_name contains Talha.',
    16,
    1
  );
  RETURN;
END;

PRINT N'purge: keeping user_id = ' + CAST(@KeepUserId AS NVARCHAR(20));

/* ─── Disable all FK checks on dbo tables (one ALTER per table) ─── */
DECLARE @disable NVARCHAR(MAX) = N'';

SELECT @disable =
  @disable
  + N'ALTER TABLE '
  + QUOTENAME(SCHEMA_NAME(t.schema_id))
  + N'.'
  + QUOTENAME(t.name)
  + N' NOCHECK CONSTRAINT ALL;'
  + CHAR(10)
FROM sys.tables AS t
WHERE t.schema_id = SCHEMA_ID(N'dbo')
  AND t.is_ms_shipped = 0;

EXEC sys.sp_executesql @disable;

/* ─── Delete every dbo table except RBAC catalogue; partial delete on users ─── */
DECLARE @schema sysname;
DECLARE @tname sysname;
DECLARE @dyn NVARCHAR(4000);

DECLARE tcur CURSOR LOCAL FAST_FORWARD FOR
SELECT s.name,
       t.name
FROM sys.tables AS t
INNER JOIN sys.schemas AS s ON t.schema_id = s.schema_id
WHERE s.name = N'dbo'
  AND t.is_ms_shipped = 0
  AND t.name NOT IN (
    N'roles',
    N'role_permissions',
    N'role_module_access',
    N'store_type_catalog',
    N'store_type_catalog_roles'
  )
ORDER BY t.name;

OPEN tcur;
FETCH NEXT FROM tcur INTO @schema, @tname;

WHILE @@FETCH_STATUS = 0
BEGIN
  SET @dyn =
    CASE
      WHEN @tname = N'users' THEN
        N'DELETE FROM '
        + QUOTENAME(@schema)
        + N'.'
        + QUOTENAME(@tname)
        + N' WHERE user_id <> '
        + CAST(@KeepUserId AS NVARCHAR(20))
        + N';'
      ELSE
        N'DELETE FROM ' + QUOTENAME(@schema) + N'.' + QUOTENAME(@tname) + N';'
    END;

  EXEC sys.sp_executesql @dyn;

  FETCH NEXT FROM tcur INTO @schema, @tname;
END;

CLOSE tcur;
DEALLOCATE tcur;

UPDATE dbo.users
SET
  store_id = NULL,
  updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
WHERE user_id = @KeepUserId;

/* ─── Re-enable and validate all FKs on dbo tables ─── */
DECLARE @enable NVARCHAR(MAX) = N'';

SELECT @enable =
  @enable
  + N'ALTER TABLE '
  + QUOTENAME(SCHEMA_NAME(t.schema_id))
  + N'.'
  + QUOTENAME(t.name)
  + N' WITH CHECK CHECK CONSTRAINT ALL;'
  + CHAR(10)
FROM sys.tables AS t
WHERE t.schema_id = SCHEMA_ID(N'dbo')
  AND t.is_ms_shipped = 0;

EXEC sys.sp_executesql @enable;

PRINT N'purge: finished — only RBAC tables + one user remain; all stores and business rows removed.';
GO
