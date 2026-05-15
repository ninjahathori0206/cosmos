USE [CosmosERP];
GO

-- Migration 31: purchase DRAFT pipeline + finance DRAFT exclusions
-- Apply after pull; keeps parity with sql/sp/pipeline_v2.sql, finance.sql, finance_reports.sql

IF OBJECT_ID('dbo.sp_PurchaseHeader_Create','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_Create;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_Create
  @supplier_id    INT,
  @source_type    VARCHAR(50)   = NULL,
  @bill_ref       VARCHAR(100)  = NULL,
  @purchase_date  DATETIME,
  @transport_cost DECIMAL(10,2) = 0,
  @po_reference   VARCHAR(100)  = NULL,
  @notes          VARCHAR(500)  = NULL,
  @created_by     INT           = NULL,
  @items_json     NVARCHAR(MAX),          -- JSON array of items
  @save_as_draft BIT           = 0
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.suppliers WHERE supplier_id = @supplier_id)
    BEGIN RAISERROR('Supplier not found.',16,1); RETURN; END;

    -- Parse items JSON and compute totals
    DECLARE @items TABLE (
      idx              INT,
      product_master_id INT,
      maker_master_id  INT,
      category         VARCHAR(50) NULL,
      purchase_rate    DECIMAL(10,2),
      quantity         INT,
      gst_pct          DECIMAL(5,2),
      base_value       DECIMAL(10,2),
      gst_amt          DECIMAL(10,2),
      item_total       DECIMAL(10,2)
    );

    INSERT INTO @items (idx, product_master_id, maker_master_id, category, purchase_rate, quantity, gst_pct, base_value, gst_amt, item_total)
    SELECT
      ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1,
      CAST(j.[product_master_id] AS INT),
      TRY_CAST(j.[maker_master_id] AS INT),
      NULLIF(LTRIM(RTRIM(j.[category])), ''),
      CAST(j.[purchase_rate] AS DECIMAL(10,2)),
      CAST(j.[quantity] AS INT),
      CAST(j.[gst_pct] AS DECIMAL(5,2)),
      CAST(j.[purchase_rate] AS DECIMAL(10,2)) * CAST(j.[quantity] AS INT),
      CAST(j.[purchase_rate] AS DECIMAL(10,2)) * CAST(j.[quantity] AS INT) * CAST(j.[gst_pct] AS DECIMAL(5,2)),
      CAST(j.[purchase_rate] AS DECIMAL(10,2)) * CAST(j.[quantity] AS INT) * (1 + CAST(j.[gst_pct] AS DECIMAL(5,2)))
    FROM OPENJSON(@items_json) WITH (
      product_master_id INT         '$.product_master_id',
      maker_master_id   INT         '$.maker_master_id',
      category          VARCHAR(50) '$.category',
      purchase_rate     FLOAT       '$.purchase_rate',
      quantity          INT         '$.quantity',
      gst_pct           FLOAT       '$.gst_pct'
    ) j;

    DECLARE @items_total DECIMAL(10,2) = (SELECT SUM(item_total) FROM @items);
    DECLARE @expected    DECIMAL(10,2) = @items_total + ISNULL(@transport_cost, 0);

    DECLARE @bill_st VARCHAR(50) = CASE WHEN @save_as_draft = 1 THEN 'DRAFT' ELSE 'PENDING_BILL_VERIFICATION' END;
    DECLARE @pipe_st VARCHAR(50) = CASE WHEN @save_as_draft = 1 THEN 'DRAFT' ELSE 'PENDING_BILL_VERIFICATION' END;

    -- Insert header
    INSERT INTO dbo.purchase_headers (
      supplier_id, source_type, bill_ref, purchase_date, transport_cost,
      po_reference, notes, expected_bill_amt,
      bill_status, pipeline_status, created_by, created_at, updated_at
    ) VALUES (
      @supplier_id, @source_type, @bill_ref, @purchase_date, ISNULL(@transport_cost,0),
      @po_reference, @notes, @expected,
      @bill_st, @pipe_st, @created_by, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME())
    );
    DECLARE @header_id INT = SCOPE_IDENTITY();

    -- Insert items and colours
    DECLARE @idx INT = 0;
    DECLARE @max_idx INT = (SELECT MAX(idx) FROM @items);

    WHILE @idx <= @max_idx
    BEGIN
      DECLARE @pmid INT, @mmid INT, @cat VARCHAR(50), @rate DECIMAL(10,2), @qty INT, @gst DECIMAL(5,2),
              @bval DECIMAL(10,2), @gamt DECIMAL(10,2), @itot DECIMAL(10,2);
      SELECT @pmid=product_master_id, @mmid=maker_master_id, @cat=category, @rate=purchase_rate, @qty=quantity,
             @gst=gst_pct, @bval=base_value, @gamt=gst_amt, @itot=item_total
      FROM @items WHERE idx=@idx;

      INSERT INTO dbo.purchase_items (header_id,product_master_id,maker_master_id,category,purchase_rate,quantity,gst_pct,base_value,gst_amt,item_total)
      VALUES (@header_id,@pmid,@mmid,@cat,@rate,@qty,@gst,@bval,@gamt,@itot);
      DECLARE @item_id INT = SCOPE_IDENTITY();

      -- Insert colours for this item
      DECLARE @colours_json NVARCHAR(MAX);
      SELECT @colours_json = JSON_QUERY(j.[colours])
      FROM OPENJSON(@items_json) WITH (colours NVARCHAR(MAX) '$.colours' AS JSON) j
      WHERE JSON_VALUE(@items_json,'$['+CAST(@idx AS VARCHAR)+'].product_master_id') =
            CAST(@pmid AS VARCHAR);

      -- safer: pick colours by ordinal position
      SELECT @colours_json = JSON_QUERY(value,'$.colours')
      FROM OPENJSON(@items_json) AS ij
      WHERE CAST(JSON_VALUE(ij.value,'$.product_master_id') AS INT) = @pmid
        AND (SELECT COUNT(*) FROM @items it2 WHERE it2.idx < @idx AND it2.product_master_id = @pmid) = 0;

      IF @colours_json IS NOT NULL
      BEGIN
        INSERT INTO dbo.purchase_item_colours (item_id, colour_name, colour_code, quantity)
        SELECT @item_id, colour_name, colour_code, qty
        FROM OPENJSON(@colours_json) WITH (
          colour_name VARCHAR(100) '$.colour_name',
          colour_code VARCHAR(20)  '$.colour_code',
          qty         INT          '$.quantity'
        );
      END;

      -- Update product_master maker_master_id if provided
      IF @mmid IS NOT NULL
        UPDATE dbo.product_master SET maker_master_id = @mmid, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
        WHERE product_id = @pmid AND maker_master_id IS NULL;

      SET @idx = @idx + 1;
    END;

    -- Return header + items summary
    SELECT h.*, s.vendor_name AS supplier_name
    FROM dbo.purchase_headers h
    LEFT JOIN dbo.suppliers s ON h.supplier_id = s.supplier_id
    WHERE h.header_id = @header_id;

    SELECT pi.*, pm.ew_collection, pm.style_model, pm.source_type, pm.branding_required,
           pm.source_brand, pm.source_collection, pm.home_brand_id,
           hb.brand_name, mk.maker_name
    FROM dbo.purchase_items pi
    LEFT JOIN dbo.product_master pm ON pi.product_master_id = pm.product_id
    LEFT JOIN dbo.home_brands hb    ON pm.home_brand_id = hb.brand_id
    LEFT JOIN dbo.maker_master mk   ON pi.maker_master_id = mk.maker_id
    WHERE pi.header_id = @header_id;

    SELECT pic.*, pi.header_id
    FROM dbo.purchase_item_colours pic
    JOIN dbo.purchase_items pi ON pic.item_id = pi.item_id
    WHERE pi.header_id = @header_id;

  END TRY
  BEGIN CATCH
    DECLARE @err NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@err,16,1);
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_PurchaseHeader_Update','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_Update;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_Update
  @header_id      INT,
  @supplier_id    INT           = NULL,
  @source_type    VARCHAR(50)   = NULL,
  @bill_ref       VARCHAR(100)  = NULL,
  @purchase_date  DATETIME      = NULL,
  @transport_cost DECIMAL(10,2) = NULL,
  @po_reference   VARCHAR(100)  = NULL,
  @notes          VARCHAR(500)  = NULL
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.purchase_headers WHERE header_id=@header_id AND pipeline_status IN ('PENDING_BILL_VERIFICATION','DRAFT'))
    BEGIN RAISERROR('Header can only be edited while pending bill verification or in draft.',16,1); RETURN; END;
    UPDATE dbo.purchase_headers SET
      supplier_id    = ISNULL(@supplier_id,    supplier_id),
      source_type    = ISNULL(@source_type,    source_type),
      bill_ref       = ISNULL(@bill_ref,        bill_ref),
      purchase_date  = ISNULL(@purchase_date,   purchase_date),
      transport_cost = ISNULL(@transport_cost,  transport_cost),
      po_reference   = ISNULL(@po_reference,    po_reference),
      notes          = ISNULL(@notes,           notes),
      updated_at     = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE header_id = @header_id;
    SELECT h.*, s.vendor_name AS supplier_name
    FROM dbo.purchase_headers h
    LEFT JOIN dbo.suppliers s ON h.supplier_id = s.supplier_id
    WHERE h.header_id = @header_id;
  END TRY
  BEGIN CATCH DECLARE @e NVARCHAR(4000)=ERROR_MESSAGE(); RAISERROR(@e,16,1); END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_PurchaseHeader_SubmitDraft','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_SubmitDraft;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_SubmitDraft
  @header_id INT
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.purchase_headers WHERE header_id=@header_id AND pipeline_status='DRAFT')
    BEGIN RAISERROR('Only draft purchases can be submitted to bill verification.',16,1); RETURN; END;
    UPDATE dbo.purchase_headers SET
      bill_status     = 'PENDING_BILL_VERIFICATION',
      pipeline_status = 'PENDING_BILL_VERIFICATION',
      updated_at      = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE header_id = @header_id;
    SELECT header_id, pipeline_status, bill_status FROM dbo.purchase_headers WHERE header_id = @header_id;
  END TRY
  BEGIN CATCH DECLARE @e NVARCHAR(4000)=ERROR_MESSAGE(); RAISERROR(@e,16,1); END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_Foundry_DashboardStatsV2','P') IS NOT NULL DROP PROCEDURE dbo.sp_Foundry_DashboardStatsV2;
GO
CREATE PROCEDURE dbo.sp_Foundry_DashboardStatsV2
AS BEGIN
  SET NOCOUNT ON;
  SELECT
    COUNT(CASE WHEN pipeline_status NOT IN ('WAREHOUSE_READY','CANCELLED') THEN 1 END) AS active_purchases,
    COUNT(CASE WHEN pipeline_status = 'PENDING_BILL_VERIFICATION' THEN 1 END) AS pending_bill,
    COUNT(CASE WHEN pipeline_status = 'DRAFT' THEN 1 END) AS purchase_drafts,
    COUNT(CASE WHEN pipeline_status IN ('PENDING_BRANDING','BRANDING_DISPATCHED') THEN 1 END) AS in_branding,
    COUNT(CASE WHEN pipeline_status = 'PENDING_DIGITISATION' THEN 1 END) AS in_digitisation,
    COUNT(CASE WHEN pipeline_status = 'WAREHOUSE_READY' THEN 1 END) AS warehouse_ready,
    COUNT(CASE WHEN pipeline_status = 'BILL_DISCREPANCY' THEN 1 END) AS bill_discrepancy
  FROM dbo.purchase_headers;
  SELECT COUNT(1) AS total_skus FROM dbo.skus WHERE status='LIVE';
  SELECT ISNULL(SUM(sb.qty),0) AS warehouse_stock FROM dbo.stock_balances sb WHERE sb.location_type='WAREHOUSE' AND sb.location_id = dbo.fn_Foundry_PrimaryWarehouseLocationId();
  SELECT COUNT(DISTINCT s.supplier_id) AS active_suppliers FROM dbo.suppliers s WHERE s.vendor_status='active';
END;
GO

-- Finance procedures (DRAFT excluded from AP like pre-verify)
GO
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
    WHERE ph.pipeline_status NOT IN ('PENDING_BILL_VERIFICATION','DRAFT')
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
        AND DATEADD(day, ISNULL(s.credit_days, 0), bo.bill_date) < CAST(DATEADD(MINUTE, 330, SYSUTCDATETIME()) AS DATE)
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
      CAST(DATEADD(MINUTE, 330, SYSUTCDATETIME()) AS DATE))                       AS days_overdue
  FROM dbo.purchase_headers ph
  LEFT JOIN (
    SELECT pa.header_id, SUM(pa.allocated_amt) AS paid_amt
    FROM dbo.payment_allocations pa
    JOIN dbo.supplier_payments sp2 ON sp2.payment_id = pa.payment_id
    WHERE sp2.is_void = 0
    GROUP BY pa.header_id
  ) paid ON paid.header_id = ph.header_id
  WHERE ph.supplier_id = @supplier_id
    AND ph.pipeline_status NOT IN ('PENDING_BILL_VERIFICATION','DRAFT')
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
        CASE WHEN pipeline_status NOT IN ('PENDING_BILL_VERIFICATION','DRAFT')
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
    WHERE ph.pipeline_status NOT IN ('PENDING_BILL_VERIFICATION','DRAFT')
      AND ph.bill_date IS NOT NULL
  ) x
  WHERE x.bill_out > 0
    AND x.due_date < CAST(DATEADD(MINUTE, 330, SYSUTCDATETIME()) AS DATE);

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
    AND ph.pipeline_status NOT IN ('PENDING_BILL_VERIFICATION','DRAFT')
    AND ISNULL(ph.actual_bill_amt, ph.expected_bill_amt) - ISNULL(paid2.paid_amt, 0) > 0.005;

  SELECT @payments_30d = COUNT(*)
  FROM dbo.supplier_payments
  WHERE is_void = 0
    AND payment_date >= DATEADD(day, -30, CAST(DATEADD(MINUTE, 330, SYSUTCDATETIME()) AS DATE));

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

IF OBJECT_ID('dbo.sp_Finance_PurchaseReport','P') IS NOT NULL DROP PROCEDURE dbo.sp_Finance_PurchaseReport;
GO
CREATE PROCEDURE dbo.sp_Finance_PurchaseReport
  @from_date       DATE        = NULL,
  @to_date         DATE        = NULL,
  @supplier_id     INT         = NULL,
  @pipeline_status VARCHAR(50) = NULL,
  @category        VARCHAR(50) = NULL
AS BEGIN
  SET NOCOUNT ON;

  -- Base set: headers matching filters, with per-header stats
  -- Use a temp table so the three result sets share the same filtered data.
  CREATE TABLE #rpt (
    header_id        INT,
    supplier_id      INT,
    supplier_name    VARCHAR(200),
    purchase_date    DATETIME,
    bill_date        DATETIME,
    bill_number      VARCHAR(100),
    bill_ref         VARCHAR(100),
    pipeline_status  VARCHAR(50),
    expected_bill_amt DECIMAL(10,2),
    actual_bill_amt   DECIMAL(10,2),
    bill_amount      DECIMAL(10,2),
    transport_cost   DECIMAL(10,2),
    paid_amount      DECIMAL(12,2),
    outstanding      DECIMAL(12,2),
    item_count       INT,
    total_qty        INT
  );

  INSERT INTO #rpt
  SELECT
    h.header_id,
    h.supplier_id,
    s.vendor_name,
    h.purchase_date,
    h.bill_date,
    h.bill_number,
    h.bill_ref,
    h.pipeline_status,
    h.expected_bill_amt,
    h.actual_bill_amt,
    ISNULL(h.actual_bill_amt, h.expected_bill_amt)      AS bill_amount,
    h.transport_cost,
    ISNULL(paid.paid_amt, 0)                            AS paid_amount,
    ISNULL(h.actual_bill_amt, h.expected_bill_amt)
      - ISNULL(paid.paid_amt, 0)                        AS outstanding,
    ISNULL(pi_stats.item_count, 0)                      AS item_count,
    ISNULL(pi_stats.total_qty, 0)                       AS total_qty
  FROM dbo.purchase_headers h
  LEFT JOIN dbo.suppliers s ON s.supplier_id = h.supplier_id
  LEFT JOIN (
    SELECT header_id,
           COUNT(*)     AS item_count,
           SUM(quantity) AS total_qty
    FROM dbo.purchase_items
    GROUP BY header_id
  ) pi_stats ON pi_stats.header_id = h.header_id
  LEFT JOIN (
    SELECT pa.header_id, SUM(pa.allocated_amt) AS paid_amt
    FROM dbo.payment_allocations pa
    JOIN dbo.supplier_payments sp ON sp.payment_id = pa.payment_id
    WHERE sp.is_void = 0
    GROUP BY pa.header_id
  ) paid ON paid.header_id = h.header_id
  WHERE
    (@from_date IS NULL OR CAST(h.purchase_date AS DATE) >= @from_date)
    AND (@to_date IS NULL OR CAST(h.purchase_date AS DATE) <= @to_date)
    AND (@supplier_id IS NULL OR h.supplier_id = @supplier_id)
    AND (@pipeline_status IS NULL OR h.pipeline_status = @pipeline_status)
    AND (@pipeline_status IS NOT NULL OR h.pipeline_status <> 'DRAFT')
    AND (
      @category IS NULL
      OR EXISTS (
        SELECT 1 FROM dbo.purchase_items pi
        WHERE pi.header_id = h.header_id
          AND pi.category = @category
      )
    );

  -- RS0: Summary totals
  SELECT
    COUNT(*)                  AS total_bills,
    ISNULL(SUM(bill_amount),0)  AS total_amount,
    ISNULL(SUM(paid_amount),0)  AS total_paid,
    ISNULL(SUM(outstanding),0)  AS total_outstanding,
    ISNULL(SUM(transport_cost),0) AS total_transport,
    ISNULL(SUM(total_qty),0)    AS total_qty,
    COUNT(DISTINCT supplier_id) AS supplier_count
  FROM #rpt;

  -- RS1: Per-supplier breakdown
  SELECT
    supplier_id,
    supplier_name,
    COUNT(*)                   AS bill_count,
    ISNULL(SUM(bill_amount),0)   AS total_amount,
    ISNULL(SUM(paid_amount),0)   AS total_paid,
    ISNULL(SUM(outstanding),0)   AS total_outstanding,
    ISNULL(SUM(total_qty),0)     AS total_qty
  FROM #rpt
  GROUP BY supplier_id, supplier_name
  ORDER BY total_amount DESC;

  -- RS2: Bill-level detail
  SELECT *
  FROM #rpt
  ORDER BY purchase_date DESC, header_id DESC;

  DROP TABLE #rpt;
END;
GO
GO
