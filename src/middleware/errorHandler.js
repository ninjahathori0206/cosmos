// SQL error numbers that represent user / business-logic errors (not server faults)
const SQL_BUSINESS_LOGIC_NUMBERS = new Set([
  50000  // RAISERROR without explicit msg_id — our own business-rule throws
]);

// SQL error numbers that are constraint / conflict errors → 409
const SQL_CONFLICT_NUMBERS = new Set([
  547,   // FK constraint violation
  2627,  // UNIQUE constraint violation (PRIMARY KEY)
  2601   // UNIQUE index violation
]);

// SQL connection / timeout codes
const SQL_UNAVAILABLE_CODES = new Set([
  'ENOTOPEN',
  'ETIMEOUT',
  'ECONNRESET',
  'ECONNREFUSED'
]);

function classifySqlError(err) {
  const code = err.code || '';
  const number = err.number || 0;

  if (SQL_UNAVAILABLE_CODES.has(code)) {
    return { status: 503, message: 'Database temporarily unavailable. Please retry.' };
  }

  // RequestError = SQL engine threw
  if (code === 'EREQUEST') {
    if (SQL_BUSINESS_LOGIC_NUMBERS.has(number) || number >= 50000) {
      // User-defined RAISERROR — surface the message directly
      return { status: 422, message: err.message };
    }
    if (SQL_CONFLICT_NUMBERS.has(number)) {
      return { status: 409, message: err.message };
    }
    // Any other SQL error still surfaces message (avoids raw "Internal server error")
    return { status: 422, message: err.message };
  }

  return null; // Not a SQL error — caller decides
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: 'Resource not found'
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.error('Error:', err.message, err.stack);
  }

  // Try to classify as a SQL error first
  const sqlClassification = classifySqlError(err);
  if (sqlClassification) {
    return res.status(sqlClassification.status).json({
      success: false,
      message: sqlClassification.message
    });
  }

  // Explicit status code on the error object (e.g. from Joi or custom throws)
  const status = err.statusCode || err.status || 500;

  return res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error' : (err.message || 'Request failed'),
    // Include raw error message for diagnostics (avoids needing to open server console)
    error: err.message || undefined
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
