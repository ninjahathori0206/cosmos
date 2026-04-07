const express = require('express');
const sql = require('mssql');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { executeStoredProcedure } = require('../config/db');

const router = express.Router();

const loginSchema = Joi.object({
  username: Joi.string().max(100).required(),
  password: Joi.string().min(4).max(200).required()
});

router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }

    const { username, password } = value;

    // For now we read directly from users table instead of SP until SPs are added.
    // This can be switched to sp_Auth_Login later without changing the API.
    const result = await executeStoredProcedure('sp_Auth_Login', {
      username: { type: sql.VarChar(100), value: username }
    });

    const user = result.recordset && result.recordset[0];
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (password !== user.password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Compute effective module access: role policy intersected with store policy.
    // Returns rows with { module_key, role_allows, store_allows, is_effective }.
    // Falls back gracefully — an empty array means "all modules allowed" on the client.
    let modules = {};
    try {
      const modResult = await executeStoredProcedure('sp_User_EffectiveModules', {
        user_id: { type: sql.Int, value: user.user_id }
      });
      (modResult.recordset || []).forEach((r) => {
        modules[r.module_key] = !!r.is_effective;
      });
    } catch (spErr) {
      // Non-fatal: if SP not yet deployed the login still succeeds;
      // empty modules map = legacy “all enabled” on the client.
      console.warn('[auth/login] sp_User_EffectiveModules failed:', spErr.message);
    }

    const payload = {
      user_id: user.user_id,
      role: user.role_key,
      store_id: user.store_id || null
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d'
    });

    return res.json({
      success: true,
      data: {
        token,
        user: {
          user_id: user.user_id,
          username: user.username,
          full_name: user.full_name,
          role: user.role_key,
          store_id: user.store_id,
          store_name: user.store_name || null,
          modules
        }
      }
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }

  return res.json({
    success: true,
    data: req.user
  });
});

module.exports = router;

