-- Finance: challan valuation + supplier purchase invoices
USE [CosmosERP];
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_Challan_ListForValuation
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_Challan_ListForValuation','P') IS NOT NULL DROP PROCEDURE dbo.sp_Challan_ListForValuation;
GO
CREATE PROCEDURE dbo.sp_Challan_ListForValuation
  @supplier_id INT = NULL,
  @unvalued_only BIT = 1
AS BEGIN
  SET NOCOUNT ON;
  SELECT
    h.header_id,
    h.supplier_id,
    s.vendor_name,
    h.challan_number,
    h.challan_date,
    h.purchase_date,
    h.po_reference,
    h.bill_status,
    h.pipeline_status,
    h.challan_payable_total,
    h.finance_transport_amt,
    h.payable_set_at,
    (SELECT SUM(pi.quantity) FROM dbo.purchase_items pi WHERE pi.header_id = h.header_id) AS total_qty,
    ISNULL(inv.invoiced_amt, 0) AS invoiced_amt,
    CASE WHEN h.payable_set_at IS NULL THEN 'UNVALUED' ELSE 'VALUED' END AS valuation_status,
    CASE
      WHEN h.payable_set_at IS NULL THEN 'PENDING_VALUATION'
      WHEN ISNULL(inv.invoiced_amt, 0) <= 0.005 THEN 'NOT_INVOICED'
      WHEN ISNULL(h.challan_payable_total, 0) - ISNULL(inv.invoiced_amt, 0) > 0.005 THEN 'PARTIALLY_INVOICED'
      ELSE 'FULLY_INVOICED'
    END AS invoice_status
  FROM dbo.purchase_headers h
  JOIN dbo.suppliers s ON s.supplier_id = h.supplier_id
  LEFT JOIN (
    SELECT header_id, SUM(allocated_amt) AS invoiced_amt
    FROM dbo.invoice_challan_allocations
    GROUP BY header_id
  ) inv ON inv.header_id = h.header_id
  WHERE h.pipeline_status NOT IN ('DRAFT')
    AND (@supplier_id IS NULL OR h.supplier_id = @supplier_id)
    AND (@unvalued_only = 0 OR h.payable_set_at IS NULL)
  ORDER BY h.challan_date DESC, h.header_id DESC;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_Challan_GetValuationDetail
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_Challan_GetValuationDetail','P') IS NOT NULL DROP PROCEDURE dbo.sp_Challan_GetValuationDetail;
GO
CREATE PROCEDURE dbo.sp_Challan_GetValuationDetail @header_id INT
AS BEGIN
  SET NOCOUNT ON;
  DECLARE @supplier_id INT;
  SELECT @supplier_id = h.supplier_id FROM dbo.purchase_headers h WHERE h.header_id = @header_id;

  SELECT h.*, s.vendor_name AS supplier_name
  FROM dbo.purchase_headers h
  LEFT JOIN dbo.suppliers s ON h.supplier_id = s.supplier_id
  WHERE h.header_id = @header_id;

  SELECT
    pi.item_id, pi.product_master_id, pi.maker_master_id, pi.category, pi.quantity,
    pi.purchase_rate, pi.finance_payable_amt,
    pm.source_brand, pm.source_collection, pm.style_model, pm.source_model_number,
    mk.maker_name,
    vpr.last_rate AS vendor_last_rate,
    vpr.lowest_rate AS vendor_lowest_rate,
    vpr.highest_rate AS vendor_highest_rate,
    vpr.rate_trend AS vendor_rate_trend,
    prs.network_lowest_rate,
    prs.network_highest_rate,
    prs.last_purchased_rate
  FROM dbo.purchase_items pi
  LEFT JOIN dbo.product_master pm ON pi.product_master_id = pm.product_id
  LEFT JOIN dbo.maker_master mk ON pi.maker_master_id = mk.maker_id
  LEFT JOIN dbo.vendor_product_rates vpr
    ON vpr.product_master_id = pi.product_master_id AND vpr.supplier_id = @supplier_id
  LEFT JOIN dbo.product_rate_summary prs ON prs.product_master_id = pi.product_master_id
  WHERE pi.header_id = @header_id
  ORDER BY pi.item_id;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_Challan_SetPayable
-- @lines_json = [{item_id, purchase_rate}] — finance_payable_amt = rate * quantity
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_Challan_SetPayable','P') IS NOT NULL DROP PROCEDURE dbo.sp_Challan_SetPayable;
GO
CREATE PROCEDURE dbo.sp_Challan_SetPayable
  @header_id             INT,
  @finance_transport_amt DECIMAL(12,2) = 0,
  @lines_json            NVARCHAR(MAX),
  @set_by                INT = NULL
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (
      SELECT 1 FROM dbo.purchase_headers
      WHERE header_id = @header_id AND pipeline_status NOT IN ('DRAFT')
    )
    BEGIN RAISERROR('Challan must be submitted before valuation.',16,1); RETURN; END;

    IF EXISTS (SELECT 1 FROM dbo.invoice_challan_allocations WHERE header_id = @header_id)
    BEGIN RAISERROR('Cannot change valuation after invoice allocation.',16,1); RETURN; END;

    IF EXISTS (
      SELECT 1 FROM dbo.purchase_items pi
      JOIN OPENJSON(@lines_json) WITH (item_id INT '$.item_id') j ON j.item_id = pi.item_id
      WHERE pi.header_id = @header_id AND (pi.quantity IS NULL OR pi.quantity <= 0)
    )
    BEGIN RAISERROR('Every line must have quantity > 0 before valuation.',16,1); RETURN; END;

    UPDATE pi SET
      purchase_rate = j.purchase_rate,
      finance_payable_amt = ROUND(j.purchase_rate * pi.quantity, 2)
    FROM dbo.purchase_items pi
    JOIN OPENJSON(@lines_json) WITH (
      item_id INT '$.item_id',
      purchase_rate DECIMAL(12,2) '$.purchase_rate'
    ) j ON j.item_id = pi.item_id
    WHERE pi.header_id = @header_id;

    IF EXISTS (
      SELECT 1 FROM dbo.purchase_items
      WHERE header_id = @header_id
        AND (purchase_rate IS NULL OR purchase_rate < 0 OR finance_payable_amt IS NULL OR finance_payable_amt < 0)
    )
    BEGIN RAISERROR('Every line must have a purchase rate >= 0.',16,1); RETURN; END;

    DECLARE @supplier_id INT;
    SELECT @supplier_id = supplier_id FROM dbo.purchase_headers WHERE header_id = @header_id;

    DECLARE @pmid INT, @rate DECIMAL(12,2);
    DECLARE ri_cur CURSOR LOCAL FAST_FORWARD FOR
      SELECT pi.product_master_id, pi.purchase_rate
      FROM dbo.purchase_items pi
      WHERE pi.header_id = @header_id AND pi.purchase_rate IS NOT NULL;
    OPEN ri_cur;
    FETCH NEXT FROM ri_cur INTO @pmid, @rate;
    WHILE @@FETCH_STATUS = 0
    BEGIN
      IF @pmid IS NOT NULL AND @supplier_id IS NOT NULL
        EXEC dbo.sp_RateIntelligence_UpsertVendorProduct
          @product_master_id = @pmid, @supplier_id = @supplier_id, @new_rate = @rate;
      FETCH NEXT FROM ri_cur INTO @pmid, @rate;
    END;
    CLOSE ri_cur;
    DEALLOCATE ri_cur;

    DECLARE @sum_pmid INT;
    DECLARE sum_cur CURSOR LOCAL FAST_FORWARD FOR
      SELECT DISTINCT product_master_id FROM dbo.purchase_items
      WHERE header_id = @header_id AND product_master_id IS NOT NULL;
    OPEN sum_cur;
    FETCH NEXT FROM sum_cur INTO @sum_pmid;
    WHILE @@FETCH_STATUS = 0
    BEGIN
      EXEC dbo.sp_RateIntelligence_UpsertProductSummary @product_master_id = @sum_pmid;
      FETCH NEXT FROM sum_cur INTO @sum_pmid;
    END;
    CLOSE sum_cur;
    DEALLOCATE sum_cur;

    DECLARE @lines_total DECIMAL(12,2);
    SELECT @lines_total = ISNULL(SUM(finance_payable_amt), 0) FROM dbo.purchase_items WHERE header_id = @header_id;
    DECLARE @payable_total DECIMAL(12,2) = @lines_total + ISNULL(@finance_transport_amt, 0);

    UPDATE dbo.purchase_headers SET
      finance_transport_amt = ISNULL(@finance_transport_amt, 0),
      challan_payable_total = @payable_total,
      payable_set_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()),
      payable_set_by = @set_by,
      bill_status = 'CHALLAN_VALUED',
      updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE header_id = @header_id;

    EXEC dbo.sp_Challan_GetValuationDetail @header_id = @header_id;
  END TRY
  BEGIN CATCH DECLARE @e NVARCHAR(4000)=ERROR_MESSAGE(); RAISERROR(@e,16,1); END CATCH;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_SupplierInvoice_Create — FIFO to valued challans with open payable
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_SupplierInvoice_Create','P') IS NOT NULL DROP PROCEDURE dbo.sp_SupplierInvoice_Create;
GO
CREATE PROCEDURE dbo.sp_SupplierInvoice_Create
  @supplier_id       INT,
  @invoice_number    VARCHAR(100),
  @invoice_date      DATE,
  @taxable_amt       DECIMAL(12,2),
  @cgst_amt          DECIMAL(12,2),
  @sgst_amt          DECIMAL(12,2),
  @igst_amt          DECIMAL(12,2),
  @total_amt         DECIMAL(12,2),
  @file_url          VARCHAR(500) = NULL,
  @discrepancy_note  VARCHAR(500) = NULL,
  @created_by        INT = NULL
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRANSACTION;

    IF NOT EXISTS (SELECT 1 FROM dbo.suppliers WHERE supplier_id = @supplier_id)
      RAISERROR('Supplier not found.',16,1);

    IF NOT EXISTS (
      SELECT 1 FROM dbo.purchase_headers
      WHERE supplier_id = @supplier_id AND payable_set_at IS NOT NULL
    )
      RAISERROR('No valued challans for this supplier. Set payable amounts before posting an invoice.',16,1);

    INSERT INTO dbo.supplier_purchase_invoices (
      supplier_id, invoice_number, invoice_date, taxable_amt, cgst_amt, sgst_amt, igst_amt,
      total_amt, file_url, discrepancy_note, created_by
    ) VALUES (
      @supplier_id, @invoice_number, @invoice_date, @taxable_amt, @cgst_amt, @sgst_amt, @igst_amt,
      @total_amt, @file_url, @discrepancy_note, @created_by
    );
    DECLARE @invoice_id INT = SCOPE_IDENTITY();

    DECLARE @remaining DECIMAL(12,2) = @total_amt;
    DECLARE @hid INT, @open DECIMAL(12,2), @alloc DECIMAL(12,2);

    DECLARE challan_cur CURSOR LOCAL FAST_FORWARD FOR
      SELECT h.header_id,
        h.challan_payable_total - ISNULL(inv.invoiced_amt, 0) AS open_amt
      FROM dbo.purchase_headers h
      LEFT JOIN (
        SELECT header_id, SUM(allocated_amt) AS invoiced_amt
        FROM dbo.invoice_challan_allocations GROUP BY header_id
      ) inv ON inv.header_id = h.header_id
      WHERE h.supplier_id = @supplier_id
        AND h.payable_set_at IS NOT NULL
        AND h.challan_payable_total - ISNULL(inv.invoiced_amt, 0) > 0.005
      ORDER BY h.challan_date ASC, h.header_id ASC;

    OPEN challan_cur;
    FETCH NEXT FROM challan_cur INTO @hid, @open;
    WHILE @@FETCH_STATUS = 0 AND @remaining > 0.005
    BEGIN
      SET @alloc = CASE WHEN @open <= @remaining THEN @open ELSE @remaining END;
      INSERT INTO dbo.invoice_challan_allocations (invoice_id, header_id, allocated_amt)
      VALUES (@invoice_id, @hid, @alloc);
      SET @remaining = @remaining - @alloc;

      DECLARE @new_invoiced DECIMAL(12,2);
      SELECT @new_invoiced = SUM(allocated_amt) FROM dbo.invoice_challan_allocations WHERE header_id = @hid;
      DECLARE @payable DECIMAL(12,2);
      SELECT @payable = challan_payable_total FROM dbo.purchase_headers WHERE header_id = @hid;
      UPDATE dbo.purchase_headers SET
        bill_status = CASE WHEN @new_invoiced >= @payable - 0.005 THEN 'FULLY_INVOICED' ELSE 'PARTIALLY_INVOICED' END,
        updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      WHERE header_id = @hid;

      FETCH NEXT FROM challan_cur INTO @hid, @open;
    END;
    CLOSE challan_cur;
    DEALLOCATE challan_cur;

    DECLARE @allocated_total DECIMAL(12,2);
    SELECT @allocated_total = ISNULL(SUM(allocated_amt), 0)
    FROM dbo.invoice_challan_allocations WHERE invoice_id = @invoice_id;

    IF ABS(@total_amt - @allocated_total) > 50 AND NULLIF(LTRIM(RTRIM(@discrepancy_note)),'') IS NULL
    BEGIN
      ROLLBACK TRANSACTION;
      RAISERROR('Invoice total differs from FIFO allocation by more than Rs 50. Add a discrepancy note.',16,1);
      RETURN;
    END;

    COMMIT TRANSACTION;

    SELECT * FROM dbo.supplier_purchase_invoices WHERE invoice_id = @invoice_id;
    SELECT ica.*, h.challan_number
    FROM dbo.invoice_challan_allocations ica
    JOIN dbo.purchase_headers h ON h.header_id = ica.header_id
    WHERE ica.invoice_id = @invoice_id;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
  END CATCH;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_SupplierInvoice_List — posted purchase invoices with payment status
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_SupplierInvoice_List', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_SupplierInvoice_List;
GO
CREATE PROCEDURE dbo.sp_SupplierInvoice_List
  @supplier_id INT = NULL
AS BEGIN
  SET NOCOUNT ON;

  SELECT
    spi.invoice_id,
    spi.supplier_id,
    s.vendor_name,
    spi.invoice_number,
    spi.invoice_date,
    spi.taxable_amt,
    spi.cgst_amt,
    spi.sgst_amt,
    spi.igst_amt,
    spi.total_amt,
    spi.status,
    spi.discrepancy_note,
    spi.created_at,
    ISNULL(paid.paid_amt, 0) AS paid_amount,
    spi.total_amt - ISNULL(paid.paid_amt, 0) AS outstanding,
    CASE
      WHEN spi.total_amt - ISNULL(paid.paid_amt, 0) <= 0.005 THEN 'PAID'
      WHEN ISNULL(paid.paid_amt, 0) > 0.005 THEN 'PARTIAL'
      ELSE 'UNPAID'
    END AS payment_status
  FROM dbo.supplier_purchase_invoices spi
  JOIN dbo.suppliers s ON s.supplier_id = spi.supplier_id
  LEFT JOIN (
    SELECT pia.invoice_id, SUM(pia.allocated_amt) AS paid_amt
    FROM dbo.payment_invoice_allocations pia
    JOIN dbo.supplier_payments sp ON sp.payment_id = pia.payment_id
    WHERE sp.is_void = 0
    GROUP BY pia.invoice_id
  ) paid ON paid.invoice_id = spi.invoice_id
  WHERE spi.status = 'POSTED'
    AND (@supplier_id IS NULL OR spi.supplier_id = @supplier_id)
  ORDER BY spi.invoice_date DESC, spi.invoice_id DESC;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_SupplierInvoice_List — posted purchase invoices with payment status
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_SupplierInvoice_List', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_SupplierInvoice_List;
GO
CREATE PROCEDURE dbo.sp_SupplierInvoice_List
  @supplier_id INT = NULL
AS BEGIN
  SET NOCOUNT ON;

  SELECT
    spi.invoice_id,
    spi.supplier_id,
    s.vendor_name,
    spi.invoice_number,
    spi.invoice_date,
    spi.taxable_amt,
    spi.cgst_amt,
    spi.sgst_amt,
    spi.igst_amt,
    spi.total_amt,
    spi.status,
    spi.discrepancy_note,
    spi.created_at,
    ISNULL(paid.paid_amt, 0) AS paid_amount,
    spi.total_amt - ISNULL(paid.paid_amt, 0) AS outstanding,
    CASE
      WHEN spi.total_amt - ISNULL(paid.paid_amt, 0) <= 0.005 THEN 'PAID'
      WHEN ISNULL(paid.paid_amt, 0) > 0.005 THEN 'PARTIAL'
      ELSE 'UNPAID'
    END AS payment_status
  FROM dbo.supplier_purchase_invoices spi
  JOIN dbo.suppliers s ON s.supplier_id = spi.supplier_id
  LEFT JOIN (
    SELECT pia.invoice_id, SUM(pia.allocated_amt) AS paid_amt
    FROM dbo.payment_invoice_allocations pia
    JOIN dbo.supplier_payments sp ON sp.payment_id = pia.payment_id
    WHERE sp.is_void = 0
    GROUP BY pia.invoice_id
  ) paid ON paid.invoice_id = spi.invoice_id
  WHERE spi.status = 'POSTED'
    AND (@supplier_id IS NULL OR spi.supplier_id = @supplier_id)
  ORDER BY spi.invoice_date DESC, spi.invoice_id DESC;
END;
GO
