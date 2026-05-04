const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
    try {
        let token;
        
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ success: false, message: 'Không có quyền truy cập (Missing token)' });
        }

        // Dùng cùng secret với backend cũ (routes/auth.js) để token tương thích 2 chiều
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'wander-viet-secret-key-123');
        
        // Tìm user trong DB mới; nếu không thấy (user ở DB cũ), dùng decoded payload
        let user = await User.findById(decoded.id).catch(() => null);
        if (!user) {
            // Token hợp lệ nhưng user chưa có trong DB mới — chấp nhận, gán dữ liệu từ payload
            user = { _id: decoded.id, id: decoded.id, role: decoded.role || 'business', name: decoded.name || '' };
        }
        req.user = user;
        
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
    }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: `Role ${req.user.role} không có quyền thực hiện hành động này` });
        }
        next();
    };
};
