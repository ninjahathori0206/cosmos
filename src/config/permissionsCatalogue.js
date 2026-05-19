'use strict';

/**
 * Single source of truth for assignable RBAC permission keys (Command Unit matrix + roles PUT validation).
 * Tuple: [key, label, optionalDescription]
 */
const RAW_PERMISSION_GROUPS = [
  ['Command Unit', [
    ['command_unit.stores.view', 'Stores — View'],
    ['command_unit.stores.create', 'Stores — Create'],
    ['command_unit.stores.edit', 'Stores — Edit'],
    ['command_unit.users.view', 'Users — View'],
    ['command_unit.users.create', 'Users — Create'],
    ['command_unit.users.edit', 'Users — Edit'],
    ['command_unit.roles.view', 'Roles — View'],
    ['command_unit.roles.create', 'Roles — Create'],
    ['command_unit.roles.edit', 'Roles — Edit / Permissions'],
    ['command_unit.modules.edit', 'Module Access — Edit'],
    ['command_unit.settings.view', 'Settings — View'],
    ['command_unit.settings.edit', 'Settings — Edit'],
    ['command_unit.promotions.view', 'Promotion — View customer offers'],
    ['command_unit.promotions.manage', 'Promotion — Manage customer offers'],
    ['command_unit.lab.bypass_order_sibling', 'Lab — Bypass per-pair sibling dispatch guard (timeline audit)'],
    ['command_unit.audit.view', 'Audit Logs — View'],
    ['command_unit.tablets.view', 'Store OS tablets — View by store'],
    ['command_unit.tablets.create', 'Store OS tablets — Create'],
    ['command_unit.tablets.edit', 'Store OS tablets — Reset PIN / Deactivate']
  ]],
  ['Foundry — Procurement', [
    ['foundry.purchases.view', 'Purchases — View'],
    ['foundry.purchases.create', 'Purchases — Create'],
    ['foundry.purchases.edit', 'Purchases — Edit'],
    ['foundry.bill_verification.view', 'Bill Verify — View'],
    ['foundry.bill_verification.create', 'Bill Verify — Submit'],
    ['foundry.bill_verification.edit', 'Bill Verify — Approve discrepancy'],
    ['foundry.branding.view', 'Branding — View'],
    ['foundry.branding.create', 'Branding — Dispatch'],
    ['foundry.branding.edit', 'Branding — Receive / Bypass'],
    ['foundry.digitisation.view', 'Digitisation — View'],
    ['foundry.digitisation.create', 'Digitisation — Generate SKU'],
    ['foundry.digitisation.edit', 'Digitisation — Edit media'],
    ['foundry.warehouse.view', 'Warehouse — View'],
    ['foundry.warehouse.create', 'Warehouse — Approve ready']
  ]],
  ['Foundry — Lab', [
    ['foundry.lab.view', 'Lab orders — Foundry / HQ (all stores)'],
    ['foundry.lab.bypass_order_sibling', 'Lab — Bypass per-pair sibling dispatch guard (audited)']
  ]],
  ['Foundry — Catalogue & Inventory', [
    ['foundry.catalogue.view', 'SKU catalogue — View'],
    ['foundry.catalogue.edit', 'SKU catalogue — Edit'],
    ['foundry.stock.view', 'Stock transfers — View'],
    ['foundry.stock.create', 'Stock transfers — Create']
  ]],
  ['Foundry — Store Connect', [
    ['foundry.transfers.view', 'Transfer requests — View'],
    ['foundry.transfers.create', 'Transfer requests — Create'],
    ['foundry.transfers.edit', 'Transfer requests — Approve / Dispatch']
  ]],
  ['Foundry — Intelligence', [
    ['foundry.suppliers.view', 'Suppliers — View'],
    ['foundry.suppliers.create', 'Suppliers — Create'],
    ['foundry.suppliers.edit', 'Suppliers — Edit'],
    ['foundry.makers.view', 'Makers — View'],
    ['foundry.makers.create', 'Makers — Create'],
    ['foundry.makers.edit', 'Makers — Edit']
  ]],
  ['Finance', [
    ['finance.dashboard.view', 'Dashboard — View'],
    ['finance.challan_valuation.view', 'Challan valuation — View'],
    ['finance.challan_valuation.create', 'Challan valuation — Set payable'],
    ['finance.purchase_invoices.view', 'Purchase invoices — View'],
    ['finance.purchase_invoices.create', 'Purchase invoices — Post'],
    ['finance.payments.view', 'Payments — View'],
    ['finance.payments.create', 'Payments — Create'],
    ['finance.payments.edit', 'Payments — Edit / Void'],
    ['finance.reports.view', 'Reports — View']
  ]],
  ['StorePilot (Showroom)', [
    ['storepilot.dashboard.view', 'Dashboard — View'],
    ['storepilot.catalogue.view', 'Catalogue — View'],
    ['storepilot.floor.view', 'Floor & displays — View'],
    ['storepilot.floor.create', 'Floor & displays — Create'],
    ['storepilot.floor.edit', 'Floor & displays — Edit'],
    ['storepilot.appointments.view', 'Appointments — View'],
    ['storepilot.appointments.create', 'Appointments — Create'],
    ['storepilot.appointments.edit', 'Appointments — Edit'],
    ['storepilot.walkins.view', 'Walk-ins — View'],
    ['storepilot.walkins.create', 'Walk-ins — Create'],
    ['storepilot.walkins.edit', 'Walk-ins — Edit'],
    ['storepilot.handoffs.create', 'POS handoffs — Create'],
    ['storepilot.reports.view', 'Reports — View'],
    ['storepilot.lab.view', 'Lab orders — View store queue'],
    ['storepilot.lab.manage', 'Lab orders — Workflow & handover (store)'],
    ['storepilot.lab.bypass_order_sibling', 'Lab — Bypass pair dispatch guard when HQ allows (audited)'],
    ['storepilot.transfers.view', 'Transfers — View'],
    ['storepilot.transfers.create', 'Transfers — Create'],
    ['storepilot.transfers.edit', 'Transfers — Accept / Stock']
  ]],
  ['Store OS (POS)', [
    ['pos.catalogue.view', 'POS — Catalogue, startup & lens config'],
    ['pos.promotions.view', 'POS — Active offers (cart sidebar)'],
    ['pos.customers.view', 'POS — Customer search'],
    ['pos.customers.create', 'POS — Register customer'],
    ['pos.orders.view', 'POS — Orders list & detail'],
    ['pos.orders.create', 'POS — Create order'],
    ['pos.orders.void_unpaid', 'POS — Void zero-payment unpaid bill'],
    ['pos.payment.collect', 'POS — Record payment'],
    ['pos.lab.workflow', 'POS — Lab sub-order status updates'],
    ['pos.lab.bypass_order_sibling', 'POS — Bypass lab pair dispatch guard when authorised (audited)'],
    ['pos.staff.pin.set', 'POS — Set staff PIN']
  ]],
  ['CX (Customer Experience)', [
    ['cx.dashboard.view', 'CX — Dashboard & KPI summary'],
    ['cx.orders.view', 'CX — Orders list / recent activity'],
    ['cx.customers.view', 'CX — Customer directory'],
    ['cx.membership.manage', 'CX — Membership plans & grant / renew'],
    ['cx.eye_tests.create', 'CX — Record eye tests'],
    ['cx.offers.view', 'CX — View customer offers'],
    ['cx.offers.manage', 'CX — Manage customer offers']
  ]],
  ['Army (HR & Attendance)', [
    ['army.staff.view', 'Staff — View'],
    ['army.staff.create', 'Staff — Create'],
    ['army.staff.edit', 'Staff — Edit'],
    ['army.attendance.view', 'Attendance — View'],
    ['army.attendance.create', 'Attendance — Create'],
    ['army.attendance.edit', 'Attendance — Edit'],
    ['army.leaves.view', 'Leaves — View'],
    ['army.leaves.edit', 'Leaves — Approve / Reject'],
    ['army.payroll.view', 'Payroll — View'],
    ['army.payroll.create', 'Payroll — Create'],
    ['army.payroll.edit', 'Payroll — Edit']
  ]]
];

function inferModuleKey(permissionKey) {
  const k = String(permissionKey || '');
  const dot = k.indexOf('.');
  return dot === -1 ? '' : k.slice(0, dot).toLowerCase();
}

/**
 * @returns {{ group: string, perms: { key: string, label: string, description: string, moduleKey: string }[] }[]}
 */
function buildCatalogueGroups() {
  return RAW_PERMISSION_GROUPS.map(([groupName, tuples]) => ({
    group: groupName,
    perms: tuples.map((row) => {
      const [key, label, description] = row;
      return {
        key: String(key).toLowerCase(),
        label,
        description: description ? String(description) : '',
        moduleKey: inferModuleKey(key)
      };
    })
  }));
}

const PERMISSION_CATALOGUE_GROUPS = buildCatalogueGroups();

function getCataloguePermissionKeysSet() {
  const s = new Set();
  for (const g of PERMISSION_CATALOGUE_GROUPS) {
    for (const p of g.perms) s.add(p.key);
  }
  return s;
}

/** @type {Set<string>} */
let catalogueKeysSetCache = null;
function getCatalogueKeysSetCached() {
  if (!catalogueKeysSetCache) catalogueKeysSetCache = getCataloguePermissionKeysSet();
  return catalogueKeysSetCache;
}

function isCataloguePermissionKey(key) {
  return getCatalogueKeysSetCached().has(String(key || '').toLowerCase());
}

module.exports = {
  PERMISSION_CATALOGUE_GROUPS,
  getCataloguePermissionKeysSet,
  isCataloguePermissionKey,
  inferModuleKey
};
