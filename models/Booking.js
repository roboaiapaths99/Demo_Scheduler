const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  tutorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tutor ID is required'],
    index: true
  },
  salesId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sales ID is required'],
    index: true
  },
  availabilityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Availability',
    required: [true, 'Availability ID is required'],
    unique: true,
    index: true
  },
  clientName: {
    type: String,
    required: [true, 'Client name is required'],
    trim: true,
    maxlength: [100, 'Client name cannot exceed 100 characters']
  },
  clientPhone: {
    type: String,
    required: [true, 'Client phone is required'],
    trim: true,
    match: [/^[\d\s\-\+\(\)]+$/, 'Please enter a valid phone number']
  },
  clientEmail: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  clientNotes: {
    type: String,
    maxlength: [500, 'Client notes cannot exceed 500 characters'],
    trim: true
  },
  scheduledAt: {
    type: Date,
    required: [true, 'Scheduled date is required'],
    index: true
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required']
  },
  endTime: {
    type: String,
    required: [true, 'End time is required']
  },
  duration: {
    type: Number,
    required: [true, 'Duration is required']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no-show'],
    default: 'pending',
    index: true
  },
  tutorResponse: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'rescheduled'],
    default: 'pending'
  },
  rescheduleRequest: {
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    requestedAt: Date,
    newDate: Date,
    newStartTime: String,
    newEndTime: String,
    reason: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    }
  },
  cancellationReason: {
    type: String,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: Date,
  completedAt: Date,
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  followUpRequired: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for efficient querying
bookingSchema.index({ tutorId: 1, status: 1 });
bookingSchema.index({ salesId: 1, status: 1 });
bookingSchema.index({ scheduledAt: 1, status: 1 });
bookingSchema.index({ availabilityId: 1 });

// Update updatedAt on save
bookingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Validate that scheduled date is in the future
bookingSchema.pre('save', function(next) {
  if (this.isNew && this.scheduledAt <= new Date()) {
    return next(new Error('Booking must be scheduled for a future date'));
  }
  next();
});

// Virtual for formatted date/time
bookingSchema.virtual('formattedDateTime').get(function() {
  return `${this.scheduledAt.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })} at ${this.startTime} - ${this.endTime}`;
});

// Virtual for time range
bookingSchema.virtual('timeRange').get(function() {
  return `${this.startTime} - ${this.endTime}`;
});

// Static method to check for booking conflicts
bookingSchema.statics.checkConflict = async function(tutorId, scheduledAt, startTime, endTime, excludeId = null) {
  const query = {
    tutorId,
    scheduledAt,
    status: { $nin: ['cancelled'] },
    $or: [
      // New booking starts during existing booking
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
      // New booking ends during existing booking
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
      // New booking completely contains existing booking
      { startTime: { $gte: startTime }, endTime: { $lte: endTime } },
      // Existing booking completely contains new booking
      { startTime: { $lte: startTime }, endTime: { $gte: endTime } }
    ]
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  const conflictingBooking = await this.findOne(query);
  return conflictingBooking;
};

// Instance method to confirm booking
bookingSchema.methods.confirm = async function() {
  this.status = 'confirmed';
  this.tutorResponse = 'accepted';
  return await this.save();
};

// Instance method to cancel booking
bookingSchema.methods.cancel = async function(reason, cancelledBy) {
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledBy = cancelledBy;
  this.cancelledAt = new Date();
  return await this.save();
};

// Instance method to complete booking
bookingSchema.methods.complete = async function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return await this.save();
};

// Instance method to mark as no-show
bookingSchema.methods.markNoShow = async function() {
  this.status = 'no-show';
  return await this.save();
};

// Instance method to request reschedule
bookingSchema.methods.requestReschedule = async function(requestedBy, newDate, newStartTime, newEndTime, reason) {
  this.rescheduleRequest = {
    requestedBy,
    requestedAt: new Date(),
    newDate,
    newStartTime,
    newEndTime,
    reason,
    status: 'pending'
  };
  return await this.save();
};

// Instance method to respond to reschedule request
bookingSchema.methods.respondToReschedule = async function(status) {
  if (this.rescheduleRequest) {
    this.rescheduleRequest.status = status;
    
    if (status === 'approved') {
      // Update the booking with new date/time
      this.scheduledAt = this.rescheduleRequest.newDate;
      this.startTime = this.rescheduleRequest.newStartTime;
      this.endTime = this.rescheduleRequest.newEndTime;
      
      // Recalculate duration
      const start = this.rescheduleRequest.newStartTime.split(':');
      const end = this.rescheduleRequest.newEndTime.split(':');
      const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
      const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);
      this.duration = endMinutes - startMinutes;
    }
  }
  return await this.save();
};

// Instance method to check if booking can be modified
bookingSchema.methods.isModifiable = function() {
  const now = new Date();
  const bookingTime = new Date(this.scheduledAt);
  const timeDiff = bookingTime.getTime() - now.getTime();
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  // Can modify if more than 24 hours away and not cancelled/completed
  return hoursDiff > 24 && !['cancelled', 'completed'].includes(this.status);
};

// Instance method to check if booking is upcoming
bookingSchema.methods.isUpcoming = function() {
  return this.scheduledAt > new Date() && !['cancelled', 'completed'].includes(this.status);
};

// Instance method to get booking summary
bookingSchema.methods.getSummary = function() {
  return {
    _id: this._id,
    clientName: this.clientName,
    formattedDateTime: this.formattedDateTime,
    timeRange: this.timeRange,
    duration: this.duration,
    status: this.status,
    tutorResponse: this.tutorResponse,
    isUpcoming: this.isUpcoming(),
    isModifiable: this.isModifiable()
  };
};

module.exports = mongoose.model('Booking', bookingSchema);
