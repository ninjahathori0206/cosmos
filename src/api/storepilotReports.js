'use strict';

const express = require('express');
const Joi = require('joi');
const { requireModule, requirePermission } = require('../middleware/authorize');
const storepilotReportService = require('../services/storepilotReportService');
const { todayYmd } = require('../lib/cosmosIst');

const router = express.Router();

/** Parent protectedApiRouter already applies authJwt — module + permission only here. */
const reportsView = [
  requireModule('storepilot'),
  requirePermission('storepilot.reports.view')
];

function resolveStoreId(req, res) {
  const jwtStoreId = req.user && req.user.store_id != null ? Number(req.user.store_id) : null;
  if (!jwtStoreId) {
    res.status(403).json({ success: false, message: 'Store context is required. Sign in with a store account.' });
    return null;
  }
  return jwtStoreId;
}

const dayStoreQuerySchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional()
});

const dayStoreCollectionQuerySchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  channel: Joi.string().valid('new_order', 'handover').required()
});

/** GET /api/storepilot/reports/day-store?date=YYYY-MM-DD */
async function handleDayStoreReportGet(req, res, next) {
  try {
    const storeId = resolveStoreId(req, res);
    if (storeId == null) return;

    const { error, value } = dayStoreQuerySchema.validate(req.query, { abortEarly: false });
    if (error) {
      return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join(' ') });
    }

    const reportDate = value.date || todayYmd();
    const data = await storepilotReportService.getDayStoreReport(storeId, reportDate);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

router.get('/day-store', ...reportsView, handleDayStoreReportGet);

/** GET /api/storepilot/reports/day-store/collections?date=&channel=new_order|handover */
async function handleDayStoreCollectionLinesGet(req, res, next) {
  try {
    const storeId = resolveStoreId(req, res);
    if (storeId == null) return;

    const { error, value } = dayStoreCollectionQuerySchema.validate(req.query, { abortEarly: false });
    if (error) {
      return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join(' ') });
    }

    const lines = await storepilotReportService.getDayStoreCollectionLines(
      storeId,
      value.date,
      value.channel
    );
    return res.json({
      success: true,
      data: {
        report_date: value.date,
        channel: value.channel,
        lines
      }
    });
  } catch (err) {
    return next(err);
  }
}

router.get('/day-store/collections', ...reportsView, handleDayStoreCollectionLinesGet);

module.exports = router;
module.exports.reportsViewMiddleware = reportsView;
module.exports.handleDayStoreReportGet = handleDayStoreReportGet;
module.exports.handleDayStoreCollectionLinesGet = handleDayStoreCollectionLinesGet;
