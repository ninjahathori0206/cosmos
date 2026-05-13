/*
  Preflight: user counts for store incharge role keys (duplicate detection).

  Run before deleting roles or before sql/maintenance/migrate_store_in_charge_role_key.sql

  Usage (example):
    sqlcmd -S <host> -d CosmosERP -i sql/maintenance/preflight_store_incharge_roles.sql
*/
USE [CosmosERP];
GO

PRINT N'--- Users per role_key (store incharge variants) ---';
SELECT role_key, COUNT(*) AS user_count
FROM dbo.users
WHERE role_key IN (N'store_incharge', N'store_in_charge')
GROUP BY role_key;

PRINT N'--- Row counts in roles table ---';
SELECT role_key, display_name
FROM dbo.roles
WHERE role_key IN (N'store_incharge', N'store_in_charge')
ORDER BY role_key;

PRINT N'--- role_permissions rows ---';
SELECT role_key, COUNT(*) AS perm_rows
FROM dbo.role_permissions
WHERE role_key IN (N'store_incharge', N'store_in_charge')
GROUP BY role_key;

PRINT N'--- role_module_access rows ---';
SELECT role_key, COUNT(*) AS mod_rows
FROM dbo.role_module_access
WHERE role_key IN (N'store_incharge', N'store_in_charge')
GROUP BY role_key;

PRINT N'Preflight complete. Recommended: merge legacy store_in_charge into store_incharge via migrate_store_in_charge_role_key.sql';

/*
  Optional reverse direction (NOT recommended — repo canonical key is store_incharge):
  1) Ensure dbo.roles row exists for store_in_charge with desired display_name.
  2) UPDATE dbo.users SET role_key = N'store_in_charge' WHERE role_key = N'store_incharge';
  3) Merge role_permissions / role_module_access from store_incharge into store_in_charge
     (mirror logic in migrate_store_in_charge_role_key.sql with old/new swapped).
  4) DELETE legacy role store_incharge only after no users reference it
     (Command Unit Edit Role Delete or EXEC sp_Role_Delete @role_key = N'store_incharge').
  5) Align sql/alter and sql/seed references if new installs must use store_in_charge only.
*/
GO
