/*
  Link Eyewoot Go membership_plans to Command Unit membership_tiers.
  CX grant + customer cards use tier_name (membership tier) and loyalty_tier (membership type).
  Run in separate batches (GO) so ALTER is visible before UPDATE.
*/

IF OBJECT_ID('dbo.membership_plans', 'U') IS NULL
BEGIN
  PRINT 'membership_plans missing — run 31_membership_plans.sql first.';
  RETURN;
END;

IF COL_LENGTH('dbo.membership_plans', 'tier_id') IS NULL
BEGIN
  ALTER TABLE dbo.membership_plans ADD tier_id INT NULL;
  PRINT 'Added membership_plans.tier_id';
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE name = N'FK_membership_plans_tier' AND parent_object_id = OBJECT_ID(N'dbo.membership_plans')
)
AND OBJECT_ID('dbo.membership_tiers', 'U') IS NOT NULL
AND COL_LENGTH('dbo.membership_plans', 'tier_id') IS NOT NULL
BEGIN
  ALTER TABLE dbo.membership_plans
    ADD CONSTRAINT FK_membership_plans_tier
    FOREIGN KEY (tier_id) REFERENCES dbo.membership_tiers(membership_id);
  PRINT 'FK_membership_plans_tier created.';
END;
GO

IF OBJECT_ID('dbo.membership_tiers', 'U') IS NOT NULL
AND COL_LENGTH('dbo.membership_plans', 'tier_id') IS NOT NULL
BEGIN
  UPDATE p
  SET p.tier_id = t.membership_id
  FROM dbo.membership_plans p
  INNER JOIN dbo.membership_tiers t ON t.is_active = 1
    AND (
      UPPER(LTRIM(RTRIM(ISNULL(t.loyalty_tier, N'')))) = UPPER(p.plan_key)
      OR UPPER(REPLACE(REPLACE(REPLACE(t.tier_name, N' ', N'_'), N'-', N'_'), N'.', N'_')) = UPPER(p.plan_key)
    )
  WHERE p.tier_id IS NULL;

  PRINT 'Backfilled membership_plans.tier_id from membership_tiers.';
END;
GO
