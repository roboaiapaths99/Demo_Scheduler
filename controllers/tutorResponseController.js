const Booking = require('../models/Booking');
const Availability = require('../models/Availability');
const User = require('../models/User');
const mongoose = require('mongoose');
const { runInTransaction } = require('../utils/dbUtils');

// Get pending bookings for tutor
const getPendingBookings = async (req, res) => {
  try {
    const tutorId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    // Build query for pending bookings
    const query = {
      tutorId,
      tutorResponse: 'pending',
      status: { $nin: ['cancelled'] }
    };

    // Pagination
    const skip = (page - 1) * limit;

    // Get pending bookings with populated details
    const bookings = await Booking.find(query)
      .populate('salesId', 'name email')
      .populate('availabilityId')
      .sort({ scheduledAt: 1, createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        bookings: bookings.map(booking => ({
          _id: booking._id,
          clientName: booking.clientName,
          clientPhone: booking.clientPhone,
          clientEmail: booking.clientEmail,
          clientNotes: booking.clientNotes,
          scheduledAt: booking.scheduledAt,
          startTime: booking.startTime,
          endTime: booking.endTime,
          duration: booking.duration,
          formattedDateTime: booking.formattedDateTime,
          timeRange: booking.timeRange,
          salesName: booking.salesId?.name,
          createdAt: booking.createdAt,
          isUpcoming: booking.isUpcoming(),
          isModifiable: booking.isModifiable()
        })),
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get pending bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching pending bookings.'
    });
  }
};

// Accept booking
const acceptBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const tutorId = req.user._id;

    const { populatedBooking } = await runInTransaction(async (session) => {
      // Find booking
      const booking = await Booking.findById(id).session(session);
      if (!booking) {
        throw new Error('Booking not found.');
      }

      // Verify booking belongs to this tutor
      if (booking.tutorId.toString() !== tutorId.toString()) {
        throw new Error('Forbidden: You can only respond to bookings assigned to you.');
      }

      // Check if booking is still pending
      if (booking.tutorResponse !== 'pending') {
        throw new Error('This booking has already been responded to.');
      }

      // Check if booking is still upcoming
      if (!booking.isUpcoming()) {
        throw new Error('Cannot respond to past or cancelled bookings.');
      }

      // Accept the booking
      await booking.confirm({ session });

      // Update availability status to confirmed
      const availability = await Availability.findById(booking.availabilityId).session(session);
      if (availability) {
        availability.status = 'booked';
        await availability.save({ session });
      }

      // Get populated booking details for response
      const pb = await Booking.findById(booking._id)
        .session(session)
        .populate('tutorId', 'name email')
        .populate('salesId', 'name email')
        .populate('availabilityId');
      
      return { populatedBooking: pb };
    });

    res.status(200).json({
      success: true,
      message: 'Booking accepted successfully.',
      data: {
        booking: populatedBooking.getSummary()
      }
    });

    // TODO: Send notification to sales team (Phase 7)
    // TODO: Send email confirmation (Phase 8)

  } catch (error) {
    if (error.message === 'Booking not found.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.startsWith('Forbidden:')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (['This booking has already been responded to.', 'Cannot respond to past or cancelled bookings.'].includes(error.message)) {
      return res.status(400).json({ success: false, message: error.message });
    }

    console.error('Accept booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while accepting booking.'
    });
  }
};

// Reject booking
const rejectBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const tutorId = req.user._id;

    const { booking } = await runInTransaction(async (session) => {
      // Find booking
      const booking = await Booking.findById(id).session(session);
      if (!booking) {
        throw new Error('Booking not found.');
      }

      // Verify booking belongs to this tutor
      if (booking.tutorId.toString() !== tutorId.toString()) {
        throw new Error('Forbidden: You can only respond to bookings assigned to you.');
      }

      // Check if booking is still pending
      if (booking.tutorResponse !== 'pending') {
        throw new Error('This booking has already been responded to.');
      }

      // Reject the booking
      booking.tutorResponse = 'rejected';
      booking.status = 'cancelled';
      booking.cancellationReason = reason || 'Rejected by tutor';
      booking.cancelledBy = tutorId;
      booking.cancelledAt = new Date();
      await booking.save({ session });

      // Make availability slot available again
      const availability = await Availability.findById(booking.availabilityId).session(session);
      if (availability) {
        availability.status = 'available';
        availability.bookingId = null;
        await availability.save({ session });
      }

      return { booking };
    });

    res.status(200).json({
      success: true,
      message: 'Booking rejected successfully.',
      data: {
        booking: booking.getSummary()
      }
    });

    // TODO: Send notification to sales team (Phase 7)
    // TODO: Send email notification (Phase 8)

  } catch (error) {
    if (error.message === 'Booking not found.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.startsWith('Forbidden:')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message === 'This booking has already been responded to.') {
      return res.status(400).json({ success: false, message: error.message });
    }

    console.error('Reject booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while rejecting booking.'
    });
  }
};

// Request reschedule
const requestReschedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { newDate, newStartTime, newEndTime, reason } = req.body;
    const tutorId = req.user._id;

    // Validate input
    if (!newDate || !newStartTime || !newEndTime) {
      return res.status(400).json({
        success: false,
        message: 'New date, start time, and end time are required.'
      });
    }

    // Validate new date is in the future
    const scheduledDate = new Date(newDate);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Rescheduled date must be in the future.'
      });
    }

    // Validate time format and duration
    if (!this.isValidTimeFormat(newStartTime) || !this.isValidTimeFormat(newEndTime)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid time format. Use HH:MM format.'
      });
    }

    if (newStartTime >= newEndTime) {
      return res.status(400).json({
        success: false,
        message: 'End time must be after start time.'
      });
    }

    // Find booking
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.'
      });
    }

    // Verify booking belongs to this tutor
    if (booking.tutorId.toString() !== tutorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only respond to bookings assigned to you.'
      });
    }

    // Check if booking is still pending
    if (booking.tutorResponse !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This booking has already been responded to.'
      });
    }

    // Check for conflicts with existing availability
    const conflictCheck = await Availability.checkOverlap(
      tutorId,
      newDate,
      newStartTime,
      newEndTime
    );

    if (conflictCheck) {
      return res.status(400).json({
        success: false,
        message: 'Requested time conflicts with existing availability or booking.'
      });
    }

    // Create reschedule request
    await booking.requestReschedule(tutorId, scheduledDate, newStartTime, newEndTime, reason);

    res.status(200).json({
      success: true,
      message: 'Reschedule request sent successfully.',
      data: {
        booking: booking.getSummary()
      }
    });

    // TODO: Send notification to sales team (Phase 7)
    // TODO: Send email notification (Phase 8)

  } catch (error) {
    console.error('Request reschedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while requesting reschedule.'
    });
  }
};

// Get reschedule requests for sales team
const getRescheduleRequests = async (req, res) => {
  try {
    const salesId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    // Build query for reschedule requests
    const query = {
      salesId,
      'rescheduleRequest.status': 'pending',
      status: { $nin: ['cancelled'] }
    };

    // Pagination
    const skip = (page - 1) * limit;

    // Get bookings with reschedule requests
    const bookings = await Booking.find(query)
      .populate('tutorId', 'name email')
      .populate('availabilityId')
      .sort({ 'rescheduleRequest.requestedAt': -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        bookings: bookings.map(booking => ({
          _id: booking._id,
          clientName: booking.clientName,
          tutorName: booking.tutorId?.name,
          originalDateTime: booking.formattedDateTime,
          rescheduleRequest: booking.rescheduleRequest,
          createdAt: booking.createdAt
        })),
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get reschedule requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching reschedule requests.'
    });
  }
};

// Respond to reschedule request
const respondToReschedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { response } = req.body;
    const salesId = req.user._id;

    // Validate response
    if (!['approved', 'rejected'].includes(response)) {
      return res.status(400).json({
        success: false,
        message: 'Response must be either "approved" or "rejected".'
      });
    }

    const { booking } = await runInTransaction(async (session) => {
      // Find booking
      const booking = await Booking.findById(id).session(session);
      if (!booking) {
        throw new Error('Booking not found.');
      }

      // Verify booking belongs to this sales person
      if (booking.salesId.toString() !== salesId.toString()) {
        throw new Error('Forbidden: You can only respond to bookings created by you.');
      }

      // Check if there's a pending reschedule request
      if (!booking.rescheduleRequest || booking.rescheduleRequest.status !== 'pending') {
        throw new Error('No pending reschedule request found.');
      }

      if (response === 'rejected') {
        // Reject reschedule request
        booking.rescheduleRequest.status = 'rejected';
        await booking.save({ session });
      } else {
        // Approve reschedule request
        const newDate = booking.rescheduleRequest.newDate;
        const newStartTime = booking.rescheduleRequest.newStartTime;
        const newEndTime = booking.rescheduleRequest.newEndTime;

        // Check for conflicts again (in case something changed)
        const conflictCheck = await Availability.checkOverlap(
          booking.tutorId,
          newDate,
          newStartTime,
          newEndTime,
          booking.availabilityId
        );

        if (conflictCheck) {
          throw new Error('Requested time is no longer available due to a conflict.');
        }

        // Update availability
        const availability = await Availability.findById(booking.availabilityId).session(session);
        if (availability) {
          availability.date = newDate;
          availability.startTime = newStartTime;
          availability.endTime = newEndTime;
          await availability.save({ session });
        }

        // Update booking
        await booking.respondToReschedule('approved', { session });
      }

      return { booking };
    });

    res.status(200).json({
      success: true,
      message: response === 'rejected' ? 'Reschedule request rejected.' : 'Reschedule request approved. Booking has been updated.',
      data: {
        booking: booking.getSummary()
      }
    });

    // TODO: Send notification to tutor (Phase 7)
    // TODO: Send email notification (Phase 8)

  } catch (error) {
    if (error.message === 'Booking not found.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.startsWith('Forbidden:')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (['No pending reschedule request found.', 'Requested time is no longer available due to a conflict.'].includes(error.message)) {
      return res.status(400).json({ success: false, message: error.message });
    }

    console.error('Respond to reschedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while responding to reschedule request.'
    });
  }
};

// Get tutor response statistics
const getTutorResponseStats = async (req, res) => {
  try {
    const tutorId = req.user._id;
    const { startDate, endDate } = req.query;

    // Build date range
    const dateQuery = {};
    if (startDate) dateQuery.$gte = new Date(startDate);
    if (endDate) dateQuery.$lte = new Date(endDate);

    // Get response statistics
    const stats = await Booking.aggregate([
      {
        $match: {
          tutorId: new mongoose.Types.ObjectId(tutorId),
          createdAt: dateQuery
        }
      },
      {
        $group: {
          _id: '$tutorResponse',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get response time statistics
    const responseTimeStats = await Booking.aggregate([
      {
        $match: {
          tutorId: new mongoose.Types.ObjectId(tutorId),
          tutorResponse: { $in: ['accepted', 'rejected'] },
          createdAt: dateQuery
        }
      },
      {
        $project: {
          responseTime: {
            $divide: [
              { $subtract: ['$updatedAt', '$createdAt'] },
              1000 * 60 // Convert to minutes
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTime' },
          minResponseTime: { $min: '$responseTime' },
          maxResponseTime: { $max: '$responseTime' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        stats,
        responseTimeStats: responseTimeStats[0] || {
          avgResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0
        }
      }
    });
  } catch (error) {
    console.error('Get tutor response stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching response statistics.'
    });
  }
};

// Helper function to validate time format
const isValidTimeFormat = (time) => {
  return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
};

module.exports = {
  getPendingBookings,
  acceptBooking,
  rejectBooking,
  requestReschedule,
  getRescheduleRequests,
  respondToReschedule,
  getTutorResponseStats
};
