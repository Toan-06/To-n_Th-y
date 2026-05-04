const Preference = require('../models/Preference');

// @desc  Đánh dấu "Không quan tâm" một dịch vụ
// @route POST /api/preferences/not-interested
// @access Private
exports.notInterested = async (req, res, next) => {
    try {
        const { serviceId, businessId } = req.body;
        if (!serviceId && !businessId) {
            return res.status(400).json({ success: false, message: 'Cần serviceId hoặc businessId' });
        }

        const update = {};
        if (serviceId) update.$addToSet = { hiddenServices: serviceId };
        if (businessId) {
            update.$addToSet = { ...update.$addToSet, hiddenBusinesses: businessId };
        }

        const pref = await Preference.findOneAndUpdate(
            { user: req.user.id },
            update,
            { upsert: true, new: true }
        );

        res.status(200).json({ success: true, data: pref });
    } catch (err) {
        next(err);
    }
};

// @desc  Lấy danh sách ưu tiên của user
// @route GET /api/preferences
// @access Private
exports.getPreferences = async (req, res, next) => {
    try {
        const pref = await Preference.findOne({ user: req.user.id });
        res.status(200).json({
            success: true,
            data: pref || { hiddenServices: [], hiddenBusinesses: [] }
        });
    } catch (err) {
        next(err);
    }
};

// @desc  Bỏ "Không quan tâm" (undo)
// @route DELETE /api/preferences/not-interested/:serviceId
// @access Private
exports.undoNotInterested = async (req, res, next) => {
    try {
        await Preference.findOneAndUpdate(
            { user: req.user.id },
            { $pull: { hiddenServices: req.params.serviceId } }
        );
        res.status(200).json({ success: true, message: 'Đã bỏ ẩn dịch vụ' });
    } catch (err) {
        next(err);
    }
};
