const express = require('express');
const sql = require('mssql');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const { executeStoredProcedure, getPool } = require('../config/db');
const { authJwt } = require('../middleware/authJwt');
const { nowUnixSec } = require('../services/jwtPolicyService');

const router = express.Router();

const loginSchema = Joi.object({
  username: Joi.string().max(100).required(),
  password: Joi.string().min(4).max(200).required()
});

function looksLikeBcryptHash(v) {
  return /^\$2[abxy]\$\d{2}\$/.test(String(v || ''));
}

/** Hash column is `password_hash` in DB; keep `password_stored` / `password` fallbacks for older SPs still selecting `password`. */
function hashFromLoginRow(user) {
  if (!user || typeof user !== 'object') return '';
  const raw = user.password_hash ?? user.password_stored ?? user.password;
  return raw != null ? String(raw) : '';
}

async function loadEffectiveModules(userId) {
  const modules = {};
  try {
    const modResult = await executeStoredProcedure('sp_User_EffectiveModules', {
      user_id: { type: sql.Int, value: userId }
    });
    (modResult.recordset || []).forEach((r) => {
      const k = String(r.module_key || '').toLowerCase();
      if (k) modules[k] = !!r.is_effective;
    });
  } catch (spErr) {
    console.warn('[auth] sp_User_EffectiveModules failed:', spErr.message);
  }
  return modules;
}

async function loadRolePermissions(roleKey) {
  let permissions = [];
  try {
    const permResult = await executeStoredProcedure('sp_Role_GetPermissions', {
      role_key: { type: sql.VarChar(50), value: roleKey }
    });
    permissions = (permResult.recordset || []).map((row) =>
      String(row.permission || '').toLowerCase()
    ).filter(Boolean);
  } catch (permErr) {
    console.warn('[auth] sp_Role_GetPermissions failed:', permErr.message);
  }
  return permissions;
}

async function buildSessionForUser(user) {
  const modules = await loadEffectiveModules(user.user_id);
  const permissions = await loadRolePermissions(user.role_key);
  const payload = {
    user_id: user.user_id,
    role: user.role_key,
    store_id: user.store_id || null,
    modules,
    permissions,
    token_issued_at: nowUnixSec()
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  });
  return {
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
  };
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

    const storedPassword = hashFromLoginRow(user);
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
          const colRs = await pool.request().query(`
            SELECT CASE WHEN COL_LENGTH(N'dbo.users', N'password_hash') IS NOT NULL THEN 1 ELSE 0 END AS has_hash
          `);
          const hasHash = colRs.recordset[0]?.has_hash === 1;
          const updateSql = hasHash
            ? 'UPDATE dbo.users SET password_hash = @pwd WHERE user_id = @uid'
            : 'UPDATE dbo.users SET password = @pwd WHERE user_id = @uid';
          await pool
            .request()
            .input('uid', sql.Int, user.user_id)
            .input('pwd', sql.VarChar(200), hashed)
            .query(updateSql);
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

    const session = await buildSessionForUser(user);
    return res.json({ success: true, data: session });
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

/** Re-read role modules + permissions from DB and issue a fresh JWT (after CU role edits). */
router.post('/refresh', authJwt, async (req, res, next) => {
  try {
    const userId = Number(req.user && req.user.user_id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: 'Invalid session.' });
    }

    const result = await executeStoredProcedure('sp_User_GetById', {
      user_id: { type: sql.Int, value: userId }
    });
    const user = result.recordset && result.recordset[0];
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }
    if (user.is_active === false || user.is_active === 0) {
      return res.status(403).json({ success: false, message: 'Account is inactive.' });
    }

    const session = await buildSessionForUser(user);
    return res.json({ success: true, data: session });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

