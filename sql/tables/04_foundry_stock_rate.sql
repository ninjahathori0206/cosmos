PRINT 'Creating Foundry stock & rate intelligence tables...';

USE [CosmosERP];

IF OBJECT_ID('dbo.skus', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.skus (
    sku_id             INT IDENTITY(1,1) PRIMARY KEY,
    product_master_id  INT NOT NULL,
    purchase_colour_id INT NOT NULL,
    sku_code           VARCHAR(100) NOT NULL UNIQUE,
    barcode            VARCHAR(100) NOT NULL UNIQUE,
    quantity           INT NOT NULL,
    cost_price         DECIMAL(10,2) NOT NULL,
    sale_price         DECIMAL(10,2) NOT NULL,
    status             VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    created_by         INT NULL,
    created_at         DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at         DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_skus_product_master
      FOREIGN KEY (product_master_id) REFERENCES dbo.product_master(product_id),
    CONSTRAINT FK_skus_purchase_colour
      FOREIGN KEY (purchase_colour_id) REFERENCES dbo.purchase_colours(colour_id),
    CONSTRAINT FK_skus_created_by
      FOREIGN KEY (created_by) REFERENCES dbo.users(user_id)
  );
END;

IF OBJECT_ID('dbo.sku_digitisation', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.sku_digitisation (
    digitisation_id     INT IDENTITY(1,1) PRIMARY KEY,
    sku_id              INT NOT NULL UNIQUE,
    lens_width          DECIMAL(5,2) NULL,
    bridge_width        DECIMAL(5,2) NULL,
    temple_length       DECIMAL(5,2) NULL,
    frame_height        DECIMAL(5,2) NULL,
    weight              DECIMAL(5,2) NULL,
    material            VARCHAR(100) NULL,
    frame_shape         VARCHAR(100) NULL,
    gender              VARCHAR(20) NULL,
    colour_display_name VARCHAR(100) NULL,
    title               VARCHAR(200) NULL,
    short_desc          VARCHAR(500) NULL,
    full_desc           VARCHAR(500) NULL,
    tags                VARCHAR(500) NULL,
    is_published        BIT NOT NULL DEFAULT 0,
    approved_by         INT NULL,
    approved_at         DATETIME NULL,
    created_at          DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at          DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_sku_digitisation_sku
      FOREIGN KEY (sku_id) REFERENCES dbo.skus(sku_id),
    CONSTRAINT FK_sku_digitisation_approved_by
      FOREIGN KEY (approved_by) REFERENCES dbo.users(user_id)
  );
END;

IF OBJECT_ID('dbo.sku_media', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.sku_media (
    media_id      INT IDENTITY(1,1) PRIMARY KEY,
    sku_id        INT NOT NULL,
    media_type    VARCHAR(10) NOT NULL,
    file_url      VARCHAR(500) NOT NULL,
    angle_label   VARCHAR(100) NULL,
    is_primary    BIT NOT NULL DEFAULT 0,
    display_order INT NOT NULL DEFAULT 0,
    created_by    INT NULL,
    created_at    DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_sku_media_sku
      FOREIGN KEY (sku_id) REFERENCES dbo.skus(sku_id),
    CONSTRAINT FK_sku_media_created_by
      FOREIGN KEY (created_by) REFERENCES dbo.users(user_id)
  );
END;

IF OBJECT_ID('dbo.stock_balances', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.stock_balances (
    balance_id     INT IDENTITY(1,1) PRIMARY KEY,
    sku_id         INT NOT NULL,
    location_type  VARCHAR(50) NOT NULL,
    location_id    INT NOT NULL,
    location_name  VARCHAR(200) NULL,
    qty            INT NOT NULL DEFAULT 0,
    last_updated   DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_stock_balances_sku
      FOREIGN KEY (sku_id) REFERENCES dbo.skus(sku_id),
    CONSTRAINT UQ_stock_balances_sku_location
      UNIQUE (sku_id, location_type, location_id)
  );
END;

IF OBJECT_ID('dbo.stock_movements', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.stock_movements (
    movement_id        INT IDENTITY(1,1) PRIMARY KEY,
    sku_id             INT NOT NULL,
    from_location_type VARCHAR(50) NULL,
    from_location_id   INT NULL,
    to_location_type   VARCHAR(50) NULL,
    to_location_id     INT NULL,
    qty                INT NOT NULL,
    movement_type      VARCHAR(50) NOT NULL,
    reference_id       VARCHAR(100) NULL,
    notes              VARCHAR(500) NULL,
    created_by         INT NULL,
    created_at         DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_stock_movements_sku
      FOREIGN KEY (sku_id) REFERENCES dbo.skus(sku_id),
    CONSTRAINT FK_stock_movements_created_by
      FOREIGN KEY (created_by) REFERENCES dbo.users(user_id)
  );
END;

IF OBJECT_ID('dbo.location_visibility_config', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.location_visibility_config (
    config_id        INT IDENTITY(1,1) PRIMARY KEY,
    location_type    VARCHAR(50) NOT NULL,
    display_name     VARCHAR(100) NOT NULL,
    display_icon     VARCHAR(50) NULL,
    visible_to_roles VARCHAR(500) NULL,
    scope            VARCHAR(50) NOT NULL,
    is_active        BIT NOT NULL DEFAULT 1,
    created_by       INT NULL,
    created_at       DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at       DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_location_visibility_config_created_by
      FOREIGN KEY (created_by) REFERENCES dbo.users(user_id)
  );
END;

IF OBJECT_ID('dbo.vendor_product_rates', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.vendor_product_rates (
    rate_id          INT IDENTITY(1,1) PRIMARY KEY,
    product_master_id INT NOT NULL,
    supplier_id      INT NOT NULL,
    total_purchases  INT NOT NULL DEFAULT 0,
    lowest_rate      DECIMAL(10,2) NULL,
    highest_rate     DECIMAL(10,2) NULL,
    last_rate        DECIMAL(10,2) NULL,
    previous_rate    DECIMAL(10,2) NULL,
    rate_trend       VARCHAR(10) NULL,
    rate_delta       DECIMAL(10,2) NULL,
    updated_at       DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_vendor_product_rates_product
      FOREIGN KEY (product_master_id) REFERENCES dbo.product_master(product_id),
    CONSTRAINT FK_vendor_product_rates_supplier
      FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(supplier_id),
    CONSTRAINT UQ_vendor_product_rates_product_supplier
      UNIQUE (product_master_id, supplier_id)
  );
END;

IF OBJECT_ID('dbo.product_rate_summary', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.product_rate_summary (
    summary_id              INT IDENTITY(1,1) PRIMARY KEY,
    product_master_id       INT NOT NULL UNIQUE,
    network_lowest_rate     DECIMAL(10,2) NULL,
    network_lowest_supplier_id INT NULL,
    network_highest_rate    DECIMAL(10,2) NULL,
    total_supplier_count    INT NOT NULL DEFAULT 0,
    last_purchased_rate     DECIMAL(10,2) NULL,
    last_purchased_supplier_id INT NULL,
    updated_at              DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_product_rate_summary_product
      FOREIGN KEY (product_master_id) REFERENCES dbo.product_master(product_id),
    CONSTRAINT FK_product_rate_summary_lowest_supplier
      FOREIGN KEY (network_lowest_supplier_id) REFERENCES dbo.suppliers(supplier_id),
    CONSTRAINT FK_product_rate_summary_last_supplier
      FOREIGN KEY (last_purchased_supplier_id) REFERENCES dbo.suppliers(supplier_id)
  );
END;

