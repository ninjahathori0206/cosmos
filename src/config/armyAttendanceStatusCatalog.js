'use strict';

const ARMY_ATTENDANCE_STATUS_CATALOG = [
  { key: 'PRESENT', label: 'Present', badgeClass: 'b-green' },
  { key: 'HALF_DAY', label: 'Half day', badgeClass: 'b-gold' },
  { key: 'LATE', label: 'Late', badgeClass: 'b-orange' },
  { key: 'ABSENT', label: 'Absent', badgeClass: 'b-red' },
  { key: 'LEAVE', label: 'Leave', badgeClass: 'b-blue' },
  { key: 'HOLIDAY', label: 'Holiday', badgeClass: 'b-gray' },
  { key: 'TOUR', label: 'Tour duty', badgeClass: 'b-teal' },
  { key: 'FLOATING', label: 'Floating', badgeClass: 'b-gray' }
];

function getArmyAttendanceStatusCatalog() { return ARMY_ATTENDANCE_STATUS_CATALOG.map((r) => ({ ...r })); }
function isAllowedArmyAttendanceStatusKey(key) {
  return ARMY_ATTENDANCE_STATUS_CATALOG.some((r) => r.key === String(key || '').trim().toUpperCase());
}

module.exports = { getArmyAttendanceStatusCatalog, isAllowedArmyAttendanceStatusKey };
