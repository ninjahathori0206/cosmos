USE [CosmosERP];
GO

-- Migration 57: SKU brand prefix uses home_brands.brand_code (e.g. BLNK → BLN);
-- branding bypass matches brand_code or brand_name.
-- Canonical: sql/sp/pipeline_v2.sql — also run: npm run migrate:57-sku-brand-code-prefix

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_PurchaseHeader_BrandingBypass — match home brand by code or name
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

    DECLARE @pm_id INT;
    DECLARE @src_brand VARCHAR(200);
    DECLARE @src_coll  VARCHAR(200);
    DECLARE @match_brand_id INT;
    DECLARE @raw_brand_name VARCHAR(200);
    DECLARE @slug VARCHAR(32);
    DECLARE @try_code VARCHAR(10);
    DECLARE @code_n INT;

    DECLARE @pm_work TABLE (product_id INT PRIMARY KEY);
    INSERT INTO @pm_work (product_id)
    SELECT DISTINCT pi.product_master_id
    FROM dbo.purchase_items pi
    WHERE pi.header_id = @header_id;

    WHILE EXISTS (SELECT 1 FROM @pm_work)
    BEGIN
      SELECT TOP (1) @pm_id = product_id FROM @pm_work ORDER BY product_id;
      DELETE FROM @pm_work WHERE product_id = @pm_id;

      SET @src_brand = NULL;
      SET @src_coll  = NULL;
      SELECT @src_brand = pm.source_brand, @src_coll = pm.source_collection
      FROM dbo.product_master pm
      WHERE pm.product_id = @pm_id;

      IF NULLIF(LTRIM(RTRIM(ISNULL(@src_coll, ''))), '') IS NOT NULL
      BEGIN
        UPDATE dbo.product_master
        SET ew_collection = @src_coll,
            updated_at    = DATEADD(MINUTE, 330, SYSUTCDATETIME())
        WHERE product_id = @pm_id;
      END;

      IF NULLIF(LTRIM(RTRIM(ISNULL(@src_brand, ''))), '') IS NOT NULL
      BEGIN
        SET @match_brand_id = NULL;
        SELECT TOP (1) @match_brand_id = hb.brand_id
        FROM dbo.home_brands hb
        WHERE LOWER(LTRIM(RTRIM(hb.brand_name))) = LOWER(LTRIM(RTRIM(@src_brand)))
           OR UPPER(LTRIM(RTRIM(hb.brand_code))) = UPPER(LTRIM(RTRIM(@src_brand)));

        IF @match_brand_id IS NULL
        BEGIN
          SET @raw_brand_name = LTRIM(RTRIM(@src_brand));
          SET @slug = @raw_brand_name;
          WHILE PATINDEX('%[^a-zA-Z0-9]%', @slug) > 0
            SET @slug = STUFF(@slug, PATINDEX('%[^a-zA-Z0-9]%', @slug), 1, '');
          IF NULLIF(LTRIM(RTRIM(ISNULL(@slug, ''))), '') IS NULL
            SET @slug = N'AUTO';
          SET @slug = UPPER(LEFT(@slug, 10));
          SET @try_code = LEFT(@slug, 10);
          SET @code_n = 0;
          WHILE EXISTS (SELECT 1 FROM dbo.home_brands WHERE brand_code = @try_code)
          BEGIN
            SET @code_n = @code_n + 1;
            SET @try_code = LEFT(@slug, 7) + RIGHT('000' + CAST(@code_n AS VARCHAR(3)), 3);
          END;
          INSERT INTO dbo.home_brands (brand_name, brand_code, brand_description, is_active, created_by, created_at, updated_at)
          VALUES (@raw_brand_name, @try_code, NULL, 1, NULL, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()));
          SET @match_brand_id = CAST(SCOPE_IDENTITY() AS INT);
        END;

        UPDATE dbo.product_master
        SET home_brand_id = @match_brand_id,
            updated_at    = DATEADD(MINUTE, 330, SYSUTCDATETIME())
        WHERE product_id = @pm_id;
      END;
    END;

    SELECT header_id, pipeline_status FROM dbo.purchase_headers WHERE header_id = @header_id;
  END TRY
  BEGIN CATCH DECLARE @e NVARCHAR(4000)=ERROR_MESSAGE(); RAISERROR(@e,16,1); END CATCH;
END;
GO
