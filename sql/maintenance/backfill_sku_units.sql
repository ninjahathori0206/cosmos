-- Backfill dbo.sku_units for existing SKUs (run after migration 50).
-- Usage: npm run maintenance:backfill-sku-units

SET NOCOUNT ON;

DECLARE @sku_id INT;
DECLARE @qty INT;
DECLARE @unit_no INT;
DECLARE @unit_barcode CHAR(7);
DECLARE @max_no INT;

DECLARE sku_cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT sk.sku_id, ISNULL(NULLIF(sk.quantity, 0), ISNULL(pic.quantity, 1))
  FROM dbo.skus sk
  LEFT JOIN dbo.purchase_item_colours pic ON pic.colour_id = sk.item_colour_id
  WHERE NOT EXISTS (SELECT 1 FROM dbo.sku_units u WHERE u.sku_id = sk.sku_id)
    AND ISNULL(NULLIF(sk.quantity, 0), ISNULL(pic.quantity, 1)) > 0;

OPEN sku_cur;
FETCH NEXT FROM sku_cur INTO @sku_id, @qty;

WHILE @@FETCH_STATUS = 0
BEGIN
  SET @max_no = ISNULL((SELECT MAX(unit_no) FROM dbo.sku_units WHERE sku_id = @sku_id), 0);
  SET @unit_no = @max_no + 1;

  WHILE @unit_no <= @max_no + @qty
  BEGIN
    SET @unit_barcode = FORMAT(NEXT VALUE FOR dbo.seq_sku_unit_barcode, 'D7');
    INSERT INTO dbo.sku_units (sku_id, unit_no, unit_barcode, status)
    VALUES (@sku_id, @unit_no, @unit_barcode, N'AVAILABLE');
    SET @unit_no = @unit_no + 1;
  END;

  FETCH NEXT FROM sku_cur INTO @sku_id, @qty;
END;

CLOSE sku_cur;
DEALLOCATE sku_cur;

PRINT N'Backfill sku_units complete.';
