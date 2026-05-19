/*
  Migration 49 — is_active on store_type_catalog (soft deactivate in Command Unit)

  Deploy: npm run migrate:49-store-type-catalog-is-active
*/
USE [CosmosERP];
GO

IF COL_LENGTH(N'dbo.store_type_catalog', N'is_active') IS NULL
BEGIN
  ALTER TABLE dbo.store_type_catalog
  ADD is_active BIT NOT NULL
    CONSTRAINT DF_store_type_catalog_is_active DEFAULT (1);
  PRINT N'Migration 49: added store_type_catalog.is_active';
END
ELSE
  PRINT N'Migration 49: store_type_catalog.is_active already exists — skipped';
GO

PRINT N'Migration 49: complete.';
GO
