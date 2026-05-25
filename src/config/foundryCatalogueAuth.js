'use strict'

/**
 * Foundry Catalogue RBAC — permission keys for API middleware.
 * Phase B: lens + master use granular keys only. Coarse foundry.catalogue.* = SKU APIs only.
 */

const LEGACY = {
  CATALOGUE_VIEW: 'foundry.catalogue.view',
  CATALOGUE_EDIT: 'foundry.catalogue.edit'
}

const P = {
  SKU_VIEW: 'foundry.catalogue.view',
  SKU_EDIT: 'foundry.catalogue.edit',
  STOCK_VIEW: 'foundry.stock.view',
  STOCK_CREATE: 'foundry.stock.create',
  LENS_PACKAGES_VIEW: 'foundry.lens.packages.view',
  LENS_PACKAGES_EDIT: 'foundry.lens.packages.edit',
  LENS_ADDONS_VIEW: 'foundry.lens.addons.view',
  LENS_ADDONS_EDIT: 'foundry.lens.addons.edit',
  LENS_MATRIX_VIEW: 'foundry.lens.matrix.view',
  LENS_MATRIX_EDIT: 'foundry.lens.matrix.edit',
  LENS_WIZARD_VIEW: 'foundry.lens.wizard.view',
  LENS_WIZARD_EDIT: 'foundry.lens.wizard.edit',
  MASTER_VIEW: 'foundry.master_catalogue.view',
  MASTER_EDIT: 'foundry.master_catalogue.edit',
  PURCHASES_VIEW: 'foundry.purchases.view',
  PURCHASES_CREATE: 'foundry.purchases.create',
  PURCHASES_EDIT: 'foundry.purchases.edit'
}

const LENS_ADMIN_GET_VIEW = [
  P.LENS_PACKAGES_VIEW,
  P.LENS_ADDONS_VIEW,
  P.LENS_MATRIX_VIEW,
  P.LENS_WIZARD_VIEW
]

const LENS_PACKAGES_EDIT = [P.LENS_PACKAGES_EDIT]
const LENS_ADDONS_EDIT = [P.LENS_ADDONS_EDIT]
const LENS_MATRIX_EDIT = [P.LENS_MATRIX_EDIT]
const LENS_WIZARD_VIEW = [P.LENS_WIZARD_VIEW]
const LENS_WIZARD_EDIT = [P.LENS_WIZARD_EDIT]

const MASTER_VIEW = [P.MASTER_VIEW, P.PURCHASES_VIEW]
const MASTER_EDIT = [P.MASTER_EDIT, LEGACY.CATALOGUE_EDIT, P.PURCHASES_CREATE, P.PURCHASES_EDIT]

const SKU_VIEW = [P.SKU_VIEW]
const SKU_EDIT = [P.SKU_EDIT]

/** All assignable catalogue permission keys (Command Unit / meta). */
const ALL_CATALOGUE_PERMISSION_KEYS = [
  P.SKU_VIEW,
  P.SKU_EDIT,
  P.LENS_PACKAGES_VIEW,
  P.LENS_PACKAGES_EDIT,
  P.LENS_ADDONS_VIEW,
  P.LENS_ADDONS_EDIT,
  P.LENS_MATRIX_VIEW,
  P.LENS_MATRIX_EDIT,
  P.LENS_WIZARD_VIEW,
  P.LENS_WIZARD_EDIT,
  P.MASTER_VIEW,
  P.MASTER_EDIT,
  P.STOCK_VIEW,
  P.STOCK_CREATE
]

/** Map coarse catalogue.view → granular view keys (migration / role expansion). */
const GRANULAR_VIEW_FROM_LEGACY_CATALOGUE_VIEW = [
  P.LENS_PACKAGES_VIEW,
  P.LENS_ADDONS_VIEW,
  P.LENS_MATRIX_VIEW,
  P.LENS_WIZARD_VIEW,
  P.MASTER_VIEW
]

/** Map coarse catalogue.edit → granular edit keys. */
const GRANULAR_EDIT_FROM_LEGACY_CATALOGUE_EDIT = [
  P.LENS_PACKAGES_EDIT,
  P.LENS_ADDONS_EDIT,
  P.LENS_MATRIX_EDIT,
  P.LENS_WIZARD_EDIT,
  P.MASTER_EDIT
]

module.exports = {
  P,
  LEGACY,
  LENS_ADMIN_GET_VIEW,
  LENS_PACKAGES_EDIT,
  LENS_ADDONS_EDIT,
  LENS_MATRIX_EDIT,
  LENS_WIZARD_VIEW,
  LENS_WIZARD_EDIT,
  MASTER_VIEW,
  MASTER_EDIT,
  SKU_VIEW,
  SKU_EDIT,
  ALL_CATALOGUE_PERMISSION_KEYS,
  GRANULAR_VIEW_FROM_LEGACY_CATALOGUE_VIEW,
  GRANULAR_EDIT_FROM_LEGACY_CATALOGUE_EDIT
}
