/*
  93_eye_tests_rx_v2.sql
  Rx v2: optional customer (walk-in), visitor link, family name slot, patient display name.
*/
PRINT N'--- 93_eye_tests_rx_v2.sql ---';

USE [CosmosERP];
GO

IF COL_LENGTH('dbo.eye_tests', 'visitor_id') IS NULL
BEGIN
  ALTER TABLE dbo.eye_tests ADD visitor_id INT NULL;
  PRINT N'Added eye_tests.visitor_id';
END
GO

IF COL_LENGTH('dbo.eye_tests', 'family_name_id') IS NULL
BEGIN
  ALTER TABLE dbo.eye_tests ADD family_name_id INT NULL;
  PRINT N'Added eye_tests.family_name_id';
END
GO

IF COL_LENGTH('dbo.eye_tests', 'patient_name') IS NULL
BEGIN
  ALTER TABLE dbo.eye_tests ADD patient_name NVARCHAR(100) NULL;
  PRINT N'Added eye_tests.patient_name';
END
GO

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.eye_tests') AND name = N'customer_id' AND is_nullable = 0
)
BEGIN
  ALTER TABLE dbo.eye_tests ALTER COLUMN customer_id INT NULL;
  PRINT N'eye_tests.customer_id is now nullable (walk-in Rx).';
END
GO

IF OBJECT_ID(N'dbo.store_visitors', N'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_et_visitor')
BEGIN
  ALTER TABLE dbo.eye_tests
    ADD CONSTRAINT FK_et_visitor FOREIGN KEY (visitor_id)
      REFERENCES dbo.store_visitors(visitor_id);
  PRINT N'Added FK_et_visitor';
END
GO

IF OBJECT_ID(N'dbo.pos_customer_family_names', N'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_et_family_name')
BEGIN
  ALTER TABLE dbo.eye_tests
    ADD CONSTRAINT FK_et_family_name FOREIGN KEY (family_name_id)
      REFERENCES dbo.pos_customer_family_names(family_name_id);
  PRINT N'Added FK_et_family_name';
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'IX_et_visitor' AND object_id = OBJECT_ID(N'dbo.eye_tests')
)
BEGIN
  CREATE INDEX IX_et_visitor ON dbo.eye_tests(visitor_id, tested_at DESC);
  PRINT N'Created IX_et_visitor';
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'IX_et_family_name' AND object_id = OBJECT_ID(N'dbo.eye_tests')
)
BEGIN
  CREATE INDEX IX_et_family_name ON dbo.eye_tests(family_name_id);
  PRINT N'Created IX_et_family_name';
END
GO

PRINT N'--- 93_eye_tests_rx_v2.sql complete ---';
GO
