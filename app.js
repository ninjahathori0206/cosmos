require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const zlib = require('zlib');
const compression = require('compression');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');
const { RedisStore } = require('rate-limit-redis');

const { requestLogger } = require('./src/middleware/requestLogger');
const { apiKeyAuth } = require('./src/middleware/apiKeyAuth');
const { authJwt } = require('./src/middleware/authJwt');

const authRouter = require('./src/api/auth');
const storesRouter = require('./src/api/stores');
const usersRouter = require('./src/api/users');
const homeBrandsRouter = require('./src/api/homeBrands');
const suppliersRouter = require('./src/api/suppliers');
const productsRouter = require('./src/api/products');
const purchasesRouter = require('./src/api/purchases');
const rolesRouter = require('./src/api/roles');
const settingsRouter = require('./src/api/settings');
const auditLogsRouter = require('./src/api/auditLogs');
const moduleAccessRouter = require('./src/api/moduleAccess');
const userModuleAccessRouter = require('./src/api/userModuleAccess');
const roleModuleAccessRouter = require('./src/api/roleModuleAccess');
const foundryLookupsRouter = require('./src/api/foundryLookups');
const makerMasterRouter      = require('./src/api/makerMaster');
const brandingAgentsRouter   = require('./src/api/brandingAgents');
const skusRouter           = require('./src/api/skus');
const uploadsRouter        = require('./src/api/uploads');
const qrRouter             = require('./src/api/qr');
const financeRouter        = require('./src/api/finance');
const stockTransfersRouter     = require('./src/api/stockTransfers');
const transferRequestsRouter   = require('./src/api/transferRequests');
const stockTransferDocsRouter  = require('./src/api/stockTransferDocs');
const { executeStoredProcedure, healthCheck } = require('./src/config/db');
const { requireGoodsTransferDestinationStores } = require('./src/middleware/authorize');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');

async function handleDestinationStores(req, res, next) {
  try {
    const result = await executeStoredProcedure('sp_Store_GetAll', {});
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
}

const app = express();
const protectedApiRouter = express.Router();

const PORT = process.env.PORT || 4000;
const PROTOTYPE_HTML_MAX_AGE_MS = Number(process.env.PROTOTYPE_HTML_MAX_AGE_MS || 10 * 60 * 1000);
const API_RATE_LIMIT_WINDOW_MS = Number(process.env.API_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const API_RATE_LIMIT_MAX = Number(process.env.API_RATE_LIMIT_MAX || 1000);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:4000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

let apiRateLimitStore;
if (process.env.RATE_LIMIT_REDIS_URL || process.env.REDIS_URL) {
  const redisClient = new Redis(process.env.RATE_LIMIT_REDIS_URL || process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true
  });
  redisClient.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.warn('[rate-limit] redis unavailable, limiter store may fallback at runtime:', err.message);
  });
  apiRateLimitStore = new RedisStore({
    sendCommand: (...args) => redisClient.call(...args)
  });
}

app.set('etag', 'strong');

function sendPrototypeHtml(res, absolutePath) {
  return res.sendFile(absolutePath, {
    maxAge: PROTOTYPE_HTML_MAX_AGE_MS,
    lastModified: true,
    cacheControl: true
  });
}

const MODULE_SHELLS = {
  foundry: path.join(__dirname, 'Foundry_Prototype.html'),
  storepilot: path.join(__dirname, 'StorePilot_Prototype.html'),
  finance: path.join(__dirname, 'Finance_Prototype.html'),
  'command-unit': path.join(__dirname, 'CommandUnit_Prototype.html')
};

function sendModuleShell(res, moduleKey) {
  const shellPath = MODULE_SHELLS[moduleKey];
  return sendPrototypeHtml(res, shellPath);
}

// Security headers via Helmet.
// Notes:
//  - contentSecurityPolicy: disabled — prototype UIs use inline scripts/styles
//  - crossOriginOpenerPolicy: disabled — app runs on HTTP (not HTTPS); COOP
//    headers are silently ignored and trigger a browser console warning on
//    non-HTTPS origins, so we suppress them entirely.
//  - originAgentCluster: disabled — must be consistent across ALL pages on the
//    same origin; mixing it causes a browser warning. Disable globally.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: false,
    originAgentCluster: false
  })
);

// HTTP compression for JSON/HTML/static responses (gzip + Brotli when supported).
app.use(
  compression({
    level: 6,
    threshold: 1024,
    brotli: {
      enabled: true,
      zlib: {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 4
        }
      }
    }
  })
);

// CORS (can be tightened later)
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('CORS not allowed'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    maxAge: 86400
  })
);

// Body parsing
// Keep uploads on multer routes; allow larger metadata payloads on JSON/urlencoded endpoints.
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Simple rate limiter for all APIs
app.use(
  '/api',
  rateLimit({
    windowMs: API_RATE_LIMIT_WINDOW_MS,
    max: API_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    ...(apiRateLimitStore ? { store: apiRateLimitStore } : {})
  })
);

// Request logging (API only; skip static asset noise)
app.use('/api', requestLogger);

// Goods Transfer — destination stores (before static + two paths so old proxies / cached routes still resolve)
const destinationStoresChain = [apiKeyAuth, authJwt, requireGoodsTransferDestinationStores, handleDestinationStores];
app.get('/api/stock-transfers/destination-stores', ...destinationStoresChain);
app.get('/api/foundry/destination-stores', ...destinationStoresChain);

// Default route -> login UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'public', 'login.html'));
});

// Legacy .html entries -> clean module URLs (hard switch).
app.get('/foundry.html', (req, res) => res.redirect(302, '/foundry/dashboard'));
app.get('/storepilot.html', (req, res) => res.redirect(302, '/storepilot/dashboard'));
app.get('/finance.html', (req, res) => res.redirect(302, '/finance/dashboard'));
app.get('/command-unit.html', (req, res) => res.redirect(302, '/command-unit/dashboard'));

// Self-hosted fonts: long cache lifetime + immutable.
app.use(
  '/fonts',
  express.static(path.join(__dirname, 'src', 'public', 'fonts'), {
    maxAge: '365d',
    immutable: true
  })
);

// Static assets
// - Cache CSS/JS/media for faster repeat visits
// - Keep HTML non-cached so deployments/pages refresh immediately
const isProductionEnv = (process.env.NODE_ENV || 'development') === 'production';
app.use(
  express.static(path.join(__dirname, 'src', 'public'), {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
        return;
      }
      // In development, always revalidate JS/CSS so UI edits appear immediately.
      if (!isProductionEnv && /\.(js|css)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  })
);

// Clean URL module shells (History API SPA routing with server fallback).
app.get(['/foundry', '/foundry/*'], (req, res) => sendModuleShell(res, 'foundry'));
app.get(['/storepilot', '/storepilot/*'], (req, res) => sendModuleShell(res, 'storepilot'));
app.get(['/finance', '/finance/*'], (req, res) => sendModuleShell(res, 'finance'));
app.get(['/command-unit', '/command-unit/*'], (req, res) => sendModuleShell(res, 'command-unit'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Cosmos ERP API is running',
    env: process.env.NODE_ENV || 'development'
  });
});

// DB health check
app.get('/health/db', async (req, res, next) => {
  try {
    const result = await healthCheck();
    if (!result.ok) {
      return res.status(500).json({
        success: false,
        message: 'Database connection failed',
        details: result
      });
    }
    return res.json({
      success: true,
      message: 'Database connection OK'
    });
  } catch (err) {
    return next(err);
  }
});

// Auth/public routes that do not use grouped protected router.
app.use('/api/auth', apiKeyAuth, authRouter);
app.use('/api/qr', qrRouter); // public — <img> tags cannot send auth headers; QR data is non-sensitive

// Apply API key + JWT once for all protected /api mounts below.
protectedApiRouter.use(apiKeyAuth, authJwt);
protectedApiRouter.use('/stores', storesRouter);
protectedApiRouter.use('/users', usersRouter);
protectedApiRouter.use('/home-brands', homeBrandsRouter);
protectedApiRouter.use('/suppliers', suppliersRouter);
protectedApiRouter.use('/products', productsRouter);
protectedApiRouter.use('/purchases', purchasesRouter);
protectedApiRouter.use('/roles', rolesRouter);
protectedApiRouter.use('/settings', settingsRouter);
protectedApiRouter.use('/audit-logs', auditLogsRouter);
protectedApiRouter.use('/store-modules', moduleAccessRouter);
protectedApiRouter.use('/user-modules', userModuleAccessRouter);
protectedApiRouter.use('/role-modules', roleModuleAccessRouter);
protectedApiRouter.use('/foundry-lookups', foundryLookupsRouter);
protectedApiRouter.use('/maker-master', makerMasterRouter);
protectedApiRouter.use('/branding-agents', brandingAgentsRouter);
protectedApiRouter.use('/skus', skusRouter);
protectedApiRouter.use('/uploads', uploadsRouter);
protectedApiRouter.use('/finance', financeRouter);
protectedApiRouter.use('/stock-transfers', stockTransfersRouter);
protectedApiRouter.use('/transfer-requests', transferRequestsRouter);
protectedApiRouter.use('/stock-transfer-docs', stockTransferDocsRouter);
app.use('/api', protectedApiRouter);

// 404 + error handling
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Cosmos ERP server listening on port ${PORT}`);
});

