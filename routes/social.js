const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const { auth } = require('./auth');
const Interaction = require('../models/Interaction');
const Notification = require('../models/Notification');
const Place = require('../models/Place');
const BusinessAccount = require('../models/BusinessAccount');
const Post = require('../models/Post');
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const Message = require('../models/Message');
const Group = require('../models/Group');
const Story = require('../models/Story');

// Multer config for media uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, `social_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|mp4|webm/;
  cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
}});

// Helper: resolve customId/string to MongoDB ObjectId
async function resolveUserId(idStr) {
  if (mongoose.Types.ObjectId.isValid(idStr)) return idStr;
  const user = await User.findOne({ $or: [{ customId: idStr }, { id: idStr }] }).select('_id');
  return user ? user._id.toString() : null;
}

// 1. LIKE / FAVORITE một dịch vụ
router.post('/like', auth, async (req, res) => {
  try {
    const { targetId, targetType } = req.body;
    const userId = req.user.id;

    // Kiểm tra xem đã like chưa
    const existing = await Interaction.findOne({ userId, targetId, type: 'like' });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Bạn đã thích mục này rồi.' });
    }

    // Lưu tương tác
    const interaction = new Interaction({
      userId,
      targetId,
      targetType,
      type: 'like'
    });
    await interaction.save();

    // Cập nhật số lượt thích trong model Place (nếu là place/service)
    if (targetType === 'place' || targetType === 'service') {
      const place = await Place.findOne({ 
        $or: [
          { id: targetId },
          { _id: mongoose.Types.ObjectId.isValid(targetId) ? targetId : new mongoose.Types.ObjectId() }
        ]
      });
      if (place) {
        place.favoritesCount = (place.favoritesCount || 0) + 1;
        await place.save();

        // GỬI THÔNG BÁO CHO DOANH NGHIỆP (Nếu có chủ sở hữu)
        if (place.ownerId) {
          const notification = new Notification({
            recipientId: place.ownerId,
            recipientType: 'business',
            senderId: userId,
            senderName: req.user.displayName || req.user.name,
            type: 'like',
            title: 'Lượt thích mới! ❤️',
            message: `${req.user.displayName || req.user.name} đã thích dịch vụ "${place.name}" của bạn.`,
            relatedId: place._id,
            link: `/apps/business-web/dashboard.html?view=service&id=${place._id}`
          });
          await notification.save();
        }
      }
    } else if (targetType === 'post') {
      // XỬ LÝ LIKE CHO BÀI VIẾT (SOCIAL POST)
      const post = await Post.findOne({ 
        _id: mongoose.Types.ObjectId.isValid(targetId) ? targetId : new mongoose.Types.ObjectId()
      });
      if (post) {
        if (!post.likes.includes(userId)) {
          post.likes.push(userId);
          await post.save();
          
          // Thông báo cho chủ bài viết
          if (post.userId.toString() !== userId.toString()) {
            const notification = new Notification({
              recipientId: post.userId,
              recipientType: 'user',
              senderId: userId,
              senderName: req.user.displayName || req.user.name,
              type: 'like',
              title: 'Bài viết của bạn có lượt thích mới! ❤️',
              message: `${req.user.displayName || req.user.name} đã thích bài viết "${post.content.substring(0, 20)}..." của bạn.`,
              relatedId: post._id,
              link: `/apps/user-web/social-hub.html`
            });
            await notification.save();
          }
        }
      }
    }

    res.json({ success: true, message: 'Đã thêm vào yêu thích!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. KHÔNG QUAN TÂM (Hide/Not Interested)
router.post('/not-interested', auth, async (req, res) => {
  try {
    const { targetId, targetType } = req.body;
    const userId = req.user.id;

    const interaction = new Interaction({
      userId,
      targetId,
      targetType,
      type: 'not_interested'
    });
    await interaction.save();

    // AI Insight: Lưu vào bộ nhớ để sau này AI không gợi ý doanh nghiệp này nữa
    // (Phần này sẽ tích hợp sâu hơn vào AI Planner)

    res.json({ success: true, message: 'Đã ghi nhận, chúng tôi sẽ hạn chế gợi ý mục này.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. LẤY DANH SÁCH THÔNG BÁO (Dành cho Doanh nghiệp/Admin/User)
router.get('/notifications', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ 
      recipientId: req.user.id 
    }).sort({ createdAt: -1 }).limit(50);
    
    res.json({ success: true, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. ĐÁNH DẤU ĐÃ ĐỌC THÔNG BÁO
router.post('/notifications/read', auth, async (req, res) => {
  try {
    const { notificationId } = req.body;
    if (notificationId) {
      await Notification.findByIdAndUpdate(notificationId, { isRead: true });
    } else {
      await Notification.updateMany({ recipientId: req.user.id }, { isRead: true });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. ĐĂNG BÀI VIẾT MỚI (Nhật ký)
router.post('/posts', auth, async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    const { content, media, location } = req.body;
    const post = new Post({
      userId: realId, 
      userName: req.user.displayName || req.user.name, 
      userAvatar: req.user.avatar || '',
      content, media: media || [], location: location || null
    });
    await post.save();
    const populatedPost = await Post.findById(post._id).populate('userId', 'name displayName avatar rank rankTier');
    const result = populatedPost.toObject();
    if (populatedPost.userId && typeof populatedPost.userId === 'object') {
        result.userName = populatedPost.userId.displayName || populatedPost.userId.name;
        result.userAvatar = populatedPost.userId.avatar;
    }
    res.json({ success: true, post: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 6. LẤY BẢNG TIN (Feed)
router.get('/feed', auth, async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    if (!realId) return res.json({ success: true, data: [] });
    
    // Lấy danh sách bạn bè
    const friends = await Friendship.find({ $or: [{ requester: realId, status: 'accepted' }, { recipient: realId, status: 'accepted' }] });
    const friendIds = friends.map(f => f.requester.toString() === realId ? f.recipient : f.requester);
    friendIds.push(realId);
    
    // Tìm bài viết từ bạn bè hoặc công khai
    const posts = await Post.find({ 
      $or: [
        { userId: { $in: friendIds } }, 
        { isPublic: true }
      ] 
    })
    .sort({ createdAt: -1 })
    .limit(30)
    .populate('userId', 'name displayName avatar rank rankTier')
    .populate('comments.userId', 'name displayName avatar');
    
    // Map lại data để đảm bảo name/avatar luôn mới nhất từ User model
    const populatedPosts = posts.map(post => {
      const p = post.toObject();
      // Post Author
      if (post.userId && typeof post.userId === 'object') {
        p.userName = post.userId.displayName || post.userId.name;
        p.userAvatar = post.userId.avatar;
      }
      // Comments Authors
      if (p.comments && Array.isArray(p.comments)) {
        p.comments = p.comments.map(c => {
            if (c.userId && typeof c.userId === 'object') {
                c.userName = c.userId.displayName || c.userId.name;
                c.userAvatar = c.userId.avatar;
            }
            return c;
        });
      }
      return p;
    });

    res.json({ success: true, data: populatedPosts });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 7. KẾT BẠN
router.post('/friends/request', auth, async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    const realRecipientId = await resolveUserId(req.body.recipientId);
    if (!realRecipientId) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    if (realId === realRecipientId) return res.status(400).json({ message: 'Không thể kết bạn với chính mình' });
    const existing = await Friendship.findOne({ $or: [{ requester: realId, recipient: realRecipientId }, { requester: realRecipientId, recipient: realId }] });
    if (existing) return res.status(400).json({ message: 'Lời mời đã tồn tại hoặc đã là bạn.' });
    await new Friendship({ requester: realId, recipient: realRecipientId, status: 'pending' }).save();
    await new Notification({ recipientId: realRecipientId, recipientType: 'user', senderId: realId, senderName: req.user.displayName || req.user.name, type: 'system', title: 'Lời mời kết bạn mới! 👋', message: `${req.user.displayName || req.user.name} muốn kết bạn với bạn.`, link: '/apps/user-web/social-hub.html' }).save();
    res.json({ success: true, message: 'Đã gửi lời mời kết bạn!' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 8. BÌNH LUẬN
router.post('/posts/:id/comment', auth, async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    const text = req.body.text || req.body.content;
    if (!text) return res.status(400).json({ message: 'Nội dung bình luận không được để trống' });
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
    const comment = { 
      userId: realId, 
      userName: req.user.displayName || req.user.name, 
      userAvatar: req.user.avatar || '', 
      text, 
      createdAt: new Date() 
    };
    post.comments.push(comment);
    await post.save();
    res.json({ success: true, comment });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 9. DANH SÁCH BẠN BÈ
router.get('/friends', auth, async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    if (!realId) return res.json({ success: true, data: [] });
    const friendships = await Friendship.find({ $or: [{ requester: realId }, { recipient: realId }], status: 'accepted' });
    const friendIds = friendships.map(f => f.requester.toString() === realId ? f.recipient : f.requester);
    const friends = await User.find({ _id: { $in: friendIds } }).select('name displayName avatar rank rankTier points customId').lean();
    res.json({ success: true, data: friends });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 10. LỜI MỜI ĐANG CHỜ
router.get('/friends/pending', auth, async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    if (!realId) return res.json({ success: true, data: [] });
    const pending = await Friendship.find({ recipient: realId, status: 'pending' }).populate('requester', 'name displayName avatar rank points');
    res.json({ success: true, data: pending });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 10b. ĐỀ XUẤT BẠN BÈ
router.get('/friends/suggestions', auth, async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    if (!realId) return res.json({ success: true, data: [] });
    const friendships = await Friendship.find({ $or: [{ requester: realId }, { recipient: realId }] });
    const excludeIds = friendships.map(f => f.requester.toString() === realId ? f.recipient.toString() : f.requester.toString());
    excludeIds.push(realId);
    const excludeObjIds = excludeIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
    const suggestions = await User.find({ _id: { $nin: excludeObjIds }, role: 'user' }).select('name displayName avatar rank rankTier points customId').limit(10).lean();
    res.json({ success: true, data: suggestions });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 11. CHẤP NHẬN/TỪ CHỐI
router.post('/friends/respond', auth, async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    const { friendshipId, action } = req.body;
    const friendship = await Friendship.findById(friendshipId);
    if (!friendship || friendship.recipient.toString() !== realId) return res.status(403).json({ message: 'Thao tác không hợp lệ' });
    if (action === 'accept') { friendship.status = 'accepted'; friendship.updatedAt = new Date(); await friendship.save(); }
    else { await Friendship.findByIdAndDelete(friendshipId); }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 12. UNLIKE
router.post('/unlike', auth, async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    const { targetId, targetType } = req.body;
    await Interaction.deleteOne({ userId: req.user.id, targetId, type: 'like' });
    if (targetType === 'post') await Post.findByIdAndUpdate(targetId, { $pull: { likes: realId } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 13. XÓA BÀI VIẾT
router.delete('/posts/:id', auth, async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Không tìm thấy' });
    if (post.userId.toString() !== realId) return res.status(403).json({ message: 'Không có quyền xóa' });
    await Post.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 14. TÌM KIẾM NGƯỜI DÙNG (tên + ID)
router.get('/users/search', auth, async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    const q = (req.query.q || '').trim();
    if (q.length < 1) return res.json({ success: true, data: [] });
    const users = await User.find({ $or: [{ name: { $regex: q, $options: 'i' } }, { displayName: { $regex: q, $options: 'i' } }, { customId: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }], _id: { $ne: realId } }).select('name displayName avatar rank rankTier points customId').limit(20).lean();
    res.json({ success: true, data: users });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 15. BÀI VIẾT CỦA 1 USER
router.get('/posts/user/:userId', auth, async (req, res) => {
  try {
    const targetId = await resolveUserId(req.params.userId);
    const posts = await Post.find({ userId: targetId || req.params.userId }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: posts });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 16. LẤY 1 BÀI VIẾT
router.get('/posts/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Không tìm thấy' });
    res.json({ success: true, data: post });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 17. ĐĂNG BÀI CÓ MEDIA
router.post('/posts/media', auth, upload.array('media', 5), async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    const media = (req.files || []).map(f => ({ url: `/uploads/${f.filename}`, type: f.mimetype.startsWith('video') ? 'video' : 'image' }));
    const post = new Post({ 
      userId: realId, 
      userName: req.user.displayName || req.user.name, 
      userAvatar: req.user.avatar || '', 
      content: req.body.content || '', 
      media, 
      location: req.body.locationName ? { name: req.body.locationName } : null 
    });
    await post.save();
    const populatedPost = await Post.findById(post._id).populate('userId', 'name displayName avatar rank rankTier');
    const result = populatedPost.toObject();
    if (populatedPost.userId && typeof populatedPost.userId === 'object') {
        result.userName = populatedPost.userId.displayName || populatedPost.userId.name;
        result.userAvatar = populatedPost.userId.avatar;
    }
    res.json({ success: true, post: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 18. CHIA SẺ BÀI VIẾT
router.post('/posts/:id/share', auth, async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    const original = await Post.findById(req.params.id);
    if (!original) return res.status(404).json({ message: 'Không tìm thấy' });
    const shared = new Post({ userId: realId, userName: req.user.displayName || req.user.name, userAvatar: req.user.avatar || '', content: `${req.body.comment || ''}\n\n📎 Chia sẻ từ @${original.userName}: "${original.content.substring(0, 100)}"`, media: original.media, location: original.location, isPublic: true });
    await shared.save();
    res.json({ success: true, post: shared });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 19. HỦY KẾT BẠN
router.post('/friends/unfriend', auth, async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    const friendRealId = await resolveUserId(req.body.friendId);
    await Friendship.deleteOne({ $or: [{ requester: realId, recipient: friendRealId }, { requester: friendRealId, recipient: realId }], status: 'accepted' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 20. TRẠNG THÁI KẾT BẠN
router.get('/friends/status/:userId', auth, async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    const targetRealId = await resolveUserId(req.params.userId);
    if (!targetRealId) return res.json({ success: true, status: 'none' });
    const f = await Friendship.findOne({ $or: [{ requester: realId, recipient: targetRealId }, { requester: targetRealId, recipient: realId }] });
    if (!f) return res.json({ success: true, status: 'none' });
    if (f.status === 'accepted') return res.json({ success: true, status: 'friends' });
    if (f.requester.toString() === realId) return res.json({ success: true, status: 'sent' });
    return res.json({ success: true, status: 'received', friendshipId: f._id });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 21. GỬI TIN NHẮN
router.post('/messages/send', auth, async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    const { recipientId, text } = req.body;
    if (!text || !recipientId) return res.status(400).json({ message: 'Thiếu thông tin' });
    const realRecipientId = await resolveUserId(recipientId);
    const ids = [realId, realRecipientId].sort();
    const conversationId = `dm_${ids[0]}_${ids[1]}`;
    const msg = new Message({ conversationId, senderId: realId, senderName: req.user.displayName || req.user.name, senderAvatar: req.user.avatar || '', text, readBy: [realId] });
    await msg.save();
    res.json({ success: true, message: msg });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 22. LẤY TIN NHẮN
router.get('/messages/:recipientId', auth, async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    const realRecipientId = await resolveUserId(req.params.recipientId);
    const ids = [realId, realRecipientId].sort();
    const conversationId = `dm_${ids[0]}_${ids[1]}`;
    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 }).limit(100);
    res.json({ success: true, data: messages });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 23. DANH SÁCH CUỘC TRÒ CHUYỆN
router.get('/conversations', auth, async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    const convos = await Message.aggregate([{ $match: { conversationId: { $regex: realId } } }, { $sort: { createdAt: -1 } }, { $group: { _id: '$conversationId', lastMessage: { $first: '$text' }, lastTime: { $first: '$createdAt' } } }, { $sort: { lastTime: -1 } }, { $limit: 30 }]);
    const results = await Promise.all(convos.map(async (c) => {
      const parts = c._id.replace('dm_', '').split('_');
      const otherUserId = parts[0] === realId ? parts[1] : parts[0];
      const otherUser = await User.findById(otherUserId).select('name displayName avatar').lean();
      return { ...c, otherUser: otherUser || { name: 'Người dùng' } };
    }));
    res.json({ success: true, data: results });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 24-28. NHÓM
router.post('/groups', auth, async (req, res) => { try { const realId = await resolveUserId(req.user.id); const { name, description, isPublic } = req.body; if (!name) return res.status(400).json({ message: 'Tên nhóm trống' }); const group = new Group({ name, description: description || '', creator: realId, isPublic: isPublic !== false, members: [{ userId: realId, role: 'admin' }] }); await group.save(); res.json({ success: true, group }); } catch (err) { res.status(500).json({ success: false, message: err.message }); } });
router.get('/groups/mine', auth, async (req, res) => { try { const realId = await resolveUserId(req.user.id); const groups = await Group.find({ 'members.userId': realId }).populate('creator', 'name displayName avatar').lean(); res.json({ success: true, data: groups }); } catch (err) { res.status(500).json({ success: false, message: err.message }); } });
router.get('/groups/search', auth, async (req, res) => { try { const groups = await Group.find({ isPublic: true, name: { $regex: req.query.q || '', $options: 'i' } }).limit(20).lean(); res.json({ success: true, data: groups }); } catch (err) { res.status(500).json({ success: false, message: err.message }); } });
router.post('/groups/:id/join', auth, async (req, res) => { try { const realId = await resolveUserId(req.user.id); const group = await Group.findById(req.params.id); if (!group) return res.status(404).json({ message: 'Nhóm không tồn tại' }); if (group.members.find(m => m.userId.toString() === realId)) return res.status(400).json({ message: 'Đã là thành viên' }); group.members.push({ userId: realId, role: 'member' }); await group.save(); res.json({ success: true }); } catch (err) { res.status(500).json({ success: false, message: err.message }); } });
router.post('/groups/:id/leave', auth, async (req, res) => { try { const realId = await resolveUserId(req.user.id); await Group.findByIdAndUpdate(req.params.id, { $pull: { members: { userId: realId } } }); res.json({ success: true }); } catch (err) { res.status(500).json({ success: false, message: err.message }); } });

// 29. XEM HỒ SƠ NGƯỜI DÙNG KHÁC
router.get('/users/:id', auth, async (req, res) => {
  try {
    const targetId = await resolveUserId(req.params.id);
    const user = await User.findById(targetId || req.params.id).select('name displayName avatar rank rankTier points customId notes createdAt lastActive').lean();
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    const postCount = await Post.countDocuments({ userId: user._id });
    const friendCount = await Friendship.countDocuments({ $or: [{ requester: user._id }, { recipient: user._id }], status: 'accepted' });
    res.json({ success: true, data: { ...user, postCount, friendCount } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 30. STORIES ROUTES
router.get('/stories', auth, async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    // Lấy stories của bản thân và bạn bè trong 24h qua
    const friends = await Friendship.find({ $or: [{ requester: realId, status: 'accepted' }, { recipient: realId, status: 'accepted' }] });
    const friendIds = friends.map(f => f.requester.toString() === realId ? f.recipient : f.requester);
    friendIds.push(realId);

    const stories = await Story.find({ 
      userId: { $in: friendIds },
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).populate('userId', 'name displayName avatar').sort({ createdAt: -1 });

    const formattedStories = stories.map(s => {
      const obj = s.toObject();
      if (s.userId && typeof s.userId === 'object') {
        obj.user = {
          _id: s.userId._id,
          name: s.userId.name,
          displayName: s.userId.displayName,
          avatar: s.userId.avatar
        };
      }
      return obj;
    });

    res.json({ success: true, data: formattedStories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/stories', auth, upload.single('media'), async (req, res) => {
  try {
    const realId = await resolveUserId(req.user.id);
    if (!req.file) return res.status(400).json({ success: false, message: 'Vui lòng chọn ảnh hoặc video' });

    const media = {
      url: `/uploads/${req.file.filename}`,
      type: req.file.mimetype.startsWith('video') ? 'video' : 'image'
    };

    const story = new Story({
      userId: realId,
      media: [media]
    });
    await story.save();
    res.json({ success: true, data: story });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 31. REACTION ROUTES
router.post('/posts/:id/reaction', auth, async (req, res) => {
  try {
    const { reaction } = req.body;
    const postId = req.params.id;
    const userId = req.user.id;
    const realUserId = await resolveUserId(userId);

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });

    if (!post.reactions) post.reactions = {};
    post.reactions[realUserId] = reaction;
    
    // Also update legacy likes array if it's a 'like'
    if (reaction === 'like' && !post.likes.includes(realUserId)) {
      post.likes.push(realUserId);
    }

    // Mark modified for Map types in Mongoose
    post.markModified('reactions');
    await post.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/posts/:id/reaction', auth, async (req, res) => {
  try {
    const postId = req.params.id;
    const realUserId = await resolveUserId(req.user.id);

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });

    if (post.reactions && post.reactions[realUserId]) {
      delete post.reactions[realUserId];
      post.markModified('reactions');
    }
    
    post.likes = post.likes.filter(id => id.toString() !== realUserId.toString());
    await post.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
