-- Sync per-store app_settings pos_order_seq:{STORE} from max EW-ORD-{store}-{seq5} suffix.
-- Legacy global key pos_order_seq is obsolete after migration 86.
-- Use when checkout fails: duplicate order_no on UQ_pos_orders_order_no.

DECLARE @store_code NVARCHAR(50) = NULL; -- optional: set e.g. N'EW-SRT03' to sync one store only

DECLARE @stores TABLE (store_id INT, store_compact NVARCHAR(40));
INSERT INTO @stores (store_id, store_compact)
SELECT s.store_id,
       UPPER(LTRIM(RTRIM(REPLACE(REPLACE(ISNULL(s.store_code, N'STORE'), N'EW-', N''), N'-', N''))))
FROM dbo.stores s
WHERE @store_code IS NULL OR s.store_code = @store_code;

DECLARE @sid INT;
DECLARE @compact NVARCHAR(40);
DECLARE @mx INT;
DECLARE @k VARCHAR(100);
DECLARE @pat NVARCHAR(80);

DECLARE c CURSOR LOCAL FAST_FORWARD FOR
  SELECT store_id, store_compact FROM @stores;

OPEN c;
FETCH NEXT FROM c INTO @sid, @compact;

WHILE @@FETCH_STATUS = 0
BEGIN
  SET @pat = N'EW-ORD-' + @compact + N'-%';
  SET @mx = 0;

  IF OBJECT_ID(N'dbo.pos_orders', N'U') IS NOT NULL
  BEGIN
    SELECT @mx = MAX(TRY_CAST(RIGHT(order_no, 5) AS INT))
    FROM dbo.pos_orders
    WHERE store_id = @sid AND order_no LIKE @pat;
  END;

  IF OBJECT_ID(N'dbo.oe_orders', N'U') IS NOT NULL
  BEGIN
    DECLARE @t INT;
    SELECT @t = MAX(TRY_CAST(RIGHT(order_no, 5) AS INT))
    FROM dbo.oe_orders o
    INNER JOIN dbo.stores st ON st.store_id = o.store_id
    WHERE o.store_id = @sid AND o.order_no LIKE @pat;
    IF @t IS NOT NULL AND @t > ISNULL(@mx, 0) SET @mx = @t;
  END;

  SET @k = N'pos_order_seq:' + @compact;
  IF ISNULL(@mx, 0) > 0
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = @k)
      INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
      VALUES (@k, CAST(@mx AS VARCHAR(500)), N'pos', N'Per-store POS order sequence.');
    ELSE
      UPDATE dbo.app_settings
      SET setting_value = CAST(@mx AS VARCHAR(500)),
          updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      WHERE setting_key = @k;

    PRINT N'Synced ' + @k + N' → ' + CAST(@mx AS NVARCHAR(20));
  END;

  FETCH NEXT FROM c INTO @sid, @compact;
END;

CLOSE c;
DEALLOCATE c;

PRINT N'Done.';
