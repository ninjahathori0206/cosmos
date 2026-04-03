PRINT 'Creating Foundry core tables...';

USE [CosmosERP];

IF OBJECT_ID('dbo.suppliers', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.suppliers (
    supplier_id        INT IDENTITY(1,1) PRIMARY KEY,
    vendor_name        VARCHAR(200) NOT NULL,
    vendor_code        VARCHAR(20) NOT NULL,
    city               VARCHAR(100) NULL,
    state              VARCHAR(100) NULL,
    gstin              VARCHAR(20) NULL,
    contact_person     VARCHAR(200) NULL,
    contact_phone      VARCHAR(20) NULL,
    payment_terms      VARCHAR(200) NULL,
    vendor_status      VARCHAR(20) NOT NULL DEFAULT 'active',
    created_by         INT NULL,
    created_at         DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at         DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_suppliers_created_by
      FOREIGN KEY (created_by) REFERENCES dbo.users(user_id)
  );
END;

IF OBJECT_ID('dbo.product_master', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.product_master (
    product_id        INT IDENTITY(1,1) PRIMARY KEY,
    source_type       VARCHAR(30) NOT NULL,
    maker_id          INT NULL,
    source_brand      VARCHAR(200) NULL,
    home_brand_id     INT NULL,
    source_collection VARCHAR(200) NULL,
    source_model_number VARCHAR(200) NULL,
    ew_collection     VARCHAR(200) NOT NULL,
    style_model       VARCHAR(200) NOT NULL,
    product_type      VARCHAR(50) NOT NULL,
    branding_required BIT NOT NULL DEFAULT 1,
    catalogue_status  VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_by        INT NULL,
    created_at        DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at        DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_product_master_maker
      FOREIGN KEY (maker_id) REFERENCES dbo.suppliers(supplier_id),
    CONSTRAINT FK_product_master_home_brand
      FOREIGN KEY (home_brand_id) REFERENCES dbo.home_brands(brand_id),
    CONSTRAINT FK_product_master_created_by
      FOREIGN KEY (created_by) REFERENCES dbo.users(user_id)
  );
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_product_master_source_brand_model'
    AND object_id = OBJECT_ID('dbo.product_master')
)
BEGIN
  CREATE INDEX IX_product_master_source_brand_model
    ON dbo.product_master(source_brand, source_model_number);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_product_master_source_brand_collection'
    AND object_id = OBJECT_ID('dbo.product_master')
)
BEGIN
  CREATE INDEX IX_product_master_source_brand_collection
    ON dbo.product_master(source_brand, source_collection);
END;

IF OBJECT_ID('dbo.purchases', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.purchases (
    purchase_id        INT IDENTITY(1,1) PRIMARY KEY,
    product_master_id  INT NOT NULL,
    purchase_date      DATETIME NOT NULL DEFAULT GETDATE(),
    purchase_rate      DECIMAL(10,2) NOT NULL,
    quantity           INT NOT NULL,
    transport_cost     DECIMAL(10,2) NOT NULL DEFAULT 0,
    gst_pct            DECIMAL(5,2) NOT NULL,
    expected_bill_amt  DECIMAL(10,2) NOT NULL,
    actual_bill_amt    DECIMAL(10,2) NULL,
    bill_number        VARCHAR(100) NULL,
    bill_date          DATETIME NULL,
    bill_photo_url     VARCHAR(500) NULL,
    bill_status        VARCHAR(30) NOT NULL DEFAULT 'PENDING_BILL_VERIFICATION',
    pipeline_status    VARCHAR(50) NOT NULL DEFAULT 'PENDING_BILL_VERIFICATION',
    po_reference       VARCHAR(100) NULL,
    notes              VARCHAR(500) NULL,
    discrepancy_note   VARCHAR(500) NULL,
    store_id           INT NULL,
    created_by         INT NULL,
    created_at         DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at         DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_purchases_product_master
      FOREIGN KEY (product_master_id) REFERENCES dbo.product_master(product_id),
    CONSTRAINT FK_purchases_store
      FOREIGN KEY (store_id) REFERENCES dbo.stores(store_id),
    CONSTRAINT FK_purchases_created_by
      FOREIGN KEY (created_by) REFERENCES dbo.users(user_id)
  );
END;

IF OBJECT_ID('dbo.purchase_colours', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.purchase_colours (
    colour_id    INT IDENTITY(1,1) PRIMARY KEY,
    purchase_id  INT NOT NULL,
    colour_name  VARCHAR(100) NOT NULL,
    colour_code  VARCHAR(20) NOT NULL,
    quantity     INT NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_purchase_colours_purchase
      FOREIGN KEY (purchase_id) REFERENCES dbo.purchases(purchase_id)
  );
END;

IF OBJECT_ID('dbo.branding_jobs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.branding_jobs (
    branding_job_id       INT IDENTITY(1,1) PRIMARY KEY,
    purchase_id           INT NOT NULL,
    dispatch_date         DATETIME NULL,
    expected_return_date  DATETIME NULL,
    actual_return_date    DATETIME NULL,
    branding_instructions VARCHAR(500) NULL,
    label_spec_url        VARCHAR(500) NULL,
    status                VARCHAR(30) NOT NULL DEFAULT 'PENDING_DISPATCH',
    bypass_reason         VARCHAR(500) NULL,
    is_bypassed           BIT NOT NULL DEFAULT 0,
    created_by            INT NULL,
    created_at            DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at            DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_branding_jobs_purchase
      FOREIGN KEY (purchase_id) REFERENCES dbo.purchases(purchase_id),
    CONSTRAINT FK_branding_jobs_created_by
      FOREIGN KEY (created_by) REFERENCES dbo.users(user_id)
  );
END;

IF OBJECT_ID('dbo.branding_job_colours', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.branding_job_colours (
    branding_colour_id INT IDENTITY(1,1) PRIMARY KEY,
    branding_job_id    INT NOT NULL,
    colour_id          INT NOT NULL,
    colour_code        VARCHAR(20) NOT NULL,
    qty_dispatched     INT NOT NULL,
    qty_received       INT NULL,
    discrepancy_note   VARCHAR(500) NULL,
    created_at         DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at         DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_branding_job_colours_job
      FOREIGN KEY (branding_job_id) REFERENCES dbo.branding_jobs(branding_job_id),
    CONSTRAINT FK_branding_job_colours_colour
      FOREIGN KEY (colour_id) REFERENCES dbo.purchase_colours(colour_id)
  );
END;

