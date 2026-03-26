USE [CosmosERP];

PRINT 'Creating Foundry pipeline stored procedures...';

-- ─── Purchases CRUD ─────────────────────────────────────────────────────────

IF OBJECT_ID('dbo.sp_Purchase_Create', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Purchase_Create;
GO

CREATE PROCEDURE dbo.sp_Purchase_Create
  @product_master_id INT,
  @supplier_id       INT           = NULL,
  @purchase_date     DATETIME,
  @purchase_rate     DECIMAL(10,2),
  @quantity          INT,
  @transport_cost    DECIMAL(10,2) = 0,
  @gst_pct           DECIMAL(5,2),
  @po_reference      VARCHAR(100)  = NULL,
  @bill_ref          VARCHAR(100)  = NULL,
  @notes             VARCHAR(500)  = NULL,
  @store_id          INT           = NULL,
  @created_by        INT           = NULL
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    DECLARE @base_value DECIMAL(10,2) = @purchase_rate * @quantity;
    DECLARE @taxable    DECIMAL(10,2) = @base_value + ISNULL(@transport_cost, 0);
    -- gst_pct is stored as decimal fraction (0.12 = 12%)
    DECLARE @gst_amt    DECIMAL(10,2) = @taxable * @gst_pct;
    DECLARE @expected   DECIMAL(10,2) = @taxable + @gst_amt;

    INSERT INTO dbo.purchases (
      product_master_id, supplier_id, purchase_date, purchase_rate, quantity,
      transport_cost, gst_pct, expected_bill_amt,
      po_reference, bill_ref, notes, store_id, created_by,
      bill_status, pipeline_status
    )
    VALUES (
      @product_master_id, @supplier_id, @purchase_date, @purchase_rate, @quantity,
      ISNULL(@transport_cost, 0), @gst_pct, @expected,
      @po_reference, @bill_ref, @notes, @store_id, @created_by,
      'PENDING_BILL_VERIFICATION', 'PENDING_BILL_VERIFICATION'
    );

    DECLARE @new_id INT = SCOPE_IDENTITY();

    SELECT
      p.purchase_id,
      p.product_master_id,
      p.supplier_id,
      p.bill_ref,
      p.purchase_date,
      p.purchase_rate,
      p.quantity,
      p.transport_cost,
      p.gst_pct,
      p.expected_bill_amt,
      p.bill_status,
      p.pipeline_status,
      p.po_reference,
      p.notes,
      p.created_at,
      pm.ew_collection,
      pm.style_model,
      pm.source_type,
      pm.branding_required,
      pm.source_brand,
      pm.source_collection,
      sup.vendor_name AS supplier_name,
      mk.vendor_name  AS maker_name,
      hb.brand_name
    FROM dbo.purchases p
    LEFT JOIN dbo.product_master pm  ON p.product_master_id = pm.product_id
    LEFT JOIN dbo.suppliers sup      ON p.supplier_id       = sup.supplier_id
    LEFT JOIN dbo.suppliers mk       ON pm.maker_id         = mk.supplier_id
    LEFT JOIN dbo.home_brands hb     ON pm.home_brand_id    = hb.brand_id
    WHERE p.purchase_id = @new_id;
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_Purchase_AddColour', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Purchase_AddColour;
GO

CREATE PROCEDURE dbo.sp_Purchase_AddColour
  @purchase_id INT,
  @colour_name VARCHAR(100),
  @colour_code VARCHAR(20),
  @quantity    INT
AS
BEGIN
  SET NOCOUNT ON;

  INSERT INTO dbo.purchase_colours (purchase_id, colour_name, colour_code, quantity)
  VALUES (@purchase_id, @colour_name, @colour_code, @quantity);

  SELECT SCOPE_IDENTITY() AS colour_id;
END;
GO

IF OBJECT_ID('dbo.sp_Purchase_GetById', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Purchase_GetById;
GO

CREATE PROCEDURE dbo.sp_Purchase_GetById
  @purchase_id INT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    p.*,
    pm.ew_collection,
    pm.style_model,
    pm.source_type,
    pm.branding_required,
    pm.home_brand_id,
    pm.source_brand,
    pm.source_collection,
    pm.maker_id,
    sup.vendor_name AS supplier_name,
    mk.vendor_name  AS maker_name,
    hb.brand_name
  FROM dbo.purchases p
  LEFT JOIN dbo.product_master pm  ON p.product_master_id = pm.product_id
  LEFT JOIN dbo.suppliers sup      ON p.supplier_id       = sup.supplier_id
  LEFT JOIN dbo.suppliers mk       ON pm.maker_id         = mk.supplier_id
  LEFT JOIN dbo.home_brands hb     ON pm.home_brand_id    = hb.brand_id
  WHERE p.purchase_id = @purchase_id;

  SELECT pc.*
  FROM dbo.purchase_colours pc
  WHERE pc.purchase_id = @purchase_id;
END;
GO

IF OBJECT_ID('dbo.sp_Purchase_GetAll', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Purchase_GetAll;
GO

CREATE PROCEDURE dbo.sp_Purchase_GetAll
  @pipeline_status VARCHAR(50) = NULL,
  @search_term     VARCHAR(200) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    p.purchase_id,
    p.product_master_id,
    p.purchase_date,
    p.purchase_rate,
    p.quantity,
    p.transport_cost,
    p.gst_pct,
    p.expected_bill_amt,
    p.actual_bill_amt,
    p.bill_status,
    p.pipeline_status,
    p.po_reference,
    p.created_at,
    pm.ew_collection,
    pm.style_model,
    pm.source_type,
    pm.branding_required,
    p.supplier_id,
    p.bill_ref,
    sup.vendor_name AS supplier_name,
    mk.vendor_name  AS maker_name,
    hb.brand_name,
    DATEDIFF(day, p.created_at, GETDATE()) AS days_open
  FROM dbo.purchases p
  LEFT JOIN dbo.product_master pm  ON p.product_master_id = pm.product_id
  LEFT JOIN dbo.suppliers sup      ON p.supplier_id       = sup.supplier_id
  LEFT JOIN dbo.suppliers mk       ON pm.maker_id         = mk.supplier_id
  LEFT JOIN dbo.home_brands hb     ON pm.home_brand_id    = hb.brand_id
  WHERE (@pipeline_status IS NULL OR p.pipeline_status = @pipeline_status)
    AND (
      @search_term IS NULL
      OR pm.ew_collection  LIKE '%' + @search_term + '%'
      OR pm.style_model    LIKE '%' + @search_term + '%'
      OR sup.vendor_name   LIKE '%' + @search_term + '%'
      OR p.bill_ref        LIKE '%' + @search_term + '%'
    )
  ORDER BY p.created_at DESC;
END;
GO

-- ─── Stage 2: Bill Verification ─────────────────────────────────────────────

IF OBJECT_ID('dbo.sp_Purchase_VerifyBill', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Purchase_VerifyBill;
GO

CREATE PROCEDURE dbo.sp_Purchase_VerifyBill
  @purchase_id      INT,
  @actual_bill_amt  DECIMAL(10,2),
  @bill_number      VARCHAR(100),
  @bill_date        DATETIME,
  @discrepancy_note VARCHAR(500) = NULL,
  @approved_by      INT          = NULL
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    DECLARE @expected DECIMAL(10,2);
    SELECT @expected = expected_bill_amt FROM dbo.purchases WHERE purchase_id = @purchase_id;

    IF @expected IS NULL
    BEGIN
      RAISERROR('Purchase not found', 16, 1);
      RETURN;
    END;

    DECLARE @diff DECIMAL(10,2) = ABS(@actual_bill_amt - @expected);

    DECLARE @new_bill_status VARCHAR(30);
    DECLARE @new_pipeline    VARCHAR(50);

    IF @diff <= 50
    BEGIN
      SET @new_bill_status = 'VERIFIED';
      SET @new_pipeline    = 'PENDING_BRANDING';
    END
    ELSE
    BEGIN
      SET @new_bill_status = 'DISCREPANCY';
      SET @new_pipeline    = 'BILL_DISCREPANCY';
    END;

    UPDATE dbo.purchases
    SET
      actual_bill_amt  = @actual_bill_amt,
      bill_number      = @bill_number,
      bill_date        = @bill_date,
      bill_status      = @new_bill_status,
      pipeline_status  = @new_pipeline,
      discrepancy_note = CASE WHEN @diff > 50 THEN @discrepancy_note ELSE NULL END,
      updated_at       = GETDATE()
    WHERE purchase_id = @purchase_id;

    SELECT
      p.purchase_id,
      p.bill_status,
      p.pipeline_status,
      p.actual_bill_amt,
      p.expected_bill_amt,
      (p.actual_bill_amt - p.expected_bill_amt) AS discrepancy_amount
    FROM dbo.purchases p
    WHERE p.purchase_id = @purchase_id;
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH;
END;
GO

-- ─── Stage 3a: Branding Dispatch ────────────────────────────────────────────

IF OBJECT_ID('dbo.sp_Branding_Dispatch', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Branding_Dispatch;
GO

CREATE PROCEDURE dbo.sp_Branding_Dispatch
  @purchase_id              INT,
  @branding_instructions    VARCHAR(500) = NULL,
  @label_spec_url           VARCHAR(500) = NULL,
  @expected_return_date     DATETIME     = NULL,
  @created_by               INT          = NULL
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    DECLARE @current_status VARCHAR(50);
    SELECT @current_status = pipeline_status FROM dbo.purchases WHERE purchase_id = @purchase_id;

    IF @current_status IS NULL
    BEGIN
      RAISERROR('Purchase not found', 16, 1);
      RETURN;
    END;

    IF @current_status != 'PENDING_BRANDING'
    BEGIN
      DECLARE @err_msg VARCHAR(200) = 'Cannot dispatch to branding: purchase is currently in status "' + @current_status + '". It must be in PENDING_BRANDING.';
      RAISERROR(@err_msg, 16, 1);
      RETURN;
    END;

    IF EXISTS (SELECT 1 FROM dbo.branding_jobs WHERE purchase_id = @purchase_id AND status NOT IN ('CANCELLED','BYPASSED'))
    BEGIN
      RAISERROR('A branding job already exists for this purchase. Use Receive or check existing job status.', 16, 1);
      RETURN;
    END;

    INSERT INTO dbo.branding_jobs (
      purchase_id, dispatch_date, expected_return_date,
      branding_instructions, label_spec_url,
      status, created_by
    )
    VALUES (
      @purchase_id, GETDATE(), @expected_return_date,
      @branding_instructions, @label_spec_url,
      'DISPATCHED', @created_by
    );

    DECLARE @job_id INT = SCOPE_IDENTITY();

    -- Create per-colour branding entries
    INSERT INTO dbo.branding_job_colours (branding_job_id, colour_id, colour_code, qty_dispatched)
    SELECT @job_id, colour_id, colour_code, quantity
    FROM dbo.purchase_colours
    WHERE purchase_id = @purchase_id;

    -- Advance pipeline
    UPDATE dbo.purchases
    SET pipeline_status = 'BRANDING_DISPATCHED', updated_at = GETDATE()
    WHERE purchase_id = @purchase_id;

    SELECT bj.branding_job_id, bj.status, bj.dispatch_date, bj.expected_return_date
    FROM dbo.branding_jobs bj
    WHERE bj.branding_job_id = @job_id;
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH;
END;
GO

-- ─── Stage 3b: Branding Receive ─────────────────────────────────────────────

IF OBJECT_ID('dbo.sp_Branding_Receive', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Branding_Receive;
GO

CREATE PROCEDURE dbo.sp_Branding_Receive
  @branding_job_id  INT,
  @discrepancy_note VARCHAR(500) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    DECLARE @purchase_id INT;
    SELECT @purchase_id = purchase_id FROM dbo.branding_jobs WHERE branding_job_id = @branding_job_id;

    IF @purchase_id IS NULL
    BEGIN
      RAISERROR('Branding job not found', 16, 1);
      RETURN;
    END;

    UPDATE dbo.branding_jobs
    SET
      actual_return_date = GETDATE(),
      status             = 'RECEIVED',
      bypass_reason      = @discrepancy_note,
      updated_at         = GETDATE()
    WHERE branding_job_id = @branding_job_id;

    UPDATE dbo.purchases
    SET pipeline_status = 'PENDING_DIGITISATION', updated_at = GETDATE()
    WHERE purchase_id = @purchase_id;

    SELECT
      bj.branding_job_id,
      bj.status,
      bj.actual_return_date,
      p.purchase_id,
      p.pipeline_status
    FROM dbo.branding_jobs bj
    JOIN dbo.purchases p ON bj.purchase_id = p.purchase_id
    WHERE bj.branding_job_id = @branding_job_id;
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH;
END;
GO

-- ─── Stage 3 Bypass ─────────────────────────────────────────────────────────

IF OBJECT_ID('dbo.sp_Branding_Bypass', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Branding_Bypass;
GO

CREATE PROCEDURE dbo.sp_Branding_Bypass
  @purchase_id   INT,
  @bypass_reason VARCHAR(500),
  @created_by    INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    DECLARE @bp_status VARCHAR(50);
    SELECT @bp_status = pipeline_status FROM dbo.purchases WHERE purchase_id = @purchase_id;

    IF @bp_status IS NULL
    BEGIN
      RAISERROR('Purchase not found', 16, 1);
      RETURN;
    END;

    IF @bp_status NOT IN ('PENDING_BRANDING','PENDING_BILL_VERIFICATION','BILL_DISCREPANCY')
    BEGIN
      DECLARE @bp_err VARCHAR(200) = 'Cannot bypass branding: purchase status is "' + @bp_status + '".';
      RAISERROR(@bp_err, 16, 1);
      RETURN;
    END;

    -- Cancel any existing active branding jobs first
    UPDATE dbo.branding_jobs
    SET status = 'CANCELLED', updated_at = GETDATE()
    WHERE purchase_id = @purchase_id AND status NOT IN ('CANCELLED','BYPASSED');

    INSERT INTO dbo.branding_jobs (
      purchase_id, status, is_bypassed, bypass_reason, created_by
    )
    VALUES (
      @purchase_id, 'BYPASSED', 1, @bypass_reason, @created_by
    );

    UPDATE dbo.purchases
    SET pipeline_status = 'PENDING_DIGITISATION', updated_at = GETDATE()
    WHERE purchase_id = @purchase_id;

    SELECT purchase_id, pipeline_status FROM dbo.purchases WHERE purchase_id = @purchase_id;
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH;
END;
GO

-- ─── Stage 4: SKU Generation ─────────────────────────────────────────────────

IF OBJECT_ID('dbo.sp_SKU_Generate', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_SKU_Generate;
GO

CREATE PROCEDURE dbo.sp_SKU_Generate
  @purchase_colour_id  INT,
  @sale_price          DECIMAL(10,2),
  @sku_suffix          VARCHAR(20)   = NULL,
  @created_by          INT           = NULL
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    -- Build SKU code: BrandCode-CollectionCode-ColourCode
    DECLARE @product_master_id INT;
    DECLARE @colour_code VARCHAR(20);
    DECLARE @cost_price  DECIMAL(10,2);

    SELECT
      @product_master_id = pc.purchase_id,  -- We'll resolve via purchase
      @colour_code       = pc.colour_code
    FROM dbo.purchase_colours pc
    WHERE pc.colour_id = @purchase_colour_id;

    -- Get product_master_id through purchase
    SELECT @product_master_id = p.product_master_id
    FROM dbo.purchases p
    JOIN dbo.purchase_colours pc ON p.purchase_id = pc.purchase_id
    WHERE pc.colour_id = @purchase_colour_id;

    -- Compute landed cost per unit
    SELECT
      @cost_price = CAST(
        (p.expected_bill_amt / NULLIF(p.quantity, 0)) AS DECIMAL(10,2)
      )
    FROM dbo.purchases p
    JOIN dbo.purchase_colours pc ON p.purchase_id = pc.purchase_id
    WHERE pc.colour_id = @purchase_colour_id;

    -- Build SKU code segments
    DECLARE @brand_code      VARCHAR(10) = '';
    DECLARE @coll_code       VARCHAR(10) = '';
    DECLARE @sku_code        VARCHAR(100);

    SELECT @brand_code = UPPER(LEFT(ISNULL(hb.brand_code, ISNULL(pm.source_brand, 'EW')), 4))
    FROM dbo.product_master pm
    LEFT JOIN dbo.home_brands hb ON pm.home_brand_id = hb.brand_id
    WHERE pm.product_id = @product_master_id;

    SELECT @coll_code = UPPER(LEFT(REPLACE(pm.ew_collection, ' ', ''), 6))
    FROM dbo.product_master pm
    WHERE pm.product_id = @product_master_id;

    SET @sku_code = @brand_code + '-' + @coll_code + '-' + UPPER(@colour_code);
    IF @sku_suffix IS NOT NULL
      SET @sku_code = @sku_code + '-' + @sku_suffix;

    -- Ensure uniqueness
    DECLARE @suffix_num INT = 0;
    DECLARE @try_code VARCHAR(100) = @sku_code;
    WHILE EXISTS (SELECT 1 FROM dbo.skus WHERE sku_code = @try_code)
    BEGIN
      SET @suffix_num = @suffix_num + 1;
      SET @try_code = @sku_code + '-' + CAST(@suffix_num AS VARCHAR(5));
    END;
    SET @sku_code = @try_code;

    -- Generate barcode: timestamp-based unique number
    DECLARE @barcode VARCHAR(100) = 'EW' + REPLACE(REPLACE(REPLACE(CONVERT(VARCHAR(20), GETDATE(), 120), '-',''),':',''),' ','')
      + RIGHT('000' + CAST(@purchase_colour_id AS VARCHAR(10)), 5);

    INSERT INTO dbo.skus (
      product_master_id, purchase_colour_id, sku_code,
      barcode, quantity, cost_price, sale_price, status, created_by
    )
    VALUES (
      @product_master_id, @purchase_colour_id, @sku_code,
      @barcode,
      (SELECT quantity FROM dbo.purchase_colours WHERE colour_id = @purchase_colour_id),
      ISNULL(@cost_price, 0), @sale_price, 'DRAFT', @created_by
    );

    DECLARE @sku_id INT = SCOPE_IDENTITY();

    SELECT
      sk.sku_id, sk.sku_code, sk.barcode, sk.quantity,
      sk.cost_price, sk.sale_price, sk.status,
      pc.colour_name, pc.colour_code
    FROM dbo.skus sk
    JOIN dbo.purchase_colours pc ON sk.purchase_colour_id = pc.colour_id
    WHERE sk.sku_id = @sku_id;
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_SKU_GetByPurchase', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_SKU_GetByPurchase;
GO

CREATE PROCEDURE dbo.sp_SKU_GetByPurchase
  @purchase_id INT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    sk.sku_id,
    sk.sku_code,
    sk.barcode,
    sk.quantity,
    sk.cost_price,
    sk.sale_price,
    sk.status,
    pc.colour_name,
    pc.colour_code,
    pc.colour_id AS purchase_colour_id
  FROM dbo.skus sk
  JOIN dbo.purchase_colours pc ON sk.purchase_colour_id = pc.colour_id
  WHERE pc.purchase_id = @purchase_id
  ORDER BY pc.colour_name;
END;
GO

IF OBJECT_ID('dbo.sp_SKU_UpdatePrice', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_SKU_UpdatePrice;
GO

CREATE PROCEDURE dbo.sp_SKU_UpdatePrice
  @sku_id     INT,
  @sale_price DECIMAL(10,2)
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE dbo.skus
  SET sale_price = @sale_price, updated_at = GETDATE()
  WHERE sku_id = @sku_id;

  SELECT sku_id, sku_code, sale_price, status FROM dbo.skus WHERE sku_id = @sku_id;
END;
GO

-- ─── Stage 5: Warehouse Ready ────────────────────────────────────────────────

IF OBJECT_ID('dbo.sp_Purchase_WarehouseReady', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Purchase_WarehouseReady;
GO

CREATE PROCEDURE dbo.sp_Purchase_WarehouseReady
  @purchase_id INT,
  @approved_by INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    -- Publish all DRAFT SKUs for this purchase
    UPDATE sk
    SET sk.status = 'LIVE', sk.updated_at = GETDATE()
    FROM dbo.skus sk
    JOIN dbo.purchase_colours pc ON sk.purchase_colour_id = pc.colour_id
    WHERE pc.purchase_id = @purchase_id
      AND sk.status = 'DRAFT';

    -- Update purchase pipeline
    UPDATE dbo.purchases
    SET pipeline_status = 'WAREHOUSE_READY', updated_at = GETDATE()
    WHERE purchase_id = @purchase_id;

    -- Seed stock balances for warehouse
    INSERT INTO dbo.stock_balances (sku_id, location_type, location_id, location_name, qty)
    SELECT sk.sku_id, 'WAREHOUSE', 1, 'HQ Warehouse', pc.quantity
    FROM dbo.skus sk
    JOIN dbo.purchase_colours pc ON sk.purchase_colour_id = pc.colour_id
    WHERE pc.purchase_id = @purchase_id
      AND NOT EXISTS (
        SELECT 1 FROM dbo.stock_balances sb
        WHERE sb.sku_id = sk.sku_id AND sb.location_type = 'WAREHOUSE' AND sb.location_id = 1
      );

    SELECT purchase_id, pipeline_status FROM dbo.purchases WHERE purchase_id = @purchase_id;
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH;
END;
GO

-- ─── Stage 1 Edit ────────────────────────────────────────────────────────────

IF OBJECT_ID('dbo.sp_Purchase_Update', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Purchase_Update;
GO

CREATE PROCEDURE dbo.sp_Purchase_Update
  @purchase_id    INT,
  @supplier_id    INT           = NULL,
  @purchase_date  DATETIME      = NULL,
  @purchase_rate  DECIMAL(10,2) = NULL,
  @quantity       INT           = NULL,
  @transport_cost DECIMAL(10,2) = NULL,
  @gst_pct        DECIMAL(5,2)  = NULL,
  @po_reference   VARCHAR(100)  = NULL,
  @bill_ref       VARCHAR(100)  = NULL,
  @notes          VARCHAR(500)  = NULL
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    -- Only allow editing at Stage 1 (PENDING_BILL_VERIFICATION)
    IF NOT EXISTS (SELECT 1 FROM dbo.purchases WHERE purchase_id = @purchase_id AND pipeline_status = 'PENDING_BILL_VERIFICATION')
    BEGIN
      RAISERROR('Purchase can only be edited at Stage 1 (Pending Bill Verification).', 16, 1);
      RETURN;
    END;

    -- Recalculate expected bill
    DECLARE @rate     DECIMAL(10,2), @qty INT, @trans DECIMAL(10,2), @gst DECIMAL(5,2);
    SELECT @rate = ISNULL(@purchase_rate, purchase_rate),
           @qty  = ISNULL(@quantity, quantity),
           @trans= ISNULL(@transport_cost, transport_cost),
           @gst  = ISNULL(@gst_pct, gst_pct)
    FROM dbo.purchases WHERE purchase_id = @purchase_id;

    DECLARE @base     DECIMAL(10,2) = @rate * @qty;
    DECLARE @taxable  DECIMAL(10,2) = @base + ISNULL(@trans, 0);
    DECLARE @gst_amt  DECIMAL(10,2) = @taxable * @gst;
    DECLARE @expected DECIMAL(10,2) = @taxable + @gst_amt;

    UPDATE dbo.purchases SET
      supplier_id       = ISNULL(@supplier_id, supplier_id),
      purchase_date     = ISNULL(@purchase_date, purchase_date),
      purchase_rate     = ISNULL(@purchase_rate, purchase_rate),
      quantity          = ISNULL(@quantity, quantity),
      transport_cost    = ISNULL(@transport_cost, transport_cost),
      gst_pct           = ISNULL(@gst_pct, gst_pct),
      expected_bill_amt = @expected,
      po_reference      = ISNULL(@po_reference, po_reference),
      bill_ref          = ISNULL(@bill_ref, bill_ref),
      notes             = ISNULL(@notes, notes),
      updated_at        = GETDATE()
    WHERE purchase_id = @purchase_id;

    SELECT
      p.purchase_id, p.supplier_id, p.bill_ref,
      p.purchase_date, p.purchase_rate, p.quantity,
      p.transport_cost, p.gst_pct, p.expected_bill_amt,
      p.pipeline_status, p.po_reference, p.notes, p.updated_at,
      sup.vendor_name AS supplier_name
    FROM dbo.purchases p
    LEFT JOIN dbo.suppliers sup ON p.supplier_id = sup.supplier_id
    WHERE p.purchase_id = @purchase_id;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO

-- ─── Dashboard Stats ─────────────────────────────────────────────────────────

IF OBJECT_ID('dbo.sp_Foundry_DashboardStats', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Foundry_DashboardStats;
GO

CREATE PROCEDURE dbo.sp_Foundry_DashboardStats
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    COUNT(CASE WHEN pipeline_status NOT IN ('WAREHOUSE_READY','CANCELLED') THEN 1 END) AS active_purchases,
    COUNT(CASE WHEN pipeline_status = 'PENDING_BILL_VERIFICATION' THEN 1 END) AS pending_bill,
    COUNT(CASE WHEN pipeline_status = 'PENDING_BRANDING' OR pipeline_status = 'BRANDING_DISPATCHED' THEN 1 END) AS in_branding,
    COUNT(CASE WHEN pipeline_status = 'PENDING_DIGITISATION' THEN 1 END) AS in_digitisation,
    COUNT(CASE WHEN pipeline_status = 'WAREHOUSE_READY' THEN 1 END) AS warehouse_ready,
    COUNT(CASE WHEN pipeline_status = 'BILL_DISCREPANCY' THEN 1 END) AS bill_discrepancy
  FROM dbo.purchases;

  SELECT COUNT(1) AS total_skus FROM dbo.skus WHERE status = 'LIVE';

  SELECT ISNULL(SUM(sb.qty), 0) AS warehouse_stock
  FROM dbo.stock_balances sb
  WHERE sb.location_type = 'WAREHOUSE';

  SELECT COUNT(DISTINCT s.supplier_id) AS active_suppliers
  FROM dbo.suppliers s
  WHERE s.vendor_status = 'active';
END;
GO
