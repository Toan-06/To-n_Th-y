const express = require('express');
const { createBooking, getBookings, updateBooking } = require('../controllers/booking.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.route('/')
    .get(protect, getBookings)
    .post(protect, authorize('user'), createBooking);

router.route('/:id')
    .put(protect, authorize('business', 'admin'), updateBooking);

module.exports = router;
