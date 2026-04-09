const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');
const { requireModule, requirePermission } = require('../middleware/authorize');

const router = express.Router();

const foundryMakersView = [
  requireModule('foundry'),
  requirePermission('foundry.makers.view')
];
const foundryMakersCreate = [
  requireModule('foundry'),
  requirePermission('foundry.makers.create')
];
const foundryMakersEdit = [
  requireModule('foundry'),
  requirePermission('foundry.makers.edit')
];

const createSchema = Joi.object({
  maker_name:  Joi.string().max(200).required(),
  maker_code:  Joi.string().max(50).required(),
  description: Joi.string().max(500).allow('', null),
  country:     Joi.string().max(100).allow('', null)
});

const updateSchema = Joi.object({
  maker_name:  Joi.string().max(200),
  maker_code:  Joi.string().max(50),
  description: Joi.string().max(500).allow('', null),
  country:     Joi.string().max(100).allow('', null),
  is_active:   Joi.boolean()
});

router.get('/', ...foundryMakersView, async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_MakerMaster_GetAll', {
      include_inactive: { type: sql.Bit, value: req.query.all === '1' ? 1 : 0 }
    });
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) { return next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_MakerMaster_GetById', {
      maker_id: { type: sql.Int, value: Number(req.params.id) }
    });
    const row = result.recordset && result.recordset[0];
    if (!row) return res.status(404).json({ success: false, message: 'Maker not found' });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

router.post('/', ...foundryMakersCreate, async (req, res, next) => {
  try {
    const { error, value } = createSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
    const result = await executeStoredProcedure('sp_MakerMaster_Create', {
      maker_name:  { type: sql.VarChar(200), value: value.maker_name },
      maker_code:  { type: sql.VarChar(50),  value: value.maker_code },
      description: { type: sql.VarChar(500), value: value.description || null },
      country:     { type: sql.VarChar(100), value: value.country || null }
    });
    return res.status(201).json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
    return next(err);
  }
});

router.put('/:id', ...foundryMakersEdit, async (req, res, next) => {
  try {
    const { error, value } = updateSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
    const result = await executeStoredProcedure('sp_MakerMaster_Update', {
      maker_id:    { type: sql.Int,         value: Number(req.params.id) },
      maker_name:  { type: sql.VarChar(200), value: value.maker_name  || null },
      maker_code:  { type: sql.VarChar(50),  value: value.maker_code  || null },
      description: { type: sql.VarChar(500), value: value.description || null },
      country:     { type: sql.VarChar(100), value: value.country     || null },
      is_active:   { type: sql.Bit,          value: value.is_active != null ? (value.is_active ? 1 : 0) : null }
    });
    const row = result.recordset && result.recordset[0];
    if (!row) return res.status(404).json({ success: false, message: 'Maker not found' });
    return res.json({ success: true, data: row });
  } catch (err) {
    if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
    return next(err);
  }
});

module.exports = router;
