const express = require('express');
const tutorResponseController = require('../controllers/tutorResponseController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Tutor response routes
router.get('/pending', authenticate, authorize('tutor', 'admin'), tutorResponseController.getPendingBookings);
router.post('/:id/accept', authenticate, authorize('tutor', 'admin'), tutorResponseController.acceptBooking);
router.post('/:id/reject', authenticate, authorize('tutor', 'admin'), tutorResponseController.rejectBooking);
router.post('/:id/reschedule', authenticate, authorize('tutor', 'admin'), tutorResponseController.requestReschedule);
router.get('/stats/response', authenticate, authorize('tutor', 'admin'), tutorResponseController.getTutorResponseStats);

// Sales team routes for reschedule requests
router.get('/reschedule-requests', authenticate, authorize('sales', 'admin'), tutorResponseController.getRescheduleRequests);
router.post('/:id/reschedule-response', authenticate, authorize('sales', 'admin'), tutorResponseController.respondToReschedule);

module.exports = router;
