/*
  Migration 83 — Army HR employee ops S6–S12 (+ offer letters S4)

  Deploy: npm run migrate:83-army-ops-s6-s12
*/
USE [CosmosERP];
GO

SET NOCOUNT ON;
PRINT N'Migration 83: Army HR ops S6–S12';
GO

IF OBJECT_ID(N'dbo.army_employee_placements', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_employee_placements (
    placement_id   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    employee_id    INT              NOT NULL,
    store_id       INT              NOT NULL,
    status_key     NVARCHAR(20)     NOT NULL DEFAULT N'PENDING',
    confirmed_at   DATETIME2(0)     NULL,
    confirmed_by   INT              NULL,
    notes          NVARCHAR(500)    NULL,
    created_at     DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_army_placement_employee FOREIGN KEY (employee_id) REFERENCES dbo.army_employees(employee_id) ON DELETE CASCADE,
    CONSTRAINT FK_army_placement_store FOREIGN KEY (store_id) REFERENCES dbo.stores(store_id),
    CONSTRAINT CK_army_placement_status CHECK (status_key IN (N'PENDING', N'CONFIRMED'))
  );
  CREATE INDEX IX_army_placement_employee ON dbo.army_employee_placements(employee_id);
END
GO

IF OBJECT_ID(N'dbo.army_employee_orientation', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_employee_orientation (
    employee_id         INT              NOT NULL PRIMARY KEY,
    general_ack_at      DATETIME2(0)     NULL,
    general_ack_by      INT              NULL,
    store_complete_at   DATETIME2(0)     NULL,
    store_signed_by     INT              NULL,
    store_checklist_json NVARCHAR(MAX)   NULL,
    updated_at          DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_army_orientation_employee FOREIGN KEY (employee_id) REFERENCES dbo.army_employees(employee_id) ON DELETE CASCADE
  );
END
GO

IF OBJECT_ID(N'dbo.army_shift_types', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_shift_types (
    shift_type_id  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name           NVARCHAR(60)     NOT NULL,
    start_time     TIME             NOT NULL,
    end_time       TIME             NOT NULL,
    is_active      BIT              NOT NULL DEFAULT 1,
    created_at     DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME()))
  );
END
GO

IF OBJECT_ID(N'dbo.army_rosters', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_rosters (
    roster_id      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    store_id       INT              NOT NULL,
    week_start     DATE             NOT NULL,
    status_key     NVARCHAR(20)     NOT NULL DEFAULT N'DRAFT',
    published_at   DATETIME2(0)     NULL,
    created_by     INT              NULL,
    created_at     DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_army_rosters_store FOREIGN KEY (store_id) REFERENCES dbo.stores(store_id),
    CONSTRAINT UQ_army_rosters_store_week UNIQUE (store_id, week_start),
    CONSTRAINT CK_army_rosters_status CHECK (status_key IN (N'DRAFT', N'PUBLISHED'))
  );
END
GO

IF OBJECT_ID(N'dbo.army_roster_entries', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_roster_entries (
    roster_entry_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    roster_id       INT              NOT NULL,
    employee_id     INT              NOT NULL,
    roster_date     DATE             NOT NULL,
    shift_type_id   INT              NULL,
    is_off          BIT              NOT NULL DEFAULT 0,
    CONSTRAINT FK_army_roster_entries_roster FOREIGN KEY (roster_id) REFERENCES dbo.army_rosters(roster_id) ON DELETE CASCADE,
    CONSTRAINT FK_army_roster_entries_employee FOREIGN KEY (employee_id) REFERENCES dbo.army_employees(employee_id),
    CONSTRAINT FK_army_roster_entries_shift FOREIGN KEY (shift_type_id) REFERENCES dbo.army_shift_types(shift_type_id)
  );
  CREATE INDEX IX_army_roster_entries_roster ON dbo.army_roster_entries(roster_id, roster_date);
END
GO

IF OBJECT_ID(N'dbo.army_attendance', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_attendance (
    attendance_id   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    employee_id     INT              NOT NULL,
    att_date        DATE             NOT NULL,
    store_id        INT              NULL,
    check_in_at     DATETIME2(0)     NULL,
    check_out_at    DATETIME2(0)     NULL,
    status_key      NVARCHAR(20)     NOT NULL DEFAULT N'ABSENT',
    late_minutes    INT              NOT NULL DEFAULT 0,
    notes           NVARCHAR(500)    NULL,
    created_at      DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_army_attendance_employee FOREIGN KEY (employee_id) REFERENCES dbo.army_employees(employee_id) ON DELETE CASCADE,
    CONSTRAINT UQ_army_attendance_emp_date UNIQUE (employee_id, att_date),
    CONSTRAINT CK_army_attendance_status CHECK (status_key IN (
      N'PRESENT', N'HALF_DAY', N'LATE', N'ABSENT', N'LEAVE', N'HOLIDAY', N'TOUR', N'FLOATING'
    ))
  );
  CREATE INDEX IX_army_attendance_date ON dbo.army_attendance(att_date, status_key);
END
GO

IF OBJECT_ID(N'dbo.army_attendance_corrections', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_attendance_corrections (
    correction_id   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    attendance_id   INT              NOT NULL,
    reason          NVARCHAR(500)    NOT NULL,
    status_key      NVARCHAR(20)     NOT NULL DEFAULT N'PENDING',
    requested_by    INT              NULL,
    reviewed_by     INT              NULL,
    reviewed_at     DATETIME2(0)     NULL,
    created_at      DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_army_att_corr_att FOREIGN KEY (attendance_id) REFERENCES dbo.army_attendance(attendance_id) ON DELETE CASCADE,
    CONSTRAINT CK_army_att_corr_status CHECK (status_key IN (N'PENDING', N'APPROVED', N'REJECTED'))
  );
END
GO

IF OBJECT_ID(N'dbo.army_employee_leave_quotas', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_employee_leave_quotas (
    employee_id     INT              NOT NULL,
    leave_type_key  NVARCHAR(20)     NOT NULL,
    annual_quota    DECIMAL(5,1)     NOT NULL DEFAULT 0,
    used            DECIMAL(5,1)     NOT NULL DEFAULT 0,
    balance         DECIMAL(5,1)     NOT NULL DEFAULT 0,
    CONSTRAINT PK_army_leave_quotas PRIMARY KEY (employee_id, leave_type_key),
    CONSTRAINT FK_army_leave_quotas_employee FOREIGN KEY (employee_id) REFERENCES dbo.army_employees(employee_id) ON DELETE CASCADE
  );
END
GO

IF OBJECT_ID(N'dbo.army_leave_requests', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_leave_requests (
    leave_request_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    employee_id      INT              NOT NULL,
    leave_type_key   NVARCHAR(20)     NOT NULL,
    from_date        DATE             NOT NULL,
    to_date          DATE             NOT NULL,
    reason           NVARCHAR(500)    NULL,
    status_key       NVARCHAR(20)     NOT NULL DEFAULT N'PENDING',
    reviewed_by      INT              NULL,
    reviewed_at      DATETIME2(0)     NULL,
    review_notes     NVARCHAR(500)    NULL,
    created_at       DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_army_leave_req_employee FOREIGN KEY (employee_id) REFERENCES dbo.army_employees(employee_id) ON DELETE CASCADE,
    CONSTRAINT CK_army_leave_req_status CHECK (status_key IN (N'PENDING', N'APPROVED', N'REJECTED', N'CANCELLED'))
  );
  CREATE INDEX IX_army_leave_req_status ON dbo.army_leave_requests(status_key, created_at DESC);
END
GO

IF OBJECT_ID(N'dbo.army_salary_components', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_salary_components (
    component_id    INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name            NVARCHAR(80)     NOT NULL,
    component_type  NVARCHAR(20)     NOT NULL,
    calc_type       NVARCHAR(20)     NOT NULL DEFAULT N'FIXED',
    default_value   DECIMAL(12,2)    NOT NULL DEFAULT 0,
    is_active       BIT              NOT NULL DEFAULT 1,
    created_at      DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT CK_army_salary_comp_type CHECK (component_type IN (N'EARNING', N'DEDUCTION')),
    CONSTRAINT CK_army_salary_calc_type CHECK (calc_type IN (N'FIXED', N'PERCENT_BASIC'))
  );
END
GO

IF OBJECT_ID(N'dbo.army_employee_salary', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_employee_salary (
    employee_salary_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    employee_id        INT              NOT NULL,
    components_json    NVARCHAR(MAX)    NOT NULL,
    effective_from       DATE             NOT NULL,
    created_at           DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_army_emp_salary_employee FOREIGN KEY (employee_id) REFERENCES dbo.army_employees(employee_id) ON DELETE CASCADE
  );
END
GO

IF OBJECT_ID(N'dbo.army_payroll_runs', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_payroll_runs (
    payroll_run_id  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    month_key       NVARCHAR(7)      NOT NULL,
    status_key      NVARCHAR(20)     NOT NULL DEFAULT N'DRAFT',
    approved_by     INT              NULL,
    approved_at     DATETIME2(0)     NULL,
    created_at      DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT UQ_army_payroll_month UNIQUE (month_key),
    CONSTRAINT CK_army_payroll_status CHECK (status_key IN (N'DRAFT', N'APPROVED', N'LOCKED'))
  );
END
GO

IF OBJECT_ID(N'dbo.army_payroll_entries', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_payroll_entries (
    payroll_entry_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    payroll_run_id   INT              NOT NULL,
    employee_id      INT              NOT NULL,
    gross_amount     DECIMAL(12,2)    NOT NULL DEFAULT 0,
    deduction_amount DECIMAL(12,2)    NOT NULL DEFAULT 0,
    net_amount       DECIMAL(12,2)    NOT NULL DEFAULT 0,
    lop_days         DECIMAL(4,1)     NOT NULL DEFAULT 0,
    CONSTRAINT FK_army_payroll_entry_run FOREIGN KEY (payroll_run_id) REFERENCES dbo.army_payroll_runs(payroll_run_id) ON DELETE CASCADE,
    CONSTRAINT FK_army_payroll_entry_emp FOREIGN KEY (employee_id) REFERENCES dbo.army_employees(employee_id),
    CONSTRAINT UQ_army_payroll_entry UNIQUE (payroll_run_id, employee_id)
  );
END
GO

IF OBJECT_ID(N'dbo.army_salary_advances', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_salary_advances (
    advance_id       INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    employee_id      INT              NOT NULL,
    amount           DECIMAL(12,2)    NOT NULL,
    reason           NVARCHAR(500)    NULL,
    repayment_months INT              NOT NULL DEFAULT 1,
    status_key       NVARCHAR(20)     NOT NULL DEFAULT N'PENDING',
    approved_by      INT              NULL,
    created_at       DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_army_advances_employee FOREIGN KEY (employee_id) REFERENCES dbo.army_employees(employee_id) ON DELETE CASCADE,
    CONSTRAINT CK_army_advances_status CHECK (status_key IN (N'PENDING', N'APPROVED', N'REJECTED', N'REPAID'))
  );
END
GO

IF OBJECT_ID(N'dbo.army_lms_courses', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_lms_courses (
    course_id       INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    title           NVARCHAR(200)    NOT NULL,
    description     NVARCHAR(1000)   NULL,
    modules_json    NVARCHAR(MAX)    NULL,
    is_active       BIT              NOT NULL DEFAULT 1,
    created_at      DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME()))
  );
END
GO

IF OBJECT_ID(N'dbo.army_training_assignments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_training_assignments (
    assignment_id   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    employee_id     INT              NOT NULL,
    course_id       INT              NOT NULL,
    due_date        DATE             NULL,
    progress_pct    INT              NOT NULL DEFAULT 0,
    status_key      NVARCHAR(20)     NOT NULL DEFAULT N'ASSIGNED',
    completed_at    DATETIME2(0)     NULL,
    created_at      DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_army_train_assign_emp FOREIGN KEY (employee_id) REFERENCES dbo.army_employees(employee_id) ON DELETE CASCADE,
    CONSTRAINT FK_army_train_assign_course FOREIGN KEY (course_id) REFERENCES dbo.army_lms_courses(course_id),
    CONSTRAINT CK_army_train_assign_status CHECK (status_key IN (N'ASSIGNED', N'IN_PROGRESS', N'COMPLETED'))
  );
END
GO

IF OBJECT_ID(N'dbo.army_training_sessions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_training_sessions (
    session_id      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    session_type    NVARCHAR(20)     NOT NULL DEFAULT N'ONSITE',
    title           NVARCHAR(200)    NOT NULL,
    scheduled_at    DATETIME2(0)     NOT NULL,
    venue           NVARCHAR(200)    NULL,
    store_id        INT              NULL,
    trainer_name    NVARCHAR(120)    NULL,
    created_at      DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_army_train_sess_store FOREIGN KEY (store_id) REFERENCES dbo.stores(store_id),
    CONSTRAINT CK_army_train_sess_type CHECK (session_type IN (N'ONSITE', N'OFFSITE'))
  );
END
GO

IF OBJECT_ID(N'dbo.army_performance_scores', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_performance_scores (
    performance_id  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    employee_id     INT              NOT NULL,
    month_key       NVARCHAR(7)      NOT NULL,
    sales_score     DECIMAL(5,1)     NOT NULL DEFAULT 0,
    attendance_score DECIMAL(5,1)    NOT NULL DEFAULT 0,
    training_score  DECIMAL(5,1)     NOT NULL DEFAULT 0,
    total_score     DECIMAL(5,1)     NOT NULL DEFAULT 0,
    snapshot_json   NVARCHAR(MAX)    NULL,
    computed_at     DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_army_perf_employee FOREIGN KEY (employee_id) REFERENCES dbo.army_employees(employee_id) ON DELETE CASCADE,
    CONSTRAINT UQ_army_perf_emp_month UNIQUE (employee_id, month_key)
  );
END
GO

IF OBJECT_ID(N'dbo.army_exit_requests', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_exit_requests (
    exit_request_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    employee_id     INT              NOT NULL,
    reason          NVARCHAR(500)    NOT NULL,
    requested_lwd   DATE             NOT NULL,
    confirmed_lwd   DATE             NULL,
    status_key      NVARCHAR(20)     NOT NULL DEFAULT N'PENDING',
    clearance_json  NVARCHAR(MAX)    NULL,
    created_at      DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_army_exit_employee FOREIGN KEY (employee_id) REFERENCES dbo.army_employees(employee_id) ON DELETE CASCADE,
    CONSTRAINT CK_army_exit_status CHECK (status_key IN (N'PENDING', N'IN_CLEARANCE', N'COMPLETED', N'CANCELLED'))
  );
END
GO

IF OBJECT_ID(N'dbo.army_offer_letters', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_offer_letters (
    offer_letter_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    application_id  INT              NOT NULL,
    employee_id     INT              NULL,
    ctc_amount      DECIMAL(12,2)    NOT NULL,
    joining_date    DATE             NOT NULL,
    status_key      NVARCHAR(20)     NOT NULL DEFAULT N'DRAFT',
    issued_at       DATETIME2(0)     NULL,
    acknowledged_at DATETIME2(0)     NULL,
    created_by      INT              NULL,
    created_at      DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_army_offer_application FOREIGN KEY (application_id) REFERENCES dbo.army_applications(application_id),
    CONSTRAINT FK_army_offer_employee FOREIGN KEY (employee_id) REFERENCES dbo.army_employees(employee_id),
    CONSTRAINT CK_army_offer_status CHECK (status_key IN (N'DRAFT', N'ISSUED', N'ACCEPTED', N'WITHDRAWN'))
  );
END
GO

DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.army_shift_types)
BEGIN
  INSERT INTO dbo.army_shift_types (name, start_time, end_time, is_active, created_at)
  VALUES
    (N'Morning', '09:00', '18:00', 1, @now),
    (N'Evening', '13:00', '21:00', 1, @now),
    (N'Full Day', '10:00', '19:00', 1, @now);
END

IF NOT EXISTS (SELECT 1 FROM dbo.army_salary_components)
BEGIN
  INSERT INTO dbo.army_salary_components (name, component_type, calc_type, default_value, is_active, created_at)
  VALUES
    (N'Basic Salary', N'EARNING', N'FIXED', 15000, 1, @now),
    (N'HRA', N'EARNING', N'PERCENT_BASIC', 40, 1, @now),
    (N'PF (Employee)', N'DEDUCTION', N'PERCENT_BASIC', 12, 1, @now),
    (N'Professional Tax', N'DEDUCTION', N'FIXED', 200, 1, @now);
END

PRINT N'Migration 83: complete';
GO
