/*
  Migration 89 — Store bank account opening balance (Collection Book)

  Deploy: npm run migrate:89-store-bank-opening-balance
*/
USE [CosmosERP];
GO

SET NOCOUNT ON;
PRINT N'Migration 89: store_bank_accounts.opening_balance';
GO

IF COL_LENGTH('dbo.store_bank_accounts', 'opening_balance') IS NULL
BEGIN
  ALTER TABLE dbo.store_bank_accounts
    ADD opening_balance DECIMAL(12,2) NOT NULL
      CONSTRAINT DF_store_bank_accounts_opening_balance DEFAULT (0);
  PRINT N'Migration 89: added opening_balance column';
END
ELSE
  PRINT N'Migration 89: opening_balance already exists — skipped';
GO

PRINT N'Migration 89 complete.';
GO
