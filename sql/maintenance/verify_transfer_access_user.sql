/*
  Diagnostics: verify a user can use StorePilot transfer accept/stock (JWT-aligned checks).

  Set @username OR @user_id below, then run against CosmosERP.

  Checks:
  - users.role_key, store_id, is_active
  - store name for that store_id
  - role_permissions includes storepilot.transfers.edit (and view)
  - sp_User_EffectiveModules: storepilot is_effective = 1
  - Optional: compare users.store_id to a transfer doc destination (set @doc_id)

  Example:
    sqlcmd -S <host> -d CosmosERP -i sql/maintenance/verify_transfer_access_user.sql
*/
USE [CosmosERP];
GO

DECLARE @username VARCHAR(100) = N'prince';  -- set to target login, or leave NULL
DECLARE @user_id  INT          = NULL;       -- or set explicit user_id
DECLARE @doc_id   INT          = NULL;       -- optional: stock_transfer_docs.doc_id to compare to_store_id

IF @user_id IS NULL AND @username IS NOT NULL
  SELECT @user_id = user_id FROM dbo.users WHERE username = @username;

IF @user_id IS NULL
BEGIN
  PRINT 'ERROR: Set @username or @user_id at top of script.';
  RETURN;
END;

PRINT '--- User row ---';
SELECT u.user_id,
       u.username,
       u.full_name,
       u.role_key,
       u.store_id,
       u.is_active,
       s.store_name,
       s.store_code
FROM dbo.users u
LEFT JOIN dbo.stores s ON s.store_id = u.store_id
WHERE u.user_id = @user_id;

PRINT '--- Permissions for role (role_permissions) ---';
SELECT rp.permission
FROM dbo.role_permissions rp
INNER JOIN dbo.users u ON u.role_key = rp.role_key AND u.user_id = @user_id
ORDER BY rp.permission;

PRINT '--- Effective modules (sp_User_EffectiveModules) ---';
EXEC dbo.sp_User_EffectiveModules @user_id = @user_id;

IF @doc_id IS NOT NULL
BEGIN
  PRINT '--- Stock transfer doc vs user store ---';
  SELECT d.doc_id,
         d.to_store_id,
         d.status,
         u.store_id AS user_store_id,
         CASE WHEN d.to_store_id = u.store_id THEN N'OK' ELSE N'MISMATCH' END AS store_match
  FROM dbo.stock_transfer_docs d
  CROSS JOIN dbo.users u
  WHERE d.doc_id = @doc_id AND u.user_id = @user_id;
END;

GO
