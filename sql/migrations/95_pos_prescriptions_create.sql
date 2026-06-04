-- Grant pos.prescriptions.create to roles that already create POS orders (re-login for JWT refresh).
DECLARE @seedNow DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT DISTINCT rp.role_key, N'pos.prescriptions.create', @seedNow
FROM dbo.role_permissions rp
WHERE LOWER(LTRIM(RTRIM(rp.permission))) IN (
  N'pos.orders.create',
  N'cx.eye_tests.create'
)
AND NOT EXISTS (
  SELECT 1 FROM dbo.role_permissions x
  WHERE x.role_key = rp.role_key
    AND LOWER(LTRIM(RTRIM(x.permission))) = N'pos.prescriptions.create'
);
GO

PRINT 'pos.prescriptions.create permission seeded.';
GO
