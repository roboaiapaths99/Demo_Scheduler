// Dashboard Access Control Middleware
const authenticateAndCheckRole = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Please log in first.',
        redirect: '/index.html'
      });
    }

    const token = authHeader.substring(7);
    const { verifyToken } = require('../utils/jwt');
    const User = require('../models/User');

    try {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId);
      
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Invalid authentication',
          redirect: '/index.html'
        });
      }

      req.user = user.getProfile();
      next();
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        redirect: '/index.html'
      });
    }
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during authentication'
    });
  }
};

// Check dashboard access
const checkDashboardAccess = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        redirect: '/index.html'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access Denied. Insufficient permissions. You are logged in as ${req.user.role.toUpperCase()}.`,
        userRole: req.user.role,
        redirect: `/dashboard-${req.user.role}.html`
      });
    }

    next();
  };
};

module.exports = {
  authenticateAndCheckRole,
  checkDashboardAccess
};
