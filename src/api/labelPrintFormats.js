'use strict';

const express = require('express');
const Joi = require('joi');
const { requireModule, requirePermission } = require('../middleware/authorize');
const {
  labelPrintConfigSchema,
  FORMAT_KEY_RE,
  slugifyFormatKey
} = require('../config/labelPrintFormatSchema');
const {
  createLabelPrintFormat,
  updateLabelPrintFormat,
  deleteLabelPrintFormat
} = require('../services/labelPrintFormatService');

const router = express.Router();

const editMiddleware = [
  requireModule('foundry'),
  requirePermission('foundry.label_formats.edit')
];

const createSchema = Joi.object({
  format_key: Joi.string().pattern(FORMAT_KEY_RE).optional(),
  name: Joi.string().trim().min(1).max(120).required(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
  config: labelPrintConfigSchema.required(),
  is_default: Joi.boolean().optional(),
  sort_order: Joi.number().integer().min(0).max(9999).optional(),
  is_active: Joi.boolean().optional()
});

const updateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).optional(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
  config: labelPrintConfigSchema.optional(),
  is_default: Joi.boolean().optional(),
  sort_order: Joi.number().integer().min(0).max(9999).optional(),
  is_active: Joi.boolean().optional()
}).min(1);

router.post('/', ...editMiddleware, async (req, res, next) => {
  try {
    const { error, value } = createSchema.validate(req.body);
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
    const { error, value } = updateSchema.validate(req.body);
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
