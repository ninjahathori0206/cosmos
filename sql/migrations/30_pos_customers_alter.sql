PRINT 'Altering pos_customers — adding dob and lifestyle_prefs...';

USE [CosmosERP];
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.pos_customers') AND name = 'dob'
)
BEGIN
  ALTER TABLE dbo.pos_customers ADD dob DATE NULL;
  PRINT 'Column dob added to pos_customers.';
END
ELSE
  PRINT 'Column dob already exists — skipped.';
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.pos_customers') AND name = 'lifestyle_prefs'
)
BEGIN
  -- JSON: {"screen_hrs":"8-10","frame_pref":"Rimless","budget_min":3000,"budget_max":8000}
  ALTER TABLE dbo.pos_customers ADD lifestyle_prefs NVARCHAR(MAX) NULL;
  PRINT 'Column lifestyle_prefs added to pos_customers.';
END
ELSE
  PRINT 'Column lifestyle_prefs already exists — skipped.';
GO
