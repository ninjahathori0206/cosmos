/*
  Migration 45 — Canonical credential column on dbo.users

  After this migration the only column holding staff password material is
  dbo.users.password_hash (bcrypt or legacy plain text during migration).

  Handles:
    A) Legacy dual-column DBs (password + password_hash from older alter scripts):
       merge into password_hash, drop password.
    B) Single-column DBs with dbo.users.password only:
       rename column to password_hash via sp_rename.

  Note: merge UPDATE runs via sp_executesql so SQL Server does not compile it when
  only dbo.users.password exists (otherwise "Invalid column name 'password_hash'").

  Deploy: run once against CosmosERP, then redeploy sql/sp/auth.sql and sql/sp/users.sql.
*/

PRINT N'Migration 45: dbo.users password column → password_hash';
GO

USE [CosmosERP];
GO

IF COL_LENGTH(N'dbo.users', N'password') IS NOT NULL
   AND COL_LENGTH(N'dbo.users', N'password_hash') IS NOT NULL
BEGIN
  PRINT N'Migration 45: consolidating password + password_hash';
  EXEC sp_executesql N'
    UPDATE dbo.users
    SET password_hash = CASE
          WHEN password IS NOT NULL AND LEN(LTRIM(RTRIM(password))) > 0
            THEN password
          ELSE password_hash
        END;
  ';
  EXEC sp_executesql N'ALTER TABLE dbo.users DROP COLUMN password;';
END
ELSE IF COL_LENGTH(N'dbo.users', N'password') IS NOT NULL
        AND COL_LENGTH(N'dbo.users', N'password_hash') IS NULL
BEGIN
  PRINT N'Migration 45: renaming password → password_hash';
  EXEC sp_rename N'dbo.users.password', N'password_hash', N'COLUMN';
END
ELSE
BEGIN
  PRINT N'Migration 45: already on password_hash-only schema — nothing to do.';
END
GO
