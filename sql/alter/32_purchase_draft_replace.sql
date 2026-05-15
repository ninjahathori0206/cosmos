USE [CosmosERP];
GO

-- Migration 32: sp_PurchaseHeader_ReplaceDraft (edit draft line items from New Purchase)
-- Canonical copy: sql/sp/pipeline_v2.sql

IF OBJECT_ID('dbo.sp_PurchaseHeader_ReplaceDraft','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_ReplaceDraft;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_ReplaceDraft
  @header_id      INT,
  @supplier_id    INT,
  @source_type    VARCHAR(50)   = NULL,
  @bill_ref       VARCHAR(100)  = NULL,
  @purchase_date  DATETIME,
  @transport_cost DECIMAL(10,2) = 0,
  @po_reference   VARCHAR(100)  = NULL,
  @notes          VARCHAR(500)  = NULL,
  @items_json     NVARCHAR(MAX)
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.purchase_headers WHERE header_id=@header_id AND pipeline_status='DRAFT')
    BEGIN RAISERROR('Only draft purchases can be replaced from the purchase form.',16,1); RETURN; END;

    IF NOT EXISTS (SELECT 1 FROM dbo.suppliers WHERE supplier_id = @supplier_id)
    BEGIN RAISERROR('Supplier not found.',16,1); RETURN; END;

    DECLARE @items TABLE (
      idx               INT,
      product_master_id INT,
      maker_master_id   INT,
      category          VARCHAR(50) NULL,
      purchase_rate     DECIMAL(10,2),
      quantity          INT,
      gst_pct           DECIMAL(5,2),
      base_value        DECIMAL(10,2),
      gst_amt           DECIMAL(10,2),
      item_total        DECIMAL(10,2)
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

    DELETE pic
    FROM dbo.purchase_item_colours pic
    INNER JOIN dbo.purchase_items pi ON pic.item_id = pi.item_id
    WHERE pi.header_id = @header_id;

    DELETE FROM dbo.purchase_items WHERE header_id = @header_id;

    UPDATE dbo.purchase_headers SET
      supplier_id        = @supplier_id,
      source_type        = @source_type,
      bill_ref           = @bill_ref,
      purchase_date      = @purchase_date,
      transport_cost     = ISNULL(@transport_cost, 0),
      po_reference       = @po_reference,
      notes              = @notes,
      expected_bill_amt  = @expected,
      updated_at         = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE header_id = @header_id;

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

      DECLARE @colours_json NVARCHAR(MAX);
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
