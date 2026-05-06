const mongoose = require('mongoose');
const chatbotDb = require('./dbChatbot'); // Sử dụng Database Chatbot

const KnowledgeSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  answer: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // ♥ Thông tin người hỏi (để xem trong DB)
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  userName: { type: String, default: 'Khách vãng lai' },
  userEmail: { type: String, default: '' },
  source: { type: String, default: 'admin', enum: ['admin', 'ai_learned'] }
});

// Tạo Text Index trên trường question để hỗ trợ Full-Text Search
KnowledgeSchema.index({ question: 'text' }, { 
  weights: { question: 10 },
  name: 'TextIndex'
});

// Lưu ý: Chúng ta dùng chatbotDb.model thay vì mongoose.model
const Knowledge = chatbotDb.model('Knowledge', KnowledgeSchema);

module.exports = Knowledge;
