/**
 * One-off: generate Store Pilot PWA icons (192 + 512) for storepilot-manifest.json.
 * Run: node scripts/generate-storepilot-pwa-icons.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const outDir = path.join(__dirname, '..', 'src', 'public', 'img');
const bg = '#0B1F33';
const accent = '#1D6FD4';

function iconSvg(size) {
  const pad = Math.round(size * 0.12);
  const fontSize = Math.round(size * 0.32);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="${bg}"/>
      <rect x="${pad}" y="${pad}" width="${size - pad * 2}" height="${size - pad * 2}" rx="${Math.round(size * 0.12)}" fill="${accent}" opacity="0.28"/>
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
        font-family="system-ui,Segoe UI,sans-serif" font-size="${fontSize}" font-weight="700" fill="#EFF6FF">SP</text>
    </svg>`
  );
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  for (const size of [192, 512]) {
    const out = path.join(outDir, `storepilot-icon-${size}.png`);
    await sharp(iconSvg(size)).png().toFile(out);
    console.log('Wrote', out);
  }
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
