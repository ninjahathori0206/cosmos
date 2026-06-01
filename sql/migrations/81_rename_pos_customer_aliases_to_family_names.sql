/*
  81_rename_pos_customer_aliases_to_family_names.sql
  Renames dbo.pos_customer_aliases → dbo.pos_customer_family_names (family name rebrand).
  Idempotent: skips if new table already exists.
*/
PRINT N'--- 81_rename_pos_customer_aliases_to_family_names.sql ---';

USE [CosmosERP];
GO

IF OBJECT_ID(N'dbo.pos_customer_family_names', N'U') IS NOT NULL
BEGIN
  PRINT N'pos_customer_family_names already exists — skipped.';
END
ELSE IF OBJECT_ID(N'dbo.pos_customer_aliases', N'U') IS NOT NULL
BEGIN
  EXEC sp_rename N'dbo.pos_customer_aliases', N'pos_customer_family_names';

  EXEC sp_rename N'dbo.pos_customer_family_names.alias_id', N'family_name_id', N'COLUMN';
  EXEC sp_rename N'dbo.pos_customer_family_names.alias_name', N'family_name', N'COLUMN';

  IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = N'PK_pos_customer_aliases')
    EXEC sp_rename N'PK_pos_customer_aliases', N'PK_pos_customer_family_names', N'OBJECT';

  IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_pos_customer_aliases_customer')
    EXEC sp_rename N'FK_pos_customer_aliases_customer', N'FK_pos_customer_family_names_customer', N'OBJECT';

  IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = N'UQ_pos_customer_alias_name')
    EXEC sp_rename N'UQ_pos_customer_alias_name', N'UQ_pos_customer_family_name', N'OBJECT';

  IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pos_customer_aliases_customer' AND object_id = OBJECT_ID(N'dbo.pos_customer_family_names'))
    EXEC sp_rename N'dbo.pos_customer_family_names.IX_pos_customer_aliases_customer', N'IX_pos_customer_family_names_customer', N'INDEX';

  IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pos_customer_aliases_name' AND object_id = OBJECT_ID(N'dbo.pos_customer_family_names'))
    EXEC sp_rename N'dbo.pos_customer_family_names.IX_pos_customer_aliases_name', N'IX_pos_customer_family_names_name', N'INDEX';

  PRINT N'Renamed pos_customer_aliases → pos_customer_family_names.';
END
ELSE
BEGIN
  CREATE TABLE dbo.pos_customer_family_names (
    family_name_id     INT IDENTITY(1, 1) NOT NULL,
    customer_id        INT            NOT NULL,
    family_name        NVARCHAR(200)  NOT NULL,
    created_at         DATETIME2(0)   NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    created_by_user_id INT            NULL,
    CONSTRAINT PK_pos_customer_family_names PRIMARY KEY (family_name_id),
    CONSTRAINT FK_pos_customer_family_names_customer FOREIGN KEY (customer_id)
      REFERENCES dbo.pos_customers(customer_id),
    CONSTRAINT UQ_pos_customer_family_name UNIQUE (customer_id, family_name)
  );
  CREATE INDEX IX_pos_customer_family_names_customer ON dbo.pos_customer_family_names(customer_id);
  CREATE INDEX IX_pos_customer_family_names_name ON dbo.pos_customer_family_names(family_name);
  PRINT N'Created dbo.pos_customer_family_names (no legacy aliases table).';
END
GO

PRINT N'--- 81_rename_pos_customer_aliases_to_family_names.sql complete ---';
GO
