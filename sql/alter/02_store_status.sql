PRINT 'Altering stores table to add status column...';
GO

USE [CosmosERP];
GO

IF COL_LENGTH('dbo.stores', 'status') IS NULL
BEGIN
  ALTER TABLE dbo.stores
  ADD status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

  EXEC ('
    UPDATE dbo.stores
    SET status =
      CASE
        WHEN is_active = 0 THEN ''INACTIVE''
        ELSE ''ACTIVE''
      END;
  ');
END;
GO

