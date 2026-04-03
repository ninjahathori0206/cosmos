-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 07: Replace per-item purchases with header+items architecture
--               Add maker_master table; add maker_master_id to product_master
-- ─────────────────────────────────────────────────────────────────────────────
USE [CosmosERP];
GO

-- ── 1. maker_master ──────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.maker_master','U') IS NULL
BEGIN
  CREATE TABLE dbo.maker_master (
    maker_id    INT IDENTITY(1,1) PRIMARY KEY,
    maker_name  VARCHAR(200) NOT NULL,
    maker_code  VARCHAR(50)  NOT NULL,
    description VARCHAR(500) NULL,
    country     VARCHAR(100) NULL,
    is_active   BIT NOT NULL DEFAULT 1,
    created_at  DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at  DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_maker_code UNIQUE (maker_code)
  );
  PRINT 'Created dbo.maker_master';
END
ELSE PRINT 'maker_master already exists – skipped';
GO

-- ── 2. Add maker_master_id to product_master ─────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.product_master') AND name='maker_master_id')
BEGIN
  ALTER TABLE dbo.product_master ADD maker_master_id INT NULL;
  ALTER TABLE dbo.product_master ADD CONSTRAINT FK_pm_maker_master
    FOREIGN KEY (maker_master_id) REFERENCES dbo.maker_master(maker_id);
  PRINT 'Added maker_master_id to dbo.product_master';
END
ELSE PRINT 'maker_master_id already exists on product_master – skipped';
GO

-- ── 3. purchase_headers ───────────────────────────────────────────────────────
IF OBJECT_ID('dbo.purchase_headers','U') IS NULL
BEGIN
  CREATE TABLE dbo.purchase_headers (
    header_id          INT IDENTITY(1,1) PRIMARY KEY,
    supplier_id        INT NOT NULL,
    bill_ref           VARCHAR(100) NULL,
    purchase_date      DATETIME NOT NULL,
    transport_cost     DECIMAL(10,2) NOT NULL DEFAULT 0,
    po_reference       VARCHAR(100) NULL,
    notes              VARCHAR(500) NULL,
    -- totals (computed at create / updated at verify)
    expected_bill_amt  DECIMAL(10,2) NULL,
    actual_bill_amt    DECIMAL(10,2) NULL,
    bill_number        VARCHAR(100) NULL,
    bill_date          DATETIME NULL,
    discrepancy_note   VARCHAR(500) NULL,
    bill_status        VARCHAR(50) NOT NULL DEFAULT 'PENDING_BILL_VERIFICATION',
    pipeline_status    VARCHAR(50) NOT NULL DEFAULT 'PENDING_BILL_VERIFICATION',
    branding_instructions VARCHAR(500) NULL,
    bypass_reason      VARCHAR(500) NULL,
    dispatched_at      DATETIME NULL,
    received_at        DATETIME NULL,
    warehouse_at       DATETIME NULL,
    created_by         INT NULL,
    created_at         DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at         DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_ph_supplier FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(supplier_id)
  );
  PRINT 'Created dbo.purchase_headers';
END
ELSE PRINT 'purchase_headers already exists – skipped';
GO

-- ── 4. purchase_items ─────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.purchase_items','U') IS NULL
BEGIN
  CREATE TABLE dbo.purchase_items (
    item_id           INT IDENTITY(1,1) PRIMARY KEY,
    header_id         INT NOT NULL,
    product_master_id INT NOT NULL,
    maker_master_id   INT NULL,
    purchase_rate     DECIMAL(10,2) NOT NULL,
    quantity          INT NOT NULL,
    gst_pct           DECIMAL(5,2) NOT NULL,
    base_value        DECIMAL(10,2) NOT NULL,
    gst_amt           DECIMAL(10,2) NOT NULL,
    item_total        DECIMAL(10,2) NOT NULL,
    created_at        DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_pi_header  FOREIGN KEY (header_id)         REFERENCES dbo.purchase_headers(header_id),
    CONSTRAINT FK_pi_product FOREIGN KEY (product_master_id) REFERENCES dbo.product_master(product_id),
    CONSTRAINT FK_pi_maker   FOREIGN KEY (maker_master_id)   REFERENCES dbo.maker_master(maker_id)
  );
  PRINT 'Created dbo.purchase_items';
END
ELSE PRINT 'purchase_items already exists – skipped';
GO

-- ── 5. purchase_item_colours ──────────────────────────────────────────────────
IF OBJECT_ID('dbo.purchase_item_colours','U') IS NULL
BEGIN
  CREATE TABLE dbo.purchase_item_colours (
    colour_id   INT IDENTITY(1,1) PRIMARY KEY,
    item_id     INT NOT NULL,
    colour_name VARCHAR(100) NOT NULL,
    colour_code VARCHAR(20)  NOT NULL,
    quantity    INT NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_pic_item FOREIGN KEY (item_id) REFERENCES dbo.purchase_items(item_id)
  );
  PRINT 'Created dbo.purchase_item_colours';
END
ELSE PRINT 'purchase_item_colours already exists – skipped';
GO

-- ── 6. Add header_id + item_id to skus (keep purchase_colour_id for compat) ──
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.skus') AND name='header_id')
BEGIN
  ALTER TABLE dbo.skus ADD header_id INT NULL;
  ALTER TABLE dbo.skus ADD item_id   INT NULL;
  ALTER TABLE dbo.skus ADD item_colour_id INT NULL;
  PRINT 'Added header_id, item_id, item_colour_id to dbo.skus';
END
ELSE PRINT 'skus new columns already exist – skipped';
GO
