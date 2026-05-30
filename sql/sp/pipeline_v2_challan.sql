-- Pipeline v2 — challan flow patches (run after migration 35)
USE [CosmosERP];
GO

IF OBJECT_ID('dbo.sp_PurchaseHeader_VerifyBill','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_VerifyBill;
GO

IF OBJECT_ID('dbo.sp_PurchaseHeader_Create','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_Create;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_Create
  @supplier_id      INT,
  @source_type      VARCHAR(50)   = NULL,
  @challan_number   VARCHAR(100)  = NULL,
  @challan_date     DATETIME      = NULL,
  @purchase_date    DATETIME,
  @po_reference     VARCHAR(100)  = NULL,
  @notes            VARCHAR(500)  = NULL,
  @created_by       INT           = NULL,
  @items_json       NVARCHAR(MAX),
  @save_as_draft    BIT           = 0
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.suppliers WHERE supplier_id = @supplier_id)
    BEGIN RAISERROR('Supplier not found.',16,1); RETURN; END;

    IF @save_as_draft = 0 AND (NULLIF(LTRIM(RTRIM(@challan_number)),'') IS NULL OR @challan_date IS NULL)
    BEGIN RAISERROR('Challan number and challan date are required when submitting.',16,1); RETURN; END;

    DECLARE @items TABLE (
      idx INT, product_master_id INT, maker_master_id INT,
      category VARCHAR(50) NULL, quantity INT
    );

    INSERT INTO @items (idx, product_master_id, maker_master_id, category, quantity)
    SELECT
      ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1,
      CAST(j.[product_master_id] AS INT),
      TRY_CAST(j.[maker_master_id] AS INT),
      NULLIF(LTRIM(RTRIM(j.[category])), ''),
      CAST(j.[quantity] AS INT)
    FROM OPENJSON(@items_json) WITH (
      product_master_id INT         '$.product_master_id',
      maker_master_id   INT         '$.maker_master_id',
      category          VARCHAR(50) '$.category',
      quantity          INT         '$.quantity'
    ) j;

    DECLARE @needs_branding BIT = 0;
    IF @save_as_draft = 0 AND EXISTS (
      SELECT 1 FROM @items it
      JOIN dbo.product_master pm ON pm.product_id = it.product_master_id
      WHERE pm.branding_required = 1
    ) SET @needs_branding = 1;

    DECLARE @bill_st VARCHAR(50) = CASE WHEN @save_as_draft = 1 THEN 'DRAFT' ELSE 'CHALLAN_SUBMITTED' END;
    DECLARE @pipe_st VARCHAR(50) = CASE
      WHEN @save_as_draft = 1 THEN 'DRAFT'
      WHEN @needs_branding = 1 THEN 'PENDING_BRANDING'
      ELSE 'PENDING_DIGITISATION' END;

    INSERT INTO dbo.purchase_headers (
      supplier_id, source_type, challan_number, challan_date, purchase_date,
      po_reference, notes, bill_status, pipeline_status, created_by, created_at, updated_at
    ) VALUES (
      @supplier_id, @source_type, NULLIF(LTRIM(RTRIM(@challan_number)),''), @challan_date, @purchase_date,
      @po_reference, @notes, @bill_st, @pipe_st, @created_by,
      DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME())
    );
    DECLARE @header_id INT = SCOPE_IDENTITY();

    DECLARE @idx INT = 0, @max_idx INT = (SELECT MAX(idx) FROM @items);
    WHILE @idx <= @max_idx
    BEGIN
      DECLARE @pmid INT, @mmid INT, @cat VARCHAR(50), @qty INT;
      SELECT @pmid=product_master_id, @mmid=maker_master_id, @cat=category, @qty=quantity FROM @items WHERE idx=@idx;

      INSERT INTO dbo.purchase_items (header_id, product_master_id, maker_master_id, category, quantity)
      VALUES (@header_id, @pmid, @mmid, @cat, @qty);
      DECLARE @item_id INT = SCOPE_IDENTITY();

      DECLARE @colours_json NVARCHAR(MAX);
      SELECT @colours_json = JSON_QUERY(value,'$.colours')
      FROM OPENJSON(@items_json) AS ij
      WHERE CAST(JSON_VALUE(ij.value,'$.product_master_id') AS INT) = @pmid
        AND (SELECT COUNT(*) FROM @items it2 WHERE it2.idx < @idx AND it2.product_master_id = @pmid) = 0;

      IF @colours_json IS NOT NULL
      BEGIN
        INSERT INTO dbo.purchase_item_colours (item_id, colour_name, colour_code, quantity, reading_power)
        SELECT @item_id, colour_name, colour_code, qty, NULLIF(LTRIM(RTRIM(reading_power)), '')
        FROM OPENJSON(@colours_json) WITH (
          colour_name VARCHAR(100) '$.colour_name',
          colour_code VARCHAR(20)  '$.colour_code',
          qty         INT          '$.quantity',
          reading_power VARCHAR(10) '$.reading_power'
        );
      END;

      IF @mmid IS NOT NULL
        UPDATE dbo.product_master SET maker_master_id = @mmid, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
        WHERE product_id = @pmid AND maker_master_id IS NULL;

      SET @idx = @idx + 1;
    END;

    SELECT h.*, s.vendor_name AS supplier_name
    FROM dbo.purchase_headers h
    LEFT JOIN dbo.suppliers s ON h.supplier_id = s.supplier_id
    WHERE h.header_id = @header_id;

    SELECT pi.*, pm.ew_collection, pm.style_model, pm.source_type, pm.branding_required,
           pm.source_brand, pm.source_collection, pm.home_brand_id,
           LTRIM(RTRIM(COALESCE(
             NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
             NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
             NULLIF(LTRIM(RTRIM(ISNULL(mk.maker_name, ''))), ''),
             ''
           ))) AS brand_name, mk.maker_name
    FROM dbo.purchase_items pi
    LEFT JOIN dbo.product_master pm ON pi.product_master_id = pm.product_id
    LEFT JOIN dbo.home_brands hb ON pm.home_brand_id = hb.brand_id
    LEFT JOIN dbo.maker_master mk ON pi.maker_master_id = mk.maker_id
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

IF OBJECT_ID('dbo.sp_PurchaseHeader_GetAll','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_GetAll;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_GetAll
  @pipeline_status VARCHAR(50)  = NULL,
  @search_term     VARCHAR(200) = NULL
AS BEGIN
  SET NOCOUNT ON;
  SELECT
    h.header_id, h.supplier_id, h.challan_number, h.challan_date, h.purchase_date,
    h.po_reference, h.notes, h.challan_payable_total, h.finance_transport_amt,
    h.payable_set_at, h.bill_status, h.pipeline_status, h.created_at, h.updated_at,
    s.vendor_name AS supplier_name,
    (SELECT COUNT(*) FROM dbo.purchase_items pi WHERE pi.header_id = h.header_id) AS item_count,
    (SELECT SUM(pi.quantity) FROM dbo.purchase_items pi WHERE pi.header_id = h.header_id) AS total_qty,
    DATEDIFF(day, h.created_at, DATEADD(MINUTE, 330, SYSUTCDATETIME())) AS days_open,
    ISNULL(inv.invoiced_amt, 0) AS invoiced_amt,
    CASE WHEN h.challan_payable_total IS NOT NULL
      THEN h.challan_payable_total - ISNULL(inv.invoiced_amt, 0) ELSE NULL END AS open_payable
  FROM dbo.purchase_headers h
  LEFT JOIN dbo.suppliers s ON h.supplier_id = s.supplier_id
  LEFT JOIN (
    SELECT header_id, SUM(allocated_amt) AS invoiced_amt
    FROM dbo.invoice_challan_allocations
    GROUP BY header_id
  ) inv ON inv.header_id = h.header_id
  WHERE (@pipeline_status IS NULL OR h.pipeline_status = @pipeline_status)
    AND (@search_term IS NULL
         OR s.vendor_name LIKE '%'+@search_term+'%'
         OR h.challan_number LIKE '%'+@search_term+'%'
         OR h.po_reference LIKE '%'+@search_term+'%'
         OR EXISTS (
           SELECT 1 FROM dbo.purchase_items pi
           JOIN dbo.product_master pm ON pi.product_master_id = pm.product_id
           WHERE pi.header_id = h.header_id
             AND (pm.ew_collection LIKE '%'+@search_term+'%' OR pm.style_model LIKE '%'+@search_term+'%'
                  OR pm.source_brand LIKE '%'+@search_term+'%')
         ))
  ORDER BY h.created_at DESC;
END;
GO

IF OBJECT_ID('dbo.sp_PurchaseHeader_Update','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_Update;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_Update
  @header_id       INT,
  @supplier_id     INT           = NULL,
  @source_type     VARCHAR(50)   = NULL,
  @challan_number  VARCHAR(100)  = NULL,
  @challan_date    DATETIME      = NULL,
  @purchase_date   DATETIME      = NULL,
  @po_reference    VARCHAR(100)  = NULL,
  @notes           VARCHAR(500)  = NULL
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.purchase_headers WHERE header_id=@header_id AND pipeline_status='DRAFT')
    BEGIN RAISERROR('Header can only be edited while in draft.',16,1); RETURN; END;
    UPDATE dbo.purchase_headers SET
      supplier_id    = ISNULL(@supplier_id, supplier_id),
      source_type    = ISNULL(@source_type, source_type),
      challan_number = ISNULL(NULLIF(LTRIM(RTRIM(@challan_number)),''), challan_number),
      challan_date   = ISNULL(@challan_date, challan_date),
      purchase_date  = ISNULL(@purchase_date, purchase_date),
      po_reference   = ISNULL(@po_reference, po_reference),
      notes          = ISNULL(@notes, notes),
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
  @header_id      INT,
  @challan_number VARCHAR(100),
  @challan_date   DATETIME
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.purchase_headers WHERE header_id=@header_id AND pipeline_status='DRAFT')
    BEGIN RAISERROR('Only draft purchases can be submitted as challan.',16,1); RETURN; END;
    IF NULLIF(LTRIM(RTRIM(@challan_number)),'') IS NULL OR @challan_date IS NULL
    BEGIN RAISERROR('Challan number and challan date are required.',16,1); RETURN; END;

    DECLARE @needs_branding BIT = 0;
    IF EXISTS (
      SELECT 1 FROM dbo.purchase_items pi
      JOIN dbo.product_master pm ON pi.product_master_id = pm.product_id
      WHERE pi.header_id = @header_id AND pm.branding_required = 1
    ) SET @needs_branding = 1;

    DECLARE @pipe_st VARCHAR(50) = CASE WHEN @needs_branding = 1 THEN 'PENDING_BRANDING' ELSE 'PENDING_DIGITISATION' END;

    UPDATE dbo.purchase_headers SET
      challan_number  = LTRIM(RTRIM(@challan_number)),
      challan_date    = @challan_date,
      bill_status     = 'CHALLAN_SUBMITTED',
      pipeline_status = @pipe_st,
      updated_at      = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE header_id = @header_id;

    SELECT header_id, pipeline_status, bill_status, challan_number, challan_date
    FROM dbo.purchase_headers WHERE header_id = @header_id;
  END TRY
  BEGIN CATCH DECLARE @e NVARCHAR(4000)=ERROR_MESSAGE(); RAISERROR(@e,16,1); END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_PurchaseHeader_ReplaceDraft','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_ReplaceDraft;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_ReplaceDraft
  @header_id       INT,
  @supplier_id     INT,
  @source_type     VARCHAR(50)   = NULL,
  @challan_number  VARCHAR(100)  = NULL,
  @challan_date    DATETIME      = NULL,
  @purchase_date   DATETIME,
  @po_reference    VARCHAR(100)  = NULL,
  @notes           VARCHAR(500)  = NULL,
  @items_json      NVARCHAR(MAX)
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.purchase_headers WHERE header_id=@header_id AND pipeline_status='DRAFT')
    BEGIN RAISERROR('Only draft purchases can be replaced from the purchase form.',16,1); RETURN; END;
    IF NOT EXISTS (SELECT 1 FROM dbo.suppliers WHERE supplier_id = @supplier_id)
    BEGIN RAISERROR('Supplier not found.',16,1); RETURN; END;

    DECLARE @items TABLE (
      idx INT, product_master_id INT, maker_master_id INT,
      category VARCHAR(50) NULL, quantity INT
    );
    INSERT INTO @items (idx, product_master_id, maker_master_id, category, quantity)
    SELECT ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1,
      CAST(j.[product_master_id] AS INT), TRY_CAST(j.[maker_master_id] AS INT),
      NULLIF(LTRIM(RTRIM(j.[category])), ''), CAST(j.[quantity] AS INT)
    FROM OPENJSON(@items_json) WITH (
      product_master_id INT '$.product_master_id', maker_master_id INT '$.maker_master_id',
      category VARCHAR(50) '$.category', quantity INT '$.quantity'
    ) j;

    DELETE pic FROM dbo.purchase_item_colours pic
    INNER JOIN dbo.purchase_items pi ON pic.item_id = pi.item_id WHERE pi.header_id = @header_id;
    DELETE FROM dbo.purchase_items WHERE header_id = @header_id;

    UPDATE dbo.purchase_headers SET
      supplier_id = @supplier_id, source_type = @source_type,
      challan_number = NULLIF(LTRIM(RTRIM(@challan_number)), ''),
      challan_date = @challan_date, purchase_date = @purchase_date,
      po_reference = @po_reference, notes = @notes,
      updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE header_id = @header_id;

    DECLARE @idx INT = 0, @max_idx INT = (SELECT MAX(idx) FROM @items);
    WHILE @idx <= @max_idx
    BEGIN
      DECLARE @pmid INT, @mmid INT, @cat VARCHAR(50), @qty INT;
      SELECT @pmid=product_master_id, @mmid=maker_master_id, @cat=category, @qty=quantity FROM @items WHERE idx=@idx;
      INSERT INTO dbo.purchase_items (header_id, product_master_id, maker_master_id, category, quantity)
      VALUES (@header_id, @pmid, @mmid, @cat, @qty);
      DECLARE @item_id INT = SCOPE_IDENTITY();
      DECLARE @colours_json NVARCHAR(MAX);
      SELECT @colours_json = JSON_QUERY(value,'$.colours') FROM OPENJSON(@items_json) AS ij
      WHERE CAST(JSON_VALUE(ij.value,'$.product_master_id') AS INT) = @pmid
        AND (SELECT COUNT(*) FROM @items it2 WHERE it2.idx < @idx AND it2.product_master_id = @pmid) = 0;
      IF @colours_json IS NOT NULL
      BEGIN
        INSERT INTO dbo.purchase_item_colours (item_id, colour_name, colour_code, quantity, reading_power)
        SELECT @item_id, colour_name, colour_code, qty, NULLIF(LTRIM(RTRIM(reading_power)), '')
        FROM OPENJSON(@colours_json) WITH (
          colour_name VARCHAR(100) '$.colour_name',
          colour_code VARCHAR(20)  '$.colour_code',
          qty         INT          '$.quantity',
          reading_power VARCHAR(10) '$.reading_power'
        );
      END;
      IF @mmid IS NOT NULL
        UPDATE dbo.product_master SET maker_master_id = @mmid, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
        WHERE product_id = @pmid AND maker_master_id IS NULL;
      SET @idx = @idx + 1;
    END;

    SELECT h.*, s.vendor_name AS supplier_name FROM dbo.purchase_headers h
    LEFT JOIN dbo.suppliers s ON h.supplier_id = s.supplier_id WHERE h.header_id = @header_id;
    SELECT pi.*, pm.ew_collection, pm.style_model, pm.source_type, pm.branding_required,
           pm.source_brand, pm.source_collection, pm.home_brand_id,
           LTRIM(RTRIM(COALESCE(
             NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
             NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
             NULLIF(LTRIM(RTRIM(ISNULL(mk.maker_name, ''))), ''),
             ''
           ))) AS brand_name, mk.maker_name
    FROM dbo.purchase_items pi
    LEFT JOIN dbo.product_master pm ON pi.product_master_id = pm.product_id
    LEFT JOIN dbo.home_brands hb ON pm.home_brand_id = hb.brand_id
    LEFT JOIN dbo.maker_master mk ON pi.maker_master_id = mk.maker_id
    WHERE pi.header_id = @header_id;
    SELECT pic.*, pi.header_id FROM dbo.purchase_item_colours pic
    JOIN dbo.purchase_items pi ON pic.item_id = pi.item_id WHERE pi.header_id = @header_id;
  END TRY
  BEGIN CATCH DECLARE @err NVARCHAR(4000)=ERROR_MESSAGE(); RAISERROR(@err,16,1); END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_PurchaseHeader_RevertToDraft','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_RevertToDraft;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_RevertToDraft
  @header_id INT
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF EXISTS (SELECT 1 FROM dbo.purchase_headers WHERE header_id=@header_id AND payable_set_at IS NOT NULL)
    BEGIN RAISERROR('Cannot revert after Finance has valued this challan.',16,1); RETURN; END;
    IF EXISTS (SELECT 1 FROM dbo.invoice_challan_allocations WHERE header_id=@header_id)
    BEGIN RAISERROR('Cannot revert after invoice allocation.',16,1); RETURN; END;
    IF NOT EXISTS (
      SELECT 1 FROM dbo.purchase_headers
      WHERE header_id=@header_id AND pipeline_status IN ('PENDING_BRANDING','PENDING_DIGITISATION','CHALLAN_SUBMITTED')
    )
    BEGIN RAISERROR('Revert to draft is only allowed before branding/digitisation progress.',16,1); RETURN; END;

    UPDATE dbo.purchase_headers SET
      pipeline_status = 'DRAFT', bill_status = 'DRAFT',
      challan_number = NULL, challan_date = NULL,
      updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
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
    COUNT(CASE WHEN pipeline_status = 'DRAFT' THEN 1 END) AS purchase_drafts,
    COUNT(CASE WHEN bill_status = 'CHALLAN_SUBMITTED' AND payable_set_at IS NULL THEN 1 END) AS pending_valuation,
    COUNT(CASE WHEN pipeline_status IN ('PENDING_BRANDING','BRANDING_DISPATCHED') THEN 1 END) AS in_branding,
    COUNT(CASE WHEN pipeline_status = 'PENDING_DIGITISATION' THEN 1 END) AS in_digitisation,
    COUNT(CASE WHEN pipeline_status = 'WAREHOUSE_READY' THEN 1 END) AS warehouse_ready,
    COUNT(CASE WHEN bill_status IN ('PARTIALLY_INVOICED') THEN 1 END) AS partially_invoiced
  FROM dbo.purchase_headers;
  SELECT COUNT(1) AS total_skus FROM dbo.skus WHERE status='LIVE';
  SELECT ISNULL(SUM(sb.qty),0) AS warehouse_stock FROM dbo.stock_balances sb
  WHERE sb.location_type='WAREHOUSE' AND sb.location_id = dbo.fn_Foundry_PrimaryWarehouseLocationId();
  SELECT COUNT(DISTINCT s.supplier_id) AS active_suppliers FROM dbo.suppliers s WHERE s.vendor_status='active';
END;
GO
