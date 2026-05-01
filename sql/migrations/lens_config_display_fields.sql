-- Lens catalogue: POS vs internal naming (Foundry admin + POS display labels).
-- Run before sql/sp/pos.sql (see scripts/deploy_pos_sql.js). Safe to re-run.

USE [CosmosERP];
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.pos_lens_categories') AND name = N'pos_brand'
)
  ALTER TABLE dbo.pos_lens_categories ADD pos_brand NVARCHAR(100) NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.pos_lens_categories') AND name = N'pos_name'
)
  ALTER TABLE dbo.pos_lens_categories ADD pos_name NVARCHAR(100) NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.pos_lens_categories') AND name = N'internal_brand'
)
  ALTER TABLE dbo.pos_lens_categories ADD internal_brand NVARCHAR(100) NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.pos_lens_categories') AND name = N'internal_name'
)
  ALTER TABLE dbo.pos_lens_categories ADD internal_name NVARCHAR(100) NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.pos_lens_categories') AND name = N'notes'
)
  ALTER TABLE dbo.pos_lens_categories ADD notes NVARCHAR(500) NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.pos_lens_packages') AND name = N'pos_brand'
)
  ALTER TABLE dbo.pos_lens_packages ADD pos_brand NVARCHAR(100) NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.pos_lens_packages') AND name = N'pos_name'
)
  ALTER TABLE dbo.pos_lens_packages ADD pos_name NVARCHAR(100) NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.pos_lens_packages') AND name = N'internal_brand'
)
  ALTER TABLE dbo.pos_lens_packages ADD internal_brand NVARCHAR(100) NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.pos_lens_packages') AND name = N'internal_name'
)
  ALTER TABLE dbo.pos_lens_packages ADD internal_name NVARCHAR(100) NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.pos_lens_addons') AND name = N'pos_brand'
)
  ALTER TABLE dbo.pos_lens_addons ADD pos_brand NVARCHAR(100) NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.pos_lens_addons') AND name = N'pos_name'
)
  ALTER TABLE dbo.pos_lens_addons ADD pos_name NVARCHAR(100) NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.pos_lens_addons') AND name = N'internal_brand'
)
  ALTER TABLE dbo.pos_lens_addons ADD internal_brand NVARCHAR(100) NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.pos_lens_addons') AND name = N'internal_name'
)
  ALTER TABLE dbo.pos_lens_addons ADD internal_name NVARCHAR(100) NULL;
GO

-- Backfill from legacy `name` where new fields are empty
UPDATE dbo.pos_lens_categories
SET
  pos_brand      = ISNULL(NULLIF(LTRIM(RTRIM(pos_brand)), N''), N''),
  pos_name       = COALESCE(NULLIF(LTRIM(RTRIM(pos_name)), N''), name),
  internal_brand = ISNULL(NULLIF(LTRIM(RTRIM(internal_brand)), N''), N''),
  internal_name  = COALESCE(NULLIF(LTRIM(RTRIM(internal_name)), N''), name);

UPDATE dbo.pos_lens_packages
SET
  pos_brand      = ISNULL(NULLIF(LTRIM(RTRIM(pos_brand)), N''), N''),
  pos_name       = COALESCE(NULLIF(LTRIM(RTRIM(pos_name)), N''), name),
  internal_brand = ISNULL(NULLIF(LTRIM(RTRIM(internal_brand)), N''), N''),
  internal_name  = COALESCE(NULLIF(LTRIM(RTRIM(internal_name)), N''), name);

UPDATE dbo.pos_lens_addons
SET
  pos_brand      = ISNULL(NULLIF(LTRIM(RTRIM(pos_brand)), N''), N''),
  pos_name       = COALESCE(NULLIF(LTRIM(RTRIM(pos_name)), N''), name),
  internal_brand = ISNULL(NULLIF(LTRIM(RTRIM(internal_brand)), N''), N''),
  internal_name  = COALESCE(NULLIF(LTRIM(RTRIM(internal_name)), N''), name);
GO
