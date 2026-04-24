-- ─────────────────────────────────────────────────────────────────────────────
-- Pipeline v2: purchase_headers + purchase_items architecture
-- ─────────────────────────────────────────────────────────────────────────────
USE [CosmosERP];
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_PurchaseHeader_Create
-- Creates a purchase header + N items + colours in one call.
-- @items_json  = JSON: [{product_master_id,maker_master_id,category,purchase_rate,quantity,gst_pct,colours:[{colour_name,colour_code,quantity}]}]
-- ══════════════════════════════════════════════════════════════════════════════
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
  @items_json     NVARCHAR(MAX)           -- JSON array of items
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

    -- Insert header
    INSERT INTO dbo.purchase_headers (
      supplier_id, source_type, bill_ref, purchase_date, transport_cost,
      po_reference, notes, expected_bill_amt,
      bill_status, pipeline_status, created_by, created_at, updated_at
    ) VALUES (
      @supplier_id, @source_type, @bill_ref, @purchase_date, ISNULL(@transport_cost,0),
      @po_reference, @notes, @expected,
      'PENDING_BILL_VERIFICATION', 'PENDING_BILL_VERIFICATION', @created_by, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME())
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

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_PurchaseHeader_GetAll
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_PurchaseHeader_GetAll','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_GetAll;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_GetAll
  @pipeline_status VARCHAR(50)  = NULL,
  @search_term     VARCHAR(200) = NULL
AS BEGIN
  SET NOCOUNT ON;
  SELECT
    h.header_id, h.supplier_id, h.bill_ref, h.purchase_date,
    h.transport_cost, h.po_reference, h.notes,
    h.expected_bill_amt, h.actual_bill_amt, h.bill_number, h.bill_date,
    h.bill_status, h.pipeline_status, h.created_at, h.updated_at,
    s.vendor_name AS supplier_name,
    (SELECT COUNT(*) FROM dbo.purchase_items pi WHERE pi.header_id = h.header_id) AS item_count,
    (SELECT SUM(pi.quantity) FROM dbo.purchase_items pi WHERE pi.header_id = h.header_id) AS total_qty,
    DATEDIFF(day, h.created_at, DATEADD(MINUTE, 330, SYSUTCDATETIME())) AS days_open
  FROM dbo.purchase_headers h
  LEFT JOIN dbo.suppliers s ON h.supplier_id = s.supplier_id
  WHERE (@pipeline_status IS NULL OR h.pipeline_status = @pipeline_status)
    AND (@search_term IS NULL
         OR s.vendor_name LIKE '%'+@search_term+'%'
         OR h.bill_ref    LIKE '%'+@search_term+'%'
         OR h.bill_number LIKE '%'+@search_term+'%'
         OR EXISTS (
           SELECT 1 FROM dbo.purchase_items pi
           JOIN dbo.product_master pm ON pi.product_master_id = pm.product_id
           WHERE pi.header_id = h.header_id
             AND (pm.ew_collection LIKE '%'+@search_term+'%' OR pm.style_model LIKE '%'+@search_term+'%')
         ))
  ORDER BY h.created_at DESC;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_PurchaseHeader_GetById
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_PurchaseHeader_GetById','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_GetById;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_GetById @header_id INT
AS BEGIN
  SET NOCOUNT ON;
  -- RS0: header (includes branding agent name when assigned)
  SELECT h.*, s.vendor_name AS supplier_name, ba.agent_name AS branding_agent_name
  FROM dbo.purchase_headers h
  LEFT JOIN dbo.suppliers s     ON h.supplier_id    = s.supplier_id
  LEFT JOIN dbo.branding_agents ba ON h.branding_agent_id = ba.agent_id
  WHERE h.header_id = @header_id;
  -- RS1: items (includes product detail fields for digitisation)
  SELECT pi.*, pm.ew_collection, pm.style_model, pm.source_type, pm.branding_required,
         pm.source_brand, pm.source_collection, pm.home_brand_id,
         pm.description, pm.frame_width, pm.lens_height, pm.temple_length, pm.frame_material,
         hb.brand_name, mk.maker_name,
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM dbo.skus sx
             WHERE sx.product_master_id = pi.product_master_id
               AND sx.status = 'LIVE'
           ) THEN CAST(1 AS BIT)
           ELSE CAST(0 AS BIT)
         END AS is_existing_product,
         CASE
           WHEN pm.home_brand_id IS NOT NULL
             OR EXISTS (
               SELECT 1
               FROM dbo.skus sx
               WHERE sx.product_master_id = pi.product_master_id
                 AND sx.status = 'LIVE'
             )
           THEN CAST(1 AS BIT)
           ELSE CAST(0 AS BIT)
         END AS is_brand_locked,
         pm.home_brand_id AS locked_home_brand_id,
         hb.brand_name AS locked_home_brand_name
  FROM dbo.purchase_items pi
  LEFT JOIN dbo.product_master pm ON pi.product_master_id = pm.product_id
  LEFT JOIN dbo.home_brands hb    ON pm.home_brand_id = hb.brand_id
  LEFT JOIN dbo.maker_master mk   ON pi.maker_master_id = mk.maker_id
  WHERE pi.header_id = @header_id
  ORDER BY pi.item_id;
  -- RS2: colours + linked SKU context for existing-item restock flows
  SELECT
    pic.*,
    pi.header_id,
    sk.sku_code AS linked_sku_code,
    sk.barcode AS linked_barcode,
    sk.sale_price AS linked_sale_price,
    sk.status AS linked_sku_status
  FROM dbo.purchase_item_colours pic
  JOIN dbo.purchase_items pi ON pic.item_id = pi.item_id
  LEFT JOIN dbo.skus sk ON sk.sku_id = pic.linked_sku_id
  WHERE pi.header_id = @header_id
  ORDER BY item_id, item_colour_id;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_PurchaseHeader_Update  (Stage 1 edit, only while PENDING_BILL_VERIFICATION)
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_PurchaseHeader_Update','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_Update;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_Update
  @header_id      INT,
  @supplier_id    INT           = NULL,
  @bill_ref       VARCHAR(100)  = NULL,
  @purchase_date  DATETIME      = NULL,
  @transport_cost DECIMAL(10,2) = NULL,
  @po_reference   VARCHAR(100)  = NULL,
  @notes          VARCHAR(500)  = NULL
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.purchase_headers WHERE header_id=@header_id AND pipeline_status='PENDING_BILL_VERIFICATION')
    BEGIN RAISERROR('Header can only be edited at Stage 1.',16,1); RETURN; END;
    UPDATE dbo.purchase_headers SET
      supplier_id    = ISNULL(@supplier_id,    supplier_id),
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

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_PurchaseHeader_VerifyBill  (Stage 2)
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_PurchaseHeader_VerifyBill','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_VerifyBill;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_VerifyBill
  @header_id       INT,
  @actual_bill_amt DECIMAL(10,2),
  @bill_number     VARCHAR(100),
  @bill_date       DATETIME,
  @discrepancy_note VARCHAR(500) = NULL,
  @approved_by     INT          = NULL
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.purchase_headers WHERE header_id=@header_id AND pipeline_status='PENDING_BILL_VERIFICATION')
    BEGIN RAISERROR('Bill verification only allowed at Stage 1.',16,1); RETURN; END;

    DECLARE @expected DECIMAL(10,2);
    SELECT @expected = expected_bill_amt FROM dbo.purchase_headers WHERE header_id=@header_id;

    DECLARE @diff     DECIMAL(10,2) = ABS(@actual_bill_amt - @expected);
    DECLARE @new_bill_status VARCHAR(50) = CASE WHEN @diff <= 50 THEN 'VERIFIED' ELSE 'BILL_DISCREPANCY' END;
    -- Determine next pipeline stage: check if any item needs branding
    DECLARE @needs_branding BIT = 0;
    IF EXISTS (SELECT 1 FROM dbo.purchase_items pi
               JOIN dbo.product_master pm ON pi.product_master_id = pm.product_id
               WHERE pi.header_id = @header_id AND pm.branding_required = 1)
      SET @needs_branding = 1;

    DECLARE @next_pipeline VARCHAR(50) =
      CASE WHEN @new_bill_status = 'BILL_DISCREPANCY' THEN 'BILL_DISCREPANCY'
           WHEN @needs_branding = 1 THEN 'PENDING_BRANDING'
           ELSE 'PENDING_DIGITISATION' END;

    UPDATE dbo.purchase_headers SET
      actual_bill_amt  = @actual_bill_amt,
      bill_number      = @bill_number,
      bill_date        = @bill_date,
      discrepancy_note = @discrepancy_note,
      bill_status      = @new_bill_status,
      pipeline_status  = @next_pipeline,
      updated_at       = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE header_id = @header_id;

    SELECT header_id, pipeline_status, bill_status FROM dbo.purchase_headers WHERE header_id = @header_id;
  END TRY
  BEGIN CATCH DECLARE @e NVARCHAR(4000)=ERROR_MESSAGE(); RAISERROR(@e,16,1); END CATCH;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_PurchaseHeader_BrandingDispatch  (Stage 3 – Dispatch)
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_PurchaseHeader_BrandingDispatch','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_BrandingDispatch;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_BrandingDispatch
  @header_id             INT,
  @branding_instructions VARCHAR(500) = NULL,
  @branding_agent_id     INT          = NULL
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.purchase_headers WHERE header_id=@header_id AND pipeline_status='PENDING_BRANDING')
    BEGIN RAISERROR('Branding dispatch only allowed at PENDING_BRANDING stage.',16,1); RETURN; END;
    UPDATE dbo.purchase_headers SET
      branding_instructions = @branding_instructions,
      branding_agent_id     = @branding_agent_id,
      pipeline_status       = 'BRANDING_DISPATCHED',
      dispatched_at         = DATEADD(MINUTE, 330, SYSUTCDATETIME()),
      updated_at            = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE header_id = @header_id;
    SELECT h.header_id, h.pipeline_status, h.dispatched_at, ba.agent_name AS branding_agent_name
    FROM dbo.purchase_headers h
    LEFT JOIN dbo.branding_agents ba ON h.branding_agent_id = ba.agent_id
    WHERE h.header_id = @header_id;
  END TRY
  BEGIN CATCH DECLARE @e NVARCHAR(4000)=ERROR_MESSAGE(); RAISERROR(@e,16,1); END CATCH;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_PurchaseHeader_BrandingReceive  (Stage 3 – Receive back)
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_PurchaseHeader_BrandingReceive','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_BrandingReceive;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_BrandingReceive @header_id INT
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.purchase_headers WHERE header_id=@header_id AND pipeline_status='BRANDING_DISPATCHED')
    BEGIN RAISERROR('Can only receive at BRANDING_DISPATCHED stage.',16,1); RETURN; END;
    UPDATE dbo.purchase_headers SET
      pipeline_status = 'PENDING_DIGITISATION',
      received_at     = DATEADD(MINUTE, 330, SYSUTCDATETIME()),
      updated_at      = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE header_id = @header_id;
    SELECT header_id, pipeline_status, received_at FROM dbo.purchase_headers WHERE header_id = @header_id;
  END TRY
  BEGIN CATCH DECLARE @e NVARCHAR(4000)=ERROR_MESSAGE(); RAISERROR(@e,16,1); END CATCH;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_PurchaseHeader_BrandingBypass  (Stage 3 – Bypass branding)
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_PurchaseHeader_BrandingBypass','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_BrandingBypass;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_BrandingBypass
  @header_id     INT,
  @bypass_reason VARCHAR(500)
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.purchase_headers WHERE header_id=@header_id AND pipeline_status IN ('PENDING_BRANDING','BILL_DISCREPANCY'))
    BEGIN RAISERROR('Bypass only allowed at PENDING_BRANDING stage.',16,1); RETURN; END;
    IF @bypass_reason IS NULL OR LEN(TRIM(@bypass_reason)) = 0
    BEGIN RAISERROR('Bypass reason is required.',16,1); RETURN; END;
    UPDATE dbo.purchase_headers SET
      bypass_reason   = @bypass_reason,
      pipeline_status = 'PENDING_DIGITISATION',
      updated_at      = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE header_id = @header_id;
    SELECT header_id, pipeline_status FROM dbo.purchase_headers WHERE header_id = @header_id;
  END TRY
  BEGIN CATCH DECLARE @e NVARCHAR(4000)=ERROR_MESSAGE(); RAISERROR(@e,16,1); END CATCH;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- purchase_restock_events (per-purchase restock identity)
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.purchase_restock_events','U') IS NULL
BEGIN
  CREATE TABLE dbo.purchase_restock_events (
    event_id            INT IDENTITY(1,1) PRIMARY KEY,
    purchase_event_id   VARCHAR(80) NOT NULL UNIQUE,
    header_id           INT NOT NULL,
    item_id             INT NOT NULL,
    item_colour_id      INT NOT NULL,
    linked_sku_id       INT NOT NULL,
    sale_price_snapshot DECIMAL(10,2) NOT NULL,
    created_at          DATETIME NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    CONSTRAINT FK_pre_header FOREIGN KEY (header_id) REFERENCES dbo.purchase_headers(header_id),
    CONSTRAINT FK_pre_item FOREIGN KEY (item_id) REFERENCES dbo.purchase_items(item_id),
    CONSTRAINT FK_pre_colour FOREIGN KEY (item_colour_id) REFERENCES dbo.purchase_item_colours(colour_id),
    CONSTRAINT FK_pre_sku FOREIGN KEY (linked_sku_id) REFERENCES dbo.skus(sku_id),
    CONSTRAINT UQ_pre_header_item_colour UNIQUE (header_id, item_id, item_colour_id)
  );
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_SKUv2_Generate  (Stage 4 – per colour per item)
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_SKUv2_Generate','P') IS NOT NULL DROP PROCEDURE dbo.sp_SKUv2_Generate;
GO
CREATE PROCEDURE dbo.sp_SKUv2_Generate
  @header_id      INT,
  @item_id        INT,
  @item_colour_id INT,
  @sale_price     DECIMAL(10,2)
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    DECLARE @purchase_event_id VARCHAR(80) = CONCAT('PRE-', @header_id, '-', @item_id, '-', @item_colour_id);

    IF NOT EXISTS (
      SELECT 1
      FROM dbo.purchase_headers
      WHERE header_id = @header_id
        AND pipeline_status = 'PENDING_DIGITISATION'
    )
    BEGIN
      RAISERROR('SKU processing only allowed at PENDING_DIGITISATION stage.',16,1);
      RETURN;
    END;

    DECLARE @linked_sku_id INT;

    SELECT @linked_sku_id = pic.linked_sku_id
    FROM dbo.purchase_item_colours pic
    JOIN dbo.purchase_items pi ON pi.item_id = pic.item_id
    WHERE pic.colour_id = @item_colour_id
      AND pi.item_id = @item_id
      AND pi.header_id = @header_id;

    IF @linked_sku_id IS NOT NULL
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM dbo.purchase_restock_events
        WHERE header_id = @header_id
          AND item_id = @item_id
          AND item_colour_id = @item_colour_id
      )
      BEGIN
        INSERT INTO dbo.purchase_restock_events (
          purchase_event_id,
          header_id,
          item_id,
          item_colour_id,
          linked_sku_id,
          sale_price_snapshot
        )
        SELECT
          @purchase_event_id,
          @header_id,
          @item_id,
          @item_colour_id,
          pic.linked_sku_id,
          sk.sale_price
        FROM dbo.purchase_item_colours pic
        JOIN dbo.skus sk ON sk.sku_id = pic.linked_sku_id
        WHERE pic.colour_id = @item_colour_id;
      END;

      SELECT
        sk.sku_id,
        sk.sku_code,
        sk.barcode,
        pic.quantity,
        pi.purchase_rate AS cost_price,
        sk.sale_price,
        sk.status,
        pic.colour_id AS item_colour_id,
        COALESCE(sk.image_url, pic.image_url) AS image_url,
        COALESCE(sk.video_url, pic.video_url) AS video_url,
        pm.product_id AS product_master_id,
        pm.ew_collection,
        pm.style_model,
        pm.product_type AS pm_product_type,
        pm.description,
        pm.frame_width,
        pm.lens_height,
        pm.temple_length,
        pm.frame_material,
        hb.brand_name,
        pic.colour_name,
        pic.colour_code,
        pi.item_id,
        @purchase_event_id AS purchase_event_id,
        CAST(1 AS BIT) AS is_restock,
        'RESTOCK_EXISTING' AS stock_action
      FROM dbo.purchase_item_colours pic
      JOIN dbo.purchase_items pi ON pi.item_id = pic.item_id
      JOIN dbo.skus sk ON sk.sku_id = pic.linked_sku_id
      JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
      LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
      WHERE pic.colour_id = @item_colour_id
        AND pi.item_id = @item_id
        AND pi.header_id = @header_id;
      RETURN;
    END;

    DECLARE @product_master_id INT;
    DECLARE @maker_master_id INT;
    DECLARE @source_brand_match VARCHAR(200);
    DECLARE @source_model_match VARCHAR(200);
    DECLARE @cost_price DECIMAL(10,2);
    DECLARE @quantity INT;
    DECLARE @ew_collection VARCHAR(200);
    DECLARE @colour_code VARCHAR(50);
    DECLARE @brand_name VARCHAR(200);
    DECLARE @colour_image_url VARCHAR(500);
    DECLARE @colour_video_url VARCHAR(500);

    SELECT
      @product_master_id = pi.product_master_id,
      @maker_master_id = pm.maker_master_id,
      @source_brand_match = pm.source_brand,
      @source_model_match = pm.source_model_number,
      @cost_price = pi.purchase_rate,
      @quantity = pic.quantity,
      @ew_collection = pm.ew_collection,
      @colour_code = pic.colour_code,
      @brand_name = hb.brand_name,
      @colour_image_url = pic.image_url,
      @colour_video_url = pic.video_url
    FROM dbo.purchase_items pi
    JOIN dbo.purchase_item_colours pic ON pic.colour_id = @item_colour_id AND pic.item_id = @item_id
    JOIN dbo.product_master pm ON pm.product_id = pi.product_master_id
    LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
    WHERE pi.item_id = @item_id
      AND pi.header_id = @header_id;

    IF @product_master_id IS NULL
      THROW 50001, 'Purchase item not found for SKU processing.', 1;

    SELECT TOP 1
      @linked_sku_id = sk.sku_id
    FROM dbo.skus sk
    JOIN dbo.product_master epm ON epm.product_id = sk.product_master_id
    LEFT JOIN dbo.purchase_item_colours epc ON epc.colour_id = sk.item_colour_id
    WHERE sk.status = 'LIVE'
      AND UPPER(LTRIM(RTRIM(ISNULL(epc.colour_code, '')))) = UPPER(LTRIM(RTRIM(ISNULL(@colour_code, ''))))
      AND (
        sk.product_master_id = @product_master_id
        OR (
          @maker_master_id IS NOT NULL
          AND epm.maker_master_id = @maker_master_id
          AND UPPER(LTRIM(RTRIM(ISNULL(epm.source_brand, '')))) = UPPER(LTRIM(RTRIM(ISNULL(@source_brand_match, ''))))
          AND UPPER(LTRIM(RTRIM(ISNULL(epm.source_model_number, '')))) = UPPER(LTRIM(RTRIM(ISNULL(@source_model_match, ''))))
        )
      )
    ORDER BY
      CASE WHEN sk.product_master_id = @product_master_id THEN 1 ELSE 0 END DESC,
      sk.updated_at DESC,
      sk.sku_id DESC;

    IF @linked_sku_id IS NOT NULL
    BEGIN
      UPDATE dbo.purchase_item_colours
      SET linked_sku_id = @linked_sku_id
      WHERE colour_id = @item_colour_id;

      IF NOT EXISTS (
        SELECT 1
        FROM dbo.purchase_restock_events
        WHERE header_id = @header_id
          AND item_id = @item_id
          AND item_colour_id = @item_colour_id
      )
      BEGIN
        INSERT INTO dbo.purchase_restock_events (
          purchase_event_id,
          header_id,
          item_id,
          item_colour_id,
          linked_sku_id,
          sale_price_snapshot
        )
        SELECT
          @purchase_event_id,
          @header_id,
          @item_id,
          @item_colour_id,
          pic.linked_sku_id,
          sk.sale_price
        FROM dbo.purchase_item_colours pic
        JOIN dbo.skus sk ON sk.sku_id = pic.linked_sku_id
        WHERE pic.colour_id = @item_colour_id;
      END;

      SELECT
        sk.sku_id,
        sk.sku_code,
        sk.barcode,
        pic.quantity,
        pi.purchase_rate AS cost_price,
        sk.sale_price,
        sk.status,
        pic.colour_id AS item_colour_id,
        COALESCE(sk.image_url, pic.image_url) AS image_url,
        COALESCE(sk.video_url, pic.video_url) AS video_url,
        pm.product_id AS product_master_id,
        pm.ew_collection,
        pm.style_model,
        pm.product_type AS pm_product_type,
        pm.description,
        pm.frame_width,
        pm.lens_height,
        pm.temple_length,
        pm.frame_material,
        hb.brand_name,
        pic.colour_name,
        pic.colour_code,
        pi.item_id,
        @purchase_event_id AS purchase_event_id,
        CAST(1 AS BIT) AS is_restock,
        'RESTOCK_EXISTING' AS stock_action
      FROM dbo.purchase_item_colours pic
      JOIN dbo.purchase_items pi ON pi.item_id = pic.item_id
      JOIN dbo.skus sk ON sk.sku_id = pic.linked_sku_id
      JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
      LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
      WHERE pic.colour_id = @item_colour_id
        AND pi.item_id = @item_id
        AND pi.header_id = @header_id;
      RETURN;
    END;

    IF EXISTS (
      SELECT 1
      FROM dbo.skus
      WHERE header_id = @header_id
        AND item_id = @item_id
        AND item_colour_id = @item_colour_id
    )
    BEGIN
      SELECT
        sk.sku_id,
        sk.sku_code,
        sk.barcode,
        pic.quantity,
        sk.cost_price,
        sk.sale_price,
        sk.status,
        sk.item_colour_id,
        COALESCE(sk.image_url, pic.image_url) AS image_url,
        COALESCE(sk.video_url, pic.video_url) AS video_url,
        pm.product_id AS product_master_id,
        pm.ew_collection,
        pm.style_model,
        pm.product_type AS pm_product_type,
        pm.description,
        pm.frame_width,
        pm.lens_height,
        pm.temple_length,
        pm.frame_material,
        hb.brand_name,
        pic.colour_name,
        pic.colour_code,
        sk.item_id,
        sk.pid AS purchase_event_id,
        CAST(0 AS BIT) AS is_restock,
        'NEW_SKU' AS stock_action
      FROM dbo.skus sk
      JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
      LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
      LEFT JOIN dbo.purchase_item_colours pic ON pic.colour_id = sk.item_colour_id
      WHERE sk.header_id = @header_id
        AND sk.item_id = @item_id
        AND sk.item_colour_id = @item_colour_id;
      RETURN;
    END;

    DECLARE @brandPfx VARCHAR(10) = UPPER(LEFT(ISNULL(@brand_name, 'GEN'), 3));
    DECLARE @collPfx  VARCHAR(10) = UPPER(LEFT(REPLACE(ISNULL(@ew_collection, 'XX'), ' ', ''), 4));
    DECLARE @colPfx   VARCHAR(6)  = UPPER(LEFT(REPLACE(ISNULL(@colour_code, '00'), ' ', ''), 3));
    DECLARE @seq      INT;

    SELECT @seq = ISNULL(MAX(sku_id), 0) + 1 FROM dbo.skus;

    DECLARE @skuCode VARCHAR(50) = @brandPfx + '-' + @collPfx + '-' + @colPfx + '-' + RIGHT('0000' + CAST(@seq AS VARCHAR), 4);
    DECLARE @barcode VARCHAR(50) = 'EWS-' + @brandPfx + '-' + @colPfx + '-' + RIGHT('0000' + CAST(@seq AS VARCHAR), 4);

    INSERT INTO dbo.skus
      (product_master_id, sku_code, barcode, quantity, cost_price, sale_price,
       status, created_at, updated_at, header_id, item_id, item_colour_id, image_url, video_url)
    VALUES
      (@product_master_id, @skuCode, @barcode, @quantity, @cost_price, @sale_price,
       'LIVE', DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()), @header_id, @item_id, @item_colour_id, @colour_image_url, @colour_video_url);

    SELECT
      sk.sku_id,
      sk.sku_code,
      sk.barcode,
      pic.quantity,
      sk.cost_price,
      sk.sale_price,
      sk.status,
      sk.item_colour_id,
      COALESCE(sk.image_url, pic.image_url) AS image_url,
      COALESCE(sk.video_url, pic.video_url) AS video_url,
      pm.product_id AS product_master_id,
      pm.ew_collection,
      pm.style_model,
      pm.product_type AS pm_product_type,
      pm.description,
      pm.frame_width,
      pm.lens_height,
      pm.temple_length,
      pm.frame_material,
      hb.brand_name,
      pic.colour_name,
      pic.colour_code,
      sk.item_id,
      sk.pid AS purchase_event_id,
      CAST(0 AS BIT) AS is_restock,
      'NEW_SKU' AS stock_action
    FROM dbo.skus sk
    JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
    LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
    LEFT JOIN dbo.purchase_item_colours pic ON pic.colour_id = sk.item_colour_id
    WHERE sk.sku_id = SCOPE_IDENTITY();
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_PurchaseHeader_GetSKUs  (get all SKUs for a header)
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_PurchaseHeader_GetSKUs','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_GetSKUs;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_GetSKUs @header_id INT
AS BEGIN
  SET NOCOUNT ON;
  SELECT sk.sku_id, sk.item_colour_id, sk.sku_code, sk.pid, sk.barcode, sk.sale_price, sk.status,
         pic.colour_name, pic.colour_code, pic.quantity,
         pi.item_id, pi.purchase_rate, pi.quantity AS item_qty,
         pm.ew_collection, pm.style_model,
         sk.pid AS purchase_event_id,
         CAST(0 AS BIT) AS is_restock,
         'NEW_SKU' AS stock_action
  FROM dbo.skus sk
  JOIN dbo.purchase_item_colours pic ON sk.item_colour_id = pic.colour_id
  JOIN dbo.purchase_items pi         ON pic.item_id = pi.item_id
  JOIN dbo.product_master pm         ON pi.product_master_id = pm.product_id
  WHERE sk.header_id = @header_id
  UNION ALL
  SELECT sk.sku_id, pic.colour_id AS item_colour_id, sk.sku_code, sk.pid, sk.barcode, sk.sale_price, sk.status,
         pic.colour_name, pic.colour_code, pic.quantity,
         pi.item_id, pi.purchase_rate, pi.quantity AS item_qty,
         pm.ew_collection, pm.style_model,
         pre.purchase_event_id,
         CAST(1 AS BIT) AS is_restock,
         'RESTOCK_EXISTING' AS stock_action
  FROM dbo.purchase_restock_events pre
  JOIN dbo.purchase_item_colours pic ON pic.colour_id = pre.item_colour_id
  JOIN dbo.purchase_items pi ON pi.item_id = pre.item_id
  JOIN dbo.skus sk ON sk.sku_id = pre.linked_sku_id
  JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
  WHERE pre.header_id = @header_id
  ORDER BY pi.item_id, pic.colour_id;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_PurchaseHeader_WarehouseReady  (Stage 5)
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_PurchaseHeader_WarehouseReady','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_WarehouseReady;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_WarehouseReady @header_id INT
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.purchase_headers WHERE header_id=@header_id AND pipeline_status='PENDING_DIGITISATION')
    BEGIN RAISERROR('Warehouse ready only allowed at PENDING_DIGITISATION stage.',16,1); RETURN; END;
    UPDATE dbo.skus SET status='LIVE' WHERE header_id=@header_id;
    UPDATE dbo.purchase_headers SET
      pipeline_status = 'WAREHOUSE_READY',
      warehouse_at    = DATEADD(MINUTE, 330, SYSUTCDATETIME()),
      updated_at      = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE header_id = @header_id;
    -- Add stock (new SKU rows generated in this purchase)
    INSERT INTO dbo.stock_balances (sku_id, location_type, location_id, qty, last_updated)
    SELECT sk.sku_id, 'WAREHOUSE', 1, pic.quantity, DATEADD(MINUTE, 330, SYSUTCDATETIME())
    FROM dbo.skus sk
    JOIN dbo.purchase_item_colours pic ON sk.item_colour_id = pic.colour_id
    WHERE sk.header_id = @header_id
      AND NOT EXISTS (SELECT 1 FROM dbo.stock_balances sb WHERE sb.sku_id = sk.sku_id AND sb.location_type='WAREHOUSE');

    -- Add stock for generated restock events linked to existing SKUs.
    UPDATE sb
      SET sb.qty = sb.qty + pic.quantity,
          sb.last_updated = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    FROM dbo.stock_balances sb
    JOIN dbo.purchase_restock_events pre ON pre.linked_sku_id = sb.sku_id
    JOIN dbo.purchase_item_colours pic ON pic.colour_id = pre.item_colour_id
    WHERE pre.header_id = @header_id
      AND sb.location_type = 'WAREHOUSE';

    INSERT INTO dbo.stock_balances (sku_id, location_type, location_id, qty, last_updated)
    SELECT pre.linked_sku_id, 'WAREHOUSE', 1, pic.quantity, DATEADD(MINUTE, 330, SYSUTCDATETIME())
    FROM dbo.purchase_restock_events pre
    JOIN dbo.purchase_item_colours pic ON pic.colour_id = pre.item_colour_id
    WHERE pre.header_id = @header_id
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.stock_balances sb
        WHERE sb.sku_id = pre.linked_sku_id
          AND sb.location_type = 'WAREHOUSE'
      );

    SELECT header_id, pipeline_status, warehouse_at FROM dbo.purchase_headers WHERE header_id=@header_id;
  END TRY
  BEGIN CATCH DECLARE @e NVARCHAR(4000)=ERROR_MESSAGE(); RAISERROR(@e,16,1); END CATCH;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_Foundry_DashboardStatsV2
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_Foundry_DashboardStatsV2','P') IS NOT NULL DROP PROCEDURE dbo.sp_Foundry_DashboardStatsV2;
GO
CREATE PROCEDURE dbo.sp_Foundry_DashboardStatsV2
AS BEGIN
  SET NOCOUNT ON;
  SELECT
    COUNT(CASE WHEN pipeline_status NOT IN ('WAREHOUSE_READY','CANCELLED') THEN 1 END) AS active_purchases,
    COUNT(CASE WHEN pipeline_status = 'PENDING_BILL_VERIFICATION' THEN 1 END) AS pending_bill,
    COUNT(CASE WHEN pipeline_status IN ('PENDING_BRANDING','BRANDING_DISPATCHED') THEN 1 END) AS in_branding,
    COUNT(CASE WHEN pipeline_status = 'PENDING_DIGITISATION' THEN 1 END) AS in_digitisation,
    COUNT(CASE WHEN pipeline_status = 'WAREHOUSE_READY' THEN 1 END) AS warehouse_ready,
    COUNT(CASE WHEN pipeline_status = 'BILL_DISCREPANCY' THEN 1 END) AS bill_discrepancy
  FROM dbo.purchase_headers;
  SELECT COUNT(1) AS total_skus FROM dbo.skus WHERE status='LIVE';
  SELECT ISNULL(SUM(sb.qty),0) AS warehouse_stock FROM dbo.stock_balances sb WHERE sb.location_type='WAREHOUSE';
  SELECT COUNT(DISTINCT s.supplier_id) AS active_suppliers FROM dbo.suppliers s WHERE s.vendor_status='active';
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_Supplier_AutoCode  — generates next unique vendor code from vendor_name
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_Supplier_AutoCode','P') IS NOT NULL DROP PROCEDURE dbo.sp_Supplier_AutoCode;
GO
CREATE PROCEDURE dbo.sp_Supplier_AutoCode @vendor_name VARCHAR(200)
AS BEGIN
  SET NOCOUNT ON;
  -- Take first 4 alpha chars of name, uppercase
  DECLARE @base VARCHAR(4) = '';
  DECLARE @c CHAR(1), @i INT = 1;
  WHILE LEN(@base) < 4 AND @i <= LEN(@vendor_name)
  BEGIN
    SET @c = SUBSTRING(@vendor_name, @i, 1);
    IF @c LIKE '[A-Za-z]' SET @base = @base + UPPER(@c);
    SET @i = @i + 1;
  END;
  IF LEN(@base) < 3 SET @base = @base + REPLICATE('X', 4 - LEN(@base));

  DECLARE @seq INT = 1;
  DECLARE @code VARCHAR(20) = @base + '-' + RIGHT('000'+CAST(@seq AS VARCHAR),3);
  WHILE EXISTS (SELECT 1 FROM dbo.suppliers WHERE vendor_code = @code)
  BEGIN
    SET @seq = @seq + 1;
    SET @code = @base + '-' + RIGHT('000'+CAST(@seq AS VARCHAR),3);
  END;
  SELECT @code AS vendor_code;
END;
GO
