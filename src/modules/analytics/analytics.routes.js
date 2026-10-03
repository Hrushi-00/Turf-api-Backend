const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/authMiddleware');
const { isAdmin, isBusinessUser } = require('../../middleware/adminMiddleware');
const controller = require('./analytics.controller');

router.get('/business', protect, isBusinessUser, controller.business);
router.get('/admin', protect, isAdmin, controller.admin);
module.exports = router;
