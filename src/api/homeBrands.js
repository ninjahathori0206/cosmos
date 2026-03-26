const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');

const router = express.Router();

const createSchema = Joi.object({
  brand_name: Joi.string().max(200).required(),
  brand_code: Joi.string().max(10).required(),
  brand_description: Joi.string().max(500).allow('', null),
  brand_logo_url: Joi.string().max(500).allow('', null)
});

const updateSchema = Joi.object({
  brand_name: Joi.string().max(200).required(),
  brand_description: Joi.string().max(500).allow('', null),
  brand_logo_url: Joi.string().max(500).allow('', null)
});

router.get('/', async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_HomeBrand_GetAll', {});
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const result = await executeStoredProcedure('sp_HomeBrand_GetById', {
      brand_id: { type: sql.Int, value: id }
    });
    const row = result.recordset && result.recordset[0];
    if (!row) {
      return res.status(404).json({ success: false, message: 'Home brand not found' });
    }
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }

    const userId = req.user && req.user.user_id ? Number(req.user.user_id) : null;

    const result = await executeStoredProcedure('sp_HomeBrand_Create', {
      brand_name: { type: sql.VarChar(200), value: value.brand_name },
      brand_code: { type: sql.VarChar(10), value: value.brand_code },
      brand_description: { type: sql.VarChar(500), value: value.brand_description || null },
      brand_logo_url: { type: sql.VarChar(500), value: value.brand_logo_url || null },
      created_by: { type: sql.Int, value: userId }
    });

    return res.status(201).json({
      success: true,
      data: result.recordset && result.recordset[0]
    });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }

    const result = await executeStoredProcedure('sp_HomeBrand_Update', {
      brand_id: { type: sql.Int, value: id },
      brand_name: { type: sql.VarChar(200), value: value.brand_name },
      brand_description: { type: sql.VarChar(500), value: value.brand_description || null },
      brand_logo_url: { type: sql.VarChar(500), value: value.brand_logo_url || null }
    });

    return res.json({
      success: true,
      data: result.recordset && result.recordset[0]
    });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const result = await executeStoredProcedure('sp_HomeBrand_Deactivate', {
      brand_id: { type: sql.Int, value: id }
    });
    return res.json({
      success: true,
      data: result.recordset && result.recordset[0]
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

