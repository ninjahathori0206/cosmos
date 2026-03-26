require('dotenv').config();
const sql = require('mssql');

async function main() {
  const config = {
    server: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 1433),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'master',
    options: { encrypt: false, trustServerCertificate: true },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 }
  };

  try {
    // eslint-disable-next-line no-console
    console.log('Connecting with config:', {
      server: config.server,
      port: config.port,
      user: config.user,
      database: config.database
    });
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT name FROM sys.databases');
    // eslint-disable-next-line no-console
    console.log('Databases:', result.recordset.map((r) => r.name));
    await pool.close();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('DB error code:', err.code, 'message:', err.message);
  }
}

main();

