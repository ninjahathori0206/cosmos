/*
  Phase B — expand roles that have coarse foundry.catalogue.* into granular catalogue keys.
  Idempotent. Re-login required after run.
*/

USE [CosmosERP];
GO

DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

-- View: legacy catalogue.view → granular lens + master view keys
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT DISTINCT rp.role_key, g.perm, @now
FROM dbo.role_permissions rp
CROSS APPLY (VALUES
  (N'foundry.lens.packages.view'),
  (N'foundry.lens.addons.view'),
  (N'foundry.lens.matrix.view'),
  (N'foundry.lens.wizard.view'),
  (N'foundry.master_catalogue.view')
) g(perm)
WHERE rp.permission = N'foundry.catalogue.view'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.role_permissions x
    WHERE x.role_key = rp.role_key AND x.permission = g.perm
  );

-- Edit: legacy catalogue.edit → granular lens + master edit keys
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT DISTINCT rp.role_key, g.perm, @now
FROM dbo.role_permissions rp
CROSS APPLY (VALUES
  (N'foundry.lens.packages.edit'),
  (N'foundry.lens.addons.edit'),
  (N'foundry.lens.matrix.edit'),
  (N'foundry.lens.wizard.edit'),
  (N'foundry.master_catalogue.edit')
) g(perm)
WHERE rp.permission = N'foundry.catalogue.edit'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.role_permissions x
    WHERE x.role_key = rp.role_key AND x.permission = g.perm
  );

PRINT N'Granular catalogue permissions migrated from legacy coarse keys.';
GO
