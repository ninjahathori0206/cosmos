'use strict';

const ARMY_BANK_ACCOUNT_TYPE_CATALOG = [
  { key: 'SAVINGS', label: 'Savings' },
  { key: 'CURRENT', label: 'Current' },
  { key: 'SALARY', label: 'Salary account' }
];

function getArmyBankAccountTypeCatalog() {
  return ARMY_BANK_ACCOUNT_TYPE_CATALOG.map((row) => ({ ...row }));
}

function isAllowedArmyBankAccountTypeKey(key) {
  if (!key) return true;
  return ARMY_BANK_ACCOUNT_TYPE_CATALOG.some((row) => row.key === String(key).trim().toUpperCase());
}

module.exports = {
  getArmyBankAccountTypeCatalog,
  isAllowedArmyBankAccountTypeKey
};
