/*
  Idempotent: grant foundry.lab.view to hq_manager (Foundry Lab Orders API + nav).

  After running, affected users must sign in again so JWT includes the new permission.

  Safe to re-run.
*/
USE [CosmosERP];
GO

DECLARE @rk NVARCHAR(50) = N'hq_manager';

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_key = @rk)
  PRINT 'Role hq_manager not found — skipped.';
ELSE IF EXISTS (SELECT 1 FROM dbo.role_permissions WHERE role_key = @rk AND permission = N'foundry.lab.view')
  PRINT 'foundry.lab.view already granted to hq_manager.';
ELSE
BEGIN
  INSERT INTO dbo.role_permissions (role_key, permission, created_at)
  VALUES (@rk, N'foundry.lab.view', DATEADD(MINUTE, 330, SYSUTCDATETIME()));
  PRINT 'Granted foundry.lab.view to hq_manager.';
END
GO
