PRINT 'Legacy alter: optional dbo.users.password column (skipped when password_hash exists)...';

USE [CosmosERP];

IF COL_LENGTH('dbo.users', 'password') IS NULL
BEGIN
  IF COL_LENGTH('dbo.users', 'password_hash') IS NOT NULL
  BEGIN
    PRINT 'dbo.users.password_hash present — skipping legacy password column add.';
  END
  ELSE
  BEGIN
    ALTER TABLE dbo.users
      ADD password VARCHAR(200) NULL;
  END
END;

-- Modern installs store bcrypt in password_hash (see sql/tables/01_shared_core.sql, migrations/45_users_rename_password_to_password_hash.sql).
