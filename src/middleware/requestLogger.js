const fs = require('fs');
const path = require('path');

const logDir = process.env.LOG_DIRECTORY || path.join(__dirname, '..', '..', '..', 'logs');

if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch {
    // ignore; app should still run even if log dir cannot be created
  }
}

const accessLogPath = path.join(logDir, 'access.log');

function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const line = [
      new Date().toISOString(),
      req.ip,
      req.method,
      req.originalUrl,
      res.statusCode,
      `${duration}ms`
    ].join(' ');

    fs.appendFile(accessLogPath, line + '\n', () => {});
  });
  next();
}

module.exports = {
  requestLogger
};

