-- POS order numbers: EW-ORD-{storeCompact}-{seq5} (per-store sequence in app_settings).
-- Renumber legacy EW-ORD-{n} rows via:
--   node scripts/migrate_pos_order_numbers_per_store.js [--dry-run]

PRINT 'Migration 86: POS order_no is store-scoped — run scripts/migrate_pos_order_numbers_per_store.js for legacy renumber.';
