USE [CosmosERP];
GO

IF OBJECT_ID('dbo.sp_StoreModuleAccess_GetByStore', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_StoreModuleAccess_GetByStore;
GO

CREATE PROCEDURE dbo.sp_StoreModuleAccess_GetByStore
  @store_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, store_id, module_key, is_enabled, created_at, updated_at
  FROM dbo.store_module_access
  WHERE store_id = @store_id
  ORDER BY module_key;
END;
GO

IF OBJECT_ID('dbo.sp_StoreModuleAccess_Toggle', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_StoreModuleAccess_Toggle;
GO

CREATE PROCEDURE dbo.sp_StoreModuleAccess_Toggle
  @store_id   INT,
  @module_key VARCHAR(50),
  @is_enabled BIT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF EXISTS (SELECT 1 FROM dbo.store_module_access WHERE store_id = @store_id AND module_key = @module_key)
    BEGIN
      UPDATE dbo.store_module_access
      SET is_enabled = @is_enabled, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      WHERE store_id = @store_id AND module_key = @module_key;
    END
    ELSE
    BEGIN
      INSERT INTO dbo.store_module_access (store_id, module_key, is_enabled, created_at, updated_at)
      VALUES (@store_id, @module_key, @is_enabled, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()));
    END;

    SELECT id, store_id, module_key, is_enabled, updated_at
    FROM dbo.store_module_access
    WHERE store_id = @store_id AND module_key = @module_key;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO
