const cron = require('node-cron');
const Booking = require('../models/Booking');
const Availability = require('../models/Availability');
const EmailService = require('./emailService');
const User = require('../models/User');

class EmailScheduler {
  constructor() {
    this.isRunning = false;
    this.jobs = new Map();
  }

  // Start all scheduled jobs
  start() {
    if (this.isRunning) {
      console.log('Email scheduler already running');
      return;
    }

    console.log('Starting email scheduler...');
    this.isRunning = true;

    // Schedule session reminders (every hour)
    this.scheduleSessionReminders();

    // Schedule daily cleanup (every day at 2 AM)
    this.scheduleDailyCleanup();

    // Schedule weekly summary (every Monday at 9 AM)
    this.scheduleWeeklySummary();

    console.log('Email scheduler started successfully');
  }

  // Stop all scheduled jobs
  stop() {
    if (!this.isRunning) {
      console.log('Email scheduler not running');
      return;
    }

    console.log('Stopping email scheduler...');
    
    // Stop all cron jobs
    this.jobs.forEach(job => {
      job.stop();
    });
    
    this.jobs.clear();
    this.isRunning = false;
    
    console.log('Email scheduler stopped');
  }

  // Schedule session reminders
  scheduleSessionReminders() {
    // Run every hour at minute 0
    const job = cron.schedule('0 * * * *', async () => {
      await this.sendSessionReminders();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.jobs.set('sessionReminders', job);
    console.log('Session reminders scheduled: Every hour');
  }

  // Send session reminders
  async sendSessionReminders() {
    try {
      console.log('Checking for session reminders...');

      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      // Find bookings that need reminders
      const bookingsNeedingReminders = await Booking.find({
        status: 'confirmed',
        scheduledAt: {
          $gte: now,
          $lte: twoHoursFromNow
        },
        reminderSent: false
      })
      .populate('tutorId')
      .populate('salesId');

      for (const booking of bookingsNeedingReminders) {
        const bookingTime = new Date(booking.scheduledAt);
        const hoursUntilBooking = (bookingTime - now) / (1000 * 60 * 60);

        // Send 1-hour reminder
        if (hoursUntilBooking <= 1.1 && hoursUntilBooking >= 0.9) {
          console.log(`Sending 1-hour reminder for booking ${booking._id}`);
          
          const result = await EmailService.sendSessionReminder(
            booking,
            booking.tutorId,
            booking.salesId,
            1
          );

          if (result.success) {
            booking.reminderSent = true;
            await booking.save();
          }
        }
        // Send 2-hour reminder (optional)
        else if (hoursUntilBooking <= 2.1 && hoursUntilBooking >= 1.9) {
          console.log(`Sending 2-hour reminder for booking ${booking._id}`);
          
          await EmailService.sendSessionReminder(
            booking,
            booking.tutorId,
            booking.salesId,
            2
          );
        }
      }

      console.log(`Processed ${bookingsNeedingReminders.length} session reminders`);
    } catch (error) {
      console.error('Error sending session reminders:', error);
    }
  }

  // Schedule daily cleanup
  scheduleDailyCleanup() {
    // Run every day at 2 AM
    const job = cron.schedule('0 2 * * *', async () => {
      await this.performDailyCleanup();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.jobs.set('dailyCleanup', job);
    console.log('Daily cleanup scheduled: Every day at 2 AM UTC');
  }

  // Perform daily cleanup tasks
  async performDailyCleanup() {
    try {
      console.log('Performing daily cleanup...');

      // Clean up old notifications (older than 90 days)
      const Notification = require('../models/Notification');
      const result = await Notification.cleanupOldNotifications(90);
      console.log(`Cleaned up ${result.deletedCount} old notifications`);

      // Clean up old availability (past dates, no bookings)
      const oldAvailability = await Availability.deleteMany({
        date: { $lt: new Date() },
        status: 'available',
        bookingId: { $exists: false }
      });
      console.log(`Cleaned up ${oldAvailability.deletedCount} old availability slots`);

      // Send daily summary to admins
      await this.sendDailySummaryToAdmins();

      console.log('Daily cleanup completed');
    } catch (error) {
      console.error('Error performing daily cleanup:', error);
    }
  }

  // Schedule weekly summary
  scheduleWeeklySummary() {
    // Run every Monday at 9 AM
    const job = cron.schedule('0 9 * * 1', async () => {
      await this.sendWeeklySummaryToAdmins();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.jobs.set('weeklySummary', job);
    console.log('Weekly summary scheduled: Every Monday at 9 AM UTC');
  }

  // Send daily summary to admins
  async sendDailySummaryToAdmins() {
    try {
      const admins = await User.find({ role: 'admin' });
      
      if (admins.length === 0) {
        console.log('No admins found for daily summary');
        return;
      }

      // Get yesterday's stats
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stats = await this.getDailyStats(yesterday, today);

      for (const admin of admins) {
        await EmailService.sendDailySummary(admin, stats, yesterday);
      }

      console.log(`Daily summary sent to ${admins.length} admins`);
    } catch (error) {
      console.error('Error sending daily summary:', error);
    }
  }

  // Send weekly summary to admins
  async sendWeeklySummaryToAdmins() {
    try {
      const admins = await User.find({ role: 'admin' });
      
      if (admins.length === 0) {
        console.log('No admins found for weekly summary');
        return;
      }

      // Get last week's stats
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      lastWeek.setHours(0, 0, 0, 0);

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const stats = await this.getWeeklyStats(lastWeek, now);

      for (const admin of admins) {
        await EmailService.sendWeeklySummary(admin, stats, lastWeek);
      }

      console.log(`Weekly summary sent to ${admins.length} admins`);
    } catch (error) {
      console.error('Error sending weekly summary:', error);
    }
  }

  // Get daily statistics
  async getDailyStats(startDate, endDate) {
    const [
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      newUsers,
      activeTutors,
      activeSales
    ] = await Promise.all([
      Booking.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate }
      }),
      Booking.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate },
        status: 'confirmed'
      }),
      Booking.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate },
        status: 'cancelled'
      }),
      User.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate }
      }),
      Booking.distinct('tutorId', {
        createdAt: { $gte: startDate, $lt: endDate }
      }).then(tutors => tutors.length),
      Booking.distinct('salesId', {
        createdAt: { $gte: startDate, $lt: endDate }
      }).then(sales => sales.length)
    ]);

    return {
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      newUsers,
      activeTutors,
      activeSales,
      date: startDate
    };
  }

  // Get weekly statistics
  async getWeeklyStats(startDate, endDate) {
    const [
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      newUsers,
      tutorStats,
      salesStats
    ] = await Promise.all([
      Booking.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate }
      }),
      Booking.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate },
        status: 'confirmed'
      }),
      Booking.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate },
        status: 'cancelled'
      }),
      User.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate }
      }),
      Booking.aggregate([
        { $match: { createdAt: { $gte: startDate, $lt: endDate } } },
        { $group: { _id: '$tutorId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]),
      Booking.aggregate([
        { $match: { createdAt: { $gte: startDate, $lt: endDate } } },
        { $group: { _id: '$salesId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ])
    ]);

    return {
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      newUsers,
      topTutors: tutorStats,
      topSales: salesStats,
      weekStart: startDate
    };
  }

  // Schedule custom reminder
  scheduleCustomReminder(bookingId, reminderTime, hoursBefore) {
    const job = cron.schedule(reminderTime, async () => {
      try {
        const booking = await Booking.findById(bookingId)
          .populate('tutorId')
          .populate('salesId');

        if (booking && booking.status === 'confirmed') {
          await EmailService.sendSessionReminder(
            booking,
            booking.tutorId,
            booking.salesId,
            hoursBefore
          );
        }
      } catch (error) {
        console.error('Error sending custom reminder:', error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    const jobKey = `reminder_${bookingId}_${hoursBefore}h`;
    this.jobs.set(jobKey, job);
    
    console.log(`Custom reminder scheduled for booking ${bookingId}, ${hoursBefore} hours before`);
  }

  // Cancel custom reminder
  cancelCustomReminder(bookingId, hoursBefore) {
    const jobKey = `reminder_${bookingId}_${hoursBefore}h`;
    const job = this.jobs.get(jobKey);
    
    if (job) {
      job.stop();
      this.jobs.delete(jobKey);
      console.log(`Custom reminder cancelled for booking ${bookingId}, ${hoursBefore} hours before`);
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: Array.from(this.jobs.keys()),
      jobCount: this.jobs.size
    };
  }
}

// Create singleton instance
const emailScheduler = new EmailScheduler();

module.exports = emailScheduler;
