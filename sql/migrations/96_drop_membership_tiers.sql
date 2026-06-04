/*
  96_drop_membership_tiers.sql
  ----------------------------
  Remove legacy membership_tiers bridge. Eyewoot Go / POS / CX use membership_plans only.
  Idempotent. Run after 63_membership_plans_link_tiers.sql (if applied).
*/
PRINT N'--- 96_drop_membership_tiers.sql ---';

USE [CosmosERP];
GO

IF EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE name = N'FK_membership_plans_tier'
    AND parent_object_id = OBJECT_ID(N'dbo.membership_plans')
)
BEGIN
  ALTER TABLE dbo.membership_plans DROP CONSTRAINT FK_membership_plans_tier;
  PRINT N'Dropped FK_membership_plans_tier.';
END;
GO

IF COL_LENGTH(N'dbo.membership_plans', N'tier_id') IS NOT NULL
BEGIN
  ALTER TABLE dbo.membership_plans DROP COLUMN tier_id;
  PRINT N'Dropped membership_plans.tier_id.';
END;
GO

IF OBJECT_ID(N'dbo.sp_MembershipTier_GetAll', N'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_MembershipTier_GetAll;
GO

IF OBJECT_ID(N'dbo.sp_MembershipTier_Create', N'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_MembershipTier_Create;
GO

IF OBJECT_ID(N'dbo.sp_MembershipTier_Update', N'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_MembershipTier_Update;
GO

IF OBJECT_ID(N'dbo.sp_MembershipTier_Deactivate', N'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_MembershipTier_Deactivate;
GO

IF OBJECT_ID(N'dbo.membership_tiers', N'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.membership_tiers;
  PRINT N'Dropped dbo.membership_tiers.';
END;
GO

PRINT N'96_drop_membership_tiers complete.';
GO
