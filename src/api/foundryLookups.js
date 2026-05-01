const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');
const { withCache, clearCacheByPrefix } = require('../cache/ttlCache');
const {
  isSuperAdmin,
  hasModuleAccess,
  hasPermission,
  requireModule,
  requirePermission
} = require('../middleware/authorize');

const router = express.Router();

/** ?type= — Foundry form dropdowns; no type — full admin list (Command Unit). */
function foundryLookupListAuth(req, res, next) {
  if (isSuperAdmin(req)) return next();
  if (req.query.type) {
    if (!hasModuleAccess(req, 'foundry')) {
      return res.status(403).json({ success: false, message: 'Module access denied.' });
    }
    if (
      !hasPermission(req, 'foundry.purchases.view')
      && !hasPermission(req, 'foundry.branding.view')
      && !hasPermission(req, 'foundry.digitisation.view')
    ) {
      return res.status(403).json({ success: false, message: 'Permission denied.' });
    }
    return next();
  }
  if (hasModuleAccess(req, 'command_unit') && hasPermission(req, 'command_unit.settings.edit')) {
    return next();
  }
  // Foundry users need all lookup types to populate form dropdowns (branding, new purchase, digitisation, etc.)
  if (
    hasModuleAccess(req, 'foundry')
    && (
      hasPermission(req, 'foundry.purchases.view')
      || hasPermission(req, 'foundry.branding.view')
      || hasPermission(req, 'foundry.digitisation.view')
    )
  ) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Permission denied.' });
}

const createSchema = Joi.object({
  lookup_type:   Joi.string().max(50).required(),
  lookup_key:    Joi.string().max(100).required(),
  lookup_label:  Joi.string().max(200).required(),
  description:   Joi.string().max(500).allow(null, '').optional(),
  display_order: Joi.number().integer().min(0).optional(),
  is_active:     Joi.boolean().optional(),
  __is_active:   Joi.boolean().optional()
});

const updateSchema = Joi.object({
  lookup_label:  Joi.string().max(200).required(),
  description:   Joi.string().max(500).allow(null, '').optional(),
  display_order: Joi.number().integer().min(0).optional(),
  is_active:     Joi.boolean().optional()
});

// GET /api/foundry-lookups?type=source_type  — active values for one type
// GET /api/foundry-lookups                   — all values (all types, for admin)
router.get(
  '/',
  foundryLookupListAuth,
  withCache((req) => `foundry-lookups:${String(req.query.type || 'all').toLowerCase()}`, 5 * 60 * 1000, async (req) => {
    const { type } = req.query;
    let result
    if (type) {
      result = await executeStoredProcedure('sp_FoundryLookup_GetByType', {
        lookup_type: { type: sql.VarChar(50), value: type }
      });
    } else {
      result = await executeStoredProcedure('sp_FoundryLookup_GetAll', {});
    }
    return { success: true, data: result.recordset || [] }
  })
);

// POST /api/foundry-lookups
router.post(
  '/',
  requireModule('command_unit'),
  requirePermission('command_unit.settings.edit'),
  async (req, res, next) => {
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
      clearCacheByPrefix('foundry-lookups:');

      return res.status(201).json({ success: true, data: result.recordset && result.recordset[0] });
    } catch (err) {
      if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
      return next(err);
    }
  }
);

// PUT /api/foundry-lookups/:id
router.put(
  '/:id',
  requireModule('command_unit'),
  requirePermission('command_unit.settings.edit'),
  async (req, res, next) => {
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
      clearCacheByPrefix('foundry-lookups:');

      return res.json({ success: true, data: result.recordset && result.recordset[0] });
    } catch (err) {
      if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
      return next(err);
    }
  }
);

// DELETE /api/foundry-lookups/:id  — soft delete
router.delete(
  '/:id',
  requireModule('command_unit'),
  requirePermission('command_unit.settings.edit'),
  async (req, res, next) => {
    try {
      const lookupId = Number(req.params.id);
      const result = await executeStoredProcedure('sp_FoundryLookup_Delete', {
        lookup_id: { type: sql.Int, value: lookupId }
      });
      clearCacheByPrefix('foundry-lookups:');
      return res.json({ success: true, data: result.recordset && result.recordset[0] });
    } catch (err) {
      if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
      return next(err);
    }
  }
);

module.exports = router;
