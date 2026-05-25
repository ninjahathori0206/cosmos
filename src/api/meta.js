'use strict';

const express = require('express');
const { requireModule, requireAnyModule, requirePermission } = require('../middleware/authorize');
const {
  PERMISSION_CATALOGUE_GROUPS,
  PERMISSION_CATALOGUE_REVISION
} = require('../config/permissionsCatalogue');
const { getStoreTypeMetaForApi } = require('../config/storeTypesCatalog');
const {
  getSkuUnitStatusCatalog,
  getSkuUnitLocationTypeCatalog
} = require('../config/skuUnitStatusCatalog');
const { getTransferRequestListViewsForApi } = require('../config/transferRequestListViewsCatalog');
const { getLabWorkflowTransitionsForApi } = require('../config/labWorkflowTransitionsCatalog');
const { getFoundryCatalogueNavForApi } = require('../config/foundryCatalogueNavCatalog');
const { ALL_CATALOGUE_PERMISSION_KEYS } = require('../config/foundryCatalogueAuth');
const { listLabelPrintFormats } = require('../services/labelPrintFormatService');

const router = express.Router();

router.get(
  '/store-types',
  requireModule('command_unit'),
  requirePermission('command_unit.stores.view'),
  async (req, res, next) => {
    try {
      res.json({
        success: true,
        data: await getStoreTypeMetaForApi()
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.get(
  '/permissions-catalogue',
  requireModule('command_unit'),
  requirePermission('command_unit.roles.view'),
  (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: {
        revision: PERMISSION_CATALOGUE_REVISION,
        groups: PERMISSION_CATALOGUE_GROUPS
      }
    });
  }
);

function handleTransferRequestListViewsGet(req, res) {
  res.json({
    success: true,
    data: getTransferRequestListViewsForApi()
  });
}

const transferRequestListViewsMiddleware = [
  requireAnyModule(['foundry', 'storepilot']),
  requirePermission('foundry.transfers.view', 'storepilot.transfers.view'),
  handleTransferRequestListViewsGet
];

router.get('/transfer-request-list-views', ...transferRequestListViewsMiddleware);

router.get(
  '/lab-workflow-transitions',
  requireAnyModule(['foundry', 'command_unit', 'storepilot', 'pos']),
  (req, res) => {
    res.json({
      success: true,
      data: {
        transitions: getLabWorkflowTransitionsForApi()
      }
    });
  }
);

router.get(
  '/foundry-catalogue-nav',
  requireModule('foundry'),
  (req, res) => {
    res.json({
      success: true,
      data: {
        nav: getFoundryCatalogueNavForApi(),
        permission_keys: ALL_CATALOGUE_PERMISSION_KEYS.slice()
      }
    });
  }
);

router.get(
  '/sku-unit-statuses',
  requireAnyModule(['command_unit', 'foundry', 'storepilot']),
  requirePermission(
    'command_unit.settings.view',
    'foundry.stock.view',
    'storepilot.stock.view'
  ),
  (req, res) => {
    res.json({
      success: true,
      data: {
        statuses: getSkuUnitStatusCatalog(),
        location_types: getSkuUnitLocationTypeCatalog()
      }
    });
  }
);

router.get(
  '/label-print-formats',
  requireModule('foundry'),
  requirePermission(
    'foundry.label_formats.view',
    'foundry.digitisation.view',
    'foundry.warehouse.view',
    'foundry.purchases.view'
  ),
  async (req, res, next) => {
    try {
      const formats = await listLabelPrintFormats({ activeOnly: true });
      res.json({
        success: true,
        data: { formats }
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
module.exports.transferRequestListViewsMiddleware = transferRequestListViewsMiddleware;
module.exports.handleTransferRequestListViewsGet = handleTransferRequestListViewsGet;
