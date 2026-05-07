const express = require('express');
const { getDashboardSummary, getActivities, getUserAnalytics } = require('../controllers/dashboard.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/summary', protect, authorize('business', 'admin'), getDashboardSummary);
router.get('/activities', protect, authorize('business', 'admin'), getActivities);
router.get('/user-analytics', protect, authorize('business', 'admin'), getUserAnalytics);

module.exports = router;
