'use strict';

/** Document types for army_employee_documents.doc_type_key */
const ARMY_EMPLOYEE_DOCUMENT_TYPE_CATALOG = [
  { key: 'AADHAAR', label: 'Aadhaar card', requiredForOnboarding: true },
  { key: 'PAN', label: 'PAN card', requiredForOnboarding: true },
  { key: 'PHOTO', label: 'Profile photo', requiredForOnboarding: true },
  { key: 'BANK_PROOF', label: 'Bank proof / cancelled cheque', requiredForOnboarding: false },
  { key: 'EDUCATION', label: 'Education certificate', requiredForOnboarding: false },
  { key: 'EXPERIENCE', label: 'Experience letter', requiredForOnboarding: false },
  { key: 'OTHER', label: 'Other', requiredForOnboarding: false }
];

function getArmyEmployeeDocumentTypeCatalog() {
  return ARMY_EMPLOYEE_DOCUMENT_TYPE_CATALOG.map((row) => ({ ...row }));
}

function getArmyEmployeeDocumentTypeByKey(key) {
  const normalized = String(key || '').trim().toUpperCase();
  return ARMY_EMPLOYEE_DOCUMENT_TYPE_CATALOG.find((row) => row.key === normalized) || null;
}

function isAllowedArmyEmployeeDocumentTypeKey(key) {
  return ARMY_EMPLOYEE_DOCUMENT_TYPE_CATALOG.some((row) => row.key === String(key || '').trim().toUpperCase());
}

module.exports = {
  getArmyEmployeeDocumentTypeCatalog,
  getArmyEmployeeDocumentTypeByKey,
  isAllowedArmyEmployeeDocumentTypeKey
};
