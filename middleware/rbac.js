/**
 * Enhanced RBAC Middleware
 * Provides role-based access control with proper data visibility rules
 */

const User = require('../models/User');

/**
 * Authenticate user via JWT
 */
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No authentication token provided' 
      });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token',
      error: error.message 
    });
  }
};

/**
 * Authorize user by role(s)
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Required roles: ${roles.join(', ')}. Your role: ${req.user.role}` 
      });
    }

    next();
  };
};

/**
 * Check data ownership based on role
 * Tutors can only see their own availability and bookings with them
 * Sales can see any tutor's availability and their own bookings
 */
const checkDataAccess = (resourceType) => {
  return async (req, res, next) => {
    const { userId, tutorId, salesId } = req.params;
    const requestingUser = req.user;

    try {
      if (resourceType === 'tutorAvailability') {
        // Only tutor can see their own availability, or sales/admin can see any
        if (requestingUser.role === 'tutor' && tutorId && tutorId !== requestingUser._id.toString()) {
          return res.status(403).json({ 
            success: false, 
            message: 'You can only view your own availability' 
          });
        }
      } 
      else if (resourceType === 'tutorBookings') {
        // Tutor sees bookings where they are the tutor
        // Sales sees only their own bookings
        if (requestingUser.role === 'tutor' && tutorId && tutorId !== requestingUser._id.toString()) {
          return res.status(403).json({ 
            success: false, 
            message: 'You can only view bookings assigned to you' 
          });
        }
        if (requestingUser.role === 'sales' && salesId && salesId !== requestingUser._id.toString()) {
          return res.status(403).json({ 
            success: false, 
            message: 'You can only view your own bookings' 
          });
        }
      }
      
      next();
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Error checking data access',
        error: error.message 
      });
    }
  };
};

/**
 * Role-specific data visibility middleware
 * Modifies queries based on user role
 */
const roleBasedDataVisibility = (req, res, next) => {
  const user = req.user;

  // Store in request for use in controllers
  req.dataVisibility = {
    isTutor: user.role === 'tutor',
    isSales: user.role === 'sales',
    isAdmin: user.role === 'admin',
    userId: user._id
  };

  next();
};

module.exports = {
  authenticate,
  authorize,
  checkDataAccess,
  roleBasedDataVisibility
};
