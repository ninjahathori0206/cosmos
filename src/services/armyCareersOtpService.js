'use strict';

const crypto = require('crypto');

const OTP_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

const otpByPhone = new Map();
const tokenByValue = new Map();

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return null;
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

function sendOtp(phoneRaw) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    const err = new Error('Enter a valid 10-digit mobile number.');
    err.statusCode = 400;
    throw err;
  }

  const existing = otpByPhone.get(phone);
  const now = Date.now();
  if (existing && now - existing.sentAt < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.sentAt)) / 1000);
    const err = new Error('Please wait ' + waitSec + 's before requesting another OTP.');
    err.statusCode = 429;
    throw err;
  }

  const otpCode = generateOtpCode();
  otpByPhone.set(phone, {
    otpCode,
    sentAt: now,
    expiresAt: now + OTP_TTL_MS,
    attempts: 0
  });

  const devExpose = process.env.ARMY_CAREERS_OTP_DEV === '1'
    || (process.env.NODE_ENV || 'development') !== 'production';

  if (devExpose) {
    // eslint-disable-next-line no-console
    console.log('[army-careers] OTP for +' + phone + ': ' + otpCode);
  }

  return {
    phone,
    expires_in_seconds: Math.floor(OTP_TTL_MS / 1000),
    dev_otp: devExpose ? otpCode : undefined
  };
}

function verifyOtp(phoneRaw, otpCodeRaw) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    const err = new Error('Enter a valid 10-digit mobile number.');
    err.statusCode = 400;
    throw err;
  }

  const otpCode = String(otpCodeRaw || '').trim();
  if (!/^\d{6}$/.test(otpCode)) {
    const err = new Error('Enter the 6-digit OTP.');
    err.statusCode = 400;
    throw err;
  }

  const record = otpByPhone.get(phone);
  if (!record) {
    const err = new Error('OTP expired or not sent. Request a new code.');
    err.statusCode = 400;
    throw err;
  }

  if (Date.now() > record.expiresAt) {
    otpByPhone.delete(phone);
    const err = new Error('OTP expired. Request a new code.');
    err.statusCode = 400;
    throw err;
  }

  record.attempts += 1;
  if (record.attempts > 5) {
    otpByPhone.delete(phone);
    const err = new Error('Too many attempts. Request a new OTP.');
    err.statusCode = 429;
    throw err;
  }

  if (record.otpCode !== otpCode) {
    const err = new Error('Incorrect OTP. Try again.');
    err.statusCode = 400;
    throw err;
  }

  otpByPhone.delete(phone);

  const verificationToken = generateToken();
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  tokenByValue.set(verificationToken, { phone, expiresAt });

  return {
    phone,
    verification_token: verificationToken,
    expires_in_seconds: Math.floor(TOKEN_TTL_MS / 1000)
  };
}

function assertVerificationToken(tokenRaw) {
  const token = String(tokenRaw || '').trim();
  if (!token) {
    const err = new Error('Phone verification required.');
    err.statusCode = 401;
    throw err;
  }

  const record = tokenByValue.get(token);
  if (!record) {
    const err = new Error('Verification expired. Verify your number again.');
    err.statusCode = 401;
    throw err;
  }

  if (Date.now() > record.expiresAt) {
    tokenByValue.delete(token);
    const err = new Error('Verification expired. Verify your number again.');
    err.statusCode = 401;
    throw err;
  }

  return { phone: record.phone, verification_token: token };
}

function revokeVerificationToken(token) {
  tokenByValue.delete(String(token || '').trim());
}

module.exports = {
  normalizePhone,
  sendOtp,
  verifyOtp,
  assertVerificationToken,
  revokeVerificationToken
};
