-- ─────────────────────────────────────────────────────────────────────────────
-- Finance stored procedures — Foundry AP (Accounts Payable)
-- ─────────────────────────────────────────────────────────────────────────────
USE [CosmosERP];
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_Supplier_SetCreditDays
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_Supplier_SetCreditDays','P') IS NOT NULL DROP PROCEDURE dbo.sp_Supplier_SetCreditDays;
GO
CREATE PROCEDURE dbo.sp_Supplier_SetCreditDays
  @supplier_id INT,
  @credit_days INT = NULL
AS BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.suppliers
     SET credit_days = @credit_days,
         updated_at  = GETDATE()
   WHERE supplier_id = @supplier_id;

  SELECT supplier_id, vendor_name, credit_days
    FROM dbo.suppliers
   WHERE supplier_id = @supplier_id;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_Finance_SupplierSummary
-- One row per active Foundry supplier with AP totals.
-- Uses CTEs to avoid nested-aggregate restrictions.
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_Finance_SupplierSummary','P') IS NOT NULL DROP PROCEDURE dbo.sp_Finance_SupplierSummary;
GO
CREATE PROCEDURE dbo.sp_Finance_SupplierSummary
  @supplier_id INT = NULL
AS BEGIN
  SET NOCOUNT ON;

  -- Per-bill outstanding (verified bills only)
  WITH bill_totals AS (
    SELECT
      ph.supplier_id,
      ph.header_id,
      ph.bill_date,
      ISNULL(ph.actual_bill_amt, ph.expected_bill_amt) AS bill_amount
    FROM dbo.purchase_headers ph
    WHERE ph.pipeline_status <> 'PENDING_BILL_VERIFICATION'
  ),
  bill_paid AS (
    SELECT
      pa.header_id,
      SUM(pa.allocated_amt) AS paid_amt
    FROM dbo.payment_allocations pa
    JOIN dbo.supplier_payments sp ON sp.payment_id = pa.payment_id
    WHERE sp.is_void = 0
    GROUP BY pa.header_id
  ),
  bill_out AS (
    SELECT
      bt.supplier_id,
      bt.header_id,
      bt.bill_date,
      bt.bill_amount,
      ISNULL(bp.paid_amt, 0) AS paid_amt,
      bt.bill_amount - ISNULL(bp.paid_amt, 0) AS outstanding
    FROM bill_totals bt
    LEFT JOIN bill_paid bp ON bp.header_id = bt.header_id
  ),
  supplier_payments_totals AS (
    SELECT
      supplier_id,
      SUM(amount) AS total_paid
    FROM dbo.supplier_payments
    WHERE is_void = 0
    GROUP BY supplier_id
  )
  SELECT
    s.supplier_id,
    s.vendor_name,
    s.vendor_code,
    s.city,
    s.payment_terms,
    s.credit_days,
    s.vendor_status,
    s.opening_balance,
    ISNULL(SUM(bo.bill_amount), 0)                       AS total_purchase,
    ISNULL(MAX(spt.total_paid), 0)                       AS total_paid,
    -- outstanding = opening_balance + total_purchase - total_paid
    s.opening_balance
      + ISNULL(SUM(bo.bill_amount), 0)
      - ISNULL(MAX(spt.total_paid), 0)                   AS outstanding,
    COUNT(DISTINCT bo.header_id)                         AS total_bills,
    SUM(CASE
      WHEN bo.outstanding > 0.005
        AND bo.bill_date IS NOT NULL
        AND DATEADD(day, ISNULL(s.credit_days, 0), bo.bill_date) < CAST(GETDATE() AS DATE)
      THEN 1 ELSE 0
    END)                                                 AS overdue_bills
  FROM dbo.suppliers s
  LEFT JOIN bill_out bo ON bo.supplier_id = s.supplier_id
  LEFT JOIN supplier_payments_totals spt ON spt.supplier_id = s.supplier_id
  WHERE s.vendor_status = 'active'
    AND (@supplier_id IS NULL OR s.supplier_id = @supplier_id)
  GROUP BY
    s.supplier_id, s.vendor_name, s.vendor_code, s.city,
    s.payment_terms, s.credit_days, s.vendor_status, s.opening_balance
  ORDER BY (s.opening_balance + ISNULL(SUM(bo.bill_amount), 0) - ISNULL(MAX(spt.total_paid), 0)) DESC;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_Finance_SupplierStatement
-- Supplier header + bill rows + payment rows for a single supplier.
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_Finance_SupplierStatement','P') IS NOT NULL DROP PROCEDURE dbo.sp_Finance_SupplierStatement;
GO
CREATE PROCEDURE dbo.sp_Finance_SupplierStatement
  @supplier_id INT
AS BEGIN
  SET NOCOUNT ON;

  -- Result set 1: Supplier header
  SELECT
    s.supplier_id, s.vendor_name, s.vendor_code,
    s.payment_terms, s.credit_days, s.city, s.contact_person, s.contact_phone,
    s.opening_balance,
    s.bank_name, s.bank_account_no, s.bank_ifsc, s.bank_account_holder
  FROM dbo.suppliers s
  WHERE s.supplier_id = @supplier_id;

  -- Result set 2: Bill-level statement
  -- Per-bill paid amounts via a sub-select so no nested aggregates
  SELECT
    ph.header_id,
    ph.bill_ref,
    ph.bill_number,
    ph.bill_date,
    ph.purchase_date,
    ph.pipeline_status,
    ISNULL(ph.actual_bill_amt, ph.expected_bill_amt) AS bill_amount,
    ph.expected_bill_amt,
    ph.actual_bill_amt,
    ISNULL(paid.paid_amt, 0)                         AS paid_amount,
    ISNULL(ph.actual_bill_amt, ph.expected_bill_amt)
      - ISNULL(paid.paid_amt, 0)                     AS outstanding,
    DATEADD(day,
      ISNULL((SELECT credit_days FROM dbo.suppliers WHERE supplier_id = @supplier_id), 0),
      ph.bill_date)                                  AS due_date,
    DATEDIFF(day,
      DATEADD(day,
        ISNULL((SELECT credit_days FROM dbo.suppliers WHERE supplier_id = @supplier_id), 0),
        ph.bill_date),
      CAST(GETDATE() AS DATE))                       AS days_overdue
  FROM dbo.purchase_headers ph
  LEFT JOIN (
    SELECT pa.header_id, SUM(pa.allocated_amt) AS paid_amt
    FROM dbo.payment_allocations pa
    JOIN dbo.supplier_payments sp2 ON sp2.payment_id = pa.payment_id
    WHERE sp2.is_void = 0
    GROUP BY pa.header_id
  ) paid ON paid.header_id = ph.header_id
  WHERE ph.supplier_id = @supplier_id
    AND ph.pipeline_status <> 'PENDING_BILL_VERIFICATION'
  ORDER BY ph.bill_date DESC, ph.header_id DESC;

  -- Result set 3: Payment history
  SELECT
    sp.payment_id,
    sp.payment_date,
    sp.amount,
    sp.payment_mode,
    sp.reference_no,
    sp.bank_account,
    sp.notes,
    sp.is_void,
    sp.void_reason,
    sp.created_at,
    (
      SELECT pa.header_id, pa.allocated_amt
        FROM dbo.payment_allocations pa
       WHERE pa.payment_id = sp.payment_id
         FOR JSON PATH
    ) AS allocations_json
  FROM dbo.supplier_payments sp
  WHERE sp.supplier_id = @supplier_id
  ORDER BY sp.payment_date DESC, sp.payment_id DESC;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_Finance_Payment_Create
-- Creates a supplier payment with optional bill allocations.
-- @allocations_json = JSON: [{header_id, allocated_amt}]
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_Finance_Payment_Create','P') IS NOT NULL DROP PROCEDURE dbo.sp_Finance_Payment_Create;
GO
CREATE PROCEDURE dbo.sp_Finance_Payment_Create
  @supplier_id      INT,
  @payment_date     DATE,
  @amount           DECIMAL(12,2),
  @payment_mode     VARCHAR(30)   = 'NEFT',
  @reference_no     VARCHAR(100)  = NULL,
  @bank_account     VARCHAR(100)  = NULL,
  @notes            VARCHAR(500)  = NULL,
  @created_by       INT           = NULL,
  @allocations_json NVARCHAR(MAX) = NULL
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRANSACTION;

    IF NOT EXISTS (SELECT 1 FROM dbo.suppliers WHERE supplier_id = @supplier_id)
      RAISERROR('Supplier not found.',16,1);

    IF @amount <= 0
      RAISERROR('Payment amount must be positive.',16,1);

    INSERT INTO dbo.supplier_payments
      (supplier_id, payment_date, amount, payment_mode, reference_no, bank_account, notes, created_by)
    VALUES
      (@supplier_id, @payment_date, @amount, @payment_mode, @reference_no, @bank_account, @notes, @created_by);

    DECLARE @payment_id INT = SCOPE_IDENTITY();

    IF @allocations_json IS NOT NULL AND LEN(@allocations_json) > 2
    BEGIN
      INSERT INTO dbo.payment_allocations (payment_id, header_id, allocated_amt)
      SELECT @payment_id, j.header_id, j.allocated_amt
      FROM OPENJSON(@allocations_json) WITH (
        header_id     INT            '$.header_id',
        allocated_amt DECIMAL(12,2)  '$.allocated_amt'
      ) j
      WHERE j.allocated_amt > 0;
    END;

    COMMIT TRANSACTION;

    SELECT payment_id, supplier_id, payment_date, amount,
           payment_mode, reference_no, bank_account, notes, created_at
      FROM dbo.supplier_payments
     WHERE payment_id = @payment_id;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
  END CATCH;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_Finance_Payment_Void
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_Finance_Payment_Void','P') IS NOT NULL DROP PROCEDURE dbo.sp_Finance_Payment_Void;
GO
CREATE PROCEDURE dbo.sp_Finance_Payment_Void
  @payment_id  INT,
  @void_reason VARCHAR(300) = NULL
AS BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.supplier_payments
     SET is_void    = 1,
         void_reason = @void_reason,
         updated_at  = GETDATE()
   WHERE payment_id = @payment_id;

  SELECT payment_id, is_void, void_reason FROM dbo.supplier_payments WHERE payment_id = @payment_id;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_Finance_DashboardStats
-- Summary stats for the Finance dashboard.
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_Finance_DashboardStats','P') IS NOT NULL DROP PROCEDURE dbo.sp_Finance_DashboardStats;
GO
CREATE PROCEDURE dbo.sp_Finance_DashboardStats
AS BEGIN
  SET NOCOUNT ON;

  DECLARE @total_payable    DECIMAL(14,2);
  DECLARE @total_paid       DECIMAL(14,2);
  DECLARE @total_overdue    DECIMAL(14,2);
  DECLARE @active_suppliers INT;
  DECLARE @suppliers_out    INT;
  DECLARE @payments_30d     INT;

  -- total payable = opening balances + verified bills
  SELECT @total_payable = ISNULL((SELECT SUM(opening_balance) FROM dbo.suppliers WHERE vendor_status='active'), 0)
    + ISNULL(SUM(
        CASE WHEN pipeline_status <> 'PENDING_BILL_VERIFICATION'
             THEN ISNULL(actual_bill_amt, expected_bill_amt)
             ELSE 0 END), 0)
  FROM dbo.purchase_headers;

  SELECT @total_paid = ISNULL(SUM(amount), 0)
  FROM dbo.supplier_payments WHERE is_void = 0;

  -- Per-bill outstanding then sum overdue ones
  SELECT @total_overdue = ISNULL(SUM(bill_out), 0)
  FROM (
    SELECT
      ph.header_id,
      ISNULL(ph.actual_bill_amt, ph.expected_bill_amt)
        - ISNULL(paid.paid_amt, 0) AS bill_out,
      DATEADD(day, ISNULL(s.credit_days, 0), ph.bill_date) AS due_date
    FROM dbo.purchase_headers ph
    JOIN dbo.suppliers s ON s.supplier_id = ph.supplier_id
    LEFT JOIN (
      SELECT pa.header_id, SUM(pa.allocated_amt) AS paid_amt
      FROM dbo.payment_allocations pa
      JOIN dbo.supplier_payments sp2 ON sp2.payment_id = pa.payment_id
      WHERE sp2.is_void = 0
      GROUP BY pa.header_id
    ) paid ON paid.header_id = ph.header_id
    WHERE ph.pipeline_status <> 'PENDING_BILL_VERIFICATION'
      AND ph.bill_date IS NOT NULL
  ) x
  WHERE x.bill_out > 0
    AND x.due_date < CAST(GETDATE() AS DATE);

  SELECT @active_suppliers = COUNT(*) FROM dbo.suppliers WHERE vendor_status = 'active';

  -- Suppliers with any outstanding per-bill balance
  SELECT @suppliers_out = COUNT(DISTINCT ph.supplier_id)
  FROM dbo.purchase_headers ph
  JOIN dbo.suppliers s ON s.supplier_id = ph.supplier_id
  LEFT JOIN (
    SELECT pa.header_id, SUM(pa.allocated_amt) AS paid_amt
    FROM dbo.payment_allocations pa
    JOIN dbo.supplier_payments sp3 ON sp3.payment_id = pa.payment_id
    WHERE sp3.is_void = 0
    GROUP BY pa.header_id
  ) paid2 ON paid2.header_id = ph.header_id
  WHERE s.vendor_status = 'active'
    AND ph.pipeline_status <> 'PENDING_BILL_VERIFICATION'
    AND ISNULL(ph.actual_bill_amt, ph.expected_bill_amt) - ISNULL(paid2.paid_amt, 0) > 0.005;

  SELECT @payments_30d = COUNT(*)
  FROM dbo.supplier_payments
  WHERE is_void = 0
    AND payment_date >= DATEADD(day, -30, CAST(GETDATE() AS DATE));

  SELECT
    @total_payable                   AS total_payable,
    @total_paid                      AS total_paid,
    @total_payable - @total_paid     AS total_outstanding,
    @total_overdue                   AS total_overdue,
    @active_suppliers                AS active_suppliers,
    @suppliers_out                   AS suppliers_with_outstanding,
    @payments_30d                    AS payments_last_30d;
END;
GO
