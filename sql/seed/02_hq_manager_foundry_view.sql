/*
  Optional: default Foundry permissions for HQ Manager.
  Uses the new three-level permission format (view / create / edit).

  Grants procurement stages 2–5 with full three-level access for each feature,
  plus suppliers view, catalogue view, stock view, and transfers view.
  Does NOT grant foundry.purchases.create (New Purchase stays blocked unless added in Roles UI).
  Does NOT insert role_module_access rows.

  IMPORTANT — role key must be exactly 'hq_manager' (underscore, not hyphen).
  If Command Unit shows a role named "hq-manager" (with a hyphen), that is a separate DB row
  and this seed will have NO effect on it. In that case, run the migration first:
    sql/maintenance/migrate_hq_manager_role_key.sql
  ...then re-run this seed.

  Run after 01_seed_core if role hq_manager exists.
  Idempotent — safe to re-run.
*/
PRINT 'Seeding hq_manager Foundry permissions (v2 format)...';

USE [CosmosERP];

DECLARE @rk VARCHAR(50) = N'hq_manager';

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_key = @rk)
BEGIN
  PRINT 'Role hq_manager not found — skipped.';
END
ELSE
BEGIN
  DECLARE @perms TABLE (p NVARCHAR(200) PRIMARY KEY);
  INSERT INTO @perms (p) VALUES
    -- Purchases (view only — create is NOT granted by default)
    (N'foundry.purchases.view'),
    -- Bill Verification (full three levels)
    (N'foundry.bill_verification.view'),
    (N'foundry.bill_verification.create'),
    (N'foundry.bill_verification.edit'),
    -- Branding (full three levels)
    (N'foundry.branding.view'),
    (N'foundry.branding.create'),
    (N'foundry.branding.edit'),
    -- Digitisation (full three levels)
    (N'foundry.digitisation.view'),
    (N'foundry.digitisation.create'),
    (N'foundry.digitisation.edit'),
    -- Warehouse (view + mark ready)
    (N'foundry.warehouse.view'),
    (N'foundry.warehouse.create'),
    -- Catalogue & Stock (view)
    (N'foundry.catalogue.view'),
    (N'foundry.stock.view'),
    -- Transfers (view + create direct dispatch from Foundry Goods Transfer)
    (N'foundry.transfers.view'),
    (N'foundry.transfers.create'),
    -- Suppliers (view only)
    (N'foundry.suppliers.view'),
    -- Makers (view)
    (N'foundry.makers.view');

  INSERT INTO dbo.role_permissions (role_key, permission, created_at)
  SELECT @rk, p, DATEADD(MINUTE, 330, SYSUTCDATETIME())
  FROM @perms x
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.role_permissions rp
    WHERE rp.role_key = @rk AND rp.permission = x.p
  );

  PRINT 'hq_manager permissions seeded.';
END;

GO
