/*
  CX Customer 360 — write stored procedures (with cx_audit_log)
  Deploy: npm run deploy:cx-sps
*/
USE [CosmosERP];
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_InsertAuditLog
  @customer_id   INT = NULL,
  @entity_type   NVARCHAR(50),
  @entity_id     INT = NULL,
  @action        NVARCHAR(30),
  @field_name    NVARCHAR(100) = NULL,
  @old_value     NVARCHAR(MAX) = NULL,
  @new_value     NVARCHAR(MAX) = NULL,
  @actor_user_id INT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO dbo.cx_audit_log (
    customer_id, entity_type, entity_id, action,
    field_name, old_value, new_value, actor_user_id
  )
  VALUES (
    @customer_id, @entity_type, @entity_id, @action,
    @field_name, @old_value, @new_value, @actor_user_id
  );
  SELECT SCOPE_IDENTITY() AS audit_id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_UpdateCustomerProfile
  @customer_id     INT,
  @full_name       NVARCHAR(200) = NULL,
  @email           NVARCHAR(200) = NULL,
  @dob             DATE = NULL,
  @actor_user_id   INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF NOT EXISTS (SELECT 1 FROM dbo.pos_customers WHERE customer_id = @customer_id)
  BEGIN
    RAISERROR(N'Customer not found.', 16, 1);
    RETURN;
  END

  DECLARE @old_name NVARCHAR(200);
  DECLARE @old_email NVARCHAR(200);
  DECLARE @old_dob DATE;

  SELECT @old_name = full_name, @old_email = email, @old_dob = dob
  FROM dbo.pos_customers WHERE customer_id = @customer_id;

  UPDATE dbo.pos_customers
  SET
    full_name = COALESCE(NULLIF(LTRIM(RTRIM(@full_name)), N''), full_name),
    email = CASE WHEN @email IS NOT NULL THEN NULLIF(LTRIM(RTRIM(@email)), N'') ELSE email END,
    dob = COALESCE(@dob, dob)
  WHERE customer_id = @customer_id;

  IF @full_name IS NOT NULL AND NULLIF(LTRIM(RTRIM(@full_name)), N'') IS NOT NULL
     AND @full_name <> @old_name
    EXEC dbo.usp_cx_InsertAuditLog @customer_id, N'profile', @customer_id, N'UPDATE',
      N'full_name', @old_name, @full_name, @actor_user_id;

  IF @email IS NOT NULL AND ISNULL(@email, N'') <> ISNULL(@old_email, N'')
    EXEC dbo.usp_cx_InsertAuditLog @customer_id, N'profile', @customer_id, N'UPDATE',
      N'email', @old_email, @email, @actor_user_id;

  IF @dob IS NOT NULL AND (@dob <> @old_dob OR (@old_dob IS NULL AND @dob IS NOT NULL))
  BEGIN
    DECLARE @old_dob_txt NVARCHAR(30) = CASE WHEN @old_dob IS NULL THEN NULL ELSE CONVERT(NVARCHAR(30), @old_dob, 23) END;
    DECLARE @new_dob_txt NVARCHAR(30) = CONVERT(NVARCHAR(30), @dob, 23);
    EXEC dbo.usp_cx_InsertAuditLog @customer_id, N'profile', @customer_id, N'UPDATE',
      N'dob', @old_dob_txt, @new_dob_txt, @actor_user_id;
  END

  EXEC dbo.usp_cx_GetCustomerProfile @customer_id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_UpsertCustomerLifestyle
  @customer_id       INT,
  @screen_hrs        NVARCHAR(50) = NULL,
  @frame_pref        NVARCHAR(100) = NULL,
  @budget_min        INT = NULL,
  @budget_max        INT = NULL,
  @notes             NVARCHAR(500) = NULL,
  @actor_user_id     INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF NOT EXISTS (SELECT 1 FROM dbo.pos_customers WHERE customer_id = @customer_id)
  BEGIN
    RAISERROR(N'Customer not found.', 16, 1);
    RETURN;
  END

  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

  IF EXISTS (SELECT 1 FROM dbo.customer_lifestyle WHERE customer_id = @customer_id)
  BEGIN
    UPDATE dbo.customer_lifestyle
    SET
      screen_hrs = COALESCE(@screen_hrs, screen_hrs),
      frame_pref = COALESCE(@frame_pref, frame_pref),
      budget_min = COALESCE(@budget_min, budget_min),
      budget_max = COALESCE(@budget_max, budget_max),
      notes = COALESCE(@notes, notes),
      updated_at = @now,
      updated_by_user_id = @actor_user_id
    WHERE customer_id = @customer_id;

    EXEC dbo.usp_cx_InsertAuditLog @customer_id, N'lifestyle', @customer_id, N'UPDATE',
      N'lifestyle', NULL, N'updated', @actor_user_id;
  END
  ELSE
  BEGIN
    INSERT INTO dbo.customer_lifestyle (
      customer_id, screen_hrs, frame_pref, budget_min, budget_max, notes,
      updated_at, updated_by_user_id
    )
    VALUES (
      @customer_id, @screen_hrs, @frame_pref, @budget_min, @budget_max, @notes,
      @now, @actor_user_id
    );

    EXEC dbo.usp_cx_InsertAuditLog @customer_id, N'lifestyle', @customer_id, N'CREATE',
      NULL, NULL, N'created', @actor_user_id;
  END

  EXEC dbo.usp_cx_GetCustomerLifestyle @customer_id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_AssignCustomerOffer
  @customer_id       INT,
  @offer_id          INT,
  @notes             NVARCHAR(500) = NULL,
  @actor_user_id     INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF NOT EXISTS (SELECT 1 FROM dbo.customer_offers WHERE offer_id = @offer_id AND is_active = 1)
  BEGIN
    RAISERROR(N'Offer not found or inactive.', 16, 1);
    RETURN;
  END

  IF EXISTS (
    SELECT 1 FROM dbo.customer_offer_assignments
    WHERE customer_id = @customer_id AND offer_id = @offer_id AND revoked_at IS NULL
  )
  BEGIN
    RAISERROR(N'Offer already assigned to this customer.', 16, 1);
    RETURN;
  END

  INSERT INTO dbo.customer_offer_assignments (
    customer_id, offer_id, assigned_by_user_id, notes
  )
  VALUES (@customer_id, @offer_id, @actor_user_id, @notes);

  DECLARE @aid INT = SCOPE_IDENTITY();

  DECLARE @offer_id_txt NVARCHAR(20) = CAST(@offer_id AS NVARCHAR(20));
  EXEC dbo.usp_cx_InsertAuditLog @customer_id, N'offer_assignment', @aid, N'CREATE',
    N'offer_id', NULL, @offer_id_txt, @actor_user_id;

  SELECT @aid AS assignment_id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_RevokeCustomerOffer
  @assignment_id     INT,
  @actor_user_id     INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @customer_id INT;
  DECLARE @offer_id INT;

  SELECT @customer_id = customer_id, @offer_id = offer_id
  FROM dbo.customer_offer_assignments
  WHERE assignment_id = @assignment_id AND revoked_at IS NULL;

  IF @customer_id IS NULL
  BEGIN
    RAISERROR(N'Active assignment not found.', 16, 1);
    RETURN;
  END

  UPDATE dbo.customer_offer_assignments
  SET revoked_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()),
      revoked_by_user_id = @actor_user_id
  WHERE assignment_id = @assignment_id;

  DECLARE @revoke_offer_txt NVARCHAR(20) = CAST(@offer_id AS NVARCHAR(20));
  EXEC dbo.usp_cx_InsertAuditLog @customer_id, N'offer_assignment', @assignment_id, N'REVOKE',
    N'offer_id', @revoke_offer_txt, NULL, @actor_user_id;

  SELECT @assignment_id AS assignment_id, @customer_id AS customer_id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_ManualLoyaltyAdjustment
  @customer_id       INT,
  @coins_delta       INT,
  @reason            NVARCHAR(200),
  @actor_user_id     INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF @coins_delta = 0
  BEGIN
    RAISERROR(N'coins_delta must be non-zero.', 16, 1);
    RETURN;
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.pos_customers WHERE customer_id = @customer_id)
  BEGIN
    RAISERROR(N'Customer not found.', 16, 1);
    RETURN;
  END

  DECLARE @live INT = ISNULL((
    SELECT TOP 1 balance_after FROM dbo.loyalty_ledger
    WHERE customer_id = @customer_id AND status = N'LIVE'
    ORDER BY ledger_id DESC
  ), 0);

  DECLARE @newBal INT = @live + @coins_delta;
  IF @newBal < 0
  BEGIN
    RAISERROR(N'Adjustment would make balance negative.', 16, 1);
    RETURN;
  END

  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

  INSERT INTO dbo.loyalty_ledger (
    customer_id, entry_type, status, coins_delta, balance_after,
    reason, available_at, created_by_user_id
  )
  VALUES (
    @customer_id, N'MANUAL', N'LIVE', @coins_delta, @newBal,
    @reason, @now, @actor_user_id
  );

  DECLARE @lid BIGINT = SCOPE_IDENTITY();

  DECLARE @live_txt NVARCHAR(20) = CAST(@live AS NVARCHAR(20));
  DECLARE @new_bal_txt NVARCHAR(20) = CAST(@newBal AS NVARCHAR(20));
  EXEC dbo.usp_cx_InsertAuditLog @customer_id, N'loyalty_ledger', @lid, N'MANUAL',
    N'coins_delta', @live_txt, @new_bal_txt, @actor_user_id;

  SELECT @lid AS ledger_id, @newBal AS balance_after;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_UpdateLoyaltySettings
  @earn_percent                DECIMAL(5,2) = NULL,
  @credit_delay_days           INT = NULL,
  @redemption_coins_per_rupee  INT = NULL,
  @max_redeem_percent_of_bill  DECIMAL(5,2) = NULL,
  @actor_user_id               INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF NOT EXISTS (SELECT 1 FROM dbo.loyalty_settings WHERE settings_id = 1)
  BEGIN
    INSERT INTO dbo.loyalty_settings (settings_id, updated_at, updated_by_user_id)
    VALUES (1, DATEADD(MINUTE, 330, SYSUTCDATETIME()), @actor_user_id);
  END

  UPDATE dbo.loyalty_settings
  SET
    earn_percent = COALESCE(@earn_percent, earn_percent),
    credit_delay_days = COALESCE(@credit_delay_days, credit_delay_days),
    redemption_coins_per_rupee = COALESCE(@redemption_coins_per_rupee, redemption_coins_per_rupee),
    max_redeem_percent_of_bill = COALESCE(@max_redeem_percent_of_bill, max_redeem_percent_of_bill),
    updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    updated_by_user_id = @actor_user_id
  WHERE settings_id = 1;

  EXEC dbo.usp_cx_GetLoyaltySettings;
END;
GO
