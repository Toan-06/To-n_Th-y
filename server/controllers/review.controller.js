const Review = require('../models/Review');
const Service = require('../models/Service');
const { sendResponse } = require('../utils/format');

// @desc    Create review
// @route   POST /api/reviews
// @access  Private (User only)
exports.createReview = async (req, res, next) => {
    try {
        const { serviceId, rating, comment } = req.body;

        const service = await Service.findById(serviceId);
        if (!service) return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại' });

        req.body.user = req.user.id;
        req.body.service = serviceId;

        const review = await Review.create(req.body); // Will trigger recalculation of avg rating in model pre-save

        sendResponse(res, 201, review);
    } catch (err) {
        next(err);
    }
};

// @desc    Get reviews for a service
// @route   GET /api/reviews/:serviceId
// @access  Public
exports.getReviews = async (req, res, next) => {
    try {
        const reviews = await Review.find({ service: req.params.serviceId })
                                    .populate('user', 'name')
                                    .sort('-createdAt');

        res.status(200).json({
            success: true,
            count: reviews.length,
            data: reviews
        });
    } catch (err) {
        next(err);
    }
};
