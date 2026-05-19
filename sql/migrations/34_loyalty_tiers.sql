PRINT 'Creating loyalty_tiers table...';

USE [CosmosERP];
GO

IF OBJECT_ID('dbo.loyalty_tiers', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.loyalty_tiers (
    tier_id       INT IDENTITY(1,1) PRIMARY KEY,
    tier_name     NVARCHAR(50)   NOT NULL,
    min_points    INT            NOT NULL,
    -- max_points = -1 means unlimited (top tier)
    max_points    INT            NOT NULL,
    color_token   NVARCHAR(30)   NOT NULL DEFAULT N'gray',
    display_order INT            NOT NULL DEFAULT 0,
    CONSTRAINT UQ_loyalty_tiers_name UNIQUE (tier_name)
  );
  PRINT 'loyalty_tiers table created.';
END
ELSE
  PRINT 'loyalty_tiers table already exists — skipped.';
GO
