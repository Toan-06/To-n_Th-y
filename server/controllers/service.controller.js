const Service = require('../models/Service');
const { sendResponse } = require('../utils/format');

// @desc    Get all services with filters, search, and pagination
// @route   GET /api/services
// @access  Public
exports.getServices = async (req, res, next) => {
    try {
        let query;
        const reqQuery = { ...req.query };

        // Fields to exclude
        const removeFields = ['select', 'sort', 'page', 'limit', 'search'];
        removeFields.forEach(param => delete reqQuery[param]);

        let queryStr = JSON.stringify(reqQuery);
        // Create operators ($gt, $gte, etc)
        queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
        
        let dbQuery = JSON.parse(queryStr);

        // Text Search
        if (req.query.search) {
            dbQuery.$text = { $search: req.query.search };
        }

        query = Service.find(dbQuery).populate({
            path: 'owner',
            select: 'name email'
        });

        // Sort
        if (req.query.sort) {
            const sortBy = req.query.sort.split(',').join(' ');
            query = query.sort(sortBy);
        } else {
            query = query.sort('-createdAt'); // Default sorting
        }

        // Pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const startIndex = (page - 1) * limit;
        const total = await Service.countDocuments(dbQuery);

        query = query.skip(startIndex).limit(limit);

        const services = await query;

        res.status(200).json({
            success: true,
            count: services.length,
            pagination: { page, limit, totalPages: Math.ceil(total / limit) },
            data: services
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get single service
// @route   GET /api/services/:id
// @access  Public
exports.getService = async (req, res, next) => {
    try {
        const service = await Service.findById(req.req.params.id).populate('owner', 'name email');
        if (!service) return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại' });
        
        sendResponse(res, 200, service);
    } catch (err) {
        next(err);
    }
};

// @desc    Create new service
// @route   POST /api/services
// @access  Private (Business only)
exports.createService = async (req, res, next) => {
    try {
        req.body.owner = req.user.id; // Assign owner from logged in user
        const service = await Service.create(req.body);
        sendResponse(res, 201, service);
    } catch (err) {
        next(err);
    }
};

// @desc    Update service
// @route   PUT /api/services/:id
// @access  Private (Business only)
exports.updateService = async (req, res, next) => {
    try {
        let service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại' });

        // Ensure user is service owner
        if (service.owner.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Không có quyền chỉnh sửa dịch vụ này' });
        }

        service = await Service.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        sendResponse(res, 200, service);
    } catch (err) {
        next(err);
    }
};

// @desc    Delete service
// @route   DELETE /api/services/:id
// @access  Private (Business only)
exports.deleteService = async (req, res, next) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại' });

        if (service.owner.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Không có quyền xóa dịch vụ này' });
        }

        await service.deleteOne();
        sendResponse(res, 200, {});
    } catch (err) {
        next(err);
    }
};
