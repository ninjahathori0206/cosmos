USE [CosmosERP];
GO

IF OBJECT_ID('dbo.sp_Role_GetAll', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Role_GetAll;
GO

CREATE PROCEDURE dbo.sp_Role_GetAll
AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    r.role_key, r.display_name, r.hierarchy_lvl, r.is_global, r.created_at, r.updated_at
  FROM dbo.roles r
  ORDER BY r.hierarchy_lvl, r.role_key;
END;
GO

IF OBJECT_ID('dbo.sp_Role_Create', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Role_Create;
GO

CREATE PROCEDURE dbo.sp_Role_Create
  @role_key      VARCHAR(50),
  @display_name  VARCHAR(200),
  @hierarchy_lvl INT,
  @is_global     BIT = 0
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF EXISTS (SELECT 1 FROM dbo.roles WHERE role_key = @role_key)
    BEGIN
      RAISERROR('Role key already exists.', 16, 1);
      RETURN;
    END;

    INSERT INTO dbo.roles (role_key, display_name, hierarchy_lvl, is_global, created_at, updated_at)
    VALUES (@role_key, @display_name, @hierarchy_lvl, ISNULL(@is_global, 0), GETDATE(), GETDATE());

    SELECT role_key, display_name, hierarchy_lvl, is_global, created_at, updated_at
    FROM dbo.roles WHERE role_key = @role_key;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_Role_Update', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Role_Update;
GO

CREATE PROCEDURE dbo.sp_Role_Update
  @role_key      VARCHAR(50),
  @display_name  VARCHAR(200),
  @hierarchy_lvl INT,
  @is_global     BIT = 0
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    UPDATE dbo.roles
    SET display_name = @display_name,
        hierarchy_lvl = @hierarchy_lvl,
        is_global = ISNULL(@is_global, 0),
        updated_at = GETDATE()
    WHERE role_key = @role_key;

    SELECT role_key, display_name, hierarchy_lvl, is_global, created_at, updated_at
    FROM dbo.roles WHERE role_key = @role_key;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_Role_Delete', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Role_Delete;
GO

CREATE PROCEDURE dbo.sp_Role_Delete
  @role_key VARCHAR(50)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF EXISTS (SELECT 1 FROM dbo.users WHERE role_key = @role_key)
    BEGIN
      RAISERROR('Cannot delete role — users are assigned to it.', 16, 1);
      RETURN;
    END;
    DELETE FROM dbo.role_permissions WHERE role_key = @role_key;
    DELETE FROM dbo.roles WHERE role_key = @role_key;
    SELECT @role_key AS deleted_role_key;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO

-- ─────────────────────────────────────────────────────────────────
-- sp_Role_GetPermissions  — get all permission strings for a role
-- ─────────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.sp_Role_GetPermissions', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Role_GetPermissions;
GO

CREATE PROCEDURE dbo.sp_Role_GetPermissions
  @role_key VARCHAR(50)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, role_key, permission, created_at
  FROM dbo.role_permissions
  WHERE role_key = @role_key
  ORDER BY permission;
END;
GO

-- ─────────────────────────────────────────────────────────────────
-- sp_Role_ClearPermissions  — delete all permissions for a role
-- ─────────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.sp_Role_ClearPermissions', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Role_ClearPermissions;
GO

CREATE PROCEDURE dbo.sp_Role_ClearPermissions
  @role_key VARCHAR(50)
AS
BEGIN
  SET NOCOUNT ON;
  DELETE FROM dbo.role_permissions WHERE role_key = @role_key;
  SELECT @@ROWCOUNT AS deleted_count;
END;
GO

-- ─────────────────────────────────────────────────────────────────
-- sp_Role_AddPermission  — insert one permission for a role
-- ─────────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.sp_Role_AddPermission', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Role_AddPermission;
GO

CREATE PROCEDURE dbo.sp_Role_AddPermission
  @role_key   VARCHAR(50),
  @permission VARCHAR(200)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_key = @role_key)
    BEGIN
      RAISERROR('Role not found.', 16, 1);
      RETURN;
    END;
    IF NOT EXISTS (
      SELECT 1 FROM dbo.role_permissions
      WHERE role_key = @role_key AND permission = @permission
    )
    BEGIN
      INSERT INTO dbo.role_permissions (role_key, permission, created_at)
      VALUES (@role_key, @permission, GETDATE());
    END;
    SELECT id, role_key, permission, created_at
    FROM dbo.role_permissions
    WHERE role_key = @role_key AND permission = @permission;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO
