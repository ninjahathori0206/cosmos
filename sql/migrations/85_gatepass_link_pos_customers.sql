-- Migration 85 — Link store visitors to central pos_customers by phone (Cx DB is not per-store).

-- Backfill existing active visitors
UPDATE sv
SET sv.customer_id = c.customer_id,
    sv.updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
FROM dbo.store_visitors sv
INNER JOIN dbo.pos_customers c
  ON c.phone = sv.phone AND c.is_active = 1
WHERE sv.customer_id IS NULL;
GO

-- ─── sp_gatepass_checkin — set customer_id from central Cx on check-in / reopen ───
CREATE OR ALTER PROCEDURE dbo.sp_gatepass_checkin
  @name                 NVARCHAR(100),
  @phone                VARCHAR(15),
  @store_id             INT,
  @channel              VARCHAR(20),
  @checkin_by_user_id   INT = NULL,
  @purpose              VARCHAR(50) = NULL,
  @notes                NVARCHAR(500) = NULL,
  @ip_address           VARCHAR(45) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());
  DECLARE @today DATE = CAST(@now AS DATE);
  DECLARE @max_active INT = dbo.fn_gatepass_setting_int(@store_id, 'vms.max_active_visitors', 50);
  DECLARE @expiry_min INT = dbo.fn_gatepass_setting_int(@store_id, 'vms.visitor_expiry_minutes', 240);
  DECLARE @active_count INT;
  DECLARE @visitor_id INT;
  DECLARE @already BIT = 0;
  DECLARE @customer_id INT;

  SELECT TOP 1 @customer_id = c.customer_id
  FROM dbo.pos_customers c
  WHERE c.phone = @phone AND c.is_active = 1
  ORDER BY c.customer_id;

  SELECT @active_count = COUNT(*)
  FROM dbo.store_visitors sv
  WHERE sv.store_id = @store_id AND sv.status IN ('waiting', 'in_service');

  IF @active_count >= @max_active
  BEGIN
    RAISERROR('Maximum active visitors reached for this store.', 16, 1);
    RETURN;
  END;

  SELECT TOP 1 @visitor_id = sv.visitor_id, @already = 1
  FROM dbo.store_visitors sv WITH (UPDLOCK, ROWLOCK)
  WHERE sv.store_id = @store_id
    AND sv.phone = @phone
    AND sv.status IN ('waiting', 'in_service')
  ORDER BY sv.checkin_at DESC;

  IF @visitor_id IS NOT NULL
  BEGIN
    IF @customer_id IS NOT NULL
    BEGIN
      UPDATE dbo.store_visitors
      SET customer_id = COALESCE(customer_id, @customer_id),
          updated_at = @now
      WHERE visitor_id = @visitor_id AND customer_id IS NULL;
    END;

    SELECT
      sv.visitor_id, sv.name, sv.phone,
      COALESCE(sv.customer_id, @customer_id) AS customer_id,
      CAST(CASE WHEN COALESCE(sv.customer_id, @customer_id) IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS has_customer,
      sv.store_id, sv.purpose, sv.status, sv.checkin_at, sv.checkout_at, sv.expiry_at,
      sv.checkin_channel, sv.notes,
      DATEDIFF(MINUTE, sv.checkin_at, @now) AS wait_minutes,
      @already AS already_checked_in
    FROM dbo.store_visitors sv
    WHERE sv.visitor_id = @visitor_id;
    RETURN;
  END;

  SELECT TOP 1 @visitor_id = sv.visitor_id
  FROM dbo.store_visitors sv WITH (UPDLOCK, ROWLOCK)
  WHERE sv.store_id = @store_id
    AND sv.phone = @phone
    AND sv.status IN ('completed', 'no_show', 'expired')
    AND CAST(sv.checkin_at AS DATE) = @today
  ORDER BY sv.checkin_at DESC;

  BEGIN TRY
    BEGIN TRAN;

    IF @visitor_id IS NOT NULL
    BEGIN
      UPDATE dbo.store_visitors
      SET name = @name,
          purpose = @purpose,
          notes = COALESCE(@notes, notes),
          status = 'waiting',
          status_changed_at = @now,
          checkin_at = @now,
          checkout_at = NULL,
          expiry_at = DATEADD(MINUTE, @expiry_min, @now),
          checkin_channel = @channel,
          checkin_by_user_id = @checkin_by_user_id,
          customer_id = COALESCE(customer_id, @customer_id),
          updated_at = @now
      WHERE visitor_id = @visitor_id;

      INSERT INTO dbo.visitor_audit_log (visitor_id, action, old_value, new_value, performed_by, ip_address)
      VALUES (@visitor_id, 'checked_in', N'reopened', N'waiting', @checkin_by_user_id, @ip_address);
    END
    ELSE
    BEGIN
      INSERT INTO dbo.store_visitors (
        name, phone, store_id, customer_id, purpose, checkin_at, checkin_channel, checkin_by_user_id,
        status, status_changed_at, expiry_at, notes, created_at, updated_at
      )
      VALUES (
        @name, @phone, @store_id, @customer_id, @purpose, @now, @channel, @checkin_by_user_id,
        'waiting', @now, DATEADD(MINUTE, @expiry_min, @now), @notes, @now, @now
      );
      SET @visitor_id = SCOPE_IDENTITY();

      INSERT INTO dbo.visitor_audit_log (visitor_id, action, old_value, new_value, performed_by, ip_address)
      VALUES (@visitor_id, 'checked_in', NULL, N'waiting', @checkin_by_user_id, @ip_address);
    END;

    COMMIT TRAN;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
  END CATCH;

  SELECT
    sv.visitor_id, sv.name, sv.phone, sv.customer_id,
    CAST(CASE WHEN sv.customer_id IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS has_customer,
    sv.store_id, sv.purpose, sv.status, sv.checkin_at, sv.checkout_at, sv.expiry_at,
    sv.checkin_channel, sv.notes,
    DATEDIFF(MINUTE, sv.checkin_at, @now) AS wait_minutes,
    @already AS already_checked_in
  FROM dbo.store_visitors sv
  WHERE sv.visitor_id = @visitor_id;
END;
GO

-- ─── sp_gatepass_search — resolve has_customer from central Cx when visitor row is unlinked ───
CREATE OR ALTER PROCEDURE dbo.sp_gatepass_search
  @phone_fragment VARCHAR(15),
  @store_id       INT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());
  DECLARE @frag VARCHAR(15) = ISNULL(@phone_fragment, '');
  DECLARE @max_active INT = dbo.fn_gatepass_setting_int(@store_id, 'vms.max_active_visitors', 50);

  SELECT TOP (@max_active)
    sv.visitor_id, sv.name, sv.phone,
    COALESCE(sv.customer_id, cx.customer_id) AS customer_id,
    CAST(CASE WHEN COALESCE(sv.customer_id, cx.customer_id) IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS has_customer,
    sv.purpose, sv.status, sv.checkin_at, sv.checkout_at,
    u.full_name AS assigned_staff_name,
    DATEDIFF(MINUTE, sv.checkin_at, @now) AS wait_minutes
  FROM dbo.store_visitors sv
  LEFT JOIN dbo.users u ON u.user_id = sv.assigned_user_id
  OUTER APPLY (
    SELECT TOP 1 c.customer_id
    FROM dbo.pos_customers c
    WHERE c.phone = sv.phone AND c.is_active = 1
    ORDER BY c.customer_id
  ) cx
  WHERE sv.store_id = @store_id
    AND sv.status IN ('waiting', 'in_service')
    AND (@frag = '' OR sv.phone LIKE '%' + @frag + '%')
  ORDER BY sv.checkin_at ASC;

  SELECT TOP 5
    sv.visitor_id, sv.name, sv.phone,
    COALESCE(sv.customer_id, cx.customer_id) AS customer_id,
    CAST(CASE WHEN COALESCE(sv.customer_id, cx.customer_id) IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS has_customer,
    sv.purpose, sv.status, sv.checkin_at, sv.checkout_at,
    u.full_name AS assigned_staff_name,
    DATEDIFF(MINUTE, sv.checkin_at, @now) AS wait_minutes
  FROM dbo.store_visitors sv
  LEFT JOIN dbo.users u ON u.user_id = sv.assigned_user_id
  OUTER APPLY (
    SELECT TOP 1 c.customer_id
    FROM dbo.pos_customers c
    WHERE c.phone = sv.phone AND c.is_active = 1
    ORDER BY c.customer_id
  ) cx
  WHERE sv.store_id = @store_id
    AND sv.status = 'completed'
    AND sv.checkout_at IS NOT NULL
    AND sv.checkout_at >= DATEADD(HOUR, -24, @now)
    AND (@frag = '' OR sv.phone LIKE '%' + @frag + '%')
  ORDER BY sv.checkout_at DESC;
END;
GO

-- ─── sp_gatepass_queue — same central Cx link for queue list ───
CREATE OR ALTER PROCEDURE dbo.sp_gatepass_queue
  @store_id       INT,
  @status_filter  VARCHAR(50) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

  SELECT
    sv.visitor_id, sv.name, sv.phone,
    COALESCE(sv.customer_id, cx.customer_id) AS customer_id,
    CAST(CASE WHEN COALESCE(sv.customer_id, cx.customer_id) IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS has_customer,
    sv.purpose, sv.status, sv.checkin_at, sv.checkout_at, sv.expiry_at, sv.notes,
    u.full_name AS assigned_staff_name,
    DATEDIFF(MINUTE, sv.checkin_at, @now) AS wait_minutes
  FROM dbo.store_visitors sv
  LEFT JOIN dbo.users u ON u.user_id = sv.assigned_user_id
  OUTER APPLY (
    SELECT TOP 1 c.customer_id
    FROM dbo.pos_customers c
    WHERE c.phone = sv.phone AND c.is_active = 1
    ORDER BY c.customer_id
  ) cx
  WHERE sv.store_id = @store_id
    AND (
      @status_filter IS NULL OR LTRIM(RTRIM(@status_filter)) = ''
      OR sv.status = LTRIM(RTRIM(@status_filter))
    )
    AND sv.status IN ('waiting', 'in_service')
  ORDER BY sv.checkin_at ASC;
END;
GO
