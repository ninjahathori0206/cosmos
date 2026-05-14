IF OBJECT_ID('dbo.sp_Auth_Login', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Auth_Login;
GO

CREATE PROCEDURE dbo.sp_Auth_Login
  @username VARCHAR(100),
  @password VARCHAR(200)
AS
BEGIN
  SET NOCOUNT ON;
  /* Node / bcrypt expect column password_hash; legacy DBs may only have password. */
  DECLARE @pwdSel NVARCHAR(120) =
    CASE
      WHEN COL_LENGTH(N'dbo.users', N'password_hash') IS NOT NULL THEN N'u.password_hash'
      ELSE N'u.password AS password_hash'
    END;
  DECLARE @sql NVARCHAR(900) =
    N'SELECT u.user_id, u.username, '
    + @pwdSel
    + N', u.full_name, u.email, u.phone, u.role_key, u.store_id, u.is_active, s.store_name '
    + N'FROM dbo.users u '
    + N'LEFT JOIN dbo.stores s ON s.store_id = u.store_id '
    + N'WHERE u.username = @u AND u.is_active = 1';
  EXEC sys.sp_executesql @sql, N'@u VARCHAR(100)', @u = @username;
END;
GO

