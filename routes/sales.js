const express = require('express');
const salesController = require('../controllers/salesController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All sales routes require authentication and sales/admin role
router.use(authenticate);
router.use(authorize('sales', 'admin'));

// Routes
router.get('/slots', salesController.getAvailableSlots);
router.get('/tutors/:tutorId', salesController.getTutorDetails);
router.get('/calendar', salesController.getCalendarView);
router.get('/stats', salesController.getSalesStats);

module.exports = router;
