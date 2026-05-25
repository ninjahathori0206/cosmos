/*
  Grant foundry.lab.manage to hq_manager so Foundry lab workflow updates use RBAC
  (see src/config/labWorkflowTransitionsCatalog.js) instead of legacy actor_role slots.

  After running: users with hq_manager must re-login for JWT refresh.
*/

USE [CosmosERP];
GO

DECLARE @rk NVARCHAR(50) = N'hq_manager';
DECLARE @pk NVARCHAR(80) = N'foundry.lab.manage';

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_key = @rk)
BEGIN
  PRINT N'Role hq_manager not found — skipped.';
  RETURN;
END;

IF NOT EXISTS (
  SELECT 1 FROM dbo.role_permissions
  WHERE role_key = @rk AND permission = @pk
)
  INSERT INTO dbo.role_permissions (role_key, permission, created_at)
  VALUES (@rk, @pk, DATEADD(MINUTE, 330, SYSUTCDATETIME()));

PRINT N'Granted ' + @pk + N' to ' + @rk;
GO
