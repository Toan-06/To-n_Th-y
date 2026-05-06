const mongoose = require('mongoose');
const chatbotDb = require('./dbChatbot'); 

const ConversationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true }, 
  sessionId: { type: String, required: true, index: true }, // Mã phiên chat riêng biệt
  title: { type: String }, // Tiêu đề phiên chat (không để mặc định để dễ backfill)
  role: { type: String, enum: ['user', 'model'], required: true },
  text: { type: String, required: true, index: true },
  hasProposal: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
  // Trí tuệ tự học (RLHF)
  feedback: { type: String, enum: ['up', 'down', 'none'], default: 'none' },
  feedbackReason: { type: String }
});

// Lưu trữ tối đa 100 tin nhắn gần nhất mỗi người dùng để tối ưu DB (Optional logic)
const Conversation = chatbotDb.model('Conversation', ConversationSchema);

module.exports = Conversation;
