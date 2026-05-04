const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const Feedback = require('../models/Feedback');
const { auth, adminTokenAuth, sharedAuth, verifyPortalToken } = require('./auth');
const flexibleAuth = verifyPortalToken(null);
const jwt = require('jsonwebtoken');
const Notification = require('../models/Notification');
const logAction = require('../utils/logger');
const JWT_SECRET = (process.env.JWT_SECRET || 'wander-viet-secret-key-123').trim();

// Middleware to check user role
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện hành động này.' });
    }
    next();
  };
};

// Optional auth middleware for public submission
const optionalAuth = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token || token === 'null' || token === 'undefined') return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const account = decoded.account || decoded.user || decoded;
    if (account) {
      req.user = {
        id: account.id || account._id || account.customId,
        email: account.email,
        name: account.name || account.displayName,
        role: account.role || account.portal
      };
    }
  } catch (err) {}
  next();
};

// @route   GET /api/feedback/my-feedbacks (Flexible Auth)
router.get('/my-feedbacks', flexibleAuth, async (req, res) => {
  try {
    const email = req.user.email;
    const userId = req.user.id;
    const feedbacks = await Feedback.find({ 
      $or: [ { email: email }, { userId: userId } ] 
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: feedbacks });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy lịch sử phản hồi' });
  }
});

// @route   POST /api/feedback (Public submission with merging)
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { name, email, message, image } = req.body;

    if (!message || !name || !email) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ tên, email và nội dung' });
    }

    // Find existing open thread: prefer userId match, fallback to email
    const query = { status: 'open' };
    if (req.user && req.user.id) {
      query.$or = [{ userId: req.user.id }, { email }];
    } else {
      query.email = email;
    }
    
    let targetFeedback = await Feedback.findOne(query).sort({ createdAt: -1 });

    if (targetFeedback) {
      // Append as reply
      targetFeedback.replies.push({
        senderId: req.user ? req.user.id : null,
        senderName: name,
        senderRole: 'user',
        content: message,
        createdAt: new Date()
      });
      if (req.user) targetFeedback.userId = req.user.id;
      await targetFeedback.save();
    } else {
      // Create new thread
      const feedbackData = {
        name,
        email,
        message,
        image,
        replies: []
      };
      if (req.user) {
        feedbackData.userId = req.user.id;
        feedbackData.role = req.user.role || 'user';
      }
      targetFeedback = await Feedback.create(feedbackData);
    }

    // Notify Admin
    await Notification.create({
      recipientId: 'ROLE_ADMIN',
      recipientType: 'admin',
      senderId: req.user ? req.user.id : null,
      senderName: name,
      type: 'system',
      title: 'Phản hồi mới từ người dùng',
      message: `${name} vừa gửi một phản hồi mới.`,
      link: '#support',
      isRead: false
    });

    await logAction('FEEDBACK_SUBMITTED', `Người dùng ${name} đã gửi một phản hồi mới`, req, { name, email });

    res.status(201).json({ success: true, message: 'Gửi thành công', data: targetFeedback });
  } catch (err) {
    console.error('Feedback Error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi gửi phản hồi' });
  }
});

// @route   PUT /api/feedback/:id/status
router.put('/:id/status', adminTokenAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const feedback = await Feedback.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!feedback) return res.status(404).json({ success: false, message: 'Feedback not found' });
    res.json({ success: true, data: feedback });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/feedback/:id/reply (Admin & Business only)
router.post('/:id/reply', flexibleAuth, async (req, res) => {
  try {
    const { content, image } = req.body;
    if (!content && !image) return res.status(400).json({ success: false, message: 'Nội dung hoặc ảnh không được để trống' });
    
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc hội thoại' });

    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
    const isOwner = (feedback.userId === req.user.id) || (feedback.email === req.user.email);
    const isBusiness = req.user.role === 'business';

    // Restriction: Only Admin or the owning Business can reply. Regular users are DENIED.
    if (!isAdmin && !(isBusiness && isOwner)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền phản hồi hội thoại này.' });
    }

    const reply = {
      senderId: req.user.id,
      senderName: req.user.name || (isAdmin ? 'Quản trị viên' : 'Đối tác'),
      senderRole: isAdmin ? 'admin' : 'business',
      content,
      image,
      createdAt: new Date()
    };

    feedback.replies.push(reply);
    feedback.updatedAt = new Date();
    await feedback.save();

    // Notify logic
    if (isAdmin) {
      // Notify Partner/User
      let recipientId = feedback.userId;
      if (!recipientId && feedback.email) {
        const User = require('../models/User');
        const u = await User.findOne({ email: feedback.email });
        if (u) recipientId = u.customId || u.id || u._id.toString();
      }
      if (recipientId) {
        await Notification.create({
          recipientId,
          recipientType: feedback.role || 'user',
          senderId: req.user.id,
          senderName: req.user.name || 'Quản trị viên',
          type: 'message',
          title: 'Phản hồi mới từ Quản trị viên',
          message: `Admin trả lời: "${content.substring(0, 50)}..."`,
          link: (feedback.role === 'business' ? 'index.html#support' : 'history.html#feedbacks'),
          isRead: false
        });
      }
    } else {
      // Notify Admin (Business replied)
      await Notification.create({
        recipientId: 'ROLE_ADMIN',
        recipientType: 'admin',
        senderId: req.user.id,
        senderName: req.user.name || 'Đối tác',
        type: 'system',
        title: 'Tin nhắn mới từ Đối tác',
        message: `${req.user.name || 'Đối tác'} đã trả lời hỗ trợ.`,
        link: '#support',
        isRead: false
      });
      await logAction('FEEDBACK_REPLY', `Đối tác ${req.user.name} phản hồi hỗ trợ`, req, { feedbackId: req.params.id });
    }

    res.json({ success: true, data: reply });
  } catch (err) {
    console.error('Feedback Reply Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/feedback/:id
router.delete('/:id', adminTokenAuth, checkRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const feedback = await Feedback.findByIdAndDelete(req.params.id);
    if (!feedback) return res.status(404).json({ success: false, message: 'Feedback not found' });
    res.json({ success: true, message: 'Đã xóa hội thoại thành công' });
  } catch (err) {
    console.error('Feedback delete error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
