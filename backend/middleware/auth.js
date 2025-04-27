const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // Get token from header
  const token = req.header('Authorization');

  // Check if not token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Verify token
  try {
    // Check if token starts with 'Bearer '
    let actualToken = token;
    if (token.startsWith('Bearer ')) {
        actualToken = token.split(' ')[1];
    }

    if (!actualToken) {
        return res.status(401).json({ msg: 'Malformed token, authorization denied' });
    }

    const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);

    // Add user from payload
    req.user = decoded.user; 
    next();
  } catch (err) {
    console.error('JWT Error:', err.message); 
    res.status(401).json({ msg: 'Token is not valid' });
  }
}; 