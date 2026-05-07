const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userName: String,
  userAvatar: String,
  
  content: { type: String, required: false },
  media: [{
    url: String,
    type: { type: String, enum: ['image', 'video', 'audio'], default: 'image' }
  }],
  mediaLayout: { type: String, default: 'grid' },

  
  location: {
    name: String,
    placeId: mongoose.Schema.Types.ObjectId // Nếu gắn thẻ địa điểm du lịch
  },
  
  attachment: {
    type: { type: String, enum: ['itinerary', 'destination', 'none'], default: 'none' },
    refId: mongoose.Schema.Types.ObjectId,
    title: String,
    subtitle: String,
    link: String
  },
  
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    userAvatar: String,
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  
  isPublic: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ isPublic: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
