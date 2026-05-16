/*
  Store OS — tablet JWT revocation + long-lived device binding.
  After deploy, run sql/sp/pos.sql so SPs match (sp_POS_ValidateTabletPin, reset, deactivate, validate session).
*/
USE [CosmosERP];
GO

IF COL_LENGTH('dbo.tablets', 'tablet_session_version') IS NULL
BEGIN
  ALTER TABLE dbo.tablets ADD tablet_session_version INT NOT NULL
    CONSTRAINT DF_tablets_tablet_session_version DEFAULT (0);
END;
GO
