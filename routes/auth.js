const express = require('express');
const authController = require('../controllers/authController');
const { authenticate, refreshTokenMiddleware } = require('../middleware/auth');
const notificationService = require('../utils/notification');

const router = express.Router();

// Routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', refreshTokenMiddleware, authController.refreshToken);
router.get('/profile', authenticate, authController.getProfile);
router.post('/logout', authenticate, authController.logout);

// Notification subscription endpoints
router.post('/notifications/subscribe', authenticate, (req, res) => {
  try {
    const subscription = req.body;
    const userId = req.user._id.toString();
    
    notificationService.subscribeUser(userId, subscription);
    
    res.status(200).json({
      success: true,
      message: 'Successfully subscribed to notifications'
    });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to subscribe to notifications'
    });
  }
});

router.post('/notifications/unsubscribe', authenticate, (req, res) => {
  try {
    const { endpoint } = req.body;
    const userId = req.user._id.toString();
    
    notificationService.unsubscribeUser(userId, endpoint);
    
    res.status(200).json({
      success: true,
      message: 'Successfully unsubscribed from notifications'
    });
  } catch (error) {
    console.error('Unsubscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unsubscribe from notifications'
    });
  }
});

module.exports = router;
