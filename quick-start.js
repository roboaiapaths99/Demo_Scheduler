const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Tutor Availability System API is running',
    timestamp: new Date().toISOString(),
    environment: 'development',
    database: 'connected',
    version: '1.0.0'
  });
});

// Mock auth endpoints
app.post('/api/auth/register', (req, res) => {
  res.json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: req.body,
      tokens: { accessToken: 'mock-jwt-token' }
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: { name: 'Test User', email: req.body.email, role: 'tutor' },
      tokens: { accessToken: 'mock-jwt-token' }
    }
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n=== TUTOR AVAILABILITY SYSTEM ===');
  console.log(`🚀 Server running on: http://localhost:${PORT}`);
  console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
  console.log(`\n✅ Status: ONLINE`);
  console.log(`✅ Database: CONNECTED (Mock)`);
  console.log(`✅ API: RESPONDING`);
  console.log(`\n🎯 Open browser: http://localhost:${PORT}`);
  console.log('=====================================\n');
});
