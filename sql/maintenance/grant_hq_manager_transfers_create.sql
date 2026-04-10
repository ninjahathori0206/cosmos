/*
  One-time: allow hq_manager to create direct Goods Transfer documents (POST /api/stock-transfer-docs).
  Run if Lukman / HQ users get "Permission denied" when dispatching after destination stores load.

  Idempotent — safe to re-run.
*/
USE [CosmosERP];

DECLARE @rk VARCHAR(50) = N'hq_manager';
DECLARE @p NVARCHAR(200) = N'foundry.transfers.create';

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_key = @rk)
BEGIN
  PRINT 'Role hq_manager not found — skipped.';
END
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.role_permissions WHERE role_key = @rk AND permission = @p)
BEGIN
  INSERT INTO dbo.role_permissions (role_key, permission, created_at)
  VALUES (@rk, @p, DATEADD(MINUTE, 330, SYSUTCDATETIME()));
  PRINT 'Granted foundry.transfers.create to hq_manager.';
END
ELSE
  PRINT 'foundry.transfers.create already present for hq_manager.';

GO
