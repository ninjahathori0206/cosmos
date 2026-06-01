-- ═══════════════════════════════════════════════════════════════════════════════
-- sp_SKU_UnitTraceByBarcode
-- Foundry Unit Search: resolve 7-digit unit barcode → custody, timeline, sale.
-- Returns three recordsets: unit (0–1 row), timeline, sale (0–1 row).
-- ═══════════════════════════════════════════════════════════════════════════════
USE [CosmosERP];
GO

CREATE OR ALTER PROCEDURE dbo.sp_SKU_UnitTraceByBarcode
  @unit_barcode VARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @code CHAR(7) = RIGHT(REPLICATE(N'0', 7) + LTRIM(RTRIM(ISNULL(@unit_barcode, N''))), 7);
  IF @code NOT LIKE N'[0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
  BEGIN
    RAISERROR(N'Invalid unit barcode. Expected 7 digits.', 16, 1);
    RETURN;
  END;

  DECLARE @unit_id INT = NULL;
  SELECT TOP 1 @unit_id = u.unit_id
  FROM dbo.sku_units u
  WHERE u.unit_barcode = @code;

  IF @unit_id IS NULL
  BEGIN
    SELECT TOP 0
      CAST(NULL AS INT) AS unit_id,
      CAST(NULL AS CHAR(7)) AS unit_barcode,
      CAST(NULL AS INT) AS unit_no,
      CAST(NULL AS INT) AS sku_id,
      CAST(NULL AS VARCHAR(20)) AS status,
      CAST(NULL AS VARCHAR(20)) AS location_type,
      CAST(NULL AS INT) AS location_id,
      CAST(NULL AS VARCHAR(200)) AS current_location_label,
      CAST(NULL AS VARCHAR(50)) AS sku_code,
      CAST(NULL AS VARCHAR(80)) AS pid,
      CAST(NULL AS VARCHAR(80)) AS batch_barcode,
      CAST(NULL AS DECIMAL(10,2)) AS sale_price,
      CAST(NULL AS VARCHAR(50)) AS product_type,
      CAST(NULL AS NVARCHAR(200)) AS brand_name,
      CAST(NULL AS NVARCHAR(200)) AS product_name,
      CAST(NULL AS NVARCHAR(100)) AS colour_name,
      CAST(NULL AS DATETIME2(0)) AS created_at,
      CAST(NULL AS DATETIME2(0)) AS sold_at,
      CAST(NULL AS INT) AS order_id,
      CAST(NULL AS INT) AS order_item_id,
      CAST(NULL AS INT) AS sold_store_id;

    SELECT TOP 0
      CAST(NULL AS DATETIME2(0)) AS event_at,
      CAST(NULL AS VARCHAR(40)) AS event_type,
      CAST(NULL AS NVARCHAR(200)) AS title,
      CAST(NULL AS NVARCHAR(500)) AS detail,
      CAST(NULL AS VARCHAR(30)) AS ref_type,
      CAST(NULL AS INT) AS ref_id;

    SELECT TOP 0
      CAST(NULL AS INT) AS order_id,
      CAST(NULL AS NVARCHAR(50)) AS order_no,
      CAST(NULL AS NVARCHAR(50)) AS invoice_no,
      CAST(NULL AS NVARCHAR(30)) AS order_status,
      CAST(NULL AS NVARCHAR(200)) AS store_name,
      CAST(NULL AS NVARCHAR(20)) AS store_code,
      CAST(NULL AS DATETIME2(0)) AS sold_at,
      CAST(NULL AS DECIMAL(12,2)) AS unit_price,
      CAST(NULL AS DECIMAL(12,2)) AS line_total,
      CAST(NULL AS DECIMAL(12,2)) AS order_total;
    RETURN;
  END;

  DECLARE @wh_display NVARCHAR(200) = LEFT(CAST(ISNULL(dbo.fn_Foundry_WarehouseDisplayName(), N'Primary warehouse') AS NVARCHAR(200)), 200);

  -- RS1: unit header
  SELECT TOP 1
    u.unit_id,
    u.unit_barcode,
    u.unit_no,
    u.sku_id,
    u.status,
    u.location_type,
    u.location_id,
    CASE
      WHEN u.status = N'CONSUMED' OR u.location_type = N'CONSUMED'
        THEN N'Delivered to customer'
      WHEN u.location_type = N'LAB'
        THEN N'At lab'
      WHEN u.status IN (N'IN_TRANSIT', N'RESERVED') AND open_xfer.doc_id IS NOT NULL
        THEN N'In transit to ' + open_xfer.dest_name
      WHEN u.location_type = N'IN_TRANSIT' AND open_xfer.doc_id IS NOT NULL
        THEN N'In transit to ' + open_xfer.dest_name
      WHEN u.location_type = N'STORE' AND cust_store.store_name IS NOT NULL
        THEN cust_store.store_name
      WHEN u.status = N'SOLD' AND sold_store.store_name IS NOT NULL
        THEN sold_store.store_name
      WHEN u.location_type = N'WAREHOUSE'
        THEN @wh_display
      ELSE COALESCE(cust_store.store_name, sold_store.store_name, @wh_display, N'Unknown location')
    END AS current_location_label,
    sk.sku_code,
    sk.barcode AS batch_barcode,
    sk.pid,
    sk.sale_price,
    pm.product_type,
    LTRIM(RTRIM(COALESCE(
      NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
      ''
    ))) AS brand_name,
    ISNULL(pm.ew_collection, N'') + N' · ' + ISNULL(pm.style_model, N'') AS product_name,
    pic.colour_name,
    u.created_at,
    u.sold_at,
    u.order_id,
    u.order_item_id,
    u.sold_store_id
  FROM dbo.sku_units u
  INNER JOIN dbo.skus sk ON sk.sku_id = u.sku_id
  INNER JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
  LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
  LEFT JOIN dbo.maker_master mm ON mm.maker_id = pm.maker_master_id
  LEFT JOIN dbo.purchase_item_colours pic ON pic.colour_id = sk.item_colour_id
  LEFT JOIN dbo.stores cust_store
    ON cust_store.store_id = u.location_id AND u.location_type = N'STORE'
  LEFT JOIN dbo.stores sold_store ON sold_store.store_id = u.sold_store_id
  OUTER APPLY (
    SELECT TOP 1
      d.doc_id,
      ISNULL(
        NULLIF(LTRIM(RTRIM(st.store_name)), N''),
        N'store #' + CAST(d.to_store_id AS VARCHAR(20))
      ) AS dest_name
    FROM dbo.stock_transfer_doc_units du
    INNER JOIN dbo.stock_transfer_docs d ON d.doc_id = du.doc_id
    LEFT JOIN dbo.stores st ON st.store_id = d.to_store_id
    WHERE du.unit_id = u.unit_id
      AND d.status IN (N'DISPATCHED', N'ACCEPTED')
    ORDER BY d.doc_id DESC
  ) open_xfer
  WHERE u.unit_id = @unit_id;

  -- RS2: timeline (ascending)
  ;WITH timeline AS (
    SELECT
      u.created_at AS event_at,
      N'CREATED' AS event_type,
      N'Unit created' AS title,
      @wh_display AS detail,
      N'unit' AS ref_type,
      u.unit_id AS ref_id
    FROM dbo.sku_units u
    WHERE u.unit_id = @unit_id

    UNION ALL

    SELECT
      d.dispatched_at,
      N'TRANSFER_DISPATCHED',
      N'Dispatched to store',
      N'Doc #' + CAST(d.doc_id AS NVARCHAR(20)) + N' → ' +
        ISNULL(NULLIF(LTRIM(RTRIM(st.store_name)), N''), N'store #' + CAST(d.to_store_id AS NVARCHAR(20))),
      N'transfer_doc',
      d.doc_id
    FROM dbo.stock_transfer_doc_units du
    INNER JOIN dbo.stock_transfer_docs d ON d.doc_id = du.doc_id
    LEFT JOIN dbo.stores st ON st.store_id = d.to_store_id
    WHERE du.unit_id = @unit_id
      AND d.dispatched_at IS NOT NULL

    UNION ALL

    SELECT
      d.accepted_at,
      N'TRANSFER_ACCEPTED',
      N'Received at store',
      N'Doc #' + CAST(d.doc_id AS NVARCHAR(20)) + N' · ' +
        ISNULL(NULLIF(LTRIM(RTRIM(st.store_name)), N''), N'store #' + CAST(d.to_store_id AS NVARCHAR(20))),
      N'transfer_doc',
      d.doc_id
    FROM dbo.stock_transfer_doc_units du
    INNER JOIN dbo.stock_transfer_docs d ON d.doc_id = du.doc_id
    LEFT JOIN dbo.stores st ON st.store_id = d.to_store_id
    WHERE du.unit_id = @unit_id
      AND d.accepted_at IS NOT NULL

    UNION ALL

    SELECT
      d.stocked_at,
      N'TRANSFER_STOCKED',
      N'Stocked at store',
      N'Doc #' + CAST(d.doc_id AS NVARCHAR(20)) + N' · ' +
        ISNULL(NULLIF(LTRIM(RTRIM(st.store_name)), N''), N'store #' + CAST(d.to_store_id AS NVARCHAR(20))),
      N'transfer_doc',
      d.doc_id
    FROM dbo.stock_transfer_doc_units du
    INNER JOIN dbo.stock_transfer_docs d ON d.doc_id = du.doc_id
    LEFT JOIN dbo.stores st ON st.store_id = d.to_store_id
    WHERE du.unit_id = @unit_id
      AND d.stocked_at IS NOT NULL

    UNION ALL

    SELECT
      u.sold_at,
      N'SALE_RECORDED',
      N'Sold at store',
      ISNULL(NULLIF(LTRIM(RTRIM(st.store_name)), N''), N'Store #' + CAST(u.sold_store_id AS NVARCHAR(20))),
      N'order',
      u.order_id
    FROM dbo.sku_units u
    LEFT JOIN dbo.stores st ON st.store_id = u.sold_store_id
    WHERE u.unit_id = @unit_id
      AND u.sold_at IS NOT NULL
      AND u.order_id IS NOT NULL
  )
  SELECT
    event_at,
    event_type,
    title,
    detail,
    ref_type,
    ref_id
  FROM timeline
  WHERE event_at IS NOT NULL
  ORDER BY event_at ASC, event_type ASC;

  -- RS3: sale summary
  SELECT TOP 1
    u.order_id,
    COALESCE(po.order_no, oe.order_no) AS order_no,
    inv.invoice_no,
    COALESCE(po.status, oe.status) AS order_status,
    COALESCE(sold_st.store_name, ord_st.store_name) AS store_name,
    COALESCE(sold_st.store_code, ord_st.store_code) AS store_code,
    u.sold_at,
    COALESCE(poi.unit_price, oei.unit_price) AS unit_price,
    COALESCE(poi.line_total, oei.line_total) AS line_total,
    COALESCE(po.total_amount, oe.total_amount) AS order_total
  FROM dbo.sku_units u
  LEFT JOIN dbo.stores sold_st ON sold_st.store_id = u.sold_store_id
  LEFT JOIN dbo.pos_orders po
    ON po.order_id = u.order_id
   AND OBJECT_ID(N'dbo.pos_orders', N'U') IS NOT NULL
  LEFT JOIN dbo.oe_orders oe
    ON oe.order_id = u.order_id
   AND OBJECT_ID(N'dbo.oe_orders', N'U') IS NOT NULL
  LEFT JOIN dbo.stores ord_st
    ON ord_st.store_id = COALESCE(po.store_id, oe.store_id)
  LEFT JOIN dbo.pos_order_items poi
    ON poi.order_item_id = u.order_item_id
   AND OBJECT_ID(N'dbo.pos_order_items', N'U') IS NOT NULL
  LEFT JOIN dbo.oe_order_items oei
    ON oei.order_item_id = u.order_item_id
   AND OBJECT_ID(N'dbo.oe_order_items', N'U') IS NOT NULL
  OUTER APPLY (
    SELECT TOP 1 pi.invoice_no
    FROM dbo.pos_invoices pi
    WHERE pi.order_id = u.order_id
    ORDER BY pi.invoice_no
  ) inv
  WHERE u.unit_id = @unit_id
    AND u.order_id IS NOT NULL;
END;
GO
