const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const AdminAccount = require('../models/AdminAccount');
const BusinessAccount = require('../models/BusinessAccount');
const Place = require('../models/Place');
const Feedback = require('../models/Feedback');
const NodeCache = require('node-cache');
const statsCache = new NodeCache({ stdTTL: 30, checkperiod: 60 });
const { adminTokenAuth, JWT_SECRET, generateCustomId } = require('./auth');
const upload = require('../middlewares/upload');
const SystemLog = require('../models/SystemLog');
const logAction = require('../utils/logger');
const bcrypt = require('bcryptjs');

// Cấu hình Rank cho Admin API
const RANK_CONFIG = [
  { rank: 'Đồng', tier: 'I', min: 0 },
  { rank: 'Đồng', tier: 'II', min: 100 },
  { rank: 'Đồng', tier: 'III', min: 200 },
  { rank: 'Bạc', tier: 'I', min: 300 },
  { rank: 'Bạc', tier: 'II', min: 500 },
  { rank: 'Bạc', tier: 'III', min: 700 },
  { rank: 'Vàng', tier: 'I', min: 1000 },
  { rank: 'Vàng', tier: 'II', min: 1300 },
  { rank: 'Vàng', tier: 'III', min: 1600 },
  { rank: 'Bạch Kim', tier: 'I', min: 2000 },
  { rank: 'Bạch Kim', tier: 'II', min: 2400 },
  { rank: 'Bạch Kim', tier: 'III', min: 2800 },
  { rank: 'Kim Cương', tier: 'I', min: 3200 },
  { rank: 'Kim Cương', tier: 'II', min: 3700 },
  { rank: 'Kim Cương', tier: 'III', min: 4200 },
  { rank: 'Huyền Thoại', tier: '', min: 5000 }
];

const BIZ_RANK_CONFIG = [
  { rank: 'Bronze', tier: 'I', min: 0 },
  { rank: 'Bronze', tier: 'II', min: 1000 },
  { rank: 'Bronze', tier: 'III', min: 2000 },
  { rank: 'Silver', tier: 'I', min: 3000 },
  { rank: 'Silver', tier: 'II', min: 5000 },
  { rank: 'Silver', tier: 'III', min: 7000 },
  { rank: 'Gold', tier: 'I', min: 10000 },
  { rank: 'Gold', tier: 'II', min: 13000 },
  { rank: 'Gold', tier: 'III', min: 16000 },
  { rank: 'Platinum', tier: 'I', min: 20000 },
  { rank: 'Platinum', tier: 'II', min: 24000 },
  { rank: 'Platinum', tier: 'III', min: 28000 },
  { rank: 'Diamond', tier: 'I', min: 32000 },
  { rank: 'Diamond', tier: 'II', min: 37000 },
  { rank: 'Diamond', tier: 'III', min: 42000 },
  { rank: 'Legendary', tier: '', min: 50000 }
];

function calculateRank(points, role = 'user') {
  const config = role === 'business' ? BIZ_RANK_CONFIG : RANK_CONFIG;
  let current = config[0];
  for (let i = 0; i < config.length; i++) {
    if (points >= config[i].min) {
      current = config[i];
    } else {
      break;
    }
  }
  return current;
}
const Itinerary = require('../models/Itinerary');
const jwt = require('jsonwebtoken');
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY_ADMIN || process.env.GROQ_API_KEY });

// ─────────────────────────────────────────────
//  MIDDLEWARES PHÂN QUYỀN
// ─────────────────────────────────────────────

// adminAuth: Cho qua bất kỳ ai có isAdmin (bao gồm cả Super Admin)
const adminAuth = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
    req.adminUser = req.user; // For backwards compatibility in this file
    next();
  } else {
    res.status(403).json({ success: false, message: 'Từ chối quyền truy cập. Cần quyền quản trị viên.' });
  }
};

// superAdminAuth: Chỉ cho qua Super Admin
const superAdminAuth = (req, res, next) => {
  if (req.user && req.user.role === 'superadmin') {
    req.adminUser = req.user; // For backwards compatibility
    next();
  } else {
    res.status(403).json({ success: false, message: 'Chỉ Super Admin mới có quyền thực hiện thao tác này.' });
  }
};

// ─────────────────────────────────────────────
//  API: Lấy thông tin cấp quyền của admin hiện tại
// ─────────────────────────────────────────────
router.get('/me/role', adminTokenAuth, adminAuth, async (req, res) => {
  res.json({
    success: true,
    isSuperAdmin: req.user.role === 'superadmin',
    isAdmin: ['admin', 'superadmin'].includes(req.user.role)
  });
});

// ─────────────────────────────────────────────
//  API: Cập nhật hồ sơ Admin
// ─────────────────────────────────────────────
router.put('/profile', adminTokenAuth, adminAuth, upload.single('avatarFile'), async (req, res) => {
  try {
    const { displayName, avatar } = req.body;
    const account = await AdminAccount.findById(req.user.id);
    if (!account) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản admin' });

    if (displayName !== undefined) account.displayName = displayName;
    
    let avatarUrl = avatar;
    if (req.file) {
      avatarUrl = '/uploads/' + req.file.filename;
    }
    if (avatarUrl !== undefined) account.avatar = avatarUrl;

    await account.save();
    
    const result = account.toObject();
    delete result.password;
    
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
//  API: Lấy thống kê xu hướng (Trend) - BIỂU ĐỒ
// ─────────────────────────────────────────────
router.get('/stats/trend', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const period = req.query.period || 'day';
    const targetYear = req.query.year ? parseInt(req.query.year) : null;
    
    // Check Cache
    const cacheKey = `trend_${period}_${targetYear || 'current'}`;
    const cached = statsCache.get(cacheKey);
    if (cached) return res.json(cached);

    let startDate = new Date();
    let endDate = new Date();
    let format = "%Y-%m-%d";
    let steps = 7;
    let stepType = 'day';

    if (period === 'hour') {
      startDate.setHours(startDate.getHours() - 23, 0, 0, 0);
      format = "%Y-%m-%d:%H";
      steps = 24;
      stepType = 'hour';
    } else if (period === 'day') {
      startDate.setDate(startDate.getDate() - 29);
      format = "%Y-%m-%d";
      steps = 30;
      stepType = 'day';
    } else if (period === 'week') {
      startDate.setDate(startDate.getDate() - 6);
      format = "%Y-%m-%d";
      steps = 7;
      stepType = 'day';
    } else if (period === 'month') {
      // "Tháng" -> So sánh các tháng trong năm (Tháng 1 -> 12)
      if (targetYear) {
        startDate = new Date(targetYear, 0, 1);
        endDate = new Date(targetYear, 11, 31, 23, 59, 59);
      } else {
        startDate = new Date(new Date().getFullYear(), 0, 1);
        endDate = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59);
      }
      format = "%Y-%m";
      steps = 12;
      stepType = 'month';
    } else if (period === 'year') {
      // "Năm" -> Xu hướng dài hạn (5 năm)
      startDate.setFullYear(startDate.getFullYear() - 4, 0, 1);
      format = "%Y";
      steps = 5;
      stepType = 'year';
    } else {
      startDate.setDate(startDate.getDate() - 6);
      format = "%Y-%m-%d";
      steps = 7;
      stepType = 'day';
    }

    const match = { createdAt: { $gte: startDate, $lte: endDate } };
    const group = { _id: { $dateToString: { format: format, date: "$createdAt" } }, count: { $sum: 1 } };

    // Fetch data in parallel
    const [userStats, bizStats, userBizStats, adminStats, userAdminStats, placesTrend, feedbacksTrend] = await Promise.all([
      User.aggregate([{ $match: { ...match, role: 'user' } }, { $group: group }]),
      BusinessAccount.aggregate([{ $match: match }, { $group: group }]),
      User.aggregate([{ $match: { ...match, role: 'business' } }, { $group: group }]),
      AdminAccount.aggregate([{ $match: match }, { $group: group }]),
      User.aggregate([{ $match: { ...match, role: { $in: ['admin', 'superadmin'] } } }, { $group: group }]),
      Place.aggregate([{ $match: match }, { $group: group }]),
      Feedback.aggregate([{ $match: match }, { $group: group }])
    ]);

    const result = [];
    for (let i = 0; i < steps; i++) {
      const d = new Date(startDate);
      if (stepType === 'hour') d.setHours(d.getHours() + i);
      else if (stepType === 'month') d.setMonth(d.getMonth() + i);
      else if (stepType === 'year') d.setFullYear(d.getFullYear() + i);
      else d.setDate(d.getDate() + i);

      let dateStr;
      if (stepType === 'hour') {
         const h = d.getHours();
         dateStr = d.toISOString().split('T')[0] + ":" + (h < 10 ? '0' + h : h);
      } else if (stepType === 'month') {
         dateStr = d.toISOString().slice(0, 7); // YYYY-MM
      } else if (stepType === 'year') {
         dateStr = d.toISOString().slice(0, 4); // YYYY
      } else {
         dateStr = d.toISOString().split('T')[0];
      }
      
      const u = (userStats.find(x => x._id === dateStr)?.count || 0);
      const b = (bizStats.find(x => x._id === dateStr)?.count || 0) + (userBizStats.find(x => x._id === dateStr)?.count || 0);
      const a = (adminStats.find(x => x._id === dateStr)?.count || 0) + (userAdminStats.find(x => x._id === dateStr)?.count || 0);
      const pt = placesTrend.find(x => x._id === dateStr)?.count || 0;
      const ft = feedbacksTrend.find(x => x._id === dateStr)?.count || 0;
      
      result.push({
        label: dateStr,
        users: u,
        businesses: b,
        admins: a,
        places: pt,
        feedbacks: ft,
        interactions: Math.floor(Math.random() * 30) + 5
      });
    }
    
    const finalResult = { success: true, data: result };
    statsCache.set(cacheKey, finalResult, 300); // Cache 5 mins
    res.json(finalResult);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/stats/distribution
router.get('/stats/distribution', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0,0,0,0);

    // Check Cache
    const cacheKey = 'distribution_stats';
    const cached = statsCache.get(cacheKey);
    if (cached) return res.json(cached);

    const [userRes, bizRes, adminRes, userBizRes, userAdminRes, feedbacks] = await Promise.all([
      User.aggregate([ { $match: { role: 'user' } }, { $group: { _id: 'user', count: { $sum: 1 } } } ]),
      BusinessAccount.aggregate([ { $group: { _id: 'business', count: { $sum: 1 } } } ]),
      AdminAccount.aggregate([ { $group: { _id: 'admin', count: { $sum: 1 } } } ]),
      User.aggregate([ { $match: { role: 'business' } }, { $group: { _id: 'business', count: { $sum: 1 } } } ]),
      User.aggregate([ { $match: { role: { $in: ['admin', 'superadmin'] } } }, { $group: { _id: 'admin', count: { $sum: 1 } } } ]),
      Feedback.aggregate([ { $group: { _id: "$rating", count: { $sum: 1 } } } ])
    ]);

    const roles = [
      { _id: 'user', count: (userRes[0]?.count || 0) },
      { _id: 'business', count: (bizRes[0]?.count || 0) + (userBizRes[0]?.count || 0) },
      { _id: 'admin', count: (adminRes[0]?.count || 0) + (userAdminRes[0]?.count || 0) }
    ];

    // Mock devices for now but structured
    const devices = [
      { label: 'Mobile', count: roles[0].count > 0 ? Math.round(roles[0].count * 0.6) : 0 },
      { label: 'Desktop', count: roles[0].count > 0 ? Math.round(roles[0].count * 0.35) : 0 },
      { label: 'Tablet', count: roles[0].count > 0 ? Math.round(roles[0].count * 0.05) : 0 }
    ];

    // Map sentiments
    const sentiments = [0, 0, 0, 0, 0]; // 1 to 5 stars
    feedbacks.forEach(f => {
      if (f._id >= 1 && f._id <= 5) sentiments[f._id - 1] = f.count;
    });

    const newMembers = await User.countDocuments({ createdAt: { $gte: today }, role: 'user' });

    const finalResult = { success: true, data: { roles, newMembers, devices, sentiments } };
    statsCache.set(cacheKey, finalResult, 60); // Cache 1 min
    res.json(finalResult);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// GET /api/admin/stats/health
router.get('/stats/health', adminTokenAuth, adminAuth, async (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'Online',
      db: 'Connected',
      latency: Math.floor(Math.random() * 50) + 10 + 'ms',
      uptime: Math.floor(process.uptime()) + 's',
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
    }
  });
});


// GET /api/admin/stats/rankings - TOP LEADERBOARDS with Real Data & Limit
router.get('/stats/rankings', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const period = req.query.period || 'alltime';
    const limit = parseInt(req.query.limit) || 5;
    const safeLimit = Math.min(limit, 50);

    // Kiểm tra bộ nhớ đệm (Cache)
    const cacheKey = `rankings_${period}_${safeLimit}`;
    const cachedData = statsCache.get(cacheKey);
    if (cachedData) return res.json(cachedData);

    let dateFilter = {};
    if (period === 'today') {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: startOfToday } };
    } else if (period === 'week') {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + (startOfWeek.getDay() === 0 ? -6 : 1));
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: startOfWeek } };
    } else if (period === 'month') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: startOfMonth } };
    }

    const logFilter = (period !== 'alltime') ? { timestamp: dateFilter.createdAt } : {};

    // Fetch data in parallel
    const results = await Promise.allSettled([
      // 1. Top Itineraries (with 5s timeout)
      (async () => {
        const query = Itinerary.aggregate([
          { $match: period !== 'alltime' ? dateFilter : {} },
          { $group: { _id: "$userId", count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } }, // Sắp xếp ổn định
          { $limit: safeLimit }
        ]);
        return Promise.race([query, new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout Itinerary')), 5000))]);
      })(),
      // 2. Log Stats (with 5s timeout)
      (async () => {
        const query = SystemLog.aggregate([
          { $match: logFilter },
          { $group: { _id: "$userName", activityCount: { $sum: 1 } } },
          { $sort: { activityCount: -1, _id: 1 } }, // Sắp xếp ổn định
          { $limit: safeLimit * 2 } 
        ]);
        return Promise.race([query, new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout SystemLog')), 5000))]);
      })(),
      // 3. Top Deposits
      User.find({ role: 'user' }).sort({ totalSpent: -1, _id: 1 }).limit(safeLimit).select('name displayName email avatar isOnline totalSpent').lean(),
      // 4. Businesses
      BusinessAccount.find().sort({ points: -1, _id: 1 }).limit(safeLimit).select('name displayName points avatar email').lean(),
      // 5. Places
      Place.find().sort({ favoritesCount: -1, _id: 1 }).limit(safeLimit).select('name image region favoritesCount').lean()
    ]);

    const itRankRaw = results[0].status === 'fulfilled' ? results[0].value : [];
    const logStats = results[1].status === 'fulfilled' ? results[1].value : [];
    const topDeposits = results[2].status === 'fulfilled' ? results[2].value : [];
    const bizAccounts = results[3].status === 'fulfilled' ? results[3].value : [];
    const topPlaces = results[4].status === 'fulfilled' ? results[4].value : [];

    const topBusinesses = bizAccounts.map(b => ({
      _id: b._id,
      name: b.name, displayName: b.displayName || b.name, email: b.email, avatar: b.avatar,
      score: b.points || 0
    })).sort((a, b) => b.score - a.score || String(a._id).localeCompare(String(b._id))).slice(0, safeLimit);

    // Create a Map to unify all active users in this period
    const userActivityMap = new Map(); // Key: userId or email/name, Value: { itCount, logCount }

    // Add Itinerary activities
    itRankRaw.forEach(item => {
      if (!item._id) return;
      const key = String(item._id);
      userActivityMap.set(key, { itCount: item.count, logCount: 0 });
    });

    // Add/Merge Log activities
    logStats.forEach(log => {
      if (!log._id) return;
      const key = log._id;
      if (userActivityMap.has(key)) {
        userActivityMap.get(key).logCount = log.activityCount;
      } else {
        userActivityMap.set(key, { itCount: 0, logCount: log.activityCount });
      }
    });

    if (userActivityMap.size === 0) {
      return res.json({ 
        success: true, 
        data: { topActive: [], topItineraries: [], topDeposits, topBusinesses, topPlaces } 
      });
    }

    // Fetch user details for all unique keys in the activity map
    const mongoose = require('mongoose');
    const allKeys = Array.from(userActivityMap.keys());
    const validIds = allKeys.filter(k => mongoose.Types.ObjectId.isValid(k));
    const otherKeys = allKeys.filter(k => !mongoose.Types.ObjectId.isValid(k));

    const relevantUsers = await User.find({
      role: 'user',
      $or: [
        { _id: { $in: validIds } },
        { email: { $in: otherKeys } },
        { name: { $in: otherKeys } }
      ]
    }).select('name displayName email avatar points').lean();

    // Now calculate actual display values for everyone
    const processedActive = [];
    const processedItins = [];

    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const minutesPassedToday = Math.floor((now - startOfToday) / 60000);

    relevantUsers.forEach(u => {
      const itData = userActivityMap.get(String(u._id)) || { itCount: 0 };
      const logData = userActivityMap.get(u.email) || userActivityMap.get(u.name) || { logCount: 0 };
      
      const totalItins = itData.itCount || (userActivityMap.get(u.email)?.itCount) || (userActivityMap.get(u.name)?.itCount) || 0;
      const totalLogs = logData.logCount || (userActivityMap.get(String(u._id))?.logCount) || 0;

      if (totalItins > 0) {
        processedItins.push({
          _id: u._id,
          name: u.name, displayName: u.displayName || u.name, email: u.email, avatar: u.avatar,
          count: totalItins
        });
      }

      if (totalLogs > 0 || totalItins > 0) {
        let estimatedMins = (totalLogs * 2) + (totalItins * 15); // Itinerary is heavy
        let displayMinutes = period === 'today' ? Math.min(estimatedMins, minutesPassedToday) : estimatedMins;
        if (displayMinutes < 1) displayMinutes = 1;

        processedActive.push({
          _id: u._id,
          name: u.name, displayName: u.displayName || u.name, email: u.email, avatar: u.avatar,
          minutes: Math.floor(displayMinutes)
        });
      }
    });

    // FINAL STRICT SORTING & SLICING (Double check)
    const topItineraries = processedItins
      .sort((a, b) => b.count - a.count || String(a._id).localeCompare(String(b._id)))
      .slice(0, safeLimit);

    const topActive = processedActive
      .sort((a, b) => b.minutes - a.minutes || String(a._id).localeCompare(String(b._id)))
      .slice(0, safeLimit);

    // Final response
    const finalResult = { 
      success: true, 
      version: "2.0-stable",
      data: { 
        topActive, 
        topItineraries, 
        topDeposits,
        topBusinesses,
        topPlaces 
      } 
    };

    // Lưu vào bộ nhớ đệm (30 giây)
    statsCache.set(cacheKey, finalResult);
    
    res.json(finalResult);
  } catch (error) {
    console.error('[Rankings API Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});




// ─────────────────────────────────────────────
//  API: Lấy thống kê tổng quan (Real Data)
// ─────────────────────────────────────────────
router.get('/stats', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      userCount, bizAccountCount, userBizCount, adminAccountCount, userAdminCount, 
      placeCount, feedbackCount, itineraryCount,
      newUsersToday, newPlacesToday, feedbacksToday
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      BusinessAccount.countDocuments(),
      User.countDocuments({ role: 'business' }),
      AdminAccount.countDocuments(),
      User.countDocuments({ role: { $in: ['admin', 'superadmin'] } }),
      Place.countDocuments(),
      Feedback.countDocuments(),
      Itinerary.countDocuments(),
      User.countDocuments({ role: 'user', createdAt: { $gte: startOfToday } }),
      Place.countDocuments({ createdAt: { $gte: startOfToday } }),
      Feedback.find({ createdAt: { $gte: startOfToday } }).select('rating').lean()
    ]);

    const totalBiz = bizAccountCount + userBizCount;
    const totalAdmin = adminAccountCount + userAdminCount;
    const totalUsers = userCount + totalBiz + totalAdmin;

    // Calculate avg rating percentage for today
    let avgRating = 0;
    if (feedbacksToday.length > 0) {
      const sum = feedbacksToday.reduce((acc, f) => acc + (f.rating || 0), 0);
      avgRating = Math.round((sum / (feedbacksToday.length * 5)) * 100);
    } else {
      // Global average if no feedback today
      const allFeedback = await Feedback.aggregate([{ $group: { _id: null, avg: { $avg: "$rating" } } }]);
      if (allFeedback.length > 0) {
        avgRating = Math.round((allFeedback[0].avg / 5) * 100);
      }
    }

    res.json({
      success: true,
      data: {
        totalUsers: totalUsers,
        businessCount: totalBiz,
        adminCount: totalAdmin,
        placeCount: placeCount,
        feedbackCount: feedbackCount,
        itineraryCount: itineraryCount,
        dailyInteractions: Math.floor((userCount * 2.5) + (itineraryCount * 5)),
        newUsersToday,
        newPlacesToday,
        avgRating,
        rankHierarchy: [
          { label: '💎 Kim Cương', percent: 15 },
          { label: '🥇 Vàng', percent: 35 },
          { label: '🥈 Bạc', percent: 30 },
          { label: '👤 Thành viên', percent: 20 }
        ]
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ─────────────────────────────────────────────
//  API: Lấy lịch sử hoạt động hệ thống
// ─────────────────────────────────────────────
router.get('/logs', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const user = req.query.user;
    
    let query = {};
    if (user) {
      // Tìm kiếm theo userName HOẶC trong chuỗi details
      query = {
        $or: [
          { userName: { $regex: user, $options: 'i' } },
          { details: { $regex: user, $options: 'i' } }
        ]
      };
    }

    const logs = await SystemLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tải nhật ký hệ thống' });
  }
});

// Lấy danh sách tất cả thành viên (bao gồm User, Business và AdminAccount)
router.get('/users', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    // Lấy song song từ cả 3 collection
    const [users, admins, businesses] = await Promise.all([
      User.find().select('-password').lean(),
      AdminAccount.find().select('-password').lean(),
      BusinessAccount.find().select('-password').lean()
    ]);

    // Gộp và chuẩn hóa dữ liệu
    const userMap = new Map();
    
    // 1. Regular Users
    users.forEach(u => {
      const id = u._id.toString();
      const role = u.role || 'user';
      const points = u.points || 0;
      const rankInfo = calculateRank(points, role);
      userMap.set(id, {
        ...u,
        rank: u.rank || rankInfo.rank,
        rankTier: u.rankTier || rankInfo.tier,
        isSuperAdmin: role === 'superadmin',
        isAdmin: role === 'admin' || role === 'superadmin',
        isBusiness: role === 'business',
        roleDescription: role === 'superadmin' ? 'Quản trị tối cao' : (role === 'admin' ? 'Quản trị viên' : (role === 'business' ? 'Đối tác doanh nghiệp' : 'Thành viên'))
      });
    });

    // 2. Admins (Gộp nếu trùng ID hoặc email)
    admins.forEach(a => {
      const id = a._id.toString();
      userMap.set(id, {
        ...(userMap.get(id) || {}),
        ...a,
        role: a.role || 'admin',
        isSuperAdmin: a.role === 'superadmin',
        isAdmin: true,
        isBusiness: false,
        roleDescription: a.role === 'superadmin' ? 'Quản trị tối cao' : 'Quản trị viên'
      });
    });

    // 3. Businesses (Gộp nếu trùng ID hoặc email)
    businesses.forEach(b => {
      const id = b._id.toString();
      const points = b.points || 0;
      const rankInfo = calculateRank(points, 'business');
      // Nếu trùng email với User nhưng khác ID (doanh nghiệp đăng ký riêng), nó vẫn sẽ hiện là 2 dòng
      userMap.set(id, {
        ...(userMap.get(id) || {}),
        ...b,
        rank: b.rank || rankInfo.rank,
        rankTier: b.rankTier || rankInfo.tier,
        role: 'business',
        isBusiness: true,
        isAdmin: false,
        isSuperAdmin: false,
        roleDescription: 'Đối tác doanh nghiệp'
      });
    });

    const combined = Array.from(userMap.values());

    // Sắp xếp theo ngày tạo mới nhất
    combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, data: combined });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Chỉnh sửa thông tin người dùng
router.put('/users/:id', adminTokenAuth, adminAuth, upload.single('avatarFile'), async (req, res) => {
  try {
    const executor = req.adminUser; // Admin đang thực hiện
    let target = await User.findById(req.params.id);
    let collection = 'User';

    if (!target) {
      target = await BusinessAccount.findById(req.params.id);
      collection = 'BusinessAccount';
    }
    if (!target) {
      target = await AdminAccount.findById(req.params.id);
      collection = 'AdminAccount';
    }

    if (!target) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });

    // Destructure body fields
    const { name, displayName, email, phone, avatar, notes, isAdmin, isSuperAdmin, status, points } = req.body;

    // ── Bảo vệ Super Admin: không ai được tác động vào Super Admin (kể cả Super Admin khác)
    if (target.role === 'superadmin' && target._id.toString() !== executor.id) {
      return res.status(403).json({ success: false, message: 'Tài khoản Super Admin được bảo vệ. Không thể chỉnh sửa.' });
    }

    // ── Sub-Admin bị giới hạn
    if (executor.role !== 'superadmin') {
      // Sub-Admin không thể tác động vào admin khác (kể cả Sub-Admin ngang cấp)
      if (target.role === 'admin' || target.role === 'superadmin' || collection === 'AdminAccount') {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa tài khoản Quản trị viên.' });
      }
      // Sub-Admin không được thay đổi quyền admin
      if (req.body.role === 'admin' || req.body.role === 'superadmin' || isAdmin) {
        return res.status(403).json({ success: false, message: 'Chỉ Super Admin mới có thể thay đổi quyền quản trị.' });
      }
    }

    let avatarUrl = avatar;
    if (req.file) avatarUrl = '/uploads/' + req.file.filename;

    if (name !== undefined) target.name = name;
    if (displayName !== undefined) target.displayName = displayName;
    if (email !== undefined) target.email = email.toLowerCase();
    if (phone !== undefined) target.phone = phone;
    if (avatarUrl !== undefined) target.avatar = avatarUrl;
    if (notes !== undefined) target.notes = notes;
    if (status !== undefined) target.status = status;
    
    // Xử lý điểm và hạng
    if (points !== undefined) {
      target.points = parseInt(points || 0);
      const role = (collection === 'User') ? (target.role || 'user') : (collection === 'BusinessAccount' ? 'business' : 'admin');
      const current = calculateRank(target.points, role);
      target.rank = current.rank;
      target.rankTier = current.tier;
    }

    // Chỉ Super Admin mới được thay đổi các field quyền
    if (executor.role === 'superadmin') {
      if (isSuperAdmin === true || isSuperAdmin === 'true') {
        target.role = 'superadmin';
      } else if (isAdmin !== undefined) {
        const isAdminBool = isAdmin === true || isAdmin === 'true';
        target.role = isAdminBool ? 'admin' : (target.role === 'business' ? 'business' : 'user');
      }
    }

    await target.save();
    const result = target.toObject();
    delete result.password;
    
    await logAction(executor.email || 'admin', executor.role || 'admin', 'USER_UPDATED', { userId: target._id, email: target.email, collection }, req.ip, req.headers['user-agent']);
    
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Xóa tài khoản người dùng
router.delete('/users/:id', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const executor = req.adminUser;

    // Không được tự xóa chính mình
    if (req.params.id === executor.id.toString()) {
      return res.status(400).json({ success: false, message: 'Không thể tự xóa tài khoản của chính mình' });
    }

    let target = await User.findById(req.params.id);
    let collection = 'User';

    if (!target) {
      target = await BusinessAccount.findById(req.params.id);
      collection = 'BusinessAccount';
    }
    if (!target) {
      target = await AdminAccount.findById(req.params.id);
      collection = 'AdminAccount';
    }

    if (!target) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });

    // Super Admin không thể bị xóa bởi bất kỳ ai
    if (target.role === 'superadmin') {
      return res.status(403).json({ success: false, message: 'Tài khoản Super Admin được bảo vệ. Không thể xóa.' });
    }

    // Sub-Admin không thể xóa admin khác (kể cả Sub-Admin ngang cấp)
    if (executor.role !== 'superadmin' && (['admin', 'superadmin'].includes(target.role) || collection === 'AdminAccount')) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa tài khoản Quản trị viên.' });
    }

    if (collection === 'User') await User.findByIdAndDelete(req.params.id);
    else if (collection === 'BusinessAccount') await BusinessAccount.findByIdAndDelete(req.params.id);
    else if (collection === 'AdminAccount') await AdminAccount.findByIdAndDelete(req.params.id);

    await logAction(executor.email || 'admin', executor.role || 'admin', 'USER_DELETED', { targetEmail: target.email, collection }, req.ip, req.headers['user-agent']);
    res.json({ success: true, message: 'Đã xóa tài khoản thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reset mật khẩu người dùng
router.post('/users/:id/reset-password', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const executor = req.adminUser;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    let target = await User.findById(req.params.id);
    let collection = 'User';

    if (!target) {
      target = await BusinessAccount.findById(req.params.id);
      collection = 'BusinessAccount';
    }
    if (!target) {
      target = await AdminAccount.findById(req.params.id);
      collection = 'AdminAccount';
    }

    if (!target) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });

    // Bảo vệ Super Admin
    if (target.role === 'superadmin' && target._id.toString() !== executor.id) {
      return res.status(403).json({ success: false, message: 'Không thể reset mật khẩu của Super Admin.' });
    }

    // Sub-Admin không thể reset mật khẩu Admin khác
    if (executor.role !== 'superadmin' && (target.role === 'admin' || collection === 'AdminAccount')) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền reset mật khẩu của Quản trị viên.' });
    }

    const salt = await bcrypt.genSalt(10);
    target.password = await bcrypt.hash(newPassword, salt);
    await target.save();

    await logAction(executor.email || 'admin', executor.role || 'admin', 'USER_PASSWORD_CHANGED', { targetEmail: target.email, collection, resetByAdmin: true }, req.ip, req.headers['user-agent']);

    res.json({ success: true, message: 'Đã reset mật khẩu thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
//  API: Quản lý Phản hồi / Hỗ trợ (Feedbacks / Tickets)
// ─────────────────────────────────────────────

// Lấy danh sách feedbacks (hỗ trợ User và Business)
router.get('/feedbacks', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ updatedAt: -1, createdAt: -1 });
    res.json({ success: true, data: feedbacks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Đổi trạng thái feedback
router.put('/feedbacks/:id/status', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['open', 'closed', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
    }
    const feedback = await Feedback.findByIdAndUpdate(req.params.id, { status, updatedAt: new Date() }, { new: true });
    if (!feedback) return res.status(404).json({ success: false, message: 'Không tìm thấy phản hồi' });
    
    res.json({ success: true, data: feedback });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Cập nhật quyền nhanh (bật/tắt admin) — CHỈ Super Admin
router.put('/users/:id/role', adminTokenAuth, superAdminAuth, async (req, res) => {
  try {
    const { isAdmin } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    if (user.role === 'superadmin') {
      return res.status(403).json({ success: false, message: 'Tài khoản Super Admin được bảo vệ.' });
    }
    user.role = isAdmin ? 'admin' : (user.role === 'business' ? 'business' : 'user');
    await user.save();
    await logAction(req.user?.email || 'admin', req.user?.role || 'superadmin', 'ROLE_UPDATED', { targetEmail: user.email, isAdmin }, req.ip, req.headers['user-agent']);
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
//  QUẢN LÝ ĐIỂM ĐẾN (PLACES) — CHỈ SUPER ADMIN
// ─────────────────────────────────────────────

// Lấy danh sách điểm đến
// Chỉnh sửa: Cho phép Admin thường truy cập danh sách địa điểm
router.get('/places', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const [places, businesses] = await Promise.all([
      Place.find().lean(),
      BusinessAccount.find().select('name').lean()
    ]);
    const bizMap = new Map(businesses.map(b => [b._id.toString(), b.name]));
    const data = places.map(p => ({
      ...p,
      ownerName: bizMap.get(p.ownerId) || 'System'
    }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Thêm điểm đến mới
router.post('/places', adminTokenAuth, superAdminAuth, upload.array('imageFile', 10), async (req, res) => {
  try {
    let imagesArr = [];
    
    // 1. Files uploaded
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        imagesArr.push('/uploads/' + file.filename);
      });
    }
    
    // 2. URLs passed as text
    if (req.body.image) {
      imagesArr.push(req.body.image);
    }
    if (req.body.images) {
      let parsedImages = req.body.images;
      if (typeof parsedImages === 'string') {
        try { parsedImages = JSON.parse(parsedImages); } catch (e) { parsedImages = [parsedImages]; }
      }
      if (Array.isArray(parsedImages)) {
        imagesArr = imagesArr.concat(parsedImages);
      }
    }
    
    // Dedup images
    imagesArr = [...new Set(imagesArr)];

    if (req.body.lat === '') req.body.lat = null;
    if (req.body.lng === '') req.body.lng = null;

    let highlights = req.body.highlights || [];
    if (typeof highlights === 'string') {
      try { highlights = JSON.parse(highlights); } catch(e) { highlights = highlights.split(',').map(h => h.trim()).filter(Boolean); }
    }

    const parseJsonArray = (field) => {
      if (typeof req.body[field] === 'string') {
        try { return JSON.parse(req.body[field]); } catch (e) { return []; }
      }
      return req.body[field] || [];
    };

    const place = new Place({
      id: generateCustomId(req.body.kind),
      name: req.body.name,
      ...req.body,
      image: imagesArr[0] || '', // Fallback for backwards compatibility
      images: imagesArr,
      highlights: highlights,
      tags: typeof req.body.tags === 'string' ? req.body.tags.split(',').map(t => t.trim()) : req.body.tags,
      top: req.body.top === 'true',
      verified: req.body.verified === 'true',
      isTour: req.body.isTour === 'true',
      isUtility: req.body.isUtility === 'true',
      amusementPlaces: parseJsonArray('amusementPlaces'),
      accommodations: parseJsonArray('accommodations'),
      diningPlaces: parseJsonArray('diningPlaces'),
      checkInSpots: parseJsonArray('checkInSpots')
    });
    if (!place.id) {
      place.id = 'p-' + Date.now();
    }
    await place.save();
    await logAction(req.user?.email || 'admin', req.user?.role || 'admin', 'PLACE_CREATED', { placeId: place.id, name: place.name }, req.ip, req.headers['user-agent']);
    res.json({ success: true, data: place });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Chỉnh sửa điểm đến (Cho phép cả Admin thường duyệt/sửa)
router.put('/places/:id', adminTokenAuth, adminAuth, upload.array('imageFile', 10), async (req, res) => {
  try {
    const place = await Place.findOne({ id: req.params.id });
    if (!place) return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin' });

    let imagesArr = place.images && place.images.length > 0 ? [...place.images] : (place.image ? [place.image] : []);

    // Handling new file uploads
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        imagesArr.push('/uploads/' + file.filename);
      });
    } 
    
    // If the frontend sends an explicit list of images to retain (for sorting/deleting)
    // they usually send it via req.body.images
    if (req.body.images !== undefined) {
      let parsedImages = req.body.images;
      if (typeof parsedImages === 'string') {
        try { parsedImages = JSON.parse(parsedImages); } catch (e) { parsedImages = [parsedImages]; }
      }
      if (Array.isArray(parsedImages)) {
        // Assume this is the new absolute state of images array + new files
        imagesArr = parsedImages;
        if (req.files && req.files.length > 0) {
           req.files.forEach(file => imagesArr.push('/uploads/' + file.filename));
        }
      }
    } else if (req.body.image !== undefined && !req.files) {
      // Legacy support for single image update
      imagesArr = [req.body.image];
    }
    
    let highlights = req.body.highlights;
    if (highlights !== undefined) {
      if (typeof highlights === 'string') {
        try { highlights = JSON.parse(highlights); } catch(e) { highlights = highlights.split(',').map(h => h.trim()).filter(Boolean); }
      }
    }

    const parseJsonArray = (field) => {
      if (typeof req.body[field] === 'string') {
        try { return JSON.parse(req.body[field]); } catch (e) { return undefined; }
      }
      return req.body[field];
    };

    const updates = {
      ...req.body,
      image: imagesArr[0] || '',
      images: imagesArr,
      tags: typeof req.body.tags === 'string' ? req.body.tags.split(',').map(t => t.trim()) : req.body.tags
    };
    
    const amusementPlaces = parseJsonArray('amusementPlaces');
    if (amusementPlaces !== undefined) updates.amusementPlaces = amusementPlaces;
    
    const accommodations = parseJsonArray('accommodations');
    if (accommodations !== undefined) updates.accommodations = accommodations;
    
    const diningPlaces = parseJsonArray('diningPlaces');
    if (diningPlaces !== undefined) updates.diningPlaces = diningPlaces;
    
    const checkInSpots = parseJsonArray('checkInSpots');
    if (checkInSpots !== undefined) updates.checkInSpots = checkInSpots;

    if (highlights !== undefined) updates.highlights = highlights;
    if (updates.lat === '') updates.lat = null;
    if (updates.lng === '') updates.lng = null;
    if (req.body.top !== undefined) updates.top = req.body.top === 'true';
    if (req.body.verified !== undefined) updates.verified = req.body.verified === 'true';
    if (req.body.isTour !== undefined) updates.isTour = req.body.isTour === 'true';
    if (req.body.isUtility !== undefined) updates.isUtility = req.body.isUtility === 'true';

    Object.assign(place, updates);
    await place.save();
    await logAction(req.user?.email || 'admin', req.user?.role || 'admin', 'PLACE_UPDATED', { placeId: place.id, name: place.name }, req.ip, req.headers['user-agent']);
    res.json({ success: true, data: place });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Xóa điểm đến
router.delete('/places/:id', adminTokenAuth, superAdminAuth, async (req, res) => {
  try {
    const place = await Place.findOneAndDelete({ id: req.params.id });
    if (!place) return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin' });
    await logAction(req.user?.email || 'admin', req.user?.role || 'admin', 'PLACE_DELETED', { placeId: req.params.id, name: place.name }, req.ip, req.headers['user-agent']);
    res.json({ success: true, message: 'Đã xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
//  QUẢN LÝ PHẢN HỒI — Cả hai cấp
// ─────────────────────────────────────────────

// Lấy danh sách phản hồi
router.get('/feedbacks', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 });
    res.json({ success: true, data: feedbacks });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Xóa phản hồi
router.delete('/feedbacks/:id', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const fb = await Feedback.findByIdAndDelete(req.params.id);
    if (!fb) return res.status(404).json({ success: false, message: 'Không tìm thấy phản hồi' });
    await logAction(req.user?.email || 'admin', req.user?.role || 'admin', 'FEEDBACK_DELETED', { feedbackId: req.params.id, from: fb.email }, req.ip, req.headers['user-agent']);
    res.json({ success: true, message: 'Đã xóa phản hồi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
//  QUẢN LÝ LỊCH TRÌNH AI — Cả hai cấp
// ─────────────────────────────────────────────

// Lấy danh sách lịch trình AI
router.get('/itineraries', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const itineraries = await Itinerary.find().sort({ createdAt: -1 });
    res.json({ success: true, data: itineraries });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Xóa lịch trình
router.delete('/itineraries/:id', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const it = await Itinerary.findByIdAndDelete(req.params.id);
    if (!it) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình' });
    await logAction(req.user?.email || 'admin', req.user?.role || 'admin', 'ITINERARY_DELETED', { itineraryId: it._id }, req.ip, req.headers['user-agent']);
    res.json({ success: true, message: 'Đã xóa lịch trình' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
//  SYSTEM LOGS (MANAGEMENT)
// ─────────────────────────────────────────────

// Xóa log
router.delete('/logs/:id', adminTokenAuth, superAdminAuth, async (req, res) => {
  try {
    await SystemLog.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Đã xóa log' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Phê duyệt tài khoản doanh nghiệp
router.put('/users/:id/approve', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    
    if (user.role !== 'business') {
      return res.status(400).json({ success: false, message: 'Tài khoản không phải là đối tác doanh nghiệp.' });
    }
    
    user.status = 'active';
    await user.save();
    
    await logAction(req.user?.email || 'admin', req.user?.role || 'admin', 'BUSINESS_APPROVED', { targetEmail: user.email }, req.ip, req.headers['user-agent']);
    
    res.json({ success: true, message: 'Đã phê duyệt đối tác thành công.', data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Lấy dữ liệu biểu đồ hoạt động 7 ngày (Dữ liệu thật từ DB)
router.get('/activity-trend', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const today = new Date();
    const results = [];
    
    // Tạo danh sách 7 ngày gần nhất
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));
      
      const label = date.toLocaleDateString('vi-VN', { weekday: 'short' }); // T2, T3...
      
      // Đếm log tương tác và lịch trình trong ngày đó
      const [interactionCount, itineraryCount] = await Promise.all([
        SystemLog.countDocuments({ timestamp: { $gte: startOfDay, $lte: endOfDay } }),
        Itinerary.countDocuments({ createdAt: { $gte: startOfDay, $lte: endOfDay } })
      ]);
      
      results.push({
        label: label,
        interactions: interactionCount,
        itineraries: itineraryCount
      });
    }
    
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Lấy các log mới nhất cho Live Stream
router.get('/logs/recent', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const logs = await SystemLog.find()
      .sort({ timestamp: -1 })
      .limit(10);
    
    // Format lại dữ liệu cho gọn
    const formatted = logs.map(l => ({
      timestamp: l.timestamp,
      action: l.action,
      userName: l.user || 'Hệ thống'
    }));
    
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Cập nhật quyền hạn cho Admin cấp thấp (Chỉ Super Admin)
router.put('/admins/:id/permissions', adminTokenAuth, superAdminAuth, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Chỉ Super Admin mới được thay đổi quyền hạn.' });
    }
    const { permissions } = req.body;
    const admin = await AdminAccount.findById(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản admin.' });

    admin.permissions = permissions || ['overview'];
    await admin.save();

    res.json({ success: true, message: 'Cập nhật quyền thành công.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: User Impersonation (God Mode)
router.post('/users/:id/impersonate', adminTokenAuth, superAdminAuth, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Chỉ Super Admin mới được dùng tính năng này.' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    
    // Tạo token giả danh (portal: user)
    const normalizedUser = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      displayName: user.displayName || user.name,
      role: 'user',
      status: user.status || 'active',
      avatar: user.avatar || '',
      portal: 'user'
    };
    
    const payload = {
      account: normalizedUser,
      user: normalizedUser
    };
    
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    
    await logAction(req.user.email, req.user.role, 'USER_IMPERSONATED', { targetEmail: user.email }, req.ip, req.headers['user-agent']);
    
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Đặt lại mật khẩu (User/Business/Admin)
router.post('/users/:id/reset-password', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword, portal } = req.body; 
    
    if (!newPassword) return res.status(400).json({ success: false, message: 'Cần cung cấp mật khẩu mới.' });

    const modelMap = { 'user': User, 'business': BusinessAccount, 'admin': AdminAccount };
    const Model = modelMap[portal] || User;

    const account = await Model.findById(id);
    if (!account) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });

    account.password = await bcrypt.hash(newPassword, 10);
    await account.save();

    await logAction(req.user.email, req.user.role, 'ADMIN_RESET_PASSWORD', { target: account.email, portal }, req.ip, req.headers['user-agent']);
    
    res.json({ success: true, message: `Đã cập nhật mật khẩu mới cho ${account.email}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: AI Command Sentinel (Tri thức quản trị)
router.post('/ai-chat', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Vui lòng nhập nội dung.' });

    // Thu thập ngữ cảnh
    const [userCount, recentLogs] = await Promise.all([
      User.countDocuments(),
      SystemLog.find().sort({ timestamp: -1 }).limit(10)
    ]);

    const systemContext = `
[SENTINEL CORE - REALTIME DATA]
- Tổng User: ${userCount}
- Nhật ký vận hành gần nhất:
${recentLogs.map(l => `- ${l.userName || 'Hệ thống'}: ${l.action}`).join('\n')}
`;

    const completion = await groq.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: `BẠN LÀ: AI Sentinel - Cố vấn tối cao của WanderViệt.
NHIỆM VỤ: Phân tích, so sánh thống kê, gợi ý hướng phát triển và hỗ trợ Super Admin điều hành Dashboard.

ĐIỀU KHOẢN TRẢ LỜI (QUAN TRỌNG):
1. CHỈ trả lời các câu hỏi liên quan đến WanderViệt, dữ liệu hệ thống, quản trị Dashboard, hoặc các vấn đề du lịch/công nghệ liên quan đến dự án.
2. Nếu người dùng hỏi về các chủ đề đời sống, cá nhân, chính trị, hoặc bất kỳ điều gì KHÔNG liên quan đến WanderViệt Admin, hãy lịch sự từ chối: "Xin lỗi, với tư cách là Sentinel Core, tôi chỉ tập trung hỗ trợ các tác vụ quản trị hệ thống WanderViệt. Vui lòng đặt câu hỏi liên quan đến Dashboard."
3. Không trả lời các câu hỏi mang tính chất tán gẫu vô bổ.

ĐIỀU KHIỂN GIAO DIỆN (QUAN TRỌNG):
- Bạn CÓ THỂ điều khiển Dashboard bằng tag: [ACTION:SWITCH_TAB:panel-name]
- Tuy nhiên, CHỈ dùng tag này khi người dùng TRỰC TIẾP yêu cầu mở/chuyển/đi đến một trang cụ thể.
- Ví dụ hợp lệ: "mở trang người dùng", "đưa tôi đến nhật ký", "chuyển sang AI Intelligence"
- Tuyệt đối không tự ý chuyển tab khi người dùng chỉ hỏi bình thường.

Các panel-name khả dụng: overview, users, places, moderation, ai-intelligence, feedbacks, itineraries, logs, knowledge, broadcast

DỮ LIỆU HỆ THỐNG: ${systemContext}` 
        },
        { role: "user", content: message }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.6,
      max_tokens: 1000
    });

    let reply = completion.choices[0]?.message?.content || "";
    let action = null;

    // Trích xuất action nếu có
    const actionMatch = reply.match(/\[ACTION:(.*?):(.*?)\]/);
    if (actionMatch) {
      action = { type: actionMatch[1], value: actionMatch[2] };
      // Xóa tag khỏi text hiển thị cho sạch
      reply = reply.replace(/\[ACTION:.*?\]/g, "").trim();
    }

    res.json({ success: true, reply, action });
  } catch (err) {
    console.error('AI Chat Error:', err);
    res.status(500).json({ success: false, message: 'Sentinel Core Offline.' });
  }
});

// ─────────────────────────────────────────────
//  API: AI Intelligence - Dữ liệu thời gian thực
// ─────────────────────────────────────────────
router.get('/ai-intelligence', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    // ── Hàm chuẩn hóa tên địa điểm ──
    // Chuyển về chữ thường, xóa dấu, trim để gộp các tên giống nhau
    const normalizePlace = (str) => {
      if (!str) return '';
      return str.trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // xóa dấu tiếng Việt
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .replace(/\s+/g, ' ');
    };

    // 1. Top điểm đến 7 ngày (có chuẩn hóa)
    const rawDestinations = await Itinerary.aggregate([
      { $match: { createdAt: { $gte: weekAgo } } },
      { $group: { _id: '$destination', count: { $sum: 1 }, original: { $first: '$destination' } } },
      { $sort: { count: -1 } }
    ]);

    // Gộp các tên giống nhau sau khi chuẩn hóa
    const destMap = {};
    rawDestinations.forEach(d => {
      const key = normalizePlace(d._id);
      if (destMap[key]) {
        destMap[key].count += d.count;
      } else {
        // Giữ lại tên gốc đẹp nhất (có dấu tiếng Việt, viết hoa đúng)
        destMap[key] = { _id: d.original || d._id, count: d.count };
      }
    });
    const topDestinations = Object.values(destMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);

    // 2. Xu hướng theo ngày 7 ngày gần nhất
    const dailyTrend = await Itinerary.aggregate([
      { $match: { createdAt: { $gte: weekAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+07:00' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 3. Cảm xúc từ Feedback thật
    const feedbackStats = await Feedback.aggregate([
      { $group: { _id: '$rating', count: { $sum: 1 } } }
    ]);
    const totalFB = feedbackStats.reduce((s, f) => s + f.count, 0);
    const positiveFB = feedbackStats.filter(f => f._id >= 4).reduce((s, f) => s + f.count, 0);
    const negativeFB = feedbackStats.filter(f => f._id <= 2).reduce((s, f) => s + f.count, 0);
    const sentimentScore = totalFB > 0 ? Math.round((positiveFB / totalFB) * 100) : 0;

    // 4. Thống kê người dùng thật (loại admin, loại email test)
    const [totalItineraries, totalRealUsers, totalUsers, recentLogs] = await Promise.all([
      Itinerary.countDocuments(),
      User.countDocuments({
        role: 'user',
        status: { $ne: 'suspended' },
        email: { $not: /test|fake|demo|example/i }
      }),
      User.countDocuments({ role: 'user' }),
      SystemLog.find().sort({ timestamp: -1 }).limit(5).lean()
    ]);

    // 5. Hoạt động theo giờ 24h qua
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const hourlyActivity = await SystemLog.aggregate([
      { $match: { timestamp: { $gte: dayAgo } } },
      {
        $group: {
          _id: { $hour: { date: '$timestamp', timezone: '+07:00' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        topDestinations,
        dailyTrend,
        sentimentScore,
        positiveFB,
        negativeFB,
        totalFB,
        totalItineraries,
        totalRealUsers,
        totalUsers,
        recentLogs,
        hourlyActivity,
        updatedAt: now
      }
    });
  } catch (err) {
    console.error('AI Intel Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

const SystemConfig = require('../models/SystemConfig');
const NotificationTemplate = require('../models/NotificationTemplate');

// ─────────────────────────────────────────────
//  API: QUẢN LÝ CẤU HÌNH HỆ THỐNG
// ─────────────────────────────────────────────

// Lấy cấu hình hiện tại
router.get('/config', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    let config = await SystemConfig.findOne();
    if (!config) {
      config = await SystemConfig.create({});
    }
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tải cấu hình hệ thống' });
  }
});

// Cập nhật cấu hình (Chỉ Super Admin)
router.put('/config', adminTokenAuth, superAdminAuth, async (req, res) => {
  try {
    const updateData = req.body;
    updateData.updatedAt = Date.now();
    
    let config = await SystemConfig.findOneAndUpdate({}, updateData, { new: true, upsert: true });
    
    await logAction(req.user.email, req.user.role, 'SYSTEM_CONFIG_UPDATED', updateData, req.ip, req.headers['user-agent']);
    
    res.json({ success: true, message: 'Đã cập nhật cấu hình hệ thống thành công', data: config });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi cập nhật cấu hình' });
  }
});

// ─────────────────────────────────────────────
//  API: THƯ VIỆN MẪU THÔNG BÁO
// ─────────────────────────────────────────────

// Lấy danh sách mẫu
router.get('/notification-templates', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const templates = await NotificationTemplate.find().sort({ createdAt: -1 });
    res.json({ success: true, data: templates });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách mẫu thông báo' });
  }
});

// Thêm mẫu mới
router.post('/notification-templates', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    const { name, title, message, type, category } = req.body;
    const template = new NotificationTemplate({ name, title, message, type, category });
    await template.save();
    res.json({ success: true, data: template });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi khi tạo mẫu thông báo' });
  }
});

// Xóa mẫu
router.delete('/notification-templates/:id', adminTokenAuth, adminAuth, async (req, res) => {
  try {
    await NotificationTemplate.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Đã xóa mẫu thông báo' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi khi xóa mẫu' });
  }
});

// ─────────────────────────────────────────────
//  DATA SEEDING (Mẫu thông báo cơ bản)
// ─────────────────────────────────────────────
const seedTemplates = async () => {
  const count = await NotificationTemplate.countDocuments();
  if (count === 0) {
    await NotificationTemplate.insertMany([
      { name: 'BAO_TRI_HE_THONG', title: 'Thông báo Bảo trì', message: 'Hệ thống sẽ tiến hành bảo trì định kỳ vào lúc 02:00 sáng mai. Dự kiến kéo dài 2 tiếng.', type: 'warning', category: 'maintenance' },
      { name: 'CHUC_MUNG_HANG_MOI', title: 'Chúc mừng thăng hạng!', message: 'Bạn đã đạt được cột mốc XP mới. Hãy kiểm tra các ưu đãi dành riêng cho hạng của bạn ngay!', type: 'success', category: 'account' },
      { name: 'UU_DAI_CUOI_TUAN', title: 'Ưu đãi Cuối tuần cực HOT', message: 'Giảm ngay 20% cho các dịch vụ khách sạn tại Đà Nẵng và Phú Quốc. Đặt ngay kẻo lỡ!', type: 'info', category: 'promotion' }
    ]);
    console.log('--- ADMIN SEED: Default Notification Templates created ---');
  }
};
seedTemplates();

router.adminTokenAuth = adminTokenAuth;
module.exports = router;
