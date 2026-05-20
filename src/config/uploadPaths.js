const fs = require('fs');
const path = require('path');

const PUBLIC_ROOT = path.join(__dirname, '..', 'public');
const UPLOADS_ROOT = path.join(PUBLIC_ROOT, 'uploads');
const PRODUCT_UPLOAD_DIR = path.join(UPLOADS_ROOT, 'products');
const PRESCRIPTION_UPLOAD_DIR = path.join(UPLOADS_ROOT, 'prescriptions');

function ensureUploadDirs() {
  [UPLOADS_ROOT, PRODUCT_UPLOAD_DIR, PRESCRIPTION_UPLOAD_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

ensureUploadDirs();

/**
 * Resolve a public URL like /uploads/products/foo.jpg to an on-disk path.
 * Returns null when the URL is invalid or the file is missing.
 */
function resolvePublicUploadPath(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return null;
  const normalized = publicUrl.split('?')[0].trim();
  if (!normalized.startsWith('/uploads/')) return null;

  const rel = normalized.replace(/^\/uploads\//, '');
  if (!rel || rel.includes('..')) return null;

  const abs = path.resolve(UPLOADS_ROOT, rel);
  const rootResolved = path.resolve(UPLOADS_ROOT);
  if (abs !== rootResolved && !abs.startsWith(rootResolved + path.sep)) return null;
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  return abs;
}

function assertUploadFileExists(publicUrl, label) {
  const abs = resolvePublicUploadPath(publicUrl);
  if (!abs) {
    const err = new Error(
      `${label || 'Upload'} file not found on server. Upload again before saving — stored files live under /uploads and are not in git.`
    );
    err.statusCode = 400;
    throw err;
  }
  return abs;
}

module.exports = {
  PUBLIC_ROOT,
  UPLOADS_ROOT,
  PRODUCT_UPLOAD_DIR,
  PRESCRIPTION_UPLOAD_DIR,
  ensureUploadDirs,
  resolvePublicUploadPath,
  assertUploadFileExists
};
