IF OBJECT_ID('dbo.sp_Auth_Login', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Auth_Login;
GO

CREATE PROCEDURE dbo.sp_Auth_Login
  @username VARCHAR(100)
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    u.user_id,
    u.username,
    u.password,
    u.full_name,
    u.email,
    u.phone,
    u.role_key,
    u.store_id,
    u.is_active,
    s.store_name
  FROM dbo.users u
  LEFT JOIN dbo.stores s ON s.store_id = u.store_id
  WHERE u.username = @username
    AND u.is_active = 1;
END;
GO

