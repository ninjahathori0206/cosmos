PRINT 'Creating customer_memberships and customer_membership_dependents tables...';

USE [CosmosERP];
GO

IF OBJECT_ID('dbo.customer_memberships', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.customer_memberships (
    membership_id  INT IDENTITY(1,1) PRIMARY KEY,
    customer_id    INT            NOT NULL,
    plan_key       NVARCHAR(50)   NOT NULL,
    purchased_at   DATETIME       NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    expires_at     DATETIME       NOT NULL,
    price_paid     DECIMAL(10,2)  NOT NULL,
    is_active      BIT            NOT NULL DEFAULT 1,
    created_by_user_id INT        NULL,
    created_at     DATETIME       NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_cm_customer FOREIGN KEY (customer_id)
      REFERENCES dbo.pos_customers(customer_id),
    CONSTRAINT FK_cm_plan FOREIGN KEY (plan_key)
      REFERENCES dbo.membership_plans(plan_key),
    CONSTRAINT FK_cm_created_by FOREIGN KEY (created_by_user_id)
      REFERENCES dbo.users(user_id)
  );
  CREATE INDEX IX_cm_customer ON dbo.customer_memberships(customer_id);
  PRINT 'customer_memberships table created.';
END
ELSE
  PRINT 'customer_memberships table already exists — skipped.';
GO

IF OBJECT_ID('dbo.customer_membership_dependents', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.customer_membership_dependents (
    dependent_id   INT IDENTITY(1,1) PRIMARY KEY,
    membership_id  INT            NOT NULL,
    customer_id    INT            NOT NULL,
    relationship   NVARCHAR(50)   NOT NULL,
    added_at       DATETIME       NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_cmd_membership FOREIGN KEY (membership_id)
      REFERENCES dbo.customer_memberships(membership_id) ON DELETE CASCADE,
    CONSTRAINT FK_cmd_customer FOREIGN KEY (customer_id)
      REFERENCES dbo.pos_customers(customer_id),
    CONSTRAINT UQ_cmd_membership_customer UNIQUE (membership_id, customer_id)
  );
  PRINT 'customer_membership_dependents table created.';
END
ELSE
  PRINT 'customer_membership_dependents table already exists — skipped.';
GO
