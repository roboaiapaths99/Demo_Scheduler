const express = require('express');
const leadController = require('../controllers/leadController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all leads for sales representative
router.get('/', authenticate, authorize('sales', 'admin'), leadController.getMyLeads);

// Create new lead
router.post('/', authenticate, authorize('sales', 'admin'), leadController.createLead);

// Convert lead to booking
router.post('/:id/convert', authenticate, authorize('sales', 'admin'), leadController.convertLeadToBooking);

// Update lead status
router.put('/:id', authenticate, authorize('sales', 'admin'), leadController.updateLeadStatus);

// Get leads needing follow-up
router.get('/follow-up', authenticate, authorize('sales', 'admin'), leadController.getNeedingFollowUp);

module.exports = router;
