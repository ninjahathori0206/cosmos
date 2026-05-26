/*
  72_membership_plans_capabilities.sql
  ------------------------------------
  Extends membership_plans with per-plan capability columns that drive offer
  eligibility, coin cashback, flat discounts, and special entitlements.

  Capability columns:
    has_plus_access       — Plan grants access to Plus-gated offers
    extra_cashback_pct    — Automatic extra cashback % on every purchase (e.g. 5 = 5%)
    flat_discount_pct     — Flat % discount applied on every purchase (e.g. 50 = 50%)
    has_one_time_discount — Plan includes a single one-time discount entitlement
    one_time_discount_pct — The % value of that one-time discount
    can_create_sub_cards  — Holder can issue membership cards on behalf of others (Franchisee)
    validity_type         — 'DAYS' (uses validity_days) | 'LIFETIME' (never expires)

  Idempotent: each ALTER is guarded by COL_LENGTH check.
  Run after: 31_membership_plans.sql, 62_seed_membership_plans_default.sql
*/
PRINT N'--- 72_membership_plans_capabilities.sql ---';

USE [CosmosERP];
GO

IF OBJECT_ID(N'dbo.membership_plans', N'U') IS NULL
BEGIN
  PRINT N'membership_plans table missing — run 31_membership_plans.sql first.';
  RETURN;
END;
GO

-- has_plus_access
IF COL_LENGTH(N'dbo.membership_plans', N'has_plus_access') IS NULL
BEGIN
  ALTER TABLE dbo.membership_plans ADD has_plus_access BIT NOT NULL DEFAULT 0;
  PRINT N'Added has_plus_access.';
END
ELSE
  PRINT N'has_plus_access already exists — skipped.';
GO

-- extra_cashback_pct
IF COL_LENGTH(N'dbo.membership_plans', N'extra_cashback_pct') IS NULL
BEGIN
  ALTER TABLE dbo.membership_plans ADD extra_cashback_pct DECIMAL(5,2) NULL;
  PRINT N'Added extra_cashback_pct.';
END
ELSE
  PRINT N'extra_cashback_pct already exists — skipped.';
GO

-- flat_discount_pct
IF COL_LENGTH(N'dbo.membership_plans', N'flat_discount_pct') IS NULL
BEGIN
  ALTER TABLE dbo.membership_plans ADD flat_discount_pct DECIMAL(5,2) NULL;
  PRINT N'Added flat_discount_pct.';
END
ELSE
  PRINT N'flat_discount_pct already exists — skipped.';
GO

-- has_one_time_discount
IF COL_LENGTH(N'dbo.membership_plans', N'has_one_time_discount') IS NULL
BEGIN
  ALTER TABLE dbo.membership_plans ADD has_one_time_discount BIT NOT NULL DEFAULT 0;
  PRINT N'Added has_one_time_discount.';
END
ELSE
  PRINT N'has_one_time_discount already exists — skipped.';
GO

-- one_time_discount_pct
IF COL_LENGTH(N'dbo.membership_plans', N'one_time_discount_pct') IS NULL
BEGIN
  ALTER TABLE dbo.membership_plans ADD one_time_discount_pct DECIMAL(5,2) NULL;
  PRINT N'Added one_time_discount_pct.';
END
ELSE
  PRINT N'one_time_discount_pct already exists — skipped.';
GO

-- can_create_sub_cards
IF COL_LENGTH(N'dbo.membership_plans', N'can_create_sub_cards') IS NULL
BEGIN
  ALTER TABLE dbo.membership_plans ADD can_create_sub_cards BIT NOT NULL DEFAULT 0;
  PRINT N'Added can_create_sub_cards.';
END
ELSE
  PRINT N'can_create_sub_cards already exists — skipped.';
GO

-- validity_type
IF COL_LENGTH(N'dbo.membership_plans', N'validity_type') IS NULL
BEGIN
  ALTER TABLE dbo.membership_plans ADD validity_type NVARCHAR(20) NOT NULL DEFAULT N'DAYS';
  PRINT N'Added validity_type.';
END
ELSE
  PRINT N'validity_type already exists — skipped.';
GO

/*
  Backfill existing PLUS plan — it grants Plus access.
  BASIC is left with has_plus_access = 0 (no Plus-gated offers).
*/
UPDATE dbo.membership_plans
SET has_plus_access = 1
WHERE plan_key = N'PLUS'
  AND has_plus_access = 0;

PRINT N'Backfilled has_plus_access = 1 for PLUS plan.';
GO

PRINT N'--- 72_membership_plans_capabilities.sql complete ---';
GO
