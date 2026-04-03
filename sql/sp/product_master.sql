USE [CosmosERP];

PRINT 'Creating Product Master stored procedures...';

IF OBJECT_ID('dbo.sp_ProductMaster_Create', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_ProductMaster_Create;
GO

CREATE PROCEDURE dbo.sp_ProductMaster_Create
  @source_type       VARCHAR(50)  = NULL,
  @maker_id          INT          = NULL,
  @maker_master_id   INT          = NULL,
  @source_brand      VARCHAR(200) = NULL,
  @home_brand_id     INT          = NULL,
  @source_collection VARCHAR(200) = NULL,
  @source_model_number VARCHAR(200) = NULL,
  @ew_collection     VARCHAR(200),
  @style_model       VARCHAR(200),
  @product_type      VARCHAR(50)  = 'FRAMES',
  @branding_required BIT          = 1,
  @created_by        INT          = NULL
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    INSERT INTO dbo.product_master (
      source_type, maker_id, maker_master_id, source_brand, home_brand_id,
      source_collection, source_model_number, ew_collection, style_model,
      product_type, branding_required, catalogue_status, created_by
    )
    VALUES (
      @source_type, @maker_id, @maker_master_id, @source_brand, @home_brand_id,
      @source_collection, @source_model_number, @ew_collection, @style_model,
      ISNULL(NULLIF(@product_type,''), 'FRAMES'), ISNULL(@branding_required, 1), 'ACTIVE', @created_by
    );

    DECLARE @new_id INT = SCOPE_IDENTITY();

    SELECT
      pm.product_id, pm.source_type, pm.maker_id, pm.maker_master_id, pm.source_brand,
      pm.home_brand_id, pm.source_collection, pm.ew_collection,
      pm.source_model_number, pm.style_model, pm.product_type, pm.branding_required,
      pm.catalogue_status, pm.created_at,
      s.vendor_name AS maker_name,
      mm.maker_name AS maker_master_name,
      hb.brand_name
    FROM dbo.product_master pm
    LEFT JOIN dbo.suppliers s ON pm.maker_id = s.supplier_id
    LEFT JOIN dbo.maker_master mm ON pm.maker_master_id = mm.maker_id
    LEFT JOIN dbo.home_brands hb ON pm.home_brand_id = hb.brand_id
    WHERE pm.product_id = @new_id;
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_ProductMaster_Update', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_ProductMaster_Update;
GO

CREATE PROCEDURE dbo.sp_ProductMaster_Update
  @product_id        INT,
  @source_type       VARCHAR(50)  = NULL,
  @maker_id          INT          = NULL,
  @maker_master_id   INT          = NULL,
  @source_brand      VARCHAR(200) = NULL,
  @home_brand_id     INT          = NULL,
  @source_collection VARCHAR(200) = NULL,
  @source_model_number VARCHAR(200) = NULL,
  @ew_collection     VARCHAR(200),
  @style_model       VARCHAR(200),
  @product_type      VARCHAR(50)  = 'FRAMES',
  @branding_required BIT          = 1,
  @catalogue_status  VARCHAR(30)  = 'ACTIVE'
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    UPDATE dbo.product_master
    SET
      source_type       = @source_type,
      maker_id          = @maker_id,
      maker_master_id   = @maker_master_id,
      source_brand      = @source_brand,
      home_brand_id     = @home_brand_id,
      source_collection = @source_collection,
      source_model_number = @source_model_number,
      ew_collection     = @ew_collection,
      style_model       = @style_model,
      product_type      = ISNULL(NULLIF(@product_type,''), 'FRAMES'),
      branding_required = ISNULL(@branding_required, 1),
      catalogue_status  = @catalogue_status,
      updated_at        = GETDATE()
    WHERE product_id = @product_id;

    SELECT
      pm.product_id, pm.source_type, pm.maker_id, pm.maker_master_id, pm.source_brand,
      pm.home_brand_id, pm.source_collection, pm.ew_collection,
      pm.source_model_number, pm.style_model, pm.product_type, pm.branding_required,
      pm.catalogue_status, pm.updated_at,
      s.vendor_name AS maker_name,
      mm.maker_name AS maker_master_name,
      hb.brand_name
    FROM dbo.product_master pm
    LEFT JOIN dbo.suppliers s ON pm.maker_id = s.supplier_id
    LEFT JOIN dbo.maker_master mm ON pm.maker_master_id = mm.maker_id
    LEFT JOIN dbo.home_brands hb ON pm.home_brand_id = hb.brand_id
    WHERE pm.product_id = @product_id;
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_ProductMaster_GetById', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_ProductMaster_GetById;
GO

CREATE PROCEDURE dbo.sp_ProductMaster_GetById
  @product_id INT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    pm.*,
    hb.brand_name,
    s.vendor_name AS maker_name
  FROM dbo.product_master pm
  LEFT JOIN dbo.home_brands hb ON pm.home_brand_id = hb.brand_id
  LEFT JOIN dbo.suppliers s ON pm.maker_id = s.supplier_id
  WHERE pm.product_id = @product_id;
END;
GO

IF OBJECT_ID('dbo.sp_ProductMaster_GetAll', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_ProductMaster_GetAll;
GO

CREATE PROCEDURE dbo.sp_ProductMaster_GetAll
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    pm.product_id,
    pm.source_type,
    pm.maker_id,
    pm.home_brand_id,
    pm.source_brand,
    pm.source_collection,
    pm.source_model_number,
    pm.ew_collection,
    pm.style_model,
    pm.product_type,
    pm.branding_required,
    pm.catalogue_status,
    pm.created_at,
    pm.updated_at,
    s.vendor_name AS maker_name,
    hb.brand_name
  FROM dbo.product_master pm
  LEFT JOIN dbo.suppliers s ON pm.maker_id = s.supplier_id
  LEFT JOIN dbo.home_brands hb ON pm.home_brand_id = hb.brand_id
  ORDER BY pm.created_at DESC;
END;
GO

IF OBJECT_ID('dbo.sp_ProductMaster_CheckRepeat', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_ProductMaster_CheckRepeat;
GO

CREATE PROCEDURE dbo.sp_ProductMaster_CheckRepeat
  @ew_collection VARCHAR(200) = NULL,
  @style_model   VARCHAR(200) = NULL,
  @home_brand_id INT          = NULL,
  @source_brand  VARCHAR(200) = NULL,
  @source_model_number VARCHAR(200) = NULL,
  @maker_master_id INT        = NULL
AS
BEGIN
  SET NOCOUNT ON;

  SELECT TOP 1
    pm.product_id,
    pm.ew_collection,
    pm.style_model,
    pm.source_model_number,
    pm.source_collection,
    pm.branding_required,
    s.vendor_name AS maker_name,
    hb.brand_name,
    (
      SELECT TOP 1 purchase_rate
      FROM dbo.purchases
      WHERE product_master_id = pm.product_id
      ORDER BY purchase_date DESC
    ) AS last_rate,
    (
      SELECT TOP 1 quantity
      FROM dbo.purchases
      WHERE product_master_id = pm.product_id
      ORDER BY purchase_date DESC
    ) AS last_qty,
    (
      SELECT TOP 1 purchase_date
      FROM dbo.purchases
      WHERE product_master_id = pm.product_id
      ORDER BY purchase_date DESC
    ) AS last_purchase_date,
    (
      SELECT COUNT(1)
      FROM dbo.purchases
      WHERE product_master_id = pm.product_id
    ) AS total_purchases
  FROM dbo.product_master pm
  LEFT JOIN dbo.suppliers s ON pm.maker_id = s.supplier_id
  LEFT JOIN dbo.home_brands hb ON pm.home_brand_id = hb.brand_id
  WHERE (
      @source_brand IS NOT NULL
      AND @source_model_number IS NOT NULL
      AND UPPER(LTRIM(RTRIM(ISNULL(pm.source_brand, '')))) = UPPER(LTRIM(RTRIM(@source_brand)))
      AND UPPER(LTRIM(RTRIM(ISNULL(pm.source_model_number, '')))) = UPPER(LTRIM(RTRIM(@source_model_number)))
      AND (@maker_master_id IS NULL OR pm.maker_master_id = @maker_master_id)
    )
    OR (
      @ew_collection IS NOT NULL
      AND @style_model IS NOT NULL
      AND pm.ew_collection = @ew_collection
      AND pm.style_model   = @style_model
      AND (
        (@home_brand_id IS NOT NULL AND pm.home_brand_id = @home_brand_id)
        OR (@source_brand IS NOT NULL AND pm.source_brand = @source_brand)
      )
    );
END;
GO

IF OBJECT_ID('dbo.sp_ProductMaster_SourceSuggestions', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_ProductMaster_SourceSuggestions;
GO

CREATE PROCEDURE dbo.sp_ProductMaster_SourceSuggestions
  @field_name          VARCHAR(40),
  @q                   VARCHAR(200) = NULL,
  @maker_master_id     INT          = NULL,
  @source_brand        VARCHAR(200) = NULL,
  @source_collection   VARCHAR(200) = NULL,
  @top_n               INT          = 20
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @lim INT = CASE WHEN ISNULL(@top_n, 0) BETWEEN 1 AND 100 THEN @top_n ELSE 20 END;

  -- Manufacturer -> brands: only rows for this maker_master_id
  IF @field_name = 'source_brand'
  BEGIN
    IF @maker_master_id IS NULL
    BEGIN
      SELECT TOP 0 CAST(NULL AS VARCHAR(200)) AS suggestion;
      RETURN;
    END

    SELECT DISTINCT TOP (@lim)
      pm.source_brand AS suggestion
    FROM dbo.product_master pm
    WHERE ISNULL(pm.source_brand, '') <> ''
      AND pm.maker_master_id = @maker_master_id
      AND (ISNULL(@q, '') = '' OR pm.source_brand LIKE '%' + @q + '%')
    ORDER BY pm.source_brand;
    RETURN;
  END

  -- Brand -> collections: scoped to maker + source brand
  IF @field_name = 'source_collection'
  BEGIN
    IF @maker_master_id IS NULL OR ISNULL(LTRIM(RTRIM(@source_brand)), '') = ''
    BEGIN
      SELECT TOP 0 CAST(NULL AS VARCHAR(200)) AS suggestion;
      RETURN;
    END

    SELECT DISTINCT TOP (@lim)
      pm.source_collection AS suggestion
    FROM dbo.product_master pm
    WHERE ISNULL(pm.source_collection, '') <> ''
      AND pm.maker_master_id = @maker_master_id
      AND UPPER(LTRIM(RTRIM(pm.source_brand))) = UPPER(LTRIM(RTRIM(@source_brand)))
      AND (ISNULL(@q, '') = '' OR pm.source_collection LIKE '%' + @q + '%')
    ORDER BY pm.source_collection;
    RETURN;
  END

  -- Collection -> model numbers: scoped to maker + brand; optional collection filter
  IF @field_name = 'source_model_number'
  BEGIN
    IF @maker_master_id IS NULL OR ISNULL(LTRIM(RTRIM(@source_brand)), '') = ''
    BEGIN
      SELECT TOP 0 CAST(NULL AS VARCHAR(200)) AS suggestion;
      RETURN;
    END

    SELECT DISTINCT TOP (@lim)
      pm.source_model_number AS suggestion
    FROM dbo.product_master pm
    WHERE ISNULL(pm.source_model_number, '') <> ''
      AND pm.maker_master_id = @maker_master_id
      AND UPPER(LTRIM(RTRIM(pm.source_brand))) = UPPER(LTRIM(RTRIM(@source_brand)))
      AND (
        ISNULL(LTRIM(RTRIM(@source_collection)), '') = ''
        OR UPPER(LTRIM(RTRIM(ISNULL(pm.source_collection, '')))) = UPPER(LTRIM(RTRIM(@source_collection)))
      )
      AND (ISNULL(@q, '') = '' OR pm.source_model_number LIKE '%' + @q + '%')
    ORDER BY pm.source_model_number;
    RETURN;
  END

  SELECT TOP 0 CAST(NULL AS VARCHAR(200)) AS suggestion;
END;
GO
