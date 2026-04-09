-- ─────────────────────────────────────────────────────────────────────────────
-- Table: dbo.branding_agents
-- Master list of external branding vendors (screen printers, label applicators, etc.)
-- that receive dispatched goods during Stage 3 of the procurement pipeline.
-- ─────────────────────────────────────────────────────────────────────────────
USE [CosmosERP];
GO

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.branding_agents') AND type = N'U')
BEGIN
  CREATE TABLE dbo.branding_agents (
    agent_id      INT IDENTITY(1,1)  NOT NULL,
    agent_name    NVARCHAR(200)       NOT NULL,
    agent_code    VARCHAR(20)         NOT NULL,
    city          NVARCHAR(100)       NULL,
    contact_name  NVARCHAR(100)       NULL,
    contact_phone VARCHAR(30)         NULL,
    is_active     BIT                 NOT NULL CONSTRAINT DF_branding_agents_is_active DEFAULT 1,
    created_at    DATETIME2           NOT NULL CONSTRAINT DF_branding_agents_created_at DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    updated_at    DATETIME2           NOT NULL CONSTRAINT DF_branding_agents_updated_at DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    CONSTRAINT PK_branding_agents PRIMARY KEY (agent_id),
    CONSTRAINT UQ_branding_agents_code UNIQUE (agent_code)
  );
  PRINT 'Table dbo.branding_agents created.';
END
ELSE
BEGIN
  PRINT 'Table dbo.branding_agents already exists — skipped.';
END;
GO
