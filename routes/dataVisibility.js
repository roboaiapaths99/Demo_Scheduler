const express = require('express');
const dataVisibilityController = require('../controllers/dataVisibilityController');
const { authenticate, authorize, roleBasedDataVisibility } = require('../middleware/rbac');

const router = express.Router();

// All routes require authentication and data visibility checks
router.use(authenticate);
router.use(roleBasedDataVisibility);

/**
 * Sales Routes - Get their bookings and available tutors
 */
router.get('/sales/my-bookings', authorize('sales', 'admin'), dataVisibilityController.getSalesBookingsSummary);
router.get('/sales/available-tutors', authorize('sales', 'admin'), dataVisibilityController.getAvailableTutors);
router.get('/sales/tutor/:tutorId', authorize('sales', 'admin'), dataVisibilityController.getTutorProfile);
router.get('/sales/tutor/:tutorId/availability', authorize('sales', 'admin'), dataVisibilityController.getTutorAvailableSlots);

/**
 * Tutor Routes - Get their bookings and availability
 */
router.get('/tutor/my-bookings', authorize('tutor', 'admin'), dataVisibilityController.getTutorBookingsSummary);
router.get('/tutor/my-availability', authorize('tutor', 'admin'), dataVisibilityController.getTutorAllAvailability);

/**
 * Admin Routes - Can access all data
 */
router.get('/admin/sales/bookings/:salesId', authorize('admin'), dataVisibilityController.getSalesBookingsSummary);
router.get('/admin/tutor/bookings/:tutorId', authorize('admin'), dataVisibilityController.getTutorBookingsSummary);

module.exports = router;
