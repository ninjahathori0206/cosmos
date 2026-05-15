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
    CAST(CASE WHEN u.pos_pin_hash IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS has_pos_pin,
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
    CAST(CASE WHEN u.pos_pin_hash IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS has_pos_pin,
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

    DECLARE @credCol SYSNAME =
      CASE
        WHEN COL_LENGTH(N'dbo.users', N'password_hash') IS NOT NULL THEN N'password_hash'
        ELSE N'password'
      END;
    DECLARE @ins NVARCHAR(800) =
      N'INSERT INTO dbo.users (username, ' + QUOTENAME(@credCol)
      + N', full_name, email, phone, role_key, store_id, is_active, created_at, updated_at) '
      + N'VALUES (@username, @password, @full_name, @email, @phone, @role_key, @store_id, '
      + N'ISNULL(@is_active, 1), DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()))';
    EXEC sys.sp_executesql
      @ins,
      N'@username VARCHAR(100), @password VARCHAR(200), @full_name VARCHAR(200), @email VARCHAR(200), @phone VARCHAR(20), @role_key VARCHAR(50), @store_id INT, @is_active BIT',
      @username = @username,
      @password = @password,
      @full_name = @full_name,
      @email = @email,
      @phone = @phone,
      @role_key = @role_key,
      @store_id = @store_id,
      @is_active = @is_active;

    DECLARE @new_id INT = CAST(SCOPE_IDENTITY() AS INT);

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
    DECLARE @credCol SYSNAME =
      CASE
        WHEN COL_LENGTH(N'dbo.users', N'password_hash') IS NOT NULL THEN N'password_hash'
        ELSE N'password'
      END;
    DECLARE @upd NVARCHAR(1200) =
      N'UPDATE dbo.users SET '
      + N'full_name = @full_name, email = @email, phone = @phone, role_key = @role_key, store_id = @store_id, '
      + N'is_active = ISNULL(@is_active, 1), '
      + QUOTENAME(@credCol)
      + N' = CASE WHEN @password IS NOT NULL AND LEN(@password) > 0 THEN @password ELSE '
      + QUOTENAME(@credCol)
      + N' END, '
      + N'updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()) '
      + N'WHERE user_id = @user_id';
    EXEC sys.sp_executesql
      @upd,
      N'@user_id INT, @full_name VARCHAR(200), @email VARCHAR(200), @phone VARCHAR(20), @role_key VARCHAR(50), @store_id INT, @is_active BIT, @password VARCHAR(200)',
      @user_id = @user_id,
      @full_name = @full_name,
      @email = @email,
      @phone = @phone,
      @role_key = @role_key,
      @store_id = @store_id,
      @is_active = @is_active,
      @password = @password;

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
    SET is_active = 0, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
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

-- Admin / Command Unit: set POS PIN regardless of is_active (uniqueness enforced in app layer).
IF OBJECT_ID('dbo.sp_User_SetPosPin', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_User_SetPosPin;
GO

CREATE PROCEDURE dbo.sp_User_SetPosPin
  @user_id  INT,
  @pin_hash VARCHAR(200)
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.users
  SET pos_pin_hash = @pin_hash,
      updated_at   = DATEADD(MINUTE, 330, SYSUTCDATETIME())
  WHERE user_id = @user_id;

  SELECT @@ROWCOUNT AS rows_updated;
END;
GO
