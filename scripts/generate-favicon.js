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
  const out = path.join(__dirname, '..', 'src', 'public', 'favicon.png')
  await sharp(svg).resize(32, 32).png().toFile(out)
  console.log('Wrote', out)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
