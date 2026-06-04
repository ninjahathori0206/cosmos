/*
  GatePass Phase 3 — assign staff, expire visitors, queue/status return assigned staff.
*/
USE [CosmosERP];
GO

-- ─── sp_gatepass_assign_staff ──────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_gatepass_assign_staff
  @visitor_id        INT,
  @assigned_user_id  INT = NULL,
  @store_id          INT = NULL,
  @performed_by      INT = NULL,
  @ip_address        VARCHAR(45) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());
  DECLARE @visitor_store INT;
  DECLARE @old_assigned INT;

  SELECT @visitor_store = sv.store_id, @old_assigned = sv.assigned_user_id
  FROM dbo.store_visitors sv WITH (UPDLOCK, ROWLOCK)
  WHERE sv.visitor_id = @visitor_id;

  IF @visitor_store IS NULL
  BEGIN
    RAISERROR('Visitor not found.', 16, 1);
    RETURN;
  END;

  IF @store_id IS NOT NULL AND @visitor_store <> @store_id
  BEGIN
    RAISERROR('Visitor not found for this store.', 16, 1);
    RETURN;
  END;

  IF @assigned_user_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM dbo.users u WHERE u.user_id = @assigned_user_id AND u.is_active = 1)
  BEGIN
    RAISERROR('Staff user not found.', 16, 1);
    RETURN;
  END;

  BEGIN TRY
    BEGIN TRAN;

    UPDATE dbo.store_visitors
    SET assigned_user_id = @assigned_user_id,
        updated_at = @now
    WHERE visitor_id = @visitor_id;

    INSERT INTO dbo.visitor_audit_log (visitor_id, action, old_value, new_value, performed_by, ip_address)
    VALUES (
      @visitor_id,
      'assigned',
      CASE WHEN @old_assigned IS NULL THEN NULL ELSE CAST(@old_assigned AS NVARCHAR(20)) END,
      CASE WHEN @assigned_user_id IS NULL THEN NULL ELSE CAST(@assigned_user_id AS NVARCHAR(20)) END,
      @performed_by,
      @ip_address
    );

    COMMIT TRAN;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
  END CATCH;

  SELECT
    sv.visitor_id, sv.name, sv.phone,
    COALESCE(sv.customer_id, cx.customer_id) AS customer_id,
    CAST(CASE WHEN COALESCE(sv.customer_id, cx.customer_id) IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS has_customer,
    sv.store_id, sv.purpose, sv.status, sv.checkin_at, sv.checkout_at, sv.expiry_at, sv.notes,
    sv.assigned_user_id,
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
  WHERE sv.visitor_id = @visitor_id;
END;
GO

-- ─── sp_gatepass_expire_visitors — system batch (cron / npm run gatepass:expire) ───
CREATE OR ALTER PROCEDURE dbo.sp_gatepass_expire_visitors
  @store_id INT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

  DECLARE @expired TABLE (visitor_id INT NOT NULL, old_status VARCHAR(20) NOT NULL);

  UPDATE sv
  SET sv.status = 'expired',
      sv.status_changed_at = @now,
      sv.updated_at = @now
  OUTPUT INSERTED.visitor_id, deleted.status INTO @expired (visitor_id, old_status)
  FROM dbo.store_visitors sv
  WHERE sv.status IN ('waiting', 'in_service')
    AND sv.expiry_at < @now
    AND (@store_id IS NULL OR sv.store_id = @store_id);

  INSERT INTO dbo.visitor_audit_log (visitor_id, action, old_value, new_value, performed_by, ip_address)
  SELECT e.visitor_id, 'status_changed', e.old_status, 'expired', NULL, NULL
  FROM @expired e;

  SELECT COUNT(*) AS expired_count FROM @expired;
END;
GO

-- ─── sp_gatepass_update_status — include assigned staff in result ────────────
CREATE OR ALTER PROCEDURE dbo.sp_gatepass_update_status
  @visitor_id     INT,
  @new_status     VARCHAR(20),
  @store_id       INT = NULL,
  @performed_by   INT = NULL,
  @ip_address     VARCHAR(45) = NULL,
  @allow_system   BIT = 0
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());
  DECLARE @old_status VARCHAR(20);
  DECLARE @visitor_store INT;

  SELECT @old_status = sv.status, @visitor_store = sv.store_id
  FROM dbo.store_visitors sv WITH (UPDLOCK, ROWLOCK)
  WHERE sv.visitor_id = @visitor_id;

  IF @old_status IS NULL
  BEGIN
    RAISERROR('Visitor not found.', 16, 1);
    RETURN;
  END;

  IF @store_id IS NOT NULL AND @visitor_store <> @store_id
  BEGIN
    RAISERROR('Visitor not found for this store.', 16, 1);
    RETURN;
  END;

  IF @new_status = 'expired' AND @allow_system = 0
  BEGIN
    RAISERROR('Expired status is system-only.', 16, 1);
    RETURN;
  END;

  IF NOT (
    (@old_status = 'waiting' AND @new_status IN ('in_service', 'no_show', 'expired'))
    OR (@old_status = 'in_service' AND @new_status IN ('completed', 'no_show', 'expired'))
  )
  BEGIN
    RAISERROR('Invalid status transition.', 16, 1);
    RETURN;
  END;

  BEGIN TRY
    BEGIN TRAN;

    UPDATE dbo.store_visitors
    SET status = @new_status,
        status_changed_at = @now,
        checkout_at = CASE WHEN @new_status IN ('completed', 'no_show') THEN @now ELSE checkout_at END,
        updated_at = @now
    WHERE visitor_id = @visitor_id;

    INSERT INTO dbo.visitor_audit_log (visitor_id, action, old_value, new_value, performed_by, ip_address)
    VALUES (@visitor_id, 'status_changed', @old_status, @new_status, @performed_by, @ip_address);

    COMMIT TRAN;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
  END CATCH;

  SELECT
    sv.visitor_id, sv.name, sv.phone,
    COALESCE(sv.customer_id, cx.customer_id) AS customer_id,
    CAST(CASE WHEN COALESCE(sv.customer_id, cx.customer_id) IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS has_customer,
    sv.store_id, sv.purpose, sv.status, sv.checkin_at, sv.checkout_at, sv.expiry_at, sv.notes,
    sv.assigned_user_id,
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
  WHERE sv.visitor_id = @visitor_id;
END;
GO

PRINT 'GatePass Phase 3 migration complete.';
GO
