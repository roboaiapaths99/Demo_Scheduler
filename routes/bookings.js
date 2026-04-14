const express = require('express');
const bookingController = require('../controllers/bookingController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All booking routes require authentication
router.use(authenticate);

// Public booking routes (sales and admin)
router.post('/', authorize('sales', 'admin'), bookingController.createBooking);
router.get('/sales', authorize('sales', 'admin'), bookingController.getSalesBookings);
router.get('/tutor', authorize('tutor', 'admin'), bookingController.getTutorBookings);
router.get('/stats', bookingController.getBookingStats);

// Specific booking routes
router.get('/:id', bookingController.getBookingDetails);
router.delete('/:id', bookingController.cancelBooking);

// Tutor confirmation/rejection routes
router.put('/:id/confirm', authorize('tutor', 'admin'), bookingController.confirmBooking);
router.put('/:id/reject', authorize('tutor', 'admin'), bookingController.rejectBooking);

// Sales cancellation route
router.put('/:id/cancel', authorize('sales', 'admin'), bookingController.cancelBookingBySales);

module.exports = router;
