const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');

const router = express.Router();

const supplierSchema = Joi.object({
  vendor_name:           Joi.string().max(200).required(),
  vendor_code:           Joi.string().max(20).allow('', null),
  city:                  Joi.string().max(100).allow('', null),
  state:                 Joi.string().max(100).allow('', null),
  gstin:                 Joi.string().max(20).allow('', null),
  contact_person:        Joi.string().max(200).allow('', null),
  contact_phone:         Joi.string().max(20).allow('', null),
  payment_terms:         Joi.string().max(200).allow('', null),
  credit_days:           Joi.number().integer().min(0).max(365).allow(null),
  opening_balance:       Joi.number().min(0).default(0),
  bank_name:             Joi.string().max(100).allow('', null),
  bank_account_no:       Joi.string().max(50).allow('', null),
  bank_ifsc:             Joi.string().max(20).allow('', null),
  bank_account_holder:   Joi.string().max(200).allow('', null)
});

const updateSchema = Joi.object({
  vendor_name:           Joi.string().max(200).required(),
  vendor_code:           Joi.string().max(20).allow('', null),
  city:                  Joi.string().max(100).allow('', null),
  state:                 Joi.string().max(100).allow('', null),
  gstin:                 Joi.string().max(20).allow('', null),
  contact_person:        Joi.string().max(200).allow('', null),
  contact_phone:         Joi.string().max(20).allow('', null),
  payment_terms:         Joi.string().max(200).allow('', null),
  credit_days:           Joi.number().integer().min(0).max(365).allow(null),
  opening_balance:       Joi.number().min(0).allow(null),
  bank_name:             Joi.string().max(100).allow('', null),
  bank_account_no:       Joi.string().max(50).allow('', null),
  bank_ifsc:             Joi.string().max(20).allow('', null),
  bank_account_holder:   Joi.string().max(200).allow('', null)
});

router.get('/', async (req, res, next) => {
  try {
    const { status, q } = req.query;
    const result = await executeStoredProcedure('sp_Supplier_GetAll', {
      status_filter: { type: sql.VarChar(20), value: status || null },
      search_term: { type: sql.VarChar(200), value: q || null }
    });
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const q = req.query.q || '';
    const result = await executeStoredProcedure('sp_Supplier_Search', {
      search_term: { type: sql.VarChar(200), value: q }
    });
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

// GET auto-generate a vendor code suggestion
router.get('/auto-code', async (req, res, next) => {
  try {
    const name = req.query.name || '';
    if (!name) return res.status(400).json({ success: false, message: 'name query param required' });
    const result = await executeStoredProcedure('sp_Supplier_AutoCode', {
      vendor_name: { type: sql.VarChar(200), value: name }
    });
    const row = result.recordset && result.recordset[0];
    return res.json({ success: true, data: { vendor_code: row && row.vendor_code } });
  } catch (err) { return next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const result = await executeStoredProcedure('sp_Supplier_GetById', {
      supplier_id: { type: sql.Int, value: id }
    });
    const row = result.recordset && result.recordset[0];
    if (!row) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = supplierSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }

    const userId = req.user && req.user.user_id ? Number(req.user.user_id) : null;

    // Auto-generate vendor code if not provided
    let vendorCode = value.vendor_code && value.vendor_code.trim();
    if (!vendorCode) {
      const autoRes = await executeStoredProcedure('sp_Supplier_AutoCode', {
        vendor_name: { type: sql.VarChar(200), value: value.vendor_name }
      });
      vendorCode = (autoRes.recordset && autoRes.recordset[0] && autoRes.recordset[0].vendor_code) || 'SUPP-001';
    }

    const result = await executeStoredProcedure('sp_Supplier_Create', {
      vendor_name:           { type: sql.VarChar(200),   value: value.vendor_name },
      vendor_code:           { type: sql.VarChar(20),    value: vendorCode },
      city:                  { type: sql.VarChar(100),   value: value.city || null },
      state:                 { type: sql.VarChar(100),   value: value.state || null },
      gstin:                 { type: sql.VarChar(20),    value: value.gstin || null },
      contact_person:        { type: sql.VarChar(200),   value: value.contact_person || null },
      contact_phone:         { type: sql.VarChar(20),    value: value.contact_phone || null },
      payment_terms:         { type: sql.VarChar(200),   value: value.payment_terms || null },
      credit_days:           { type: sql.Int,            value: value.credit_days != null ? value.credit_days : null },
      opening_balance:       { type: sql.Decimal(12,2),  value: value.opening_balance || 0 },
      bank_name:             { type: sql.VarChar(100),   value: value.bank_name || null },
      bank_account_no:       { type: sql.VarChar(50),    value: value.bank_account_no || null },
      bank_ifsc:             { type: sql.VarChar(20),    value: value.bank_ifsc || null },
      bank_account_holder:   { type: sql.VarChar(200),   value: value.bank_account_holder || null },
      created_by:            { type: sql.Int,            value: userId }
    });

    return res.status(201).json({
      success: true,
      data: result.recordset && result.recordset[0]
    });
  } catch (err) {
    if (err.code === 'EREQUEST') {
      return res.status(422).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { error, value } = updateSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }

    const result = await executeStoredProcedure('sp_Supplier_Update', {
      supplier_id:           { type: sql.Int,            value: id },
      vendor_name:           { type: sql.VarChar(200),   value: value.vendor_name },
      city:                  { type: sql.VarChar(100),   value: value.city || null },
      state:                 { type: sql.VarChar(100),   value: value.state || null },
      gstin:                 { type: sql.VarChar(20),    value: value.gstin || null },
      contact_person:        { type: sql.VarChar(200),   value: value.contact_person || null },
      contact_phone:         { type: sql.VarChar(20),    value: value.contact_phone || null },
      payment_terms:         { type: sql.VarChar(200),   value: value.payment_terms || null },
      credit_days:           { type: sql.Int,            value: value.credit_days != null ? value.credit_days : null },
      opening_balance:       { type: sql.Decimal(12,2),  value: value.opening_balance != null ? value.opening_balance : null },
      bank_name:             { type: sql.VarChar(100),   value: value.bank_name || null },
      bank_account_no:       { type: sql.VarChar(50),    value: value.bank_account_no || null },
      bank_ifsc:             { type: sql.VarChar(20),    value: value.bank_ifsc || null },
      bank_account_holder:   { type: sql.VarChar(200),   value: value.bank_account_holder || null }
    });

    const row = result.recordset && result.recordset[0];
    if (!row) return res.status(404).json({ success: false, message: 'Supplier not found' });

    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id/status', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const statusVal = status || 'active';

    const result = await executeStoredProcedure('sp_Supplier_UpdateStatus', {
      supplier_id: { type: sql.Int, value: id },
      status: { type: sql.VarChar(20), value: statusVal }
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
