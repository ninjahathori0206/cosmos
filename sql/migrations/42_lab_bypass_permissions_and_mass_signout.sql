/*
  Lab pair-guard bypass permissions → role_permissions (mirrors holders of related lab keys).
  Bumps jwt_min_issue_epoch — deploy **Node/code first** so new JWTs carry token_issued_at;
  applying this migration before deploy would reject all legacy tokens immediately (expected once code is live).

  Safe to re-run: permission INSERTs guard with NOT EXISTS; epoch UPDATE always bumps to "now".

  CosmosERP deployment: run migration, redeploy Node, then everyone signs in again.
*/

USE [CosmosERP];
GO

DECLARE @nowIst DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

-- Unix seconds UTC (jwt iat-compatible)
DECLARE @unix BIGINT = DATEDIFF_BIG(SECOND, CAST(N'1970-01-01 00:00:00' AS datetime2), GETUTDATE());

-- ── JWT global invalidation ────────────────────────────────────────────────
MERGE dbo.app_settings AS tgt
USING (SELECT N'jwt_min_issue_epoch' AS k) AS src(k)
ON tgt.setting_key = src.k
WHEN MATCHED THEN
  UPDATE SET setting_value = CAST(@unix AS nvarchar(30)),
             updated_at = @nowIst
WHEN NOT MATCHED THEN
  INSERT (setting_key, setting_value, setting_group, description, updated_at)
  VALUES (N'jwt_min_issue_epoch', CAST(@unix AS nvarchar(30)), N'security',
          N'Min unix issue time for API JWT claims token_issued_at; bump to mass sign-out.', @nowIst);

PRINT N'jwt_min_issue_epoch set to UTC unix ' + CAST(@unix AS nvarchar(20)) + N' — all prior JWTs invalidated until re-issue.';

-- ── Bypass keys: grant where role already has sibling capability ────────────
;WITH F AS (
  SELECT DISTINCT role_key FROM dbo.role_permissions
  WHERE LOWER(LTRIM(RTRIM(permission))) IN (N'foundry.lab.view')
)
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT f.role_key, N'foundry.lab.bypass_order_sibling', @nowIst
FROM F AS f
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.role_permissions x
  WHERE x.role_key = f.role_key
    AND LOWER(LTRIM(RTRIM(x.permission))) = N'foundry.lab.bypass_order_sibling');

;WITH CU AS (
  SELECT DISTINCT role_key FROM dbo.role_permissions
  WHERE LOWER(LTRIM(RTRIM(permission))) IN (N'command_unit.roles.edit', N'command_unit.roles.create')
)
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT cu.role_key, N'command_unit.lab.bypass_order_sibling', @nowIst
FROM CU AS cu
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.role_permissions x
  WHERE x.role_key = cu.role_key
    AND LOWER(LTRIM(RTRIM(x.permission))) = N'command_unit.lab.bypass_order_sibling');

;WITH SP AS (
  SELECT DISTINCT role_key FROM dbo.role_permissions
  WHERE LOWER(LTRIM(RTRIM(permission))) IN (N'storepilot.lab.manage')
)
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT sp.role_key, N'storepilot.lab.bypass_order_sibling', @nowIst
FROM SP AS sp
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.role_permissions x
  WHERE x.role_key = sp.role_key
    AND LOWER(LTRIM(RTRIM(x.permission))) = N'storepilot.lab.bypass_order_sibling');

;WITH PS AS (
  SELECT DISTINCT role_key FROM dbo.role_permissions
  WHERE LOWER(LTRIM(RTRIM(permission))) IN (N'pos.lab.workflow')
)
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT ps.role_key, N'pos.lab.bypass_order_sibling', @nowIst
FROM PS AS ps
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.role_permissions x
  WHERE x.role_key = ps.role_key
    AND LOWER(LTRIM(RTRIM(x.permission))) = N'pos.lab.bypass_order_sibling');

PRINT N'42_lab_bypass_permissions_and_mass_signout done.';
GO
