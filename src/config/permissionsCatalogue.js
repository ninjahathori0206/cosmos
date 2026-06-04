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
    ['foundry.warehouse.create', 'Warehouse — Approve ready'],
    ['foundry.label_formats.view', 'Label print formats — View'],
    ['foundry.label_formats.edit', 'Label print formats — Create / edit']
  ]],
  ['Foundry — Lab', [
    ['foundry.lab.view', 'Lab orders — Foundry / HQ (all stores)'],
    ['foundry.lab.manage', 'Lab orders — Update workflow (HQ lab + cross-store store QC)'],
    ['foundry.lab.bypass_order_sibling', 'Lab — Bypass per-pair sibling dispatch guard (audited)']
  ]],
  ['Foundry — Catalogue & Inventory', [
    ['foundry.catalogue.view', 'SKU catalogue — View', 'SKU Catalogue nav and /api/skus only — not lens or master'],
    ['foundry.catalogue.edit', 'SKU catalogue — Edit', 'SKU sale price and catalogue edits — not lens setup'],
    ['foundry.lens.packages.view', 'Lens packages — View'],
    ['foundry.lens.packages.edit', 'Lens packages — Edit'],
    ['foundry.lens.addons.view', 'Lens add-ons — View'],
    ['foundry.lens.addons.edit', 'Lens add-ons — Edit'],
    ['foundry.lens.matrix.view', 'Lens link matrix — View'],
    ['foundry.lens.matrix.edit', 'Lens link matrix — Edit'],
    ['foundry.lens.wizard.view', 'Lens wizard rules — View'],
    ['foundry.lens.wizard.edit', 'Lens wizard rules — Edit'],
    ['foundry.master_catalogue.view', 'Master catalogue — View'],
    ['foundry.master_catalogue.edit', 'Master catalogue — Edit'],
    ['foundry.stock.view', 'Stock transfers — View'],
    ['foundry.stock.create', 'Stock transfers — Create'],
    ['foundry.units.trace', 'Unit trace — Search', 'Foundry Unit Search by 7-digit unit code']
  ]],
  ['Foundry — Store Connect', [
    ['foundry.transfers.view', 'Transfer requests — View'],
    ['foundry.transfers.create', 'Transfer requests — Create'],
    ['foundry.transfers.edit', 'Transfer requests — Approve / Dispatch']
  ]],
  ['Foundry — Intelligence', [
    ['foundry.rate_intelligence.view', 'Rate Intelligence — View'],
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
    ['finance.reports.view', 'Reports — View'],
    ['finance.invoices.view', 'Sales invoices — View all stores & share'],
    ['finance.collections.view', 'Collection Book — View all stores'],
    ['finance.collections.deposit', 'Collection Book — Record cash deposit'],
    ['finance.collections.settle', 'Collection Book — Record machine settlement / void'],
    ['finance.collections.bank_accounts.manage', 'Collection Book — Manage store bank accounts'],
    ['finance.collections.machine.manage', 'Collection Book — Manage payment machine config']
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
    ['storepilot.transfers.edit', 'Transfers — Accept / Stock'],
    ['storepilot.invoices.view', 'Invoices — View & share store invoices'],
    ['storepilot.collections.view', 'Collection Book — View store ledgers'],
    ['storepilot.collections.deposit', 'Collection Book — Record cash deposit'],
    ['storepilot.collections.settle', 'Collection Book — Record machine settlement']
  ]],
  ['GatePass (Visitors)', [
    ['gatepass.view', 'GatePass — View queue & search visitors'],
    ['gatepass.checkin', 'GatePass — Staff check-in'],
    ['gatepass.action', 'GatePass — Select, assign, close visit']
  ]],
  ['Store OS (POS)', [
    ['pos.catalogue.view', 'POS — Catalogue, startup & lens config'],
    ['pos.promotions.view', 'POS — Active offers (cart sidebar)'],
    ['pos.customers.view', 'POS — Customer search'],
    ['pos.customers.create', 'POS — Register customer'],
    ['pos.prescriptions.create', 'POS — Record eye test / prescription (Add Rx wizard)'],
    ['pos.orders.view', 'POS — Orders list & detail'],
    ['pos.orders.create', 'POS — Create order'],
    ['pos.orders.void_unpaid', 'POS — Void zero-payment unpaid bill'],
    ['pos.payment.collect', 'POS — Record payment'],
    ['pos.lab.workflow', 'POS — Lab sub-order status updates'],
    ['pos.lab.bypass_order_sibling', 'POS — Bypass lab pair dispatch guard when authorised (audited)'],
    ['pos.staff.pin.set', 'POS — Set staff PIN'],
    ['pos.membership.sell', 'POS — Sell membership plan from cart'],
    ['pos.membership.dependents.manage', 'POS — Add/remove membership buddies']
  ]],
  ['CX (Customer Experience)', [
    ['cx.dashboard.view', 'CX — Dashboard & KPI summary'],
    ['cx.orders.view', 'CX — Orders list / recent activity'],
    ['cx.customers.view', 'CX — Customer directory'],
    ['cx.customers.edit', 'CX — Edit customer profile & lifestyle (360)'],
    ['cx.coins.manual', 'CX — Manual coin adjustments'],
    ['cx.audit.view', 'CX — Customer audit log tab'],
    ['cx.admin', 'CX — Full Customer 360 admin (implies edit, coins, audit)'],
    ['cx.membership.manage', 'CX — Membership plans & grant / renew'],
    ['cx.eye_tests.create', 'CX — Record eye tests'],
    ['cx.offers.view', 'CX — View customer offers'],
    ['cx.offers.manage', 'CX — Manage customer offers & per-customer assignments']
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
    ['army.payroll.edit', 'Payroll — Edit'],
    ['army.hiring.job_openings.view', 'Hiring — View job openings'],
    ['army.hiring.job_openings.edit', 'Hiring — Publish / close job openings'],
    ['army.hiring.candidates.view', 'Hiring — View candidates & pipeline'],
    ['army.hiring.candidates.edit', 'Hiring — Update candidate status'],
    ['army.hiring.interview_templates.view', 'Hiring — View interview templates'],
    ['army.hiring.interview_templates.edit', 'Hiring — Create / edit interview templates'],
    ['army.hiring.offers.view', 'Hiring — View offer letters'],
    ['army.hiring.offers.edit', 'Hiring — Issue / accept offer letters']
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

/** Bump when adding keys — Command Unit fetches with this revision to avoid stale catalogue. */
const PERMISSION_CATALOGUE_REVISION = '20260604-army-ops-s6-s12';

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
  PERMISSION_CATALOGUE_REVISION,
  PERMISSION_CATALOGUE_GROUPS,
  getCataloguePermissionKeysSet,
  isCataloguePermissionKey,
  inferModuleKey
};
