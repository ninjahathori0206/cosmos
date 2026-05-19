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
