-- Lens package POS card presentation (Foundry admin + Store OS Lenses step).
-- Run via scripts/deploy_pos_sql.js. Safe to re-run.

USE [CosmosERP];
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.pos_lens_packages') AND name = N'card_feat_line1'
)
  ALTER TABLE dbo.pos_lens_packages ADD card_feat_line1 NVARCHAR(250) NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.pos_lens_packages') AND name = N'card_feat_line2'
)
  ALTER TABLE dbo.pos_lens_packages ADD card_feat_line2 NVARCHAR(250) NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.pos_lens_packages') AND name = N'card_warranty_label'
)
  ALTER TABLE dbo.pos_lens_packages ADD card_warranty_label NVARCHAR(40) NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.pos_lens_packages') AND name = N'card_warranty_tone'
)
  ALTER TABLE dbo.pos_lens_packages ADD card_warranty_tone TINYINT NULL;
GO
