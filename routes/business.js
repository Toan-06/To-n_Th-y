const express = require('express');
const router = express.Router();
const Place = require('../models/Place');
const Feedback = require('../models/Feedback');
const { businessAuth, generateCustomId } = require('./auth');
const upload = require('../middlewares/upload');
const logAction = require('../utils/logger');
const BusinessAccount = require('../models/BusinessAccount');
const BusinessMessage = require('../models/BusinessMessage');
const { syncBusinessXP } = require('../utils/rankUtils');

const safeParseArray = (req, field, forceObjectArray = false) => {
  let val = req.body[field];
  if (val === null || val === undefined) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    val = val.trim();
    if (!val || val === '[]' || val === 'null' || val === 'undefined') return [];
    
    try {
      const tryJson = val.replace(/'/g, '"');
      const parsed = JSON.parse(tryJson);
      if (Array.isArray(parsed)) {
        if (forceObjectArray) return parsed.filter(item => typeof item === 'object' && item !== null);
        return parsed;
      }
      return [parsed];
    } catch (e) {
      if (forceObjectArray) return [];
      if (val.includes(',')) {
        return val.split(',').map(s => s.trim().replace(/^['"\[]|['"\]]$/g, '')).filter(Boolean);
      }
      return [val.replace(/^['"\[]|['"\]]$/g, '').trim()];
    }
  }
  return forceObjectArray ? [] : [val];
};

// GET /api/business/reviews — feedbacks for this business's places
router.get('/reviews', businessAuth, async (req, res) => {
  try {
    const places = await Place.find({ ownerId: req.user.id }).select('name reviews').lean();
    
    // Flatten reviews and attach place name
    const feedbacks = [];
    places.forEach(p => {
      (p.reviews || []).forEach(r => {
        feedbacks.push({
          ...r,
          placeName: p.name,
          placeId: p._id
        });
      });
    });

    // Sort by date newest
    feedbacks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, data: feedbacks, places });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/business/analytics — time-series data for charts
router.get('/analytics', businessAuth, async (req, res) => {
  try {
    const places = await Place.find({ ownerId: req.user.id }).lean();
    const totalViews = places.reduce((s, p) => s + (p.favoritesCount || 0), 0);
    const totalReviews = places.reduce((s, p) => s + (p.reviewCount || 0), 0);
    const avgRating = places.length
      ? (places.reduce((s, p) => s + parseFloat(p.ratingAvg || 0), 0) / places.length).toFixed(1)
      : null;
    // Build simple 7-day simulated trend from actual totals
    const trend = Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      views: Math.round((totalViews / 7) * (0.7 + Math.random() * 0.6)),
      reviews: Math.round((totalReviews / 7) * (0.7 + Math.random() * 0.6))
    }));
    res.json({ success: true, data: { totalViews, totalReviews, avgRating, totalServices: places.length, places, trend } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Middleware to verify business role
// 1. Get places owned by this specific business
router.get('/places', businessAuth, async (req, res) => {
  try {
    const places = await Place.find({ ownerId: req.user.id });
    res.json({ success: true, data: places });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 1b. Get stats for business dashboard
router.get('/stats', businessAuth, async (req, res) => {
  try {
    const Booking = require('../models/Booking');
    const [places, bookings] = await Promise.all([
      Place.find({ ownerId: req.user.id }),
      Booking.find({ ownerId: req.user.id })
    ]);
    const totalViews = places.reduce((sum, p) => sum + (p.favoritesCount || 0), 0);
    const totalReviews = places.reduce((sum, p) => sum + (p.reviewCount || 0), 0);
    const avgRating = places.length > 0
      ? (places.reduce((sum, p) => sum + parseFloat(p.ratingAvg || 0), 0) / places.length).toFixed(1)
      : null;
    const totalRevenue = bookings
      .filter(b => b.status === 'confirmed' || b.status === 'completed')
      .reduce((s, b) => s + (b.totalPrice || 0), 0);
    res.json({
      success: true,
      data: {
        totalServices: places.length,
        totalViews,
        totalReviews,
        avgRating,
        totalBookings: bookings.length,
        totalRevenue
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Create a new place (with image upload)
router.post('/places', businessAuth, upload.array('imageFile', 10), async (req, res) => {
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
    
    imagesArr = [...new Set(imagesArr)];

    const amenitiesArr = safeParseArray(req, 'amenities');
    const highlightsArr = safeParseArray(req, 'highlights');
    const tagsArr = safeParseArray(req, 'tags');

    const newPlace = new Place({
      id: generateCustomId(req.body.kind),
      name: req.body.name,
      kind: req.body.kind,
      region: req.body.region,
      address: req.body.address,
      description: req.body.description,
      overview: req.body.overview,
      experience: req.body.experience,
      themeColor: req.body.themeColor,
      meta: req.body.meta,
      priceFrom: req.body.priceFrom,
      priceTo: req.body.priceTo,
      openTime: req.body.openTime,
      closeTime: req.body.closeTime,
      openDays: req.body.openDays,
      contactPhone: req.body.contactPhone,
      contactEmail: req.body.contactEmail,
      website: req.body.website,
      videoUrl: req.body.videoUrl, // Thêm dòng này
      lat: req.body.lat,
      lng: req.body.lng,
      id: 'biz-' + Date.now(),
      ownerId: req.user.id,
      image: imagesArr[0] || '',
      images: imagesArr,
      highlights: highlightsArr,
      tags: tagsArr,
      amenities: amenitiesArr,
      top: req.body.top === 'true',
      status: 'pending',
      source: 'partner',
      amusementPlaces: safeParseArray(req, 'amusementPlaces', true),
      accommodations: safeParseArray(req, 'accommodations', true),
      diningPlaces: safeParseArray(req, 'diningPlaces', true),
      checkInSpots: safeParseArray(req, 'checkInSpots', true)
    });

    await newPlace.save();
    await syncBusinessXP(req.user.id);
    await logAction('PLACE_CREATED', `Đã thêm địa điểm: ${newPlace.name}`, req);
    res.json({ success: true, data: newPlace });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Update own place (with optional image upload)
router.put('/places/:id', businessAuth, upload.array('imageFile', 10), async (req, res) => {
  try {
    // Validate required fields
    const requiredFields = ['name', 'kind', 'region', 'address'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }
    
    // Validate kind field
    const validKinds = ['diem-du-lich', 'tien-ich'];
    if (!validKinds.includes(req.body.kind)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid kind. Must be one of: ${validKinds.join(', ')}` 
      });
    }

    const place = await Place.findOne({ id: req.params.id, ownerId: req.user.id });
    if (!place) return res.status(404).json({ success: false, message: 'Không tìm thấy địa điểm hoặc bạn không có quyền sửa.' });

    let imagesArr = place.images && place.images.length > 0 ? [...place.images] : (place.image ? [place.image] : []);

    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        imagesArr.push('/uploads/' + file.filename);
      });
    }

    if (req.body.images !== undefined) {
      let parsedImages = req.body.images;
      if (typeof parsedImages === 'string') {
        try { parsedImages = JSON.parse(parsedImages); } catch (e) { parsedImages = [parsedImages]; }
      }
      if (Array.isArray(parsedImages)) {
        imagesArr = parsedImages;
        if (req.files && req.files.length > 0) {
           req.files.forEach(file => imagesArr.push('/uploads/' + file.filename));
        }
      }
    } else if (req.body.image !== undefined && !req.files) {
      imagesArr = [req.body.image];
    }

    imagesArr = [...new Set(imagesArr.filter(i => Boolean(i)))];

    const updates = {
      name: req.body.name,
      kind: req.body.kind,
      region: req.body.region,
      address: req.body.address,
      description: req.body.description,
      overview: req.body.overview,
      experience: req.body.experience,
      themeColor: req.body.themeColor,
      meta: req.body.meta,
      priceFrom: req.body.priceFrom,
      priceTo: req.body.priceTo,
      openTime: req.body.openTime,
      closeTime: req.body.closeTime,
      openDays: req.body.openDays,
      contactPhone: req.body.contactPhone,
      contactEmail: req.body.contactEmail,
      website: req.body.website,
      lat: req.body.lat,
      lng: req.body.lng,
      image: imagesArr[0] || '',
      images: imagesArr,
      tags: safeParseArray(req, 'tags'),
      amenities: safeParseArray(req, 'amenities'),
      highlights: safeParseArray(req, 'highlights'),
      amusementPlaces: safeParseArray(req, 'amusementPlaces', true),
      accommodations: safeParseArray(req, 'accommodations', true),
      diningPlaces: safeParseArray(req, 'diningPlaces', true),
      checkInSpots: safeParseArray(req, 'checkInSpots', true)
    };
    
    // If a business updates an approved place, it goes back to pending for re-review
    if (req.user.role === 'business') {
      updates.status = 'pending';
    }

    Object.assign(place, updates);
    await place.save();
    await syncBusinessXP(req.user.id);
    await logAction('PLACE_UPDATED', `Đã cập nhật địa điểm: ${place.name}`, req);
    res.json({ success: true, data: place });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Delete own place
router.delete('/places/:id', businessAuth, async (req, res) => {
  try {
    const place = await Place.findOneAndDelete({ id: req.params.id, ownerId: req.user.id });
    if (!place) return res.status(404).json({ success: false, message: 'Không thể xóa (Không tìm thấy hoặc sai quyền).' });
    await syncBusinessXP(req.user.id);
    res.json({ success: true, message: 'Đã xóa thành công.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Get business messages (Inbox)
router.get('/messages', businessAuth, async (req, res) => {
  try {
    // Get all messages for this business
    const messages = await BusinessMessage.find({ businessId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    
    // Group messages by customerId to create "conversations"
    const conversations = [];
    const customerIds = [...new Set(messages.map(m => m.customerId))];
    
    customerIds.forEach(cId => {
      const customerMsgs = messages.filter(m => m.customerId === cId);
      conversations.push({
        customerId: cId,
        customerName: customerMsgs[0].customerName,
        lastMessage: customerMsgs[0].text,
        time: customerMsgs[0].createdAt,
        unreadCount: customerMsgs.filter(m => !m.isRead && m.senderRole === 'customer').length,
        messages: customerMsgs.reverse() // chronological order for detail view
      });
    });

    res.json({ success: true, data: conversations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Send message from business
router.post('/messages', businessAuth, async (req, res) => {
  try {
    const { customerId, text, serviceId, customerName } = req.body;
    
    // Validate required fields
    if (!text || !customerId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: customerId and text are required' 
      });
    }
    
    // Validate text length
    if (text.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message text cannot be empty' 
      });
    }
    
    if (text.length > 1000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message text is too long (max 1000 characters)' 
      });
    }

    const newMessage = new BusinessMessage({
      businessId: req.user.id,
      customerId,
      customerName: customerName || 'Khách hàng',
      senderRole: 'business',
      text,
      serviceId,
      isRead: true // Business's own messages are "read" by them
    });

    await newMessage.save();
    res.json({ success: true, data: newMessage });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Get business leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const topBusinesses = await BusinessAccount.find()
      .sort({ points: -1 })
      .limit(20)
      .select('name displayName points avatar')
      .lean();
    res.json({ success: true, data: topBusinesses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. User → Business chat: GET history
router.get('/:bizId/chat', async (req, res) => {
  try {
    const { auth } = require('./auth');
    // Manual token check (no middleware)
    const token = req.headers['x-auth-token'];
    let userId = null, userName = 'Khách';
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const secret = (process.env.JWT_SECRET || 'wander-viet-secret-key-123').trim();
        const decoded = jwt.verify(token, secret);
        userId = decoded.id; userName = decoded.name || 'Khách';
      } catch(e) {}
    }
    const msgs = await BusinessMessage.find({
      businessId: req.params.bizId,
      ...(userId ? { customerId: userId } : {})
    }).sort({ createdAt: 1 }).lean();
    res.json({ success: true, data: msgs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9. User → Business chat: POST message
router.post('/:bizId/chat', async (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const token = req.headers['x-auth-token'];
    if (!token) return res.status(401).json({ success: false, message: 'Cần đăng nhập' });
    const secret = (process.env.JWT_SECRET || 'wander-viet-secret-key-123').trim();
        const decoded = jwt.verify(token, secret);
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ success: false, message: 'Tin nhắn rỗng' });
    const msg = new BusinessMessage({
      businessId: req.params.bizId,
      customerId: decoded.id,
      customerName: decoded.name || 'Khách',
      senderRole: 'customer',
      text: text.trim(),
      isRead: false
    });
    await msg.save();
    res.json({ success: true, data: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
