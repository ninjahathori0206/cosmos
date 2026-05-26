'use strict';

const PAYMENT_MACHINE_PROVIDER_CATALOG = [
  { key: 'mswipe', label: 'Mswipe' },
  { key: 'paytm', label: 'Paytm' }
];

function getPaymentMachineProviderCatalog() {
  return PAYMENT_MACHINE_PROVIDER_CATALOG.slice();
}

function getPaymentMachineProviderLabel(providerKey) {
  const row = PAYMENT_MACHINE_PROVIDER_CATALOG.find((r) => r.key === providerKey);
  return row ? row.label : providerKey;
}

function isAllowedPaymentMachineProvider(providerKey) {
  return PAYMENT_MACHINE_PROVIDER_CATALOG.some((r) => r.key === String(providerKey || '').trim().toLowerCase());
}

module.exports = {
  PAYMENT_MACHINE_PROVIDER_CATALOG,
  getPaymentMachineProviderCatalog,
  getPaymentMachineProviderLabel,
  isAllowedPaymentMachineProvider
};
