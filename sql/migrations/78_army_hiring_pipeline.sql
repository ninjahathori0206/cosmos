/*
  Migration 78 — Army HR hiring pipeline (job openings, candidates, applications)

  Deploy: npm run migrate:78-army-hiring-pipeline
*/
USE [CosmosERP];
GO

SET NOCOUNT ON;
PRINT N'Migration 78: Army HR hiring pipeline';
GO

IF OBJECT_ID(N'dbo.army_job_openings', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_job_openings (
    job_opening_id   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    slug             NVARCHAR(120)    NOT NULL,
    title            NVARCHAR(200)    NOT NULL,
    department_key   NVARCHAR(30)     NOT NULL,
    store_id         INT              NULL,
    store_name       NVARCHAR(120)    NOT NULL,
    employment_type  NVARCHAR(30)     NOT NULL,
    employment_type_label NVARCHAR(60) NOT NULL,
    vacancies        INT              NOT NULL DEFAULT 1,
    location         NVARCHAR(200)    NULL,
    about_text       NVARCHAR(MAX)    NULL,
    requirements_json NVARCHAR(MAX)   NULL,
    apply_by         DATE             NULL,
    status           NVARCHAR(30)     NOT NULL DEFAULT N'DRAFT',
    requested_by     INT              NULL,
    published_at     DATETIME2(0)     NULL,
    created_by       INT              NULL,
    created_at       DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_at       DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT UQ_army_job_openings_slug UNIQUE (slug),
    CONSTRAINT FK_army_job_openings_store FOREIGN KEY (store_id) REFERENCES dbo.stores(store_id),
    CONSTRAINT CK_army_job_openings_status CHECK (status IN (
      N'DRAFT', N'PENDING_APPROVAL', N'PUBLISHED', N'FILLED', N'CLOSED'
    )),
    CONSTRAINT CK_army_job_openings_employment CHECK (employment_type IN (
      N'FULL_TIME', N'PART_TIME', N'CONTRACT'
    ))
  );
  CREATE INDEX IX_army_job_openings_status ON dbo.army_job_openings(status, department_key);
  PRINT N'Migration 78: created army_job_openings';
END
ELSE
  PRINT N'Migration 78: army_job_openings already exists — skipped';
GO

IF OBJECT_ID(N'dbo.army_candidates', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_candidates (
    candidate_id     INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    full_name        NVARCHAR(120)    NOT NULL,
    phone            NVARCHAR(15)     NOT NULL,
    email            NVARCHAR(200)    NOT NULL,
    dob              DATE             NOT NULL,
    education_key    NVARCHAR(30)     NULL,
    experience_years INT              NOT NULL DEFAULT 0,
    experience_months INT             NOT NULL DEFAULT 0,
    last_employer    NVARCHAR(160)    NULL,
    referral_code    NVARCHAR(40)     NULL,
    resume_url       NVARCHAR(500)    NULL,
    source_key       NVARCHAR(30)     NOT NULL DEFAULT N'DIRECT',
    created_at       DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_at       DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT UQ_army_candidates_phone UNIQUE (phone)
  );
  CREATE INDEX IX_army_candidates_email ON dbo.army_candidates(email);
  PRINT N'Migration 78: created army_candidates';
END
ELSE
  PRINT N'Migration 78: army_candidates already exists — skipped';
GO

IF OBJECT_ID(N'dbo.army_applications', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_applications (
    application_id   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    candidate_id     INT              NOT NULL,
    job_opening_id   INT              NOT NULL,
    preferred_store  NVARCHAR(120)    NULL,
    status_key       NVARCHAR(30)     NOT NULL DEFAULT N'APPLIED',
    applied_at       DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_at       DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_army_applications_candidate FOREIGN KEY (candidate_id) REFERENCES dbo.army_candidates(candidate_id),
    CONSTRAINT FK_army_applications_job FOREIGN KEY (job_opening_id) REFERENCES dbo.army_job_openings(job_opening_id),
    CONSTRAINT UQ_army_applications_candidate_job UNIQUE (candidate_id, job_opening_id),
    CONSTRAINT CK_army_applications_status CHECK (status_key IN (
      N'APPLIED', N'SCREENING', N'INTERVIEW', N'ON_HOLD', N'SELECTED',
      N'OFFER_ISSUED', N'OFFER_ACCEPTED', N'NOT_SELECTED', N'JOINED'
    ))
  );
  CREATE INDEX IX_army_applications_status ON dbo.army_applications(status_key, applied_at DESC);
  CREATE INDEX IX_army_applications_job ON dbo.army_applications(job_opening_id, status_key);
  PRINT N'Migration 78: created army_applications';
END
ELSE
  PRINT N'Migration 78: army_applications already exists — skipped';
GO

/* Seed published job openings (idempotent by slug) */
DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.army_job_openings WHERE slug = N'sales-associate-malad')
  INSERT INTO dbo.army_job_openings (slug, title, department_key, store_name, employment_type, employment_type_label, vacancies, location, about_text, requirements_json, apply_by, status, published_at, created_at, updated_at)
  VALUES (N'sales-associate-malad', N'Sales Associate', N'SALES', N'Malad Store', N'FULL_TIME', N'Full-time', 2, N'Malad West, Mumbai',
    N'Help customers choose the right eyewear, explain lens options, and deliver a great in-store experience.',
    N'["Good communication and customer-first attitude","Basic understanding of eyewear or retail sales","Willing to work store shifts including weekends"]',
    '2026-06-15', N'PUBLISHED', @now, @now, @now);

IF NOT EXISTS (SELECT 1 FROM dbo.army_job_openings WHERE slug = N'optometrist-bandra')
  INSERT INTO dbo.army_job_openings (slug, title, department_key, store_name, employment_type, employment_type_label, vacancies, location, about_text, requirements_json, apply_by, status, published_at, created_at, updated_at)
  VALUES (N'optometrist-bandra', N'Optometrist', N'OPTOMETRY', N'Bandra Store', N'FULL_TIME', N'Full-time', 1, N'Bandra West, Mumbai',
    N'Conduct eye examinations, recommend lenses, and support the sales team with clinical guidance.',
    N'["Valid optometry qualification and registration","Experience with refraction and contact lens fitting","Comfortable explaining prescriptions to customers"]',
    '2026-06-30', N'PUBLISHED', @now, @now, @now);

IF NOT EXISTS (SELECT 1 FROM dbo.army_job_openings WHERE slug = N'lab-technician-juhu')
  INSERT INTO dbo.army_job_openings (slug, title, department_key, store_name, employment_type, employment_type_label, vacancies, location, about_text, requirements_json, apply_by, status, published_at, created_at, updated_at)
  VALUES (N'lab-technician-juhu', N'Lab Technician', N'LAB', N'Juhu Store', N'CONTRACT', N'Contract', 1, N'Juhu, Mumbai',
    N'Process lens orders, manage edging and fitting workflows, and coordinate with store teams for timely delivery.',
    N'["Hands-on lens lab or optical workshop experience","Attention to detail on power and axis measurements","Ability to meet daily dispatch targets"]',
    '2026-06-10', N'PUBLISHED', @now, @now, @now);

IF NOT EXISTS (SELECT 1 FROM dbo.army_job_openings WHERE slug = N'store-manager-powai')
  INSERT INTO dbo.army_job_openings (slug, title, department_key, store_name, employment_type, employment_type_label, vacancies, location, about_text, requirements_json, apply_by, status, published_at, created_at, updated_at)
  VALUES (N'store-manager-powai', N'Store Manager', N'MGMT', N'Powai Store', N'FULL_TIME', N'Full-time', 1, N'Powai, Mumbai',
    N'Lead the store team, drive sales performance, manage roster and customer experience.',
    N'["3+ years retail or optical store leadership","Strong people management and sales coaching","Comfortable with daily reporting and store KPIs"]',
    '2026-06-25', N'PUBLISHED', @now, @now, @now);

IF NOT EXISTS (SELECT 1 FROM dbo.army_job_openings WHERE slug = N'senior-sales-associate-andheri')
  INSERT INTO dbo.army_job_openings (slug, title, department_key, store_name, employment_type, employment_type_label, vacancies, location, about_text, requirements_json, apply_by, status, published_at, created_at, updated_at)
  VALUES (N'senior-sales-associate-andheri', N'Senior Sales Associate', N'SALES', N'Andheri Store', N'FULL_TIME', N'Full-time', 2, N'Andheri West, Mumbai',
    N'Support premium sales, mentor junior associates, and handle complex lens consultations.',
    N'["2+ years optical or premium retail sales","Confident with upselling lens packages","Team player with shift flexibility"]',
    '2026-06-20', N'PUBLISHED', @now, @now, @now);

IF NOT EXISTS (SELECT 1 FROM dbo.army_job_openings WHERE slug = N'admin-executive-hq')
  INSERT INTO dbo.army_job_openings (slug, title, department_key, store_name, employment_type, employment_type_label, vacancies, location, about_text, requirements_json, apply_by, status, published_at, created_at, updated_at)
  VALUES (N'admin-executive-hq', N'Admin Executive', N'ADMIN', N'HQ Mumbai', N'FULL_TIME', N'Full-time', 1, N'Andheri East, Mumbai',
    N'Support HQ operations with documentation, vendor coordination, and internal HR admin tasks.',
    N'["Graduate with strong written communication","Comfortable with spreadsheets and email workflows","Organised and reliable with deadlines"]',
    '2026-06-18', N'PUBLISHED', @now, @now, @now);

PRINT N'Migration 78 complete.';
GO
