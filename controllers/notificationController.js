const Notification = require('../models/Notification');
const NotificationService = require('../utils/notificationService');
const mongoose = require('mongoose');

// Get user notifications
const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 20,
      type,
      isRead,
      priority,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      type,
      isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
      priority,
      sortBy,
      sortOrder
    };

    const result = await NotificationService.getUserNotifications(userId, options);

    res.status(200).json({
      success: true,
      data: {
        notifications: result.notifications.map(notification => notification.getSummary()),
        pagination: result.pagination
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching notifications.'
    });
  }
};

// Get unread count
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { type } = req.query;

    const unreadCount = await NotificationService.getUnreadCount(userId, type);

    res.status(200).json({
      success: true,
      data: {
        unreadCount
      }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching unread count.'
    });
  }
};

// Mark notifications as read
const markAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { notificationIds } = req.body;

    await NotificationService.markAsRead(userId, notificationIds);

    res.status(200).json({
      success: true,
      message: 'Notifications marked as read successfully.'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while marking notifications as read.'
    });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { type } = req.body;

    await NotificationService.markAllAsRead(userId, type);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read successfully.'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while marking all notifications as read.'
    });
  }
};

// Delete notifications
const deleteNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { notificationIds } = req.body;

    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Notification IDs are required.'
      });
    }

    await NotificationService.deleteNotifications(userId, notificationIds);

    res.status(200).json({
      success: true,
      message: 'Notifications deleted successfully.'
    });
  } catch (error) {
    console.error('Delete notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting notifications.'
    });
  }
};

// Get notification statistics
const getNotificationStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get overall statistics
    const stats = await Notification.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isDeleted: false
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: { $sum: { $cond: ['$isRead', 0, 1] } },
          read: { $sum: { $cond: ['$isRead', 1, 0] } }
        }
      }
    ]);

    // Get type statistics
    const typeStats = await Notification.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isDeleted: false
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          unread: { $sum: { $cond: ['$isRead', 0, 1] } }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get priority statistics
    const priorityStats = await Notification.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isDeleted: false
        }
      },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
          unread: { $sum: { $cond: ['$isRead', 0, 1] } }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activityStats = await Notification.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isDeleted: false,
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        stats: stats[0] || { total: 0, unread: 0, read: 0 },
        typeStats,
        priorityStats,
        activityStats
      }
    });
  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching notification statistics.'
    });
  }
};

// Create test notification (for development)
const createTestNotification = async (req, res) => {
  try {
    const userId = req.user._id;
    const { title, message, type = 'info', priority = 'medium' } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required.'
      });
    }

    const notification = await NotificationService.create({
      userId,
      title,
      message,
      type,
      priority,
      metadata: {
        testNotification: true,
        createdAt: new Date()
      }
    });

    res.status(201).json({
      success: true,
      message: 'Test notification created successfully.',
      data: {
        notification: notification.getSummary()
      }
    });
  } catch (error) {
    console.error('Create test notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while creating test notification.'
    });
  }
};

// Cleanup old notifications (admin only)
const cleanupOldNotifications = async (req, res) => {
  try {
    const { daysOld = 90 } = req.body;

    const result = await NotificationService.cleanupOldNotifications(daysOld);

    res.status(200).json({
      success: true,
      message: `Cleaned up ${result.deletedCount} old notifications.`,
      data: {
        deletedCount: result.deletedCount
      }
    });
  } catch (error) {
    console.error('Cleanup notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while cleaning up notifications.'
    });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotifications,
  getNotificationStats,
  createTestNotification,
  cleanupOldNotifications
};
