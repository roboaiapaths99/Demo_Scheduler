const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Import routes
const authRoutes = require('./routes/auth');
const availabilityRoutes = require('./routes/availability');
const bookingsRoutes = require('./routes/bookings');
const notificationsRoutes = require('./routes/notifications');
const salesRoutes = require('./routes/sales');
const tutorResponseRoutes = require('./routes/tutorResponse');
const leadRoutes = require('./routes/leads');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorAvailability', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.log('MongoDB connection error:', err));

// Models
const User = require('./models/User');
const Availability = require('./models/Availability');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/tutor-response', tutorResponseRoutes);
app.use('/api/leads', leadRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'API is running',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Mock auth endpoints (for testing)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        
        // Find or create user (for testing)
        let user = await User.findOne({ email });
        if (!user) {
            user = new User({
                name: email.split('@')[0],
                email,
                password: 'temp',
                role: role || 'tutor'
            });
            await user.save();
        }
        
        // Check role match
        if (user.role !== role) {
            return res.status(401).json({
                success: false,
                message: `This account is not registered as a ${role}`
            });
        }
        
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: user.getProfile(),
                tokens: {
                    accessToken: 'mock-token-' + Date.now(),
                    refreshToken: 'mock-refresh-' + Date.now()
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
});

// Availability endpoints
app.get('/api/availability/all', async (req, res) => {
    try {
        const availabilities = await Availability.find({ status: 'available' })
            .populate('tutorId', 'name email')
            .sort({ date: 1, startTime: 1 });
            
        res.json({
            success: true,
            data: {
                availabilities: availabilities.map(slot => ({
                    _id: slot._id,
                    tutorId: slot.tutorId._id,
                    tutorName: slot.tutorId.name,
                    tutorEmail: slot.tutorId.email,
                    date: slot.date,
                    formattedDate: slot.getFormattedDate(),
                    timeRange: slot.getTimeRange(),
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    status: slot.status,
                    notes: slot.notes,
                    isBookable: slot.isBookable()
                }))
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to load availability',
            error: error.message
        });
    }
});

app.get('/api/availability/my', async (req, res) => {
    try {
        // For testing, return empty array
        res.json({
            success: true,
            data: {
                availabilities: []
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to load availability',
            error: error.message
        });
    }
});

app.post('/api/availability', async (req, res) => {
    try {
        const { date, startTime, endTime, notes } = req.body;
        
        // Create a mock tutor if needed
        let tutor = await User.findOne({ role: 'tutor' });
        if (!tutor) {
            tutor = new User({
                name: 'Test Tutor',
                email: 'tutor@test.com',
                password: 'temp',
                role: 'tutor'
            });
            await tutor.save();
        }
        
        const availability = new Availability({
            tutorId: tutor._id,
            date,
            startTime,
            endTime,
            notes,
            status: 'available'
        });
        
        await availability.save();
        
        res.json({
            success: true,
            message: 'Availability added successfully',
            data: availability
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to add availability',
            error: error.message
        });
    }
});

app.post('/api/availability/:id/book', async (req, res) => {
    try {
        const { clientName, clientEmail, clientPhone, clientNotes } = req.body;
        
        const slot = await Availability.findById(req.params.id);
        if (!slot) {
            return res.status(404).json({
                success: false,
                message: 'Slot not found'
            });
        }
        
        // Lock the slot
        slot.status = 'locked';
        slot.lockedBy = 'mock-sales-id';
        slot.lockedAt = new Date();
        slot.clientInfo = {
            name: clientName,
            email: clientEmail,
            phone: clientPhone,
            notes: clientNotes
        };
        
        await slot.save();
        
        res.json({
            success: true,
            message: 'Slot booked successfully. Waiting for tutor confirmation.',
            data: { slot }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to book slot',
            error: error.message
        });
    }
});

app.post('/api/availability/:id/confirm', async (req, res) => {
    try {
        const slot = await Availability.findById(req.params.id);
        if (!slot) {
            return res.status(404).json({
                success: false,
                message: 'Slot not found'
            });
        }
        
        slot.status = 'booked';
        slot.lockedBy = null;
        slot.lockedAt = null;
        
        await slot.save();
        
        res.json({
            success: true,
            message: 'Booking confirmed successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to confirm booking',
            error: error.message
        });
    }
});

app.post('/api/availability/:id/reject', async (req, res) => {
    try {
        const { reason } = req.body;
        
        const slot = await Availability.findById(req.params.id);
        if (!slot) {
            return res.status(404).json({
                success: false,
                message: 'Slot not found'
            });
        }
        
        slot.status = 'available';
        slot.lockedBy = null;
        slot.lockedAt = null;
        slot.clientInfo = null;
        
        await slot.save();
        
        res.json({
            success: true,
            message: 'Booking rejected. Slot is now available again.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to reject booking',
            error: error.message
        });
    }
});

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(80));
    console.log('TUTOR AVAILABILITY SYSTEM STARTED');
    console.log('='.repeat(80));
    console.log(`Server: http://localhost:${PORT}`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
    console.log(`Frontend: http://localhost:${PORT}`);
    console.log('='.repeat(80) + '\n');
});
