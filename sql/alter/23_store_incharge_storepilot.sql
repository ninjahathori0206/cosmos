-- Ensure showroom / store-incharge role can open StorePilot (and has explicit pos row).
-- Fixes opt-in role_module_access where missing modules were effectively off.

USE [CosmosERP];
GO

MERGE dbo.role_module_access AS t
USING (SELECT 'store_incharge' AS role_key, 'storepilot' AS module_key) AS s
ON t.role_key = s.role_key AND t.module_key = s.module_key
WHEN MATCHED THEN UPDATE SET is_enabled = 1, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
WHEN NOT MATCHED THEN
  INSERT (role_key, module_key, is_enabled, created_at, updated_at)
  VALUES (s.role_key, s.module_key, 1, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()));

MERGE dbo.role_module_access AS t
USING (SELECT 'store_incharge' AS role_key, 'pos' AS module_key) AS s
ON t.role_key = s.role_key AND t.module_key = s.module_key
WHEN NOT MATCHED THEN
  INSERT (role_key, module_key, is_enabled, created_at, updated_at)
  VALUES (s.role_key, s.module_key, 0, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()));

GO
