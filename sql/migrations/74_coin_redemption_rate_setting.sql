/*
  74_coin_redemption_rate_setting.sql
  ------------------------------------
  Seeds the coin_redemption_rate app setting.

  coin_redemption_rate:
    How many coins equal ₹1 at POS redemption.
    Default: 10  (i.e. 10 coins = ₹1 cash discount).
    Configurable by admin via Command Unit settings.

  pos_points_ledger is repurposed as the Coin ledger — no schema change needed.
  loyalty_tiers table is kept in DB but removed from active query paths.

  Idempotent (MERGE on setting_key).
  Run after: app_settings table exists (core schema).
*/
PRINT N'--- 74_coin_redemption_rate_setting.sql ---';

USE [CosmosERP];
GO

IF OBJECT_ID(N'dbo.app_settings', N'U') IS NULL
BEGIN
  PRINT N'app_settings table missing — skipped.';
  RETURN;
END;
GO

DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

MERGE dbo.app_settings AS tgt
USING (
  SELECT
    N'coin_redemption_rate'           AS setting_key,
    N'10'                             AS setting_value,
    N'coins'                          AS setting_group,
    N'Number of coins equal to ₹1 at POS redemption (e.g. 10 means 10 coins = ₹1)' AS description
) AS src
ON tgt.setting_key = src.setting_key
WHEN NOT MATCHED BY TARGET THEN
  INSERT (setting_key, setting_value, setting_group, description)
  VALUES (src.setting_key, src.setting_value, src.setting_group, src.description);

PRINT N'Seeded coin_redemption_rate = 10 (default: 10 coins = ₹1).';
GO

PRINT N'--- 74_coin_redemption_rate_setting.sql complete ---';
GO
