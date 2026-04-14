const Notification = require('../models/Notification');

class NotificationService {
  // Create single notification
  static async create(data) {
    try {
      return await Notification.createNotification(data);
    } catch (error) {
      console.error('Create notification error:', error);
      throw error;
    }
  }

  // Create multiple notifications
  static async createBulk(notifications) {
    try {
      return await Notification.createBulkNotifications(notifications);
    } catch (error) {
      console.error('Create bulk notifications error:', error);
      throw error;
    }
  }

  // Booking created notification
  static async bookingCreated(tutorId, salesId, booking) {
    const notifications = [];

    // Notify tutor
    notifications.push({
      userId: tutorId,
      title: 'New Booking Request',
      message: `New booking request from ${booking.clientName} for ${booking.formattedDateTime}`,
      type: 'booking_created',
      priority: 'high',
      relatedId: booking._id,
      relatedType: 'booking',
      actionUrl: '/pending-bookings',
      actionText: 'View Booking',
      metadata: {
        clientName: booking.clientName,
        scheduledAt: booking.scheduledAt,
        duration: booking.duration
      }
    });

    // Notify sales (confirmation)
    notifications.push({
      userId: salesId,
      title: 'Booking Created',
      message: `Booking created for ${booking.clientName} - ${booking.formattedDateTime}`,
      type: 'booking_created',
      priority: 'medium',
      relatedId: booking._id,
      relatedType: 'booking',
      actionUrl: '/bookings',
      actionText: 'View Booking',
      metadata: {
        clientName: booking.clientName,
        tutorName: booking.tutorId?.name || 'Tutor',
        scheduledAt: booking.scheduledAt
      }
    });

    return await this.createBulk(notifications);
  }

  // Booking accepted notification
  static async bookingAccepted(tutorId, salesId, booking) {
    const notifications = [];

    // Notify sales
    notifications.push({
      userId: salesId,
      title: 'Booking Accepted',
      message: `${booking.tutorId?.name || 'Tutor'} has accepted the booking for ${booking.clientName}`,
      type: 'booking_accepted',
      priority: 'high',
      relatedId: booking._id,
      relatedType: 'booking',
      actionUrl: '/bookings',
      actionText: 'View Booking',
      metadata: {
        clientName: booking.clientName,
        tutorName: booking.tutorId?.name || 'Tutor',
        scheduledAt: booking.scheduledAt
      }
    });

    return await this.createBulk(notifications);
  }

  // Booking rejected notification
  static async bookingRejected(tutorId, salesId, booking, reason) {
    const notifications = [];

    // Notify sales
    notifications.push({
      userId: salesId,
      title: 'Booking Rejected',
      message: `${booking.tutorId?.name || 'Tutor'} has rejected the booking for ${booking.clientName}`,
      type: 'booking_rejected',
      priority: 'high',
      relatedId: booking._id,
      relatedType: 'booking',
      actionUrl: '/bookings',
      actionText: 'View Booking',
      metadata: {
        clientName: booking.clientName,
        tutorName: booking.tutorId?.name || 'Tutor',
        reason: reason,
        scheduledAt: booking.scheduledAt
      }
    });

    return await this.createBulk(notifications);
  }

  // Booking cancelled notification
  static async bookingCancelled(tutorId, salesId, booking, reason, cancelledBy) {
    const notifications = [];

    // Determine who to notify
    if (cancelledBy.toString() !== tutorId.toString()) {
      // Notify tutor
      notifications.push({
        userId: tutorId,
        title: 'Booking Cancelled',
        message: `Booking for ${booking.clientName} on ${booking.formattedDateTime} has been cancelled`,
        type: 'booking_cancelled',
        priority: 'high',
        relatedId: booking._id,
        relatedType: 'booking',
        actionUrl: '/bookings',
        actionText: 'View Booking',
        metadata: {
          clientName: booking.clientName,
          reason: reason,
          cancelledBy: cancelledBy.role || 'System',
          scheduledAt: booking.scheduledAt
        }
      });
    }

    if (cancelledBy.toString() !== salesId.toString()) {
      // Notify sales
      notifications.push({
        userId: salesId,
        title: 'Booking Cancelled',
        message: `Booking for ${booking.clientName} has been cancelled`,
        type: 'booking_cancelled',
        priority: 'high',
        relatedId: booking._id,
        relatedType: 'booking',
        actionUrl: '/bookings',
        actionText: 'View Booking',
        metadata: {
          clientName: booking.clientName,
          tutorName: booking.tutorId?.name || 'Tutor',
          reason: reason,
          cancelledBy: cancelledBy.role || 'System',
          scheduledAt: booking.scheduledAt
        }
      });
    }

    return await this.createBulk(notifications);
  }

  // Reschedule requested notification
  static async rescheduleRequested(tutorId, salesId, booking, rescheduleRequest) {
    const notifications = [];

    // Notify sales
    notifications.push({
      userId: salesId,
      title: 'Reschedule Request',
      message: `${booking.tutorId?.name || 'Tutor'} has requested to reschedule booking for ${booking.clientName}`,
      type: 'reschedule_requested',
      priority: 'high',
      relatedId: booking._id,
      relatedType: 'booking',
      actionUrl: '/reschedule-requests',
      actionText: 'Review Request',
      metadata: {
        clientName: booking.clientName,
        tutorName: booking.tutorId?.name || 'Tutor',
        originalDateTime: booking.formattedDateTime,
        newDateTime: `${new Date(rescheduleRequest.newDate).toLocaleDateString()} at ${rescheduleRequest.newStartTime}`,
        reason: rescheduleRequest.reason
      }
    });

    return await this.createBulk(notifications);
  }

  // Reschedule approved notification
  static async rescheduleApproved(tutorId, salesId, booking, rescheduleRequest) {
    const notifications = [];

    // Notify tutor
    notifications.push({
      userId: tutorId,
      title: 'Reschedule Approved',
      message: `Your reschedule request for ${booking.clientName} has been approved`,
      type: 'reschedule_approved',
      priority: 'high',
      relatedId: booking._id,
      relatedType: 'booking',
      actionUrl: '/bookings',
      actionText: 'View Booking',
      metadata: {
        clientName: booking.clientName,
        newDateTime: `${new Date(rescheduleRequest.newDate).toLocaleDateString()} at ${rescheduleRequest.newStartTime}`,
        approvedBy: salesId.role || 'Sales Team'
      }
    });

    return await this.createBulk(notifications);
  }

  // Reschedule rejected notification
  static async rescheduleRejected(tutorId, salesId, booking, rescheduleRequest, reason) {
    const notifications = [];

    // Notify tutor
    notifications.push({
      userId: tutorId,
      title: 'Reschedule Rejected',
      message: `Your reschedule request for ${booking.clientName} has been rejected`,
      type: 'reschedule_rejected',
      priority: 'high',
      relatedId: booking._id,
      relatedType: 'booking',
      actionUrl: '/bookings',
      actionText: 'View Booking',
      metadata: {
        clientName: booking.clientName,
        reason: reason,
        rejectedBy: salesId.role || 'Sales Team'
      }
    });

    return await this.createBulk(notifications);
  }

  // Availability added notification
  static async availabilityAdded(tutorId, availability) {
    return await this.create({
      userId: tutorId,
      title: 'Availability Added',
      message: `New availability added for ${availability.getFormattedDate()}`,
      type: 'availability_added',
      priority: 'low',
      relatedId: availability._id,
      relatedType: 'availability',
      actionUrl: '/dashboard-tutor',
      actionText: 'View Availability',
      metadata: {
        date: availability.date,
        startTime: availability.startTime,
        endTime: availability.endTime,
        isRecurring: availability.isRecurring
      }
    });
  }

  // Availability updated notification
  static async availabilityUpdated(tutorId, availability) {
    return await this.create({
      userId: tutorId,
      title: 'Availability Updated',
      message: `Availability updated for ${availability.getFormattedDate()}`,
      type: 'availability_updated',
      priority: 'low',
      relatedId: availability._id,
      relatedType: 'availability',
      actionUrl: '/dashboard-tutor',
      actionText: 'View Availability',
      metadata: {
        date: availability.date,
        startTime: availability.startTime,
        endTime: availability.endTime
      }
    });
  }

  // Availability deleted notification
  static async availabilityDeleted(tutorId, availability) {
    return await this.create({
      userId: tutorId,
      title: 'Availability Deleted',
      message: `Availability removed for ${availability.getFormattedDate()}`,
      type: 'availability_deleted',
      priority: 'medium',
      relatedId: availability._id,
      relatedType: 'availability',
      actionUrl: '/dashboard-tutor',
      actionText: 'View Availability',
      metadata: {
        date: availability.date,
        startTime: availability.startTime,
        endTime: availability.endTime
      }
    });
  }

  // System notification
  static async systemNotification(userId, title, message, priority = 'medium', actionUrl = null) {
    return await this.create({
      userId,
      title,
      message,
      type: 'system_update',
      priority,
      actionUrl,
      metadata: {
        systemGenerated: true
      }
    });
  }

  // Reminder notification
  static async reminder(userId, title, message, scheduledAt, actionUrl = null) {
    return await this.create({
      userId,
      title,
      message,
      type: 'reminder',
      priority: 'medium',
      actionUrl,
      expiresAt: scheduledAt,
      metadata: {
        reminderType: 'session',
        scheduledAt
      }
    });
  }

  // Get user notifications
  static async getUserNotifications(userId, options = {}) {
    try {
      return await Notification.getUserNotifications(userId, options);
    } catch (error) {
      console.error('Get user notifications error:', error);
      throw error;
    }
  }

  // Get unread count
  static async getUnreadCount(userId, type = null) {
    try {
      return await Notification.getUnreadCount(userId, type);
    } catch (error) {
      console.error('Get unread count error:', error);
      throw error;
    }
  }

  // Mark as read
  static async markAsRead(userId, notificationIds = null) {
    try {
      return await Notification.markAsRead(userId, notificationIds);
    } catch (error) {
      console.error('Mark as read error:', error);
      throw error;
    }
  }

  // Mark all as read
  static async markAllAsRead(userId, type = null) {
    try {
      return await Notification.markAllAsRead(userId, type);
    } catch (error) {
      console.error('Mark all as read error:', error);
      throw error;
    }
  }

  // Delete notifications
  static async deleteNotifications(userId, notificationIds) {
    try {
      return await Notification.deleteNotifications(userId, notificationIds);
    } catch (error) {
      console.error('Delete notifications error:', error);
      throw error;
    }
  }

  // Cleanup old notifications
  static async cleanupOldNotifications(daysOld = 90) {
    try {
      return await Notification.cleanupOldNotifications(daysOld);
    } catch (error) {
      console.error('Cleanup notifications error:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;
