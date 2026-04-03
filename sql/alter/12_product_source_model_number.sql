USE [CosmosERP];

IF NOT EXISTS (
  SELECT 1
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'product_master'
    AND COLUMN_NAME = 'source_model_number'
)
BEGIN
  ALTER TABLE dbo.product_master
    ADD source_model_number VARCHAR(200) NULL;
END;
GO

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
GO

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
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_product_master_maker_brand_collection'
    AND object_id = OBJECT_ID('dbo.product_master')
)
BEGIN
  CREATE INDEX IX_product_master_maker_brand_collection
    ON dbo.product_master(maker_master_id, source_brand, source_collection);
END;
GO
