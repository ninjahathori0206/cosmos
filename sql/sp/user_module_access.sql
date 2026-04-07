USE [CosmosERP];
GO

-- ─────────────────────────────────────────────────────────────────
-- sp_UserModuleAccess_GetByUser  — all module access rows for a user
-- ─────────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.sp_UserModuleAccess_GetByUser', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_UserModuleAccess_GetByUser;
GO

CREATE PROCEDURE dbo.sp_UserModuleAccess_GetByUser
  @user_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, user_id, module_key, is_enabled, created_at, updated_at
  FROM dbo.user_module_access
  WHERE user_id = @user_id
  ORDER BY module_key;
END;
GO

-- ─────────────────────────────────────────────────────────────────
-- sp_UserModuleAccess_Toggle  — upsert a single module flag for a user
-- ─────────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.sp_UserModuleAccess_Toggle', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_UserModuleAccess_Toggle;
GO

CREATE PROCEDURE dbo.sp_UserModuleAccess_Toggle
  @user_id    INT,
  @module_key VARCHAR(50),
  @is_enabled BIT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE user_id = @user_id)
    BEGIN
      RAISERROR('User not found.', 16, 1);
      RETURN;
    END;

    IF EXISTS (
      SELECT 1 FROM dbo.user_module_access
      WHERE user_id = @user_id AND module_key = @module_key
    )
    BEGIN
      UPDATE dbo.user_module_access
      SET is_enabled = @is_enabled, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      WHERE user_id = @user_id AND module_key = @module_key;
    END
    ELSE
    BEGIN
      INSERT INTO dbo.user_module_access (user_id, module_key, is_enabled, created_at, updated_at)
      VALUES (@user_id, @module_key, @is_enabled, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()));
    END;

    SELECT id, user_id, module_key, is_enabled, created_at, updated_at
    FROM dbo.user_module_access
    WHERE user_id = @user_id AND module_key = @module_key;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO
