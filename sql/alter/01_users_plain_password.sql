PRINT 'Altering users table to use plain VARCHAR password...';

USE [CosmosERP];

IF COL_LENGTH('dbo.users', 'password') IS NULL
BEGIN
  ALTER TABLE dbo.users
    ADD password VARCHAR(200) NULL;
END;

-- Note: we only add the column here. Seed script will set admin password.

