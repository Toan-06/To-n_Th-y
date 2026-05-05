const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const Broadcast = require('../models/Broadcast');
const { auth, sharedAuth } = require('./auth');
const User = require('../models/User');

// --- Helper for role-restricted middleware ---
const roleAuth = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Quyền truy cập bị từ chối' });
  }
  next();
};

// GET /api/notifications - Get current user notifications
router.get('/', sharedAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const userRole = (req.user && req.user.role ? req.user.role : 'user').toUpperCase();

    const notifications = await Notification.find({
      $or: [
        { recipientId: userId },
        { recipientId: 'ALL' },
        { recipientId: `ROLE_${userRole}` }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(50);
    
    res.json({ success: true, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', sharedAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const userRole = (req.user && req.user.role ? req.user.role : 'user').toUpperCase();

    // Debug log (internal)
    // console.log('Fetching unread for:', { userId, userRole });

    const query = {
      $or: [
        { recipientId: 'ALL' },
        { recipientId: `ROLE_${userRole}` }
      ],
      isRead: false
    };
    
    if (userId) {
      query.$or.push({ recipientId: userId });
    }

    const count = await Notification.countDocuments(query);
    res.json({ success: true, count });
  } catch (err) {
    console.error('Notification unread-count error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      debug: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// PUT /api/notifications/read/:id - Mark as read
router.put('/read/:id', sharedAuth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    
    // Only recipient can mark as read if it was targeted
    if (notification.recipientId.startsWith('ROLE_') || notification.recipientId === 'ALL') {
        // Broadcast notifications might need a separate 'readBy' array in production, 
    } else if (notification.recipientId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    notification.isRead = true;
    await notification.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/notifications/read-all - Mark all as read
router.post('/read-all', sharedAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = (req.user.role || 'user').toUpperCase();
    await Notification.updateMany({
      $or: [
        { recipientId: userId },
        { recipientId: 'ALL' },
        { recipientId: `ROLE_${userRole}` }
      ],
      isRead: false
    }, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/notifications/broadcast - Admin send broadcast
router.post('/broadcast', sharedAuth, roleAuth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { recipientType, title, message, link, type } = req.body;
    
    // recipientType: 'ALL', 'BUSINESS', 'USER', or specific userId
    let finalRecipient = recipientType;
    if (['BUSINESS', 'USER', 'ADMIN'].includes(recipientType)) {
        finalRecipient = `ROLE_${recipientType}`;
    }

    const { isScheduled, scheduledTime } = req.body;

    if (!isScheduled) {
        const notification = new Notification({
            recipientId: finalRecipient,
            senderId: req.user.id,
            title,
            message,
            link,
            type: type || 'broadcast'
        });
        await notification.save();
    }

    // Always save to Broadcast model for Admin history tracking
    const broadcastRecord = new Broadcast({
      title,
      message,
      type: type || 'broadcast',
      recipientType,
      targetId: finalRecipient,
      senderId: req.user.id,
      senderName: req.user.displayName || req.user.name,
      isScheduled: !!isScheduled,
      scheduledTime: isScheduled ? new Date(scheduledTime) : null,
      status: isScheduled ? 'pending' : 'sent'
    });
    await broadcastRecord.save();

    res.json({ success: true, data: broadcastRecord, message: isScheduled ? 'Đã lập lịch gửi thông báo thành công' : 'Đã gửi thông báo thành công' });
  } catch (err) {
    console.error('Broadcast POST Error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// DELETE /api/notifications/history/:id - Cancel/Delete scheduled broadcast
router.delete('/history/:id', sharedAuth, roleAuth(['admin', 'superadmin']), async (req, res) => {
  try {
    const broadcast = await Broadcast.findById(req.params.id);
    if (!broadcast) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    
    // Only allow deleting/cancelling if it's still pending
    if (broadcast.status === 'pending') {
        broadcast.status = 'cancelled';
        await broadcast.save();
        return res.json({ success: true, message: 'Đã hủy lịch gửi thông báo' });
    }
    
    // If it's already sent, we just remove it from history (optional, or just delete)
    await Broadcast.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Đã xóa bản ghi' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/notifications/history - Admin view broadcast history
router.get('/history', sharedAuth, roleAuth(['admin', 'superadmin']), async (req, res) => {
  try {
    const history = await Broadcast.find().sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: history });
  } catch (err) {
    console.error('Broadcast GET History Error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

module.exports = router;
