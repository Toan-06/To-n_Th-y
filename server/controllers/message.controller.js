const Message = require('../models/Message');

// Tạo conversationId duy nhất từ userId + businessId + serviceId (optional)
function makeConversationId(userId, businessId, serviceId) {
    const parts = [String(userId), String(businessId)];
    if (serviceId) parts.push(String(serviceId));
    return parts.join('_');
}

// @desc  Gửi tin nhắn
// @route POST /api/messages
// @access Private
exports.sendMessage = async (req, res, next) => {
    try {
        const { businessId, serviceId, content } = req.body;
        if (!businessId || !content) {
            return res.status(400).json({ success: false, message: 'Thiếu businessId hoặc nội dung' });
        }

        const conversationId = makeConversationId(req.user.id, businessId, serviceId);

        const message = await Message.create({
            conversation: conversationId,
            sender: req.user.id,
            senderRole: req.user.role === 'business' ? 'business' : 'user',
            content,
            serviceId: serviceId || undefined,
            businessId
        });

        res.status(201).json({ success: true, data: message, conversationId });
    } catch (err) {
        next(err);
    }
};

// @desc  Lấy danh sách tin nhắn theo conversationId
// @route GET /api/messages/:conversationId
// @access Private
exports.getMessages = async (req, res, next) => {
    try {
        const messages = await Message
            .find({ conversation: req.params.conversationId })
            .populate('sender', 'name email')
            .sort({ createdAt: 1 });

        res.status(200).json({ success: true, data: messages });
    } catch (err) {
        next(err);
    }
};

// @desc  Lấy danh sách conversation của user hiện tại
// @route GET /api/messages
// @access Private
exports.getConversations = async (req, res, next) => {
    try {
        const userId = String(req.user.id);

        // Tìm tất cả messages liên quan đến user
        const messages = await Message.find({
            conversation: { $regex: `^${userId}_` }
        }).sort({ createdAt: -1 });

        // Nhóm theo conversationId, lấy tin nhắn cuối
        const convMap = {};
        messages.forEach(m => {
            if (!convMap[m.conversation]) {
                convMap[m.conversation] = m;
            }
        });

        res.status(200).json({ success: true, data: Object.values(convMap) });
    } catch (err) {
        next(err);
    }
};
