const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: [
      'booking_created',
      'booking_accepted',
      'booking_rejected',
      'booking_cancelled',
      'booking_rescheduled',
      'reschedule_requested',
      'reschedule_approved',
      'reschedule_rejected',
      'availability_added',
      'availability_updated',
      'availability_deleted',
      'system_update',
      'reminder',
      'info',
      'warning',
      'error'
    ],
    required: [true, 'Notification type is required'],
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    index: true
  },
  relatedType: {
    type: String,
    enum: ['booking', 'availability', 'user'],
    required: false
  },
  actionUrl: {
    type: String,
    required: false
  },
  actionText: {
    type: String,
    required: false
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  expiresAt: {
    type: Date,
    required: false,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound indexes for efficient querying
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, priority: 1, createdAt: -1 });

// TTL index for automatic expiration
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for formatted creation time
notificationSchema.virtual('formattedCreatedAt').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return this.createdAt.toLocaleDateString();
});

// Virtual for notification icon
notificationSchema.virtual('icon').get(function() {
  const iconMap = {
    'booking_created': 'calendar-plus',
    'booking_accepted': 'check-circle',
    'booking_rejected': 'x-circle',
    'booking_cancelled': 'trash-2',
    'booking_rescheduled': 'calendar',
    'reschedule_requested': 'clock',
    'reschedule_approved': 'check-square',
    'reschedule_rejected': 'x-square',
    'availability_added': 'plus-circle',
    'availability_updated': 'edit',
    'availability_deleted': 'minus-circle',
    'system_update': 'info',
    'reminder': 'bell',
    'info': 'info',
    'warning': 'alert-triangle',
    'error': 'alert-circle'
  };
  return iconMap[this.type] || 'bell';
});

// Virtual for notification color
notificationSchema.virtual('color').get(function() {
  const colorMap = {
    'booking_created': '#667eea',
    'booking_accepted': '#28a745',
    'booking_rejected': '#dc3545',
    'booking_cancelled': '#6c757d',
    'booking_rescheduled': '#ffc107',
    'reschedule_requested': '#17a2b8',
    'reschedule_approved': '#28a745',
    'reschedule_rejected': '#dc3545',
    'availability_added': '#28a745',
    'availability_updated': '#ffc107',
    'availability_deleted': '#dc3545',
    'system_update': '#667eea',
    'reminder': '#ffc107',
    'info': '#17a2b8',
    'warning': '#ffc107',
    'error': '#dc3545'
  };
  return colorMap[this.type] || '#667eea';
});

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  const notification = new this({
    ...data,
    expiresAt: data.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Default 30 days
  });
  
  return await notification.save();
};

// Static method to create multiple notifications
notificationSchema.statics.createBulkNotifications = async function(notifications) {
  const notificationsWithExpiry = notifications.map(data => ({
    ...data,
    expiresAt: data.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  }));
  
  return await this.insertMany(notificationsWithExpiry);
};

// Static method to get user notifications
notificationSchema.statics.getUserNotifications = async function(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    type,
    isRead,
    priority,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = options;

  // Build query
  const query = {
    userId,
    isDeleted: false
  };

  if (type) query.type = type;
  if (isRead !== undefined) query.isRead = isRead;
  if (priority) query.priority = priority;

  // Pagination
  const skip = (page - 1) * limit;

  // Sort options
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Get notifications
  const notifications = await this.find(query)
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count
  const total = await this.countDocuments(query);

  return {
    notifications,
    pagination: {
      current: parseInt(page),
      total: Math.ceil(total / limit),
      count: total,
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  };
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(userId, type = null) {
  const query = {
    userId,
    isRead: false,
    isDeleted: false
  };

  if (type) query.type = type;

  return await this.countDocuments(query);
};

// Static method to mark as read
notificationSchema.statics.markAsRead = async function(userId, notificationIds = null) {
  const query = {
    userId,
    isRead: false,
    isDeleted: false
  };

  if (notificationIds) {
    if (Array.isArray(notificationIds)) {
      query._id = { $in: notificationIds };
    } else {
      query._id = notificationIds;
    }
  }

  return await this.updateMany(query, {
    isRead: true,
    readAt: new Date()
  });
};

// Static method to mark all as read
notificationSchema.statics.markAllAsRead = async function(userId, type = null) {
  const query = {
    userId,
    isRead: false,
    isDeleted: false
  };

  if (type) query.type = type;

  return await this.updateMany(query, {
    isRead: true,
    readAt: new Date()
  });
};

// Static method to delete notifications
notificationSchema.statics.deleteNotifications = async function(userId, notificationIds) {
  const query = {
    userId,
    isDeleted: false
  };

  if (notificationIds) {
    if (Array.isArray(notificationIds)) {
      query._id = { $in: notificationIds };
    } else {
      query._id = notificationIds;
    }
  }

  return await this.updateMany(query, {
    isDeleted: true,
    deletedAt: new Date()
  });
};

// Static method to cleanup old notifications
notificationSchema.statics.cleanupOldNotifications = async function(daysOld = 90) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  return await this.deleteMany({
    createdAt: { $lt: cutoffDate },
    isRead: true
  });
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = async function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return await this.save();
  }
  return this;
};

// Instance method to delete
notificationSchema.methods.softDelete = async function() {
  if (!this.isDeleted) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return await this.save();
  }
  return this;
};

// Instance method to get summary
notificationSchema.methods.getSummary = function() {
  return {
    _id: this._id,
    title: this.title,
    message: this.message,
    type: this.type,
    priority: this.priority,
    isRead: this.isRead,
    formattedCreatedAt: this.formattedCreatedAt,
    icon: this.icon,
    color: this.color,
    actionUrl: this.actionUrl,
    actionText: this.actionText,
    metadata: this.metadata
  };
};

module.exports = mongoose.model('Notification', notificationSchema);
