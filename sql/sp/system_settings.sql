USE [CosmosERP];
GO

-- ═══════════════════════════════════════════════════════
--  GST RATES
-- ═══════════════════════════════════════════════════════

IF OBJECT_ID('dbo.sp_GstRate_GetAll', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_GstRate_GetAll;
GO

CREATE PROCEDURE dbo.sp_GstRate_GetAll
AS
BEGIN
  SET NOCOUNT ON;
  SELECT g.gst_id, g.hsn_sac, g.category, g.gst_rate, g.cgst_rate, g.sgst_rate,
         g.applied_to, g.is_active, g.created_at, g.updated_at
  FROM dbo.gst_rates g ORDER BY g.hsn_sac;
END;
GO

IF OBJECT_ID('dbo.sp_GstRate_Create', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_GstRate_Create;
GO

CREATE PROCEDURE dbo.sp_GstRate_Create
  @hsn_sac   VARCHAR(50),
  @category  VARCHAR(200),
  @gst_rate  DECIMAL(5,2),
  @cgst_rate DECIMAL(5,2),
  @sgst_rate DECIMAL(5,2),
  @applied_to VARCHAR(500) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    INSERT INTO dbo.gst_rates (hsn_sac, category, gst_rate, cgst_rate, sgst_rate, applied_to, is_active, created_at, updated_at)
    VALUES (@hsn_sac, @category, @gst_rate, @cgst_rate, @sgst_rate, @applied_to, 1, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()));

    SELECT gst_id, hsn_sac, category, gst_rate, cgst_rate, sgst_rate, applied_to, is_active, created_at, updated_at
    FROM dbo.gst_rates WHERE gst_id = SCOPE_IDENTITY();
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_GstRate_Update', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_GstRate_Update;
GO

CREATE PROCEDURE dbo.sp_GstRate_Update
  @gst_id    INT,
  @hsn_sac   VARCHAR(50),
  @category  VARCHAR(200),
  @gst_rate  DECIMAL(5,2),
  @cgst_rate DECIMAL(5,2),
  @sgst_rate DECIMAL(5,2),
  @applied_to VARCHAR(500) = NULL,
  @is_active BIT = 1
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    UPDATE dbo.gst_rates
    SET hsn_sac = @hsn_sac, category = @category, gst_rate = @gst_rate,
        cgst_rate = @cgst_rate, sgst_rate = @sgst_rate, applied_to = @applied_to,
        is_active = ISNULL(@is_active, 1), updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE gst_id = @gst_id;

    SELECT gst_id, hsn_sac, category, gst_rate, cgst_rate, sgst_rate, applied_to, is_active, created_at, updated_at
    FROM dbo.gst_rates WHERE gst_id = @gst_id;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_GstRate_Delete', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_GstRate_Delete;
GO

CREATE PROCEDURE dbo.sp_GstRate_Delete
  @gst_id INT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    UPDATE dbo.gst_rates SET is_active = 0, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()) WHERE gst_id = @gst_id;
    SELECT gst_id, is_active, updated_at FROM dbo.gst_rates WHERE gst_id = @gst_id;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO

-- ═══════════════════════════════════════════════════════
--  MEMBERSHIP TIERS
-- ═══════════════════════════════════════════════════════

IF OBJECT_ID('dbo.sp_MembershipTier_GetAll', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_MembershipTier_GetAll;
GO

CREATE PROCEDURE dbo.sp_MembershipTier_GetAll
AS
BEGIN
  SET NOCOUNT ON;
  SELECT m.membership_id, m.tier_name, m.annual_fee, m.benefits, m.loyalty_tier,
         m.promoter_commission, m.is_active, m.created_at, m.updated_at
  FROM dbo.membership_tiers m ORDER BY m.annual_fee;
END;
GO

IF OBJECT_ID('dbo.sp_MembershipTier_Create', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_MembershipTier_Create;
GO

CREATE PROCEDURE dbo.sp_MembershipTier_Create
  @tier_name           VARCHAR(200),
  @annual_fee          DECIMAL(10,2),
  @benefits            VARCHAR(500) = NULL,
  @loyalty_tier        VARCHAR(50)  = NULL,
  @promoter_commission DECIMAL(10,2) = NULL,
  @created_by          INT           = NULL
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    INSERT INTO dbo.membership_tiers (tier_name, annual_fee, benefits, loyalty_tier, promoter_commission, is_active, created_by, created_at, updated_at)
    VALUES (@tier_name, @annual_fee, @benefits, @loyalty_tier, @promoter_commission, 1, @created_by, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()));

    SELECT membership_id, tier_name, annual_fee, benefits, loyalty_tier, promoter_commission, is_active, created_at, updated_at
    FROM dbo.membership_tiers WHERE membership_id = SCOPE_IDENTITY();
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_MembershipTier_Update', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_MembershipTier_Update;
GO

CREATE PROCEDURE dbo.sp_MembershipTier_Update
  @membership_id       INT,
  @tier_name           VARCHAR(200),
  @annual_fee          DECIMAL(10,2),
  @benefits            VARCHAR(500)  = NULL,
  @loyalty_tier        VARCHAR(50)   = NULL,
  @promoter_commission DECIMAL(10,2) = NULL,
  @is_active           BIT           = 1
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    UPDATE dbo.membership_tiers
    SET tier_name = @tier_name, annual_fee = @annual_fee, benefits = @benefits,
        loyalty_tier = @loyalty_tier, promoter_commission = @promoter_commission,
        is_active = ISNULL(@is_active, 1), updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE membership_id = @membership_id;

    SELECT membership_id, tier_name, annual_fee, benefits, loyalty_tier, promoter_commission, is_active, created_at, updated_at
    FROM dbo.membership_tiers WHERE membership_id = @membership_id;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_MembershipTier_Deactivate', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_MembershipTier_Deactivate;
GO

CREATE PROCEDURE dbo.sp_MembershipTier_Deactivate
  @membership_id INT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    UPDATE dbo.membership_tiers SET is_active = 0, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()) WHERE membership_id = @membership_id;
    SELECT membership_id, tier_name, is_active, updated_at FROM dbo.membership_tiers WHERE membership_id = @membership_id;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO

-- ═══════════════════════════════════════════════════════
--  LEAVE TYPES
-- ═══════════════════════════════════════════════════════

IF OBJECT_ID('dbo.sp_LeaveType_GetAll', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_LeaveType_GetAll;
GO

CREATE PROCEDURE dbo.sp_LeaveType_GetAll
AS
BEGIN
  SET NOCOUNT ON;
  SELECT l.leave_type_id, l.leave_name, l.annual_quota, l.max_carry_fwd,
         l.requires_approval, l.is_paid, l.affects_score, l.is_active, l.created_at, l.updated_at
  FROM dbo.leave_types l ORDER BY l.leave_name;
END;
GO

IF OBJECT_ID('dbo.sp_LeaveType_Create', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_LeaveType_Create;
GO

CREATE PROCEDURE dbo.sp_LeaveType_Create
  @leave_name        VARCHAR(200),
  @annual_quota      INT  = NULL,
  @max_carry_fwd     INT  = NULL,
  @requires_approval BIT  = 1,
  @is_paid           BIT  = 1,
  @affects_score     BIT  = 1,
  @created_by        INT  = NULL
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    INSERT INTO dbo.leave_types (leave_name, annual_quota, max_carry_fwd, requires_approval, is_paid, affects_score, is_active, created_by, created_at, updated_at)
    VALUES (@leave_name, @annual_quota, @max_carry_fwd, ISNULL(@requires_approval,1), ISNULL(@is_paid,1), ISNULL(@affects_score,1), 1, @created_by, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()));

    SELECT leave_type_id, leave_name, annual_quota, max_carry_fwd, requires_approval, is_paid, affects_score, is_active, created_at, updated_at
    FROM dbo.leave_types WHERE leave_type_id = SCOPE_IDENTITY();
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_LeaveType_Update', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_LeaveType_Update;
GO

CREATE PROCEDURE dbo.sp_LeaveType_Update
  @leave_type_id     INT,
  @leave_name        VARCHAR(200),
  @annual_quota      INT  = NULL,
  @max_carry_fwd     INT  = NULL,
  @requires_approval BIT  = 1,
  @is_paid           BIT  = 1,
  @affects_score     BIT  = 1,
  @is_active         BIT  = 1
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    UPDATE dbo.leave_types
    SET leave_name = @leave_name, annual_quota = @annual_quota, max_carry_fwd = @max_carry_fwd,
        requires_approval = ISNULL(@requires_approval,1), is_paid = ISNULL(@is_paid,1),
        affects_score = ISNULL(@affects_score,1), is_active = ISNULL(@is_active,1),
        updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE leave_type_id = @leave_type_id;

    SELECT leave_type_id, leave_name, annual_quota, max_carry_fwd, requires_approval, is_paid, affects_score, is_active, created_at, updated_at
    FROM dbo.leave_types WHERE leave_type_id = @leave_type_id;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_LeaveType_Deactivate', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_LeaveType_Deactivate;
GO

CREATE PROCEDURE dbo.sp_LeaveType_Deactivate
  @leave_type_id INT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    UPDATE dbo.leave_types SET is_active = 0, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()) WHERE leave_type_id = @leave_type_id;
    SELECT leave_type_id, leave_name, is_active, updated_at FROM dbo.leave_types WHERE leave_type_id = @leave_type_id;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO
