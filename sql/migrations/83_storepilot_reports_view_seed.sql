/*
  Grant storepilot.reports.view to roles that already have store dashboard access.
  Run: npm run migrate:83-storepilot-reports-view
*/
USE [CosmosERP];
GO

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, N'storepilot.reports.view', DATEADD(MINUTE, 330, SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = N'storepilot.dashboard.view'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.role_permissions x
    WHERE x.role_key = rp.role_key AND x.permission = N'storepilot.reports.view'
  );

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT N'super_admin', N'storepilot.reports.view', DATEADD(MINUTE, 330, SYSUTCDATETIME())
WHERE EXISTS (SELECT 1 FROM dbo.roles WHERE role_key = N'super_admin')
  AND NOT EXISTS (
    SELECT 1 FROM dbo.role_permissions
    WHERE role_key = N'super_admin' AND permission = N'storepilot.reports.view'
  );
GO
