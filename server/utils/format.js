exports.sendResponse = (res, statusCode, data) => {
    res.status(statusCode).json({
        success: true,
        data
    });
};

// Generate JWT Helper
const jwt = require('jsonwebtoken');

exports.generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
        expiresIn: process.env.JWT_EXPIRE || '30d'
    });
};
