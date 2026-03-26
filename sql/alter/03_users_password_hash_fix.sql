PRINT 'Making password_hash nullable (legacy column — password column is canonical)...';
GO

USE [CosmosERP];
GO

-- password_hash was the original column; password is the plain-text VARCHAR column.
-- We make password_hash nullable so new inserts via sp_User_Create work without it.
IF COL_LENGTH('dbo.users', 'password_hash') IS NOT NULL
BEGIN
  EXEC ('ALTER TABLE dbo.users ALTER COLUMN password_hash VARCHAR(200) NULL');
END;
GO

-- Backfill password column for any existing rows that have it NULL
IF COL_LENGTH('dbo.users', 'password') IS NOT NULL
BEGIN
  EXEC ('UPDATE dbo.users SET password = password_hash WHERE password IS NULL AND password_hash IS NOT NULL');
END;
GO
