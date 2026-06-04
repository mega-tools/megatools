const jwt = require('jsonwebtoken');
const { User } = require('./models');

const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired' });
      }
      if (jwtErr.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token signature' });
      }
      throw jwtErr;
    }

    const user = User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'User not found' });
    if (user.status === 'blocked') return res.status(403).json({ message: 'Account blocked' });
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    res.status(401).json({ message: 'Authentication failed' });
  }
};

// ⭐ Admin only
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  res.status(403).json({ message: 'Admin access required' });
};

// ⭐ Admin or Moderator
const isModerator = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'moderator')) return next();
  res.status(403).json({ message: 'Moderator access required' });
};

// ⭐ Admin or same user (for profile)
const isOwnerOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user._id === req.params.id)) return next();
  res.status(403).json({ message: 'Access denied' });
};

module.exports = { authenticate, isAdmin, isModerator, isOwnerOrAdmin };