const fs = require('fs');
const path = require('path');
const { PWA_BUILD_STAMP } = require('../config/pwaBuildStamp');

const SW_FILES = {
  storepilot: 'storepilot-sw.js',
  storeos: 'storeos-sw.js',
  go: 'go-sw.js'
};

const CACHE_PREFIX = {
  storepilot: 'storepilot',
  storeos: 'storeos',
  go: 'eyewoot-go'
};

function sendPwaServiceWorker(res, moduleKey) {
  const fileName = SW_FILES[moduleKey];
  const prefix = CACHE_PREFIX[moduleKey];
  if (!fileName || !prefix) {
    res.status(404).end();
    return;
  }

  const swPath = path.join(__dirname, '..', 'public', fileName);
  let source = fs.readFileSync(swPath, 'utf8');
  const cacheName = prefix + '-' + PWA_BUILD_STAMP;
  source = source.replace(/var CACHE_NAME = ['"][^'"]+['"];/, "var CACHE_NAME = '" + cacheName + "';");

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(source);
}

module.exports = {
  sendPwaServiceWorker,
  PWA_BUILD_STAMP
};
