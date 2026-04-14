const Availability = require('../models/Availability');
const mongoose = require('mongoose');

// Add new availability slot
const addAvailability = async (req, res) => {
  try {
    const { date, startTime, endTime, notes, isRecurring, recurringPattern, recurringEndDate } = req.body;
    const tutorId = req.user._id;

    // Validate input
    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Date, start time, and end time are required.'
      });
    }

    // Validate date is not in the past
    const slotDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (slotDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add availability for past dates.'
      });
    }

    // Check for overlapping slots
    const overlappingSlot = await Availability.checkOverlap(tutorId, date, startTime, endTime);
    if (overlappingSlot) {
      return res.status(400).json({
        success: false,
        message: 'This time slot overlaps with an existing availability slot.'
      });
    }

    // Validate recurring settings
    if (isRecurring) {
      if (!recurringPattern) {
        return res.status(400).json({
          success: false,
          message: 'Recurring pattern is required when isRecurring is true.'
        });
      }
      
      if (!recurringEndDate || new Date(recurringEndDate) <= slotDate) {
        return res.status(400).json({
          success: false,
          message: 'Recurring end date must be after the start date.'
        });
      }
    }

    // Create availability slots
    const slots = [];
    
    if (isRecurring) {
      // Generate recurring slots
      const endDate = new Date(recurringEndDate);
      let currentDate = new Date(slotDate);
      
      while (currentDate <= endDate) {
        const slotData = {
          tutorId,
          date: new Date(currentDate),
          startTime,
          endTime,
          notes,
          isRecurring: true,
          recurringPattern,
          recurringEndDate
        };
        
        // Check overlap for each recurring date
        const overlap = await Availability.checkOverlap(tutorId, currentDate, startTime, endTime);
        if (!overlap) {
          const slot = new Availability(slotData);
          await slot.save();
          slots.push(slot);
        }
        
        // Move to next occurrence
        switch (recurringPattern) {
          case 'daily':
            currentDate.setDate(currentDate.getDate() + 1);
            break;
          case 'weekly':
            currentDate.setDate(currentDate.getDate() + 7);
            break;
          case 'monthly':
            currentDate.setMonth(currentDate.getMonth() + 1);
            break;
        }
      }
    } else {
      // Single slot
      const availability = new Availability({
        tutorId,
        date: slotDate,
        startTime,
        endTime,
        notes
      });
      
      await availability.save();
      slots.push(availability);
    }

    res.status(201).json({
      success: true,
      message: `Successfully added ${slots.length} availability slot(s).`,
      data: {
        slots: slots.map(slot => ({
          _id: slot._id,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: slot.status,
          notes: slot.notes,
          isRecurring: slot.isRecurring,
          timeRange: slot.getTimeRange(),
          formattedDate: slot.getFormattedDate()
        }))
      }
    });
  } catch (error) {
    console.error('Add availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while adding availability.'
    });
  }
};

// Get tutor's availability
const getMyAvailability = async (req, res) => {
  try {
    const tutorId = req.user._id;
    const { startDate, endDate, status } = req.query;

    // Build query
    const query = { tutorId };
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }
    
    if (status) {
      query.status = status;
    }

    // Sort by date and start time
    const availabilities = await Availability.find(query)
      .sort({ date: 1, startTime: 1 })
      .populate('bookingId', 'clientName clientPhone scheduledAt status');

    res.status(200).json({
      success: true,
      data: {
        availabilities: availabilities.map(slot => ({
          _id: slot._id,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: slot.status,
          notes: slot.notes,
          isRecurring: slot.isRecurring,
          recurringPattern: slot.recurringPattern,
          bookingId: slot.bookingId,
          timeRange: slot.getTimeRange(),
          formattedDate: slot.getFormattedDate(),
          isBookable: slot.isBookable()
        })),
        total: availabilities.length
      }
    });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching availability.'
    });
  }
};

// Update availability slot
const updateAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime, endTime, notes, status } = req.body;
    const tutorId = req.user._id;

    // Find the availability slot
    const availability = await Availability.findOne({ _id: id, tutorId });
    if (!availability) {
      return res.status(404).json({
        success: false,
        message: 'Availability slot not found.'
      });
    }

    // Check if slot is already booked
    if (availability.status === 'booked' && status !== 'booked') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify a booked time slot.'
      });
    }

    // Validate date is not in the past if changing date/time
    if (date || startTime || endTime) {
      const slotDate = new Date(date || availability.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (slotDate < today) {
        return res.status(400).json({
          success: false,
          message: 'Cannot update availability to past dates.'
        });
      }
    }

    // Check for overlapping slots if changing time
    if (date || startTime || endTime) {
      const newDate = new Date(date || availability.date);
      const newStartTime = startTime || availability.startTime;
      const newEndTime = endTime || availability.endTime;
      
      const overlappingSlot = await Availability.checkOverlap(
        tutorId, 
        newDate, 
        newStartTime, 
        newEndTime, 
        id
      );
      
      if (overlappingSlot) {
        return res.status(400).json({
          success: false,
          message: 'Updated time slot overlaps with an existing availability slot.'
        });
      }
    }

    // Update fields
    if (date) availability.date = new Date(date);
    if (startTime) availability.startTime = startTime;
    if (endTime) availability.endTime = endTime;
    if (notes !== undefined) availability.notes = notes;
    if (status) availability.status = status;

    await availability.save();

    res.status(200).json({
      success: true,
      message: 'Availability updated successfully.',
      data: {
        availability: {
          _id: availability._id,
          date: availability.date,
          startTime: availability.startTime,
          endTime: availability.endTime,
          status: availability.status,
          notes: availability.notes,
          timeRange: availability.getTimeRange(),
          formattedDate: availability.getFormattedDate(),
          isBookable: availability.isBookable()
        }
      }
    });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating availability.'
    });
  }
};

// Delete availability slot
const deleteAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const tutorId = req.user._id;

    // Find the availability slot
    const availability = await Availability.findOne({ _id: id, tutorId });
    if (!availability) {
      return res.status(404).json({
        success: false,
        message: 'Availability slot not found.'
      });
    }

    // Check if slot is booked
    if (availability.status === 'booked') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a booked time slot.'
      });
    }

    // Delete the slot
    await Availability.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Availability slot deleted successfully.'
    });
  } catch (error) {
    console.error('Delete availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting availability.'
    });
  }
};

// Get availability summary
const getAvailabilitySummary = async (req, res) => {
  try {
    const tutorId = req.user._id;
    const { startDate, endDate } = req.query;

    // Build date range
    const dateQuery = {};
    if (startDate) dateQuery.$gte = new Date(startDate);
    if (endDate) dateQuery.$lte = new Date(endDate);

    // Aggregate availability data
    const summary = await Availability.aggregate([
      {
        $match: {
          tutorId: new mongoose.Types.ObjectId(tutorId),
          ...(Object.keys(dateQuery).length > 0 && { date: dateQuery })
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalHours: {
            $sum: {
              $divide: [
                {
                  $subtract: [
                    {
                      $toInt: { $substr: ['$endTime', 0, 2] }
                    },
                    {
                      $toInt: { $substr: ['$startTime', 0, 2] }
                    }
                  ]
                },
                1
              ]
            }
          }
        }
      }
    ]);

    // Get upcoming availability
    const upcomingSlots = await Availability.find({
      tutorId,
      date: { $gte: new Date() },
      status: 'available'
    })
    .sort({ date: 1, startTime: 1 })
    .limit(5);

    res.status(200).json({
      success: true,
      data: {
        summary,
        upcomingSlots: upcomingSlots.map(slot => ({
          _id: slot._id,
          date: slot.date,
          timeRange: slot.getTimeRange(),
          formattedDate: slot.getFormattedDate()
        }))
      }
    });
  } catch (error) {
    console.error('Get availability summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching availability summary.'
    });
  }
};

// Get all availability (for sales)
const getAllAvailability = async (req, res) => {
  try {
    const { date, tutorId, status = 'available' } = req.query;
    
    // Build query - show available and locked slots for sales
    const query = {
      status: { $in: ['available', 'locked'] }
    };
    
    if (date) {
      const queryDate = new Date(date);
      queryDate.setHours(0, 0, 0, 0);
      queryDate.setDate(queryDate.getDate() + 1); // Add 1 day for timezone handling
      query.date = {
        $gte: new Date(date),
        $lt: queryDate
      };
    }
    
    if (tutorId) {
      query.tutorId = tutorId;
    }
    
    // Find all available and locked slots
    const availabilities = await Availability.find(query)
      .populate('tutorId', 'name email')
      .sort({ date: 1, startTime: 1 });
    
    res.status(200).json({
      success: true,
      message: 'All availability retrieved successfully.',
      data: {
        availabilities: availabilities.map(slot => ({
          _id: slot._id,
          tutorId: slot.tutorId._id,
          tutorName: slot.tutorId.name,
          tutorEmail: slot.tutorId.email,
          date: slot.date,
          formattedDate: slot.getFormattedDate(),
          timeRange: slot.getTimeRange(),
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: slot.status,
          notes: slot.notes,
          isRecurring: slot.isRecurring,
          recurringPattern: slot.recurringPattern,
          isBookable: slot.isBookable(),
          lockedBy: slot.lockedBy,
          lockedAt: slot.lockedAt,
          clientInfo: slot.clientInfo
        }))
      }
    });
  } catch (error) {
    console.error('Get all availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving availability.'
    });
  }
};

// Book a slot (for sales)
const bookSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const { clientName, clientEmail, clientPhone, clientNotes } = req.body;
    const salesRepId = req.user._id;

    // Find the availability slot
    const slot = await Availability.findById(id);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Availability slot not found.'
      });
    }

    // Check if slot is available
    if (slot.status !== 'available' || !slot.isBookable()) {
      return res.status(400).json({
        success: false,
        message: 'This slot is not available for booking.'
      });
    }

    // Auto-lock the slot
    slot.status = 'locked';
    slot.lockedBy = salesRepId;
    slot.lockedAt = new Date();
    slot.clientInfo = {
      name: clientName,
      email: clientEmail,
      phone: clientPhone,
      notes: clientNotes
    };
    await slot.save();

    // Create a booking record
    const Booking = require('../models/Booking');
    const booking = new Booking({
      availabilityId: slot._id,
      tutorId: slot.tutorId,
      salesRepId,
      clientName,
      clientEmail,
      clientPhone,
      clientNotes,
      status: 'pending',
      bookedAt: new Date()
    });
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Slot booked successfully. Waiting for tutor confirmation.',
      data: {
        slot: {
          _id: slot._id,
          date: slot.date,
          timeRange: slot.getTimeRange(),
          status: slot.status
        },
        booking
      }
    });
  } catch (error) {
    console.error('Book slot error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while booking slot.'
    });
  }
};

// Confirm booking (for tutor)
const confirmBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const tutorId = req.user._id;

    // Find the availability slot
    const slot = await Availability.findById(id);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Availability slot not found.'
      });
    }

    // Verify ownership
    if (slot.tutorId.toString() !== tutorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only confirm bookings for your own slots.'
      });
    }

    // Check if slot is locked
    if (slot.status !== 'locked') {
      return res.status(400).json({
        success: false,
        message: 'This slot is not in a locked state.'
      });
    }

    // Confirm the booking
    slot.status = 'booked';
    slot.lockedBy = null;
    slot.lockedAt = null;
    await slot.save();

    // Update booking status
    const Booking = require('../models/Booking');
    await Booking.updateOne(
      { availabilityId: slot._id },
      { status: 'confirmed', confirmedAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: 'Booking confirmed successfully.'
    });
  } catch (error) {
    console.error('Confirm booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while confirming booking.'
    });
  }
};

// Reject booking (for tutor)
const rejectBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const tutorId = req.user._id;

    // Find the availability slot
    const slot = await Availability.findById(id);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Availability slot not found.'
      });
    }

    // Verify ownership
    if (slot.tutorId.toString() !== tutorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only reject bookings for your own slots.'
      });
    }

    // Check if slot is locked
    if (slot.status !== 'locked') {
      return res.status(400).json({
        success: false,
        message: 'This slot is not in a locked state.'
      });
    }

    // Make the slot available again
    slot.status = 'available';
    slot.lockedBy = null;
    slot.lockedAt = null;
    slot.clientInfo = null;
    await slot.save();

    // Update booking status
    const Booking = require('../models/Booking');
    await Booking.updateOne(
      { availabilityId: slot._id },
      { status: 'rejected', rejectedAt: new Date(), rejectionReason: reason }
    );

    res.status(200).json({
      success: true,
      message: 'Booking rejected. Slot is now available again.'
    });
  } catch (error) {
    console.error('Reject booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while rejecting booking.'
    });
  }
};

// Add booking directly (for tutor)
const addBooking = async (req, res) => {
  try {
    const { clientName, clientEmail, clientPhone, clientNotes, date, startTime, endTime } = req.body;
    const tutorId = req.user._id;

    // Validate input
    if (!clientName || !clientEmail || !clientPhone || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided.'
      });
    }

    // Check for time conflicts
    const Booking = require('../models/Booking');
    const conflict = await Booking.checkConflict(tutorId, new Date(date), startTime, endTime);
    
    if (conflict) {
      return res.status(400).json({
        success: false,
        message: 'This time slot conflicts with an existing booking.'
      });
    }

    // Create booking
    const booking = new Booking({
      tutorId,
      salesId: tutorId, // Tutor is both tutor and sales in this case
      clientName,
      clientEmail,
      clientPhone,
      clientNotes,
      scheduledAt: new Date(date),
      startTime,
      endTime,
      duration: calculateDuration(startTime, endTime),
      status: 'confirmed', // Direct tutor bookings are auto-confirmed
      source: 'tutor'
    });

    await booking.save();

    // Create corresponding availability slot if needed
    const availability = new Availability({
      tutorId,
      date: new Date(date),
      startTime,
      endTime,
      status: 'booked',
      notes: clientNotes
    });

    await availability.save();

    res.status(201).json({
      success: true,
      message: 'Booking added successfully.',
      data: {
        booking: booking.getSummary(),
        availability: availability
      }
    });
  } catch (error) {
    console.error('Add booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while adding booking.'
    });
  }
};

// Calculate duration between times
function calculateDuration(startTime, endTime) {
  const start = startTime.split(':');
  const end = endTime.split(':');
  const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
  const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);
  return endMinutes - startMinutes;
}

module.exports = {
  addAvailability,
  getMyAvailability,
  updateAvailability,
  deleteAvailability,
  getAvailabilitySummary,
  getAllAvailability,
  bookSlot,
  confirmBooking,
  rejectBooking,
  addBooking
};
