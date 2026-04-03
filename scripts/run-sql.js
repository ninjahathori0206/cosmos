/* Simple SQL runner to execute .sql files against the configured MSSQL DB */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sql, getPool } = require('../src/config/db');

async function runFile(filePath) {
  const abs = path.resolve(filePath);
  const script = fs.readFileSync(abs, 'utf8');
  const pool = await getPool();
  // mssql driver splits on GO if we use batch; simplest is to send as-is
  // for now and rely on server-side GO handling in Management Studio when needed.
  // Here we just execute raw batch (without GO).
  const cleaned = script.replace(/^\s*GO\s*$/gim, '');
  // eslint-disable-next-line no-console
  console.log(`Running SQL file: ${abs}`);
  await pool.request().batch(cleaned);
}

async function main() {
  try {
    const tablesDir = path.join(__dirname, '..', 'sql', 'tables');
    const files = fs.readdirSync(tablesDir).filter((f) => f.endsWith('.sql')).sort();
    // eslint-disable-next-line no-console
    console.log('Found SQL table scripts:', files);
    // Ensure database exists (user should have run create_database.sql once)
    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      await runFile(path.join(tablesDir, file));
    }
    // eslint-disable-next-line no-console
    console.log('SQL scripts executed successfully.');
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error running SQL scripts:', err);
    process.exit(1);
  }
}

main();

