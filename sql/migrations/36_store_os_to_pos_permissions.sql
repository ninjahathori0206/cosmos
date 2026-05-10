/*
  Replaces legacy store_os.* permission rows with granular pos.* keys (aligned with src/config/permissionsCatalogue.js).
  Trade-capable roles get full POS bundle; browse-only roles get read-oriented keys.

  Deploy: run against CosmosERP, then have staff sign out/in.

  Safe to re-run: INSERT guards with NOT EXISTS; DELETE is scoped to store_os.% only.
*/
USE [CosmosERP];
GO

DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

;WITH TradeRoles AS (
  SELECT DISTINCT role_key
  FROM dbo.role_permissions
  WHERE LOWER(LTRIM(RTRIM(permission))) IN (
    N'store_os.pos.create',
    N'store_os.inventory.create',
    N'store_os.inventory.edit'
  )
),
BrowseRoles AS (
  SELECT DISTINCT role_key
  FROM dbo.role_permissions
  WHERE LOWER(LTRIM(RTRIM(permission))) IN (
    N'store_os.pos.view',
    N'store_os.inventory.view',
    N'store_os.reports.view',
    N'store_os.reports.create'
  )
)
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT DISTINCT tr.role_key, v.perm, @now
FROM TradeRoles tr
CROSS JOIN (VALUES
  (N'pos.catalogue.view'),
  (N'pos.promotions.view'),
  (N'pos.customers.view'),
  (N'pos.customers.create'),
  (N'pos.orders.view'),
  (N'pos.orders.create'),
  (N'pos.payment.collect'),
  (N'pos.lab.workflow'),
  (N'pos.staff.pin.set')
) AS v(perm)
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.role_permissions x
  WHERE x.role_key = tr.role_key
    AND LOWER(LTRIM(RTRIM(x.permission))) = LOWER(LTRIM(RTRIM(v.perm)))
);

;WITH TradeRoles AS (
  SELECT DISTINCT role_key
  FROM dbo.role_permissions
  WHERE LOWER(LTRIM(RTRIM(permission))) IN (
    N'store_os.pos.create',
    N'store_os.inventory.create',
    N'store_os.inventory.edit'
  )
),
BrowseRoles AS (
  SELECT DISTINCT role_key
  FROM dbo.role_permissions
  WHERE LOWER(LTRIM(RTRIM(permission))) IN (
    N'store_os.pos.view',
    N'store_os.inventory.view',
    N'store_os.reports.view',
    N'store_os.reports.create'
  )
)
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT DISTINCT br.role_key, v.perm, @now
FROM BrowseRoles br
CROSS JOIN (VALUES
  (N'pos.catalogue.view'),
  (N'pos.promotions.view'),
  (N'pos.customers.view'),
  (N'pos.orders.view')
) AS v(perm)
WHERE NOT EXISTS (SELECT 1 FROM TradeRoles t WHERE t.role_key = br.role_key)
  AND NOT EXISTS (
    SELECT 1 FROM dbo.role_permissions x
    WHERE x.role_key = br.role_key
      AND LOWER(LTRIM(RTRIM(x.permission))) = LOWER(LTRIM(RTRIM(v.perm)))
  );

DELETE FROM dbo.role_permissions WHERE LOWER(LTRIM(RTRIM(permission))) LIKE N'store_os.%';
GO
