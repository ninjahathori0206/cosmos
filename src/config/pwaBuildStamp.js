const { execSync } = require('child_process');

/**
 * Stable PWA cache/build id for service worker CACHE_NAME injection.
 * - Set PWA_BUILD_ID in CI/deploy to pin a release (optional).
 * - Otherwise uses git short hash at process start (changes when you deploy new code + restart).
 */
function resolvePwaBuildStamp() {
  const env = process.env.PWA_BUILD_ID != null ? String(process.env.PWA_BUILD_ID).trim() : '';
  if (env) return env.slice(0, 40);

  try {
    return execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch (_err) {
    return 'dev';
  }
}

const PWA_BUILD_STAMP = resolvePwaBuildStamp();

module.exports = {
  PWA_BUILD_STAMP,
  resolvePwaBuildStamp
};
