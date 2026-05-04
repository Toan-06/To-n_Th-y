const express = require('express');
const { getServices, getService, createService, updateService, deleteService } = require('../controllers/service.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.route('/')
    .get(getServices)
    .post(protect, authorize('business', 'admin'), createService);

router.route('/:id')
    .get(getService)
    .put(protect, authorize('business', 'admin'), updateService)
    .delete(protect, authorize('business', 'admin'), deleteService);

module.exports = router;
