-- Finance purchase report — challan payable model
USE [CosmosERP];
GO

IF OBJECT_ID('dbo.sp_Finance_PurchaseReport','P') IS NOT NULL DROP PROCEDURE dbo.sp_Finance_PurchaseReport;
GO
CREATE PROCEDURE dbo.sp_Finance_PurchaseReport
  @from_date DATE = NULL,
  @to_date DATE = NULL,
  @supplier_id INT = NULL,
  @pipeline_status VARCHAR(50) = NULL,
  @category VARCHAR(50) = NULL
AS BEGIN
  SET NOCOUNT ON;
  CREATE TABLE #rpt (
    header_id INT, supplier_id INT, supplier_name VARCHAR(200),
    purchase_date DATETIME, challan_date DATETIME, challan_number VARCHAR(100),
    pipeline_status VARCHAR(50), bill_status VARCHAR(50),
    challan_payable_total DECIMAL(12,2), finance_transport_amt DECIMAL(12,2),
    paid_amount DECIMAL(12,2), outstanding DECIMAL(12,2),
    invoiced_amt DECIMAL(12,2), item_count INT, total_qty INT
  );

  INSERT INTO #rpt
  SELECT h.header_id, h.supplier_id, s.vendor_name, h.purchase_date, h.challan_date, h.challan_number,
    h.pipeline_status, h.bill_status, h.challan_payable_total, h.finance_transport_amt,
    ISNULL(paid.paid_amt, 0),
    ISNULL(h.challan_payable_total, 0) - ISNULL(paid.paid_amt, 0),
    ISNULL(inv.invoiced_amt, 0),
    ISNULL(pi_stats.item_count, 0), ISNULL(pi_stats.total_qty, 0)
  FROM dbo.purchase_headers h
  LEFT JOIN dbo.suppliers s ON s.supplier_id = h.supplier_id
  LEFT JOIN (
    SELECT header_id, COUNT(*) AS item_count, SUM(quantity) AS total_qty
    FROM dbo.purchase_items GROUP BY header_id
  ) pi_stats ON pi_stats.header_id = h.header_id
  LEFT JOIN (
    SELECT pa.header_id, SUM(pa.allocated_amt) AS paid_amt
    FROM dbo.payment_allocations pa
    JOIN dbo.supplier_payments sp ON sp.payment_id = pa.payment_id
    WHERE sp.is_void = 0 GROUP BY pa.header_id
  ) paid ON paid.header_id = h.header_id
  LEFT JOIN (
    SELECT header_id, SUM(allocated_amt) AS invoiced_amt
    FROM dbo.invoice_challan_allocations GROUP BY header_id
  ) inv ON inv.header_id = h.header_id
  WHERE (@from_date IS NULL OR CAST(h.purchase_date AS DATE) >= @from_date)
    AND (@to_date IS NULL OR CAST(h.purchase_date AS DATE) <= @to_date)
    AND (@supplier_id IS NULL OR h.supplier_id = @supplier_id)
    AND (@pipeline_status IS NULL OR h.pipeline_status = @pipeline_status)
    AND (@pipeline_status IS NOT NULL OR h.pipeline_status <> 'DRAFT')
    AND (@category IS NULL OR EXISTS (
      SELECT 1 FROM dbo.purchase_items pi WHERE pi.header_id = h.header_id AND pi.category = @category));

  SELECT COUNT(*) AS total_bills,
    ISNULL(SUM(challan_payable_total),0) AS total_amount,
    ISNULL(SUM(paid_amount),0) AS total_paid,
    ISNULL(SUM(outstanding),0) AS total_outstanding,
    ISNULL(SUM(finance_transport_amt),0) AS total_transport,
    ISNULL(SUM(total_qty),0) AS total_qty,
    COUNT(DISTINCT supplier_id) AS supplier_count
  FROM #rpt;

  SELECT supplier_id, supplier_name, COUNT(*) AS bill_count,
    ISNULL(SUM(challan_payable_total),0) AS total_amount,
    ISNULL(SUM(paid_amount),0) AS total_paid,
    ISNULL(SUM(outstanding),0) AS total_outstanding,
    ISNULL(SUM(total_qty),0) AS total_qty
  FROM #rpt GROUP BY supplier_id, supplier_name ORDER BY total_amount DESC;

  SELECT * FROM #rpt ORDER BY purchase_date DESC, header_id DESC;
  DROP TABLE #rpt;
END;
GO
