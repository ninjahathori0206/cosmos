/*
  Grant foundry.label_formats.view to roles that can already read purchases / print labels.
  Idempotent. Re-login after run so JWT includes the new permission.
*/

USE [CosmosERP];
GO

DECLARE @perm NVARCHAR(80) = N'foundry.label_formats.view';
DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT DISTINCT rp.role_key, @perm, @now
FROM dbo.role_permissions rp
WHERE rp.permission IN (
    N'foundry.purchases.view',
    N'foundry.bill_verification.view',
    N'foundry.branding.view',
    N'foundry.digitisation.view',
    N'foundry.warehouse.view',
    N'foundry.stock.view'
  )
  AND NOT EXISTS (
    SELECT 1 FROM dbo.role_permissions x
    WHERE x.role_key = rp.role_key AND x.permission = @perm
  );

PRINT N'Granted ' + @perm + N' to roles with purchase/branding/warehouse/stock view where missing.';
GO
