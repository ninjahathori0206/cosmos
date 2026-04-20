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

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
  transports: [
    new DailyRotateFile({
      filename: '%DATE%-app.log',
      dirname: logDir,
      datePattern: 'YYYY-MM-DD',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      maxSize: process.env.LOG_MAX_SIZE || '50m',
      zippedArchive: true
    }),
    new winston.transports.Console({
      silent: process.env.NODE_ENV === 'production'
    })
  ]
})

module.exports = {
  logger
}

