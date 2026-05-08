-- Persist invoice-facing snapshot (staff-edited at handover) for reference / reprint — does not update CX master.
PRINT 'Migration 40: pos_invoices.invoice_display_json';

IF OBJECT_ID('dbo.pos_invoices', 'U') IS NOT NULL
  AND COL_LENGTH('dbo.pos_invoices', 'invoice_display_json') IS NULL
BEGIN
  ALTER TABLE dbo.pos_invoices ADD invoice_display_json NVARCHAR(MAX) NULL;
  PRINT 'Column invoice_display_json added to dbo.pos_invoices.';
END
ELSE IF OBJECT_ID('dbo.pos_invoices', 'U') IS NULL
  PRINT 'Skipping: dbo.pos_invoices does not exist.';
ELSE
  PRINT 'Skipping: invoice_display_json already present.';
GO
