/*
  Migration 79 — Army application joining availability fields

  Deploy: npm run migrate:79-army-application-joining
*/
USE [CosmosERP];
GO

SET NOCOUNT ON;
PRINT N'Migration 79: Army application joining availability';
GO

IF COL_LENGTH(N'dbo.army_applications', N'joining_availability_key') IS NULL
BEGIN
  ALTER TABLE dbo.army_applications ADD
    joining_availability_key NVARCHAR(20) NOT NULL
      CONSTRAINT DF_army_applications_joining DEFAULT N'INSTANT',
    notice_period_days INT NULL,
    expected_join_date DATE NULL;
  PRINT N'Migration 79: added joining columns to army_applications';
END
ELSE
  PRINT N'Migration 79: joining columns already exist — skipped';
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE name = N'CK_army_applications_joining_key'
)
BEGIN
  ALTER TABLE dbo.army_applications ADD CONSTRAINT CK_army_applications_joining_key
    CHECK (joining_availability_key IN (N'INSTANT', N'ON_NOTICE'));
  PRINT N'Migration 79: added joining_availability_key check';
END
GO

PRINT N'Migration 79 complete.';
GO
