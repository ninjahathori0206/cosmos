/*
  Grant foundry.rate_intelligence.view to roles that already have foundry.purchases.view
  (Rate Intelligence nav previously used purchases.view). Idempotent. Re-login after run.
*/

USE [CosmosERP];
GO

DECLARE @perm NVARCHAR(80) = N'foundry.rate_intelligence.view';
DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT DISTINCT rp.role_key, @perm, @now
FROM dbo.role_permissions rp
WHERE rp.permission = N'foundry.purchases.view'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.role_permissions x
    WHERE x.role_key = rp.role_key AND x.permission = @perm
  );

PRINT N'Granted ' + @perm + N' to roles with foundry.purchases.view where missing.';
GO
