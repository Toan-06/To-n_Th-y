const mongoose = require('mongoose');

// Kết nối đến DB dành riêng cho Chatbot
const chatbotUri = (process.env.CHATBOT_MONGODB_URI || "").trim();

if (!chatbotUri) {
  console.warn('⚠️  CHATBOT_MONGODB_URI is not defined in .env! Chatbot features may not work properly.');
}

const chatbotDb = mongoose.createConnection(chatbotUri, {
  // các cấu hình bổ sung nếu cần (tuỳ chọn)
});

chatbotDb.on('connected', () => {
  console.log('✅ Chatbot MongoDB connected');
});

chatbotDb.on('error', (err) => {
  console.error('❌ Chatbot DB connection error:', err);
});

module.exports = chatbotDb;
