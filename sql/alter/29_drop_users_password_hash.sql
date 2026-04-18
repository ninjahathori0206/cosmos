PRINT 'Dropping legacy password_hash from dbo.users (password VARCHAR is canonical)...';
GO

USE [CosmosERP];
GO

IF COL_LENGTH('dbo.users', 'password_hash') IS NOT NULL
BEGIN
  ALTER TABLE dbo.users DROP COLUMN password_hash;
  PRINT 'Dropped column password_hash.';
END
ELSE
BEGIN
  PRINT 'Column password_hash not present — nothing to do.';
END
GO
