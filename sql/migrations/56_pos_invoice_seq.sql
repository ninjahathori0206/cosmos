-- Monotonic POS invoice sequence (used by allocateNextPosInvoiceNo in orderService.js).
PRINT 'Migration 56: pos_invoice_seq app_settings seed';

DECLARE @k VARCHAR(100) = N'pos_invoice_seq';

IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = @k)
BEGIN
  INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
  VALUES (@k, N'0', N'pos', N'Monotonic invoice sequence (integer string).');
  PRINT 'Inserted pos_invoice_seq = 0';
END
ELSE
  PRINT 'pos_invoice_seq already exists — no change.';
