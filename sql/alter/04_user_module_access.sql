-- Migration: add user_module_access table
USE [CosmosERP];
GO

IF OBJECT_ID('dbo.user_module_access', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.user_module_access (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    user_id     INT NOT NULL,
    module_key  VARCHAR(50) NOT NULL,
    is_enabled  BIT NOT NULL DEFAULT 1,
    created_at  DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at  DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_user_module_access_user
      FOREIGN KEY (user_id) REFERENCES dbo.users(user_id),
    CONSTRAINT UQ_user_module_access
      UNIQUE (user_id, module_key)
  );
  PRINT 'Created dbo.user_module_access';
END
ELSE
  PRINT 'dbo.user_module_access already exists — skipped';
GO
