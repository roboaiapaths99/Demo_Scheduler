const Booking = require('../models/Booking');
const Availability = require('../models/Availability');
const User = require('../models/User');
const mongoose = require('mongoose');
const EmailService = require('../utils/emailService');
const { runInTransaction } = require('../utils/dbUtils');

// Create new booking
const createBooking = async (req, res) => {
  try {
    const { 
      availabilityId, 
      clientName, 
      clientPhone, 
      clientEmail, 
      clientNotes 
    } = req.body;
    const salesId = req.user._id;

    // Validate input
    if (!availabilityId || !clientName || !clientPhone) {
      return res.status(400).json({
        success: false,
        message: 'Availability ID, client name, and phone are required.'
      });
    }

    const { booking } = await runInTransaction(async (session) => {
      // Find and lock the availability slot
      const availability = await Availability.findById(availabilityId).session(session);
      if (!availability) {
        throw new Error('Availability slot not found.');
      }

      // Check if slot is still available
      if (availability.status !== 'available') {
        throw new Error('This slot is no longer available.');
      }

      // Check if slot is in the future
      if (availability.date <= new Date()) {
        throw new Error('Cannot book slots in the past.');
      }

      // Lock the availability slot immediately
      availability.status = 'booked';
      await availability.save({ session });

      // Calculate duration
      const duration = calculateDuration(availability.startTime, availability.endTime);

      // Create the booking
      const booking = new Booking({
        tutorId: availability.tutorId,
        salesId,
        availabilityId,
        clientName,
        clientPhone,
        clientEmail,
        clientNotes,
        scheduledAt: availability.date,
        startTime: availability.startTime,
        endTime: availability.endTime,
        duration
      });

      await booking.save({ session });

      // Update availability with booking reference
      availability.bookingId = booking._id;
      await availability.save({ session });

      return { booking };
    });

    // Populate booking details for response
    const populatedBooking = await Booking.findById(booking._id)
      .populate('tutorId', 'name email')
      .populate('salesId', 'name email')
      .populate('availabilityId');

    res.status(201).json({
      success: true,
      message: 'Booking created successfully.',
      data: {
        booking: populatedBooking.getSummary(),
        details: {
          clientName: populatedBooking.clientName,
          clientPhone: populatedBooking.clientPhone,
          clientEmail: populatedBooking.clientEmail,
          tutorName: populatedBooking.tutorId.name,
          scheduledAt: populatedBooking.formattedDateTime,
          duration: populatedBooking.duration
        }
      }
    });

    // Send notifications (Phase 7)
    const NotificationService = require('../utils/notificationService');
    await NotificationService.bookingCreated(booking.tutorId, booking.salesId, booking);

    // Send email confirmation (Phase 8)
    try {
      const tutor = await User.findById(booking.tutorId);
      const sales = await User.findById(booking.salesId);
      await EmailService.sendBookingRequestToTutor(booking, tutor, sales);
    } catch (emailError) {
      console.error('Failed to send booking email:', emailError);
    }

  } catch (error) {
    if (['Availability slot not found.', 'This slot is no longer available.', 'Cannot book slots in the past.'].includes(error.message)) {
      return res.status(error.message === 'Availability slot not found.' ? 404 : 400).json({
        success: false,
        message: error.message
      });
    }

    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while creating booking.'
    });
  }
};

// Get sales team's bookings
const getSalesBookings = async (req, res) => {
  try {
    const salesId = req.user._id;
    const { 
      startDate, 
      endDate, 
      status, 
      tutorResponse,
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    const query = { salesId };
    
    if (startDate || endDate) {
      query.scheduledAt = {};
      if (startDate) query.scheduledAt.$gte = new Date(startDate);
      if (endDate) query.scheduledAt.$lte = new Date(endDate);
    }
    
    if (status) query.status = status;
    if (tutorResponse) query.tutorResponse = tutorResponse;

    // Pagination
    const skip = (page - 1) * limit;

    // Get bookings with populated details
    const bookings = await Booking.find(query)
      .populate('tutorId', 'name email')
      .populate('availabilityId')
      .sort({ scheduledAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        bookings: bookings.map(booking => ({
          ...booking.getSummary(),
          tutorName: booking.tutorId?.name,
          clientPhone: booking.clientPhone,
          clientEmail: booking.clientEmail,
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
    console.error('Get sales bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching bookings.'
    });
  }
};

// Get tutor's bookings
const getTutorBookings = async (req, res) => {
  try {
    const tutorId = req.user._id;
    const { 
      startDate, 
      endDate, 
      status, 
      tutorResponse,
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    const query = { tutorId };
    
    if (startDate || endDate) {
      query.scheduledAt = {};
      if (startDate) query.scheduledAt.$gte = new Date(startDate);
      if (endDate) query.scheduledAt.$lte = new Date(endDate);
    }
    
    if (status) query.status = status;
    if (tutorResponse) query.tutorResponse = tutorResponse;

    // Pagination
    const skip = (page - 1) * limit;

    // Get bookings with populated details
    const bookings = await Booking.find(query)
      .populate('salesId', 'name email')
      .populate('availabilityId')
      .sort({ scheduledAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        bookings: bookings.map(booking => ({
          ...booking.getSummary(),
          salesName: booking.salesId?.name,
          clientName: booking.clientName,
          clientPhone: booking.clientPhone,
          clientEmail: booking.clientEmail,
          clientNotes: booking.clientNotes,
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
    console.error('Get tutor bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching bookings.'
    });
  }
};

// Get booking details
const getBookingDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    // Build query based on user role
    let query = { _id: id };
    if (userRole === 'sales') {
      query.salesId = userId;
    } else if (userRole === 'tutor') {
      query.tutorId = userId;
    }

    const booking = await Booking.findOne(query)
      .populate('tutorId', 'name email')
      .populate('salesId', 'name email')
      .populate('availabilityId');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        booking: {
          ...booking.toObject(),
          formattedDateTime: booking.formattedDateTime,
          timeRange: booking.timeRange,
          isUpcoming: booking.isUpcoming(),
          isModifiable: booking.isModifiable()
        }
      }
    });
  } catch (error) {
    console.error('Get booking details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching booking details.'
    });
  }
};

// Cancel booking
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    const { booking } = await runInTransaction(async (session) => {
      // Find booking
      const booking = await Booking.findById(id).session(session);
      if (!booking) {
        throw new Error('Booking not found.');
      }

      // Check permissions
      if (userRole === 'sales' && booking.salesId.toString() !== userId.toString()) {
        throw new Error('Forbidden: You can only cancel your own bookings.');
      }

      if (userRole === 'tutor' && booking.tutorId.toString() !== userId.toString()) {
        throw new Error('Forbidden: You can only cancel bookings assigned to you.');
      }

      // Check if booking can be cancelled
      if (!booking.isModifiable() && userRole === 'sales') {
        throw new Error('Booking cannot be cancelled less than 24 hours before the scheduled time.');
      }

      // Cancel booking
      await booking.cancel(reason, userId, { session });

      // Update availability slot
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
      message: 'Booking cancelled successfully.',
      data: {
        booking: booking.getSummary()
      }
    });

    // TODO: Send notifications (Phase 7)
    // TODO: Send email (Phase 8)

  } catch (error) {
    if (error.message === 'Booking not found.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.startsWith('Forbidden:')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message === 'Booking cannot be cancelled less than 24 hours before the scheduled time.') {
      return res.status(400).json({ success: false, message: error.message });
    }

    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while cancelling booking.'
    });
  }
};

// Get booking statistics
const getBookingStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    const { startDate, endDate } = req.query;

    // Build date range
    const dateQuery = {};
    if (startDate) dateQuery.$gte = new Date(startDate);
    if (endDate) dateQuery.$lte = new Date(endDate);

    // Build query based on user role
    const matchQuery = {
      scheduledAt: dateQuery,
      ...(userRole === 'sales' && { salesId: userId }),
      ...(userRole === 'tutor' && { tutorId: userId })
    };

    // Get overall statistics
    const stats = await Booking.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalDuration: { $sum: '$duration' }
        }
      }
    ]);

    // Get monthly trend
    const monthlyTrend = await Booking.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            year: { $year: '$scheduledAt' },
            month: { $month: '$scheduledAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        stats,
        monthlyTrend
      }
    });
  } catch (error) {
    console.error('Get booking stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching booking statistics.'
    });
  }
};

// Tutor confirms a pending booking
const confirmBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const tutorId = req.user._id;

    const { booking } = await runInTransaction(async (session) => {
      // Find booking and verify tutor owns it
      const booking = await Booking.findById(id).session(session);
      
      if (!booking) {
        throw new Error('Booking not found.');
      }

      if (booking.tutorId.toString() !== tutorId.toString()) {
        throw new Error('Forbidden: You can only confirm your own bookings.');
      }

      if (booking.status !== 'pending') {
        throw new Error(`Cannot confirm booking with status: ${booking.status}`);
      }

      // Update booking
      booking.status = 'confirmed';
      booking.tutorResponse = 'accepted';
      booking.updatedAt = new Date();
      await booking.save({ session });

      return { booking };
    });

    // Send notification to sales
    try {
      const NotificationService = require('../utils/notificationService');
      await NotificationService.bookingConfirmed(booking.salesId, booking.tutorId, booking);
    } catch (notifyError) {
      console.error('Notification error:', notifyError);
    }

    res.status(200).json({
      success: true,
      message: 'Booking confirmed successfully.',
      data: {
        bookingId: booking._id,
        status: booking.status,
        tutorResponse: booking.tutorResponse
      }
    });

  } catch (error) {
    if (error.message === 'Booking not found.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.startsWith('Forbidden:')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.startsWith('Cannot confirm')) {
      return res.status(400).json({ success: false, message: error.message });
    }

    console.error('Confirm booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error confirming booking.'
    });
  }
};

// Tutor rejects a pending booking (RELEASES SLOT)
const rejectBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const tutorId = req.user._id;

    const { booking } = await runInTransaction(async (session) => {
      // Find booking and verify tutor owns it
      const booking = await Booking.findById(id).session(session);
      
      if (!booking) {
        throw new Error('Booking not found.');
      }

      if (booking.tutorId.toString() !== tutorId.toString()) {
        throw new Error('Forbidden: You can only reject your own bookings.');
      }

      if (booking.status !== 'pending') {
        throw new Error(`Cannot reject booking with status: ${booking.status}`);
      }

      // Update booking
      booking.status = 'cancelled';
      booking.tutorResponse = 'rejected';
      booking.updatedAt = new Date();
      await booking.save({ session });

      // Find and release the availability slot
      const availability = await Availability.findById(booking.availabilityId).session(session);
      if (availability) {
        availability.status = 'available';
        availability.bookingId = null;
        availability.clientInfo = undefined;
        await availability.save({ session });
      }

      return { booking };
    });

    // Send notification to sales
    try {
      const NotificationService = require('../utils/notificationService');
      await NotificationService.bookingRejected(booking.salesId, booking.tutorId, booking, reason);
    } catch (notifyError) {
      console.error('Notification error:', notifyError);
    }

    res.status(200).json({
      success: true,
      message: 'Booking rejected and slot released.',
      data: {
        bookingId: booking._id,
        status: booking.status,
        tutorResponse: booking.tutorResponse,
        slotReleased: true
      }
    });

  } catch (error) {
    if (error.message === 'Booking not found.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.startsWith('Forbidden:')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.startsWith('Cannot reject')) {
      return res.status(400).json({ success: false, message: error.message });
    }

    console.error('Reject booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting booking.'
    });
  }
};

// Sales cancels a booking
const cancelBookingBySales = async (req, res) => {
  try {
    const { id } = req.params;
    const salesId = req.user._id;

    const { booking } = await runInTransaction(async (session) => {
      // Find booking and verify sales owns it
      const booking = await Booking.findById(id).session(session);
      
      if (!booking) {
        throw new Error('Booking not found.');
      }

      if (booking.salesId.toString() !== salesId.toString()) {
        throw new Error('Forbidden: You can only cancel your own bookings.');
      }

      if (booking.status === 'completed' || booking.status === 'cancelled') {
        throw new Error(`Cannot cancel booking with status: ${booking.status}`);
      }

      // Update booking
      booking.status = 'cancelled';
      booking.updatedAt = new Date();
      await booking.save({ session });

      // Release the availability slot if pending
      if (booking.status === 'pending' || booking.status === 'confirmed') {
        const availability = await Availability.findById(booking.availabilityId).session(session);
        if (availability) {
          availability.status = 'available';
          availability.bookingId = null;
          availability.clientInfo = undefined;
          await availability.save({ session });
        }
      }

      return { booking };
    });

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully.',
      data: {
        bookingId: booking._id,
        status: booking.status
      }
    });

  } catch (error) {
    if (error.message === 'Booking not found.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.startsWith('Forbidden:')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.startsWith('Cannot cancel')) {
      return res.status(400).json({ success: false, message: error.message });
    }

    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling booking.'
    });
  }
};

// Helper function to calculate duration
const calculateDuration = (startTime, endTime) => {
  const start = startTime.split(':');
  const end = endTime.split(':');

  const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
  const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);

  return endMinutes - startMinutes;
};

module.exports = {
  createBooking,
  getSalesBookings,
  getTutorBookings,
  getBookingDetails,
  cancelBooking,
  confirmBooking,
  rejectBooking,
  cancelBookingBySales,
  getBookingStats
};
