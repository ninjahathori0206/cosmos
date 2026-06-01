'use strict'

/** Strip non-digits; drop leading 91 or trunk 0 — expect 10-digit Indian mobile (starts 6–9). */
function normalizeIndiaMobileDigits(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return d
}

function isValidIndiaMobileDigits(digits) {
  return /^[6-9]\d{9}$/.test(String(digits || ''))
}

function parseIndiaMobileForSave(raw) {
  const phone = normalizeIndiaMobileDigits(raw)
  if (!isValidIndiaMobileDigits(phone)) {
    return {
      ok: false,
      message: 'Phone must be a valid 10-digit Indian mobile (optional +91 or leading 0).'
    }
  }
  return { ok: true, phone }
}

module.exports = {
  normalizeIndiaMobileDigits,
  isValidIndiaMobileDigits,
  parseIndiaMobileForSave
}
