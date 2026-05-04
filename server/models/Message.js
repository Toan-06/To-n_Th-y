const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    conversation: {
        type: String, // conversationId = "userId_businessId_serviceId" hoặc "userId_businessId"
        required: true,
        index: true
    },
    sender: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    senderRole: {
        type: String,
        enum: ['user', 'business'],
        required: true
    },
    content: {
        type: String,
        required: [true, 'Nội dung tin nhắn không được để trống'],
        maxlength: [1000, 'Tin nhắn tối đa 1000 ký tự']
    },
    serviceId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Service'
    },
    businessId: {
        type: String // ownerId từ legacy DB
    },
    read: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
