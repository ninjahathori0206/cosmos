/*
  Maintenance: Set correct module access for the store_incharge role.

  Problem: store_incharge users with old JWTs (empty modules={}) get all modules
  active by default (legacyModuleAllowAll), causing resolveActorRole to pick
  'hq_manager' (Foundry path) instead of 'store_in_charge' for lab transitions.

  This script sets explicit opt-in rows so that sp_User_EffectiveModules returns:
    storepilot = ON
    foundry     = OFF
    command_unit= OFF
    pos         = OFF  (Store OS uses POS module only if explicitly enabled)
    All others  = OFF

  After running: affected users MUST re-login so JWT is refreshed.

  Idempotent — safe to re-run.
*/

USE [CosmosERP];
GO

DECLARE @rk VARCHAR(50) = N'store_incharge';
DECLARE @nowIst DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_key = @rk)
BEGIN
  PRINT 'Role store_incharge not found — skipped.';
  RETURN;
END;

PRINT 'Setting module access for store_incharge...';

-- Module matrix: storepilot ON, everything else OFF.
MERGE dbo.role_module_access AS t
USING (
  SELECT * FROM (VALUES
    (@rk, N'storepilot',    1),
    (@rk, N'foundry',       0),
    (@rk, N'command_unit',  0),
    (@rk, N'finance',       0),
    (@rk, N'cx',            0),
    (@rk, N'army',          0),
    (@rk, N'eyewoot_go',    0),
    (@rk, N'promoter',      0)
  ) AS s(role_key, module_key, is_enabled)
) AS src
ON t.role_key = src.role_key AND t.module_key = src.module_key
WHEN MATCHED THEN
  UPDATE SET is_enabled = src.is_enabled, updated_at = @nowIst
WHEN NOT MATCHED BY TARGET THEN
  INSERT (role_key, module_key, is_enabled, created_at, updated_at)
  VALUES (src.role_key, src.module_key, src.is_enabled, @nowIst, @nowIst);

-- pos row: leave it as-is if exists, insert OFF if missing.
-- Enable pos = 1 here only if Store OS tablet login is used by store_incharge.
-- Default: OFF (Store OS uses a separate pos session JWT).
MERGE dbo.role_module_access AS t
USING (SELECT @rk AS role_key, N'pos' AS module_key) AS s
ON t.role_key = s.role_key AND t.module_key = s.module_key
WHEN NOT MATCHED THEN
  INSERT (role_key, module_key, is_enabled, created_at, updated_at)
  VALUES (s.role_key, s.module_key, 0, @nowIst, @nowIst);

PRINT 'store_incharge module access set: storepilot=ON, foundry/CU/finance/cx=OFF.';
PRINT 'IMPORTANT: Affected users must re-login so their JWT modules are refreshed.';
GO
