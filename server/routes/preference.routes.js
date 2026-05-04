const express = require('express');
const { notInterested, getPreferences, undoNotInterested } = require('../controllers/preference.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', protect, getPreferences);
router.post('/not-interested', protect, notInterested);
router.delete('/not-interested/:serviceId', protect, undoNotInterested);

module.exports = router;
