const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
    try {
        let token;
        
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.header('x-auth-token')) {
            token = req.header('x-auth-token');
        }

        if (!token) {
            return res.status(401).json({ success: false, message: 'Không có quyền truy cập (Missing token)' });
        }

        // Dùng cùng secret với backend cũ (routes/auth.js) để token tương thích
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'wander-viet-secret-key-123');
        
        // Trích xuất thông tin user từ payload (hỗ trợ cả format cũ và mới)
        const userData = decoded.user || decoded.account || decoded;
        const userId = userData.id || userData._id;

        // Tìm user trong DB để đảm bảo user vẫn tồn tại và lấy role mới nhất
        let user = await User.findById(userId).catch(() => null);
        
        if (!user) {
            // Fallback cho tài khoản doanh nghiệp cũ (Legacy) hoặc user chưa migrate
            req.user = {
                id: userId,
                _id: userId,
                role: userData.role || decoded.role || 'business',
                name: userData.name || decoded.name || 'Doanh nghiệp'
            };
            return next();
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
