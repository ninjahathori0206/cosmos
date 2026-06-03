/*
  Migration 82 — Army HR employees (S5 onboarding)

  Deploy: npm run migrate:82-army-employees-s5
*/
USE [CosmosERP];
GO

SET NOCOUNT ON;
PRINT N'Migration 82: Army HR employees (S5)';
GO

IF OBJECT_ID(N'dbo.army_employees', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_employees (
    employee_id                 INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    employee_code               NVARCHAR(20)     NOT NULL,
    candidate_id                INT              NULL,
    application_id              INT              NULL,
    user_id                     INT              NULL,
    full_name                   NVARCHAR(120)    NOT NULL,
    phone                       NVARCHAR(15)     NOT NULL,
    email                       NVARCHAR(200)    NULL,
    dob                         DATE             NULL,
    gender_key                  NVARCHAR(20)     NULL,
    blood_group_key             NVARCHAR(10)     NULL,
    address_current             NVARCHAR(500)    NULL,
    address_permanent           NVARCHAR(500)    NULL,
    emergency_contact_name      NVARCHAR(120)    NULL,
    emergency_contact_relation  NVARCHAR(60)     NULL,
    emergency_contact_phone     NVARCHAR(15)     NULL,
    aadhaar_number              NVARCHAR(12)     NULL,
    pan_number                  NVARCHAR(10)     NULL,
    bank_name                   NVARCHAR(120)    NULL,
    bank_account_number         NVARCHAR(30)     NULL,
    bank_ifsc                   NVARCHAR(11)     NULL,
    bank_account_type_key       NVARCHAR(20)     NULL,
    profile_photo_url           NVARCHAR(500)    NULL,
    store_id                    INT              NULL,
    department_key              NVARCHAR(30)     NULL,
    job_title                   NVARCHAR(120)    NULL,
    status_key                  NVARCHAR(30)     NOT NULL DEFAULT N'ONBOARDING',
    onboarding_progress_pct     INT              NOT NULL DEFAULT 0,
    joined_at                   DATETIME2(0)     NULL,
    created_by                  INT              NULL,
    created_at                  DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_at                  DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT UQ_army_employees_code UNIQUE (employee_code),
    CONSTRAINT UQ_army_employees_phone UNIQUE (phone),
    CONSTRAINT FK_army_employees_candidate FOREIGN KEY (candidate_id)
      REFERENCES dbo.army_candidates(candidate_id),
    CONSTRAINT FK_army_employees_application FOREIGN KEY (application_id)
      REFERENCES dbo.army_applications(application_id),
    CONSTRAINT FK_army_employees_store FOREIGN KEY (store_id)
      REFERENCES dbo.stores(store_id),
    CONSTRAINT CK_army_employees_status CHECK (status_key IN (
      N'ONBOARDING', N'ACTIVE', N'ON_NOTICE', N'EXITED', N'INACTIVE'
    ))
  );
  CREATE INDEX IX_army_employees_status ON dbo.army_employees(status_key, created_at DESC);
  CREATE INDEX IX_army_employees_store ON dbo.army_employees(store_id, status_key);
  PRINT N'Migration 82: created army_employees';
END
ELSE
  PRINT N'Migration 82: army_employees already exists — skipped';
GO

IF OBJECT_ID(N'dbo.army_employee_documents', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_employee_documents (
    document_id     INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    employee_id     INT              NOT NULL,
    doc_type_key    NVARCHAR(30)     NOT NULL,
    file_url        NVARCHAR(500)    NOT NULL,
    file_name       NVARCHAR(200)    NOT NULL,
    is_verified     BIT              NOT NULL DEFAULT 0,
    uploaded_by     INT              NULL,
    uploaded_at     DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_army_emp_docs_employee FOREIGN KEY (employee_id)
      REFERENCES dbo.army_employees(employee_id) ON DELETE CASCADE,
    CONSTRAINT CK_army_emp_docs_type CHECK (doc_type_key IN (
      N'AADHAAR', N'PAN', N'PHOTO', N'BANK_PROOF', N'EDUCATION', N'EXPERIENCE', N'OTHER'
    ))
  );
  CREATE INDEX IX_army_emp_docs_employee ON dbo.army_employee_documents(employee_id, doc_type_key);
  PRINT N'Migration 82: created army_employee_documents';
END
ELSE
  PRINT N'Migration 82: army_employee_documents already exists — skipped';
GO

IF OBJECT_ID(N'dbo.army_employee_onboarding_items', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_employee_onboarding_items (
    employee_id     INT              NOT NULL,
    item_key        NVARCHAR(40)     NOT NULL,
    is_complete     BIT              NOT NULL DEFAULT 0,
    completed_at    DATETIME2(0)     NULL,
    completed_by    INT              NULL,
    notes           NVARCHAR(500)    NULL,
    CONSTRAINT PK_army_emp_onboarding PRIMARY KEY (employee_id, item_key),
    CONSTRAINT FK_army_emp_onboarding_employee FOREIGN KEY (employee_id)
      REFERENCES dbo.army_employees(employee_id) ON DELETE CASCADE
  );
  PRINT N'Migration 82: created army_employee_onboarding_items';
END
ELSE
  PRINT N'Migration 82: army_employee_onboarding_items already exists — skipped';
GO

PRINT N'Migration 82: complete';
GO
