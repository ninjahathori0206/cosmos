PRINT 'Creating membership_plans and membership_plan_benefits tables...';

USE [CosmosERP];
GO

IF OBJECT_ID('dbo.membership_plans', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.membership_plans (
    plan_id        INT IDENTITY(1,1) PRIMARY KEY,
    plan_key       NVARCHAR(50)   NOT NULL,
    display_name   NVARCHAR(100)  NOT NULL,
    price          DECIMAL(10,2)  NOT NULL,
    validity_days  INT            NOT NULL,
    max_dependents INT            NOT NULL DEFAULT 5,
    is_active      BIT            NOT NULL DEFAULT 1,
    created_at     DATETIME       NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT UQ_membership_plans_key UNIQUE (plan_key)
  );
  PRINT 'membership_plans table created.';
END
ELSE
  PRINT 'membership_plans table already exists — skipped.';
GO

-- Seed the initial Eyewoot Plus plan
IF NOT EXISTS (SELECT 1 FROM dbo.membership_plans WHERE plan_key = N'PLUS')
BEGIN
  INSERT INTO dbo.membership_plans (plan_key, display_name, price, validity_days, max_dependents, is_active)
  VALUES (N'PLUS', N'Eyewoot Plus', 999.00, 365, 5, 1);
  PRINT 'Seeded Eyewoot Plus plan.';
END
GO

IF OBJECT_ID('dbo.membership_plan_benefits', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.membership_plan_benefits (
    benefit_id    INT IDENTITY(1,1) PRIMARY KEY,
    plan_key      NVARCHAR(50)   NOT NULL,
    icon_emoji    NVARCHAR(10)   NOT NULL,
    title         NVARCHAR(200)  NOT NULL,
    description   NVARCHAR(500)  NOT NULL,
    sort_order    INT            NOT NULL DEFAULT 0,
    is_active     BIT            NOT NULL DEFAULT 1,
    CONSTRAINT FK_mpb_plan FOREIGN KEY (plan_key) REFERENCES dbo.membership_plans(plan_key)
  );
  PRINT 'membership_plan_benefits table created.';
END
ELSE
  PRINT 'membership_plan_benefits table already exists — skipped.';
GO

-- Seed benefits for PLUS plan
IF NOT EXISTS (SELECT 1 FROM dbo.membership_plan_benefits WHERE plan_key = N'PLUS')
BEGIN
  INSERT INTO dbo.membership_plan_benefits (plan_key, icon_emoji, title, description, sort_order)
  VALUES
    (N'PLUS', N'🎯', N'20% off all frames', N'All brands · Any store · Stackable with loyalty', 1),
    (N'PLUS', N'🔬', N'Free annual eye test', N'1 free comprehensive eye examination per year at any store', 2),
    (N'PLUS', N'✨', N'Free lens upgrade', N'Anti-reflective coating on orders above ₹2,000', 3),
    (N'PLUS', N'⭐', N'Priority appointments', N'Skip the queue at any Eyewoot store', 4);
  PRINT 'Seeded Eyewoot Plus benefits.';
END
GO
