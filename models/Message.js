const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: String,
  senderAvatar: String,
  text: { type: String, required: true },
  media: [{
    url: String,
    type: { type: String, enum: ['image', 'video'], default: 'image' }
  }],
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  storyRef: {
    id: mongoose.Schema.Types.ObjectId,
    mediaUrl: String
  },
  createdAt: { type: Date, default: Date.now }
});

messageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
