const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { protectUser } = require('../../middleware/userAuthMiddleware');
const { protect } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/adminMiddleware');
const { validate } = require('../../middleware/validate');
const { auditResponse } = require('../../middleware/audit-response.middleware');
const controller = require('./review.controller');

router.get('/', [query('targetType').optional().isIn(['VENUE', 'FACILITY', 'TURF']), query('targetId').optional().isMongoId(), query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })], validate, controller.publicList);
router.post('/', protectUser, [body('bookingId').isMongoId(), body('targetType').optional().isIn(['VENUE', 'FACILITY', 'TURF']), body('rating').isInt({ min: 1, max: 5 }), body('comment').optional().trim().isLength({ max: 2000 })], validate, controller.create);
router.get('/me', protectUser, controller.mine);
router.get('/admin', protect, isAdmin, [query('status').optional().isIn(['PENDING', 'PUBLISHED', 'HIDDEN', 'ALL']), query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })], validate, controller.adminList);
router.patch('/admin/:id', protect, isAdmin, [param('id').isMongoId(), body('status').isIn(['PUBLISHED', 'HIDDEN']), body('reason').if((value, { req }) => req.body.status === 'HIDDEN').trim().notEmpty().isLength({ max: 1000 })], validate, auditResponse('REVIEW_MODERATED', 'Review'), controller.moderate);
module.exports = router;
