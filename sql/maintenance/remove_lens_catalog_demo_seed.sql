-- One-time: remove legacy demo lens catalogue rows inserted by old deploy seeds.
-- Does NOT delete HQ-configured rows (only exact names from sql/tables/06_pos_lens_catalog.sql
-- and sql/migrations/lens_catalog_zero_power_category.sql).
--
-- Run manually on CosmosERP after reviewing names below. NOT part of deploy_pos_sql.js.
--
-- Demo categories: Single Vision, Progressive, Bifocal, Photochromic, Zero Power
-- Demo packages: SV Standard, SV Thin, Prog Essential, Prog Premium, Bifocal FT28, Photo Grey, Blue-Cut Standard
-- Demo add-ons: Anti-Reflection, Blue Cut, UV400, Scratch Resistant, Photochromic coating

USE [CosmosERP];
GO

SET NOCOUNT ON;

DECLARE @demo_cat TABLE (nm NVARCHAR(100) PRIMARY KEY);
INSERT INTO @demo_cat (nm) VALUES
  (N'Single Vision'),
  (N'Progressive'),
  (N'Bifocal'),
  (N'Photochromic'),
  (N'Zero Power');

DECLARE @demo_pkg TABLE (nm NVARCHAR(100) PRIMARY KEY);
INSERT INTO @demo_pkg (nm) VALUES
  (N'SV Standard'),
  (N'SV Thin'),
  (N'Prog Essential'),
  (N'Prog Premium'),
  (N'Bifocal FT28'),
  (N'Photo Grey'),
  (N'Blue-Cut Standard');

DECLARE @demo_addon TABLE (nm NVARCHAR(100) PRIMARY KEY);
INSERT INTO @demo_addon (nm) VALUES
  (N'Anti-Reflection'),
  (N'Blue Cut'),
  (N'UV400'),
  (N'Scratch Resistant'),
  (N'Photochromic coating');

DECLARE @cat_ids TABLE (id INT PRIMARY KEY);
INSERT INTO @cat_ids (id)
SELECT c.id
FROM dbo.pos_lens_categories c
INNER JOIN @demo_cat d ON d.nm = c.name
   OR d.nm = NULLIF(LTRIM(RTRIM(c.pos_name)), N'');

DECLARE @pkg_ids TABLE (id INT PRIMARY KEY);
INSERT INTO @pkg_ids (id)
SELECT p.id
FROM dbo.pos_lens_packages p
INNER JOIN @demo_pkg d ON d.nm = p.name
   OR d.nm = NULLIF(LTRIM(RTRIM(p.pos_name)), N'');

DECLARE @addon_ids TABLE (id INT PRIMARY KEY);
INSERT INTO @addon_ids (id)
SELECT a.id
FROM dbo.pos_lens_addons a
INNER JOIN @demo_addon d ON d.nm = a.name
   OR d.nm = NULLIF(LTRIM(RTRIM(a.pos_name)), N'');

DECLARE @n INT;

DELETE l
FROM dbo.pos_lens_pkg_addons l
WHERE l.package_id IN (SELECT id FROM @pkg_ids)
   OR l.addon_id IN (SELECT id FROM @addon_ids);
SET @n = @@ROWCOUNT;
PRINT CONCAT(N'Deleted pos_lens_pkg_addons rows: ', @n);

DELETE w
FROM dbo.pos_product_type_lens_wizard_categories w
WHERE w.lens_category_id IN (SELECT id FROM @cat_ids);
SET @n = @@ROWCOUNT;
PRINT CONCAT(N'Deleted pos_product_type_lens_wizard_categories rows: ', @n);

DELETE p
FROM dbo.pos_lens_packages p
WHERE p.id IN (SELECT id FROM @pkg_ids);
SET @n = @@ROWCOUNT;
PRINT CONCAT(N'Deleted pos_lens_packages rows: ', @n);

DELETE a
FROM dbo.pos_lens_addons a
WHERE a.id IN (SELECT id FROM @addon_ids);
SET @n = @@ROWCOUNT;
PRINT CONCAT(N'Deleted pos_lens_addons rows: ', @n);

-- Only remove demo categories that have no packages left (keeps category if HQ added real packages under it).
DELETE c
FROM dbo.pos_lens_categories c
WHERE c.id IN (SELECT id FROM @cat_ids)
  AND NOT EXISTS (
    SELECT 1 FROM dbo.pos_lens_packages p WHERE p.category_id = c.id
  );
SET @n = @@ROWCOUNT;
PRINT CONCAT(N'Deleted pos_lens_categories rows (empty demo categories only): ', @n);

IF EXISTS (
  SELECT 1
  FROM dbo.pos_lens_categories c
  INNER JOIN @demo_cat d ON d.nm = c.name OR d.nm = NULLIF(LTRIM(RTRIM(c.pos_name)), N'')
)
  PRINT N'Note: Some demo-named categories still have packages — remove or move those packages in Foundry, then re-run.';

PRINT N'Done. Remaining catalogue:';
SELECT COUNT(*) AS categories_remaining FROM dbo.pos_lens_categories;
SELECT COUNT(*) AS packages_remaining FROM dbo.pos_lens_packages;
SELECT COUNT(*) AS addons_remaining FROM dbo.pos_lens_addons;
GO
