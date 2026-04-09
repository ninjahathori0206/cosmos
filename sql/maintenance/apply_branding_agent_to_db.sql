-- ══════════════════════════════════════════════════════════════════════════
-- apply_branding_agent_to_db.sql
-- Run this once to apply the branding_agent_id changes to an existing DB.
-- Safe to re-run — all steps are guarded with IF NOT EXISTS / DROP+CREATE.
-- ══════════════════════════════════════════════════════════════════════════

-- 1) Create branding_agents table (if not already created)
IF OBJECT_ID('dbo.branding_agents', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.branding_agents (
    agent_id      INT IDENTITY(1,1)  NOT NULL,
    agent_name    NVARCHAR(200)       NOT NULL,
    agent_code    VARCHAR(20)         NOT NULL,
    city          NVARCHAR(100)       NULL,
    contact_name  NVARCHAR(100)       NULL,
    contact_phone VARCHAR(30)         NULL,
    is_active     BIT                 NOT NULL CONSTRAINT DF_branding_agents_is_active    DEFAULT 1,
    created_at    DATETIME2           NOT NULL CONSTRAINT DF_branding_agents_created_at   DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    updated_at    DATETIME2           NOT NULL CONSTRAINT DF_branding_agents_updated_at   DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    CONSTRAINT PK_branding_agents      PRIMARY KEY (agent_id),
    CONSTRAINT UQ_branding_agents_code UNIQUE      (agent_code)
  );
  PRINT 'Created dbo.branding_agents';
END
ELSE
  PRINT 'dbo.branding_agents already exists — skipped';
GO

-- 2) Add branding_agent_id column to purchase_headers (if not already added)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'branding_agent_id'
)
BEGIN
  ALTER TABLE dbo.purchase_headers
    ADD branding_agent_id INT NULL
      CONSTRAINT FK_purchase_headers_branding_agent
      FOREIGN KEY REFERENCES dbo.branding_agents(agent_id);
  PRINT 'Added branding_agent_id column to dbo.purchase_headers';
END
ELSE
  PRINT 'branding_agent_id column already exists — skipped';
GO

-- 3) Recreate sp_PurchaseHeader_BrandingDispatch with @branding_agent_id param
IF OBJECT_ID('dbo.sp_PurchaseHeader_BrandingDispatch','P') IS NOT NULL
  DROP PROCEDURE dbo.sp_PurchaseHeader_BrandingDispatch;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_BrandingDispatch
  @header_id             INT,
  @branding_instructions VARCHAR(500) = NULL,
  @branding_agent_id     INT          = NULL
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (
      SELECT 1 FROM dbo.purchase_headers
      WHERE header_id = @header_id AND pipeline_status = 'PENDING_BRANDING'
    )
    BEGIN
      RAISERROR('Branding dispatch only allowed at PENDING_BRANDING stage.', 16, 1);
      RETURN;
    END;

    UPDATE dbo.purchase_headers SET
      branding_instructions = @branding_instructions,
      branding_agent_id     = @branding_agent_id,
      pipeline_status       = 'BRANDING_DISPATCHED',
      dispatched_at         = DATEADD(MINUTE, 330, SYSUTCDATETIME()),
      updated_at            = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE header_id = @header_id;

    SELECT h.header_id, h.pipeline_status, h.dispatched_at,
           ba.agent_name AS branding_agent_name
    FROM dbo.purchase_headers h
    LEFT JOIN dbo.branding_agents ba ON h.branding_agent_id = ba.agent_id
    WHERE h.header_id = @header_id;
  END TRY
  BEGIN CATCH
    DECLARE @e NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@e, 16, 1);
  END CATCH;
END;
GO
PRINT 'Recreated dbo.sp_PurchaseHeader_BrandingDispatch with @branding_agent_id';
