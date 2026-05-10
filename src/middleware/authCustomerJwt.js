const jwt = require('jsonwebtoken');

function authCustomerJwt(req, res, next) {
  const authHeader = req.header('Authorization') || '';
  const [, token] = authHeader.split(' ');

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Missing customer authorization token'
    });
  }

  const secret = process.env.CUSTOMER_JWT_SECRET;
  if (!secret) {
    return res.status(500).json({
      success: false,
      message: 'Server configuration error: CUSTOMER_JWT_SECRET not set'
    });
  }

  try {
    const decoded = jwt.verify(token, secret);
    if (decoded.sub !== 'customer') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }
    req.customerId = decoded.customerId;
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired customer token'
    });
  }
}

module.exports = { authCustomerJwt };
