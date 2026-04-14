const helmet = require('helmet');
const crypto = require('crypto');

// Security headers configuration
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Request validation middleware
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    next();
  };
};

// SQL injection prevention (for any potential SQL-like queries)
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Remove potentially dangerous characters
      return obj.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      Object.keys(obj).forEach(key => {
        sanitized[key] = sanitize(obj[key]);
      });
      return sanitized;
    }
    return obj;
  };

  // Sanitize request body, query, and params
  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);
  
  next();
};

// XSS prevention middleware
const preventXSS = (req, res, next) => {
  const xss = (str) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  };

  const sanitizeObj = (obj) => {
    if (typeof obj === 'string') return xss(obj);
    if (Array.isArray(obj)) return obj.map(sanitizeObj);
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      Object.keys(obj).forEach(key => {
        sanitized[key] = sanitizeObj(obj[key]);
      });
      return sanitized;
    }
    return obj;
  };

  if (req.body) req.body = sanitizeObj(req.body);
  if (req.query) req.query = sanitizeObj(req.query);
  if (req.params) req.params = sanitizeObj(req.params);
  
  next();
};

// CSRF protection middleware
const csrfProtection = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'];
  const sessionToken = req.session?.csrfToken;

  if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
    return res.status(403).json({
      success: false,
      message: 'CSRF token validation failed'
    });
  }

  next();
};

// Generate CSRF token
const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// API key validation middleware
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key required'
    });
  }

  // In production, validate against database
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  
  if (!validApiKeys.includes(apiKey)) {
    return res.status(401).json({
      success: false,
      message: 'Invalid API key'
    });
  }

  next();
};

// Request size limiter
const requestSizeLimit = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = req.headers['content-length'];
    if (contentLength && parseInt(contentLength) > parseInt(maxSize)) {
      return res.status(413).json({
        success: false,
        message: 'Request entity too large'
      });
    }
    next();
  };
};

// IP whitelist middleware
const ipWhitelist = (allowedIPs) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!allowedIPs.includes(clientIP)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied from this IP'
      });
    }
    
    next();
  };
};

// Request timeout middleware
const requestTimeout = (timeoutMs = 30000) => {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          message: 'Request timeout'
        });
      }
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
};

// Security audit logging
const auditLog = (req, res, next) => {
  const startTime = Date.now();
  
  // Store original res.json
  const originalJson = res.json;
  
  res.json = function(data) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Log security-relevant events
    if (req.path.includes('/auth/') || 
        req.path.includes('/bookings/') || 
        req.method !== 'GET' ||
        res.statusCode >= 400) {
      
      console.log('Security Audit:', {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userId: req.user?._id,
        role: req.user?.role
      });
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

// Password strength validator
const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Middleware to validate password strength
const checkPasswordStrength = (req, res, next) => {
  if (req.body.password) {
    const validation = validatePasswordStrength(req.body.password);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet security requirements',
        errors: validation.errors
      });
    }
  }
  next();
};

// Block suspicious requests
const blockSuspiciousRequests = (req, res, next) => {
  const suspiciousPatterns = [
    /\.\./,  // Directory traversal
    /<script/i,  // Script tags
    /javascript:/i,  // JavaScript protocol
    /data:/i,  // Data protocol
    /vbscript:/i,  // VBScript protocol
    /on\w+\s*=/i  // Event handlers
  ];

  const checkSuspicious = (obj) => {
    if (typeof obj === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(obj));
    }
    if (Array.isArray(obj)) {
      return obj.some(checkSuspicious);
    }
    if (obj && typeof obj === 'object') {
      return Object.values(obj).some(checkSuspicious);
    }
    return false;
  };

  if (checkSuspicious(req.body) || checkSuspicious(req.query) || checkSuspicious(req.params)) {
    return res.status(400).json({
      success: false,
      message: 'Suspicious request detected'
    });
  }

  next();
};

module.exports = {
  securityHeaders,
  validateRequest,
  sanitizeInput,
  preventXSS,
  csrfProtection,
  generateCSRFToken,
  validateApiKey,
  requestSizeLimit,
  ipWhitelist,
  requestTimeout,
  auditLog,
  validatePasswordStrength,
  checkPasswordStrength,
  blockSuspiciousRequests
};
