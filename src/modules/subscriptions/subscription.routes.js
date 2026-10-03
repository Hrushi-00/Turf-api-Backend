const express = require('express');
const router = express.Router();
const controller = require('./subscription.controller');
const { protect } = require('../../middleware/authMiddleware');
const { isBusinessUser, isAdmin } = require('../../middleware/adminMiddleware');
const { validate } = require('../../middleware/validate');
const { validatePlan, validatePlanUpdate, validatePlanId, validateCheckout, validateVerify } = require('./subscription.validation');

router.get('/plans', controller.listPlans);
router.post('/checkout', protect, isBusinessUser, validateCheckout, validate, controller.checkout);
router.post('/verify', protect, isBusinessUser, validateVerify, validate, controller.verify);
router.get('/me', protect, isBusinessUser, controller.current);
router.post('/cancel', protect, isBusinessUser, controller.cancel);
router.get('/admin/plans', protect, isAdmin, controller.adminPlans);
router.post('/admin/plans', protect, isAdmin, validatePlan, validate, controller.createPlan);
router.patch('/admin/plans/:id', protect, isAdmin, validatePlanId, validatePlanUpdate, validate, controller.updatePlan);
router.get('/admin/subscriptions', protect, isAdmin, controller.listSubscriptions);

module.exports = router;
