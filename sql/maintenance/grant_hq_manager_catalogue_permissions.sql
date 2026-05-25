/*
  Grant Foundry Catalogue & Inventory permissions to hq_manager (Phase B granular + legacy coarse + stock).

  After running: users with hq_manager must re-login for JWT refresh.
*/

USE [CosmosERP];
GO

DECLARE @rk NVARCHAR(50) = N'hq_manager';

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_key = @rk)
BEGIN
  PRINT N'Role hq_manager not found — skipped.';
  RETURN;
END;

DECLARE @perms TABLE (perm NVARCHAR(80));
INSERT INTO @perms (perm) VALUES
  (N'foundry.catalogue.view'),
  (N'foundry.catalogue.edit'),
  (N'foundry.lens.packages.view'),
  (N'foundry.lens.packages.edit'),
  (N'foundry.lens.addons.view'),
  (N'foundry.lens.addons.edit'),
  (N'foundry.lens.matrix.view'),
  (N'foundry.lens.matrix.edit'),
  (N'foundry.lens.wizard.view'),
  (N'foundry.lens.wizard.edit'),
  (N'foundry.master_catalogue.view'),
  (N'foundry.master_catalogue.edit'),
  (N'foundry.stock.view'),
  (N'foundry.stock.create');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT @rk, p.perm, DATEADD(MINUTE, 330, SYSUTCDATETIME())
FROM @perms p
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.role_permissions x
  WHERE x.role_key = @rk AND x.permission = p.perm
);

PRINT N'Catalogue permissions (granular + legacy + stock) ensured for hq_manager.';
GO
