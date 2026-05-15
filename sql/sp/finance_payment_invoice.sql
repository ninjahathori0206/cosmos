-- Finance: invoice-only payments + outstanding invoices list
USE [CosmosERP];
GO

IF OBJECT_ID('dbo.sp_Finance_OutstandingInvoices', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Finance_OutstandingInvoices;
GO
CREATE PROCEDURE dbo.sp_Finance_OutstandingInvoices
  @supplier_id INT
AS BEGIN
  SET NOCOUNT ON;

  SELECT
    spi.invoice_id,
    spi.invoice_number,
    spi.invoice_date,
    spi.total_amt,
    ISNULL(paid.paid_amt, 0) AS paid_amount,
    spi.total_amt - ISNULL(paid.paid_amt, 0) AS outstanding,
    DATEADD(day, ISNULL(s.credit_days, 0), spi.invoice_date) AS due_date,
    DATEDIFF(day,
      DATEADD(day, ISNULL(s.credit_days, 0), spi.invoice_date),
      CAST(DATEADD(MINUTE, 330, SYSUTCDATETIME()) AS DATE)) AS days_overdue
  FROM dbo.supplier_purchase_invoices spi
  JOIN dbo.suppliers s ON s.supplier_id = spi.supplier_id
  LEFT JOIN (
    SELECT pia.invoice_id, SUM(pia.allocated_amt) AS paid_amt
    FROM dbo.payment_invoice_allocations pia
    JOIN dbo.supplier_payments sp ON sp.payment_id = pia.payment_id
    WHERE sp.is_void = 0
    GROUP BY pia.invoice_id
  ) paid ON paid.invoice_id = spi.invoice_id
  WHERE spi.supplier_id = @supplier_id
    AND spi.status = 'POSTED'
    AND spi.total_amt - ISNULL(paid.paid_amt, 0) > 0.005
  ORDER BY spi.invoice_date ASC, spi.invoice_id ASC;
END;
GO

IF OBJECT_ID('dbo.sp_Finance_Payment_Create', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Finance_Payment_Create;
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
      RAISERROR('Supplier not found.', 16, 1);

    IF @amount <= 0
      RAISERROR('Payment amount must be positive.', 16, 1);

    IF @allocations_json IS NULL OR LEN(LTRIM(RTRIM(@allocations_json))) < 3
      RAISERROR('Payment must be allocated to at least one supplier invoice.', 16, 1);

    DECLARE @alloc_total DECIMAL(12,2);
    SELECT @alloc_total = ISNULL(SUM(j.allocated_amt), 0)
    FROM OPENJSON(@allocations_json) WITH (
      invoice_id     INT            '$.invoice_id',
      allocated_amt  DECIMAL(12,2)  '$.allocated_amt'
    ) j
    WHERE j.allocated_amt > 0;

    IF @alloc_total <= 0
      RAISERROR('Payment must be allocated to at least one supplier invoice.', 16, 1);

    IF ABS(@alloc_total - @amount) > 0.02
      RAISERROR('Allocated total must equal the payment amount.', 16, 1);

    IF EXISTS (
      SELECT 1
      FROM OPENJSON(@allocations_json) WITH (
        invoice_id     INT            '$.invoice_id',
        allocated_amt  DECIMAL(12,2)  '$.allocated_amt'
      ) j
      JOIN dbo.supplier_purchase_invoices spi ON spi.invoice_id = j.invoice_id
      LEFT JOIN (
        SELECT pia.invoice_id, SUM(pia.allocated_amt) AS paid_amt
        FROM dbo.payment_invoice_allocations pia
        JOIN dbo.supplier_payments sp ON sp.payment_id = pia.payment_id
        WHERE sp.is_void = 0
        GROUP BY pia.invoice_id
      ) paid ON paid.invoice_id = spi.invoice_id
      WHERE j.allocated_amt > 0
        AND (spi.supplier_id <> @supplier_id OR spi.status <> 'POSTED'
          OR j.allocated_amt > spi.total_amt - ISNULL(paid.paid_amt, 0) + 0.02)
    )
      RAISERROR('One or more invoice allocations are invalid or exceed outstanding.', 16, 1);

    INSERT INTO dbo.supplier_payments
      (supplier_id, payment_date, amount, payment_mode, reference_no, bank_account, notes, created_by)
    VALUES
      (@supplier_id, @payment_date, @amount, @payment_mode, @reference_no, @bank_account, @notes, @created_by);

    DECLARE @payment_id INT = SCOPE_IDENTITY();

    INSERT INTO dbo.payment_invoice_allocations (payment_id, invoice_id, allocated_amt)
    SELECT @payment_id, j.invoice_id, j.allocated_amt
    FROM OPENJSON(@allocations_json) WITH (
      invoice_id     INT            '$.invoice_id',
      allocated_amt  DECIMAL(12,2)  '$.allocated_amt'
    ) j
    WHERE j.allocated_amt > 0;

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

-- Supplier summary: outstanding from posted invoices (not unallocated payments)
IF OBJECT_ID('dbo.sp_Finance_SupplierSummary', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Finance_SupplierSummary;
GO
CREATE PROCEDURE dbo.sp_Finance_SupplierSummary
  @supplier_id INT = NULL
AS BEGIN
  SET NOCOUNT ON;
  WITH invoice_out AS (
    SELECT spi.supplier_id, spi.invoice_id, spi.invoice_date, spi.total_amt,
      spi.total_amt - ISNULL(paid.paid_amt, 0) AS outstanding
    FROM dbo.supplier_purchase_invoices spi
    LEFT JOIN (
      SELECT pia.invoice_id, SUM(pia.allocated_amt) AS paid_amt
      FROM dbo.payment_invoice_allocations pia
      JOIN dbo.supplier_payments sp ON sp.payment_id = pia.payment_id
      WHERE sp.is_void = 0
      GROUP BY pia.invoice_id
    ) paid ON paid.invoice_id = spi.invoice_id
    WHERE spi.status = 'POSTED'
  ),
  supplier_payments_totals AS (
    SELECT supplier_id, SUM(amount) AS total_paid
    FROM dbo.supplier_payments
    WHERE is_void = 0
    GROUP BY supplier_id
  )
  SELECT s.supplier_id, s.vendor_name, s.vendor_code, s.city, s.payment_terms, s.credit_days,
    s.vendor_status, s.opening_balance,
    ISNULL(SUM(io.total_amt), 0) AS total_purchase,
    ISNULL(MAX(spt.total_paid), 0) AS total_paid,
    s.opening_balance + ISNULL(SUM(io.outstanding), 0) AS outstanding,
    COUNT(DISTINCT CASE WHEN io.outstanding > 0.005 THEN io.invoice_id END) AS total_bills,
    SUM(CASE
      WHEN io.outstanding > 0.005 AND io.invoice_date IS NOT NULL
        AND DATEADD(day, ISNULL(s.credit_days, 0), io.invoice_date)
          < CAST(DATEADD(MINUTE, 330, SYSUTCDATETIME()) AS DATE)
      THEN 1 ELSE 0 END) AS overdue_bills
  FROM dbo.suppliers s
  LEFT JOIN invoice_out io ON io.supplier_id = s.supplier_id
  LEFT JOIN supplier_payments_totals spt ON spt.supplier_id = s.supplier_id
  WHERE s.vendor_status = 'active'
    AND (@supplier_id IS NULL OR s.supplier_id = @supplier_id)
  GROUP BY s.supplier_id, s.vendor_name, s.vendor_code, s.city,
    s.payment_terms, s.credit_days, s.vendor_status, s.opening_balance
  ORDER BY (s.opening_balance + ISNULL(SUM(io.outstanding), 0)) DESC;
END;
GO

-- Statement: payment history shows invoice allocations
IF OBJECT_ID('dbo.sp_Finance_SupplierStatement', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Finance_SupplierStatement;
GO
CREATE PROCEDURE dbo.sp_Finance_SupplierStatement @supplier_id INT
AS BEGIN
  SET NOCOUNT ON;
  SELECT s.supplier_id, s.vendor_name, s.vendor_code, s.payment_terms, s.credit_days,
    s.city, s.contact_person, s.contact_phone, s.opening_balance,
    s.bank_name, s.bank_account_no, s.bank_ifsc, s.bank_account_holder
  FROM dbo.suppliers s WHERE s.supplier_id = @supplier_id;

  SELECT ph.header_id, ph.challan_number, ph.challan_date, ph.purchase_date, ph.po_reference,
    ph.pipeline_status, ph.bill_status, ph.challan_payable_total AS bill_amount,
    ph.payable_set_at,
    ISNULL(paid.paid_amt, 0) AS paid_amount,
    ISNULL(ph.challan_payable_total, 0) - ISNULL(paid.paid_amt, 0) AS outstanding,
    ISNULL(inv.invoiced_amt, 0) AS invoiced_amt,
    DATEADD(day, ISNULL((SELECT credit_days FROM dbo.suppliers WHERE supplier_id = @supplier_id), 0),
      CAST(ph.challan_date AS DATE)) AS due_date
  FROM dbo.purchase_headers ph
  LEFT JOIN (
    SELECT pa.header_id, SUM(pa.allocated_amt) AS paid_amt
    FROM dbo.payment_allocations pa
    JOIN dbo.supplier_payments sp2 ON sp2.payment_id = pa.payment_id
    WHERE sp2.is_void = 0 GROUP BY pa.header_id
  ) paid ON paid.header_id = ph.header_id
  LEFT JOIN (
    SELECT header_id, SUM(allocated_amt) AS invoiced_amt
    FROM dbo.invoice_challan_allocations GROUP BY header_id
  ) inv ON inv.header_id = ph.header_id
  WHERE ph.supplier_id = @supplier_id AND ph.pipeline_status NOT IN ('DRAFT')
  ORDER BY ph.challan_date DESC, ph.header_id DESC;

  SELECT sp.payment_id, sp.payment_date, sp.amount, sp.payment_mode, sp.reference_no,
    sp.bank_account, sp.notes, sp.is_void, sp.void_reason, sp.created_at,
    (
      SELECT pia.invoice_id, pia.allocated_amt, spi.invoice_number
      FROM dbo.payment_invoice_allocations pia
      JOIN dbo.supplier_purchase_invoices spi ON spi.invoice_id = pia.invoice_id
      WHERE pia.payment_id = sp.payment_id
      FOR JSON PATH
    ) AS allocations_json
  FROM dbo.supplier_payments sp
  WHERE sp.supplier_id = @supplier_id
  ORDER BY sp.payment_date DESC, sp.payment_id DESC;
END;
GO
