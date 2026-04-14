const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateTokenPair } = require('../utils/jwt');
const EmailService = require('../utils/emailService');

// Register new user
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists.'
      });
    }

    // Validate role
    const validRoles = ['tutor', 'sales', 'admin'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be: tutor, sales, or admin.'
      });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      role: role || 'tutor'
    });

    await user.save();

    // Generate tokens
    const tokens = generateTokenPair(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        user: user.getProfile(),
        tokens,
        redirectUrl: user.role === 'tutor' ? '/dashboard-tutor.html' : 
                     user.role === 'sales' ? '/dashboard-sales.html' : 
                     '/index.html'
      }
    });

    // Send welcome email
    try {
      await EmailService.sendWelcomeEmail(user);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail registration if email fails
    }
  } catch (error) {
    console.error('Registration error:', error.message);
    console.error('Full error details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Validate input
    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and role are required.'
      });
    }

    // Find user with password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Check if user role matches
    if (user.role !== role) {
      return res.status(401).json({
        success: false,
        message: `This account is not registered as a ${role}.`
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact administrator.'
      });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Generate tokens
    const tokens = generateTokenPair(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Set HTTP-only cookie
    res.cookie('token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: user.getProfile(),
        tokens,
        redirectUrl: user.role === 'tutor' ? '/dashboard-tutor.html' : 
                     user.role === 'sales' ? '/dashboard-sales.html' : 
                     '/index.html'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login.'
    });
  }
};

// Refresh access token
const refreshToken = async (req, res) => {
  try {
    // User is already attached to req by refreshTokenMiddleware
    const user = req.user;

    // Generate new tokens
    const tokens = generateTokenPair(user._id);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully.',
      data: {
        tokens
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during token refresh.'
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: user.getProfile()
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching profile.'
    });
  }
};

// Logout user
const logout = async (req, res) => {
  try {
    // Clear cookie
    res.cookie('token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: new Date(0)
    });

    res.status(200).json({
      success: true,
      message: 'Logout successful.'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during logout.'
    });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  getProfile,
  logout
};
