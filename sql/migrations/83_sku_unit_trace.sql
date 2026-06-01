/*
  Migration 83 — Foundry Unit Search trace SP + RBAC seed

  - Deploy sp_SKU_UnitTraceByBarcode
  - Grant foundry.units.trace to roles with foundry.stock.view

  Deploy: npm run migrate:83-sku-unit-trace
  Re-login after run so JWT includes the new permission.
*/
USE [CosmosERP];
GO

SET NOCOUNT ON;
PRINT N'--- 83_sku_unit_trace.sql (permission seed) ---';
GO

DECLARE @perm NVARCHAR(80) = N'foundry.units.trace';
DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT DISTINCT rp.role_key, @perm, @now
FROM dbo.role_permissions rp
WHERE rp.permission = N'foundry.stock.view'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.role_permissions x
    WHERE x.role_key = rp.role_key AND x.permission = @perm
  );

PRINT N'Granted ' + @perm + N' to roles with foundry.stock.view where missing.';
GO
