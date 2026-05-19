-- Align app_settings.pos_order_seq with the highest EW-ORD-* suffix already stored.
-- Use when checkout fails: Violation of UNIQUE KEY ... UQ_pos_orders_order_no (duplicate EW-ORD-xxxx).
-- After deploy, new orders auto-heal via allocateNextPosOrderSeq(); this script fixes legacy drift in one shot.

DECLARE @mx INT = 0;
DECLARE @t INT;
DECLARE @k VARCHAR(100) = N'pos_order_seq';

IF OBJECT_ID(N'dbo.pos_orders', N'U') IS NOT NULL
BEGIN
  SELECT @t = MAX(TRY_CAST(SUBSTRING(order_no, 8, 50) AS INT))
  FROM dbo.pos_orders
  WHERE order_no LIKE N'EW-ORD-%';
  IF @t IS NOT NULL AND @t > @mx SET @mx = @t;
END;

IF OBJECT_ID(N'dbo.oe_orders', N'U') IS NOT NULL
BEGIN
  SELECT @t = MAX(TRY_CAST(SUBSTRING(order_no, 8, 50) AS INT))
  FROM dbo.oe_orders
  WHERE order_no LIKE N'EW-ORD-%';
  IF @t IS NOT NULL AND @t > @mx SET @mx = @t;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = @k)
  INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
  VALUES (@k, CAST(@mx AS VARCHAR(500)), N'pos', N'Monotonic order sequence (integer string).');
ELSE
  UPDATE dbo.app_settings
  SET setting_value = CAST(@mx AS VARCHAR(500)),
      updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
  WHERE setting_key = @k;

PRINT N'pos_order_seq synced to max EW-ORD numeric suffix: ' + CAST(@mx AS NVARCHAR(20));
