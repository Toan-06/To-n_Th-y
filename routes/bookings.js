const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const Place = require('../models/Place');
const { auth, businessAuth, sharedAuth } = require('./auth');
const User = require('../models/User');

// 1. User: Create a booking (service OR tour)
router.post('/', auth, async (req, res) => {
  try {
    const {
      placeId, useDate, tourDate, peopleCount,
      customerName, customerPhone, customerEmail,
      specialRequests, paymentMethod, bookingType
    } = req.body;

    const place = await Place.findOne({ id: placeId });
    if (!place) return res.status(404).json({ success: false, message: 'Không tìm thấy địa điểm' });
    if (!place.ownerId) return res.status(400).json({ success: false, message: 'Địa điểm này chưa được quản lý bởi doanh nghiệp' });

    const totalPrice = (place.priceFrom || 0) * (peopleCount || 1);
    const type = bookingType || (place.isTour ? 'tour' : 'service');

    const newBooking = new Booking({
      bookingId:      'BK-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      bookingType:    type,
      placeId,
      placeName:      place.name,
      userId:         req.user.id,
      customerName,
      customerEmail:  customerEmail || req.user.email,
      customerPhone,
      useDate:        new Date(useDate || Date.now()),
      tourDate:       tourDate ? new Date(tourDate) : null,
      peopleCount:    peopleCount || 1,
      totalPrice,
      specialRequests: specialRequests || '',
      paymentMethod:  paymentMethod || 'contact',
      paymentStatus:  paymentMethod === 'contact' ? 'unpaid' : 'pending',
      ownerId:        place.ownerId,
      status:         'pending'
    });

    await newBooking.save();

    // Nếu không phải "liên hệ" → tạo transaction pending
    if (paymentMethod && paymentMethod !== 'contact' && totalPrice > 0) {
      const txn = new Transaction({
        transactionId: 'TXN-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
        userId:        req.user.id,
        type:          'tour_booking',
        amount:        totalPrice,
        status:        'pending',
        bookingId:     newBooking.bookingId,
        description:   `Đặt ${type === 'tour' ? 'tour' : 'dịch vụ'}: ${place.name}`,
        placeName:     place.name
      });
      await txn.save();
    }

    res.json({ success: true, data: newBooking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// New unified GET / route for both users and business
router.get('/', sharedAuth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'business') {
      query = { ownerId: req.user.id };
    } else if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      query = {}; // Admins can see all
    } else {
      query = { userId: req.user.id };
    }
    
    // Sort by most recent
    const bookings = await Booking.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tải đơn hàng: ' + err.message });
  }
});

// 2. User: Get my bookings
router.get('/my', auth, async (req, res) => {
  try {
    const { type } = req.query; // ?type=tour hoặc ?type=service
    const query = { userId: req.user.id };
    if (type) query.bookingType = type;
    const bookings = await Booking.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. User: Cancel a booking
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, status: { $in: ['pending', 'confirmed'] } },
      { status: 'cancelled' },
      { new: true }
    );
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hoặc không thể hủy' });
    res.json({ success: true, data: booking, message: 'Đã hủy đặt lịch' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// New unified PUT /:id route for status updates
router.put('/:id', sharedAuth, async (req, res) => {
  try {
    const { status, notes } = req.body;
    let query = { _id: req.params.id };
    
    // If business, ensure they own the booking
    if (req.user.role === 'business') {
      query.ownerId = req.user.id;
    } else if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      // Users can only cancel their own bookings
      query.userId = req.user.id;
      if (status !== 'cancelled') {
        return res.status(403).json({ success: false, message: 'Bạn chỉ có quyền hủy đơn hàng của mình.' });
      }
    }

    const update = {};
    if (status) update.status = status;
    if (notes !== undefined) update.notes = notes;

    const booking = await Booking.findOneAndUpdate(query, update, { new: true });
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng hoặc bạn không có quyền thao tác.' });
    
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi cập nhật đơn hàng: ' + err.message });
  }
});

// 4. Business: Get bookings for my places
router.get('/business', businessAuth, async (req, res) => {
  try {
    const { type, status } = req.query;
    const query = { ownerId: req.user.id };
    if (type) query.bookingType = type;
    if (status) query.status = status;
    const bookings = await Booking.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Business: Update booking status + add notes
router.put('/:id/status', businessAuth, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const update = { status };
    if (notes !== undefined) update.notes = notes;

    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user.id },
      update,
      { new: true }
    );
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hoặc sai quyền' });
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

