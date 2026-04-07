require('dotenv').config();
const sql = require('mssql');
const fs  = require('fs');
const path = require('path');

const config = {
  server:   process.env.DB_HOST,
  port:     Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options:  { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 30000
};

const text = fs.readFileSync(path.join(__dirname, '../sql/sp/roles.sql'), 'utf8');
const batches = text.split(/^\s*GO\s*$/im).map(b => b.trim()).filter(Boolean);

(async () => {
  console.log('Connecting to', config.server + ':' + config.port, config.database);
  await sql.connect(config);
  console.log('Connected. Running', batches.length, 'batches...');
  for (let i = 0; i < batches.length; i++) {
    await sql.query(batches[i]);
    console.log('  Batch', i + 1, 'OK');
  }
  console.log('roles.sql deployed successfully.');
  await sql.close();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
