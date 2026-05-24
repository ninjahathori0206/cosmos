'use strict';

const express = require('express');
const { requireModule, requireAnyModule, requirePermission } = require('../middleware/authorize');
const { PERMISSION_CATALOGUE_GROUPS } = require('../config/permissionsCatalogue');
const { getStoreTypeMetaForApi } = require('../config/storeTypesCatalog');
const {
  getSkuUnitStatusCatalog,
  getSkuUnitLocationTypeCatalog
} = require('../config/skuUnitStatusCatalog');
const { getTransferRequestListViewsForApi } = require('../config/transferRequestListViewsCatalog');

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
    res.json({
      success: true,
      data: {
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

module.exports = router;
module.exports.transferRequestListViewsMiddleware = transferRequestListViewsMiddleware;
module.exports.handleTransferRequestListViewsGet = handleTransferRequestListViewsGet;
