const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');
const { requireModule, requirePermission } = require('../middleware/authorize');

const router = express.Router();

const settingsView = [requireModule('command_unit'), requirePermission('command_unit.settings.view')];
const settingsManage = [requireModule('command_unit'), requirePermission('command_unit.settings.edit')];

// ─── GST RATES ───────────────────────────────────────────────────────────────

const gstSchema = Joi.object({
  hsn_sac:    Joi.string().max(50).required(),
  category:   Joi.string().max(200).required(),
  gst_rate:   Joi.number().min(0).max(100).required(),
  cgst_rate:  Joi.number().min(0).max(100).required(),
  sgst_rate:  Joi.number().min(0).max(100).required(),
  applied_to: Joi.string().max(500).allow(null, '')
});

const gstUpdateSchema = gstSchema.append({
  is_active: Joi.boolean().optional()
});

router.get('/gst-rates', ...settingsView, async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_GstRate_GetAll', {});
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) { return next(err); }
});

router.post('/gst-rates', ...settingsManage, async (req, res, next) => {
  try {
    const { error, value } = gstSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });

    const result = await executeStoredProcedure('sp_GstRate_Create', {
      hsn_sac:    { type: sql.VarChar(50),   value: value.hsn_sac },
      category:   { type: sql.VarChar(200),  value: value.category },
      gst_rate:   { type: sql.Decimal(5,2),  value: value.gst_rate },
      cgst_rate:  { type: sql.Decimal(5,2),  value: value.cgst_rate },
      sgst_rate:  { type: sql.Decimal(5,2),  value: value.sgst_rate },
      applied_to: { type: sql.VarChar(500),  value: value.applied_to || null }
    });

    return res.status(201).json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) { return next(err); }
});

router.put('/gst-rates/:id', ...settingsManage, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { error, value } = gstUpdateSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });

    const result = await executeStoredProcedure('sp_GstRate_Update', {
      gst_id:     { type: sql.Int,           value: id },
      hsn_sac:    { type: sql.VarChar(50),   value: value.hsn_sac },
      category:   { type: sql.VarChar(200),  value: value.category },
      gst_rate:   { type: sql.Decimal(5,2),  value: value.gst_rate },
      cgst_rate:  { type: sql.Decimal(5,2),  value: value.cgst_rate },
      sgst_rate:  { type: sql.Decimal(5,2),  value: value.sgst_rate },
      applied_to: { type: sql.VarChar(500),  value: value.applied_to || null },
      is_active:  { type: sql.Bit,           value: value.is_active !== false }
    });

    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) { return next(err); }
});

router.delete('/gst-rates/:id', ...settingsManage, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const result = await executeStoredProcedure('sp_GstRate_Delete', {
      gst_id: { type: sql.Int, value: id }
    });
    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) { return next(err); }
});

// ─── MEMBERSHIP TIERS ────────────────────────────────────────────────────────

const tierSchema = Joi.object({
  tier_name:           Joi.string().max(200).required(),
  annual_fee:          Joi.number().min(0).required(),
  benefits:            Joi.string().max(500).allow(null, ''),
  loyalty_tier:        Joi.string().max(50).allow(null, ''),
  promoter_commission: Joi.number().min(0).allow(null)
});

const tierUpdateSchema = tierSchema.append({
  is_active: Joi.boolean().optional()
});

router.get('/membership-tiers', ...settingsView, async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_MembershipTier_GetAll', {});
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) { return next(err); }
});

router.post('/membership-tiers', async (req, res, next) => {
  try {
    const { error, value } = tierSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });

    const userId = req.user && req.user.user_id ? Number(req.user.user_id) : null;

    const result = await executeStoredProcedure('sp_MembershipTier_Create', {
      tier_name:           { type: sql.VarChar(200),   value: value.tier_name },
      annual_fee:          { type: sql.Decimal(10,2),  value: value.annual_fee },
      benefits:            { type: sql.VarChar(500),   value: value.benefits || null },
      loyalty_tier:        { type: sql.VarChar(50),    value: value.loyalty_tier || null },
      promoter_commission: { type: sql.Decimal(10,2),  value: value.promoter_commission || null },
      created_by:          { type: sql.Int,            value: userId }
    });

    return res.status(201).json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) { return next(err); }
});

router.put('/membership-tiers/:id', ...settingsManage, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { error, value } = tierUpdateSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });

    const result = await executeStoredProcedure('sp_MembershipTier_Update', {
      membership_id:       { type: sql.Int,           value: id },
      tier_name:           { type: sql.VarChar(200),  value: value.tier_name },
      annual_fee:          { type: sql.Decimal(10,2), value: value.annual_fee },
      benefits:            { type: sql.VarChar(500),  value: value.benefits || null },
      loyalty_tier:        { type: sql.VarChar(50),   value: value.loyalty_tier || null },
      promoter_commission: { type: sql.Decimal(10,2), value: value.promoter_commission || null },
      is_active:           { type: sql.Bit,           value: value.is_active !== false }
    });

    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) { return next(err); }
});

router.delete('/membership-tiers/:id', ...settingsManage, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const result = await executeStoredProcedure('sp_MembershipTier_Deactivate', {
      membership_id: { type: sql.Int, value: id }
    });
    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) { return next(err); }
});

// ─── LEAVE TYPES ─────────────────────────────────────────────────────────────

const leaveSchema = Joi.object({
  leave_name:        Joi.string().max(200).required(),
  annual_quota:      Joi.number().integer().min(0).allow(null),
  max_carry_fwd:     Joi.number().integer().min(0).allow(null),
  requires_approval: Joi.boolean().optional(),
  is_paid:           Joi.boolean().optional(),
  affects_score:     Joi.boolean().optional()
});

const leaveUpdateSchema = leaveSchema.append({
  is_active: Joi.boolean().optional()
});

router.get('/leave-types', ...settingsView, async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_LeaveType_GetAll', {});
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) { return next(err); }
});

router.post('/leave-types', ...settingsManage, async (req, res, next) => {
  try {
    const { error, value } = leaveSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });

    const userId = req.user && req.user.user_id ? Number(req.user.user_id) : null;

    const result = await executeStoredProcedure('sp_LeaveType_Create', {
      leave_name:        { type: sql.VarChar(200), value: value.leave_name },
      annual_quota:      { type: sql.Int,          value: value.annual_quota != null ? value.annual_quota : null },
      max_carry_fwd:     { type: sql.Int,          value: value.max_carry_fwd != null ? value.max_carry_fwd : null },
      requires_approval: { type: sql.Bit,          value: value.requires_approval !== false },
      is_paid:           { type: sql.Bit,          value: value.is_paid !== false },
      affects_score:     { type: sql.Bit,          value: value.affects_score !== false },
      created_by:        { type: sql.Int,          value: userId }
    });

    return res.status(201).json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) { return next(err); }
});

router.put('/leave-types/:id', ...settingsManage, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { error, value } = leaveUpdateSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map((d) => d.message) });

    const result = await executeStoredProcedure('sp_LeaveType_Update', {
      leave_type_id:     { type: sql.Int,          value: id },
      leave_name:        { type: sql.VarChar(200), value: value.leave_name },
      annual_quota:      { type: sql.Int,          value: value.annual_quota != null ? value.annual_quota : null },
      max_carry_fwd:     { type: sql.Int,          value: value.max_carry_fwd != null ? value.max_carry_fwd : null },
      requires_approval: { type: sql.Bit,          value: value.requires_approval !== false },
      is_paid:           { type: sql.Bit,          value: value.is_paid !== false },
      affects_score:     { type: sql.Bit,          value: value.affects_score !== false },
      is_active:         { type: sql.Bit,          value: value.is_active !== false }
    });

    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) { return next(err); }
});

router.delete('/leave-types/:id', ...settingsManage, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const result = await executeStoredProcedure('sp_LeaveType_Deactivate', {
      leave_type_id: { type: sql.Int, value: id }
    });
    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) { return next(err); }
});

module.exports = router;
