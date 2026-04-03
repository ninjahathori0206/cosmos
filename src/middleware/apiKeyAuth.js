function apiKeyAuth(req, res, next) {
  const configuredKey = process.env.API_KEY;
  const headerKey = req.header('X-API-Key');

  if (!configuredKey || !headerKey || headerKey !== configuredKey) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or missing API key'
    });
  }

  return next();
}

module.exports = {
  apiKeyAuth
};

