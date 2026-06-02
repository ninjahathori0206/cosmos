'use strict';

/** Per-store treasury ledger keys (Collection Book). */
const TREASURY_LEDGER_CATALOG = [
  { key: 'store_cash', label: 'Store Cash', role: 'physical_cash' },
  { key: 'payment_machine', label: 'Payment Machine', role: 'terminal_balance' },
  { key: 'store_bank', label: 'Store Bank', role: 'bank_balance' },
  { key: 'membership_store_cash', label: 'Membership Cash', role: 'membership_cash' },
  { key: 'membership_payment_machine', label: 'Membership Machine', role: 'membership_terminal' },
  { key: 'membership_store_bank', label: 'Membership Bank', role: 'membership_bank' }
];

/** POS/handover payment method → ledger + optional sub-tag. */
const PAYMENT_METHOD_LEDGER_MAP = {
  CASH: { ledger_key: 'store_cash', sub_tag: null },
  UPI: { ledger_key: 'payment_machine', sub_tag: 'upi' },
  CARD: { ledger_key: 'payment_machine', sub_tag: 'card' }
};

const MEMBERSHIP_PAYMENT_METHOD_LEDGER_MAP = {
  CASH: { ledger_key: 'membership_store_cash', sub_tag: null },
  UPI: { ledger_key: 'membership_payment_machine', sub_tag: 'upi' },
  CARD: { ledger_key: 'membership_payment_machine', sub_tag: 'card' }
};

function getTreasuryLedgerCatalog() {
  return TREASURY_LEDGER_CATALOG.slice();
}

function getTreasuryLedgerMetaForApi() {
  return {
    ledgers: getTreasuryLedgerCatalog(),
    payment_method_map: PAYMENT_METHOD_LEDGER_MAP,
    membership_payment_method_map: MEMBERSHIP_PAYMENT_METHOD_LEDGER_MAP
  };
}

function resolvePaymentMethodLedger(method, options = {}) {
  const key = String(method || '').trim().toUpperCase();
  const map = options.membership ? MEMBERSHIP_PAYMENT_METHOD_LEDGER_MAP : PAYMENT_METHOD_LEDGER_MAP;
  return map[key] || null;
}

function getTreasuryLedgerLabel(ledgerKey) {
  const row = TREASURY_LEDGER_CATALOG.find((r) => r.key === ledgerKey);
  return row ? row.label : ledgerKey;
}

module.exports = {
  TREASURY_LEDGER_CATALOG,
  PAYMENT_METHOD_LEDGER_MAP,
  MEMBERSHIP_PAYMENT_METHOD_LEDGER_MAP,
  getTreasuryLedgerCatalog,
  getTreasuryLedgerMetaForApi,
  resolvePaymentMethodLedger,
  getTreasuryLedgerLabel
};
