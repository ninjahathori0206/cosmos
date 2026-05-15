'use strict';

const sql = require('mssql');
const bcrypt = require('bcryptjs');
const { getPool, executeStoredProcedure } = require('../config/db');

const BCRYPT_ROUNDS = 12;
const MAX_GENERATION_ATTEMPTS = 800;
/** Reserved for “no PIN set yet” fallback at POS login — never auto-assign. */
const RESERVED_PIN = '0000';

function randomFourDigitPin() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

/**
 * Load active users' PIN hashes (optionally excluding one user_id).
 * @param {number|null} excludeUserId
 */
async function loadPinHashesForUniqueness(excludeUserId) {
  const pool = await getPool();
  const req = pool.request();
  let query = `
    SELECT user_id, pos_pin_hash
    FROM dbo.users
    WHERE pos_pin_hash IS NOT NULL
  `;
  if (excludeUserId != null && Number.isFinite(Number(excludeUserId))) {
    req.input('exclude_id', sql.Int, Number(excludeUserId));
    query += ' AND user_id <> @exclude_id';
  }
  const result = await req.query(query);
  return result.recordset || [];
}

async function pinCollidesWithAnyUser(plainPin, hashes) {
  for (const row of hashes) {
    const hash = row.pos_pin_hash;
    if (!hash) continue;
    // eslint-disable-next-line no-await-in-loop
    if (await bcrypt.compare(plainPin, String(hash))) return true;
  }
  return false;
}

/**
 * Generate a 4-digit PIN not used by any other user (bcrypt compare against existing hashes).
 * @param {number|null} [excludeUserId] — allow keeping current user's PIN when regenerating
 * @returns {Promise<{ pin: string, pinHash: string }>}
 */
async function generateUniquePosPin(excludeUserId = null) {
  const hashes = await loadPinHashesForUniqueness(excludeUserId);

  for (let i = 0; i < MAX_GENERATION_ATTEMPTS; i += 1) {
    const pin = randomFourDigitPin();
    if (pin === RESERVED_PIN) continue;
    // eslint-disable-next-line no-await-in-loop
    const collision = await pinCollidesWithAnyUser(pin, hashes);
    if (collision) continue;
    // eslint-disable-next-line no-await-in-loop
    const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
    return { pin, pinHash };
  }

  throw new Error('Could not generate a unique 4-digit POS PIN. Try again or free up PIN space.');
}

/**
 * Persist hashed PIN for a user (Command Unit / admin — active or inactive).
 */
async function assignPosPinToUser(userId, pinHash) {
  const result = await executeStoredProcedure('sp_User_SetPosPin', {
    user_id: { type: sql.Int, value: Number(userId) },
    pin_hash: { type: sql.VarChar(200), value: pinHash }
  });
  const rows = Number((result.recordset && result.recordset[0] && result.recordset[0].rows_updated) || 0);
  if (!rows) {
    throw new Error('User not found.');
  }
}

/**
 * Generate unique PIN and save for user.
 * @returns {Promise<string>} plain 4-digit PIN (show once to admin)
 */
async function generateAndAssignPosPin(userId) {
  const { pin, pinHash } = await generateUniquePosPin(Number(userId));
  await assignPosPinToUser(userId, pinHash);
  return pin;
}

module.exports = {
  generateUniquePosPin,
  assignPosPinToUser,
  generateAndAssignPosPin,
  RESERVED_PIN
};
