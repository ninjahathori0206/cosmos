'use strict';

const express = require('express');
const Joi = require('joi');
const { requireModule, requirePermission, requireAnyModule } = require('../middleware/authorize');
const {
  labelPrintFormatWriteSchema,
  normalizeLabelPrintConfig,
  FORMAT_KEY_RE,
  slugifyFormatKey
} = require('../config/labelPrintFormatSchema');

const JOI_VALIDATE_OPTS = { stripUnknown: true, abortEarly: false };

function prepareWriteBody(body) {
  const out = body && typeof body === 'object' ? Object.assign({}, body) : {};
  if (out.config != null) {
    out.config = normalizeLabelPrintConfig(out.config);
  }
  return out;
}
const {
  listLabelPrintFormats,
  getLabelPrintFormat,
  createLabelPrintFormat,
  updateLabelPrintFormat,
  deleteLabelPrintFormat
} = require('../services/labelPrintFormatService');

const router = express.Router();

const moduleMiddleware = [requireAnyModule(['command_unit', 'foundry'])];

const viewMiddleware = [
  ...moduleMiddleware,
  requirePermission('foundry.label_formats.view')
];

const editMiddleware = [
  ...moduleMiddleware,
  requirePermission('foundry.label_formats.edit')
];

const createSchema = labelPrintFormatWriteSchema.keys({
  format_key: Joi.string().pattern(FORMAT_KEY_RE).optional()
});

const updateSchema = labelPrintFormatWriteSchema.fork(
  ['name', 'config'],
  (s) => s.optional()
).min(1);

router.get('/', ...viewMiddleware, async (req, res, next) => {
  try {
    const formats = await listLabelPrintFormats({ activeOnly: true });
    return res.json({ success: true, data: formats });
  } catch (err) {
    return next(err);
  }
});

router.get('/:formatKey', ...viewMiddleware, async (req, res, next) => {
  try {
    const row = await getLabelPrintFormat(req.params.formatKey);
    return res.json({ success: true, data: row });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ success: false, message: err.message });
    return next(err);
  }
});

router.post('/', ...editMiddleware, async (req, res, next) => {
  try {
    const { error, value } = createSchema.validate(prepareWriteBody(req.body), JOI_VALIDATE_OPTS);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }
    const formatKey = value.format_key || slugifyFormatKey(value.name);
    if (!formatKey) {
      return res.status(400).json({ success: false, message: 'Could not derive format_key from name.' });
    }
    const row = await createLabelPrintFormat({ ...value, format_key: formatKey });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ success: false, message: err.message });
    if (err.statusCode === 409) return res.status(409).json({ success: false, message: err.message });
    if (err.statusCode === 503) return res.status(503).json({ success: false, message: err.message });
    return next(err);
  }
});

router.put('/:formatKey', ...editMiddleware, async (req, res, next) => {
  try {
    const formatKey = String(req.params.formatKey || '').trim();
    const { error, value } = updateSchema.validate(prepareWriteBody(req.body), JOI_VALIDATE_OPTS);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }
    const row = await updateLabelPrintFormat(formatKey, value);
    return res.json({ success: true, data: row });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ success: false, message: err.message });
    if (err.statusCode === 400) return res.status(400).json({ success: false, message: err.message });
    if (err.statusCode === 503) return res.status(503).json({ success: false, message: err.message });
    return next(err);
  }
});

router.delete('/:formatKey', ...editMiddleware, async (req, res, next) => {
  try {
    const formatKey = String(req.params.formatKey || '').trim();
    const result = await deleteLabelPrintFormat(formatKey);
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ success: false, message: err.message });
    if (err.statusCode === 503) return res.status(503).json({ success: false, message: err.message });
    return next(err);
  }
});

module.exports = router;
