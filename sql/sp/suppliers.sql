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
    supplier_id, vendor_name, vendor_code,
    city, state, gstin,
    contact_person, contact_phone,
    payment_terms, credit_days,
    vendor_status,
    opening_balance,
    bank_name, bank_account_no, bank_ifsc, bank_account_holder,
    created_by, created_at, updated_at
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
    supplier_id, vendor_name, vendor_code,
    city, state, gstin,
    contact_person, contact_phone,
    payment_terms, credit_days,
    vendor_status,
    opening_balance,
    bank_name, bank_account_no, bank_ifsc, bank_account_holder,
    created_by, created_at, updated_at
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
  @credit_days           INT          = NULL,
  @opening_balance       DECIMAL(12,2) = 0,
  @bank_name             VARCHAR(100) = NULL,
  @bank_account_no       VARCHAR(50)  = NULL,
  @bank_ifsc             VARCHAR(20)  = NULL,
  @bank_account_holder   VARCHAR(200) = NULL,
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
      contact_person, contact_phone, payment_terms, credit_days,
      vendor_status,
      opening_balance, bank_name, bank_account_no, bank_ifsc, bank_account_holder,
      created_by
    )
    VALUES (
      @vendor_name, @vendor_code, @city, @state, @gstin,
      @contact_person, @contact_phone, @payment_terms, @credit_days,
      'active',
      ISNULL(@opening_balance, 0), @bank_name, @bank_account_no, @bank_ifsc, @bank_account_holder,
      @created_by
    );

    SELECT
      supplier_id, vendor_name, vendor_code, city, state,
      gstin, contact_person, contact_phone, payment_terms, credit_days,
      vendor_status,
      opening_balance, bank_name, bank_account_no, bank_ifsc, bank_account_holder,
      created_at
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
  @credit_days           INT          = NULL,
  @opening_balance       DECIMAL(12,2) = NULL,
  @bank_name             VARCHAR(100) = NULL,
  @bank_account_no       VARCHAR(50)  = NULL,
  @bank_ifsc             VARCHAR(20)  = NULL,
  @bank_account_holder   VARCHAR(200) = NULL
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
      credit_days           = @credit_days,
      opening_balance       = ISNULL(@opening_balance, opening_balance),
      bank_name             = @bank_name,
      bank_account_no       = @bank_account_no,
      bank_ifsc             = @bank_ifsc,
      bank_account_holder   = @bank_account_holder,
      updated_at            = GETDATE()
    WHERE supplier_id = @supplier_id;

    SELECT
      supplier_id, vendor_name, vendor_code, city, state,
      gstin, contact_person, contact_phone, payment_terms, credit_days,
      vendor_status,
      opening_balance, bank_name, bank_account_no, bank_ifsc, bank_account_holder,
      created_at, updated_at
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
    supplier_id, vendor_name, vendor_code, city, state
  FROM dbo.suppliers
  WHERE (vendor_name LIKE '%' + @search_term + '%'
      OR vendor_code LIKE '%' + @search_term + '%'
      OR city        LIKE '%' + @search_term + '%')
    AND vendor_status = 'active'
  ORDER BY vendor_name;
END;
GO

IF OBJECT_ID('dbo.sp_Supplier_AutoCode', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Supplier_AutoCode;
GO

CREATE PROCEDURE dbo.sp_Supplier_AutoCode
  @vendor_name VARCHAR(200)
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @base   VARCHAR(10);
  DECLARE @suffix INT = 1;
  DECLARE @code   VARCHAR(20);

  SET @base = UPPER(LEFT(REPLACE(@vendor_name, ' ', ''), 4));
  IF LEN(@base) < 2 SET @base = 'SUPP';

  SET @code = @base + '-001';

  WHILE EXISTS (SELECT 1 FROM dbo.suppliers WHERE vendor_code = @code)
  BEGIN
    SET @suffix = @suffix + 1;
    SET @code = @base + '-' + RIGHT('000' + CAST(@suffix AS VARCHAR(3)), 3);
  END;

  SELECT @code AS vendor_code;
END;
GO
