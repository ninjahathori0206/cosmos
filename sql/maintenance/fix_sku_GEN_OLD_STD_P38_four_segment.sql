-- ══════════════════════════════════════════════════════════════════════════════
-- One-off: remap legacy 3-segment SKU to current 4-segment format (same rules as
-- dbo.sp_SKUv2_Generate in sql/sp/pipeline_v2.sql).
--
-- Targets the row shown in digitisation UI:
--   sku_code = GEN-OLD-STD , pid/barcode = GEN-OLD-STD-P38  (header_id 38)
--
-- If your row differs, change @match_sku_code and @match_pid below.
-- Run: npm run maintenance:fix-sku-gen-old-std-p38
-- Or execute this file in SSMS against CosmosERP.
-- ══════════════════════════════════════════════════════════════════════════════
USE [CosmosERP];
GO

SET NOCOUNT ON;

DECLARE @match_sku_code VARCHAR(100) = N'GEN-OLD-STD';
DECLARE @match_pid      VARCHAR(120) = N'GEN-OLD-STD-P38';

DECLARE @sku_id INT;
SELECT @sku_id = sk.sku_id
FROM dbo.skus sk
WHERE sk.sku_code = @match_sku_code
  AND sk.pid = @match_pid;

IF @sku_id IS NULL
BEGIN
  RAISERROR('No row matched sku_code/pid. Nothing updated.', 16, 1);
  RETURN;
END;

DECLARE @header_id INT;
DECLARE @brand_name VARCHAR(200);
DECLARE @source_brand VARCHAR(200);
DECLARE @ew_collection VARCHAR(200);
DECLARE @source_model_number VARCHAR(200);
DECLARE @style_model VARCHAR(200);
DECLARE @colour_code VARCHAR(50);

SELECT
  @header_id           = sk.header_id,
  @brand_name         = hb.brand_name,
  @source_brand       = pm.source_brand,
  @ew_collection      = pm.ew_collection,
  @source_model_number = pm.source_model_number,
  @style_model        = pm.style_model,
  @colour_code        = pic.colour_code
FROM dbo.skus sk
INNER JOIN dbo.purchase_items pi
  ON pi.item_id = sk.item_id AND pi.header_id = sk.header_id
INNER JOIN dbo.purchase_item_colours pic
  ON pic.item_id = pi.item_id AND pic.colour_id = sk.item_colour_id
INNER JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
WHERE sk.sku_id = @sku_id;

IF @header_id IS NULL
BEGIN
  RAISERROR('Could not resolve purchase line / colour for this SKU.', 16, 1);
  RETURN;
END;

DECLARE @brandPfx VARCHAR(10) = UPPER(LEFT(COALESCE(@brand_name, @source_brand, 'GEN'), 3));
DECLARE @collPfx  VARCHAR(10) = UPPER(LEFT(REPLACE(ISNULL(@ew_collection, 'XX'), ' ', ''), 4));
DECLARE @modelSrc VARCHAR(200) = LTRIM(RTRIM(ISNULL(@source_model_number, '')));
IF @modelSrc = '' SET @modelSrc = LTRIM(RTRIM(ISNULL(@style_model, '')));
DECLARE @modelRaw VARCHAR(200) = NULLIF(@modelSrc, '');
DECLARE @modelPfx VARCHAR(12) = UPPER(LEFT(REPLACE(REPLACE(ISNULL(@modelRaw, ''), '-', ''), ' ', ''), 8));
IF NULLIF(LTRIM(RTRIM(ISNULL(@modelPfx, ''))), '') IS NULL
  SET @modelPfx = 'UNK';
DECLARE @colPfx VARCHAR(6) = UPPER(LEFT(REPLACE(ISNULL(@colour_code, '00'), ' ', ''), 3));

DECLARE @skuCode VARCHAR(100) = @brandPfx + '-' + @collPfx + '-' + @modelPfx + '-' + @colPfx;
DECLARE @pidBase VARCHAR(120) = @skuCode + '-P' + CAST(@header_id AS VARCHAR(20));
DECLARE @pid VARCHAR(120) = @pidBase;
DECLARE @pidSuffix INT = 1;
WHILE EXISTS (SELECT 1 FROM dbo.skus WHERE pid = @pid AND sku_id <> @sku_id)
BEGIN
  SET @pid = @pidBase + '-' + CAST(@pidSuffix AS VARCHAR(10));
  SET @pidSuffix = @pidSuffix + 1;
END;

DECLARE @barcode VARCHAR(100) = @pid;

UPDATE dbo.skus
SET
  sku_code   = @skuCode,
  pid        = @pid,
  barcode    = @barcode,
  updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
WHERE sku_id = @sku_id;

SELECT sku_id, sku_code, pid, barcode, header_id, item_id, item_colour_id
FROM dbo.skus
WHERE sku_id = @sku_id;
GO
