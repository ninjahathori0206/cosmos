'use strict';

/** Per-store treasury ledger keys (Collection Book). */
const TREASURY_LEDGER_CATALOG = [
  { key: 'store_cash', label: 'Store Cash', role: 'physical_cash' },
  { key: 'payment_machine', label: 'Payment Machine', role: 'terminal_balance' },
  { key: 'store_bank', label: 'Store Bank', role: 'bank_balance' }
];

/** POS/handover payment method → ledger + optional sub-tag. */
const PAYMENT_METHOD_LEDGER_MAP = {
  CASH: { ledger_key: 'store_cash', sub_tag: null },
  UPI: { ledger_key: 'payment_machine', sub_tag: 'upi' },
  CARD: { ledger_key: 'payment_machine', sub_tag: 'card' }
};

function getTreasuryLedgerCatalog() {
  return TREASURY_LEDGER_CATALOG.slice();
}

function getTreasuryLedgerMetaForApi() {
  return {
    ledgers: getTreasuryLedgerCatalog(),
    payment_method_map: PAYMENT_METHOD_LEDGER_MAP
  };
}

function resolvePaymentMethodLedger(method) {
  const key = String(method || '').trim().toUpperCase();
  return PAYMENT_METHOD_LEDGER_MAP[key] || null;
}

function getTreasuryLedgerLabel(ledgerKey) {
  const row = TREASURY_LEDGER_CATALOG.find((r) => r.key === ledgerKey);
  return row ? row.label : ledgerKey;
}

module.exports = {
  TREASURY_LEDGER_CATALOG,
  PAYMENT_METHOD_LEDGER_MAP,
  getTreasuryLedgerCatalog,
  getTreasuryLedgerMetaForApi,
  resolvePaymentMethodLedger,
  getTreasuryLedgerLabel
};
