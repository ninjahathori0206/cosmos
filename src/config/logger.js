const fs = require('fs')
const path = require('path')
const winston = require('winston')
const DailyRotateFile = require('winston-daily-rotate-file')

const logDir = process.env.LOG_DIRECTORY || path.join(__dirname, '..', '..', 'logs')

if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true })
  } catch {
    // Ignore folder creation failures; console logging still works
  }
}

function istLogTimestamp () {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T')
}

const consoleTransport = new winston.transports.Console({
  silent: process.env.NODE_ENV === 'production'
})

const fileTransport = new DailyRotateFile({
  filename: '%DATE%-app.log',
  dirname: logDir,
  datePattern: 'YYYY-MM-DD',
  maxFiles: process.env.LOG_MAX_FILES || '14d',
  maxSize: process.env.LOG_MAX_SIZE || '50m',
  zippedArchive: true
})

// EPERM / locked log files must not crash the API process (e.g. stale handle or AV lock).
fileTransport.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.warn('[logger] file transport error (logging to console only):', err && err.message ? err.message : err)
})

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: istLogTimestamp }),
    winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
  transports: [fileTransport, consoleTransport]
})

module.exports = {
  logger
}

