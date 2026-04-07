-- Migration 22: role_module_access table
-- Stores which Cosmos modules each role may access.
-- Effective module access for a user = role_module_access AND (store_module_access if store-scoped).

USE [CosmosERP];
GO

IF OBJECT_ID('dbo.role_module_access', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.role_module_access (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    role_key    VARCHAR(50)  NOT NULL,
    module_key  VARCHAR(50)  NOT NULL,
    is_enabled  BIT          NOT NULL DEFAULT 1,
    created_at  DATETIME     NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    updated_at  DATETIME     NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    CONSTRAINT FK_role_module_access_role
      FOREIGN KEY (role_key) REFERENCES dbo.roles(role_key),
    CONSTRAINT UQ_role_module_access
      UNIQUE (role_key, module_key)
  );
  PRINT 'Created dbo.role_module_access';
END
ELSE
BEGIN
  PRINT 'dbo.role_module_access already exists — skipped';
END;
GO
