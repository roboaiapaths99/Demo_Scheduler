const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
  tutorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tutor ID is required'],
    index: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    index: true
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required'],
    validate: {
      validator: function(time) {
        // Validate HH:MM format
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
      },
      message: 'Start time must be in HH:MM format (24-hour)'
    }
  },
  endTime: {
    type: String,
    required: [true, 'End time is required'],
    validate: {
      validator: function(time) {
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
      },
      message: 'End time must be in HH:MM format (24-hour)'
    }
  },
  status: {
    type: String,
    enum: ['available', 'booked', 'cancelled', 'unavailable', 'locked'],
    default: 'available'
  },
  lockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lockedAt: {
    type: Date,
    default: null
  },
  clientInfo: {
    name: String,
    email: String,
    phone: String,
    notes: String
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null
  },
  notes: {
    type: String,
    maxlength: [200, 'Notes cannot exceed 200 characters'],
    trim: true
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    type: String,
    enum: [null, 'daily', 'weekly', 'monthly'],
    default: null
  },
  recurringEndDate: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient querying
availabilitySchema.index({ tutorId: 1, date: 1, status: 1 });
availabilitySchema.index({ date: 1, status: 1 });

// Update updatedAt on save
availabilitySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Validate that endTime is after startTime
availabilitySchema.pre('save', function(next) {
  if (this.startTime && this.endTime) {
    const start = this.startTime.split(':');
    const end = this.endTime.split(':');
    
    const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
    const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);
    
    if (endMinutes <= startMinutes) {
      return next(new Error('End time must be after start time'));
    }
    
    // Check for minimum slot duration (30 minutes)
    if (endMinutes - startMinutes < 30) {
      return next(new Error('Time slot must be at least 30 minutes long'));
    }
  }
  next();
});

// Static method to check for overlapping slots
availabilitySchema.statics.checkOverlap = async function(tutorId, date, startTime, endTime, excludeId = null) {
  const query = {
    tutorId,
    date: new Date(date),
    status: { $ne: 'cancelled' },
    $or: [
      // New slot starts during existing slot
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
      // New slot ends during existing slot
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
      // New slot completely contains existing slot
      { startTime: { $gte: startTime }, endTime: { $lte: endTime } },
      // Existing slot completely contains new slot
      { startTime: { $lte: startTime }, endTime: { $gte: endTime } }
    ]
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  const overlappingSlot = await this.findOne(query);
  return overlappingSlot;
};

// Instance method to check if slot is bookable
availabilitySchema.methods.isBookable = function() {
  return this.status === 'available' &&
         this.date > new Date() &&
         !this.bookingId &&
         !this.lockedBy;
};

// Instance method to format time range
availabilitySchema.methods.getTimeRange = function() {
  return `${this.startTime} - ${this.endTime}`;
};

// Instance method to get formatted date
availabilitySchema.methods.getFormattedDate = function() {
  return this.date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

module.exports = mongoose.model('Availability', availabilitySchema);
