const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const availabilityRoutes = require('./routes/availability');
const bookingsRoutes = require('./routes/bookings');
const notificationsRoutes = require('./routes/notifications');
const salesRoutes = require('./routes/sales');
const tutorResponseRoutes = require('./routes/tutorResponse');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
        console.log('MongoDB connected successfully');
        dbConnected = true;
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        console.log('Starting in mock mode (no database)');
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(80));
    console.log('TUTOR AVAILABILITY SYSTEM STARTED');
    console.log('='.repeat(80));
    console.log(`Server: http://localhost:${PORT}`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
    console.log(`Frontend: http://localhost:${PORT}`);
    console.log(`\nStatus: ONLINE & READY`);
    console.log(`Database: ${mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED'}`);
    console.log(`\nOpen browser: http://localhost:${PORT}`);
    console.log('='.repeat(80) + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\nSIGTERM received, shutting down gracefully...');
    mongoose.connection.close(() => {
        console.log('MongoDB connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\nSIGINT received, shutting down gracefully...');
    mongoose.connection.close(() => {
        console.log('MongoDB connection closed');
        process.exit(0);
    });
});
