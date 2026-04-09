-- ══════════════════════════════════════════════════════════════════════
-- fix_branding_dispatch_sp.sql
-- Run this entire file in SSMS to fix the "too many arguments" error.
-- No GO separators — paste and execute as a single batch.
-- ══════════════════════════════════════════════════════════════════════

-- Step 1: Create branding_agents table if it does not exist
IF OBJECT_ID('dbo.branding_agents', 'U') IS NULL
  EXEC('
    CREATE TABLE dbo.branding_agents (
      agent_id      INT IDENTITY(1,1) NOT NULL,
      agent_name    NVARCHAR(200)     NOT NULL,
      agent_code    VARCHAR(20)       NOT NULL,
      city          NVARCHAR(100)     NULL,
      contact_name  NVARCHAR(100)     NULL,
      contact_phone VARCHAR(30)       NULL,
      is_active     BIT               NOT NULL DEFAULT 1,
      created_at    DATETIME2         NOT NULL DEFAULT DATEADD(MINUTE,330,SYSUTCDATETIME()),
      updated_at    DATETIME2         NOT NULL DEFAULT DATEADD(MINUTE,330,SYSUTCDATETIME()),
      CONSTRAINT PK_branding_agents      PRIMARY KEY (agent_id),
      CONSTRAINT UQ_branding_agents_code UNIQUE      (agent_code)
    )
  ')

-- Step 2: Add branding_agent_id column to purchase_headers if it does not exist
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'branding_agent_id'
)
  EXEC('ALTER TABLE dbo.purchase_headers ADD branding_agent_id INT NULL')

-- Step 3: Drop old SP
IF OBJECT_ID('dbo.sp_PurchaseHeader_BrandingDispatch', 'P') IS NOT NULL
  EXEC('DROP PROCEDURE dbo.sp_PurchaseHeader_BrandingDispatch')

-- Step 4: Recreate SP with the new @branding_agent_id parameter
EXEC('
CREATE PROCEDURE dbo.sp_PurchaseHeader_BrandingDispatch
  @header_id             INT,
  @branding_instructions VARCHAR(500) = NULL,
  @branding_agent_id     INT          = NULL
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (
      SELECT 1 FROM dbo.purchase_headers
      WHERE header_id = @header_id AND pipeline_status = ''PENDING_BRANDING''
    )
    BEGIN
      RAISERROR(''Branding dispatch only allowed at PENDING_BRANDING stage.'', 16, 1);
      RETURN;
    END;

    UPDATE dbo.purchase_headers SET
      branding_instructions = @branding_instructions,
      branding_agent_id     = @branding_agent_id,
      pipeline_status       = ''BRANDING_DISPATCHED'',
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
END
')

PRINT 'Done — sp_PurchaseHeader_BrandingDispatch updated successfully.'
