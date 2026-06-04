'use strict';

const ARMY_LEAVE_TYPE_CATALOG = [
  { key: 'CL', label: 'Casual Leave' },
  { key: 'SL', label: 'Sick Leave' },
  { key: 'EL', label: 'Earned Leave' },
  { key: 'ML', label: 'Maternity Leave' },
  { key: 'PL', label: 'Paternity Leave' },
  { key: 'UL', label: 'Unpaid Leave' },
  { key: 'CO', label: 'Compensatory Off' },
  { key: 'LOP', label: 'Loss of Pay' }
];

const ARMY_LEAVE_STATUS_CATALOG = [
  { key: 'PENDING', label: 'Pending', badgeClass: 'b-gold' },
  { key: 'APPROVED', label: 'Approved', badgeClass: 'b-green' },
  { key: 'REJECTED', label: 'Rejected', badgeClass: 'b-red' },
  { key: 'CANCELLED', label: 'Cancelled', badgeClass: 'b-gray' }
];

function getArmyLeaveTypeCatalog() { return ARMY_LEAVE_TYPE_CATALOG.map((r) => ({ ...r })); }
function getArmyLeaveStatusCatalog() { return ARMY_LEAVE_STATUS_CATALOG.map((r) => ({ ...r })); }
function getArmyLeaveTypeByKey(key) {
  return ARMY_LEAVE_TYPE_CATALOG.find((r) => r.key === String(key || '').trim().toUpperCase()) || null;
}
function isAllowedArmyLeaveTypeKey(key) {
  return ARMY_LEAVE_TYPE_CATALOG.some((r) => r.key === String(key || '').trim().toUpperCase());
}
function isAllowedArmyLeaveStatusKey(key) {
  return ARMY_LEAVE_STATUS_CATALOG.some((r) => r.key === String(key || '').trim().toUpperCase());
}

module.exports = {
  getArmyLeaveTypeCatalog,
  getArmyLeaveStatusCatalog,
  getArmyLeaveTypeByKey,
  isAllowedArmyLeaveTypeKey,
  isAllowedArmyLeaveStatusKey
};
