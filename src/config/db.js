const sql = require('mssql');
const path = require('path');

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise;

async function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config);
  }
  return poolPromise;
}

/**
 * Execute a stored procedure with named parameters.
 * params: { name: { type: sql.X, value: any } }
 */
async function executeStoredProcedure(procedureName, params = {}) {
  const pool = await getPool();
  const request = pool.request();

  Object.entries(params).forEach(([key, { type, value }]) => {
    request.input(key, type, value);
  });

  const result = await request.execute(procedureName);
  return result;
}

async function healthCheck() {
  try {
    const pool = await getPool();
    await pool.query('SELECT 1 AS ok');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err.message,
      code: err.code
    };
  }
}

module.exports = {
  sql,
  getPool,
  executeStoredProcedure,
  healthCheck
};

