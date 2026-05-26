'use strict';

/** OR keys for reading purchase headers / SKUs (Foundry). */
const FOUNDRY_PURCHASE_READ_PERMS = Object.freeze([
  'foundry.purchases.view',
  'foundry.bill_verification.view',
  'foundry.branding.view',
  'foundry.digitisation.view',
  'foundry.warehouse.view'
]);

/** OR keys for listing label print format presets (meta + barcode modal). */
const FOUNDRY_LABEL_FORMAT_READ_PERMS = Object.freeze([
  ...FOUNDRY_PURCHASE_READ_PERMS,
  'foundry.label_formats.view',
  'foundry.stock.view'
]);

module.exports = {
  FOUNDRY_PURCHASE_READ_PERMS,
  FOUNDRY_LABEL_FORMAT_READ_PERMS
};
