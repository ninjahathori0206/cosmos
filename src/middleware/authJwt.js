const jwt = require('jsonwebtoken');

function authJwt(req, res, next) {
  const authHeader = req.header('Authorization') || '';
  const [, token] = authHeader.split(' ');

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Missing Authorization token'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
}

module.exports = {
  authJwt
};

