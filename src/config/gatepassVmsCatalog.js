'use strict';

/** VMS settings — keys shared by gatepass API, Command Unit, and jobs. */
const GATEPASS_VMS_SETTINGS = [
  {
    key: 'vms.visitor_expiry_minutes',
    label: 'Visitor expiry (minutes)',
    description: 'Auto-expire waiting / in-service visits after this many minutes from check-in.',
    type: 'int',
    min: 30,
    max: 1440,
    defaultValue: 240
  },
  {
    key: 'vms.max_active_visitors',
    label: 'Max active visitors',
    description: 'Maximum waiting + in-service visitors per store.',
    type: 'int',
    min: 1,
    max: 200,
    defaultValue: 50
  },
  {
    key: 'vms.self_checkin_enabled',
    label: 'Self check-in (Eyewoot Go)',
    description: 'When enabled, customers can check in via Eyewoot Go (Phase 5).',
    type: 'bool',
    defaultValue: true
  }
];

const GATEPASS_VMS_KEY_SET = new Set(GATEPASS_VMS_SETTINGS.map((s) => s.key));

function getGatepassVmsCatalog() {
  return GATEPASS_VMS_SETTINGS.map((s) => ({ ...s }));
}

function isGatepassVmsKey(key) {
  return GATEPASS_VMS_KEY_SET.has(String(key || '').trim());
}

module.exports = {
  GATEPASS_VMS_SETTINGS,
  GATEPASS_VMS_KEY_SET,
  getGatepassVmsCatalog,
  isGatepassVmsKey
};
