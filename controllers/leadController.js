const Lead = require('../models/Lead');
const User = require('../models/User');

// Get all leads for sales representative
const getMyLeads = async (req, res) => {
  try {
    const salesRepId = req.user._id;
    const { status, priority, source } = req.query;
    
    // Build query
    const query = { assignedTo: salesRepId };
    
    if (status) {
      query.status = status;
    }
    
    if (priority) {
      query.priority = priority;
    }
    
    if (source) {
      query.source = source;
    }
    
    const leads = await Lead.find(query)
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      message: 'Leads retrieved successfully.',
      data: {
        leads
      }
    });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving leads.'
    });
  }
};

// Create new lead
const createLead = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      source = 'other',
      subject,
      notes,
      preferredDays = [],
      preferredTime = 'flexible',
      priority = 'medium'
    } = req.body;
    
    const salesRepId = req.user._id;
    
    // Validate required fields
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and phone are required.'
      });
    }
    
    // Create lead
    const lead = new Lead({
      name,
      email,
      phone,
      source,
      subject,
      notes,
      preferredDays,
      preferredTime,
      priority,
      assignedTo: salesRepId,
      nextFollowUpAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Follow up tomorrow
    });
    
    await lead.save();
    
    res.status(201).json({
      success: true,
      message: 'Lead created successfully.',
      data: { lead }
    });
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while creating lead.'
    });
  }
};

// Convert lead to booking
const convertLeadToBooking = async (req, res) => {
  try {
    const { leadId, availabilityId, date, startTime, endTime } = req.body;
    const salesRepId = req.user._id;
    
    // Find lead
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found.'
      });
    }
    
    // Check if lead is assigned to this sales rep
    if (lead.assignedTo.toString() !== salesRepId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only convert your own leads.'
      });
    }
    
    // Create booking from lead
    const bookingData = {
      clientName: lead.name,
      clientEmail: lead.email,
      clientPhone: lead.phone,
      clientNotes: lead.notes || `Converted from lead - ${lead.subject}`,
      scheduledAt: new Date(date),
      startTime,
      endTime,
      duration: calculateDuration(startTime, endTime),
      salesId: salesRepId,
      tutorId: null, // Will be set when availability is chosen
      status: 'pending',
      source: 'lead'
    };
    
    const Booking = require('../models/Booking');
    const booking = new Booking(bookingData);
    await booking.save();
    
    // Update lead status
    await lead.convertToBooking(bookingData);
    
    res.status(201).json({
      success: true,
      message: 'Lead converted to booking successfully.',
      data: {
        booking,
        lead
      }
    });
  } catch (error) {
    console.error('Convert lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while converting lead.'
    });
  }
};

// Update lead status
const updateLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, nextFollowUpAt } = req.body;
    const salesRepId = req.user._id;
    
    const lead = await Lead.findOne({ _id: id, assignedTo: salesRepId });
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found.'
      });
    }
    
    // Update lead
    lead.status = status;
    if (notes) lead.followUpNotes = notes;
    if (nextFollowUpAt) lead.nextFollowUpAt = new Date(nextFollowUpAt);
    
    if (status === 'lost' && notes) {
      await lead.markAsLost(notes);
    } else {
      await lead.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Lead updated successfully.',
      data: { lead }
    });
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating lead.'
    });
  }
};

// Get leads needing follow-up
const getNeedingFollowUp = async (req, res) => {
  try {
    const salesRepId = req.user._id;
    const leads = await Lead.getNeedingFollowUp();
    
    // Filter for this sales rep
    const myLeads = leads.filter(lead => 
      lead.assignedTo.toString() === salesRepId.toString()
    );
    
    res.status(200).json({
      success: true,
      message: 'Follow-up leads retrieved successfully.',
      data: {
        leads: myLeads
      }
    });
  } catch (error) {
    console.error('Get follow-up leads error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving follow-up leads.'
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
  getMyLeads,
  createLead,
  convertLeadToBooking,
  updateLeadStatus,
  getNeedingFollowUp
};
