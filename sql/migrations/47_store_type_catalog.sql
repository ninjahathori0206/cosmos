/*
  Migration 47 — Store type reference catalog (SQL)

  - dbo.store_type_catalog: canonical keys + labels for dbo.stores.store_type
  - MERGE seeds HQ, Owned, Franchise, Kiosk, Online (keep in sync with src/config/storeTypesCatalog.js)
  - Adds FK_stores_store_type_catalog only when every dbo.stores.store_type exists in the catalog
    (skipped if legacy/orphan types exist — fix data and re-run)

  Deploy: npm run migrate:47-store-type-catalog
*/
USE [CosmosERP];
GO

SET NOCOUNT ON;
PRINT N'Migration 47: store_type_catalog';
GO

IF OBJECT_ID(N'dbo.store_type_catalog', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.store_type_catalog (
    type_key    VARCHAR(50)   NOT NULL CONSTRAINT PK_store_type_catalog PRIMARY KEY,
    label       NVARCHAR(200) NOT NULL,
    description NVARCHAR(500) NULL,
    sort_order  INT           NOT NULL,
    created_at  DATETIME2(0) NOT NULL CONSTRAINT DF_store_type_catalog_created DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_at  DATETIME2(0) NOT NULL CONSTRAINT DF_store_type_catalog_updated DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME()))
  );
  PRINT N'Migration 47: created dbo.store_type_catalog';
END;
ELSE
  PRINT N'Migration 47: dbo.store_type_catalog already exists — skipped create';
GO

/*
  Keys and copy must match src/config/storeTypesCatalog.js (single logical source;
  Node remains authoritative for API validation until you optionally read from this table).
*/
MERGE dbo.store_type_catalog AS tgt
USING (
  SELECT *
  FROM (VALUES
    (N'HQ', N'Corporate HQ (warehouse hub)', N'Foundry primary warehouse hub. WAREHOUSE stock uses this store_id as stock_balances.location_id.', 10),
    (N'Owned', N'Eyewoot-Owned', CAST(NULL AS NVARCHAR(500)), 20),
    (N'Franchise', N'Franchise', CAST(NULL AS NVARCHAR(500)), 30),
    (N'Kiosk', N'Kiosk / Pop-up', CAST(NULL AS NVARCHAR(500)), 40),
    (N'Online', N'Online / D2C', CAST(NULL AS NVARCHAR(500)), 50)
  ) AS v(type_key, label, description, sort_order)
) AS src
ON tgt.type_key = src.type_key
WHEN MATCHED THEN UPDATE SET
  label = src.label,
  description = src.description,
  sort_order = src.sort_order,
  updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
WHEN NOT MATCHED THEN INSERT (type_key, label, description, sort_order)
VALUES (src.type_key, src.label, src.description, src.sort_order);
GO

DECLARE @orphan INT =
(
  SELECT COUNT(*) FROM dbo.stores AS st
  WHERE NOT EXISTS (SELECT 1 FROM dbo.store_type_catalog AS c WHERE c.type_key = st.store_type)
);

IF @orphan > 0
BEGIN
  PRINT N'Migration 47: Skipping FK — ' + CAST(@orphan AS NVARCHAR(20)) + N' store row(s) have store_type not in catalog. Add catalog rows or update stores, then re-run this script.';
END;
ELSE IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_stores_store_type_catalog' AND parent_object_id = OBJECT_ID(N'dbo.stores'))
BEGIN
  ALTER TABLE dbo.stores
  ADD CONSTRAINT FK_stores_store_type_catalog FOREIGN KEY (store_type) REFERENCES dbo.store_type_catalog(type_key);
  PRINT N'Migration 47: Added FK_stores_store_type_catalog.';
END
ELSE
  PRINT N'Migration 47: FK_stores_store_type_catalog already present — skipped';
GO

PRINT N'Migration 47: complete.';
GO
