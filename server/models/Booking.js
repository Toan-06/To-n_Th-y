const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    service: {
        type: mongoose.Schema.ObjectId,
        ref: 'Service',
        required: true
    },
    date: {
        type: Date,
        required: [true, 'Vui lòng chọn ngày đặt']
    },
    totalPrice: {
        type: Number,
        required: true
    },
    customerName: String,
    customerPhone: String,
    peopleCount: { type: Number, default: 1 },
    paymentMethod: { type: String, default: 'contact' },
    specialRequests: String,
    bookingType: { type: String, default: 'service' },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'completed', 'cancelled'],
        default: 'pending'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Booking', bookingSchema);
