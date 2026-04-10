/*
  Migration: merge role hq-manager (hyphen) into hq_manager (underscore).

  Background
  -----------
  An earlier Command Unit session created the role with key 'hq-manager' (hyphen)
  because the "New Role" form did not normalize hyphens to underscores at that time.
  All seed SQL, documentation, and verify scripts target 'hq_manager' (underscore).
  These are two separate rows in dbo.roles / dbo.role_permissions / dbo.role_module_access,
  so any permissions saved for 'hq-manager' have no effect on 'hq_manager' and vice versa.

  What this script does (idempotent — safe to re-run)
  ----------------------------------------------------
  1. Verifies both role keys exist before acting.
  2. Copies role_permissions from 'hq-manager' to 'hq_manager' (skips duplicates).
  3. Upserts role_module_access rows from 'hq-manager' into 'hq_manager'.
  4. Re-assigns dbo.users rows whose role_key = 'hq-manager' to 'hq_manager'.
  5. Deletes role_module_access, role_permissions, and roles row for 'hq-manager'.
  6. Prints progress at every step.

  Prerequisites
  -------------
  - 'hq_manager' (underscore) must already exist in dbo.roles.
  - Run sql/seed/02_hq_manager_foundry_view.sql AFTER this migration to ensure
    'hq_manager' has the correct Foundry permissions.
  - Users must log out and log back in for their JWT to reflect the new role.

  Run via sqlcmd:
    sqlcmd -S <host>,<port> -U <user> -P <password> -d CosmosERP -i sql/maintenance/migrate_hq_manager_role_key.sql
*/
PRINT 'Starting hq-manager → hq_manager migration...';

USE [CosmosERP];
GO

DECLARE @old VARCHAR(50) = N'hq-manager';
DECLARE @new VARCHAR(50) = N'hq_manager';

-- ── Step 0: Safety checks ──────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_key = @old)
BEGIN
  PRINT 'Source role hq-manager not found — nothing to migrate. Script complete.';
  GOTO Done;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_key = @new)
BEGIN
  PRINT 'WARNING: Target role hq_manager does not exist.';
  PRINT 'Create it via Command Unit → Roles → Add Role, then re-run this script.';
  GOTO Done;
END;

PRINT 'Both role keys found. Proceeding with migration...';

-- ── Step 1: Merge role_permissions ────────────────────────────────────────
DECLARE @permCopied INT = 0;
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT @new, p.permission, DATEADD(MINUTE, 330, SYSUTCDATETIME())
FROM dbo.role_permissions p
WHERE p.role_key = @old
  AND NOT EXISTS (
    SELECT 1 FROM dbo.role_permissions x
    WHERE x.role_key = @new AND x.permission = p.permission
  );
SET @permCopied = @@ROWCOUNT;
PRINT 'Permissions copied to hq_manager: ' + CAST(@permCopied AS VARCHAR) + ' row(s).';

-- ── Step 2: Merge role_module_access ──────────────────────────────────────
DECLARE @modUpserted INT = 0;
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
SET @modUpserted = @@ROWCOUNT;
PRINT 'Module access rows upserted for hq_manager: ' + CAST(@modUpserted AS VARCHAR) + ' row(s).';

-- ── Step 3: Re-assign users ───────────────────────────────────────────────
DECLARE @usersReassigned INT = 0;
UPDATE dbo.users
SET role_key = @new, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
WHERE role_key = @old;
SET @usersReassigned = @@ROWCOUNT;
PRINT 'Users re-assigned from hq-manager to hq_manager: ' + CAST(@usersReassigned AS VARCHAR) + ' user(s).';

-- ── Step 4: Delete hq-manager data ────────────────────────────────────────
DELETE FROM dbo.role_module_access WHERE role_key = @old;
PRINT 'Deleted role_module_access rows for hq-manager: ' + CAST(@@ROWCOUNT AS VARCHAR) + '.';

DELETE FROM dbo.role_permissions WHERE role_key = @old;
PRINT 'Deleted role_permissions rows for hq-manager: ' + CAST(@@ROWCOUNT AS VARCHAR) + '.';

DELETE FROM dbo.roles WHERE role_key = @old;
PRINT 'Deleted roles row for hq-manager: ' + CAST(@@ROWCOUNT AS VARCHAR) + '.';

-- ── Summary ───────────────────────────────────────────────────────────────
PRINT '';
PRINT '=== Migration complete ===';
PRINT 'Permissions copied  : ' + CAST(@permCopied AS VARCHAR);
PRINT 'Module rows upserted: ' + CAST(@modUpserted AS VARCHAR);
PRINT 'Users re-assigned   : ' + CAST(@usersReassigned AS VARCHAR);
PRINT '';
PRINT 'NEXT STEPS:';
PRINT '  1. Run sql/seed/02_hq_manager_foundry_view.sql to ensure hq_manager has the correct Foundry permissions.';
PRINT '  2. Ask affected users (e.g. Lukan) to sign out and sign back in to get a fresh JWT.';
PRINT '  3. Run sql/maintenance/verify_hq_manager_foundry_access.sql to confirm the final state.';

Done:
GO
