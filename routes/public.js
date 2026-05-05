const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Place = require('../models/Place');
const Feedback = require('../models/Feedback');
const BusinessAccount = require('../models/BusinessAccount');

// GET /api/public/stats - Tổng quan hệ thống cho Landing Page
router.get('/stats', async (req, res) => {
  try {
    const [userCount, placeCount, feedbackCount] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Place.countDocuments({ status: 'approved' }),
      Feedback.countDocuments()
    ]);
    
    res.json({
      success: true,
      data: {
        userCount: userCount,
        placeCount: placeCount,
        feedbackCount: feedbackCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/public/reviews - Các đánh giá nổi bật cho slider
router.get('/reviews', async (req, res) => {
  try {
    const reviews = await Feedback.find({ rating: { $gte: 4 } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name message rating createdAt');
      
    res.json({ success: true, data: reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/public/business/:id - Thông tin đối tác doanh nghiệp
router.get('/business/:id', async (req, res) => {
  try {
    const biz = await BusinessAccount.findById(req.params.id).select('name displayName avatar');
    if (!biz) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: biz });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/public/destinations - Lấy danh sách địa điểm nổi bật/mới
router.get('/destinations', async (req, res) => {
  try {
    const { featured, limit } = req.query;
    const query = { status: 'approved' };
    if (featured === 'true') query.isFeatured = true;

    const destinations = await Place.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) || 10)
      .select('name image description rating location category');
      
    res.json({ success: true, data: destinations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
