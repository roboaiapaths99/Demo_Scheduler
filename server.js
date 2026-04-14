const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const availabilityRoutes = require('./routes/availability');
const bookingsRoutes = require('./routes/bookings');
const notificationsRoutes = require('./routes/notifications');
const salesRoutes = require('./routes/sales');
const tutorResponseRoutes = require('./routes/tutorResponse');
const dataVisibilityRoutes = require('./routes/dataVisibility');

// Import middleware
const { protectDashboard, authorizeDashboard } = require('./middleware/dashboardAuth');

const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// Middleware - Production Ready Setup
// ==========================================

// Security headers
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for simplicity with local development, configure strictly for prod if using external CDNs
}));

// Compression (gzip/brotli) for all responses
app.use(compression());

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiter to all API routes
app.use('/api', apiLimiter);

// Robust CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? process.env.FRONTEND_URL // Configure your actual frontend domain in prod
        : true, // Allow all in dev
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' })); // Limit body payload to prevent DOS
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
let dbConnected = false;

const connectWithRetry = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorAvailability', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            retryWrites: true,
            retryReads: true
        });
        console.log('✅ MongoDB connected successfully');
        dbConnected = true;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.log('⚠️  Starting in mock mode (no database)');
        console.log('Note: For production, ensure MongoDB Atlas network access is properly configured');
    }
};

connectWithRetry();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/tutor-response', tutorResponseRoutes);
app.use('/api/data', dataVisibilityRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({
        success: true,
        message: 'Tutor Availability System API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: dbStatus,
        version: '1.0.0',
        status: 'healthy'
    });
});

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Protected dashboard routes
app.get('/dashboard-tutor.html', protectDashboard, authorizeDashboard('tutor'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard-tutor.html'));
});

app.get('/dashboard-sales.html', protectDashboard, authorizeDashboard('sales'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard-sales.html'));
});

app.get('/bookings.html', protectDashboard, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'bookings.html'));
});

app.get('/notifications.html', protectDashboard, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'notifications.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        path: req.path
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Start server if not running on serverless
if (process.env.NODE_ENV !== 'production' || process.env.RENDER || !process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log('\n' + '='.repeat(80));
        console.log('🚀 TUTOR AVAILABILITY SYSTEM STARTED');
        console.log('='.repeat(80));
        console.log(`🌐 Server: http://localhost:${PORT}`);
        console.log(`📊 Health: http://localhost:${PORT}/api/health`);
        console.log(`🎯 Frontend: http://localhost:${PORT}`);
        console.log(`\n✅ Status: ONLINE & READY`);
        console.log(`✅ Database: ${mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED'}`);
        console.log(`\n🎯 Open browser: http://localhost:${PORT}`);
        console.log('='.repeat(80) + '\n');
    });
}

// Export for Vercel Serverless
module.exports = app;

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    mongoose.connection.close(() => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully...');
    mongoose.connection.close(() => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
    });
});
