const express = require('express');
const availabilityController = require('../controllers/availabilityController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Public route for viewing availability (for sales)
router.get('/all', authenticate, availabilityController.getAllAvailability);

// Tutor and admin only routes
router.post('/', authenticate, authorize('tutor', 'admin'), availabilityController.addAvailability);
router.get('/my', authenticate, authorize('tutor', 'admin'), availabilityController.getMyAvailability);
router.get('/summary', authenticate, authorize('tutor', 'admin'), availabilityController.getAvailabilitySummary);
router.put('/:id', authenticate, authorize('tutor', 'admin'), availabilityController.updateAvailability);
router.delete('/:id', authenticate, authorize('tutor', 'admin'), availabilityController.deleteAvailability);

// Booking route (for sales)
router.post('/:id/book', authenticate, authorize('sales', 'admin'), availabilityController.bookSlot);

// Confirm/Reject booking routes (for tutor)
router.post('/:id/confirm', authenticate, authorize('tutor', 'admin'), availabilityController.confirmBooking);
router.post('/:id/reject', authenticate, authorize('tutor', 'admin'), availabilityController.rejectBooking);

// Add booking directly (for tutor)
router.post('/booking', authenticate, authorize('tutor', 'admin'), availabilityController.addBooking);

module.exports = router;
