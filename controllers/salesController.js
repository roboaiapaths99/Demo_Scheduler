const Availability = require('../models/Availability');
const User = require('../models/User');
const mongoose = require('mongoose');

// Get all available slots for sales team
const getAvailableSlots = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      tutorId, 
      subject, 
      minDuration,
      maxDuration,
      page = 1,
      limit = 50
    } = req.query;

    // Build query
    const query = {
      status: 'available',
      date: { $gte: new Date() } // Only future slots
    };

    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Tutor filter
    if (tutorId) {
      query.tutorId = tutorId;
    }

    // Duration filter (in minutes)
    if (minDuration || maxDuration) {
      query.$expr = {};
      const durationCalc = {
        $subtract: [
          { $toInt: { $substr: ['$endTime', 0, 2] } },
          { $toInt: { $substr: ['$startTime', 0, 2] } }
        ]
      };

      if (minDuration) {
        query.$expr.$gte = [durationCalc, parseInt(minDuration)];
      }
      if (maxDuration) {
        query.$expr.$lte = [durationCalc, parseInt(maxDuration)];
      }
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Get available slots with tutor information
    const slots = await Availability.find(query)
      .populate('tutorId', 'name email')
      .sort({ date: 1, startTime: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Availability.countDocuments(query);

    // Get all active tutors for filter dropdown
    const tutors = await User.find({ 
      role: 'tutor', 
      isActive: true 
    }).select('name email').sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: {
        slots: slots.map(slot => ({
          _id: slot._id,
          tutor: slot.tutorId,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          notes: slot.notes,
          timeRange: slot.getTimeRange(),
          formattedDate: slot.getFormattedDate(),
          duration: this.calculateDuration(slot.startTime, slot.endTime),
          isRecurring: slot.isRecurring
        })),
        tutors,
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
    console.error('Get available slots error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching available slots.'
    });
  }
};

// Get tutor details for sales team
const getTutorDetails = async (req, res) => {
  try {
    const { tutorId } = req.params;

    if (!tutorId) {
      return res.status(400).json({
        success: false,
        message: 'Tutor ID is required.'
      });
    }

    // Get tutor information
    const tutor = await User.findOne({ 
      _id: tutorId, 
      role: 'tutor', 
      isActive: true 
    }).select('-password');

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: 'Tutor not found.'
      });
    }

    // Get tutor's availability statistics
    const stats = await Availability.aggregate([
      {
        $match: {
          tutorId: new mongoose.Types.ObjectId(tutorId),
          date: { $gte: new Date() }
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
                    { $toInt: { $substr: ['$endTime', 0, 2] } },
                    { $toInt: { $substr: ['$startTime', 0, 2] } }
                  ]
                },
                1
              ]
            }
          }
        }
      }
    ]);

    // Get upcoming available slots
    const upcomingSlots = await Availability.find({
      tutorId,
      status: 'available',
      date: { $gte: new Date() }
    })
    .sort({ date: 1, startTime: 1 })
    .limit(10);

    res.status(200).json({
      success: true,
      data: {
        tutor: tutor.getProfile ? tutor.getProfile() : tutor,
        stats,
        upcomingSlots: upcomingSlots.map(slot => ({
          _id: slot._id,
          date: slot.date,
          timeRange: slot.getTimeRange(),
          formattedDate: slot.getFormattedDate()
        }))
      }
    });
  } catch (error) {
    console.error('Get tutor details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching tutor details.'
    });
  }
};

// Get availability calendar view
const getCalendarView = async (req, res) => {
  try {
    const { year, month, tutorId } = req.query;

    // Default to current month
    const currentDate = new Date();
    const targetYear = parseInt(year) || currentDate.getFullYear();
    const targetMonth = parseInt(month) || currentDate.getMonth();

    // Calculate month start and end
    const monthStart = new Date(targetYear, targetMonth, 1);
    const monthEnd = new Date(targetYear, targetMonth + 1, 0);

    // Build query
    const query = {
      status: 'available',
      date: { 
        $gte: monthStart,
        $lte: monthEnd
      }
    };

    if (tutorId) {
      query.tutorId = tutorId;
    }

    // Get slots grouped by date
    const slots = await Availability.find(query)
      .populate('tutorId', 'name')
      .sort({ date: 1, startTime: 1 });

    // Group slots by date
    const calendarData = {};
    slots.forEach(slot => {
      const dateKey = slot.date.toISOString().split('T')[0];
      if (!calendarData[dateKey]) {
        calendarData[dateKey] = {
          date: slot.date,
          slots: [],
          tutorCount: new Set()
        };
      }
      
      calendarData[dateKey].slots.push({
        _id: slot._id,
        tutor: slot.tutorId,
        startTime: slot.startTime,
        endTime: slot.endTime,
        timeRange: slot.getTimeRange()
      });
      
      calendarData[dateKey].tutorCount.add(slot.tutorId._id.toString());
    });

    // Convert Set to count
    Object.keys(calendarData).forEach(dateKey => {
      calendarData[dateKey].tutorCount = calendarData[dateKey].tutorCount.size;
    });

    res.status(200).json({
      success: true,
      data: {
        year: targetYear,
        month: targetMonth,
        calendar: calendarData,
        totalDays: Object.keys(calendarData).length,
        totalSlots: slots.length
      }
    });
  } catch (error) {
    console.error('Get calendar view error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching calendar view.'
    });
  }
};

// Get sales dashboard statistics
const getSalesStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date range
    const dateQuery = {};
    if (startDate) dateQuery.$gte = new Date(startDate);
    if (endDate) dateQuery.$lte = new Date(endDate);

    // Get overall statistics
    const stats = await Availability.aggregate([
      {
        $match: {
          date: { $gte: new Date() },
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
                    { $toInt: { $substr: ['$endTime', 0, 2] } },
                    { $toInt: { $substr: ['$startTime', 0, 2] } }
                  ]
                },
                1
              ]
            }
          }
        }
      }
    ]);

    // Get tutor statistics
    const tutorStats = await Availability.aggregate([
      {
        $match: {
          status: 'available',
          date: { $gte: new Date() },
          ...(Object.keys(dateQuery).length > 0 && { date: dateQuery })
        }
      },
      {
        $group: {
          _id: '$tutorId',
          availableSlots: { $sum: 1 },
          totalHours: {
            $sum: {
              $divide: [
                {
                  $subtract: [
                    { $toInt: { $substr: ['$endTime', 0, 2] } },
                    { $toInt: { $substr: ['$startTime', 0, 2] } }
                  ]
                },
                1
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'tutor'
        }
      },
      {
        $unwind: '$tutor'
      },
      {
        $project: {
          tutorName: '$tutor.name',
          tutorEmail: '$tutor.email',
          availableSlots: 1,
          totalHours: 1
        }
      },
      {
        $sort: { availableSlots: -1 }
      }
    ]);

    // Get daily availability for the next 7 days
    const dailyStats = await Availability.aggregate([
      {
        $match: {
          status: 'available',
          date: { 
            $gte: new Date(),
            $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          slots: { $sum: 1 },
          uniqueTutors: { $addToSet: '$tutorId' }
        }
      },
      {
        $project: {
          date: '$_id',
          slots: 1,
          tutorCount: { $size: '$uniqueTutors' }
        }
      },
      {
        $sort: { date: 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        stats,
        tutorStats,
        dailyStats
      }
    });
  } catch (error) {
    console.error('Get sales stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching sales statistics.'
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
  getAvailableSlots,
  getTutorDetails,
  getCalendarView,
  getSalesStats
};
