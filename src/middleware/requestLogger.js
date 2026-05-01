const { logger } = require('../config/logger')

function requestLogger(req, res, next) {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    const line = [
      new Date().toISOString(),
      req.ip,
      req.method,
      req.originalUrl,
      res.statusCode,
      `${duration}ms`
    ].join(' ')
    logger.info(line)
  })
  next()
}

module.exports = {
  requestLogger
}

