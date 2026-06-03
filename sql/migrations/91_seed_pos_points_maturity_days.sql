/*
  91_seed_pos_points_maturity_days.sql
  ------------------------------------
  Ensures legacy earn-delay key exists for migration seeding into loyalty_settings.
  Tombstoned to __retired__ when loyalty_engine_v2 is enabled via Command Unit.
*/
PRINT N'--- 91_seed_pos_points_maturity_days.sql ---';

USE [CosmosERP];
GO

IF OBJECT_ID(N'dbo.app_settings', N'U') IS NOT NULL
BEGIN
  MERGE dbo.app_settings AS tgt
  USING (
    SELECT
      N'pos_points_maturity_days' AS setting_key,
      N'7' AS setting_value,
      N'loyalty' AS setting_group,
      N'Days before legacy pos_points earn becomes redeemable (retired when loyalty_engine_v2=1)' AS description
  ) AS src
  ON tgt.setting_key = src.setting_key
  WHEN NOT MATCHED BY TARGET THEN
    INSERT (setting_key, setting_value, setting_group, description)
    VALUES (src.setting_key, src.setting_value, src.setting_group, src.description);
  PRINT N'Seeded pos_points_maturity_days if missing.';
END
GO

PRINT N'--- 91_seed_pos_points_maturity_days.sql complete ---';
GO
