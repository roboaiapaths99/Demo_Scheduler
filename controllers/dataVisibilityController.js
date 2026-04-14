/**
 * Data Visibility Controller
 * Handles cross-role data access with proper RBAC
 */

const Booking = require('../models/Booking');
const Availability = require('../models/Availability');
const User = require('../models/User');

/**
 * Sales: Get all their bookings with tutor details
 */
const getSalesBookingsSummary = async (req, res) => {
  try {
    const salesId = req.user._id;

    const bookings = await Booking.find({ salesId })
      .populate('tutorId', 'name email specialization rating')
      .populate('availabilityId')
      .sort({ scheduledAt: -1 });

    const summary = {
      totalBookings: bookings.length,
      confirmedBookings: bookings.filter(b => b.status === 'confirmed').length,
      pendingBookings: bookings.filter(b => b.status === 'pending').length,
      cancelledBookings: bookings.filter(b => b.status === 'cancelled').length,
      bookings: bookings.map(b => ({
        _id: b._id,
        tutorName: b.tutorId?.name,
        tutorEmail: b.tutorId?.email,
        clientName: b.clientName,
        clientEmail: b.clientEmail,
        scheduledAt: b.scheduledAt,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        duration: b.duration,
        notes: b.clientNotes
      }))
    };

    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching bookings',
      error: error.message 
    });
  }
};

/**
 * Tutor: Get all bookings made for them with sales details
 */
const getTutorBookingsSummary = async (req, res) => {
  try {
    const tutorId = req.user._id;

    const bookings = await Booking.find({ tutorId })
      .populate('salesId', 'name email company')
      .populate('availabilityId')
      .sort({ scheduledAt: -1 });

    const summary = {
      totalBookings: bookings.length,
      confirmedBookings: bookings.filter(b => b.status === 'confirmed').length,
      pendingBookings: bookings.filter(b => b.status === 'pending').length,
      completedBookings: bookings.filter(b => b.status === 'completed').length,
      bookings: bookings.map(b => ({
        _id: b._id,
        salesName: b.salesId?.name,
        salesEmail: b.salesId?.email,
        salesCompany: b.salesId?.company,
        clientName: b.clientName,
        clientEmail: b.clientEmail,
        clientPhone: b.clientPhone,
        scheduledAt: b.scheduledAt,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        duration: b.duration
      }))
    };

    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching bookings',
      error: error.message 
    });
  }
};

/**
 * Sales: Get all available tutors with their availability summary
 */
const getAvailableTutors = async (req, res) => {
  try {
    // Get all tutors
    const tutors = await User.find({ role: 'tutor' })
      .select('_id name email specialization rating bio');

    // For each tutor, get their available slots count
    const tutorsWithAvailability = await Promise.all(
      tutors.map(async (tutor) => {
        const availableSlots = await Availability.countDocuments({
          tutorId: tutor._id,
          status: 'available',
          date: { $gte: new Date() }
        });

        const bookings = await Booking.countDocuments({
          tutorId: tutor._id,
          status: { $in: ['confirmed', 'pending'] }
        });

        return {
          _id: tutor._id,
          name: tutor.name,
          email: tutor.email,
          specialization: tutor.specialization,
          rating: tutor.rating || 0,
          bio: tutor.bio,
          availableSlots,
          upcomingBookings: bookings
        };
      })
    );

    res.json({ 
      success: true, 
      data: tutorsWithAvailability,
      count: tutorsWithAvailability.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching tutors',
      error: error.message 
    });
  }
};

/**
 * Sales: Get available slots for a specific tutor
 */
const getTutorAvailableSlots = async (req, res) => {
  try {
    const { tutorId } = req.params;
    const { startDate, endDate } = req.query;

    const query = {
      tutorId,
      status: 'available',
      date: { $gte: new Date() }
    };

    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);

    const slots = await Availability.find(query)
      .sort({ date: 1, startTime: 1 })
      .select('_id date startTime endTime notes');

    res.json({ 
      success: true, 
      data: slots,
      count: slots.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching slots',
      error: error.message 
    });
  }
};

/**
 * Tutor: Get all their availability slots with booking status
 */
const getTutorAllAvailability = async (req, res) => {
  try {
    const tutorId = req.user._id;

    const slots = await Availability.find({ tutorId })
      .sort({ date: -1, startTime: -1 })
      .select('_id date startTime endTime status notes bookingId');

    // Populate booking info for booked slots
    const slotsWithBookings = await Promise.all(
      slots.map(async (slot) => {
        if (slot.status === 'booked' && slot.bookingId) {
          const booking = await Booking.findById(slot.bookingId)
            .select('clientName clientEmail clientPhone clientNotes');
          return {
            _id: slot._id,
            date: slot.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            status: slot.status,
            notes: slot.notes,
            booking: booking ? {
              clientName: booking.clientName,
              clientEmail: booking.clientEmail,
              clientPhone: booking.clientPhone,
              notes: booking.clientNotes
            } : null
          };
        }
        return slot;
      })
    );

    res.json({ 
      success: true, 
      data: slotsWithBookings,
      count: slotsWithBookings.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching availability',
      error: error.message 
    });
  }
};

/**
 * Sales: Get specific tutor details with booking history
 */
const getTutorProfile = async (req, res) => {
  try {
    const { tutorId } = req.params;

    const tutor = await User.findById(tutorId)
      .select('_id name email specialization rating bio phone');

    if (!tutor) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tutor not found' 
      });
    }

    // Get booking history by this sales with this tutor
    const bookingHistory = await Booking.find({
      salesId: req.user._id,
      tutorId
    }).select('_id scheduledAt status clientName');

    const profile = {
      ...tutor.toObject(),
      bookingCount: bookingHistory.length,
      recentBookings: bookingHistory.slice(0, 5)
    };

    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching tutor profile',
      error: error.message 
    });
  }
};

module.exports = {
  getSalesBookingsSummary,
  getTutorBookingsSummary,
  getAvailableTutors,
  getTutorAvailableSlots,
  getTutorAllAvailability,
  getTutorProfile
};
