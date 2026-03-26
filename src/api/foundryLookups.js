const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');

const router = express.Router();

const createSchema = Joi.object({
  lookup_type:   Joi.string().max(50).required(),
  lookup_key:    Joi.string().max(100).required(),
  lookup_label:  Joi.string().max(200).required(),
  description:   Joi.string().max(500).allow(null, '').optional(),
  display_order: Joi.number().integer().min(0).optional()
});

const updateSchema = Joi.object({
  lookup_label:  Joi.string().max(200).required(),
  description:   Joi.string().max(500).allow(null, '').optional(),
  display_order: Joi.number().integer().min(0).optional(),
  is_active:     Joi.boolean().optional()
});

// GET /api/foundry-lookups?type=source_type  — active values for one type
// GET /api/foundry-lookups                   — all values (all types, for admin)
router.get('/', async (req, res, next) => {
  try {
    const { type } = req.query;
    let result;
    if (type) {
      result = await executeStoredProcedure('sp_FoundryLookup_GetByType', {
        lookup_type: { type: sql.VarChar(50), value: type }
      });
    } else {
      result = await executeStoredProcedure('sp_FoundryLookup_GetAll', {});
    }
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

// POST /api/foundry-lookups
router.post('/', async (req, res, next) => {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
    }

    const result = await executeStoredProcedure('sp_FoundryLookup_Create', {
      lookup_type:   { type: sql.VarChar(50),  value: value.lookup_type },
      lookup_key:    { type: sql.VarChar(100), value: value.lookup_key.toUpperCase().replace(/\s+/g, '_') },
      lookup_label:  { type: sql.VarChar(200), value: value.lookup_label },
      description:   { type: sql.VarChar(500), value: value.description || null },
      display_order: { type: sql.Int,          value: value.display_order || 0 }
    });

    return res.status(201).json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
    return next(err);
  }
});

// PUT /api/foundry-lookups/:id
router.put('/:id', async (req, res, next) => {
  try {
    const lookupId = Number(req.params.id);
    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });
    }

    const result = await executeStoredProcedure('sp_FoundryLookup_Update', {
      lookup_id:     { type: sql.Int,          value: lookupId },
      lookup_label:  { type: sql.VarChar(200), value: value.lookup_label },
      description:   { type: sql.VarChar(500), value: value.description || null },
      display_order: { type: sql.Int,          value: value.display_order ?? 0 },
      is_active:     { type: sql.Bit,          value: value.is_active !== false ? 1 : 0 }
    });

    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
    return next(err);
  }
});

// DELETE /api/foundry-lookups/:id  — soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    const lookupId = Number(req.params.id);
    const result = await executeStoredProcedure('sp_FoundryLookup_Delete', {
      lookup_id: { type: sql.Int, value: lookupId }
    });
    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
    return next(err);
  }
});

module.exports = router;
