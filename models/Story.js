const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  user: {
    name: String,
    displayName: String,
    avatar: String
  },
  media: [{
    url: String,
    type: { type: String, enum: ['image', 'video'], default: 'image' }
  }],
  music: {
    name: String,
    author: String,
    url: String
  },
  textOverlay: {
    content: String,
    color: String,
    top: String,
    left: String
  },
  viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), index: { expires: 0 } }, // Auto-delete after 24h
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Story', storySchema);
