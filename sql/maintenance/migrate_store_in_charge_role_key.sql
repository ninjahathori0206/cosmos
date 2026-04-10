/*
  Migration: merge legacy role_key store_in_charge into store_incharge.

  Background
  ----------
  Some databases used store_in_charge (extra underscore) while application code and
  seeds use store_incharge. That splits role_permissions and breaks isDesignatedStoreRole-style checks.

  What this script does (idempotent — safe to re-run)
  ----------------------------------------------------
  1. If only @old exists: rename role row to @new (if @new does not exist).
  2. If both exist: merge permissions/modules from @old into @new, reassign users, delete @old.
  3. Prints progress.

  After running: affected users must log in again for JWT to pick up role_key.

  Run:
    sqlcmd -S <host> -d CosmosERP -i sql/maintenance/migrate_store_in_charge_role_key.sql
*/
PRINT 'Starting store_in_charge → store_incharge migration...';

USE [CosmosERP];
GO

DECLARE @old VARCHAR(50) = N'store_in_charge';
DECLARE @new VARCHAR(50) = N'store_incharge';

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_key = @old)
BEGIN
  PRINT 'Source role store_in_charge not found — nothing to migrate. Script complete.';
  GOTO Done;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_key = @new)
BEGIN
  PRINT 'Target store_incharge missing — cloning role row then reassigning users.';
  INSERT INTO dbo.roles (role_key, display_name, hierarchy_lvl, is_global, created_at, updated_at)
  SELECT @new, display_name, hierarchy_lvl, is_global,
         DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME())
  FROM dbo.roles WHERE role_key = @old;
  INSERT INTO dbo.role_permissions (role_key, permission, created_at)
  SELECT @new, permission, DATEADD(MINUTE, 330, SYSUTCDATETIME())
  FROM dbo.role_permissions WHERE role_key = @old;
  INSERT INTO dbo.role_module_access (role_key, module_key, is_enabled, created_at, updated_at)
  SELECT @new, module_key, is_enabled, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME())
  FROM dbo.role_module_access WHERE role_key = @old;
  UPDATE dbo.users SET role_key = @new WHERE role_key = @old;
  DELETE FROM dbo.role_module_access WHERE role_key = @old;
  DELETE FROM dbo.role_permissions WHERE role_key = @old;
  DELETE FROM dbo.roles WHERE role_key = @old;
  PRINT 'Cloned store_incharge and removed store_in_charge.';
  GOTO Done;
END;

PRINT 'Both roles exist — merging into store_incharge...';

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT @new, p.permission, DATEADD(MINUTE, 330, SYSUTCDATETIME())
FROM dbo.role_permissions p
WHERE p.role_key = @old
  AND NOT EXISTS (
    SELECT 1 FROM dbo.role_permissions x
    WHERE x.role_key = @new AND x.permission = p.permission
  );

MERGE dbo.role_module_access AS t
USING (
  SELECT @new AS role_key, module_key, is_enabled FROM dbo.role_module_access WHERE role_key = @old
) AS s
ON t.role_key = s.role_key AND t.module_key = s.module_key
WHEN MATCHED THEN
  UPDATE SET is_enabled = s.is_enabled, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
WHEN NOT MATCHED THEN
  INSERT (role_key, module_key, is_enabled, created_at, updated_at)
  VALUES (s.role_key, s.module_key, s.is_enabled, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()));

UPDATE dbo.users SET role_key = @new WHERE role_key = @old;
PRINT 'Users reassigned: ' + CAST(@@ROWCOUNT AS VARCHAR(10));

DELETE FROM dbo.role_module_access WHERE role_key = @old;
DELETE FROM dbo.role_permissions WHERE role_key = @old;
DELETE FROM dbo.roles WHERE role_key = @old;
PRINT 'Removed legacy role store_in_charge.';

Done:
PRINT 'Migration script finished.';
GO
