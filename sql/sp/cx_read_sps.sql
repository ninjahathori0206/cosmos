/*
  CX Customer 360 — read stored procedures
  Deploy: npm run deploy:cx-sps
*/
USE [CosmosERP];
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_GetLoyaltySettings
AS
BEGIN
  SET NOCOUNT ON;
  SELECT TOP 1
    settings_id,
    earn_percent,
    credit_delay_days,
    redemption_coins_per_rupee,
    max_redeem_percent_of_bill,
    updated_at,
    updated_by_user_id
  FROM dbo.loyalty_settings
  WHERE settings_id = 1;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_GetLiveCoinBalance
  @customer_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT ISNULL((
    SELECT TOP 1 ll.balance_after
    FROM dbo.loyalty_ledger ll
    WHERE ll.customer_id = @customer_id AND ll.status = N'LIVE'
    ORDER BY ll.ledger_id DESC
  ), 0) AS live_balance;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_GetCustomerProfile
  @customer_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    c.customer_id,
    c.full_name,
    c.phone,
    c.email,
    c.dob,
    c.home_store_id,
    s.store_name AS home_store_name,
    c.is_active,
    c.created_at AS member_since
  FROM dbo.pos_customers c
  LEFT JOIN dbo.stores s ON s.store_id = c.home_store_id
  WHERE c.customer_id = @customer_id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_GetCustomerLifestyle
  @customer_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    customer_id,
    screen_hrs,
    frame_pref,
    budget_min,
    budget_max,
    notes,
    updated_at,
    updated_by_user_id
  FROM dbo.customer_lifestyle
  WHERE customer_id = @customer_id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_GetCustomerLoyaltyLedger
  @customer_id INT,
  @limit       INT = 50
AS
BEGIN
  SET NOCOUNT ON;
  IF @limit < 1 SET @limit = 1;
  IF @limit > 200 SET @limit = 200;

  SELECT TOP (@limit)
    ll.ledger_id,
    ll.customer_id,
    ll.triggered_by_customer_id,
    trig.full_name AS triggered_by_name,
    ll.order_id,
    o.order_no,
    ll.invoice_id,
    ll.entry_type,
    ll.status,
    ll.coins_delta,
    ll.balance_after,
    ll.reason,
    ll.available_at,
    ll.created_at,
    ll.created_by_user_id
  FROM dbo.loyalty_ledger ll
  LEFT JOIN dbo.pos_customers trig ON trig.customer_id = ll.triggered_by_customer_id
  LEFT JOIN dbo.pos_orders o ON o.order_id = ll.order_id
  WHERE ll.customer_id = @customer_id
  ORDER BY ll.ledger_id DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_GetCustomerOfferAssignments
  @customer_id INT,
  @active_only BIT = 1
AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    a.assignment_id,
    a.customer_id,
    a.offer_id,
    o.title,
    o.description,
    o.icon_emoji,
    o.discount_type,
    o.discount_value,
    o.cashback_rate,
    o.valid_from,
    o.valid_to,
    o.is_active AS offer_is_active,
    a.assigned_at,
    a.assigned_by_user_id,
    a.revoked_at,
    a.notes
  FROM dbo.customer_offer_assignments a
  INNER JOIN dbo.customer_offers o ON o.offer_id = a.offer_id
  WHERE a.customer_id = @customer_id
    AND (@active_only = 0 OR a.revoked_at IS NULL)
  ORDER BY a.assigned_at DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_GetCustomerAuditLog
  @customer_id INT,
  @limit       INT = 100
AS
BEGIN
  SET NOCOUNT ON;
  IF @limit < 1 SET @limit = 1;
  IF @limit > 500 SET @limit = 500;

  SELECT TOP (@limit)
    a.audit_id,
    a.customer_id,
    a.entity_type,
    a.entity_id,
    a.action,
    a.field_name,
    a.old_value,
    a.new_value,
    a.actor_user_id,
    u.full_name AS actor_name,
    a.created_at
  FROM dbo.cx_audit_log a
  LEFT JOIN dbo.users u ON u.user_id = a.actor_user_id
  WHERE a.customer_id = @customer_id
  ORDER BY a.audit_id DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_GetCustomerEyeTests
  @customer_id INT,
  @limit       INT = 30
AS
BEGIN
  SET NOCOUNT ON;
  IF @limit < 1 SET @limit = 1;
  IF @limit > 100 SET @limit = 100;

  SELECT TOP (@limit)
    et.test_id,
    et.customer_id,
    et.visitor_id,
    et.family_name_id,
    fn.family_name,
    et.patient_name,
    et.tested_at,
    et.store_id,
    st.store_name,
    et.re_sph, et.re_cyl, et.re_axis, et.re_add, et.re_va,
    et.le_sph, et.le_cyl, et.le_axis, et.le_add, et.le_va,
    et.pd, et.lens_type, et.source, et.notes, et.created_at
  FROM dbo.eye_tests et
  LEFT JOIN dbo.stores st ON st.store_id = et.store_id
  LEFT JOIN dbo.pos_customer_family_names fn ON fn.family_name_id = et.family_name_id
  WHERE et.customer_id = @customer_id
     OR et.visitor_id IN (
          SELECT visitor_id FROM dbo.store_visitors
          WHERE customer_id = @customer_id
        )
  ORDER BY et.tested_at DESC, et.test_id DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_GetCustomerVisits
  @customer_id INT,
  @limit       INT = 50
AS
BEGIN
  SET NOCOUNT ON;
  IF @limit < 1 SET @limit = 1;
  IF @limit > 200 SET @limit = 200;

  DECLARE @phone VARCHAR(15);
  SELECT @phone = NULLIF(LTRIM(RTRIM(phone)), '')
  FROM dbo.pos_customers WHERE customer_id = @customer_id;

  SELECT TOP (@limit)
    sv.visitor_id,
    sv.store_id,
    st.store_name,
    sv.name AS visitor_name,
    sv.phone,
    sv.purpose,
    sv.status,
    sv.checkin_at,
    sv.checkout_at,
    sv.checkin_channel,
    sv.customer_id,
    DATEDIFF(MINUTE, sv.checkin_at, COALESCE(sv.checkout_at, DATEADD(MINUTE, 330, SYSUTCDATETIME()))) AS wait_minutes,
    cu.full_name AS checkin_by_name
  FROM dbo.store_visitors sv
  LEFT JOIN dbo.stores st ON st.store_id = sv.store_id
  LEFT JOIN dbo.users cu ON cu.user_id = sv.checkin_by_user_id
  WHERE (
    sv.customer_id = @customer_id
    OR (
      @phone IS NOT NULL
      AND sv.phone = @phone
      AND (sv.customer_id IS NULL OR sv.customer_id = @customer_id)
    )
  )
  ORDER BY sv.checkin_at DESC, sv.visitor_id DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_GetCustomer360Header
  @customer_id INT
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @live INT = 0;
  DECLARE @pending INT = 0;

  SELECT @live = ISNULL((
    SELECT TOP 1 balance_after FROM dbo.loyalty_ledger
    WHERE customer_id = @customer_id AND status = N'LIVE'
    ORDER BY ledger_id DESC
  ), 0);

  SELECT @pending = ISNULL(SUM(coins_delta), 0)
  FROM dbo.loyalty_ledger
  WHERE customer_id = @customer_id AND status = N'PENDING';

  SELECT
    c.customer_id,
    c.full_name,
    c.phone,
    c.email,
    c.dob,
    c.home_store_id,
    s.store_name AS home_store_name,
    c.is_active,
    c.created_at AS member_since,
    @live AS coins_live,
    @pending AS coins_pending,
    (SELECT COUNT(*) FROM dbo.customer_offer_assignments coa
     WHERE coa.customer_id = @customer_id AND coa.revoked_at IS NULL) AS active_offer_count,
    (SELECT COUNT(*) FROM dbo.store_visitors sv
     INNER JOIN dbo.pos_customers pc ON pc.customer_id = @customer_id
     WHERE sv.customer_id = @customer_id
        OR (pc.phone IS NOT NULL AND sv.phone = pc.phone)) AS visit_count
  FROM dbo.pos_customers c
  LEFT JOIN dbo.stores s ON s.store_id = c.home_store_id
  WHERE c.customer_id = @customer_id;
END;
GO
