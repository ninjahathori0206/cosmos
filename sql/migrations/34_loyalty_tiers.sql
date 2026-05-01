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

-- Seed tiers
IF NOT EXISTS (SELECT 1 FROM dbo.loyalty_tiers WHERE tier_name = N'Silver')
BEGIN
  INSERT INTO dbo.loyalty_tiers (tier_name, min_points, max_points, color_token, display_order)
  VALUES
    (N'Silver',   0,    999,  N'gray',   1),
    (N'Gold',     1000, 4999, N'gold',   2),
    (N'Platinum', 5000, -1,   N'blue',   3);
  PRINT 'Loyalty tiers seeded: Silver, Gold, Platinum.';
END
GO
