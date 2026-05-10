'use strict'

/**
 * Declarative manifest for offer scope dimensions.
 *
 * Rules:
 *  - `kind`        — string stored in customer_offer_scope.scope_kind
 *  - `factKey`     — field on lineFacts resolved by buildLineFacts()
 *  - `refField`    — which DB column on customer_offer_scope holds the value
 *  - `fkTable`     — table to validate FK existence (null = no FK check needed, e.g. string keys)
 *  - `fkColumn`    — PK column on fkTable for existence check
 *  - `label`       — human-readable label for UI
 *  - `pickerHint`  — describes how the CU picker should load options
 *  - `pickerApi`   — API route for the CU picker (relative path, no hostname)
 */

const SCOPE_DIMENSIONS = [
  {
    kind: 'BRAND',
    factKey: 'brandId',
    refField: 'ref_int',
    fkTable: 'dbo.home_brands',
    fkColumn: 'brand_id',
    label: 'Brand',
    pickerHint: 'multi-select from home brands list',
    pickerApi: '/api/home-brands'
  },
  {
    kind: 'SKU',
    factKey: 'skuId',
    refField: 'ref_int',
    fkTable: 'dbo.skus',
    fkColumn: 'sku_id',
    label: 'SKU / Item',
    pickerHint: 'search by SKU code or product name',
    pickerApi: '/api/skus'
  },
  {
    kind: 'PRODUCT',
    factKey: 'productId',
    refField: 'ref_int',
    fkTable: 'dbo.product_master',
    fkColumn: 'product_id',
    label: 'Product',
    pickerHint: 'search product master',
    pickerApi: '/api/skus'
  },
  {
    kind: 'PRODUCT_TYPE',
    factKey: 'productTypeKey',
    refField: 'ref_key',
    fkTable: null,
    fkColumn: null,
    label: 'Category (Product Type)',
    pickerHint: 'select from product type keys',
    pickerApi: '/api/settings/pos-product-types'
  }
]

/** Lookup by kind — O(1). Built once at startup. */
const SCOPE_BY_KIND = Object.fromEntries(SCOPE_DIMENSIONS.map((d) => [d.kind, d]))

/** Allowed kind strings (whitelist for Joi validation). */
const ALLOWED_SCOPE_KINDS = SCOPE_DIMENSIONS.map((d) => d.kind)

module.exports = { SCOPE_DIMENSIONS, SCOPE_BY_KIND, ALLOWED_SCOPE_KINDS }
