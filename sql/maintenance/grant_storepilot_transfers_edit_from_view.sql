/*
  Grant storepilot.transfers.edit to roles that can view transfers but cannot accept/stock.

  Symptom: Store staff (e.g. store incharge) see My Requests and shipments but
  Accept / Verify & Stock return 403 or "Permission denied".

  After run: affected users must re-login for JWT refresh.

  Optional diagnostics first:
    sql/maintenance/verify_transfer_access_user.sql  (@username = target login)
*/
USE [CosmosERP];
GO

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key,
       N'storepilot.transfers.edit',
       DATEADD(MINUTE, 330, SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = N'storepilot.transfers.view'
  AND NOT EXISTS (
    SELECT 1
    FROM dbo.role_permissions x
    WHERE x.role_key = rp.role_key
      AND x.permission = N'storepilot.transfers.edit'
  );

PRINT CONCAT(N'Granted storepilot.transfers.edit to ', @@ROWCOUNT, N' role(s) that had view only.');
GO
