process.env.TZ = 'Asia/Kolkata'; // IST — must be first line, before any require()
require('dotenv').config();

const jwt = require('jsonwebtoken');
const express = require('express');
const fs = require('fs');
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
const labelPrintFormatsRouter  = require('./src/api/labelPrintFormats');
const storeCollectionsRouter   = require('./src/api/storeCollections');
const tabletsRouter            = require('./src/api/tablets');
const customerAuthRouter       = require('./src/api/customerAuth');
const customerAppRouter        = require('./src/api/customerApp');
const armyCareersRouter        = require('./src/api/armyCareers');
const armyHrRouter             = require('./src/api/armyHr');
const { executeStoredProcedure, healthCheck } = require('./src/config/db');
const {
  requireGoodsTransferDestinationStores,
  isRbacStrictEmptyPermissions
} = require('./src/middleware/authorize');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');

const { filterStoresRetailDestinations, warmStoreTypesCache } = require('./src/config/storeTypesCatalog');
const { UPLOADS_ROOT, ensureUploadDirs } = require('./src/config/uploadPaths');

async function handleDestinationStores(req, res, next) {
  try {
    const result = await executeStoredProcedure('sp_Store_GetAll', {});
    const rows = await filterStoresRetailDestinations(result.recordset || []);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
}

const app = express();
if (process.env.NODE_ENV === 'production' || String(process.env.TRUST_PROXY || '').trim() === '1') {
  app.set('trust proxy', 1);
}
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
function parseRateLimitPositiveInt(raw, fallback, label) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    // eslint-disable-next-line no-console
    console.warn(`[rate-limit] invalid ${label}="${raw}", using ${fallback}`);
    return fallback;
  }
  return Math.floor(n);
}

const API_RATE_LIMIT_WINDOW_MS = parseRateLimitPositiveInt(
  process.env.API_RATE_LIMIT_WINDOW_MS,
  15 * 60 * 1000,
  'API_RATE_LIMIT_WINDOW_MS'
);
const API_RATE_LIMIT_MAX = parseRateLimitPositiveInt(
  process.env.API_RATE_LIMIT_MAX,
  1000,
  'API_RATE_LIMIT_MAX'
);

/** QR label previews hit /api/qr heavily; that route has its own limiter — skip global /api bucket. */
function isQrApiRequest(req) {
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  return path === '/api/qr' || path.startsWith('/api/qr/');
}

/** Canonical form for Origin comparison — trims paths, slashes, folds host case, drops default ports. */
function normalizeCorsOrigin(origin) {
  if (origin == null || typeof origin !== 'string') return '';
  const trimmed = origin.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  try {
    const u = new URL(trimmed);
    const protocol = u.protocol.toLowerCase();
    const hostname = u.hostname.toLowerCase();
    let port = String(u.port || '');
    if (protocol === 'https:' && port === '443') port = '';
    if (protocol === 'http:' && port === '80') port = '';
    const host =
      hostname.includes(':') && !hostname.startsWith('[') ? `[${hostname}]` : hostname;
    const portPart = port ? `:${port}` : '';
    return `${protocol}//${host}${portPart}`;
  } catch {
    return '';
  }
}

const allowedOriginEntries = (process.env.ALLOWED_ORIGINS || 'http://localhost:4000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOriginSet = new Set(
  allowedOriginEntries.map(normalizeCorsOrigin).filter(Boolean)
);

const unparsableCorsOrigins = allowedOriginEntries.filter((raw) => !normalizeCorsOrigin(raw));
if (unparsableCorsOrigins.length) {
  console.warn(
    '[cors] Invalid ALLOWED_ORIGINS entries (use full origins, e.g. https://app.example.com):',
    unparsableCorsOrigins.join(' | ')
  );
}
if (allowedOriginEntries.length && allowedOriginSet.size === 0) {
  console.error(
    '[cors] No valid ALLOWED_ORIGINS — cross-origin browser requests will be rejected until fixed.'
  );
}

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
  army: path.join(__dirname, 'Army_Prototype.html'),
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
      if (!origin || allowedOriginSet.has(normalizeCorsOrigin(origin))) return callback(null, true);
      if (corsAllowPrivateLan && isPrivateLanOrigin(origin)) return callback(null, true);
      // eslint-disable-next-line no-console
      console.warn(
        '[cors] blocked Origin:',
        origin,
        '| add exact front-end URL to ALLOWED_ORIGINS on the server (https + host, comma-separated).'
      );
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

// Simple rate limiter for all APIs (QR previews excluded — see isQrApiRequest)
app.use(
  '/api',
  rateLimit({
    windowMs: API_RATE_LIMIT_WINDOW_MS,
    max: API_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isQrApiRequest(req),
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: 'Too many API requests. Wait a moment and try again.'
      });
    },
    ...(apiRateLimitStore ? { store: apiRateLimitStore } : {})
  })
);

// Request logging (API only; skip static asset noise)
app.use('/api', requestLogger);

// ERP API responses must never be browser-cached (ETag 304 kept stale empty order lists after deploy).
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
});

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
app.get('/cx.html', (req, res) => res.redirect(302, '/cx/dashboard'));

// Default browser probe — many agents request `/favicon.ico`; we ship PNG bytes (widely supported).
const faviconPublicDir = path.join(__dirname, 'src', 'public');
const faviconAssetPath = path.join(faviconPublicDir, 'favicon.ico');
const faviconPngFallback = path.join(faviconPublicDir, 'favicon.png');
app.get('/favicon.ico', (req, res, next) => {
  const assetPath = fs.existsSync(faviconAssetPath)
    ? faviconAssetPath
    : (fs.existsSync(faviconPngFallback) ? faviconPngFallback : null);
  if (!assetPath) return next();
  res.type('image/png');
  res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
  return res.sendFile(assetPath, (err) => (err ? next(err) : undefined));
});

// User uploads (digitization photos, prescriptions) — gitignored; must exist on disk per environment.
ensureUploadDirs();
app.use(
  '/uploads',
  express.static(UPLOADS_ROOT, {
    maxAge: '7d',
    fallthrough: false
  })
);

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

const { sendPwaServiceWorker, PWA_BUILD_STAMP } = require('./src/utils/sendPwaServiceWorker');

// PWA service workers — before express.static so CACHE_NAME is injected from git/deploy stamp.
app.get('/go-sw.js', (req, res) => sendPwaServiceWorker(res, 'go'));
app.get('/storeos-sw.js', (req, res) => sendPwaServiceWorker(res, 'storeos'));
app.get('/storepilot-sw.js', (req, res) => sendPwaServiceWorker(res, 'storepilot'));

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
app.get(['/army/hr', '/army/hr/*'], (req, res) => sendModuleShell(res, 'army'));
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

// Public Army careers portal — no auth (candidate-facing job listings)
app.use('/api/army/careers', armyCareersRouter);

// Eyewoot Go PWA shell + service worker
app.get('/go', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'src', 'public', 'go.html'));
});

// Army public careers portal (mobile-first)
app.get(['/army/careers', '/army/careers/*'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'src', 'public', 'army-careers.html'));
});

// Store OS PWA manifest
app.get('/storeos-manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'src', 'public', 'storeos-manifest.json'));
});

// Store Pilot PWA manifest
app.get('/storepilot-manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'src', 'public', 'storepilot-manifest.json'));
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
protectedApiRouter.use('/foundry/label-print-formats', labelPrintFormatsRouter);
protectedApiRouter.use('/maker-master', makerMasterRouter);
protectedApiRouter.use('/branding-agents', brandingAgentsRouter);
protectedApiRouter.use('/skus', skusRouter);
protectedApiRouter.use('/uploads', uploadsRouter);
protectedApiRouter.use('/finance', financeRouter);
protectedApiRouter.use('/stock-transfers', stockTransfersRouter);
/* History before sub-router so /history is never captured by GET /:id (id=history) */
protectedApiRouter.get(
  '/transfer-requests/history',
  ...transferRequestsRouter.transferModAndView,
  transferRequestsRouter.handleTransferRequestHistoryGet
);
protectedApiRouter.use('/transfer-requests', transferRequestsRouter);
protectedApiRouter.use('/stock-transfer-docs', stockTransferDocsRouter);
protectedApiRouter.use('/cx', cxRouter);
protectedApiRouter.use('/army/hr', armyHrRouter);
protectedApiRouter.use('/orders', ordersRouter);
/* Meta: explicit mount so new catalogue routes work without stale sub-router cache */
protectedApiRouter.get(
  '/meta/transfer-request-list-views',
  ...metaRouter.transferRequestListViewsMiddleware
);
protectedApiRouter.use('/meta', metaRouter);
protectedApiRouter.use('/collections', storeCollectionsRouter);
protectedApiRouter.use('/tablets', tabletsRouter);
app.use('/api', protectedApiRouter);

// 404 + error handling
app.use(notFoundHandler);
app.use(errorHandler);

assertAuthEnv();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Cosmos ERP server listening on port ${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[PWA] service worker cache stamp: ${PWA_BUILD_STAMP}`);
  const { warmStoreTypesCache } = require('./src/config/storeTypesCatalog');
  warmStoreTypesCache().catch((err) => {
    // eslint-disable-next-line no-console
    console.warn('[store-types] cache warm failed:', err.message || err);
  });
});

