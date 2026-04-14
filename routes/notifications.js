const express = require('express');
const notificationController = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All notification routes require authentication
router.use(authenticate);

// Basic notification routes
router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.post('/mark-read', notificationController.markAsRead);
router.post('/mark-all-read', notificationController.markAllAsRead);
router.delete('/delete', notificationController.deleteNotifications);
router.get('/stats', notificationController.getNotificationStats);

// Test notification (development only)
router.post('/test', notificationController.createTestNotification);

// Admin only routes
router.post('/cleanup', authenticate, authorize('admin'), notificationController.cleanupOldNotifications);

module.exports = router;
