const Booking = require('../models/Booking');
const Service = require('../models/Service');
const { sendResponse } = require('../utils/format');

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private (User only)
exports.createBooking = async (req, res, next) => {
    try {
        const { serviceId, date, totalPrice } = req.body;

        const service = await Service.findById(serviceId);
        if (!service) return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại' });

        const booking = await Booking.create({
            user: req.user.id,
            service: serviceId,
            date,
            totalPrice
        });

        // Automatically increment bookings count in Service model
        service.bookings += 1;
        await service.save();

        sendResponse(res, 201, booking);
    } catch (err) {
        next(err);
    }
};

// @desc    Get user bookings
// @route   GET /api/bookings
// @access  Private
exports.getBookings = async (req, res, next) => {
    try {
        let query;

        // If user is 'business', get bookings for their services. Otherwise get user's own bookings
        if (req.user.role === 'business') {
            const services = await Service.find({ owner: req.user.id }).select('_id');
            const serviceIds = services.map(s => s._id);
            query = Booking.find({ service: { $in: serviceIds } }).populate('user', 'name email').populate('service', 'name location');
        } else {
            query = Booking.find({ user: req.user.id }).populate('service', 'name location price image');
        }

        const bookings = await query.sort('-createdAt');
        sendResponse(res, 200, bookings);
    } catch (err) {
        next(err);
    }
};

// @desc    Update booking status
// @route   PUT /api/bookings/:id
// @access  Private (Business only)
exports.updateBooking = async (req, res, next) => {
    try {
        let booking = await Booking.findById(req.params.id).populate('service');
        if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt' });

        // Ensure user is the owner of the service being booked
        if (booking.service.owner.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Không có quyền thay đổi trạng thái đơn này' });
        }

        booking.status = req.body.status;
        await booking.save();

        sendResponse(res, 200, booking);
    } catch (err) {
        next(err);
    }
};
