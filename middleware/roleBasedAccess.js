// Role-Based Access Control Middleware
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Check if user's role is allowed
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. This resource is only available to: ${allowedRoles.join(', ')}`,
          userRole: req.user.role
        });
      }

      next();
    } catch (error) {
      console.error('Authorization middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during authorization'
      });
    }
  };
};

// Check if user is owner of the resource
const isResourceOwner = (req, res, next) => {
  try {
    const resourceOwnerId = req.params.userId || req.body.userId;
    const currentUserId = req.user._id.toString();

    if (resourceOwnerId !== currentUserId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource'
      });
    }

    next();
  } catch (error) {
    console.error('Resource owner check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during resource check'
    });
  }
};

module.exports = {
  authorize,
  isResourceOwner
};
