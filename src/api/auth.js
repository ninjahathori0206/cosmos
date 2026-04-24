const express = require('express');
const sql = require('mssql');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const { executeStoredProcedure, getPool } = require('../config/db');
const { authJwt } = require('../middleware/authJwt');

const router = express.Router();

const loginSchema = Joi.object({
  username: Joi.string().max(100).required(),
  password: Joi.string().min(4).max(200).required()
});

function looksLikeBcryptHash(v) {
  return /^\$2[abxy]\$\d{2}\$/.test(String(v || ''));
}

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
      username: { type: sql.VarChar(100), value: username },
      password: { type: sql.VarChar(200), value: password }
    });

    const user = result.recordset && result.recordset[0];
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const storedPassword = user.password || '';
    let isValidPassword = false;

    if (looksLikeBcryptHash(storedPassword)) {
      isValidPassword = await bcrypt.compare(password, storedPassword);
    } else {
      // Legacy plaintext fallback during migration window.
      isValidPassword = password === storedPassword;
      if (isValidPassword) {
        try {
          const hashed = await bcrypt.hash(password, 12);
          const pool = await getPool();
          await pool.request()
            .input('uid', sql.Int, user.user_id)
            .input('pwd', sql.VarChar(200), hashed)
            .query('UPDATE dbo.users SET password = @pwd WHERE user_id = @uid');
        } catch (rehashErr) {
          // Non-fatal: login should still succeed; next login will retry migration.
          console.warn('[auth/login] password rehash failed:', rehashErr.message);
        }
      }
    }

    if (!isValidPassword) {
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
        const k = String(r.module_key || '').toLowerCase();
        if (k) modules[k] = !!r.is_effective;
      });
    } catch (spErr) {
      // Non-fatal: if SP not yet deployed the login still succeeds;
      // empty modules map = legacy “all enabled” on the client.
      console.warn('[auth/login] sp_User_EffectiveModules failed:', spErr.message);
    }

    let permissions = [];
    try {
      const permResult = await executeStoredProcedure('sp_Role_GetPermissions', {
        role_key: { type: sql.VarChar(50), value: user.role_key }
      });
      permissions = (permResult.recordset || []).map((row) =>
        String(row.permission || '').toLowerCase()
      ).filter(Boolean);
    } catch (permErr) {
      console.warn('[auth/login] sp_Role_GetPermissions failed:', permErr.message);
    }

    const payload = {
      user_id: user.user_id,
      role: user.role_key,
      store_id: user.store_id || null,
      modules,
      permissions
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
          modules,
          permissions
        }
      }
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/me', authJwt, (req, res) => {
  return res.json({
    success: true,
    data: req.user
  });
});

module.exports = router;

