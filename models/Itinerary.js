const mongoose = require('mongoose');
const plannerDb = require('./dbPlanner'); // Dùng kết nối riêng cho Travel Planner

// Dùng kết nối chung hoặc kết nối riêng tuỳ ý (ở đây dùng mongoose mặc định để Admin dễ truy xuất chung với User)
const itinerarySchema = new mongoose.Schema({
  destination: { type: String, required: true },
  days: { type: Number, required: true },
  budget: { type: String },
  companion: { type: String },
  interests: { type: String },
  tripDate: { type: Date, default: null }, // Ngày khởi hành do người dùng chọn
  planJson: { type: Object, required: true },
  status: { 
    type: String, 
    enum: ['planning', 'completed', 'missed'], 
    default: 'planning' 
  },
  isDeleted: { type: Boolean, default: false },
  isDraft: { type: Boolean, default: false },
  // Nếu hệ thống đang login thì lưu ID user, nếu khách vãng lai thì để trống
  userId: { type: String, default: null },
  userName: { type: String, default: 'Khách vãng lai' }, // ♥ Tên hiển thị trong DB
  userEmail: { type: String, default: '' },              // ♥ Email hiển thị trong DB
  createdAt: { type: Date, default: Date.now }
});

itinerarySchema.index({ userId: 1, createdAt: -1 });

module.exports = plannerDb.model('Itinerary', itinerarySchema);
