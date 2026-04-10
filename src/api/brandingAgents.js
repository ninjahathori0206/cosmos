const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');
const { requireModule, requirePermission } = require('../middleware/authorize');

const router = express.Router();

const foundryBrandingView   = [requireModule('foundry'), requirePermission('foundry.branding.view')];
const foundryBrandingCreate = [requireModule('foundry'), requirePermission('foundry.branding.create')];
const foundryBrandingEdit   = [requireModule('foundry'), requirePermission('foundry.branding.edit')];

const createSchema = Joi.object({
  agent_name:    Joi.string().max(200).required(),
  agent_code:    Joi.string().max(20).required(),
  city:          Joi.string().max(100).allow('', null),
  contact_name:  Joi.string().max(100).allow('', null),
  contact_phone: Joi.string().max(30).allow('', null)
});

const updateSchema = Joi.object({
  agent_name:    Joi.string().max(200),
  agent_code:    Joi.string().max(20),
  city:          Joi.string().max(100).allow('', null),
  contact_name:  Joi.string().max(100).allow('', null),
  contact_phone: Joi.string().max(30).allow('', null),
  is_active:     Joi.boolean()
});

router.get('/', ...foundryBrandingView, async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_BrandingAgent_GetAll', {
      include_inactive: { type: sql.Bit, value: req.query.all === '1' ? 1 : 0 }
    });
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) { return next(err); }
});

router.get('/:id', ...foundryBrandingView, async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_BrandingAgent_GetById', {
      agent_id: { type: sql.Int, value: Number(req.params.id) }
    });
    const row = result.recordset && result.recordset[0];
    if (!row) return res.status(404).json({ success: false, message: 'Branding agent not found' });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

router.post('/', ...foundryBrandingCreate, async (req, res, next) => {
  try {
    const { error, value } = createSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
    const result = await executeStoredProcedure('sp_BrandingAgent_Create', {
      agent_name:    { type: sql.NVarChar(200), value: value.agent_name },
      agent_code:    { type: sql.VarChar(20),   value: value.agent_code },
      city:          { type: sql.NVarChar(100), value: value.city          || null },
      contact_name:  { type: sql.NVarChar(100), value: value.contact_name  || null },
      contact_phone: { type: sql.VarChar(30),   value: value.contact_phone || null }
    });
    return res.status(201).json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
    return next(err);
  }
});

router.put('/:id', ...foundryBrandingEdit, async (req, res, next) => {
  try {
    const { error, value } = updateSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
    const result = await executeStoredProcedure('sp_BrandingAgent_Update', {
      agent_id:      { type: sql.Int,           value: Number(req.params.id) },
      agent_name:    { type: sql.NVarChar(200), value: value.agent_name    || null },
      agent_code:    { type: sql.VarChar(20),   value: value.agent_code    || null },
      city:          { type: sql.NVarChar(100), value: value.city          !== undefined ? (value.city || null) : null },
      contact_name:  { type: sql.NVarChar(100), value: value.contact_name  !== undefined ? (value.contact_name || null) : null },
      contact_phone: { type: sql.VarChar(30),   value: value.contact_phone !== undefined ? (value.contact_phone || null) : null },
      is_active:     { type: sql.Bit,           value: value.is_active != null ? (value.is_active ? 1 : 0) : null }
    });
    const row = result.recordset && result.recordset[0];
    if (!row) return res.status(404).json({ success: false, message: 'Branding agent not found' });
    return res.json({ success: true, data: row });
  } catch (err) {
    if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
    return next(err);
  }
});

router.delete('/:id', ...foundryBrandingEdit, async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_BrandingAgent_Deactivate', {
      agent_id: { type: sql.Int, value: Number(req.params.id) }
    });
    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
    return next(err);
  }
});

module.exports = router;
