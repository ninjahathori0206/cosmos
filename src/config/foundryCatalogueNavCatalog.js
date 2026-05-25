'use strict'

const {
  P,
  ALL_CATALOGUE_PERMISSION_KEYS
} = require('./foundryCatalogueAuth')

/**
 * Foundry Catalogue sidebar — SSOT for nav id, labels, and RBAC keys.
 * Nav uses granular keys only so Command Unit checkboxes match visible menu items.
 * foundry.catalogue.view = SKU Catalogue only (not lens / master).
 */

/** @typedef {{ page: string, label: string, icon: string, view_permissions: string[], edit_permissions: string[], api_notes?: string }} FoundryCatalogueNavItem */

/** @type {FoundryCatalogueNavItem[]} */
const FOUNDRY_CATALOGUE_NAV = [
  {
    page: 'sku-catalogue',
    label: 'SKU Catalogue',
    icon: '🗂️',
    view_permissions: [P.SKU_VIEW],
    edit_permissions: [P.SKU_EDIT],
    api_notes: 'GET/POST /api/skus/*'
  },
  {
    page: 'stock-view',
    label: 'Stock View',
    icon: '📦',
    view_permissions: [P.STOCK_VIEW],
    edit_permissions: [P.STOCK_CREATE],
    api_notes: 'Stock transfers / stock-transfer-docs'
  },
  {
    page: 'lens-packages',
    label: 'Lens packages',
    icon: '👁️',
    view_permissions: [P.LENS_PACKAGES_VIEW],
    edit_permissions: [P.LENS_PACKAGES_EDIT],
    api_notes: 'Lens categories + packages'
  },
  {
    page: 'lens-addons',
    label: 'Lens add-ons',
    icon: '➕',
    view_permissions: [P.LENS_ADDONS_VIEW],
    edit_permissions: [P.LENS_ADDONS_EDIT],
    api_notes: 'Lens add-ons'
  },
  {
    page: 'lens-package-addons',
    label: 'Lens link matrix',
    icon: '▦',
    view_permissions: [P.LENS_MATRIX_VIEW],
    edit_permissions: [P.LENS_MATRIX_EDIT],
    api_notes: 'Package ↔ add-on links'
  },
  {
    page: 'lens-wizard-rules',
    label: 'Lens wizard rules',
    icon: '⚙',
    view_permissions: [P.LENS_WIZARD_VIEW],
    edit_permissions: [P.LENS_WIZARD_EDIT],
    api_notes: 'Product-type lens wizard policies'
  },
  {
    page: 'master-catalogue',
    label: 'Master Catalogue',
    icon: '📖',
    view_permissions: [P.MASTER_VIEW, P.PURCHASES_VIEW],
    edit_permissions: [P.MASTER_EDIT, P.PURCHASES_CREATE, P.PURCHASES_EDIT],
    api_notes: 'GET/POST /api/products/*'
  }
]

/** @param {string} page */
function getFoundryCatalogueNavItem(page) {
  const p = String(page || '').trim()
  return FOUNDRY_CATALOGUE_NAV.find((row) => row.page === p) || null
}

function getFoundryCatalogueNavForApi() {
  return FOUNDRY_CATALOGUE_NAV.map((row) => ({
    page: row.page,
    label: row.label,
    icon: row.icon,
    view_permissions: row.view_permissions.slice(),
    edit_permissions: row.edit_permissions.slice(),
    view_permission: row.view_permissions[0],
    api_notes: row.api_notes || ''
  }))
}

/** Comma-separated OR string for HTML data-foundry-permission. */
function navViewPermissionAttr(page) {
  const row = getFoundryCatalogueNavItem(page)
  return row ? row.view_permissions.join(',') : ''
}

/** Edit keys for a catalogue page (client checks). */
function getCatalogueEditPermissionsForPage(page) {
  const row = getFoundryCatalogueNavItem(page)
  return row ? row.edit_permissions.slice() : [P.SKU_EDIT]
}

/** View keys for a catalogue page (client route guard). */
function getCatalogueViewPermissionsForPage(page) {
  const row = getFoundryCatalogueNavItem(page)
  return row ? row.view_permissions.slice() : []
}

module.exports = {
  FOUNDRY_CATALOGUE_NAV,
  FOUNDRY_CATALOGUE_PERMISSION_KEYS: ALL_CATALOGUE_PERMISSION_KEYS,
  getFoundryCatalogueNavItem,
  getFoundryCatalogueNavForApi,
  navViewPermissionAttr,
  getCatalogueEditPermissionsForPage,
  getCatalogueViewPermissionsForPage
}
