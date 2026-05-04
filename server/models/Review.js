const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
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
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: [true, 'Vui lòng đánh giá điểm (1-5)']
    },
    comment: {
        type: String,
        required: [true, 'Vui lòng để lại nhận xét']
    }
}, {
    timestamps: true
});

// Prevent user from submitting more than one review per service
reviewSchema.index({ service: 1, user: 1 }, { unique: true });

// Static method to recalculate average rating
reviewSchema.statics.getAverageRating = async function(serviceId) {
    const obj = await this.aggregate([
        { $match: { service: serviceId } },
        { $group: { _id: '$service', averageRating: { $avg: '$rating' } } }
    ]);

    try {
        await this.model('Service').findByIdAndUpdate(serviceId, {
            rating: obj[0] ? Math.round(obj[0].averageRating * 10) / 10 : 0
        });
    } catch (err) {
        console.error(err);
    }
};

// Call getAverageRating after saving review
reviewSchema.post('save', function() {
    this.constructor.getAverageRating(this.service);
});

// Call getAverageRating before removing review
reviewSchema.pre('remove', function() {
    this.constructor.getAverageRating(this.service);
});

module.exports = mongoose.model('Review', reviewSchema);
