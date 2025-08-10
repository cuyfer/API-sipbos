const { verifyToken } = require('../utils/jwt');

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: token missing' });
  }
  const token = auth.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded; // { id: ... } or more fields if included
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: invalid token' });
  }
}

module.exports = authMiddleware;
