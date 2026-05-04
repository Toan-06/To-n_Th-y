const User = require('../models/User');
const { sendResponse, generateToken } = require('../utils/format');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
    try {
        const { name, email, password, role } = req.body;

        const user = await User.create({
            name,
            email,
            password,
            role
        });

        const token = generateToken(user._id);
        sendResponse(res, 201, { token, user: { id: user._id, name: user.name, role: user.role } });
    } catch (err) {
        next(err);
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email và mật khẩu' });
        }

        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ success: false, message: 'Thông tin đăng nhập không hợp lệ' });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Thông tin đăng nhập không hợp lệ' });
        }

        const token = generateToken(user._id);
        sendResponse(res, 200, { token, user: { id: user._id, name: user.name, role: user.role } });
    } catch (err) {
        next(err);
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'Người dùng không tồn tại' });
        }
        
        res.status(200).json({
            success: true,
            data: { id: user._id, name: user.name, role: user.role, email: user.email }
        });
    } catch (error) {
        next(error);
    }
};
