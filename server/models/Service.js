const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Vui lòng nhập tên dịch vụ']
    },
    price: {
        type: Number,
        required: [true, 'Vui lòng nhập giá dịch vụ']
    },
    location: {
        type: String,
        required: [true, 'Vui lòng nhập địa điểm']
    },
    category: {
        type: String,
        enum: ['tour', 'hotel', 'restaurant'],
        required: [true, 'Vui lòng chọn loại dịch vụ']
    },
    status: {
        type: String,
        enum: ['active', 'pending', 'paused'],
        default: 'pending'
    },
    bookings: {
        type: Number,
        default: 0
    },
    rating: {
        type: Number,
        default: 0
    },
    image: {
        type: String,
        default: 'https://via.placeholder.com/600x400?text=No+Image'
    },
    owner: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    legacyId: {
        type: String,
        index: true
    }
}, {
    timestamps: true
});

// Create index for search
serviceSchema.index({ name: 'text', location: 'text' });

module.exports = mongoose.model('Service', serviceSchema);
