const sql = require('mssql');
const path = require('path');

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 15000),
  requestTimeout: Number(process.env.DB_REQUEST_TIMEOUT_MS || 30000),
  options: {
    encrypt: false,
    trustServerCertificate: true
  },
  pool: {
    min: Number(process.env.DB_POOL_MIN || 2),
    max: Number(process.env.DB_POOL_MAX || 20),
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS || 30000),
    acquireTimeoutMillis: Number(process.env.DB_POOL_ACQUIRE_TIMEOUT_MS || 15000)
  }
};

let poolPromise;
const DB_CONNECT_RETRIES = Math.max(0, Number(process.env.DB_CONNECT_RETRIES || 3));
const DB_CONNECT_BACKOFF_MS = Math.max(100, Number(process.env.DB_CONNECT_BACKOFF_MS || 500));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry() {
  let lastErr;
  for (let attempt = 0; attempt <= DB_CONNECT_RETRIES; attempt += 1) {
    try {
      return await sql.connect(config);
    } catch (err) {
      lastErr = err;
      if (attempt >= DB_CONNECT_RETRIES) break;
      await sleep(DB_CONNECT_BACKOFF_MS * Math.pow(2, attempt));
    }
  }
  throw lastErr;
}

async function getPool() {
  if (!poolPromise) {
    // If the initial connect fails, allow later retries by clearing the cached promise.
    poolPromise = connectWithRetry().catch((err) => {
      poolPromise = undefined;
      throw err;
    });
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

