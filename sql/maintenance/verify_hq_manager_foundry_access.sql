/*
  Diagnostic: HQ Manager / Foundry access (permissions, module matrix, user assignment).
  Run in SSMS or sqlcmd against CosmosERP after permission changes.
  Reminder: users must log in again for JWT to pick up new role_permissions.

  If the 'hq-manager' (hyphen) row appears in check 0 below, run:
    sql/maintenance/migrate_hq_manager_role_key.sql
  to merge it into 'hq_manager' (underscore) and re-assign users before relying
  on permissions set via Command Unit.
*/
USE [CosmosERP];
GO

DECLARE @username NVARCHAR(100) = N'Lukan'; -- optional: set to target login, or NULL to skip user block

-- 0) Hyphen-variant check — should return 0 rows after migration
SELECT role_key, display_name,
  CASE WHEN role_key = N'hq-manager' THEN 'WARNING: hyphen variant — run migrate_hq_manager_role_key.sql' ELSE 'OK' END AS status
FROM dbo.roles
WHERE role_key IN (N'hq_manager', N'hq-manager');

-- 1) Role exists (underscore variant)
SELECT role_key, display_name FROM dbo.roles WHERE role_key = N'hq_manager';

-- 2) Permissions expected for HQ Manager procurement (no create unless you intend it)
SELECT permission, created_at
FROM dbo.role_permissions
WHERE role_key = N'hq_manager'
ORDER BY permission;

-- 3) Module access — if ANY row exists for the role, missing modules default OFF (opt-in)
--    Expected after set_hq_manager_module_access.sql: foundry=1, others=0
--    WARNING: 0 rows here means ALL modules default ON (legacy fallback — run set_hq_manager_module_access.sql)
SELECT role_key, module_key, is_enabled, updated_at,
  CASE
    WHEN module_key = 'foundry'      AND is_enabled = 1 THEN 'OK — foundry ON'
    WHEN module_key = 'foundry'      AND is_enabled = 0 THEN 'WARNING: foundry is OFF'
    WHEN module_key != 'foundry'     AND is_enabled = 0 THEN 'OK — restricted'
    WHEN module_key != 'foundry'     AND is_enabled = 1 THEN 'WARNING: non-foundry module enabled'
    ELSE '?'
  END AS check_status
FROM dbo.role_module_access
WHERE role_key = N'hq_manager'
ORDER BY module_key;

-- 3b) Summary: warn if no rows at all (legacy open-access state)
SELECT
  COUNT(*) AS module_row_count,
  CASE WHEN COUNT(*) = 0
    THEN 'WARNING: No rows — all modules default ON. Run sql/maintenance/set_hq_manager_module_access.sql'
    ELSE 'OK — opt-in policy active (' + CAST(COUNT(*) AS VARCHAR) + ' rows)'
  END AS policy_status
FROM dbo.role_module_access
WHERE role_key = N'hq_manager';

-- 4) User assignment (replace @username or ignore if NULL)
IF @username IS NOT NULL AND LTRIM(RTRIM(@username)) <> N''
BEGIN
  SELECT u.user_id, u.username, u.full_name, u.role_key, u.store_id, s.store_code, s.store_name
  FROM dbo.users u
  LEFT JOIN dbo.stores s ON s.store_id = u.store_id
  WHERE u.username = @username OR u.full_name LIKE N'%' + @username + N'%';
END;

-- 5) Store-level module flags for the user’s store (when present)
IF @username IS NOT NULL AND LTRIM(RTRIM(@username)) <> N''
BEGIN
  DECLARE @sid INT = (SELECT TOP 1 store_id FROM dbo.users WHERE username = @username OR full_name LIKE N'%' + @username + N'%');
  IF @sid IS NOT NULL
    SELECT store_id, module_key, is_enabled, updated_at
    FROM dbo.store_module_access
    WHERE store_id = @sid
    ORDER BY module_key;
END;

GO
