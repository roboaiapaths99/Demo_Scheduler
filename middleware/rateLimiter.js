const rateLimit = require('express-rate-limit');
const rateLimitStore = {};

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health' || req.path === '/api/health-check';
  }
});

// Auth endpoints rate limiter (more restrictive)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Booking endpoints rate limiter
const bookingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 booking requests per minute
  message: {
    success: false,
    message: 'Too many booking requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Password reset rate limiter
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Email sending rate limiter
const emailLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 email requests per minute
  message: {
    success: false,
    message: 'Too many email requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// User registration rate limiter
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 registrations per hour
  message: {
    success: false,
    message: 'Too many registration attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// API key rate limiter for external integrations
const apiKeyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // higher limit for API keys
  keyGenerator: (req) => {
    return req.headers['x-api-key'] || req.ip;
  },
  message: {
    success: false,
    message: 'API rate limit exceeded, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Dynamic rate limiter based on user role
const createRoleBasedLimiter = (roleLimits) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => {
      const userRole = req.user?.role;
      return roleLimits[userRole] || roleLimits.default;
    },
    keyGenerator: (req) => {
      const userId = req.user?._id;
      return userId ? `user_${userId}` : req.ip;
    },
    message: {
      success: false,
    message: 'Rate limit exceeded for your role, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Role-based limits
const roleBasedLimiter = createRoleBasedLimiter({
  admin: 1000,
  sales: 200,
  tutor: 100,
  default: 50
});

// Rate limit status checker middleware
const checkRateLimit = (req, res, next) => {
  const key = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  // Simple in-memory store for demonstration
  // In production, use Redis or similar
  if (!rateLimitStore[key]) {
    rateLimitStore[key] = { count: 0, resetTime: now + 15 * 60 * 1000 };
  }
  
  if (now > rateLimitStore[key].resetTime) {
    rateLimitStore[key] = { count: 0, resetTime: now + 15 * 60 * 1000 };
  }
  
  rateLimitStore[key].count++;
  
  // Add rate limit headers
  res.set({
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': Math.max(0, 100 - rateLimitStore[key].count),
    'X-RateLimit-Reset': new Date(rateLimitStore[key].resetTime).toISOString()
  });
  
  if (rateLimitStore[key].count > 100) {
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded'
    });
  }
  
  next();
};

// Cleanup old rate limit entries
const cleanupRateLimitStore = () => {
  const now = Date.now();
  Object.keys(rateLimitStore).forEach(key => {
    if (now > rateLimitStore[key].resetTime) {
      delete rateLimitStore[key];
    }
  });
};

// Cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);

module.exports = {
  generalLimiter,
  authLimiter,
  bookingLimiter,
  passwordResetLimiter,
  emailLimiter,
  registrationLimiter,
  apiKeyLimiter,
  roleBasedLimiter,
  checkRateLimit,
  cleanupRateLimitStore
};
