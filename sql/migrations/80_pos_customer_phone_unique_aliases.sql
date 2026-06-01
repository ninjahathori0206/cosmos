/*
  80_pos_customer_phone_unique_aliases.sql
  ----------------------------------------
  Alternate names for one pos_customers row (one active mobile per customer).
  Run merge script before creating UQ_pos_customers_phone_active on production data.
*/
PRINT N'--- 80_pos_customer_phone_unique_aliases.sql ---';

USE [CosmosERP];
GO

IF OBJECT_ID(N'dbo.pos_customer_aliases', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_customer_aliases (
    alias_id           INT IDENTITY(1, 1) NOT NULL,
    customer_id        INT            NOT NULL,
    alias_name         NVARCHAR(200)  NOT NULL,
    created_at         DATETIME2(0)   NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    created_by_user_id INT            NULL,
    CONSTRAINT PK_pos_customer_aliases PRIMARY KEY (alias_id),
    CONSTRAINT FK_pos_customer_aliases_customer FOREIGN KEY (customer_id)
      REFERENCES dbo.pos_customers(customer_id),
    CONSTRAINT UQ_pos_customer_alias_name UNIQUE (customer_id, alias_name)
  );
  CREATE INDEX IX_pos_customer_aliases_customer ON dbo.pos_customer_aliases(customer_id);
  CREATE INDEX IX_pos_customer_aliases_name ON dbo.pos_customer_aliases(alias_name);
  PRINT N'Created dbo.pos_customer_aliases.';
END
GO

PRINT N'--- 80_pos_customer_phone_unique_aliases.sql complete ---';
GO
