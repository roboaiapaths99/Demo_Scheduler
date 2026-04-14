const fs = require('fs');
const path = require('path');

// Production configuration
const productionConfig = {
  // Server settings
  server: {
    port: process.env.PORT || 5000,
    host: process.env.HOST || '0.0.0.0',
    trustProxy: process.env.TRUST_PROXY === 'true'
  },

  // Database settings
  database: {
    uri: process.env.MONGODB_URI,
    options: {
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
      serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT) || 5000,
      socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,
      bufferMaxEntries: 0,
      bufferCommands: false
    }
  },

  // Security settings
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    sessionSecret: process.env.SESSION_SECRET || 'your-session-secret',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },

  // Email settings
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    fromName: process.env.EMAIL_FROM_NAME || 'Tutor Availability System',
    fromEmail: process.env.EMAIL_FROM_EMAIL || process.env.EMAIL_USER
  },

  // Logging settings
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 14,
    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD'
  },

  // Monitoring settings
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    webhook: process.env.MONITORING_WEBHOOK,
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
    metricsRetention: parseInt(process.env.METRICS_RETENTION) || 7 * 24 * 60 * 60 * 1000 // 7 days
  },

  // Performance settings
  performance: {
    compressionEnabled: process.env.COMPRESSION_ENABLED !== 'false',
    compressionLevel: parseInt(process.env.COMPRESSION_LEVEL) || 6,
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000,
    keepAliveTimeout: parseInt(process.env.KEEP_ALIVE_TIMEOUT) || 5000,
    maxConnections: parseInt(process.env.MAX_CONNECTIONS) || 100
  },

  // Cache settings
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
    ttl: parseInt(process.env.CACHE_TTL) || 300, // 5 minutes
    maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000
  },

  // File upload settings
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || ['image/jpeg', 'image/png', 'application/pdf'],
    uploadPath: process.env.UPLOAD_PATH || 'uploads/'
  }
};

// Validate production environment
const validateProductionEnv = () => {
  const required = [
    'MONGODB_URI',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'EMAIL_USER',
    'EMAIL_PASS'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate MongoDB URI format
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
    throw new Error('Invalid MongoDB URI format');
  }

  // Validate JWT secrets
  if (process.env.JWT_ACCESS_SECRET.length < 32) {
    throw new Error('JWT access secret must be at least 32 characters');
  }

  if (process.env.JWT_REFRESH_SECRET.length < 32) {
    throw new Error('JWT refresh secret must be at least 32 characters');
  }

  // Validate email configuration
  if (!process.env.EMAIL_USER.includes('@')) {
    throw new Error('Invalid email user format');
  }

  return true;
};

// Setup production directories
const setupProductionDirectories = () => {
  const directories = [
    'logs',
    'uploads',
    'temp',
    'backups'
  ];

  directories.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
};

// Setup process monitoring
const setupProcessMonitoring = () => {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  // Handle SIGTERM
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  // Handle SIGINT
  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
  });

  // Monitor memory usage
  const memUsage = process.memoryUsage();
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  };

  console.log('Memory Usage:', memUsageMB);

  // Set up memory monitoring
  setInterval(() => {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    
    // Warn if memory usage is high
    if (heapUsedMB > 500) {
      console.warn(`High memory usage: ${heapUsedMB}MB`);
    }
  }, 60000); // Check every minute
};

// Setup graceful shutdown
const setupGracefulShutdown = (server, emailScheduler) => {
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down gracefully`);
    
    // Stop accepting new connections
    server.close(() => {
      console.log('HTTP server closed');
      
      // Stop email scheduler
      if (emailScheduler) {
        emailScheduler.stop();
        console.log('Email scheduler stopped');
      }
      
      // Close database connection
      const mongoose = require('mongoose');
      mongoose.connection.close(() => {
        console.log('Database connection closed');
        process.exit(0);
      });
    });
    
    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('Forced shutdown');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

// Performance optimization
const optimizePerformance = () => {
  // Set process title
  process.title = 'tutor-availability-system';
  
  // Enable garbage collection optimization
  if (global.gc) {
    global.gc();
  }
  
  // Set up periodic garbage collection
  setInterval(() => {
    if (global.gc) {
      global.gc();
    }
  }, 5 * 60 * 1000); // Every 5 minutes
};

// Security hardening
const hardenSecurity = () => {
  // Disable HTTP methods that aren't needed
  const disabledMethods = ['TRACE', 'TRACK', 'CONNECT'];
  
  // Set secure headers
  const helmet = require('helmet');
  
  // Remove sensitive data from process.env
  delete process.env.EMAIL_PASS;
  delete process.env.JWT_ACCESS_SECRET;
  delete process.env.JWT_REFRESH_SECRET;
  
  console.log('Security hardening applied');
};

// Initialize production environment
const initializeProduction = () => {
  if (process.env.NODE_ENV === 'production') {
    console.log('Initializing production environment...');
    
    try {
      validateProductionEnv();
      setupProductionDirectories();
      setupProcessMonitoring();
      optimizePerformance();
      hardenSecurity();
      
      console.log('Production environment initialized successfully');
    } catch (error) {
      console.error('Failed to initialize production environment:', error);
      process.exit(1);
    }
  }
};

module.exports = {
  productionConfig,
  validateProductionEnv,
  setupProductionDirectories,
  setupProcessMonitoring,
  setupGracefulShutdown,
  optimizePerformance,
  hardenSecurity,
  initializeProduction
};
