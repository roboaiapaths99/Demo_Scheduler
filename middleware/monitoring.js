const fs = require('fs');
const path = require('path');

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  
  // Store original res.json
  const originalJson = res.json;
  
  res.json = function(data) {
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    const duration = endTime - startTime;
    
    // Log performance metrics
    const metrics = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      memory: {
        heapUsed: `${Math.round(endMemory.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(endMemory.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(endMemory.external / 1024 / 1024)}MB`,
        rss: `${Math.round(endMemory.rss / 1024 / 1024)}MB`
      },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?._id,
      role: req.user?.role
    };
    
    // Log slow requests (> 1 second)
    if (duration > 1000) {
      console.warn('Slow Request Detected:', metrics);
    }
    
    // Store metrics for analytics (in production, use a proper monitoring service)
    storeMetrics(metrics);
    
    return originalJson.call(this, data);
  };
  
  next();
};

// Error monitoring middleware
const errorMonitor = (err, req, res, next) => {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    },
    request: {
      method: req.method,
      path: req.path,
      headers: req.headers,
      body: req.body,
      query: req.query,
      params: req.params,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    },
    user: {
      id: req.user?._id,
      role: req.user?.role
    }
  };
  
  // Log error details
  console.error('Application Error:', errorInfo);
  
  // Store error for monitoring
  storeError(errorInfo);
  
  // Send to external monitoring service (in production)
  if (process.env.ERROR_MONITORING_WEBHOOK) {
    sendErrorToMonitoring(errorInfo);
  }
  
  next(err);
};

// Health check endpoint
const healthCheck = async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      database: await checkDatabaseHealth(),
      email: await checkEmailHealth(),
      scheduler: checkSchedulerHealth(),
      dependencies: await checkDependencies()
    };
    
    const statusCode = health.database.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      success: health.status === 'healthy',
      data: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
};

// Database health check
const checkDatabaseHealth = async () => {
  try {
    const mongoose = require('mongoose');
    
    if (mongoose.connection.readyState !== 1) {
      return {
        status: 'unhealthy',
        message: 'Database not connected',
        readyState: mongoose.connection.readyState
      };
    }
    
    // Test database connection
    await mongoose.connection.db.admin().ping();
    
    return {
      status: 'healthy',
      message: 'Database connected and responsive',
      readyState: mongoose.connection.readyState
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message,
      readyState: mongoose.connection.readyState
    };
  }
};

// Email service health check
const checkEmailHealth = async () => {
  try {
    const { verifyEmailConfig } = require('../config/email');
    const isHealthy = await verifyEmailConfig();
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      message: isHealthy ? 'Email service is configured' : 'Email service configuration failed'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message
    };
  }
};

// Scheduler health check
const checkSchedulerHealth = () => {
  try {
    const emailScheduler = require('../utils/emailScheduler');
    const status = emailScheduler.getStatus();
    
    return {
      status: status.isRunning ? 'healthy' : 'unhealthy',
      message: status.isRunning ? 'Email scheduler is running' : 'Email scheduler is not running',
      details: status
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message
    };
  }
};

// Dependencies health check
const checkDependencies = async () => {
  const dependencies = {
    mongoose: require('mongoose'),
    express: require('express'),
    nodemailer: require('nodemailer'),
    nodeCron: require('node-cron')
  };
  
  const results = {};
  
  for (const [name, dependency] of Object.entries(dependencies)) {
    try {
      results[name] = {
        status: 'healthy',
        version: dependency.version || 'unknown'
      };
    } catch (error) {
      results[name] = {
        status: 'unhealthy',
        message: error.message
      };
    }
  }
  
  return results;
};

// Metrics storage (in production, use Redis or database)
const metricsStore = {
  requests: [],
  errors: [],
  performance: []
};

// Store metrics
const storeMetrics = (metrics) => {
  try {
    // Keep only last 1000 metrics
    if (metricsStore.requests.length >= 1000) {
      metricsStore.requests.shift();
    }
    metricsStore.requests.push(metrics);
    
    // Store performance metrics
    if (metricsStore.performance.length >= 1000) {
      metricsStore.performance.shift();
    }
    metricsStore.performance.push({
      timestamp: metrics.timestamp,
      duration: parseInt(metrics.duration),
      memory: metrics.memory.heapUsed
    });
  } catch (error) {
    console.error('Failed to store metrics:', error);
  }
};

// Store errors
const storeError = (errorInfo) => {
  try {
    // Keep only last 100 errors
    if (metricsStore.errors.length >= 100) {
      metricsStore.errors.shift();
    }
    metricsStore.errors.push(errorInfo);
  } catch (error) {
    console.error('Failed to store error:', error);
  }
};

// Get metrics dashboard
const getMetrics = (req, res) => {
  try {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const recentRequests = metricsStore.requests.filter(r => 
      new Date(r.timestamp).getTime() > oneHourAgo
    );
    
    const recentErrors = metricsStore.errors.filter(e => 
      new Date(e.timestamp).getTime() > oneHourAgo
    );
    
    const recentPerformance = metricsStore.performance.filter(p => 
      new Date(p.timestamp).getTime() > oneHourAgo
    );
    
    // Calculate statistics
    const stats = {
      requests: {
        total: recentRequests.length,
        averageDuration: recentPerformance.length > 0 
          ? Math.round(recentPerformance.reduce((sum, p) => sum + p.duration, 0) / recentPerformance.length)
          : 0,
        statusCodes: recentRequests.reduce((acc, r) => {
          acc[r.statusCode] = (acc[r.statusCode] || 0) + 1;
          return acc;
        }, {}),
        endpoints: recentRequests.reduce((acc, r) => {
          acc[r.path] = (acc[r.path] || 0) + 1;
          return acc;
        }, {})
      },
      errors: {
        total: recentErrors.length,
        types: recentErrors.reduce((acc, e) => {
          acc[e.error.name] = (acc[e.error.name] || 0) + 1;
          return acc;
        }, {})
      },
      performance: {
        averageMemory: recentPerformance.length > 0
          ? Math.round(recentPerformance.reduce((sum, p) => sum + parseInt(p.memory), 0) / recentPerformance.length)
          : 0,
        slowRequests: recentRequests.filter(r => parseInt(r.duration) > 1000).length
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      }
    };
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get metrics',
      error: error.message
    });
  }
};

// Send error to monitoring service
const sendErrorToMonitoring = async (errorInfo) => {
  try {
    const webhook = process.env.ERROR_MONITORING_WEBHOOK;
    if (!webhook) return;
    
    const response = await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(errorInfo)
    });
    
    if (!response.ok) {
      console.error('Failed to send error to monitoring service');
    }
  } catch (error) {
    console.error('Error sending to monitoring service:', error);
  }
};

// Cleanup old metrics
const cleanupMetrics = () => {
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  
  // Clean old metrics
  metricsStore.requests = metricsStore.requests.filter(r => 
    new Date(r.timestamp).getTime() > oneDayAgo
  );
  
  metricsStore.errors = metricsStore.errors.filter(e => 
    new Date(e.timestamp).getTime() > oneDayAgo
  );
  
  metricsStore.performance = metricsStore.performance.filter(p => 
    new Date(p.timestamp).getTime() > oneDayAgo
  );
};

// Cleanup every hour
setInterval(cleanupMetrics, 60 * 60 * 1000);

// Log system metrics periodically
const logSystemMetrics = () => {
  const metrics = {
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    uptime: process.uptime(),
    activeHandles: process._getActiveHandles().length,
    activeRequests: process._getActiveRequests().length
  };
  
  console.log('System Metrics:', metrics);
};

// Log system metrics every 5 minutes
setInterval(logSystemMetrics, 5 * 60 * 1000);

module.exports = {
  performanceMonitor,
  errorMonitor,
  healthCheck,
  getMetrics,
  checkDatabaseHealth,
  checkEmailHealth,
  checkSchedulerHealth,
  checkDependencies,
  storeMetrics,
  storeError
};
