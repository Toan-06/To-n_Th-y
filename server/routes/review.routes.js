const express = require('express');
const { createReview, getReviews } = require('../controllers/review.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.route('/')
    .post(protect, authorize('user'), createReview);

router.route('/:serviceId')
    .get(getReviews);

module.exports = router;
