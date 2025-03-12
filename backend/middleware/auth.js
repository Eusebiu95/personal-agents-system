const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Middleware to authenticate users via JWT
 */
const authenticateUser = (req, res, next) => {
  // In a real implementation, this would verify a JWT token
  // For now, we'll just pass through
  next();
};

/**
 * Middleware to check if user is an admin
 */
const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
  }
  
  next();
};

module.exports = { authenticateUser, isAdmin }; 