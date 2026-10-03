const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const { protectUser } = require('../../middleware/userAuthMiddleware');
const { validate } = require('../../middleware/validate');
const controller = require('./loyalty.controller');

router.get('/me', protectUser, [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })], validate, controller.mine);
module.exports = router;
