/* Run all stored procedure scripts then seed scripts */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getPool } = require('../src/config/db');

async function runFile(filePath) {
  const abs = path.resolve(filePath);
  const script = fs.readFileSync(abs, 'utf8');
  const pool = await getPool();
  // Split on GO batches so CREATE PROCEDURE can be first in batch
  const batches = script.split(/^\s*GO\s*$/gim).map((b) => b.trim()).filter(Boolean);
  // eslint-disable-next-line no-console
  console.log(`Running SQL file: ${abs} (${batches.length} batch(es))`);
  for (const batch of batches) {
    // eslint-disable-next-line no-await-in-loop
    await pool.request().batch(batch);
  }
}

async function runDir(dirPath) {
  const absDir = path.resolve(dirPath);
  if (!fs.existsSync(absDir)) return;
  const files = fs.readdirSync(absDir).filter((f) => f.endsWith('.sql')).sort();
  // eslint-disable-next-line no-console
  console.log('Found SQL scripts in', absDir, ':', files);
  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop
    await runFile(path.join(absDir, file));
  }
}

async function main() {
  try {
    await runDir(path.join(__dirname, '..', 'sql', 'alter'));
    await runDir(path.join(__dirname, '..', 'sql', 'sp'));
    await runDir(path.join(__dirname, '..', 'sql', 'seed'));
    // eslint-disable-next-line no-console
    console.log('Stored procedures and seed scripts executed successfully.');
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error running SP/seed scripts:', err);
    process.exit(1);
  }
}

main();

