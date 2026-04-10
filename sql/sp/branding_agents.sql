-- ─────────────────────────────────────────────────────────────────────────────
-- Stored procedures: Branding Agent master CRUD
-- ─────────────────────────────────────────────────────────────────────────────
USE [CosmosERP];
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_BrandingAgent_GetAll
-- Returns all active branding agents (or all including inactive when @include_inactive = 1).
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_BrandingAgent_GetAll','P') IS NOT NULL DROP PROCEDURE dbo.sp_BrandingAgent_GetAll;
GO
CREATE PROCEDURE dbo.sp_BrandingAgent_GetAll
  @include_inactive BIT = 0
AS BEGIN
  SET NOCOUNT ON;
  SELECT agent_id, agent_name, agent_code, city, contact_name, contact_phone, is_active, created_at, updated_at
  FROM dbo.branding_agents
  WHERE (@include_inactive = 1 OR is_active = 1)
  ORDER BY agent_name;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_BrandingAgent_GetById
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_BrandingAgent_GetById','P') IS NOT NULL DROP PROCEDURE dbo.sp_BrandingAgent_GetById;
GO
CREATE PROCEDURE dbo.sp_BrandingAgent_GetById
  @agent_id INT
AS BEGIN
  SET NOCOUNT ON;
  SELECT agent_id, agent_name, agent_code, city, contact_name, contact_phone, is_active, created_at, updated_at
  FROM dbo.branding_agents
  WHERE agent_id = @agent_id;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_BrandingAgent_Create
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_BrandingAgent_Create','P') IS NOT NULL DROP PROCEDURE dbo.sp_BrandingAgent_Create;
GO
CREATE PROCEDURE dbo.sp_BrandingAgent_Create
  @agent_name    NVARCHAR(200),
  @agent_code    VARCHAR(20),
  @city          NVARCHAR(100) = NULL,
  @contact_name  NVARCHAR(100) = NULL,
  @contact_phone VARCHAR(30)   = NULL
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF EXISTS (SELECT 1 FROM dbo.branding_agents WHERE agent_code = @agent_code)
    BEGIN RAISERROR('Agent code already exists.',16,1); RETURN; END;

    INSERT INTO dbo.branding_agents (agent_name, agent_code, city, contact_name, contact_phone)
    VALUES (@agent_name, @agent_code, @city, @contact_name, @contact_phone);

    SELECT agent_id, agent_name, agent_code, city, contact_name, contact_phone, is_active, created_at, updated_at
    FROM dbo.branding_agents WHERE agent_id = SCOPE_IDENTITY();
  END TRY
  BEGIN CATCH DECLARE @e NVARCHAR(4000) = ERROR_MESSAGE(); RAISERROR(@e,16,1); END CATCH;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_BrandingAgent_Update
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_BrandingAgent_Update','P') IS NOT NULL DROP PROCEDURE dbo.sp_BrandingAgent_Update;
GO
CREATE PROCEDURE dbo.sp_BrandingAgent_Update
  @agent_id      INT,
  @agent_name    NVARCHAR(200) = NULL,
  @agent_code    VARCHAR(20)   = NULL,
  @city          NVARCHAR(100) = NULL,
  @contact_name  NVARCHAR(100) = NULL,
  @contact_phone VARCHAR(30)   = NULL,
  @is_active     BIT           = NULL
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.branding_agents WHERE agent_id = @agent_id)
    BEGIN RAISERROR('Branding agent not found.',16,1); RETURN; END;

    IF @agent_code IS NOT NULL AND EXISTS (
      SELECT 1 FROM dbo.branding_agents WHERE agent_code = @agent_code AND agent_id <> @agent_id
    )
    BEGIN RAISERROR('Agent code already exists.',16,1); RETURN; END;

    UPDATE dbo.branding_agents SET
      agent_name    = ISNULL(@agent_name,    agent_name),
      agent_code    = ISNULL(@agent_code,    agent_code),
      city          = CASE WHEN @city          IS NOT NULL THEN @city          ELSE city          END,
      contact_name  = CASE WHEN @contact_name  IS NOT NULL THEN @contact_name  ELSE contact_name  END,
      contact_phone = CASE WHEN @contact_phone IS NOT NULL THEN @contact_phone ELSE contact_phone END,
      is_active     = ISNULL(@is_active,     is_active),
      updated_at    = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE agent_id = @agent_id;

    SELECT agent_id, agent_name, agent_code, city, contact_name, contact_phone, is_active, created_at, updated_at
    FROM dbo.branding_agents WHERE agent_id = @agent_id;
  END TRY
  BEGIN CATCH DECLARE @e NVARCHAR(4000) = ERROR_MESSAGE(); RAISERROR(@e,16,1); END CATCH;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_BrandingAgent_Deactivate
-- Soft-deletes an agent. Cannot deactivate if actively used on a dispatched purchase.
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_BrandingAgent_Deactivate','P') IS NOT NULL DROP PROCEDURE dbo.sp_BrandingAgent_Deactivate;
GO
CREATE PROCEDURE dbo.sp_BrandingAgent_Deactivate
  @agent_id INT
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.branding_agents WHERE agent_id = @agent_id)
    BEGIN RAISERROR('Branding agent not found.',16,1); RETURN; END;

    UPDATE dbo.branding_agents SET
      is_active  = 0,
      updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE agent_id = @agent_id;

    SELECT agent_id, agent_name, is_active FROM dbo.branding_agents WHERE agent_id = @agent_id;
  END TRY
  BEGIN CATCH DECLARE @e NVARCHAR(4000) = ERROR_MESSAGE(); RAISERROR(@e,16,1); END CATCH;
END;
GO
