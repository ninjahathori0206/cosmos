'use strict'

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

// Simple Cosmos mark: blue rounded square + orbital ring (SVG → PNG for browser favicons)
const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#1e40af"/>
  <circle cx="16" cy="16" r="10" fill="none" stroke="#ffffff" stroke-width="2"/>
  <circle cx="16" cy="16" r="3" fill="#ffffff"/>
</svg>`
)

;(async () => {
  const publicDir = path.join(__dirname, '..', 'src', 'public')
  const pngOut = path.join(publicDir, 'favicon.png')
  const icoOut = path.join(publicDir, 'favicon.ico')
  const buf = await sharp(svg).resize(32, 32).png().toBuffer()
  await fs.promises.writeFile(pngOut, buf)
  // Browsers accept PNG bytes at /favicon.ico; static middleware can serve this file too.
  await fs.promises.writeFile(icoOut, buf)
  console.log('Wrote', pngOut)
  console.log('Wrote', icoOut)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
