/*
  Migration 80 — Army HR interview stage templates + application interviews

  Deploy: npm run migrate:80-army-interview-templates
*/
USE [CosmosERP];
GO

SET NOCOUNT ON;
PRINT N'Migration 80: Army HR interview templates';
GO

IF OBJECT_ID(N'dbo.army_interview_templates', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_interview_templates (
    interview_template_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name                  NVARCHAR(120)    NOT NULL,
    description           NVARCHAR(500)    NULL,
    is_active             BIT              NOT NULL DEFAULT 1,
    created_by            INT              NULL,
    created_at            DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_at            DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME()))
  );
  CREATE INDEX IX_army_interview_templates_active ON dbo.army_interview_templates(is_active, name);
  PRINT N'Migration 80: created army_interview_templates';
END
ELSE
  PRINT N'Migration 80: army_interview_templates already exists — skipped';
GO

IF OBJECT_ID(N'dbo.army_interview_template_stages', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_interview_template_stages (
    template_stage_id     INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    interview_template_id INT              NOT NULL,
    sort_order            INT              NOT NULL,
    stage_name            NVARCHAR(120)    NOT NULL,
    interviewer_role_key  NVARCHAR(30)     NOT NULL,
    mode_key              NVARCHAR(30)     NOT NULL DEFAULT N'IN_PERSON',
    CONSTRAINT FK_army_it_stages_template FOREIGN KEY (interview_template_id)
      REFERENCES dbo.army_interview_templates(interview_template_id) ON DELETE CASCADE,
    CONSTRAINT CK_army_it_stages_role CHECK (interviewer_role_key IN (
      N'HR_ADMIN', N'STORE_MANAGER', N'REGIONAL_MANAGER', N'HQ_PANEL', N'TECHNICAL'
    )),
    CONSTRAINT CK_army_it_stages_mode CHECK (mode_key IN (N'IN_PERSON'))
  );
  CREATE UNIQUE INDEX UQ_army_it_stages_order
    ON dbo.army_interview_template_stages(interview_template_id, sort_order);
  PRINT N'Migration 80: created army_interview_template_stages';
END
ELSE
  PRINT N'Migration 80: army_interview_template_stages already exists — skipped';
GO

IF COL_LENGTH(N'dbo.army_job_openings', N'interview_template_id') IS NULL
BEGIN
  ALTER TABLE dbo.army_job_openings
    ADD interview_template_id INT NULL;
  ALTER TABLE dbo.army_job_openings
    ADD CONSTRAINT FK_army_job_openings_interview_template FOREIGN KEY (interview_template_id)
      REFERENCES dbo.army_interview_templates(interview_template_id);
  PRINT N'Migration 80: added army_job_openings.interview_template_id';
END
ELSE
  PRINT N'Migration 80: army_job_openings.interview_template_id already exists — skipped';
GO

IF OBJECT_ID(N'dbo.army_application_interviews', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_application_interviews (
    application_interview_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    application_id           INT              NOT NULL,
    sort_order               INT              NOT NULL,
    stage_name               NVARCHAR(120)    NOT NULL,
    interviewer_role_key     NVARCHAR(30)     NOT NULL,
    mode_key                 NVARCHAR(30)     NOT NULL DEFAULT N'IN_PERSON',
    status_key               NVARCHAR(30)     NOT NULL DEFAULT N'PENDING',
    scheduled_at             DATETIME2(0)     NULL,
    location                 NVARCHAR(200)    NULL,
    created_at               DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_at               DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_army_app_interviews_application FOREIGN KEY (application_id)
      REFERENCES dbo.army_applications(application_id) ON DELETE CASCADE,
    CONSTRAINT CK_army_app_interviews_status CHECK (status_key IN (
      N'PENDING', N'SCHEDULED', N'COMPLETED', N'SKIPPED'
    )),
    CONSTRAINT CK_army_app_interviews_role CHECK (interviewer_role_key IN (
      N'HR_ADMIN', N'STORE_MANAGER', N'REGIONAL_MANAGER', N'HQ_PANEL', N'TECHNICAL'
    )),
    CONSTRAINT CK_army_app_interviews_mode CHECK (mode_key IN (N'IN_PERSON'))
  );
  CREATE INDEX IX_army_app_interviews_app ON dbo.army_application_interviews(application_id, sort_order);
  PRINT N'Migration 80: created army_application_interviews';
END
ELSE
  PRINT N'Migration 80: army_application_interviews already exists — skipped';
GO

DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.army_interview_templates WHERE name = N'Retail Staff')
BEGIN
  INSERT INTO dbo.army_interview_templates (name, description, is_active, created_at, updated_at)
  VALUES (
    N'Retail Staff',
    N'Standard store hiring flow for sales and front-desk roles.',
    1, @now, @now
  );
  DECLARE @retailId INT = SCOPE_IDENTITY();
  INSERT INTO dbo.army_interview_template_stages (interview_template_id, sort_order, stage_name, interviewer_role_key, mode_key)
  VALUES
    (@retailId, 1, N'HR Screening', N'HR_ADMIN', N'IN_PERSON'),
    (@retailId, 2, N'Store Manager Interview', N'STORE_MANAGER', N'IN_PERSON');
  PRINT N'Migration 80: seeded Retail Staff template';
END

IF NOT EXISTS (SELECT 1 FROM dbo.army_interview_templates WHERE name = N'Store Manager')
BEGIN
  INSERT INTO dbo.army_interview_templates (name, description, is_active, created_at, updated_at)
  VALUES (
    N'Store Manager',
    N'Leadership hiring with HQ final panel.',
    1, @now, @now
  );
  DECLARE @mgrId INT = SCOPE_IDENTITY();
  INSERT INTO dbo.army_interview_template_stages (interview_template_id, sort_order, stage_name, interviewer_role_key, mode_key)
  VALUES
    (@mgrId, 1, N'HR Screening', N'HR_ADMIN', N'IN_PERSON'),
    (@mgrId, 2, N'Regional Manager', N'REGIONAL_MANAGER', N'IN_PERSON'),
    (@mgrId, 3, N'HQ Final', N'HQ_PANEL', N'IN_PERSON');
  PRINT N'Migration 80: seeded Store Manager template';
END

IF NOT EXISTS (SELECT 1 FROM dbo.army_interview_templates WHERE name = N'Optometrist')
BEGIN
  INSERT INTO dbo.army_interview_templates (name, description, is_active, created_at, updated_at)
  VALUES (
    N'Optometrist',
    N'Clinical + store assessment for optometry hires.',
    0, @now, @now
  );
  DECLARE @optId INT = SCOPE_IDENTITY();
  INSERT INTO dbo.army_interview_template_stages (interview_template_id, sort_order, stage_name, interviewer_role_key, mode_key)
  VALUES
    (@optId, 1, N'HR Screening', N'HR_ADMIN', N'IN_PERSON'),
    (@optId, 2, N'Technical Assessment', N'TECHNICAL', N'IN_PERSON'),
    (@optId, 3, N'Store Manager Interview', N'STORE_MANAGER', N'IN_PERSON');
  PRINT N'Migration 80: seeded Optometrist template (inactive)';
END
GO

PRINT N'Migration 80: complete';
GO
