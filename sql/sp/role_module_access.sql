USE [CosmosERP];
GO

-- ─────────────────────────────────────────────────────────────────
-- sp_RoleModuleAccess_GetByRole
-- Returns all module access rows for one role.
-- Unknown modules default to enabled (no row = on) — callers handle that.
-- ─────────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.sp_RoleModuleAccess_GetByRole', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_RoleModuleAccess_GetByRole;
GO

CREATE PROCEDURE dbo.sp_RoleModuleAccess_GetByRole
  @role_key VARCHAR(50)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, role_key, module_key, is_enabled, created_at, updated_at
  FROM dbo.role_module_access
  WHERE role_key = @role_key
  ORDER BY module_key;
END;
GO

-- ─────────────────────────────────────────────────────────────────
-- sp_RoleModuleAccess_Toggle
-- Upserts a single module flag for a role.
-- ─────────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.sp_RoleModuleAccess_Toggle', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_RoleModuleAccess_Toggle;
GO

CREATE PROCEDURE dbo.sp_RoleModuleAccess_Toggle
  @role_key   VARCHAR(50),
  @module_key VARCHAR(50),
  @is_enabled BIT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF EXISTS (SELECT 1 FROM dbo.role_module_access WHERE role_key = @role_key AND module_key = @module_key)
    BEGIN
      UPDATE dbo.role_module_access
      SET is_enabled = @is_enabled, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      WHERE role_key = @role_key AND module_key = @module_key;
    END
    ELSE
    BEGIN
      INSERT INTO dbo.role_module_access (role_key, module_key, is_enabled, created_at, updated_at)
      VALUES (@role_key, @module_key, @is_enabled, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()));
    END;

    SELECT id, role_key, module_key, is_enabled, updated_at
    FROM dbo.role_module_access
    WHERE role_key = @role_key AND module_key = @module_key;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO

-- ─────────────────────────────────────────────────────────────────
-- sp_User_EffectiveModules
-- Returns the effective module access for one user:
--   effective = role_allows AND store_allows
-- Defaults:
--   - role_allows  : ON  when no row in role_module_access
--   - store_allows : ON  when no row in store_module_access OR user has no store
-- The known module list is derived from union of all rows in both tables
-- plus the hardcoded set passed via a constants approach below.
-- Callers also receive the full MODULE_LIST so they can render unknowns.
-- ─────────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.sp_User_EffectiveModules', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_User_EffectiveModules;
GO

CREATE PROCEDURE dbo.sp_User_EffectiveModules
  @user_id INT
AS
BEGIN
  SET NOCOUNT ON;

  -- Resolve user → role_key, store_id
  DECLARE @role_key  VARCHAR(50);
  DECLARE @store_id  INT;

  SELECT @role_key = role_key, @store_id = store_id
  FROM dbo.users
  WHERE user_id = @user_id;

  IF @role_key IS NULL
  BEGIN
    RAISERROR('User not found.', 16, 1);
    RETURN;
  END;

  -- Build the full known module list (all keys appearing in either table for this role/store,
  -- plus any hard-coded modules not yet stored).
  -- We use a temp table seeded with the canonical module list then left-join both access tables.

  CREATE TABLE #modules (module_key VARCHAR(50) PRIMARY KEY);
  INSERT INTO #modules VALUES
    ('command_unit'),
    ('foundry'),
    ('finance'),
    ('storepilot'),
    ('pos'),
    ('army'),
    ('eyewoot_go'),
    ('promoter');

  -- Also include any module_key rows already in role/store access tables
  -- (in case custom modules were added via direct DB inserts)
  INSERT INTO #modules (module_key)
  SELECT DISTINCT module_key FROM dbo.role_module_access WHERE role_key = @role_key
    AND module_key NOT IN (SELECT module_key FROM #modules);

  IF @store_id IS NOT NULL
  BEGIN
    INSERT INTO #modules (module_key)
    SELECT DISTINCT module_key FROM dbo.store_module_access WHERE store_id = @store_id
      AND module_key NOT IN (SELECT module_key FROM #modules);
  END;

  -- If the role has any row in role_module_access, treat missing modules as OFF (opt-in).
  -- If it has zero rows, default missing to ON (legacy roles never configured in this table).
  DECLARE @role_has_policy BIT = CASE WHEN EXISTS (
    SELECT 1 FROM dbo.role_module_access WHERE role_key = @role_key
  ) THEN 1 ELSE 0 END;

  -- Compute effective: role_allows AND store_allows
  SELECT
    m.module_key,
    ISNULL(r.is_enabled, CASE WHEN @role_has_policy = 1 THEN 0 ELSE 1 END) AS role_allows,
    CASE
      WHEN @store_id IS NULL THEN 1
      ELSE ISNULL(s.is_enabled, 1)
    END                                                        AS store_allows,
    CASE
      WHEN ISNULL(r.is_enabled, CASE WHEN @role_has_policy = 1 THEN 0 ELSE 1 END) = 1
       AND (
         @store_id IS NULL
         OR ISNULL(s.is_enabled, 1) = 1
       )
      THEN 1
      ELSE 0
    END                                                        AS is_effective
  FROM #modules m
  LEFT JOIN dbo.role_module_access  r ON r.role_key  = @role_key  AND r.module_key = m.module_key
  LEFT JOIN dbo.store_module_access s ON s.store_id  = @store_id  AND s.module_key = m.module_key
  ORDER BY m.module_key;

  DROP TABLE #modules;
END;
GO
