USE [CosmosERP];
GO

IF OBJECT_ID('dbo.sp_User_GetAll', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_User_GetAll;
GO

CREATE PROCEDURE dbo.sp_User_GetAll
AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    u.user_id,
    u.username,
    u.full_name,
    u.email,
    u.phone,
    u.role_key,
    r.display_name AS role_display,
    u.store_id,
    s.store_name,
    u.is_active,
    u.last_login,
    u.created_at,
    u.updated_at
  FROM dbo.users u
  LEFT JOIN dbo.roles r ON r.role_key = u.role_key
  LEFT JOIN dbo.stores s ON s.store_id = u.store_id
  ORDER BY u.created_at DESC;
END;
GO

IF OBJECT_ID('dbo.sp_User_GetById', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_User_GetById;
GO

CREATE PROCEDURE dbo.sp_User_GetById
  @user_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    u.user_id,
    u.username,
    u.full_name,
    u.email,
    u.phone,
    u.role_key,
    r.display_name AS role_display,
    u.store_id,
    s.store_name,
    u.is_active,
    u.last_login,
    u.created_at,
    u.updated_at
  FROM dbo.users u
  LEFT JOIN dbo.roles r ON r.role_key = u.role_key
  LEFT JOIN dbo.stores s ON s.store_id = u.store_id
  WHERE u.user_id = @user_id;
END;
GO

IF OBJECT_ID('dbo.sp_User_Create', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_User_Create;
GO

CREATE PROCEDURE dbo.sp_User_Create
  @username  VARCHAR(100),
  @password  VARCHAR(200),
  @full_name VARCHAR(200),
  @email     VARCHAR(200) = NULL,
  @phone     VARCHAR(20)  = NULL,
  @role_key  VARCHAR(50),
  @store_id  INT          = NULL,
  @is_active BIT          = 1
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF EXISTS (SELECT 1 FROM dbo.users WHERE username = @username)
    BEGIN
      RAISERROR('Username already exists.', 16, 1);
      RETURN;
    END;

    INSERT INTO dbo.users (username, password, full_name, email, phone, role_key, store_id, is_active, created_at, updated_at)
    VALUES (@username, @password, @full_name, @email, @phone, @role_key, @store_id, ISNULL(@is_active, 1), GETDATE(), GETDATE());

    DECLARE @new_id INT = SCOPE_IDENTITY();

    SELECT
      u.user_id, u.username, u.full_name, u.email, u.phone, u.role_key,
      r.display_name AS role_display,
      u.store_id, s.store_name, u.is_active, u.created_at, u.updated_at
    FROM dbo.users u
    LEFT JOIN dbo.roles r ON r.role_key = u.role_key
    LEFT JOIN dbo.stores s ON s.store_id = u.store_id
    WHERE u.user_id = @new_id;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_User_Update', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_User_Update;
GO

CREATE PROCEDURE dbo.sp_User_Update
  @user_id   INT,
  @full_name VARCHAR(200),
  @email     VARCHAR(200) = NULL,
  @phone     VARCHAR(20)  = NULL,
  @role_key  VARCHAR(50),
  @store_id  INT          = NULL,
  @is_active BIT          = 1,
  @password  VARCHAR(200) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    UPDATE dbo.users
    SET
      full_name  = @full_name,
      email      = @email,
      phone      = @phone,
      role_key   = @role_key,
      store_id   = @store_id,
      is_active  = ISNULL(@is_active, 1),
      password   = CASE WHEN @password IS NOT NULL AND LEN(@password) > 0 THEN @password ELSE password END,
      updated_at = GETDATE()
    WHERE user_id = @user_id;

    SELECT
      u.user_id, u.username, u.full_name, u.email, u.phone, u.role_key,
      r.display_name AS role_display,
      u.store_id, s.store_name, u.is_active, u.created_at, u.updated_at
    FROM dbo.users u
    LEFT JOIN dbo.roles r ON r.role_key = u.role_key
    LEFT JOIN dbo.stores s ON s.store_id = u.store_id
    WHERE u.user_id = @user_id;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_User_Deactivate', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_User_Deactivate;
GO

CREATE PROCEDURE dbo.sp_User_Deactivate
  @user_id INT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    UPDATE dbo.users
    SET is_active = 0, updated_at = GETDATE()
    WHERE user_id = @user_id;

    SELECT
      u.user_id, u.username, u.full_name, u.email, u.phone, u.role_key,
      u.is_active, u.updated_at
    FROM dbo.users u
    WHERE u.user_id = @user_id;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO
