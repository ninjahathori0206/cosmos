-- Finance AP patches for challan payable model (run after migration 35)
USE [CosmosERP];
GO

IF OBJECT_ID('dbo.sp_Finance_SupplierSummary','P') IS NOT NULL DROP PROCEDURE dbo.sp_Finance_SupplierSummary;
GO
CREATE PROCEDURE dbo.sp_Finance_SupplierSummary
  @supplier_id INT = NULL
AS BEGIN
  SET NOCOUNT ON;
  WITH bill_totals AS (
    SELECT ph.supplier_id, ph.header_id, ph.challan_date,
      ph.challan_payable_total AS bill_amount
    FROM dbo.purchase_headers ph
    WHERE ph.pipeline_status NOT IN ('DRAFT') AND ph.payable_set_at IS NOT NULL
  ),
  bill_paid AS (
    SELECT pa.header_id, SUM(pa.allocated_amt) AS paid_amt
    FROM dbo.payment_allocations pa
    JOIN dbo.supplier_payments sp ON sp.payment_id = pa.payment_id
    WHERE sp.is_void = 0
    GROUP BY pa.header_id
  ),
  bill_out AS (
    SELECT bt.supplier_id, bt.header_id, bt.challan_date, bt.bill_amount,
      ISNULL(bp.paid_amt, 0) AS paid_amt,
      bt.bill_amount - ISNULL(bp.paid_amt, 0) AS outstanding
    FROM bill_totals bt
    LEFT JOIN bill_paid bp ON bp.header_id = bt.header_id
  ),
  supplier_payments_totals AS (
    SELECT supplier_id, SUM(amount) AS total_paid
    FROM dbo.supplier_payments WHERE is_void = 0
    GROUP BY supplier_id
  )
  SELECT s.supplier_id, s.vendor_name, s.vendor_code, s.city, s.payment_terms, s.credit_days,
    s.vendor_status, s.opening_balance,
    ISNULL(SUM(bo.bill_amount), 0) AS total_purchase,
    ISNULL(MAX(spt.total_paid), 0) AS total_paid,
    s.opening_balance + ISNULL(SUM(bo.bill_amount), 0) - ISNULL(MAX(spt.total_paid), 0) AS outstanding,
    COUNT(DISTINCT bo.header_id) AS total_bills,
    SUM(CASE
      WHEN bo.outstanding > 0.005 AND bo.challan_date IS NOT NULL
        AND DATEADD(day, ISNULL(s.credit_days, 0), CAST(bo.challan_date AS DATE))
          < CAST(DATEADD(MINUTE, 330, SYSUTCDATETIME()) AS DATE)
      THEN 1 ELSE 0 END) AS overdue_bills
  FROM dbo.suppliers s
  LEFT JOIN bill_out bo ON bo.supplier_id = s.supplier_id
  LEFT JOIN supplier_payments_totals spt ON spt.supplier_id = s.supplier_id
  WHERE s.vendor_status = 'active'
    AND (@supplier_id IS NULL OR s.supplier_id = @supplier_id)
  GROUP BY s.supplier_id, s.vendor_name, s.vendor_code, s.city,
    s.payment_terms, s.credit_days, s.vendor_status, s.opening_balance
  ORDER BY (s.opening_balance + ISNULL(SUM(bo.bill_amount), 0) - ISNULL(MAX(spt.total_paid), 0)) DESC;
END;
GO

IF OBJECT_ID('dbo.sp_Finance_SupplierStatement','P') IS NOT NULL DROP PROCEDURE dbo.sp_Finance_SupplierStatement;
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
    (SELECT pa.header_id, pa.allocated_amt FROM dbo.payment_allocations pa
     WHERE pa.payment_id = sp.payment_id FOR JSON PATH) AS allocations_json
  FROM dbo.supplier_payments sp
  WHERE sp.supplier_id = @supplier_id
  ORDER BY sp.payment_date DESC, sp.payment_id DESC;
END;
GO

IF OBJECT_ID('dbo.sp_Finance_DashboardStats','P') IS NOT NULL DROP PROCEDURE dbo.sp_Finance_DashboardStats;
GO
CREATE PROCEDURE dbo.sp_Finance_DashboardStats
AS BEGIN
  SET NOCOUNT ON;
  DECLARE @total_payable DECIMAL(14,2), @total_paid DECIMAL(14,2), @total_overdue DECIMAL(14,2);
  DECLARE @active_suppliers INT, @suppliers_out INT, @payments_30d INT;

  SELECT @total_payable = ISNULL((SELECT SUM(opening_balance) FROM dbo.suppliers WHERE vendor_status='active'), 0)
    + ISNULL(SUM(CASE WHEN payable_set_at IS NOT NULL THEN challan_payable_total ELSE 0 END), 0)
  FROM dbo.purchase_headers;

  SELECT @total_paid = ISNULL(SUM(amount), 0) FROM dbo.supplier_payments WHERE is_void = 0;

  SELECT @total_overdue = ISNULL(SUM(bill_out), 0)
  FROM (
    SELECT ph.challan_payable_total - ISNULL(paid.paid_amt, 0) AS bill_out,
      DATEADD(day, ISNULL(s.credit_days, 0), CAST(ph.challan_date AS DATE)) AS due_date
    FROM dbo.purchase_headers ph
    JOIN dbo.suppliers s ON s.supplier_id = ph.supplier_id
    LEFT JOIN (
      SELECT pa.header_id, SUM(pa.allocated_amt) AS paid_amt
      FROM dbo.payment_allocations pa
      JOIN dbo.supplier_payments sp2 ON sp2.payment_id = pa.payment_id
      WHERE sp2.is_void = 0 GROUP BY pa.header_id
    ) paid ON paid.header_id = ph.header_id
    WHERE ph.payable_set_at IS NOT NULL AND ph.challan_date IS NOT NULL
  ) x
  WHERE x.bill_out > 0 AND x.due_date < CAST(DATEADD(MINUTE, 330, SYSUTCDATETIME()) AS DATE);

  SELECT @active_suppliers = COUNT(*) FROM dbo.suppliers WHERE vendor_status = 'active';

  SELECT @suppliers_out = COUNT(DISTINCT ph.supplier_id)
  FROM dbo.purchase_headers ph
  JOIN dbo.suppliers s ON s.supplier_id = ph.supplier_id
  LEFT JOIN (
    SELECT pa.header_id, SUM(pa.allocated_amt) AS paid_amt
    FROM dbo.payment_allocations pa
    JOIN dbo.supplier_payments sp3 ON sp3.payment_id = pa.payment_id
    WHERE sp3.is_void = 0 GROUP BY pa.header_id
  ) paid2 ON paid2.header_id = ph.header_id
  WHERE s.vendor_status = 'active' AND ph.payable_set_at IS NOT NULL
    AND ISNULL(ph.challan_payable_total, 0) - ISNULL(paid2.paid_amt, 0) > 0.005;

  SELECT @payments_30d = COUNT(*) FROM dbo.supplier_payments
  WHERE is_void = 0 AND payment_date >= DATEADD(day, -30, CAST(DATEADD(MINUTE, 330, SYSUTCDATETIME()) AS DATE));

  SELECT @total_payable AS total_payable, @total_paid AS total_paid,
    @total_payable - @total_paid AS total_outstanding, @total_overdue AS total_overdue,
    @active_suppliers AS active_suppliers, @suppliers_out AS suppliers_with_outstanding,
    @payments_30d AS payments_last_30d;
END;
GO
