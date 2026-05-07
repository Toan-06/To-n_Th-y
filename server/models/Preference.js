const mongoose = require('mongoose');

const preferenceSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    hiddenServices: [{
        type: mongoose.Schema.ObjectId,
        ref: 'Service'
    }],
    hiddenBusinesses: [{ type: String }], // ownerId strings
    favoriteServices: [{
        type: mongoose.Schema.ObjectId,
        ref: 'Service'
    }]
}, { timestamps: true });

module.exports = mongoose.model('Preference', preferenceSchema);
