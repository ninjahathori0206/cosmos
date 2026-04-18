/**
 * Deploy auth-related SQL: drop legacy password_hash, redeploy sp_Auth_Login.
 * Uses .env DB_* settings (same as the app).
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getPool } = require('../src/config/db');

async function runFile(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Missing file: ${abs}`);
  }
  const script = fs.readFileSync(abs, 'utf8');
  const pool = await getPool();
  const batches = script.split(/^\s*GO\s*$/gim).map((b) => b.trim()).filter(Boolean);
  // eslint-disable-next-line no-console
  console.log(`Running: ${abs} (${batches.length} batch(es))`);
  for (const batch of batches) {
    // eslint-disable-next-line no-await-in-loop
    await pool.request().batch(batch);
  }
}

async function main() {
  const root = path.join(__dirname, '..');
  await runFile(path.join(root, 'sql', 'alter', '29_drop_users_password_hash.sql'));
  await runFile(path.join(root, 'sql', 'sp', 'auth.sql'));
  // eslint-disable-next-line no-console
  console.log('Auth SQL deploy finished OK.');
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Auth SQL deploy failed:', err.message);
  process.exit(1);
});
