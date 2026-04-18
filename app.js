require('dotenv').config();

const fs = require('fs');
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

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
const { executeStoredProcedure } = require('./src/config/db');
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

const PORT = process.env.PORT || 4000;

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

// CORS (can be tightened later)
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
  })
);

// JSON body parsing
app.use(express.json({ limit: '1mb' }));

// Simple rate limiter for all APIs
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000
  })
);

// Request logging
app.use(requestLogger);

// Goods Transfer — destination stores (before static + two paths so old proxies / cached routes still resolve)
const destinationStoresChain = [apiKeyAuth, authJwt, requireGoodsTransferDestinationStores, handleDestinationStores];
app.get('/api/stock-transfers/destination-stores', ...destinationStoresChain);
app.get('/api/foundry/destination-stores', ...destinationStoresChain);

// Login UI — inject API key so /cosmos-client-config.js is not required for sign-in
app.get('/', sendLoginPage);
app.get('/login.html', sendLoginPage);

// Serve full Command Unit prototype UI
app.get('/command-unit.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'CommandUnit_Prototype.html'));
});

// Serve full Foundry prototype UI
app.get('/foundry.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'Foundry_Prototype.html'));
});

// Serve Finance prototype UI
app.get('/finance.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'Finance_Prototype.html'));
});

// StorePilot — showroom / store management (separate from POS)
app.get('/storepilot.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'StorePilot_Prototype.html'));
});

// Static assets (images, JS, CSS for login + any new pages)
app.use(express.static(path.join(__dirname, 'src', 'public')));

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
  // Lazy require to avoid circular deps at startup
  // eslint-disable-next-line global-require
  const { healthCheck } = require('./src/config/db');
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

// Protected API routes use API key + JWT
app.use('/api/auth', apiKeyAuth, authRouter);
app.use('/api/stores', apiKeyAuth, authJwt, storesRouter);
app.use('/api/users', apiKeyAuth, authJwt, usersRouter);
app.use('/api/home-brands', apiKeyAuth, authJwt, homeBrandsRouter);
app.use('/api/suppliers', apiKeyAuth, authJwt, suppliersRouter);
app.use('/api/products', apiKeyAuth, authJwt, productsRouter);
app.use('/api/purchases', apiKeyAuth, authJwt, purchasesRouter);
app.use('/api/roles', apiKeyAuth, authJwt, rolesRouter);
app.use('/api/settings', apiKeyAuth, authJwt, settingsRouter);
app.use('/api/audit-logs', apiKeyAuth, authJwt, auditLogsRouter);
app.use('/api/store-modules', apiKeyAuth, authJwt, moduleAccessRouter);
app.use('/api/user-modules', apiKeyAuth, authJwt, userModuleAccessRouter);
app.use('/api/role-modules', apiKeyAuth, authJwt, roleModuleAccessRouter);
app.use('/api/foundry-lookups', apiKeyAuth, authJwt, foundryLookupsRouter);
app.use('/api/maker-master',      apiKeyAuth, authJwt, makerMasterRouter);
app.use('/api/branding-agents',  apiKeyAuth, authJwt, brandingAgentsRouter);
app.use('/api/skus',          apiKeyAuth, authJwt, skusRouter);
app.use('/api/uploads',      apiKeyAuth, authJwt, uploadsRouter);
app.use('/api/qr',           qrRouter); // public — <img> tags cannot send auth headers; QR data is non-sensitive
app.use('/api/finance',          apiKeyAuth, authJwt, financeRouter);

app.use('/api/stock-transfers',     apiKeyAuth, authJwt, stockTransfersRouter);
app.use('/api/transfer-requests',  apiKeyAuth, authJwt, transferRequestsRouter);
app.use('/api/stock-transfer-docs', apiKeyAuth, authJwt, stockTransferDocsRouter);

// 404 + error handling
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Cosmos ERP server listening on port ${PORT}`);
});

