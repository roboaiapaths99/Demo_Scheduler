const webpush = require('web-push');

// Set VAPID keys (generate from: npx web-push generate-vapid-keys)
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  console.warn('⚠️  VAPID keys not configured. Push notifications disabled.');
  console.warn('Generate keys with: npx web-push generate-vapid-keys');
} else {
  // Configure web push only if keys are available
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@tutorsystem.com',
    vapidPublicKey,
    vapidPrivateKey
  );
}

// In-memory storage for subscriptions (use database in production)
const subscriptions = new Map();

/**
 * Send push notification
 */
const sendNotification = async (userId, notification) => {
  try {
    const userSubscriptions = subscriptions.get(userId) || [];
    
    if (userSubscriptions.length === 0) {
      console.log(`No subscriptions found for user ${userId}`);
      return false;
    }

    const notificationPayload = {
      title: notification.title || 'Tutor Availability System',
      body: notification.message || 'You have a new notification',
      icon: '/favicon.ico',
      badge: '/badge.png',
      tag: notification.tag || 'default',
      requireInteraction: notification.requireInteraction || false,
      data: {
        url: notification.url || '/'
      }
    };

    const sendPromises = userSubscriptions.map(subscription => {
      return webpush.sendNotification(subscription, JSON.stringify(notificationPayload))
        .catch(error => {
          console.error('Push notification error:', error);
          // Remove dead subscriptions
          if (error.statusCode === 410) {
            userSubscriptions.splice(userSubscriptions.indexOf(subscription), 1);
          }
        });
    });

    await Promise.all(sendPromises);
    return true;
  } catch (error) {
    console.error('Send notification error:', error);
    return false;
  }
};

/**
 * Subscribe user to notifications
 */
const subscribeUser = (userId, subscription) => {
  try {
    if (!subscriptions.has(userId)) {
      subscriptions.set(userId, []);
    }
    subscriptions.get(userId).push(subscription);
    console.log(`✅ User ${userId} subscribed to notifications`);
    return true;
  } catch (error) {
    console.error('Subscribe user error:', error);
    return false;
  }
};

/**
 * Unsubscribe user from notifications
 */
const unsubscribeUser = (userId, endpoint) => {
  try {
    const userSubscriptions = subscriptions.get(userId) || [];
    const index = userSubscriptions.findIndex(sub => sub.endpoint === endpoint);
    
    if (index !== -1) {
      userSubscriptions.splice(index, 1);
      console.log(`✅ User ${userId} unsubscribed from notifications`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Unsubscribe user error:', error);
    return false;
  }
};

/**
 * Send event reminder notification
 */
const sendEventReminder = async (userId, eventData, minutesBefore = 15) => {
  const notification = {
    title: `📅 Upcoming: ${eventData.title}`,
    message: `Your event starts in ${minutesBefore} minutes`,
    url: eventData.eventUrl || '/',
    tag: `event-${eventData.eventId}`,
    requireInteraction: true
  };

  return sendNotification(userId, notification);
};

/**
 * Send booking notification
 */
const sendBookingNotification = async (tutorId, bookingData) => {
  const notification = {
    title: '📖 New Booking!',
    message: `You have a new booking from ${bookingData.clientName} on ${bookingData.date}`,
    url: `/bookings/${bookingData.bookingId}`,
    tag: `booking-${bookingData.bookingId}`,
    requireInteraction: true
  };

  return sendNotification(tutorId, notification);
};

/**
 * Send availability update notification to sales team
 */
const sendAvailabilityUpdateNotification = async (salesTeamIds, tutorName, updateData) => {
  const notifications = salesTeamIds.map(salesId => 
    sendNotification(salesId, {
      title: `📅 ${tutorName} Updated Availability`,
      message: `${tutorName} has updated their availability schedule`,
      url: '/availability/' + updateData.tutorId,
      tag: `tutor-update-${updateData.tutorId}`,
      requireInteraction: false
    })
  );

  return Promise.all(notifications);
};

module.exports = {
  sendNotification,
  subscribeUser,
  unsubscribeUser,
  sendEventReminder,
  sendBookingNotification,
  sendAvailabilityUpdateNotification,
  vapidPublicKey
};
