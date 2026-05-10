process.env.TZ = 'Asia/Kolkata'; // IST — must be first line, before any require()
require('dotenv').config();

const fs = require('fs');
const jwt = require('jsonwebtoken');
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
const posRouter                = require('./src/api/pos');
const cxRouter                 = require('./src/api/cx');
const lensConfigRouter         = require('./src/api/lensConfig');
const ordersRouter             = require('./src/api/orders');
const metaRouter               = require('./src/api/meta');
const tabletsRouter            = require('./src/api/tablets');
const customerAuthRouter       = require('./src/api/customerAuth');
const customerAppRouter        = require('./src/api/customerApp');
const { executeStoredProcedure, healthCheck } = require('./src/config/db');
const {
  requireGoodsTransferDestinationStores,
  isRbacStrictEmptyPermissions
} = require('./src/middleware/authorize');
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

function assertAuthEnv() {
  const secret = process.env.JWT_SECRET;
  if (secret == null || String(secret).trim() === '') {
    console.error('[startup] FATAL: JWT_SECRET is missing or empty. Set it in .env (see .env.example).');
    process.exit(1);
  }
  const exp = process.env.JWT_EXPIRES_IN || '1d';
  try {
    jwt.sign({ _probe: 1 }, secret, { expiresIn: exp });
  } catch (e) {
    console.error('[startup] FATAL: JWT config invalid (check JWT_SECRET and JWT_EXPIRES_IN):', e.message);
    process.exit(1);
  }

  const custSecret = process.env.CUSTOMER_JWT_SECRET;
  if (!custSecret || String(custSecret).trim() === '') {
    console.warn('[startup] WARNING: CUSTOMER_JWT_SECRET is not set. Eyewoot Go customer login will fail. Add it to .env.');
  }
}

const PORT = process.env.PORT || 4000;
const isProductionEnv = (process.env.NODE_ENV || 'development') === 'production';
const API_RATE_LIMIT_WINDOW_MS = Number(process.env.API_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const API_RATE_LIMIT_MAX = Number(process.env.API_RATE_LIMIT_MAX || 1000);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:4000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

/** Private LAN / loopback origins (tablet on same Wi‑Fi, etc.). Used only when CORS allows it. */
function isPrivateLanOrigin(origin) {
  if (!origin || typeof origin !== 'string') return false;
  let hostname;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  const m = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(hostname);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

const corsAllowPrivateLan =
  !isProductionEnv &&
  !['0', 'false', 'no'].includes(String(process.env.CORS_ALLOW_PRIVATE_LAN || 'true').toLowerCase());

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
  // Always bypass browser/CDN cache for *.html prototypes (POS, Foundry, etc.).
  // Previously: prod cached shells + 7d static JS/CSS ⇒ users saw mismatched old UI/layouts.
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.sendFile(absolutePath, {
    maxAge: 0,
    lastModified: true,
    cacheControl: false
  });
}

const MODULE_SHELLS = {
  foundry: path.join(__dirname, 'Foundry_Prototype.html'),
  storepilot: path.join(__dirname, 'StorePilot_Prototype.html'),
  finance: path.join(__dirname, 'Finance_Prototype.html'),
  'command-unit': path.join(__dirname, 'CommandUnit_Prototype.html'),
  pos: path.join(__dirname, 'POS_Prototype.html'),
  cx: path.join(__dirname, 'Cx_Prototype.html'),
};

function sendModuleShell(res, moduleKey) {
  const shellPath = MODULE_SHELLS[moduleKey];
  return sendPrototypeHtml(res, shellPath);
}

/** Inline + URL variants so login and prototypes always receive a real JS MIME type and never hit a JSON 404. */
function buildClientConfigInlineScript() {
  const key = process.env.API_KEY || '';
  return `<script>window.__COSMOS_API_KEY__=${JSON.stringify(key)};</script>`;
}

function sendCosmosClientConfigJs(req, res) {
  const key = process.env.API_KEY || '';
  res.status(200);
  res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.send(`window.__COSMOS_API_KEY__=${JSON.stringify(key)};\n`);
}

app.get('/cosmos-client-config.js', sendCosmosClientConfigJs);
app.get('/js/cosmos-client-config.js', sendCosmosClientConfigJs);

// Avoid noisy 404 in dev tools when no favicon is bundled
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

function sendLoginPage(req, res) {
  const loginPath = path.join(__dirname, 'src', 'public', 'login.html');
  let html = fs.readFileSync(loginPath, 'utf8');
  const marker = '<!--COSMOS_CLIENT_CONFIG-->';
  if (html.includes(marker)) {
    html = html.replace(marker, buildClientConfigInlineScript());
  } else {
    html = html.replace(
      '<script src="/js/login.js"',
      `${buildClientConfigInlineScript()}\n  <script src="/js/login.js"`
    );
  }
  res.status(200);
  res.type('html');
  res.send(html);
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
      if (corsAllowPrivateLan && isPrivateLanOrigin(origin)) return callback(null, true);
      return callback(new Error('CORS not allowed'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    maxAge: 86400
  })
);

// Body parsing
// Keep uploads on multer routes; allow larger metadata payloads on JSON/urlencoded endpoints.
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Public bootstrap — NOT under /api so it never hits protectedApiRouter (which requires X-API-Key).
app.get('/config/bootstrap.json', (req, res) => {
  const strictEmpty = isRbacStrictEmptyPermissions();
  res.json({
    success: true,
    data: {
      apiKey: process.env.API_KEY || '',
      rbacStrictEmptyPermissions: strictEmpty,
      rbacLegacyEmptyPermissionBypass: !strictEmpty
    }
  });
});

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

// Login UI — inject API key so /cosmos-client-config.js is not required for sign-in
app.get('/', sendLoginPage);
app.get('/login.html', sendLoginPage);

// Legacy .html entries -> clean module URLs (hard switch).
app.get('/foundry.html', (req, res) => res.redirect(302, '/foundry/dashboard'));
app.get('/storepilot.html', (req, res) => res.redirect(302, '/storepilot/dashboard'));
app.get('/finance.html', (req, res) => res.redirect(302, '/finance/dashboard'));
app.get('/command-unit.html', (req, res) => res.redirect(302, '/command-unit/dashboard'));
app.get('/cx.html', (req, res) => res.redirect(302, '/cx/dashboard'));
// Self-hosted fonts: long cache lifetime + immutable.
app.use(
  '/fonts',
  express.static(path.join(__dirname, 'src', 'public', 'fonts'), {
    maxAge: '365d',
    immutable: true
  })
);

// Store OS HTML shell MUST run before the broad `express.static` below.
// Mount dedicated routers so every path under /storeos and /pos is served (SPA fallback before static).
// A plain req.path prefix check can miss some Express/path combinations; mounting is reliable.
function sendPosShellForSpa(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  return sendModuleShell(res, 'pos');
}

const posSpaRouter = express.Router();
posSpaRouter.use(sendPosShellForSpa);

app.use('/storeos', posSpaRouter);
app.use('/pos', posSpaRouter);

// Static assets
// - Long-cache defaults for images/other; JS/CSS always revalidate (ERP UI changes often).
// - HTML under src/public is non-cached; module shells remain root *_Prototype.html routes.
app.use(
  express.static(path.join(__dirname, 'src', 'public'), {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
        return;
      }
      // Dev + prod: avoid stale bundled behaviour when HTML updated (classic /storeos "old UI" bug).
      if (/\.(js|css)$/i.test(filePath)) {
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
app.get(['/cx', '/cx/*'], (req, res) => sendModuleShell(res, 'cx'));
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

// Customer-facing Eyewoot Go routes — no apiKeyAuth, no staff JWT (uses CUSTOMER_JWT_SECRET)
app.use('/api/customer/auth', customerAuthRouter);
app.use('/api/customer',      customerAppRouter);

// Eyewoot Go PWA shell + service worker
app.get('/go', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'src', 'public', 'go.html'));
});
app.get('/go-sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'src', 'public', 'go-sw.js'));
});

// Auth/public routes that do not use grouped protected router.
app.use('/api/auth', apiKeyAuth, authRouter);
// POS router: no apiKeyAuth — tablet boots before any session exists.
// Public routes (staff-login, stores) need no auth. Protected routes handle authJwt internally.
app.use('/api/pos', posRouter);
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
protectedApiRouter.use('/foundry/lens-config', lensConfigRouter);
protectedApiRouter.use('/maker-master', makerMasterRouter);
protectedApiRouter.use('/branding-agents', brandingAgentsRouter);
protectedApiRouter.use('/skus', skusRouter);
protectedApiRouter.use('/uploads', uploadsRouter);
protectedApiRouter.use('/finance', financeRouter);
protectedApiRouter.use('/stock-transfers', stockTransfersRouter);
protectedApiRouter.use('/transfer-requests', transferRequestsRouter);
protectedApiRouter.use('/stock-transfer-docs', stockTransferDocsRouter);
protectedApiRouter.use('/cx', cxRouter);
protectedApiRouter.use('/orders', ordersRouter);
protectedApiRouter.use('/meta', metaRouter);
protectedApiRouter.use('/tablets', tabletsRouter);
app.use('/api', protectedApiRouter);

// 404 + error handling
app.use(notFoundHandler);
app.use(errorHandler);

assertAuthEnv();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Cosmos ERP server listening on port ${PORT}`);
});

