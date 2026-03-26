USE [CosmosERP];

PRINT 'Creating Supplier stored procedures...';

IF OBJECT_ID('dbo.sp_Supplier_GetAll', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Supplier_GetAll;
GO

CREATE PROCEDURE dbo.sp_Supplier_GetAll
  @status_filter VARCHAR(20) = NULL,
  @search_term   VARCHAR(200) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    supplier_id,
    vendor_name,
    vendor_code,
    city,
    state,
    gstin,
    contact_person,
    contact_phone,
    payment_terms,
    source_types_supplied,
    vendor_status,
    created_by,
    created_at,
    updated_at
  FROM dbo.suppliers
  WHERE (@status_filter IS NULL OR vendor_status = @status_filter)
    AND (
      @search_term IS NULL
      OR vendor_name LIKE '%' + @search_term + '%'
      OR vendor_code LIKE '%' + @search_term + '%'
      OR city LIKE '%' + @search_term + '%'
    )
  ORDER BY vendor_name;
END;
GO

IF OBJECT_ID('dbo.sp_Supplier_GetById', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Supplier_GetById;
GO

CREATE PROCEDURE dbo.sp_Supplier_GetById
  @supplier_id INT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    supplier_id,
    vendor_name,
    vendor_code,
    city,
    state,
    gstin,
    contact_person,
    contact_phone,
    payment_terms,
    source_types_supplied,
    vendor_status,
    created_by,
    created_at,
    updated_at
  FROM dbo.suppliers
  WHERE supplier_id = @supplier_id;
END;
GO

IF OBJECT_ID('dbo.sp_Supplier_Create', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Supplier_Create;
GO

CREATE PROCEDURE dbo.sp_Supplier_Create
  @vendor_name           VARCHAR(200),
  @vendor_code           VARCHAR(20),
  @city                  VARCHAR(100) = NULL,
  @state                 VARCHAR(100) = NULL,
  @gstin                 VARCHAR(20)  = NULL,
  @contact_person        VARCHAR(200) = NULL,
  @contact_phone         VARCHAR(20)  = NULL,
  @payment_terms         VARCHAR(200) = NULL,
  @source_types_supplied VARCHAR(200) = NULL,
  @created_by            INT          = NULL
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    IF EXISTS (SELECT 1 FROM dbo.suppliers WHERE vendor_code = @vendor_code)
    BEGIN
      RAISERROR('Vendor code already exists', 16, 1);
      RETURN;
    END;

    INSERT INTO dbo.suppliers (
      vendor_name, vendor_code, city, state, gstin,
      contact_person, contact_phone, payment_terms,
      source_types_supplied, vendor_status, created_by
    )
    VALUES (
      @vendor_name, @vendor_code, @city, @state, @gstin,
      @contact_person, @contact_phone, @payment_terms,
      @source_types_supplied, 'active', @created_by
    );

    SELECT
      supplier_id, vendor_name, vendor_code, city, state,
      gstin, contact_person, contact_phone, payment_terms,
      source_types_supplied, vendor_status, created_at
    FROM dbo.suppliers
    WHERE supplier_id = SCOPE_IDENTITY();
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_Supplier_Update', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Supplier_Update;
GO

CREATE PROCEDURE dbo.sp_Supplier_Update
  @supplier_id           INT,
  @vendor_name           VARCHAR(200),
  @city                  VARCHAR(100) = NULL,
  @state                 VARCHAR(100) = NULL,
  @gstin                 VARCHAR(20)  = NULL,
  @contact_person        VARCHAR(200) = NULL,
  @contact_phone         VARCHAR(20)  = NULL,
  @payment_terms         VARCHAR(200) = NULL,
  @source_types_supplied VARCHAR(200) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    UPDATE dbo.suppliers
    SET
      vendor_name           = @vendor_name,
      city                  = @city,
      state                 = @state,
      gstin                 = @gstin,
      contact_person        = @contact_person,
      contact_phone         = @contact_phone,
      payment_terms         = @payment_terms,
      source_types_supplied = @source_types_supplied,
      updated_at            = GETDATE()
    WHERE supplier_id = @supplier_id;

    SELECT
      supplier_id, vendor_name, vendor_code, city, state,
      gstin, contact_person, contact_phone, payment_terms,
      source_types_supplied, vendor_status, created_at, updated_at
    FROM dbo.suppliers
    WHERE supplier_id = @supplier_id;
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_Supplier_UpdateStatus', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Supplier_UpdateStatus;
GO

CREATE PROCEDURE dbo.sp_Supplier_UpdateStatus
  @supplier_id INT,
  @status      VARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE dbo.suppliers
  SET vendor_status = @status, updated_at = GETDATE()
  WHERE supplier_id = @supplier_id;

  SELECT
    supplier_id, vendor_name, vendor_code, vendor_status, updated_at
  FROM dbo.suppliers
  WHERE supplier_id = @supplier_id;
END;
GO

IF OBJECT_ID('dbo.sp_Supplier_Search', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Supplier_Search;
GO

CREATE PROCEDURE dbo.sp_Supplier_Search
  @search_term VARCHAR(200)
AS
BEGIN
  SET NOCOUNT ON;

  SELECT TOP 20
    supplier_id,
    vendor_name,
    vendor_code,
    city,
    state
  FROM dbo.suppliers
  WHERE (vendor_name LIKE '%' + @search_term + '%'
      OR vendor_code LIKE '%' + @search_term + '%'
      OR city        LIKE '%' + @search_term + '%')
    AND vendor_status = 'active'
  ORDER BY vendor_name;
END;
GO
