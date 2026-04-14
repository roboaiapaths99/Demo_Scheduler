const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    // Lead information
    name: {
        type: String,
        required: [true, 'Lead name is required'],
        trim: true,
        maxlength: [100, 'Lead name cannot exceed 100 characters']
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: {
        type: String,
        trim: true,
        match: [/^[\d\s\-\+\(\)]+$/, 'Please enter a valid phone number']
    },
    
    // Lead source
    source: {
        type: String,
        enum: ['website', 'phone', 'email', 'referral', 'social', 'other'],
        default: 'other'
    },
    
    // Lead status
    status: {
        type: String,
        enum: ['new', 'contacted', 'interested', 'qualified', 'converted', 'lost'],
        default: 'new'
    },
    
    // Lead priority
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    
    // Subject/Interest
    subject: {
        type: String,
        trim: true,
        maxlength: [200, 'Subject cannot exceed 200 characters']
    },
    
    // Notes and requirements
    notes: {
        type: String,
        maxlength: [1000, 'Notes cannot exceed 1000 characters'],
        trim: true
    },
    
    // Preferred times
    preferredDays: [{
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    }],
    preferredTime: {
        type: String,
        enum: ['morning', 'afternoon', 'evening', 'flexible']
    },
    
    // Assigned sales representative
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Lead must be assigned to a sales representative']
    },
    
    // Follow-up information
    lastContactedAt: Date,
    nextFollowUpAt: Date,
    followUpNotes: String,
    
    // Conversion information
    convertedAt: Date,
    convertedBookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
    },
    
    // Lost information
    lostReason: String,
    lostAt: Date,
    
    // Tags for categorization
    tags: [{
        type: String,
        trim: true
    }],
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for performance
leadSchema.index({ assignedTo: 1, status: 1 });
leadSchema.index({ status: 1, priority: 1 });
leadSchema.index({ nextFollowUpAt: 1 });

// Static method to get leads needing follow-up
leadSchema.statics.getNeedingFollowUp = function() {
    const now = new Date();
    return this.find({
        status: { $nin: ['converted', 'lost'] },
        $or: [
            { nextFollowUpAt: { $lte: now } },
            { nextFollowUpAt: { $exists: false } }
        ]
    }).populate('assignedTo', 'name email');
};

// Static method to get new leads
leadSchema.statics.getNewLeads = function(salesRepId) {
    return this.find({
        assignedTo: salesRepId,
        status: 'new'
    }).populate('assignedTo', 'name email');
};

// Instance method to convert lead to booking
leadSchema.methods.convertToBooking = async function(bookingData) {
    const Booking = mongoose.model('Booking');
    
    const booking = new Booking({
        ...bookingData,
        leadId: this._id,
        source: 'lead'
    });
    
    await booking.save();
    
    // Update lead status
    this.status = 'converted';
    this.convertedAt = new Date();
    this.convertedBookingId = booking._id;
    
    await this.save();
    
    return booking;
};

// Instance method to update follow-up
leadSchema.methods.updateFollowUp = function(notes, nextFollowUpDate) {
    this.lastContactedAt = new Date();
    this.followUpNotes = notes;
    this.nextFollowUpAt = nextFollowUpDate;
    return this.save();
};

// Instance method to mark as lost
leadSchema.methods.markAsLost = function(reason) {
    this.status = 'lost';
    this.lostReason = reason;
    this.lostAt = new Date();
    return this.save();
};

module.exports = mongoose.model('Lead', leadSchema);
