'use strict';

const express = require('express');
const { requireModule, requirePermission } = require('../middleware/authorize');
const { PERMISSION_CATALOGUE_GROUPS } = require('../config/permissionsCatalogue');

const router = express.Router();

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

module.exports = router;
