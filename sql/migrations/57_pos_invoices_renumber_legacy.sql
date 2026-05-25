-- Legacy POS invoice renumber: EW-INV-EW-ORD-* → EW-INV-{FY}-{store}-{seq5}
-- Prefer the Node script (uses same rules as runtime allocateNextPosInvoiceNo):
--   node scripts/migrate_legacy_pos_invoice_numbers.js
--   node scripts/migrate_legacy_pos_invoice_numbers.js --dry-run
PRINT 'Migration 57: legacy pos_invoices renumber — run scripts/migrate_legacy_pos_invoice_numbers.js if EW-INV-EW-ORD-* rows remain.';

IF OBJECT_ID('dbo.pos_invoices', 'U') IS NOT NULL
BEGIN
  DECLARE @legacy INT = (
    SELECT COUNT(*) FROM dbo.pos_invoices WHERE invoice_no LIKE N'EW-INV-EW-ORD-%'
  );
  IF @legacy > 0
    PRINT CONCAT(N'Found ', @legacy, N' legacy invoice(s) — run migrate_legacy_pos_invoice_numbers.js');
  ELSE
    PRINT 'No EW-INV-EW-ORD-* invoices found.';
END
