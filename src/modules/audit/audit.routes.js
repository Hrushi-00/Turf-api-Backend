const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/adminMiddleware');
const { validate } = require('../../middleware/validate');
const { query } = require('express-validator');
const controller = require('./audit.controller');

router.get('/', protect, isAdmin, [
  query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 }),
  query('actorId').optional().isMongoId(), query('entityId').optional().isLength({ max: 80 }),
  query('action').optional().isLength({ max: 120 }), query('entityType').optional().isLength({ max: 80 })
], validate, controller.list);
module.exports = router;
