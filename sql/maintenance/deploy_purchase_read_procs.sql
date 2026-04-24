USE [CosmosERP];
GO

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

  -- RS1: items (includes product detail fields for digitisation + immutable brand lock contract)
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
  ORDER BY pi.item_id, pic.colour_id;
END;
GO

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
  ORDER BY item_id, item_colour_id;
END;
GO
