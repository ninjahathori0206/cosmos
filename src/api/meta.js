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
const {
  ZONE_CONTENT_TOKENS,
  ZONE_CONTENT_PRESETS,
  PRINT_ORIENTATION_CATALOG
} = require('../config/labelPrintFormatSchema');
const { FOUNDRY_LABEL_FORMAT_READ_PERMS } = require('../config/foundryLabelFormatReadPerms');
const { getTreasuryLedgerMetaForApi } = require('../config/treasuryLedgerCatalog');
const { getPaymentMachineProviderCatalog } = require('../config/paymentMachineProviderCatalog')
const { MEMBERSHIP_CAPABILITY_GROUPS } = require('../config/membershipCapabilityGroups');

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
  '/label-zone-content-tokens',
  requireAnyModule(['command_unit', 'foundry']),
  requirePermission(...FOUNDRY_LABEL_FORMAT_READ_PERMS),
  (req, res) => {
    res.json({
      success: true,
      data: {
        tokens: ZONE_CONTENT_TOKENS,
        presets: ZONE_CONTENT_PRESETS
      }
    });
  }
);

router.get(
  '/label-print-orientations',
  requireAnyModule(['command_unit', 'foundry']),
  requirePermission(...FOUNDRY_LABEL_FORMAT_READ_PERMS),
  (req, res) => {
    res.json({
      success: true,
      data: { orientations: PRINT_ORIENTATION_CATALOG }
    });
  }
);

router.get(
  '/label-print-formats',
  requireAnyModule(['command_unit', 'foundry']),
  requirePermission(...FOUNDRY_LABEL_FORMAT_READ_PERMS),
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

router.get(
  '/treasury-ledgers',
  requireAnyModule(['storepilot', 'finance']),
  requirePermission('storepilot.collections.view', 'finance.collections.view'),
  (req, res) => {
    res.json({
      success: true,
      data: getTreasuryLedgerMetaForApi()
    });
  }
);

router.get(
  '/payment-machine-providers',
  requireAnyModule(['storepilot', 'finance']),
  requirePermission('storepilot.collections.view', 'finance.collections.view'),
  (req, res) => {
    res.json({
      success: true,
      data: { providers: getPaymentMachineProviderCatalog() }
    });
  }
);

router.get(
  '/membership-capability-groups',
  requireAnyModule(['command_unit', 'cx', 'pos']),
  (req, res) => {
    res.json({ success: true, data: MEMBERSHIP_CAPABILITY_GROUPS });
  }
);

module.exports = router;
module.exports.transferRequestListViewsMiddleware = transferRequestListViewsMiddleware;
module.exports.handleTransferRequestListViewsGet = handleTransferRequestListViewsGet;
