/*
  Fix: Activate opt-in module policy for hq_manager role.

  Problem
  -------
  sp_User_EffectiveModules uses opt-in logic: if a role has ZERO rows in
  dbo.role_module_access, ALL modules default to ON (legacy fallback).
  Because hq_manager has no rows in that table, every module — including
  command_unit, finance, storepilot, and all of foundry — is effectively
  ON for any hq_manager user regardless of what the Roles UI shows.

  This script inserts the correct module matrix rows so that:
    - foundry        → ON  (hq_manager should access Foundry only)
    - command_unit   → OFF
    - finance        → OFF
    - storepilot     → OFF

  Once at least one row exists for the role, the SP treats missing modules
  as OFF (opt-in), which is the intended secure behaviour.

  Idempotent — safe to re-run. Uses MERGE so existing rows are updated.

  Prerequisites
  -------------
  - dbo.role_module_access must exist (created by the schema migration).
  - hq_manager role must exist in dbo.roles.
  - Run sql/maintenance/verify_hq_manager_foundry_access.sql after this
    to confirm the matrix is correct.
  - Affected users (e.g. Lukman) must sign out and sign back in for their
    JWT to reflect the new module map.

  Run via sqlcmd:
    sqlcmd -S <host>,<port> -U <user> -P <password> -d CosmosERP \
      -i sql/maintenance/set_hq_manager_module_access.sql
*/
USE [CosmosERP];
GO

DECLARE @rk VARCHAR(50) = N'hq_manager';

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_key = @rk)
BEGIN
  PRINT 'Role hq_manager not found — skipped. Create the role first via Command Unit.';
  GOTO Done;
END;

-- Declare the intended module matrix for hq_manager
DECLARE @matrix TABLE (module_key VARCHAR(100), is_enabled BIT);
INSERT INTO @matrix (module_key, is_enabled) VALUES
  (N'foundry',      1),   -- HQ Manager works inside Foundry
  (N'command_unit', 0),   -- Admin-only
  (N'finance',      0),   -- Finance team only
  (N'storepilot',   0);   -- Store staff only

-- Upsert rows — insert new, update existing
MERGE dbo.role_module_access AS t
USING @matrix AS s ON t.role_key = @rk AND t.module_key = s.module_key
WHEN MATCHED THEN
  UPDATE SET
    is_enabled = s.is_enabled,
    updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
WHEN NOT MATCHED THEN
  INSERT (role_key, module_key, is_enabled, created_at, updated_at)
  VALUES (
    @rk,
    s.module_key,
    s.is_enabled,
    DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    DATEADD(MINUTE, 330, SYSUTCDATETIME())
  );

PRINT 'hq_manager module access matrix set: foundry=ON, command_unit=OFF, finance=OFF, storepilot=OFF.';
PRINT '';
PRINT 'NEXT STEPS:';
PRINT '  1. Run sql/maintenance/verify_hq_manager_foundry_access.sql to confirm (check result set 3).';
PRINT '  2. Ask affected users (e.g. Lukman) to sign out and sign back in for a fresh JWT.';

Done:
GO
