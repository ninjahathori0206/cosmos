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
    console.log('Connecting to master on', config.server, config.port);
    const pool = await sql.connect(config);
    const dbName = process.env.DB_NAME || 'CosmosERP';
    const check = await pool
      .request()
      .input('dbName', sql.VarChar(128), dbName)
      .query('SELECT name FROM sys.databases WHERE name = @dbName');

    if (check.recordset.length) {
      // eslint-disable-next-line no-console
      console.log(`Database [${dbName}] already exists.`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`Creating database [${dbName}]...`);
      await pool.request().query(`CREATE DATABASE [${dbName}]`);
      // eslint-disable-next-line no-console
      console.log(`Database [${dbName}] created.`);
    }

    await pool.close();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error creating database:', err.code, err.message);
  }
}

main();

