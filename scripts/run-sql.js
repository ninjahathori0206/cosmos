/* Simple SQL runner to execute table DDL files against the configured MSSQL DB */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getPool } = require('../src/config/db');

async function runFile(filePath) {
  const abs = path.resolve(filePath);
  const script = fs.readFileSync(abs, 'utf8');
  const pool = await getPool();
  // eslint-disable-next-line no-console
  console.log(`Running SQL file: ${abs}`);
  const cleaned = script.replace(/^\s*GO\s*$/gim, '');
  await pool.request().batch(cleaned);
}

function listTableFiles(tablesDir) {
  const manifestPath = path.join(path.dirname(tablesDir), 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const ordered = manifest.tables || [];
    const missing = ordered.filter((f) => !fs.existsSync(path.join(tablesDir, f)));
    if (missing.length) {
      throw new Error(`sql/manifest.json lists missing files: ${missing.join(', ')}`);
    }
    const extra = fs
      .readdirSync(tablesDir)
      .filter((f) => f.endsWith('.sql') && !ordered.includes(f));
    if (extra.length) {
      throw new Error(
        `sql/tables has .sql files not listed in sql/manifest.json (add or remove): ${extra.join(', ')}`
      );
    }
    return ordered;
  }
  // Fallback: legacy lexical order
  return fs.readdirSync(tablesDir).filter((f) => f.endsWith('.sql')).sort();
}

async function main() {
  try {
    const tablesDir = path.join(__dirname, '..', 'sql', 'tables');
    const files = listTableFiles(tablesDir);
    // eslint-disable-next-line no-console
    console.log('Table scripts in order:', files);
    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      await runFile(path.join(tablesDir, file));
    }
    // eslint-disable-next-line no-console
    console.log('SQL table scripts executed successfully.');
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error running SQL scripts:', err);
    process.exit(1);
  }
}

main();
