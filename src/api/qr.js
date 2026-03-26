const express   = require('express');
const QRCode    = require('qrcode');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Protect against bulk abuse — 300 requests per minute per IP is enough for
// a label sheet with hundreds of QR codes while preventing external scraping
const qrLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many QR requests — slow down.',
});

// GET /api/qr?data=VALUE&size=120
// Public (no API key required) — <img> tags cannot send custom headers.
// Returns a PNG of the QR code.
router.get('/', qrLimiter, async (req, res) => {
  const { data, size } = req.query;
  if (!data) return res.status(400).send('Missing ?data= parameter');

  // Clamp size: 40–400 px
  const px = Math.min(400, Math.max(40, parseInt(size, 10) || 120));

  try {
    const buf = await QRCode.toBuffer(data, {
      type: 'png',
      width: px,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400'); // browser caches for 1 day
    res.send(buf);
  } catch (err) {
    res.status(500).send('QR generation failed: ' + err.message);
  }
});

module.exports = router;
