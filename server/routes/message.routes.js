const express = require('express');
const { sendMessage, getMessages, getConversations } = require('../controllers/message.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', protect, getConversations);
router.post('/', protect, sendMessage);
router.get('/:conversationId', protect, getMessages);

module.exports = router;
