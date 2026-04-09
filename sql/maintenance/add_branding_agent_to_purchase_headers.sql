/*
  Migration: add branding_agent_id column to dbo.purchase_headers.

  This column records which Branding Agent a purchase was dispatched to
  during Stage 3 (Branding Dispatch) of the procurement pipeline.

  Idempotent — safe to re-run.

  Run via sqlcmd:
    sqlcmd -S <host>,<port> -U <user> -P <password> -d CosmosERP \
      -i sql/maintenance/add_branding_agent_to_purchase_headers.sql

  Prerequisites:
    - sql/tables/branding_agents.sql must have been run first.
*/
USE [CosmosERP];
GO

-- Add branding_agent_id column (nullable FK) if it does not already exist
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.purchase_headers')
    AND name = N'branding_agent_id'
)
BEGIN
  ALTER TABLE dbo.purchase_headers
    ADD branding_agent_id INT NULL
      CONSTRAINT FK_purchase_headers_branding_agent
      FOREIGN KEY REFERENCES dbo.branding_agents(agent_id);
  PRINT 'Column branding_agent_id added to dbo.purchase_headers.';
END
ELSE
BEGIN
  PRINT 'Column branding_agent_id already exists — skipped.';
END;
GO
