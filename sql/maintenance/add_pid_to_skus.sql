-- ══════════════════════════════════════════════════════════════════════════════
-- add_pid_to_skus.sql
-- Adds the PID (Product Purchase Identifier) column to dbo.skus.
--
-- PID format: {sku_code}-P{header_id}  e.g. EW-BOLD-STD-P42
-- SKU format: {BRAND}-{COLL}-{CLR}      e.g. EW-BOLD-STD  (stable per product)
--
-- For existing rows: pid = sku_code (old codes were already unique per purchase)
-- Drop sku_code unique constraint (same product now shares sku_code across purchases)
-- Add unique constraint on pid + barcode
--
-- Safe to re-run — all steps are guarded.
-- ══════════════════════════════════════════════════════════════════════════════

-- Step 1: Add pid column if not present
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.skus') AND name = 'pid'
)
BEGIN
  ALTER TABLE dbo.skus ADD pid VARCHAR(80) NULL;
  PRINT 'Added pid column to dbo.skus';
END
ELSE
  PRINT 'pid column already exists — skipped';
GO

-- Step 2: Backfill existing rows (pid = sku_code, already unique)
UPDATE dbo.skus SET pid = sku_code WHERE pid IS NULL;
PRINT 'Backfilled pid from sku_code for existing rows';
GO

-- Step 3: Make pid NOT NULL
ALTER TABLE dbo.skus ALTER COLUMN pid VARCHAR(80) NOT NULL;
GO

-- Step 4: Add UNIQUE constraint on pid
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.skus') AND name = 'UQ_skus_pid'
)
BEGIN
  ALTER TABLE dbo.skus ADD CONSTRAINT UQ_skus_pid UNIQUE (pid);
  PRINT 'Added UNIQUE constraint on dbo.skus.pid';
END
ELSE
  PRINT 'UQ_skus_pid already exists — skipped';
GO

-- Step 5: Drop the UNIQUE constraint on sku_code
-- (same product will now share sku_code across multiple purchases)
DECLARE @sku_uq NVARCHAR(200);
SELECT @sku_uq = i.name
FROM sys.indexes i
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c        ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('dbo.skus')
  AND c.name = 'sku_code'
  AND i.is_unique = 1;

IF @sku_uq IS NOT NULL
BEGIN
  EXEC('ALTER TABLE dbo.skus DROP CONSTRAINT ' + @sku_uq);
  PRINT 'Dropped UNIQUE constraint on sku_code';
END
ELSE
  PRINT 'No unique constraint on sku_code to drop — skipped';
GO

-- Step 6: Drop the UNIQUE constraint on barcode
-- (barcode will now equal pid for new records — pid is already unique)
DECLARE @bc_uq NVARCHAR(200);
SELECT @bc_uq = i.name
FROM sys.indexes i
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c        ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('dbo.skus')
  AND c.name = 'barcode'
  AND i.is_unique = 1;

IF @bc_uq IS NOT NULL
BEGIN
  EXEC('ALTER TABLE dbo.skus DROP CONSTRAINT ' + @bc_uq);
  PRINT 'Dropped UNIQUE constraint on barcode';
END
ELSE
  PRINT 'No unique constraint on barcode to drop — skipped';
GO

PRINT 'Done — dbo.skus pid column ready.';
