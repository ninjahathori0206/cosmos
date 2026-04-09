/*
  migrate_permissions_v2.sql
  ───────────────────────────────────────────────────────────────────────────
  Migrates all role_permissions rows from the old inconsistent strings
  (manage / generate / approve / verify / transact / export) to the new
  uniform three-level format: {module}.{feature}.{view|create|edit}

  Safe to re-run (idempotent).
  Run ONCE on the database, then instruct all users to re-login so their
  JWTs are refreshed with the new permission strings.
*/
USE [CosmosERP];
BEGIN TRANSACTION;

-- ─────────────────────────────────────────────────────────────────────────────
-- COMMAND UNIT
-- ─────────────────────────────────────────────────────────────────────────────

-- command_unit.stores.manage  →  .create + .edit
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'command_unit.stores.create', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'command_unit.stores.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='command_unit.stores.create');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'command_unit.stores.edit', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'command_unit.stores.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='command_unit.stores.edit');

DELETE FROM dbo.role_permissions WHERE permission = 'command_unit.stores.manage';

-- command_unit.users.manage  →  .create + .edit
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'command_unit.users.create', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'command_unit.users.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='command_unit.users.create');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'command_unit.users.edit', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'command_unit.users.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='command_unit.users.edit');

DELETE FROM dbo.role_permissions WHERE permission = 'command_unit.users.manage';

-- command_unit.roles.manage  →  .create + .edit
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'command_unit.roles.create', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'command_unit.roles.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='command_unit.roles.create');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'command_unit.roles.edit', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'command_unit.roles.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='command_unit.roles.edit');

DELETE FROM dbo.role_permissions WHERE permission = 'command_unit.roles.manage';

-- command_unit.modules.manage  →  .edit
UPDATE dbo.role_permissions SET permission = 'command_unit.modules.edit'
WHERE permission = 'command_unit.modules.manage';

-- command_unit.settings.manage  →  .edit
UPDATE dbo.role_permissions SET permission = 'command_unit.settings.edit'
WHERE permission = 'command_unit.settings.manage';

-- ─────────────────────────────────────────────────────────────────────────────
-- FOUNDRY — PROCUREMENT
-- ─────────────────────────────────────────────────────────────────────────────

-- foundry.purchases.manage  →  .edit
UPDATE dbo.role_permissions SET permission = 'foundry.purchases.edit'
WHERE permission = 'foundry.purchases.manage';

-- foundry.bill.verify  →  foundry.bill_verification.create
UPDATE dbo.role_permissions SET permission = 'foundry.bill_verification.create'
WHERE permission = 'foundry.bill.verify';

-- foundry.bill.approve_discrepancy  →  foundry.bill_verification.edit
UPDATE dbo.role_permissions SET permission = 'foundry.bill_verification.edit'
WHERE permission = 'foundry.bill.approve_discrepancy';

-- add foundry.bill_verification.view for all roles that can create or edit
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT DISTINCT rp.role_key, 'foundry.bill_verification.view', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission IN ('foundry.bill_verification.create','foundry.bill_verification.edit')
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.bill_verification.view');

-- foundry.branding.manage  →  .view + .create + .edit
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'foundry.branding.view', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'foundry.branding.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.branding.view');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'foundry.branding.create', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'foundry.branding.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.branding.create');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'foundry.branding.edit', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'foundry.branding.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.branding.edit');

DELETE FROM dbo.role_permissions WHERE permission = 'foundry.branding.manage';

-- foundry.sku.generate  →  foundry.digitisation.view + .create + .edit
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'foundry.digitisation.view', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'foundry.sku.generate'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.digitisation.view');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'foundry.digitisation.create', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'foundry.sku.generate'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.digitisation.create');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'foundry.digitisation.edit', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'foundry.sku.generate'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.digitisation.edit');

DELETE FROM dbo.role_permissions WHERE permission = 'foundry.sku.generate';

-- foundry.warehouse.approve  →  foundry.warehouse.view + .create
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'foundry.warehouse.view', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'foundry.warehouse.approve'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.warehouse.view');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'foundry.warehouse.create', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'foundry.warehouse.approve'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.warehouse.create');

DELETE FROM dbo.role_permissions WHERE permission = 'foundry.warehouse.approve';

-- foundry.suppliers.manage  →  .create + .edit
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'foundry.suppliers.create', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'foundry.suppliers.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.suppliers.create');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'foundry.suppliers.edit', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'foundry.suppliers.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.suppliers.edit');

DELETE FROM dbo.role_permissions WHERE permission = 'foundry.suppliers.manage';

-- ─────────────────────────────────────────────────────────────────────────────
-- FOUNDRY — CATALOGUE / STOCK / TRANSFERS / MAKERS (new feature-specific keys)
-- ─────────────────────────────────────────────────────────────────────────────

-- All roles with foundry.purchases.view get the feature-specific view keys
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'foundry.catalogue.view', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'foundry.purchases.view'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.catalogue.view');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'foundry.stock.view', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'foundry.purchases.view'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.stock.view');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'foundry.transfers.view', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'foundry.purchases.view'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.transfers.view');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'foundry.makers.view', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'foundry.purchases.view'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.makers.view');

-- All roles with foundry.purchases.create get makers.create and transfers.create
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'foundry.makers.create', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'foundry.purchases.create'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.makers.create');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'foundry.transfers.create', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'foundry.purchases.create'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.transfers.create');

-- All roles with foundry.purchases.edit get stock.create, transfers.edit, makers.edit
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'foundry.stock.create', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'foundry.purchases.edit'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.stock.create');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'foundry.transfers.edit', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'foundry.purchases.edit'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.transfers.edit');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'foundry.makers.edit', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'foundry.purchases.edit'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='foundry.makers.edit');

-- ─────────────────────────────────────────────────────────────────────────────
-- FINANCE
-- ─────────────────────────────────────────────────────────────────────────────

-- finance.view  →  finance.dashboard.view + finance.payments.view + finance.reports.view
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'finance.dashboard.view', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'finance.view'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='finance.dashboard.view');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'finance.payments.view', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'finance.view'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='finance.payments.view');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'finance.reports.view', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'finance.view'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='finance.reports.view');

DELETE FROM dbo.role_permissions WHERE permission = 'finance.view';

-- finance.manage  →  finance.payments.create + finance.payments.edit
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'finance.payments.create', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'finance.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='finance.payments.create');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'finance.payments.edit', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'finance.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='finance.payments.edit');

DELETE FROM dbo.role_permissions WHERE permission = 'finance.manage';

-- ─────────────────────────────────────────────────────────────────────────────
-- STOREPILOT
-- ─────────────────────────────────────────────────────────────────────────────

-- storepilot.floor.manage  →  .create + .edit
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'storepilot.floor.create', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'storepilot.floor.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='storepilot.floor.create');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'storepilot.floor.edit', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'storepilot.floor.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='storepilot.floor.edit');

DELETE FROM dbo.role_permissions WHERE permission = 'storepilot.floor.manage';

-- storepilot.appointments.manage  →  .view + .create + .edit
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'storepilot.appointments.view', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'storepilot.appointments.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='storepilot.appointments.view');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'storepilot.appointments.create', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'storepilot.appointments.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='storepilot.appointments.create');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'storepilot.appointments.edit', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'storepilot.appointments.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='storepilot.appointments.edit');

DELETE FROM dbo.role_permissions WHERE permission = 'storepilot.appointments.manage';

-- storepilot.walkins.manage  →  .view + .create + .edit
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'storepilot.walkins.view', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'storepilot.walkins.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='storepilot.walkins.view');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'storepilot.walkins.create', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'storepilot.walkins.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='storepilot.walkins.create');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'storepilot.walkins.edit', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'storepilot.walkins.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='storepilot.walkins.edit');

DELETE FROM dbo.role_permissions WHERE permission = 'storepilot.walkins.manage';

-- storepilot.dashboard.view used as proxy for transfer operations → add transfers.view + .edit
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'storepilot.transfers.view', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'storepilot.dashboard.view'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='storepilot.transfers.view');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'storepilot.transfers.edit', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'storepilot.dashboard.view'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='storepilot.transfers.edit');

-- floor.create/edit roles also get transfers.create
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT DISTINCT rp.role_key, 'storepilot.transfers.create', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission IN ('storepilot.floor.create','storepilot.floor.edit')
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='storepilot.transfers.create');

-- ─────────────────────────────────────────────────────────────────────────────
-- STORE OS (POS)
-- ─────────────────────────────────────────────────────────────────────────────

-- store_os.pos.transact  →  store_os.pos.create
UPDATE dbo.role_permissions SET permission = 'store_os.pos.create'
WHERE permission = 'store_os.pos.transact';

-- store_os.inventory.manage  →  .create + .edit
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'store_os.inventory.create', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'store_os.inventory.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='store_os.inventory.create');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'store_os.inventory.edit', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'store_os.inventory.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='store_os.inventory.edit');

DELETE FROM dbo.role_permissions WHERE permission = 'store_os.inventory.manage';

-- store_os.reports.export  →  store_os.reports.create
UPDATE dbo.role_permissions SET permission = 'store_os.reports.create'
WHERE permission = 'store_os.reports.export';

-- ─────────────────────────────────────────────────────────────────────────────
-- ARMY (HR)
-- ─────────────────────────────────────────────────────────────────────────────

-- army.staff.manage  →  .create + .edit
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'army.staff.create', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'army.staff.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='army.staff.create');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'army.staff.edit', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'army.staff.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='army.staff.edit');

DELETE FROM dbo.role_permissions WHERE permission = 'army.staff.manage';

-- army.attendance.manage  →  .create + .edit
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'army.attendance.create', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'army.attendance.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='army.attendance.create');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'army.attendance.edit', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'army.attendance.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='army.attendance.edit');

DELETE FROM dbo.role_permissions WHERE permission = 'army.attendance.manage';

-- army.leaves.approve  →  army.leaves.edit
UPDATE dbo.role_permissions SET permission = 'army.leaves.edit'
WHERE permission = 'army.leaves.approve';

-- army.payroll.manage  →  .create + .edit
INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'army.payroll.create', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'army.payroll.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='army.payroll.create');

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT rp.role_key, 'army.payroll.edit', DATEADD(MINUTE,330,SYSUTCDATETIME())
FROM dbo.role_permissions rp
WHERE rp.permission = 'army.payroll.manage'
  AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions x WHERE x.role_key=rp.role_key AND x.permission='army.payroll.edit');

DELETE FROM dbo.role_permissions WHERE permission = 'army.payroll.manage';

COMMIT TRANSACTION;
PRINT 'migrate_permissions_v2: complete. All users must re-login to refresh their JWTs.';
