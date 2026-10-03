const express = require('express');
const router = express.Router();
const { body, header, param } = require('express-validator');
const { protectUser } = require('../../middleware/userAuthMiddleware');
const { protect } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/adminMiddleware');
const { validate } = require('../../middleware/validate');
const { auditResponse } = require('../../middleware/audit-response.middleware');
const controller = require('./membership.controller');

const planFields = [
  body('name').trim().notEmpty().isLength({ max: 100 }), body('description').optional().trim().isLength({ max: 1000 }),
  body('pricePaise').isInt({ min: 0, max: Number.MAX_SAFE_INTEGER }), body('durationDays').isInt({ min: 1, max: 3650 }),
  body('discountBps').optional().isInt({ min: 0, max: 10000 }), body('priorityBooking').optional().isBoolean(),
  body('features').optional().isArray({ max: 50 }), body('features.*').optional().trim().isLength({ max: 100 })
];
const planUpdateFields = [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }), body('description').optional().trim().isLength({ max: 1000 }),
  body('pricePaise').optional().isInt({ min: 0, max: Number.MAX_SAFE_INTEGER }), body('durationDays').optional().isInt({ min: 1, max: 3650 }),
  body('discountBps').optional().isInt({ min: 0, max: 10000 }), body('priorityBooking').optional().isBoolean(),
  body('features').optional().isArray({ max: 50 }), body('features.*').optional().trim().isLength({ max: 100 }),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']),
  body().custom((value) => ['name', 'description', 'pricePaise', 'durationDays', 'discountBps', 'priorityBooking', 'features', 'status'].some((key) => value?.[key] !== undefined))
];

router.get('/plans', controller.plans);
router.get('/me', protectUser, controller.mine);
router.post('/purchase', protectUser, [header('Idempotency-Key').trim().isLength({ min: 8, max: 128 }), body('planId').isMongoId()], validate, controller.purchase);
router.get('/admin/plans', protect, isAdmin, controller.adminPlans);
router.post('/admin/plans', protect, isAdmin, planFields, validate, auditResponse('MEMBERSHIP_PLAN_CREATED', 'MembershipPlan', () => 'new'), controller.createPlan);
router.patch('/admin/plans/:id', protect, isAdmin, [param('id').isMongoId(), ...planUpdateFields], validate, auditResponse('MEMBERSHIP_PLAN_UPDATED', 'MembershipPlan'), controller.updatePlan);
module.exports = router;
