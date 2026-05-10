const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/db');

const router = express.Router();

const CUSTOMER_JWT_EXPIRES = '90d';
const BCRYPT_ROUNDS = 12;

function issueCustomerJwt(customerId) {
  const secret = process.env.CUSTOMER_JWT_SECRET;
  return jwt.sign(
    { sub: 'customer', customerId },
    secret,
    { expiresIn: CUSTOMER_JWT_EXPIRES }
  );
}

/** POST /api/customer/auth/login */
router.post('/login', async (req, res, next) => {
  try {
    const { phone, password } = req.body || {};
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password are required.' });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('phone', phone.trim())
      .query(`
        SELECT c.customer_id, c.full_name, c.is_active,
               a.password_hash, a.is_active AS auth_active
        FROM   dbo.pos_customers c
        LEFT JOIN dbo.customer_auth a ON a.customer_id = c.customer_id
        WHERE  c.phone = @phone
      `);

    const row = result.recordset[0];

    if (!row) {
      return res.status(401).json({
        success: false,
        message: 'This phone number is not registered. Please visit an Eyewoot store to register your account.'
      });
    }

    if (!row.is_active) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact the store.' });
    }

    if (!row.password_hash) {
      return res.status(400).json({
        success: false,
        message: 'No password set for this account. Use "Set up my account" to create a password.',
        needsSetup: true
      });
    }

    if (!row.auth_active) {
      return res.status(403).json({ success: false, message: 'Your login has been disabled. Please contact the store.' });
    }

    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }

    await pool.request()
      .input('customer_id', row.customer_id)
      .query(`
        UPDATE dbo.customer_auth
        SET    last_login = DATEADD(MINUTE, 330, SYSUTCDATETIME()),
               updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
        WHERE  customer_id = @customer_id
      `);

    const token = issueCustomerJwt(row.customer_id);
    return res.json({
      success: true,
      token,
      customer: { id: row.customer_id, name: row.full_name }
    });
  } catch (err) {
    return next(err);
  }
});

/** POST /api/customer/auth/setup-password
 *  First-time password creation.
 *  Phone must exist in pos_customers AND must NOT already have a customer_auth record.
 */
router.post('/setup-password', async (req, res, next) => {
  try {
    const { phone, password } = req.body || {};
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password are required.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('phone', phone.trim())
      .query(`
        SELECT c.customer_id, c.full_name, c.is_active,
               a.customer_auth_id
        FROM   dbo.pos_customers c
        LEFT JOIN dbo.customer_auth a ON a.customer_id = c.customer_id
        WHERE  c.phone = @phone
      `);

    const row = result.recordset[0];

    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'This phone number is not registered. Please visit an Eyewoot store to register your account.'
      });
    }

    if (!row.is_active) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact the store.' });
    }

    if (row.customer_auth_id) {
      return res.status(409).json({
        success: false,
        message: 'A password is already set for this account. Please use the login screen.'
      });
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await pool.request()
      .input('customer_id', row.customer_id)
      .input('password_hash', hash)
      .query(`
        INSERT INTO dbo.customer_auth (customer_id, password_hash, is_active, last_login)
        VALUES (@customer_id, @password_hash, 1, DATEADD(MINUTE, 330, SYSUTCDATETIME()))
      `);

    const token = issueCustomerJwt(row.customer_id);
    return res.status(201).json({
      success: true,
      token,
      customer: { id: row.customer_id, name: row.full_name }
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
