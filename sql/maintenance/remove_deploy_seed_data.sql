-- One-time: remove legacy SQL deploy demo/reference rows that should not live on a production DB.
-- Does NOT delete live HQ config, users, stores, roles, or app_settings you set in the app.
--
-- Run manually in SSMS (or npm run maintenance:remove-deploy-seeds). NOT part of deploy_pos_sql.js.
--
-- Sections:
--   1) Demo lens catalogue (same names as old 06_pos_lens_catalog.sql seeds)
--   2) Deploy-seeded membership PLUS (only if no customer_memberships reference it)
--   3) Deploy-seeded loyalty tiers Silver/Gold/Platinum (only if unused)

USE [CosmosERP];
GO

SET NOCOUNT ON;
PRINT N'=== remove_deploy_seed_data.sql ===';
GO

/* ── 1) Lens demo catalogue ─────────────────────────────────────────────── */
DECLARE @demo_cat TABLE (nm NVARCHAR(100) PRIMARY KEY);
INSERT INTO @demo_cat (nm) VALUES
  (N'Single Vision'), (N'Progressive'), (N'Bifocal'), (N'Photochromic'), (N'Zero Power');

DECLARE @demo_pkg TABLE (nm NVARCHAR(100) PRIMARY KEY);
INSERT INTO @demo_pkg (nm) VALUES
  (N'SV Standard'), (N'SV Thin'), (N'Prog Essential'), (N'Prog Premium'),
  (N'Bifocal FT28'), (N'Photo Grey'), (N'Blue-Cut Standard');

DECLARE @demo_addon TABLE (nm NVARCHAR(100) PRIMARY KEY);
INSERT INTO @demo_addon (nm) VALUES
  (N'Anti-Reflection'), (N'Blue Cut'), (N'UV400'), (N'Scratch Resistant'), (N'Photochromic coating');

DECLARE @cat_ids TABLE (id INT PRIMARY KEY);
INSERT INTO @cat_ids (id)
SELECT c.id FROM dbo.pos_lens_categories c
INNER JOIN @demo_cat d ON d.nm = c.name OR d.nm = NULLIF(LTRIM(RTRIM(c.pos_name)), N'');

DECLARE @pkg_ids TABLE (id INT PRIMARY KEY);
INSERT INTO @pkg_ids (id)
SELECT p.id FROM dbo.pos_lens_packages p
INNER JOIN @demo_pkg d ON d.nm = p.name OR d.nm = NULLIF(LTRIM(RTRIM(p.pos_name)), N'');

DECLARE @addon_ids TABLE (id INT PRIMARY KEY);
INSERT INTO @addon_ids (id)
SELECT a.id FROM dbo.pos_lens_addons a
INNER JOIN @demo_addon d ON d.nm = a.name OR d.nm = NULLIF(LTRIM(RTRIM(a.pos_name)), N'');

DELETE l FROM dbo.pos_lens_pkg_addons l
WHERE l.package_id IN (SELECT id FROM @pkg_ids) OR l.addon_id IN (SELECT id FROM @addon_ids);

DELETE w FROM dbo.pos_product_type_lens_wizard_categories w
WHERE w.lens_category_id IN (SELECT id FROM @cat_ids);

DELETE p FROM dbo.pos_lens_packages p WHERE p.id IN (SELECT id FROM @pkg_ids);
DELETE a FROM dbo.pos_lens_addons a WHERE a.id IN (SELECT id FROM @addon_ids);

DELETE c FROM dbo.pos_lens_categories c
WHERE c.id IN (SELECT id FROM @cat_ids)
  AND NOT EXISTS (SELECT 1 FROM dbo.pos_lens_packages p WHERE p.category_id = c.id);

PRINT N'Lens demo cleanup done.';
GO

/* ── 2) Membership PLUS (deploy seed only) ─────────────────────────────── */
IF OBJECT_ID(N'dbo.customer_memberships', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.customer_memberships WHERE plan_key = N'PLUS')
  BEGIN
    DELETE FROM dbo.membership_plan_benefits WHERE plan_key = N'PLUS';
    DELETE FROM dbo.membership_plans WHERE plan_key = N'PLUS';
    PRINT N'Removed deploy-seeded PLUS membership plan (no customer_memberships).';
  END
  ELSE
    PRINT N'Skipped PLUS plan — customer_memberships rows exist.';
END
GO

/* ── 3) Loyalty tiers Silver/Gold/Platinum (deploy seed only) ───────────── */
IF OBJECT_ID(N'dbo.loyalty_tiers', N'U') IS NOT NULL
BEGIN
  IF OBJECT_ID(N'dbo.customers', N'U') IS NOT NULL
     AND COL_LENGTH(N'dbo.customers', N'loyalty_tier_id') IS NOT NULL
  BEGIN
    DELETE t FROM dbo.loyalty_tiers t
    WHERE t.tier_name IN (N'Silver', N'Gold', N'Platinum')
      AND NOT EXISTS (
        SELECT 1 FROM dbo.customers c WHERE c.loyalty_tier_id = t.tier_id
      );
    PRINT N'Removed unused deploy-seeded loyalty tiers (if any).';
  END
  ELSE
  BEGIN
    DELETE FROM dbo.loyalty_tiers
    WHERE tier_name IN (N'Silver', N'Gold', N'Platinum');
    PRINT N'Removed deploy-seeded loyalty tiers (no customer FK column).';
  END
END
GO

PRINT N'=== remove_deploy_seed_data.sql complete ===';
GO
